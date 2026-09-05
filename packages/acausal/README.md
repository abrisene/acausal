# acausal

Procedural generation toolkit — seeded RNG, weighted distributions, Markov chains, statistical sampling.

## Install

```bash
npm install acausal
```

Or install only what you need:

```bash
npm install @acausal/random        # seeded PRNG (zero deps)
npm install @acausal/sampler       # statistical distributions
npm install @acausal/distributions # weighted random selection
npm install @acausal/markov        # Markov chain generation
```

## Usage

```typescript
import { Random, RandomSampler, Distribution, MarkovChain } from 'acausal';

// Seeded RNG
const rng = new Random({ seed: 42 });
rng.int(1, 6);

// Statistical sampling
const sampler = new RandomSampler({ seed: 42 });
sampler.normal(170, 7);

// Weighted distributions
const loot = Distribution.new({ gold: 60, silver: 30, diamond: 10 });
Distribution.pickOne(loot);

// Markov chains
const chain = new MarkovChain({ seed: 42 });
chain.addSequences([['the', 'cat', 'sat'], ['the', 'dog', 'ran']]);
chain.generate();
```

## Deterministic replay across the stack

Seeded generators can branch from their current replay point with `clone()`, and the mutable/immutable bridge APIs preserve that same deterministic state across package boundaries.

```typescript
const rng = new Random({ seed: 42 });
rng.int(1, 6);

const restored = new Random(rng.serialize());
restored.int(1, 100) === rng.int(1, 100); // true
```

That same replay model carries through `RandomSampler`, `Distribution`, `ImmutableDistribution`, `MarkovChain`, `ImmutableMarkovChain`, and the meta-package re-exports.

## Packages

| Package | Description |
|---------|-------------|
| [@acausal/random](https://github.com/abrisene/acausal/tree/main/packages/random) | Seeded MT19937 PRNG with weighted selection |
| [@acausal/sampler](https://github.com/abrisene/acausal/tree/main/packages/sampler) | 13 statistical distributions (normal, beta, gamma, etc.) |
| [@acausal/distributions](https://github.com/abrisene/acausal/tree/main/packages/distributions) | Weighted discrete distributions with immutable ops |
| [@acausal/markov](https://github.com/abrisene/acausal/tree/main/packages/markov) | Markov chains with blending, constraints, multi-dim |

## Migration from v2

```typescript
// v2
import { MarkovChain, Distribution, Random } from 'acausal';

// v3 (same — meta-package re-exports everything)
import { MarkovChain, Distribution, Random } from 'acausal';

// v3 (individual packages for smaller bundles)
import { Random } from '@acausal/random';
import { MarkovChain } from '@acausal/markov';
```

API changes from v2 are documented in [CHANGELOG.md](https://github.com/abrisene/acausal/blob/main/CHANGELOG.md).

## License

Apache-2.0
