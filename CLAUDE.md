# acausal

NX monorepo for procedural generation — seeded RNG, weighted distributions, Markov chains, statistical sampling.

## Packages

```
packages/
  random/           # @acausal/random — Seeded MT19937 PRNG, weighted selection. Zero deps.
  sampler/          # @acausal/sampler — 13 statistical distributions. Depends on random.
  distributions/    # @acausal/distributions — Weighted discrete distributions. Depends on random + scalr.
  markov/           # @acausal/markov — Markov chains with blending, multi-dim, immutable. Depends on random + distributions + scalr.
  acausal/          # acausal — Meta-package re-exporting all of the above.
```

Dependency graph: `random` (leaf) → `sampler` + `distributions` → `markov`. The `acausal` meta-package re-exports everything for backwards compatibility with v2.

## Design Philosophy

Non-negotiable architectural constraints:

- **Static clone-on-write / Mutable instances**: Static methods clone the DTO, mutate the clone, return new DTO. Instance methods delegate to statics, mutate in place, return `this`. `Immutable*` variants return new instances from mutating methods.
- **Dual API**: Every feature has both instance and static methods. Instance methods delegate to statics.
- **Portable DTOs**: All classes serialize to/from plain JSON objects (`serialize()` / constructor from DTO).
- **Minimal dependencies**: Only `scalr` (weight normalization) in distributions/markov. Random and sampler have zero runtime deps.

## Key Patterns

### Gram Structure
N-gram state with bidirectional transitions. Grams have `id` (states joined by `⏐`), `order`, `frequency`, and two `DistributionSourceDTO` objects (`last`, `next`).

### Delimiters
- Start: `○` (U+25CB), Gram separator: `⏐` (U+23F0), End: `◍` (U+25CD)

### Immutable Variants
`ImmutableMarkovChain.from(chain)` creates an immutable copy from a mutable chain (synchronous static factory). `ImmutableMarkovChain.toMutable()` goes the other direction.

### MultiDimMarkovChain Registry
Named-function registry (`registerStateKey` / `getStateKey`) for serializable state key functions.

### Blend Strategies
5 strategies: `arithmetic`, `geometric`, `harmonic`, `max`, `min`. Geometric/harmonic fall back to arithmetic for zero values.

## Build & Test

```bash
pnpm build              # NX builds all packages in dependency order
pnpm test               # NX runs all tests
pnpm typecheck          # NX typechecks all packages
pnpm publish:all        # Build + publish all packages to npm
```

Build: NX + tsup (ESM + CJS dual format, ES2022 target). Shared config in `tsup.base.ts` and `tsconfig.base.json`.

Test: vitest per package. 189 tests across 4 packages.

## Important Implementation Details

- **MT19937** (`random/mersenne-twister.ts`): Full implementation with rejection sampling for `integer()`, 53-bit resolution for `real()`.
- **Random** tracks `uses` counter. `{ seed, uses }` reproduces exact state via `discard(uses)`.
- **Distribution** maintains dual weights: `source` (raw) and `normal` (probabilities summing to 1.0).
- **MarkovChain** supports dynamic order adjustment, batch operations, and 5 blend strategies.
- **RandomSampler** provides 13 distributions: normal, clampedNormal, logNormal, exponential, uniform, gamma, beta, poisson, binomial, geometric, weibull, cauchy, logistic.

## Workspace Dependencies

Packages use `workspace:*` protocol. tsup configs externalize workspace deps so consumers don't get duplicate class instances.

## Common Gotchas

- Don't share `Random` instances between cloned chains — use `engine.clone()`.
- `GramDictionary` and `MCDelimitersShort` are exported for advanced use cases.
- `scalr` is the only runtime dependency (in distributions and markov only).
