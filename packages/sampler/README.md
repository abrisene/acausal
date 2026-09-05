# @acausal/sampler

Statistical distribution sampling with deterministic seeded RNG. Normal, exponential, Poisson, beta, gamma, binomial, geometric, Weibull, Cauchy, logistic, and more.

## Install

```bash
npm install @acausal/sampler
```

## Usage

```typescript
import { RandomSampler } from '@acausal/sampler';

const sampler = new RandomSampler({ seed: 42 });

sampler.normal(170, 7);        // height ~ N(170, 7)
sampler.uniform(1, 10);        // uniform in [1, 10)
sampler.poisson(5);            // count ~ Poisson(5)
sampler.beta(2, 5);            // proportion ~ Beta(2, 5)
sampler.weightedChoice({ red: 55, auburn: 25, blonde: 20 });

// Data-driven sampling from config
sampler.sampleDistribution({ type: 'normal', mu: 170, sigma: 7 });
```

All methods are deterministic given the same seed. Built on [@acausal/random](https://github.com/abrisene/acausal/tree/main/packages/random).

## Replay and fork

```typescript
const sampler = new RandomSampler({ seed: 42 });
sampler.normal(170, 7);
sampler.poisson(4);

const fork = sampler.clone();

sampler.beta(2, 5) === fork.beta(2, 5); // true
```

`clone()` copies the sampler's current PRNG state, so downstream sampling stays reproducible after the fork. `serialize()` and `new RandomSampler(dto)` provide the same resume behavior for persistence.

Part of the [acausal](https://github.com/abrisene/acausal) procedural generation toolkit.
