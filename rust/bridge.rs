//! Private transport shared by the native and wasm bindings.
//! Models and algorithms remain in the ordinary Rust API.

use crate::{
    Assignment, BlendStrategy, BoundaryData, Constraint, Direction, Distribution, Error,
    GenerateOptions, Limits, Markov, MarkovData, Model, ModelSpec, Replacement, Rng, RngState, Row,
    Seed, Table, TransitionData, Variable, Weighted,
};
use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};

const MAX_BUFFER: usize = 16 * 1024 * 1024;

enum Resource {
    Bytes(Vec<u8>),
    Rng(Box<Rng>),
    Weighted(Weighted<String>),
    Markov(Markov<String>),
    Model {
        compiled: Box<Model>,
        limits: Limits,
    },
}

#[derive(Default)]
struct Store {
    next: u32,
    resources: BTreeMap<u32, Resource>,
}

impl Store {
    fn insert(&mut self, resource: Resource) -> Result<u32, Error> {
        self.next = self
            .next
            .checked_add(1)
            .ok_or_else(|| invalid("handle space exhausted"))?;
        self.resources.insert(self.next, resource);
        Ok(self.next)
    }

    fn with_rng<T>(
        &mut self,
        id: u32,
        f: impl FnOnce(&mut Self, &mut Rng) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let resource = self
            .resources
            .remove(&id)
            .ok_or_else(|| invalid("unknown RNG handle"))?;
        match resource {
            Resource::Rng(mut rng) => {
                let result = f(self, &mut rng);
                self.resources.insert(id, Resource::Rng(rng));
                result
            }
            other => {
                self.resources.insert(id, other);
                Err(invalid("handle is not an RNG"))
            }
        }
    }
}

fn store() -> &'static Mutex<Store> {
    static STORE: OnceLock<Mutex<Store>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(Store::default()))
}

fn invalid(message: &str) -> Error {
    Error::InvalidParameter(message.into())
}

