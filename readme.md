# acausal 4 — Rust rewrite

Seeded generation, weighted choices, Markov models, and finite conditioning through one Rust core.

The public concepts are **Rng**, **Weighted**, **Markov**, and **Model**. Models hold reusable data; callers supply random state explicitly.

The core has no third-party dependencies. Statistical sampling, weighted selection, and conditioning use the same random stream. Bulk model edits use ordinary operations.

This is an isolated v4 alpha implementation. Existing TypeScript packages remain as migration references; deployed consumers and registries are unchanged.

- [Rust API and examples](rust/README.md)
- [JavaScript/TypeScript binding](bindings/javascript/README.md)
- [Python binding](bindings/python/README.md)
- [API audit and migration direction](docs/specs/rust-api.md)
- [Implementation plan](docs/specs/rust-implementation.md)
- [Previous JavaScript overview](docs/legacy-javascript.md)

## Run the real path

```sh
cargo run --offline --example decision_loop
```

The example draws a reward, generates a sequence from the existing corpus, answers a reverse conditioning query, and samples with non-root evidence.

## Build and check

```sh
python3 scripts/build-rust-bindings.py
cargo test --offline
cargo clippy --offline --all-targets -- -D warnings
node scripts/smoke-bindings.mjs
PYTHONPATH=bindings/python python3.11 scripts/smoke-bindings.py
```

The build requires the installed Rust `wasm32-unknown-unknown` target. Python requires 3.11 or later for the binding.

Performance numbers are investigation targets. Correctness, reproducible state, explicit failures, and usable consumer paths determine the implementation work.
