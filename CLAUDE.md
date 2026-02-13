# acausal

TypeScript library for weighted random distributions, Markov chains, and seeded PRNG. Used for procedural generation, name generators, game systems, and stochastic modeling.

## Design Philosophy

These are non-negotiable architectural constraints:

- **Clone-on-write**: Methods never mutate state. Static methods clone the DTO, mutate the clone, and return the new DTO. Instance methods (e.g. `addSequence`, `add`, `remove`) delegate to statics and return a **new instance** — the original is never modified. This preserves the integrity of existing models and enables safe concurrency. The tradeoff is that each mutation clones the entire model — for bulk operations, use `MarkovChainBatch` which clones once upfront, mutates the clone in place across N operations, then produces a new chain on `commit()`.
- **Dual API**: Every feature has both an instance method and a static method that operates on raw DTOs. Instance methods delegate to statics. Example: `chain.generate(opts)` wraps `MarkovChain.generate({ model: chain.dto, ...opts })`.
- **Portable DTOs**: All classes serialize to/from plain JSON objects (`serialize()` / constructor from DTO). Models can be stored, transferred over the network, and rebuilt without the original training data.
- **Minimal dependencies**: Only `scalr` (weight normalization). The PRNG is an internal MT19937 implementation.

## Architecture

```
src/
  index.ts                          # Barrel: constants, services, structures, types
  types.ts                          # WeightedDistribution (shared base type)
  constants/index.ts                # MT_PREWARM, delimiters, max order default
  services/
    mersenne-twister.ts             # Internal MT19937 PRNG engine
    random.ts                       # Random class (wraps MT engine)
  structures/
    distribution.ts                 # Distribution<T> class (weighted random picks)
    markov/
      markov-chain.ts               # MarkovChain<T> core class (~800 lines)
      batch.ts                      # MarkovChainBatch<T> (bulk add sequences/edges)
      blend.ts                      # blendMultipleDistributions() (5 strategies)
      multi-dim-chain.ts            # MultiDimMarkovChain<T> (structured state spaces)
      utils.ts                      # Module-level gram dictionary mutation functions
      types.ts                      # All Markov type definitions
      defaults.ts                   # Default options and empty DTOs
      index.ts                      # Controlled barrel export
  __tests__/
    distribution.spec.ts
    markov.spec.ts
    random.spec.ts
```

## Key Patterns

### Gram Structure
An n-gram state with bidirectional transitions. Grams have an `id` (states joined by delimiter `⏐`), `order`, `frequency`, and two `DistributionSourceDTO` objects (`last`, `next`) for backward/forward transitions.

### Delimiters
- Start: `○` (U+25CB)
- Gram separator: `⏐` (U+23F0)
- End: `◍` (U+25CD)

Defined in `constants/index.ts`. These mark sequence boundaries in gram IDs.

### MultiDimMarkovChain Registry
Uses a named-function registry (`registerStateKey` / `getStateKey`) so that state key functions can be serialized by name and looked up at deserialization time. The DTO stores `stateKeyName: string`, not the function itself.

### Blend Strategies
`blend.ts` supports 5 strategies: `arithmetic`, `geometric`, `harmonic`, `max`, `min`. Geometric/harmonic fall back to arithmetic when values are zero (mathematically correct — can't compute geometric mean of zero).

## Build & Test

```bash
npm run build          # tsup → dist/ (ESM + CJS + .d.ts)
npm run typecheck      # tsc --noEmit
npm test               # jest (ESM mode, requires --experimental-vm-modules)
npm run test:coverage  # jest --coverage (thresholds: 85% branch, 95% lines/funcs/stmts)
npm run lint           # gts lint
npm run docs           # typedoc
```

**Test command** requires the Node flag: `node --experimental-vm-modules node_modules/jest/bin/jest.js`

**Build** uses tsup (see `tsup.config.ts`). Output is ESM + CJS dual format targeting ES2022. The `onSuccess` hook runs `tsc --noEmit` after build.

**TypeScript** extends `gts/tsconfig-google.json` with strict mode, `noUncheckedIndexedAccess`, and bundler module resolution.

## Important Implementation Details

- **MT19937 engine** (`mersenne-twister.ts`): Full reference implementation with `seed()`, `seedWithArray()`, `next()`, `discard()`. Helper functions: `integer()` (rejection sampling to avoid modulo bias), `real()` (53-bit resolution using two 32-bit draws), `pick()`, `bool()`, `createEntropy()`.
- **Random class** tracks a `uses` counter that increments with each draw. Serializing `{ seed, uses }` and replaying `discard(uses)` reproduces exact engine state.
- **Distribution** maintains dual representation: raw `source` weights (human-readable) and `normal` weights (probabilities summing to 1.0). Normalization uses `scalr`.
- **MarkovChain generation** uses dynamic order adjustment when `strict: false` — if no gram exists at the target order, it decrements until a match is found.
- **MarkovChainBatch** accumulates sequences/edges, then `commit()` applies them all at once to produce a new `MarkovChain<T>`.

## Common Gotchas

- Don't share `Random` engine instances between cloned chains — use `engine.clone()` to create independent copies.
- `MCAnalyzeOptions` extends `Omit<MCGeneratorOptions, 'constraints'>` — constraints are intentionally excluded from analysis.
- The `GramDictionary` and `MCDelimitersShort` types are internal but exported for advanced use cases. They are not part of the stable public API.
- `scalr` is the only runtime dependency. Do not add new dependencies without strong justification.
