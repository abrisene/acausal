//! Caller-owned MT19937 random streams and numeric distributions.
//!
//! The scalar and array seeding paths intentionally follow the TypeScript
//! implementation in `packages/random`.  A seeded stream is warmed by 2000
//! generated words, which is part of the replay contract of the old API.

use crate::Error;

const N: usize = 624;
const M: usize = 397;
const MATRIX_A: u32 = 0x9908_b0df;
const UPPER_MASK: u32 = 0x8000_0000;
const LOWER_MASK: u32 = 0x7fff_ffff;
const PREWARM: u64 = 2_000;
const STATE_VERSION: u32 = 1;
const STATE_MAGIC: &[u8; 4] = b"RNG1";
const MAX_RETRIES: usize = 1_000_000;

/// A scalar seed or the word array accepted by MT19937's array seeder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Seed {
    Scalar(u32),
    Words(Vec<u32>),
}

impl From<u32> for Seed {
    fn from(value: u32) -> Self {
        Self::Scalar(value)
    }
}

impl From<Vec<u32>> for Seed {
    fn from(value: Vec<u32>) -> Self {
        Self::Words(value)
    }
}

impl From<&[u32]> for Seed {
    fn from(value: &[u32]) -> Self {
        Self::Words(value.to_vec())
    }
}

impl Seed {
    fn validate(&self) -> Result<(), Error> {
        if matches!(self, Self::Words(values) if values.is_empty()) {
            return Err(Error::InvalidParameter(
                "seed words must contain at least one word".to_string(),
            ));
        }
        Ok(())
    }
}

/// A complete, versioned MT19937 continuation point.
///
/// `state` contains all 624 words, including words that have not yet been
/// consumed in the current twist.  The encoded form is deliberately opaque
/// to bindings, but contains the original seed for diagnostics and one-time
/// legacy conversion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RngState {
    pub version: u32,
    pub seed: Seed,
    pub uses: u64,
    pub index: usize,
    pub state: Vec<u32>,
}

impl RngState {
    pub const VERSION: u32 = STATE_VERSION;

    /// Encode a state as a version-tagged little-endian byte string.
    pub fn encode(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(4 + 4 + 1 + 4 + 8 + 4 + 4 + N * 4);
        bytes.extend_from_slice(STATE_MAGIC);
        put_u32(&mut bytes, self.version);
        match &self.seed {
            Seed::Scalar(value) => {
                bytes.push(0);
                put_u32(&mut bytes, 1);
                put_u32(&mut bytes, *value);
            }
            Seed::Words(values) => {
                bytes.push(1);
                put_u32(&mut bytes, values.len() as u32);
                for value in values {
                    put_u32(&mut bytes, *value);
                }
            }
        }
        put_u64(&mut bytes, self.uses);
        put_u32(&mut bytes, self.index as u32);
        put_u32(&mut bytes, self.state.len() as u32);
        for value in &self.state {
            put_u32(&mut bytes, *value);
        }
        bytes
    }

    /// Decode a state emitted by [`RngState::encode`].
    pub fn decode(bytes: &[u8]) -> Result<Self, Error> {
        let mut cursor = 0usize;
        if take(bytes, &mut cursor, 4)? != STATE_MAGIC {
            return Err(Error::InvalidState("invalid RNG state magic".to_string()));
        }
        let version = take_u32(bytes, &mut cursor)?;
        if version != STATE_VERSION {
            return Err(Error::InvalidState(format!(
                "unsupported RNG state version {version}"
            )));
        }
        let seed_tag = take_u8(bytes, &mut cursor)?;
        let seed_len = take_u32(bytes, &mut cursor)? as usize;
        if seed_len == 0 || seed_len > 1_000_000 {
            return Err(Error::InvalidState("invalid seed word count".to_string()));
        }
        let mut words = Vec::with_capacity(seed_len);
        for _ in 0..seed_len {
            words.push(take_u32(bytes, &mut cursor)?);
        }
        let seed = match seed_tag {
            0 if seed_len == 1 => Seed::Scalar(words[0]),
            1 => Seed::Words(words),
            _ => return Err(Error::InvalidState("invalid seed encoding".to_string())),
        };
        let uses = take_u64(bytes, &mut cursor)?;
        let index = take_u32(bytes, &mut cursor)? as usize;
        let state_len = take_u32(bytes, &mut cursor)? as usize;
        if state_len != N || index > N {
            return Err(Error::InvalidState(
                "RNG state must contain 624 words and an index in 0..=624".to_string(),
            ));
        }
        let mut state = Vec::with_capacity(state_len);
        for _ in 0..state_len {
            state.push(take_u32(bytes, &mut cursor)?);
        }
        if cursor != bytes.len() {
            return Err(Error::InvalidState(
                "trailing bytes in RNG state".to_string(),
            ));
        }
        Ok(Self {
            version,
            seed,
            uses,
            index,
            state,
        })
    }
}

