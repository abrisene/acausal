# @acausal/random

Seeded PRNG (Mersenne Twister MT19937) with deterministic replay and zero dependencies.

## Install

```bash
npm install @acausal/random
```

## Usage

```typescript
import { Random } from '@acausal/random';

const rng = new Random({ seed: 42 });

rng.int(1, 6);              // deterministic d6 roll
rng.real(0, 1);             // float in [0, 1)
rng.bool(0.3);              // 30% chance of true
rng.pick(['a', 'b', 'c']); // random element
rng.pickWeighted({ common: 80, rare: 15, legendary: 5 });
```

Same seed always produces the same sequence. Serialize with `rng.serialize()` and restore with `new Random(dto)` to resume from any point.

## Replay and fork

```typescript
const rng = new Random({ seed: 42 });
rng.int(1, 6);
rng.float(0, 1);

const fork = rng.clone();

rng.int(1, 100) === fork.int(1, 100); // true
```

`clone()` copies the current replay point, not just the original seed. That makes it useful for deterministic branching, testing, and recreating downstream generator state.

Part of the [acausal](https://github.com/abrisene/acausal) procedural generation toolkit.