struct Reader<'a> {
    bytes: &'a [u8],
    position: usize,
}
impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, position: 0 }
    }
    fn take(&mut self, len: usize) -> Result<&'a [u8], Error> {
        let end = self
            .position
            .checked_add(len)
            .ok_or_else(|| invalid("invalid payload length"))?;
        let bytes = self
            .bytes
            .get(self.position..end)
            .ok_or_else(|| invalid("truncated payload"))?;
        self.position = end;
        Ok(bytes)
    }
    fn byte(&mut self) -> Result<u8, Error> {
        Ok(self.take(1)?[0])
    }
    fn boolean(&mut self) -> Result<bool, Error> {
        match self.byte()? {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(invalid("invalid boolean")),
        }
    }
    fn u32(&mut self) -> Result<u32, Error> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i64(&mut self) -> Result<i64, Error> {
        Ok(i64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn u64(&mut self) -> Result<u64, Error> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn f64(&mut self) -> Result<f64, Error> {
        Ok(f64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn text(&mut self) -> Result<String, Error> {
        let len = self.u32()? as usize;
        String::from_utf8(self.take(len)?.to_vec()).map_err(|_| invalid("invalid UTF-8"))
    }
    fn strings(&mut self) -> Result<Vec<String>, Error> {
        let len = self.u32()? as usize;
        if len > self.bytes.len().saturating_sub(self.position) / 4 {
            return Err(invalid("invalid item count"));
        }
        (0..len).map(|_| self.text()).collect()
    }
    fn count(&mut self) -> Result<usize, Error> {
        let count = self.u32()? as usize;
        if count > self.bytes.len().saturating_sub(self.position) {
            return Err(invalid("invalid collection count"));
        }
        Ok(count)
    }
    fn assignment(&mut self) -> Result<Assignment, Error> {
        let count = self.count()?;
        let mut result = Assignment::new();
        for _ in 0..count {
            if result.insert(self.text()?, self.text()?).is_some() {
                return Err(invalid("duplicate assignment variable"));
            }
        }
        Ok(result)
    }
    fn pairs(&mut self) -> Result<Vec<(String, f64)>, Error> {
        let count = self.count()?;
        (0..count)
            .map(|_| Ok((self.text()?, self.f64()?)))
            .collect()
    }
    fn limits(&mut self) -> Result<Limits, Error> {
        if !self.boolean()? {
            return Ok(Limits::default());
        }
        Ok(Limits {
            max_domain_size: self.u32()? as usize,
            max_variables: self.u32()? as usize,
            max_factors: self.u32()? as usize,
            max_elimination_width: self.u32()? as usize,
            max_joint_support: self.u32()? as usize,
            max_operations: self.u32()? as usize,
        })
    }
    fn finish(&self) -> Result<(), Error> {
        if self.position == self.bytes.len() {
            Ok(())
        } else {
            Err(invalid("unexpected payload bytes"))
        }
    }
}

#[derive(Default)]
struct Writer(Vec<u8>);
impl Writer {
    fn u32(&mut self, value: u32) {
        self.0.extend(value.to_le_bytes());
    }
    fn u64(&mut self, value: u64) {
        self.0.extend(value.to_le_bytes());
    }
    fn i64(&mut self, value: i64) {
        self.0.extend(value.to_le_bytes());
    }
    fn f64(&mut self, value: f64) {
        self.0.extend(value.to_le_bytes());
    }
    fn text(&mut self, value: &str) {
        self.u32(value.len() as u32);
        self.0.extend(value.as_bytes());
    }
    fn strings(&mut self, values: &[String]) {
        self.u32(values.len() as u32);
        for value in values {
            self.text(value);
        }
    }
    fn assignment(&mut self, values: &Assignment) {
        self.u32(values.len() as u32);
        for (key, value) in values {
            self.text(key);
            self.text(value);
        }
    }
    fn pairs(&mut self, values: &[(String, f64)]) {
        self.u32(values.len() as u32);
        for (key, value) in values {
            self.text(key);
            self.f64(*value);
        }
    }
    fn limits(&mut self, limits: Limits) {
        self.0.push(1);
        for value in [
            limits.max_domain_size,
            limits.max_variables,
            limits.max_factors,
            limits.max_elimination_width,
            limits.max_joint_support,
            limits.max_operations,
        ] {
            self.u32(value as u32);
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_abi_version() -> u32 {
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_alloc(length: u32) -> u32 {
    if length as usize > MAX_BUFFER {
        return 0;
    }
    store()
        .lock()
        .unwrap()
        .insert(Resource::Bytes(vec![0; length as usize]))
        .unwrap_or(0)
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_buffer_ptr(handle: u32) -> *mut u8 {
    match store().lock().unwrap().resources.get_mut(&handle) {
        Some(Resource::Bytes(bytes)) => bytes.as_mut_ptr(),
        _ => std::ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_buffer_len(handle: u32) -> u32 {
    match store().lock().unwrap().resources.get(&handle) {
        Some(Resource::Bytes(bytes)) => bytes.len() as u32,
        _ => 0,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_free(handle: u32) {
    store().lock().unwrap().resources.remove(&handle);
}

#[unsafe(no_mangle)]
pub extern "C" fn acausal_call(operation: u32, payload: u32) -> u32 {
    let mut state = store().lock().unwrap();
    let input = match state.resources.get(&payload) {
        Some(Resource::Bytes(bytes)) => bytes.clone(),
        _ => Vec::new(),
    };
    let mut output = Writer::default();
    match dispatch(&mut state, operation, &input) {
        Ok(bytes) => {
            output.0.push(1);
            output.0.extend(bytes);
        }
        Err(error) => {
            output.0.push(0);
            output.text(&error.to_string());
        }
    }
    state.insert(Resource::Bytes(output.0)).unwrap_or(0)
}

fn dispatch(state: &mut Store, operation: u32, input: &[u8]) -> Result<Vec<u8>, Error> {
    let mut reader = Reader::new(input);
    let mut output = Writer::default();
    match operation {
        1 => {
            let seed = reader.u32()?;
            reader.finish()?;
            output.u32(state.insert(Resource::Rng(Box::new(Rng::seeded(seed))))?);
        }
        2 => {
            let seed = match reader.byte()? {
                0 => Seed::Scalar(reader.u32()?),
                1 => {
                    let count = reader.count()?;
                    Seed::Words((0..count).map(|_| reader.u32()).collect::<Result<_, _>>()?)
                }
                _ => return Err(invalid("invalid seed kind")),
            };
            let uses = reader.u64()?;
            reader.finish()?;
            output.u32(state.insert(Resource::Rng(Box::new(Rng::from_legacy(seed, uses)?)))?);
        }
        3 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Rng(rng)) => output.0 = rng.snapshot().encode(),
                _ => return Err(invalid("handle is not an RNG")),
            }
        }
        4 => {
            output.u32(state.insert(Resource::Rng(Box::new(Rng::from_state(
                RngState::decode(input)?,
            )?)))?);
        }
        5 => {
            let rng = reader.u32()?;
            let min = reader.f64()?;
            let max = reader.f64()?;
            reader.finish()?;
            output.f64(state.with_rng(rng, |_, rng| rng.float(min, max))?);
        }
        6 => {
            let rng = reader.u32()?;
            let min = reader.i64()?;
            let max = reader.i64()?;
            reader.finish()?;
            output.i64(state.with_rng(rng, |_, rng| rng.int(min, max))?);
        }
        7 => {
            let rng = reader.u32()?;
            let probability = reader.f64()?;
            reader.finish()?;
            output
                .0
                .push(state.with_rng(rng, |_, rng| rng.bool(probability))? as u8);
        }
        8 => {
            let rng = reader.u32()?;
            let tag = reader.byte()?;
            let count = reader.count()?;
            let args: Vec<f64> = (0..count).map(|_| reader.f64()).collect::<Result<_, _>>()?;
            reader.finish()?;
            let distribution = distribution(tag, &args)?;
            output.f64(state.with_rng(rng, |_, rng| rng.sample(&distribution))?);
        }
        9 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Rng(rng)) => output.u64(rng.uses()),
                _ => return Err(invalid("handle is not an RNG")),
            }
        }
        10 => {
            let id = reader.u32()?;
            reader.finish()?;
            let resource = match state.resources.get(&id) {
                Some(Resource::Rng(rng)) => Resource::Rng(rng.clone()),
                Some(Resource::Weighted(weights)) => Resource::Weighted(weights.clone()),
                Some(Resource::Markov(model)) => Resource::Markov(model.clone()),
                Some(Resource::Model { compiled, limits }) => Resource::Model {
                    compiled: compiled.clone(),
                    limits: *limits,
                },
                _ => return Err(invalid("handle cannot be cloned")),
            };
            output.u32(state.insert(resource)?);
        }
        20 => {
            let count = reader.u32()? as usize;
            if count > input.len() / 12 {
                return Err(invalid("invalid entry count"));
            }
            let mut entries = Vec::with_capacity(count);
            for _ in 0..count {
                entries.push((reader.text()?, reader.f64()?));
            }
            reader.finish()?;
            output.u32(state.insert(Resource::Weighted(Weighted::new(entries)?))?);
        }
        22 => {
            let id = reader.u32()?;
            let rng = reader.u32()?;
            let excluded = reader.strings()?;
            reader.finish()?;
            let value = state.with_rng(rng, |state, rng| match state.resources.get(&id) {
                Some(Resource::Weighted(weights)) => {
                    weights.draw_excluding(rng, &excluded).cloned()
                }
                _ => Err(invalid("handle is not a weighted table")),
            })?;
            output.text(&value);
        }
        21 | 27 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Weighted(weights)) => output.pairs(&if operation == 21 {
                    weights.probabilities()
                } else {
                    weights.entries().to_vec()
                }),
                _ => return Err(invalid("handle is not a weighted table")),
            }
        }
        23 => {
            let id = reader.u32()?;
            let rng = reader.u32()?;
            let count = reader.u32()? as usize;
            if count > MAX_BUFFER / 8 {
                return Err(invalid("draw count exceeds binding capacity"));
            }
            let replacement = match reader.byte()? {
                0 => Replacement::With,
                1 => Replacement::Without,
                _ => return Err(invalid("invalid replacement mode")),
            };
            let excluded = reader.strings()?;
            reader.finish()?;
            let values = state.with_rng(rng, |state, rng| match state.resources.get(&id) {
                Some(Resource::Weighted(weights)) => {
                    weights.draw_many(rng, count, replacement, &excluded)
                }
                _ => Err(invalid("handle is not a weighted table")),
            })?;
            output.strings(&values);
        }
        24..=26 => {
            let id = reader.u32()?;
            let key = reader.text()?;
            let value = if operation == 26 { 0.0 } else { reader.f64()? };
            reader.finish()?;
            match state.resources.get_mut(&id) {
                Some(Resource::Weighted(weights)) => match operation {
                    24 => weights.set(key, value)?,
                    25 => weights.adjust(key, value)?,
                    _ => weights.remove(key)?,
                },
                _ => return Err(invalid("handle is not a weighted table")),
            }
        }
        40 => {
            let order = reader.u32()? as usize;
            reader.finish()?;
            output.u32(state.insert(Resource::Markov(Markov::new(order)?))?);
        }
        41 => {
            let id = reader.u32()?;
            let count = reader.count()?;
            let sequences: Vec<Vec<String>> = (0..count)
                .map(|_| reader.strings())
                .collect::<Result<_, _>>()?;
            reader.finish()?;
            match state.resources.get_mut(&id) {
                Some(Resource::Markov(model)) => model.learn(sequences)?,
                _ => return Err(invalid("handle is not a Markov model")),
            }
        }
        42 => {
            let id = reader.u32()?;
            let context = reader.strings()?;
            let next = if reader.boolean()? {
                Some(reader.text()?)
            } else {
                None
            };
            let weight = reader.f64()?;
            reader.finish()?;
            match state.resources.get_mut(&id) {
                Some(Resource::Markov(model)) => match next {
                    Some(next) => model.add_transition(&context, next, weight)?,
                    None => model.add_end_transition(&context, weight)?,
                },
                _ => return Err(invalid("handle is not a Markov model")),
            }
        }
        43 => {
            let id = reader.u32()?;
            let rng = reader.u32()?;
            let context = reader.strings()?;
            let direction = direction(reader.byte()?)?;
            reader.finish()?;
            let value = state.with_rng(rng, |state, rng| match state.resources.get(&id) {
                Some(Resource::Markov(model)) => model.step(&context, rng, direction),
                _ => Err(invalid("handle is not a Markov model")),
            })?;
            output.0.push(value.is_some() as u8);
            if let Some(value) = value {
                output.text(&value);
            }
        }
        44 => {
            let id = reader.u32()?;
            let rng = reader.u32()?;
            let min = reader.u32()? as usize;
            let max = reader.u32()? as usize;
            let max_attempts = reader.u32()? as usize;
            if max > MAX_BUFFER / 8 || max_attempts > 1_000_000 {
                return Err(invalid("generation exceeds binding capacity"));
            }
            let order = reader.u32()? as usize;
            let direction = direction(reader.byte()?)?;
            let strict = reader.boolean()?;
            let start = reader.strings()?;
            let must_contain = reader.strings()?;
            let must_not_contain = reader.strings()?;
            reader.finish()?;
            let options = GenerateOptions {
                min,
                max,
                max_attempts,
                order: if order == 0 { None } else { Some(order) },
                direction,
                strict,
                start: if start.is_empty() { None } else { Some(start) },
                must_contain,
                must_not_contain,
            };
            let values = state.with_rng(rng, |state, rng| match state.resources.get(&id) {
                Some(Resource::Markov(model)) => model.generate(rng, options),
                _ => Err(invalid("handle is not a Markov model")),
            })?;
            output.strings(&values);
        }
        45 => {
            let id = reader.u32()?;
            let sequence = reader.strings()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Markov(model)) => {
                    let score = model.score(&sequence);
                    output.f64(score.log_prob);
                    output.f64(score.perplexity);
                    output.0.push(score.is_valid as u8);
                    output.f64(score.normalized);
                }
                _ => return Err(invalid("handle is not a Markov model")),
            }
        }
        46 => {
            let strategy = match reader.byte()? {
                0 => BlendStrategy::Arithmetic,
                1 => BlendStrategy::Geometric,
                2 => BlendStrategy::Harmonic,
                3 => BlendStrategy::Max,
                4 => BlendStrategy::Min,
                _ => return Err(invalid("invalid blend strategy")),
            };
            let count = reader.count()?;
            let mut models = Vec::with_capacity(count);
            for _ in 0..count {
                let id = reader.u32()?;
                let weight = reader.f64()?;
                match state.resources.get(&id) {
                    Some(Resource::Markov(model)) => models.push((model, weight)),
                    _ => return Err(invalid("handle is not a Markov model")),
                }
            }
            reader.finish()?;
            let model = Markov::blend(models, strategy)?;
            output.u32(state.insert(Resource::Markov(model))?);
        }
        47 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Markov(model)) => {
                    let stats = model.stats();
                    output.u64(stats.gram_count as u64);
                    output.u64(stats.sequence_count as u64);
                    output.u32(stats.order_range.0 as u32);
                    output.u32(stats.order_range.1 as u32);
                    output.f64(stats.avg_degree_in);
                    output.f64(stats.avg_degree_out);
                }
                _ => return Err(invalid("handle is not a Markov model")),
            }
        }
        50 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Markov(model)) => write_markov(&mut output, &model.to_data()),
                _ => return Err(invalid("handle is not a Markov model")),
            }
        }
        51 => {
            let data = read_markov(&mut reader)?;
            reader.finish()?;
            output.u32(state.insert(Resource::Markov(Markov::from_data(data)?))?);
        }
        60 => {
            let limits = reader.limits()?;
            let spec = read_model(&mut reader)?;
            reader.finish()?;
            let compiled = Model::compile_with_limits(spec, limits)?;
            output.u32(state.insert(Resource::Model {
                compiled: Box::new(compiled),
                limits,
            })?);
        }
        61 => {
            let id = reader.u32()?;
            let target = reader.text()?;
            let evidence = reader.assignment()?;
            let limits = reader.limits()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Model { compiled, .. }) => output.pairs(
                    &compiled
                        .posterior(&target, &evidence, limits)?
                        .probabilities
                        .into_iter()
                        .collect::<Vec<_>>(),
                ),
                _ => return Err(invalid("handle is not a conditioning model")),
            }
        }
        62 => {
            let id = reader.u32()?;
            let rng = reader.u32()?;
            let evidence = reader.assignment()?;
            let limits = reader.limits()?;
            reader.finish()?;
            let assignment = state.with_rng(rng, |state, rng| match state.resources.get(&id) {
                Some(Resource::Model { compiled, .. }) => compiled.sample(rng, &evidence, limits),
                _ => Err(invalid("handle is not a conditioning model")),
            })?;
            output.assignment(&assignment);
        }
        63 => {
            let id = reader.u32()?;
            reader.finish()?;
            match state.resources.get(&id) {
                Some(Resource::Model { compiled, limits }) => {
                    output.limits(*limits);
                    write_model(&mut output, &compiled.to_spec());
                }
                _ => return Err(invalid("handle is not a conditioning model")),
            }
        }
        _ => return Err(invalid("unknown operation")),
    }
    Ok(output.0)
}

