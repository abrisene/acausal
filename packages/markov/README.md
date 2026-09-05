# @acausal/markov

Markov chain text and sequence generation with blending, constraints, batch training, and multi-dimensional state spaces.

## Install

```bash
npm install @acausal/markov
```

## Usage

```typescript
import { MarkovChain, ImmutableMarkovChain } from '@acausal/markov';

// Train on sequences
const chain = new MarkovChain({ seed: 42, maxOrder: 3 });
chain.addSequences([
  ['the', 'cat', 'sat'],
  ['the', 'dog', 'ran'],
  ['the', 'cat', 'ran'],
]);

// Generate
chain.generate();  // ['the', 'cat', 'sat'] or similar

// Generate with constraints
chain.generate({ max: 5, start: ['the'] });

// Immutable variant
const frozen = ImmutableMarkovChain.from(chain);
const updated = frozen.addSequence(['the', 'bird', 'flew']); // returns new instance

// Blend two chains
const blended = MarkovChain.blendDTOs([
  { model: chain1.serialize(), weight: 0.7 },
  { model: chain2.serialize(), weight: 0.3 },
]);
```

Supports batch training, forward/backward generation, sequence analysis, multi-dimensional state spaces, and 5 blend strategies (arithmetic, geometric, harmonic, max, min).

## Deterministic replay across mutable and immutable flows

```typescript
const frozen = new ImmutableMarkovChain({ seed: 42, maxOrder: 2, sequences: [['a', 'b', 'c']] });
frozen.generate({ order: 1, min: 1, max: 3 });

const mutable = frozen.toMutable();

mutable.generate({ order: 1, min: 1, max: 3 }); // same next sequence as frozen.generate(...)
```

`clone()`, `toMutable()`, and `ImmutableMarkovChain.from()` preserve the current PRNG replay point. That lets you switch between mutable and immutable APIs without losing deterministic generation.

Part of the [acausal](https://github.com/abrisene/acausal) procedural generation toolkit.
