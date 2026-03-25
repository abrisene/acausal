# @acausal/scalr

Lightweight scaling and normalization utilities for weighted objects and arrays.

## Install

```bash
npm install @acausal/scalr
```

## Usage

```typescript
import { normalizeObject, scaleNormalObject, sumObject } from '@acausal/scalr';

// Normalize weights to sum to 1.0
normalizeObject({ a: 3, b: 1 });  // { a: 0.75, b: 0.25 }

// Scale normalized values by a total
scaleNormalObject({ a: 0.75, b: 0.25 }, 100);  // { a: 75, b: 25 }

// Sum all values
sumObject({ a: 3, b: 1 });  // 4
```

Also provides array normalization, merge utilities, and basic statistics (mean, variance, standard deviation).

Part of the [acausal](https://github.com/abrisene/acausal) procedural generation toolkit.