fn direction(value: u8) -> Result<Direction, Error> {
    match value {
        0 => Ok(Direction::Forward),
        1 => Ok(Direction::Backward),
        _ => Err(invalid("invalid direction")),
    }
}

fn distribution(tag: u8, args: &[f64]) -> Result<Distribution, Error> {
    Ok(match (tag, args) {
        (0, [min, max]) => Distribution::Uniform {
            min: *min,
            max: *max,
        },
        (1, [mean, stddev]) => Distribution::Normal {
            mean: *mean,
            stddev: *stddev,
        },
        (2, [mean, stddev, min, max]) => Distribution::ClampedNormal {
            mean: *mean,
            stddev: *stddev,
            min: *min,
            max: *max,
        },
        (3, [mean, stddev]) => Distribution::LogNormal {
            mean: *mean,
            stddev: *stddev,
        },
        (4, [rate]) => Distribution::Exponential { rate: *rate },
        (5, [rate]) => Distribution::Poisson { rate: *rate },
        (6, [trials, probability]) => Distribution::Binomial {
            trials: *trials,
            probability: *probability,
        },
        (7, [probability]) => Distribution::Geometric {
            probability: *probability,
        },
        (8, [alpha, beta]) => Distribution::Beta {
            alpha: *alpha,
            beta: *beta,
        },
        (9, [shape, scale]) => Distribution::Gamma {
            shape: *shape,
            scale: *scale,
        },
        (10, [shape, scale, location]) => Distribution::Weibull {
            shape: *shape,
            scale: *scale,
            location: *location,
        },
        (11, [location, scale]) => Distribution::Cauchy {
            location: *location,
            scale: *scale,
        },
        (12, [location, scale]) => Distribution::Logistic {
            location: *location,
            scale: *scale,
        },
        (13, [probability]) => Distribution::Bernoulli {
            probability: *probability,
        },
        _ => return Err(invalid("invalid distribution parameters")),
    })
}

