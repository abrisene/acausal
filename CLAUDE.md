# acausal

TypeScript library for weighted random distributions, Markov chains, and seeded PRNG. Used for procedural generation, name generators, game systems, and stochastic modeling.

## Design Philosophy

These are non-negotiable architectural constraints:

- **Static clone-on-write / Mutable instances**: Static methods clone the DTO, mutate the clone, and return the new DTO. Instance methods (e.g. `addSequence`, `add`, `remove`) delegate to statics, reassign internal state, and return `this` for chaining — the instance is mutated in place. Use `.clone()` before mutating if you need to preserve the original. `Immutable*` variants (`ImmutableMarkovChain`, `ImmutableDistribution`, `ImmutableMultiDimMarkovChain`) return new instances from mutating methods for functional patterns and safe sharing. `MarkovChainBatch` remains valuable for avoiding N static-level clones in bulk operations.
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
    sampler.ts                      # RandomSampler (statistical distributions)
  structures/
    distribution.ts                 # Distribution<T> + ImmutableDistribution<T>
    markov/
      markov-chain.ts               # MarkovChain<T> core class (mutable instances)
      immutable-markov-chain.ts     # ImmutableMarkovChain<T> (returns new instances)
      batch.ts                      # MarkovChainBatch<T> (bulk add sequences/edges)
      blend.ts                      # blendMultipleDistributions() (5 strategies)
      multi-dim-chain.ts            # MultiDimMarkovChain<T> (mutable instances)
      immutable-multi-dim-chain.ts  # ImmutableMultiDimMarkovChain<T>
      utils.ts                      # Module-level gram dictionary mutation functions
      types.ts                      # All Markov type definitions
      defaults.ts                   # Default options and empty DTOs
      index.ts                      # Controlled barrel export
  __tests__/
    distribution.spec.ts
    markov.spec.ts
    random.spec.ts
    sampler.spec.ts
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
pnpm run build          # tsup → dist/ (ESM + CJS + .d.ts)
pnpm run typecheck      # tsc --noEmit
pnpm test               # vitest
pnpm run test:coverage  # vitest --coverage (thresholds: 85% branch, 95% lines/funcs/stmts)
pnpm run lint           # gts lint
pnpm run docs           # typedoc (deployed via CI to GitHub Pages)
```

**Build** uses tsup (see `tsup.config.ts`). Output is ESM + CJS dual format targeting ES2022. The `onSuccess` hook runs `tsc --noEmit` after build.

**Test** uses Vitest with native ESM support. No special Node flags needed.

**CI** runs on GitHub Actions: lint, typecheck, test (Node 18/20/22 matrix), and build. Docs deploy to GitHub Pages on version tags. Releases publish to npm with provenance.

**TypeScript** extends `gts/tsconfig-google.json` with strict mode, `noUncheckedIndexedAccess`, and bundler module resolution.

## Important Implementation Details

- **MT19937 engine** (`mersenne-twister.ts`): Full reference implementation with `seed()`, `seedWithArray()`, `next()`, `discard()`. Helper functions: `integer()` (rejection sampling to avoid modulo bias), `real()` (53-bit resolution using two 32-bit draws), `pick()`, `bool()`, `createEntropy()`.
- **Random class** tracks a `uses` counter that increments with each draw. Serializing `{ seed, uses }` and replaying `discard(uses)` reproduces exact engine state.
- **Distribution** maintains dual representation: raw `source` weights (human-readable) and `normal` weights (probabilities summing to 1.0). Normalization uses `scalr`.
- **MarkovChain generation** uses dynamic order adjustment when `strict: false` — if no gram exists at the target order, it decrements until a match is found.
- **MarkovChainBatch** accumulates sequences/edges, then `commit()` applies them all at once to produce a new `MarkovChain<T>`.
- **RandomSampler** (`sampler.ts`): Statistical distribution sampling built on `Random`. Provides `normal()` (Box-Muller), `truncatedNormal()` (clamped), `exponential()`, `poisson()`, `binomial()`, `geometric()`, `beta()`, `gamma()` (Marsaglia-Tsang), `weibull()`, `cauchy()`, `logistic()`, `logNormal()`. Also provides `sampleDistribution(params)` for data-driven sampling from typed distribution parameter objects (`DistributionParams`). All methods are deterministic given the same seed.

## Common Gotchas

- Don't share `Random` engine instances between cloned chains — use `engine.clone()` to create independent copies.
- `MCAnalyzeOptions` extends `Omit<MCGeneratorOptions, 'constraints'>` — constraints are intentionally excluded from analysis.
- The `GramDictionary` and `MCDelimitersShort` types are internal but exported for advanced use cases. They are not part of the stable public API.
- `scalr` is the only runtime dependency. Do not add new dependencies without strong justification.
