# Rust implementation plan

The user approved the API audit and removal of scalr from the Rust rewrite.

## Source preservation

The rewrite starts from `f91ea9c` and is delivered on `feature/rust`. The main worktree's existing diff was copied with git apply and committed separately as `e4e212a` before the Rust changes.

Conditioning source from clean `0d74519` is preserved in `reference/conditioning`. Existing checkouts remain unchanged.

## Execution

1. Implement caller-owned RNG, all current statistical distributions, and weighted selection through one model path.
2. Implement sequence learning, weighted transitions, generation, scoring, and blending through one Markov model.
3. Implement finite conditioning with one evidence path, bounded exact inference, and sampling under arbitrary evidence.
4. Exercise the models together on reward, name, and conditioning examples. Add a common Rust-owned binding boundary.
5. Complete native and wasm builds, bindings, migration documentation, independent review, and targeted regression checks.

## Behavior checks

Preserve MT19937 primitive sequences and draw position where intended. Snapshots restore full state directly; legacy seed/use state imports once.

Check weighted masks, distinct draws, explicit shortfall, Unicode states, weighted graph edges, generation exhaustion, invalid sequence scoring, pinned-target posterior, contradictory evidence, and work limits.

Exact inference is checked against exhaustive small examples. Sampling under evidence is checked for support and replay. Failed attempts never claim valid completion.

## Risks

Numeric transcendental output may differ from historical V8 output; record the compatibility scope rather than silently promising identical floats.

Finite inference can grow rapidly; work limits return incomplete results. Binding operations share Rust implementations rather than adding host-language algorithms.

Old source API variants stay available as reference during migration. The new Rust API removes those variants and publishes an explicit migration map.
