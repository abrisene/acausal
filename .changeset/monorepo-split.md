---
"@acausal/scalr": minor
"@acausal/random": major
"@acausal/sampler": major
"@acausal/distributions": major
"@acausal/markov": major
"acausal": major
---

Split acausal into scoped packages under @acausal/* monorepo.

New packages:
- `@acausal/scalr` — scaling and normalization utilities (previously standalone `scalr` on npm)
- `@acausal/random` — seeded MT19937 PRNG
- `@acausal/sampler` — statistical distribution sampling
- `@acausal/distributions` — weighted discrete distributions
- `@acausal/markov` — Markov chains with blending, multi-dim, immutable variants

The `acausal` package becomes a meta-package re-exporting all of the above.
Existing `import { X } from 'acausal'` continues to work.

Breaking changes (from v2):
- Removed `ScaledMarkovChain` (use blending instead)
- `MarkovChain.freeze()` replaced with `ImmutableMarkovChain.from(chain)` (sync, static factory)
- Constructor signatures changed (see CHANGELOG.md)
- Minimum Node.js 18
