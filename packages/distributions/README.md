# @acausal/distributions

Weighted random selection from discrete distributions — type-safe, serializable, with immutable and mutable APIs.

## Install

```bash
npm install @acausal/distributions
```

## Usage

```typescript
import { Distribution } from '@acausal/distributions';

// Create from source weights
const loot = Distribution.new({ gold: 60, silver: 30, diamond: 10 });

// Pick one
Distribution.pickOne(loot);  // 'gold' (60% chance)

// Pick with mask (exclude items)
Distribution.pickOne(loot, ['gold']);  // 'silver' or 'diamond'

// Modify immutably
const boosted = Distribution.addNormalValues(loot, { diamond: 0.1 });

// Immutable class variant
const dist = new Distribution({ source: { a: 3, b: 1 }, seed: 42 });
const frozen = dist.clone(true);  // strip source, keep normalized
```

Supports blending, masking, source/normal weight separation, and full serialization. Built on [@acausal/random](https://github.com/abrisene/acausal/tree/main/packages/random).

## Deterministic state bridges

```typescript
const mutable = new Distribution({ seed: 42, source: { a: 3, b: 1 } });
mutable.pick({ count: 2 });

const frozen = mutable.freeze();
const resumed = frozen.toMutable();

resumed.pick({ count: 3 }); // same next picks as frozen.pick({ count: 3 })
```

`clone()`, `freeze()`, and `toMutable()` preserve the current PRNG replay point, not just the weight tables. That means immutable and mutable flows can hand state back and forth without losing deterministic behavior.

Part of the [acausal](https://github.com/abrisene/acausal) procedural generation toolkit.
