//! A counter-based random source: the value depends only on `(seed, keys)`.
//!
//! `Rng` is a sequential stream, so its draws depend on the order they are
//! taken. `Counter` has no state at all. A parallel sampler, a GPU port and a
//! single-threaded loop that ask for the same `(seed, keys)` get the same word,
//! in any order.
//!
//! The mixer is Chris Wellons' `lowbias32` finalizer. It uses only 32-bit
//! xor, shift, add and multiply, so a shader reproduces it exactly.

const GOLDEN: u32 = 0x9e37_79b9;

/// `lowbias32`: a bijective 32-bit avalanche mixer.
#[inline]
pub fn mix(mut x: u32) -> u32 {
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    x
}

/// A keyed, stateless source of 32-bit words.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Counter {
    seed: u32,
}

impl Counter {
    pub fn new(seed: u32) -> Self {
        Self { seed }
    }

    pub fn seed(&self) -> u32 {
        self.seed
    }

    /// `h = mix(seed ^ GOLDEN)`, then for each key `h = mix(h ^ key) + GOLDEN`
    /// (wrapping). The final value is `h` after the last key.
    pub fn word(&self, keys: &[u32]) -> u32 {
        let mut h = mix(self.seed ^ GOLDEN);
        for &key in keys {
            h = mix(h ^ key).wrapping_add(GOLDEN);
        }
        h
    }

    /// The top 24 bits of `word`: an exact fraction `unit / 2^24` in `[0, 1)`.
    pub fn unit(&self, keys: &[u32]) -> u32 {
        self.word(keys) >> 8
    }

    /// An index in `0..total` from a 24-bit unit, `(unit * total) >> 24`.
    /// Exact integer arithmetic; requires `total < 2^40`.
    pub fn below(&self, total: u64, keys: &[u32]) -> u64 {
        pick_below(self.unit(keys), total)
    }
}

/// `(unit * total) >> 24`, the shared mapping from a 24-bit unit to an index.
#[inline]
pub fn pick_below(unit: u32, total: u64) -> u64 {
    ((unit as u128 * total as u128) >> 24) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mix_is_a_bijection_on_a_sample_and_never_fixes_small_inputs() {
        let mut seen = std::collections::BTreeSet::new();
        for x in 0..50_000u32 {
            assert!(seen.insert(mix(x)));
        }
        assert_ne!(mix(1), 1);
    }

    #[test]
    fn word_depends_on_every_key_and_their_order() {
        let c = Counter::new(7);
        let base = c.word(&[1, 2, 3]);
        assert_ne!(base, c.word(&[1, 2, 4]));
        assert_ne!(base, c.word(&[1, 3, 2]));
        assert_ne!(base, c.word(&[1, 2, 3, 0]));
        assert_ne!(base, Counter::new(8).word(&[1, 2, 3]));
        assert_eq!(base, Counter::new(7).word(&[1, 2, 3]));
    }

    #[test]
    fn units_spread_evenly() {
        let c = Counter::new(1234);
        let mut buckets = [0u32; 16];
        for i in 0..64_000u32 {
            buckets[(c.unit(&[i, 5]) >> 20) as usize] += 1;
        }
        for count in buckets {
            assert!((3_600..4_400).contains(&count), "{buckets:?}");
        }
    }

    #[test]
    fn below_stays_in_range_at_both_ends() {
        assert_eq!(pick_below(0, 1_000_000), 0);
        assert_eq!(pick_below((1 << 24) - 1, 1_000_000), 999_999);
        assert!(pick_below((1 << 24) - 1, (1 << 40) - 1) < (1 << 40) - 1);
    }
}
