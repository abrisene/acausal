# acausal 4

A Rust implementation of seeded generation, weighted choices, Markov models, and finite conditioning.

Models hold reusable data. A caller-owned `Rng` supplies every draw. The Rust core has no third-party dependencies, including scalr.

## Weighted choices

```rust
use acausal::{Rng, Weighted, Replacement};

let mut rng = Rng::seeded(42);
let rewards = Weighted::new([
    ("common", 60.0), ("uncommon", 25.0),
    ("rare", 12.0), ("legendary", 3.0),
])?;
let reward = rewards.draw(&mut rng)?;
let distinct = rewards.draw_many(&mut rng, 3, Replacement::Without, &["legendary"])?;
# Ok::<(), acausal::Error>(())
```

Weights stay raw. `probabilities()` derives their normalized values. Exclusions affect the current draw and preserve the stored table.

Empty support and impossible distinct counts return errors before consuming random state. Negative or nonfinite weights are rejected.

## Reusable sequence models

```rust
use acausal::{Rng, Markov, GenerateOptions};

let mut names = Markov::new(2)?;
names.learn([vec!["a", "l", "i", "c", "e"], vec!["a", "l", "i", "n", "a"]])?;
let mut rng = Rng::seeded(42);
let name = names.generate(&mut rng, GenerateOptions {
    min: 4, max: 8, max_attempts: 20, ..Default::default()
})?;
# Ok::<(), acausal::Error>(())
```

`learn` accepts a collection through one insertion path. `add_transition` handles authored weighted graphs. Explicit cloning replaces batch and immutable-class variants.

Typed contexts separate values from start/end boundaries. `score` reports unsupported transitions as invalid. Generation returns an exhaustion error rather than an invalid final attempt.

`to_data` and `from_data` transfer model data independently of random state. `stats` and `blend` are ordinary model operations.

## Finite conditioning

`ModelSpec` declares variables, conditional tables, and hard constraints. A table declares its target and parents once; rows contain parent assignments and outcome weights.

`Model::compile` creates an opaque model. `posterior(target, evidence, limits)` and `sample(rng, evidence, limits)` share evidence validation and bounded exact inference.

Evidence can fix root or non-root variables. A fixed target returns a point distribution only after checking global evidence support.

Each `Constraint::Allowed` contains alternative patterns. Separate constraints combine by conjunction. `Constraint::Forbidden` excludes a matching pattern.

The full working example uses the existing acausal corpus and soldier conditioning model:

```sh
cargo run --example decision_loop
```

## Numeric distributions and replay

`rng.sample(&Distribution::Normal { mean: 170.0, stddev: 7.0 })` selects a numeric distribution through the same RNG.

The distribution enum includes uniform, normal, clamped normal, log-normal, exponential, Poisson, binomial, geometric, beta, gamma, Weibull, Cauchy, logistic, and Bernoulli.

Clamped normal retains boundary mass. It is not named or presented as a truncated normal.

Poisson retains the existing normal approximation for rates of 30 or greater. Numeric results must be finite; unrepresentable results return errors.

Binomial trial loops and rejection-based samplers have explicit work bounds. An exhausted bound is an error, not a sampled value.

`snapshot` returns full versioned generator state. `RngState::encode/decode` supplies portable bytes, and `Rng::from_state` resumes directly.

`Rng::from_legacy(Seed, uses)` imports the historical seed/use-count representation once. `clone` forks the current stream without changing its parent.

Selected legacy primitive fixtures match values and draw counts exactly. This does not promise historical Markov outputs or exact transcendental results across all platforms.

## Bindings

TypeScript/JavaScript uses the same core compiled to wasm. Python uses the native shared library through ctypes. Both are dependency-free at runtime.

Build both local artifacts:

```sh
python3 scripts/build-rust-bindings.py
```

The host packages live in `bindings/javascript` and `bindings/python`. Their private transport delegates algorithms to Rust.

Rust models support generic keyed values. The Markov and conditioning binding surfaces currently use string values. JavaScript weighted tables also retain caller values through binding-owned identifiers.

## Verification

```sh
cargo test --offline
cargo clippy --offline --all-targets -- -D warnings
node scripts/smoke-bindings.mjs
PYTHONPATH=bindings/python python3.11 scripts/smoke-bindings.py
```

The smoke programs exercise Rust-backed selection, state restoration, generation, conditioning, Unicode, and resource cleanup.

## Migration

Use `Rng` in place of `Random`/`RandomSampler`. Pass it to models explicitly instead of embedding seed or engine fields in model constructors.

Use `Weighted` in place of `Distribution` and `ImmutableDistribution`. Keep raw weights, inspect probabilities, and clone explicitly when branching data.

Use `Markov` in place of the mutable/immutable/batch/multidimensional class family. Bulk input and weighted transitions are ordinary operations.

Use `Model` for conditioning. Application overlays and provenance are prepared outside the core. Compiled factor internals and the enumeration test oracle are private.

The existing TypeScript packages remain in this worktree as reference and migration inputs. This alpha does not automatically replace deployed consumers or publish packages.
