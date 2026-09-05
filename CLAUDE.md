# acausal

The active Rust rewrite follows `AGENTS.md` and `docs/specs/rust-api.md`. Read `rust/README.md` for the implemented API and verification commands.

Models own reusable data. Callers own random streams. Each capability uses one implementation across Rust, wasm, and Python.

The existing TypeScript packages are migration references. Their static DTO, batch, immutable-class, and scalr conventions describe the previous API.