fn read_model(reader: &mut Reader<'_>) -> Result<ModelSpec, Error> {
    let count = reader.count()?;
    let variables = (0..count)
        .map(|_| {
            Ok(Variable {
                id: reader.text()?,
                domain: reader.strings()?,
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let count = reader.count()?;
    let mut tables = Vec::with_capacity(count);
    for _ in 0..count {
        let target = reader.text()?;
        let parents = reader.strings()?;
        let count = reader.count()?;
        let rows = (0..count)
            .map(|_| {
                Ok(Row {
                    parent_values: reader.assignment()?,
                    weights: reader.pairs()?,
                })
            })
            .collect::<Result<Vec<_>, Error>>()?;
        tables.push(Table {
            target,
            parents,
            rows,
        });
    }
    let count = reader.count()?;
    let mut constraints = Vec::with_capacity(count);
    for _ in 0..count {
        constraints.push(match reader.byte()? {
            0 => Constraint::Forbidden(reader.assignment()?),
            1 => {
                let count = reader.count()?;
                Constraint::Allowed(
                    (0..count)
                        .map(|_| reader.assignment())
                        .collect::<Result<_, _>>()?,
                )
            }
            _ => return Err(invalid("invalid constraint kind")),
        });
    }
    let id = reader.text()?;
    let revision = reader.text()?;
    Ok(ModelSpec {
        variables,
        tables,
        constraints,
        id: (!id.is_empty()).then_some(id),
        revision: (!revision.is_empty()).then_some(revision),
    })
}

fn write_model(output: &mut Writer, spec: &ModelSpec) {
    output.u32(spec.variables.len() as u32);
    for variable in &spec.variables {
        output.text(&variable.id);
        output.strings(&variable.domain);
    }
    output.u32(spec.tables.len() as u32);
    for table in &spec.tables {
        output.text(&table.target);
        output.strings(&table.parents);
        output.u32(table.rows.len() as u32);
        for row in &table.rows {
            output.assignment(&row.parent_values);
            output.pairs(&row.weights);
        }
    }
    output.u32(spec.constraints.len() as u32);
    for constraint in &spec.constraints {
        match constraint {
            Constraint::Forbidden(pattern) => {
                output.0.push(0);
                output.assignment(pattern);
            }
            Constraint::Allowed(patterns) => {
                output.0.push(1);
                output.u32(patterns.len() as u32);
                for pattern in patterns {
                    output.assignment(pattern);
                }
            }
        }
    }
    output.text(spec.id.as_deref().unwrap_or(""));
    output.text(spec.revision.as_deref().unwrap_or(""));
}

fn write_markov(output: &mut Writer, data: &MarkovData<String>) {
    output.u32(1);
    output.u32(data.max_order as u32);
    output.u64(data.sequence_count as u64);
    for rows in [&data.forward, &data.backward] {
        output.u32(rows.len() as u32);
        for row in rows {
            output.strings(&row.context);
            output.text(&row.next);
            output.f64(row.weight);
        }
    }
    for rows in [&data.end, &data.start] {
        output.u32(rows.len() as u32);
        for row in rows {
            output.strings(&row.context);
            output.f64(row.weight);
        }
    }
}

fn read_markov(reader: &mut Reader<'_>) -> Result<MarkovData<String>, Error> {
    if reader.u32()? != 1 {
        return Err(invalid("unsupported Markov snapshot version"));
    }
    let max_order = reader.u32()? as usize;
    let sequence_count = u64::from_le_bytes(reader.take(8)?.try_into().unwrap());
    let sequence_count = usize::try_from(sequence_count)
        .map_err(|_| invalid("sequence count exceeds platform capacity"))?;
    let mut read_transitions = || -> Result<Vec<TransitionData<String>>, Error> {
        let count = reader.count()?;
        (0..count)
            .map(|_| {
                Ok(TransitionData {
                    context: reader.strings()?,
                    next: reader.text()?,
                    weight: reader.f64()?,
                })
            })
            .collect()
    };
    let forward = read_transitions()?;
    let backward = read_transitions()?;
    let mut read_boundaries = || -> Result<Vec<BoundaryData<String>>, Error> {
        let count = reader.count()?;
        (0..count)
            .map(|_| {
                Ok(BoundaryData {
                    context: reader.strings()?,
                    weight: reader.f64()?,
                })
            })
            .collect()
    };
    let end = read_boundaries()?;
    let start = read_boundaries()?;
    Ok(MarkovData {
        max_order,
        sequence_count,
        forward,
        backward,
        end,
        start,
    })
}
