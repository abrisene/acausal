# Rust alpha verification — 2026-09-04

Source: `feature/rust` in `/Users/dr/Dev/platform/acausal-worktrees/rust-rewrite`. The preserved JavaScript baseline is commit `e4e212a`; the original checkout is unchanged.

## Implemented path

One dependency-free Rust core supplies Rng, Weighted, Markov, and Model. JavaScript uses wasm and Python uses the native ctypes library.

The example draws a reward, generates from the existing acausal corpus, answers a reverse conditioning query, and samples with non-root evidence.

## Fresh checks

- Native Rust tests, generated primitive replay checks, preflight checks, and independent reviewer regression probes passed.
- Strict Clippy, Rust formatting, and JavaScript declaration typechecking passed.
- Native and wasm release builds passed.
- JavaScript/wasm and Python/native smoke programs passed, including all declared numeric distributions, array seeds, legacy state import, weighted masks, distinct shortfall, snapshots, Markov statistics, Unicode, and conditional sampling.
- Both smoke programs returned the same selected sequences, conditional samples, posterior values, and stream use count.
- The packaged Rust crate passed its tests and example after extraction outside the worktree.
- The npm tarball passed the smoke program after installation into an independent project.
- The macOS arm64 wheel passed the smoke program after installation into a fresh Python 3.11 environment.
- Independent Luna review confirmed the corrected overflow, probability support, retry, backward traversal, and early capacity-check behavior.

## Reproduction

Run the commands in the root README. The installed-consumer checks use the same `scripts/smoke-bindings.mjs` and `scripts/smoke-bindings.py` against the packed library.

## Compatibility scope

Selected legacy primitive fixtures match values and draw positions. Legacy inclusive-float cases are excluded because that API was removed. The negative-weight fixture prefix is retained, followed by an assertion that negative input is now rejected.

Historical Markov output sequences and bit-identical transcendental results across every platform are not claimed. The current wheel was exercised on macOS arm64. Browser UI behavior and other native platforms were not exercised in this run.

## Artifacts and release state

Local artifacts are in `artifacts/`: the Rust crate, npm tarball, and `py3-none-macosx_11_0_arm64` wheel.

No package release was published. Existing applications retain their current acausal versions. The pin-derive composition adapter remains separate work.