/// A reproducible caller-owned random stream.
#[derive(Debug, PartialEq, Eq)]
pub struct Rng {
    seed: Seed,
    mt: [u32; N],
    index: usize,
    uses: u64,
}

impl Clone for Rng {
    fn clone(&self) -> Self {
        Self {
            seed: self.seed.clone(),
            mt: self.mt,
            index: self.index,
            uses: self.uses,
        }
    }
}

impl Rng {
    /// Construct a scalar-seeded stream with the historical 2000-word warmup.
    pub fn seeded(seed: u32) -> Self {
        Self::from_seed_and_discard(Seed::Scalar(seed), PREWARM)
            .expect("scalar seeds are always valid")
    }

    /// Construct an array-seeded stream with the historical warmup.
    pub fn from_seed_words(words: &[u32]) -> Result<Self, Error> {
        Self::from_seed_and_discard(Seed::Words(words.to_vec()), PREWARM)
    }

    /// Restore the old seed/use-count representation once.
    ///
    /// Unlike [`Rng::seeded`], `uses` is the exact number of words to discard;
    /// this matches the legacy `{ seed, uses }` constructor.  New callers
    /// should persist [`RngState`] instead of replaying from a seed.
    pub fn from_legacy(seed: Seed, uses: u64) -> Result<Self, Error> {
        Self::from_seed_and_discard(seed, uses)
    }

    fn from_seed_and_discard(seed: Seed, discard: u64) -> Result<Self, Error> {
        seed.validate()?;
        let mut rng = Self {
            seed: seed.clone(),
            mt: [0; N],
            index: N,
            uses: 0,
        };
        match &seed {
            Seed::Scalar(value) => rng.seed_scalar(*value),
            Seed::Words(values) => rng.seed_words(values),
        }
        for _ in 0..discard {
            rng.next_u32();
        }
        Ok(rng)
    }

    fn seed_scalar(&mut self, seed: u32) {
        self.mt[0] = seed;
        for i in 1..N {
            self.mt[i] = 1_812_433_253u32
                .wrapping_mul(self.mt[i - 1] ^ (self.mt[i - 1] >> 30))
                .wrapping_add(i as u32);
        }
        self.index = N;
    }

    fn seed_words(&mut self, words: &[u32]) {
        self.seed_scalar(19_650_218);
        let mut i = 1usize;
        let mut j = 0usize;
        let mut k = N.max(words.len());
        while k > 0 {
            let mixed = self.mt[i - 1] ^ (self.mt[i - 1] >> 30);
            self.mt[i] = (self.mt[i] ^ mixed.wrapping_mul(1_664_525))
                .wrapping_add(words[j])
                .wrapping_add(j as u32);
            i += 1;
            j += 1;
            if i >= N {
                self.mt[0] = self.mt[N - 1];
                i = 1;
            }
            if j >= words.len() {
                j = 0;
            }
            k -= 1;
        }
        k = N - 1;
        while k > 0 {
            let mixed = self.mt[i - 1] ^ (self.mt[i - 1] >> 30);
            self.mt[i] = (self.mt[i] ^ mixed.wrapping_mul(1_566_083_941)).wrapping_sub(i as u32);
            i += 1;
            if i >= N {
                self.mt[0] = self.mt[N - 1];
                i = 1;
            }
            k -= 1;
        }
        self.mt[0] = UPPER_MASK;
        self.index = N;
    }

