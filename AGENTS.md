# Acausal Rust rewrite

The Rust API follows `docs/specs/rust-api.md`. Each model has one operation path, and callers supply random state explicitly.

Rust code lives in `rust/`. Existing TypeScript packages and `reference/conditioning` are porting references. Their historical API conventions describe the old implementation.

Use ordinary owned mutation and explicit cloning. Bulk operations use the same primitives as individual operations. Store raw weights once and derive probabilities.

Keep the Rust core dependency-free. Public models are Rng, Weighted, Markov, and Model. Language bindings delegate to this core.

Every meaningful behavior change receives a focused regression case. Completion requires exercising real generation and conditioning examples, then running cargo test, cargo clippy, and the binding smoke checks.

Performance numbers guide measurement and investigation. Prioritize a working consumer path and established simple representations.

Luna xhigh agents may own independent modules. Preserve other agents' edits and coordinate interface changes with the owner.