    /// Number of generated MT words, including the warmup words.
    pub fn uses(&self) -> u64 {
        self.uses
    }

    pub fn seed(&self) -> &Seed {
        &self.seed
    }

    /// Return the complete continuation point.
    pub fn snapshot(&self) -> RngState {
        RngState {
            version: STATE_VERSION,
            seed: self.seed.clone(),
            uses: self.uses,
            index: self.index,
            state: self.mt.to_vec(),
        }
    }

    /// Restore a complete continuation point without replaying discarded words.
    pub fn from_state(state: RngState) -> Result<Self, Error> {
        if state.version != STATE_VERSION {
            return Err(Error::InvalidState(format!(
                "unsupported RNG state version {}",
                state.version
            )));
        }
        state.seed.validate()?;
        if state.state.len() != N || state.index > N {
            return Err(Error::InvalidState(
                "RNG state must contain 624 words and an index in 0..=624".to_string(),
            ));
        }
        let mut mt = [0u32; N];
        mt.copy_from_slice(&state.state);
        Ok(Self {
            seed: state.seed,
            mt,
            index: state.index,
            uses: state.uses,
        })
    }

    /// Generate one tempered MT19937 word.
    pub fn next_u32(&mut self) -> u32 {
        if self.index >= N {
            self.twist();
        }
        let mut y = self.mt[self.index];
        self.index += 1;
        y ^= y >> 11;
        y ^= (y << 7) & 0x9d2c_5680;
        y ^= (y << 15) & 0xefc6_0000;
        y ^= y >> 18;
        self.uses = self.uses.wrapping_add(1);
        y
    }

    fn twist(&mut self) {
        for i in 0..N {
            let y = (self.mt[i] & UPPER_MASK) | (self.mt[(i + 1) % N] & LOWER_MASK);
            let mag = if y & 1 == 0 { 0 } else { MATRIX_A };
            self.mt[i] = self.mt[(i + M) % N] ^ (y >> 1) ^ mag;
        }
        self.index = 0;
    }

    fn unit(&mut self) -> f64 {
        let a = self.next_u32() >> 5;
        let b = self.next_u32() >> 6;
        let denominator = 9_007_199_254_740_992.0;
        ((a as u64 * 0x0400_0000u64 + b as u64) as f64) / denominator
    }

    fn next_u64(&mut self) -> u64 {
        ((self.next_u32() as u64) << 32) | self.next_u32() as u64
    }

    /// Generate an integer in the inclusive range `[min, max]`.
    pub fn int(&mut self, min: i64, max: i64) -> Result<i64, Error> {
        if min > max {
            return Err(Error::InvalidParameter(
                "int: min must be <= max".to_string(),
            ));
        }
        let range = (max as i128) - (min as i128);
        let span = range + 1;
        if span == 1 {
            return Ok(min);
        }
        if span <= (1i128 << 32) {
            let span = span as u64;
            if span == 1u64 << 32 {
                return Ok(min + self.next_u32() as i64);
            }
            // `(-span >>> 0) % span` in the TypeScript implementation is
            // equivalent to `2^32 % span` for a positive u32 span.
            let limit = ((1u64 << 32) % span) as u32;
            loop {
                let value = self.next_u32();
                if value >= limit {
                    return Ok(min + (value as u64 % span) as i64);
                }
            }
        }

        // i64 permits a range wider than one u32.  This branch keeps the
        // operation useful for bindings while retaining unbiased rejection;
        // the compatibility contract above is exact for all <= u32 spans.
        let span = span as u128;
        let modulus = 1u128 << 64;
        if span == modulus {
            return Ok(min.wrapping_add(self.next_u64() as i64));
        }
        let limit = modulus % span;
        loop {
            let value = self.next_u64() as u128;
            if value >= limit {
                return Ok((min as i128 + (value % span) as i128) as i64);
            }
        }
    }

    /// Generate a real in the half-open range `[min, max)`.
    pub fn float(&mut self, min: f64, max: f64) -> Result<f64, Error> {
        if !min.is_finite() || !max.is_finite() {
            return Err(Error::InvalidParameter(
                "float: bounds must be finite".to_string(),
            ));
        }
        if min > max {
            return Err(Error::InvalidParameter(
                "float: min must be <= max".to_string(),
            ));
        }
        let span = max - min;
        if !span.is_finite() {
            return Err(Error::InvalidParameter(
                "float: range width must be finite".to_string(),
            ));
        }
        let mut value = self.unit() * span + min;
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "float: result is not finite".to_string(),
            ));
        }
        if min < max && value >= max {
            value = max.next_down();
        }
        Ok(value)
    }

    /// Generate a boolean with probability `p` of `true`.
    pub fn bool(&mut self, p: f64) -> Result<bool, Error> {
        if !p.is_finite() || !(0.0..=1.0).contains(&p) {
            return Err(Error::InvalidParameter(
                "bool: p must be finite and in [0, 1]".to_string(),
            ));
        }
        Ok(self.float(0.0, 1.0)? < p)
    }

    /// Sample a numeric distribution using this stream.
    pub fn sample(&mut self, distribution: &Distribution) -> Result<f64, Error> {
        match distribution {
            Distribution::Uniform { min, max } => self.float(*min, *max),
            Distribution::Normal { mean, stddev } => self.normal(*mean, *stddev),
            Distribution::ClampedNormal {
                mean,
                stddev,
                min,
                max,
            } => self.clamped_normal(*mean, *stddev, *min, *max),
            Distribution::LogNormal { mean, stddev } => self.log_normal(*mean, *stddev),
            Distribution::Exponential { rate } => self.exponential(*rate),
            Distribution::Poisson { rate } => self.poisson(*rate),
            Distribution::Binomial {
                trials,
                probability,
            } => self.binomial(*trials, *probability),
            Distribution::Geometric { probability } => self.geometric(*probability),
            Distribution::Beta { alpha, beta } => self.beta(*alpha, *beta),
            Distribution::Gamma { shape, scale } => self.gamma(*shape, *scale),
            Distribution::Weibull {
                shape,
                scale,
                location,
            } => self.weibull(*shape, *scale, *location),
            Distribution::Cauchy { location, scale } => self.cauchy(*location, *scale),
            Distribution::Logistic { location, scale } => self.logistic(*location, *scale),
            Distribution::Bernoulli { probability } => {
                Ok(if self.bool(*probability)? { 1.0 } else { 0.0 })
            }
        }
    }

    pub fn normal(&mut self, mu: f64, sigma: f64) -> Result<f64, Error> {
        if !mu.is_finite() || !sigma.is_finite() || sigma < 0.0 {
            return Err(Error::InvalidParameter(
                "normal: mu must be finite and sigma must be finite and >= 0".to_string(),
            ));
        }
        if sigma == 0.0 {
            return Ok(mu);
        }
        let u1 = 1.0 - self.unit();
        let u2 = self.unit();
        let z0 = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        let result = z0 * sigma + mu;
        if !result.is_finite() {
            return Err(Error::InvalidParameter(
                "normal: result is not finite".to_string(),
            ));
        }
        Ok(result)
    }

    pub fn clamped_normal(
        &mut self,
        mu: f64,
        sigma: f64,
        min: f64,
        max: f64,
    ) -> Result<f64, Error> {
        if !min.is_finite() || !max.is_finite() || min > max {
            return Err(Error::InvalidParameter(
                "clampedNormal: bounds must be finite and min <= max".to_string(),
            ));
        }
        Ok(self.normal(mu, sigma)?.clamp(min, max))
    }

    pub fn log_normal(&mut self, mu: f64, sigma: f64) -> Result<f64, Error> {
        let value = self.normal(mu, sigma)?.exp();
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "logNormal: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }

    pub fn exponential(&mut self, lambda: f64) -> Result<f64, Error> {
        if !lambda.is_finite() || lambda <= 0.0 {
            return Err(Error::InvalidParameter(
                "exponential: lambda must be finite and > 0".to_string(),
            ));
        }
        let value = -(1.0 - self.unit()).ln() / lambda;
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "exponential: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }

    pub fn poisson(&mut self, lambda: f64) -> Result<f64, Error> {
        if !lambda.is_finite() || lambda < 0.0 {
            return Err(Error::InvalidParameter(
                "poisson: lambda must be finite and >= 0".to_string(),
            ));
        }
        if lambda < 30.0 {
            let threshold = (-lambda).exp();
            let mut k = 0u64;
            let mut product = 1.0;
            for attempt in 0..MAX_RETRIES {
                k += 1;
                product *= self.unit();
                if product <= threshold {
                    return Ok((k - 1) as f64);
                }
                if attempt + 1 == MAX_RETRIES {
                    return Err(Error::GenerationExhausted {
                        attempts: MAX_RETRIES,
                    });
                }
            }
            unreachable!()
        }
        Ok(self.normal(lambda, lambda.sqrt())?.round().max(0.0))
    }

    pub fn binomial(&mut self, n: f64, p: f64) -> Result<f64, Error> {
        if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > usize::MAX as f64 {
            return Err(Error::InvalidParameter(
                "binomial: n must be a finite non-negative integer".to_string(),
            ));
        }
        if !p.is_finite() || !(0.0..=1.0).contains(&p) {
            return Err(Error::InvalidParameter(
                "binomial: p must be finite and in [0, 1]".to_string(),
            ));
        }
        if n > MAX_RETRIES as f64 {
            return Err(Error::BudgetExceeded {
                operations: n.min(usize::MAX as f64) as usize,
                limit: MAX_RETRIES,
            });
        }
        let n = n as usize;
        let mut successes = 0usize;
        for _ in 0..n {
            if self.bool(p)? {
                successes += 1;
            }
        }
        Ok(successes as f64)
    }

    pub fn geometric(&mut self, p: f64) -> Result<f64, Error> {
        if !p.is_finite() || p <= 0.0 || p > 1.0 {
            return Err(Error::InvalidParameter(
                "geometric: p must be finite and in (0, 1]".to_string(),
            ));
        }
        let u = self.unit();
        if p == 1.0 {
            return Ok(1.0);
        }
        let value = ((-u).ln_1p() / (-p).ln_1p()).floor() + 1.0;
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "geometric: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }

    pub fn gamma(&mut self, k: f64, theta: f64) -> Result<f64, Error> {
        if !k.is_finite() || k <= 0.0 || !theta.is_finite() || theta <= 0.0 {
            return Err(Error::InvalidParameter(
                "gamma: k and theta must be finite and > 0".to_string(),
            ));
        }
        if k < 1.0 {
            let value = self.gamma(k + 1.0, theta)? * self.unit().powf(1.0 / k);
            return if value.is_finite() {
                Ok(value)
            } else {
                Err(Error::InvalidParameter(
                    "gamma: result is not finite".to_string(),
                ))
            };
        }
        let d = k - 1.0 / 3.0;
        let c = 1.0 / (9.0 * d).sqrt();
        for attempt in 0..MAX_RETRIES {
            let x = self.normal(0.0, 1.0)?;
            let v0 = 1.0 + c * x;
            if v0 <= 0.0 {
                if attempt + 1 == MAX_RETRIES {
                    return Err(Error::GenerationExhausted {
                        attempts: MAX_RETRIES,
                    });
                }
                continue;
            }
            let v = v0 * v0 * v0;
            let u = self.unit();
            if u < 1.0 - 0.0331 * x.powi(4) || u.ln() < 0.5 * x * x + d * (1.0 - v + v.ln()) {
                let value = d * v * theta;
                if value.is_finite() {
                    return Ok(value);
                }
                return Err(Error::InvalidParameter(
                    "gamma: result is not finite".to_string(),
                ));
            }
            if attempt + 1 == MAX_RETRIES {
                return Err(Error::GenerationExhausted {
                    attempts: MAX_RETRIES,
                });
            }
        }
        unreachable!()
    }

    pub fn beta(&mut self, alpha: f64, beta: f64) -> Result<f64, Error> {
        if !alpha.is_finite() || alpha <= 0.0 || !beta.is_finite() || beta <= 0.0 {
            return Err(Error::InvalidParameter(
                "beta: alpha and beta must be finite and > 0".to_string(),
            ));
        }
        let x = self.gamma(alpha, 1.0)?;
        let y = self.gamma(beta, 1.0)?;
        let total = x + y;
        if total == 0.0 || !total.is_finite() {
            return Err(Error::InvalidParameter(
                "beta: result is not finite".to_string(),
            ));
        }
        Ok(x / total)
    }

    pub fn weibull(&mut self, k: f64, a: f64, b: f64) -> Result<f64, Error> {
        if !k.is_finite() || k <= 0.0 || !a.is_finite() || a <= 0.0 || !b.is_finite() {
            return Err(Error::InvalidParameter(
                "weibull: k and a must be finite and > 0, b finite".to_string(),
            ));
        }
        let value = a * (-(1.0 - self.unit()).ln()).powf(1.0 / k) + b;
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "weibull: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }

    pub fn cauchy(&mut self, a: f64, b: f64) -> Result<f64, Error> {
        if !a.is_finite() || !b.is_finite() || b <= 0.0 {
            return Err(Error::InvalidParameter(
                "cauchy: a must be finite and b must be finite and > 0".to_string(),
            ));
        }
        let value = a + b * (std::f64::consts::PI * (self.unit() - 0.5)).tan();
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "cauchy: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }

    pub fn logistic(&mut self, a: f64, b: f64) -> Result<f64, Error> {
        if !a.is_finite() || !b.is_finite() || b <= 0.0 {
            return Err(Error::InvalidParameter(
                "logistic: a must be finite and b must be finite and > 0".to_string(),
            ));
        }
        let u = 1.0 - self.unit();
        let value = a + b * (u / (1.0 - u)).ln();
        if !value.is_finite() {
            return Err(Error::InvalidParameter(
                "logistic: result is not finite".to_string(),
            ));
        }
        Ok(value)
    }
}

/// Parameterized numeric distributions accepted by [`Rng::sample`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Distribution {
    Uniform {
        min: f64,
        max: f64,
    },
    Normal {
        mean: f64,
        stddev: f64,
    },
    ClampedNormal {
        mean: f64,
        stddev: f64,
        min: f64,
        max: f64,
    },
    LogNormal {
        mean: f64,
        stddev: f64,
    },
    Exponential {
        rate: f64,
    },
    Poisson {
        rate: f64,
    },
    Binomial {
        trials: f64,
        probability: f64,
    },
    Geometric {
        probability: f64,
    },
    Beta {
        alpha: f64,
        beta: f64,
    },
    Gamma {
        shape: f64,
        scale: f64,
    },
    Weibull {
        shape: f64,
        scale: f64,
        location: f64,
    },
    Cauchy {
        location: f64,
        scale: f64,
    },
    Logistic {
        location: f64,
        scale: f64,
    },
    Bernoulli {
        probability: f64,
    },
}

fn put_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn put_u64(bytes: &mut Vec<u8>, value: u64) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn take<'a>(bytes: &'a [u8], cursor: &mut usize, count: usize) -> Result<&'a [u8], Error> {
    let end = cursor
        .checked_add(count)
        .ok_or_else(|| Error::InvalidState("RNG state length overflow".to_string()))?;
    if end > bytes.len() {
        return Err(Error::InvalidState("truncated RNG state".to_string()));
    }
    let result = &bytes[*cursor..end];
    *cursor = end;
    Ok(result)
}

fn take_u8(bytes: &[u8], cursor: &mut usize) -> Result<u8, Error> {
    Ok(take(bytes, cursor, 1)?[0])
}

fn take_u32(bytes: &[u8], cursor: &mut usize) -> Result<u32, Error> {
    let mut value = [0u8; 4];
    value.copy_from_slice(take(bytes, cursor, 4)?);
    Ok(u32::from_le_bytes(value))
}

fn take_u64(bytes: &[u8], cursor: &mut usize) -> Result<u64, Error> {
    let mut value = [0u8; 8];
    value.copy_from_slice(take(bytes, cursor, 8)?);
    Ok(u64::from_le_bytes(value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scalar_fixture_matches_typescript_small_ints() {
        let mut rng = Rng::seeded(42);
        let expected = [3, 2, 4, 6, 2, 1, 6, 3, 1, 3, 3, 1, 4, 4, 6, 4];
        for value in expected {
            assert_eq!(rng.int(1, 6).unwrap(), value);
        }
        assert_eq!(rng.uses(), 2_016);
    }

    #[test]
    fn scalar_wide_integer_fixture_matches_typescript() {
        let mut rng = Rng::seeded(42);
        assert_eq!(rng.int(0, 0).unwrap(), 0);
        assert_eq!(rng.int(-5, 5).unwrap(), -3);
        assert_eq!(rng.int(0, 255).unwrap(), 11);
        assert_eq!(rng.int(0, 65_535).unwrap(), 1_341);
        assert_eq!(rng.int(0, 2_147_483_647).unwrap(), 1_967_828_559);
        assert_eq!(rng.int(1_000_000, 2_000_000).unwrap(), 1_270_066);
    }

    #[test]
    fn primitive_float_and_bool_fixture_matches_typescript() {
        let mut floats = Rng::seeded(7);
        assert_eq!(floats.float(0.0, 1.0).unwrap(), 0.08378587007198324);
        assert_eq!(floats.float(0.0, 1.0).unwrap(), 0.526152908756173);

        let mut bools = Rng::seeded(99);
        assert!(!bools.bool(0.5).unwrap());
        assert!(bools.bool(0.5).unwrap());
        assert!(!bools.bool(0.5).unwrap());
        assert_eq!(bools.uses(), 2_006);
    }

    #[test]
    fn array_seed_and_legacy_use_fixture_match_typescript() {
        let mut array = Rng::from_seed_words(&[1, 2, 3, 4]).unwrap();
        let expected = [79, 308, 437, 327, 480, 385, 257, 123];
        for value in expected {
            assert_eq!(array.int(0, 999).unwrap(), value);
        }
        assert_eq!(array.float(0.0, 1.0).unwrap(), 0.18209697408146575);

        let mut legacy = Rng::from_legacy(Seed::Scalar(250), 100).unwrap();
        assert_eq!(legacy.int(0, 1_000).unwrap(), 182);
        assert_eq!(legacy.uses(), 101);
    }

    #[test]
    fn snapshot_codec_restores_exact_continuation() {
        let mut original = Rng::seeded(123);
        let _ = original.int(-5, 5);
        let state = original.snapshot();
        let encoded = state.encode();
        let restored = Rng::from_state(RngState::decode(&encoded).unwrap()).unwrap();
        let mut expected = original.clone();
        let mut actual = restored;
        for _ in 0..20 {
            assert_eq!(expected.next_u32(), actual.next_u32());
        }
        assert_eq!(expected.snapshot(), actual.snapshot());
    }

    #[test]
    fn invalid_distribution_parameters_do_not_consume_state() {
        let mut rng = Rng::seeded(1);
        let before = rng.uses();
        assert!(
            rng.sample(&Distribution::Exponential { rate: 0.0 })
                .is_err()
        );
        assert_eq!(rng.uses(), before);
        assert!(
            rng.sample(&Distribution::Bernoulli {
                probability: f64::NAN,
            })
            .is_err()
        );
        assert_eq!(rng.uses(), before);
    }
}
