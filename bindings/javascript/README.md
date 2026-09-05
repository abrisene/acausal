# acausal 4

Rust-backed seeded generation, weighted choices, Markov models, and finite conditioning. The package has no JavaScript runtime dependencies.

```js
import { init, Rng, Weighted } from 'acausal';

await init();
const rng = new Rng(42);
const rewards = new Weighted({ common: 60, uncommon: 25, rare: 12, legendary: 3 });
try {
  console.log(rewards.draw(rng));
  console.log(rewards.drawMany(rng, 3, { replacement: false, exclude: ['legendary'] }));
} finally {
  rewards.close();
  rng.close();
}
```

Node loads the bundled wasm file. Browser callers can pass wasm bytes or a URL to `init`. Initialization checks the engine ABI.

`Rng` owns random state. `Weighted`, `Markov`, and `Model` receive that stream when sampling. Cloning a model leaves random state unchanged.

`rng.snapshot()` and `Rng.fromState(bytes)` resume the exact stream. Model snapshots contain model data separately. Resources support `close()` and `Symbol.dispose` where available.

`rng.sample({ type: 'normal', mean: 170, stddev: 7 })` selects a numeric distribution. Supported descriptions are declared in `index.d.ts`.

## Markov models

```js
import { init, Rng, Markov } from 'acausal';
await init();
const rng = new Rng(42);
const names = new Markov(2);
try {
  names.learn([Array.from('alice'), Array.from('alina')]);
  console.log(names.generate(rng, { min: 4, max: 8, maxAttempts: 20 }));
} finally {
  names.close();
  rng.close();
}
```

`addTransition(context, next, weight)` adds an authored weighted edge. Bulk learning uses the ordinary insertion path. `score` reports unsupported transitions as invalid.

## Conditioning

```js
import { init, Rng, Model } from 'acausal';
await init();
const rng = new Rng(42);
const model = new Model({
  variables: [{ id: 'weather', domain: ['sun', 'rain'] }],
  tables: [{ target: 'weather', parents: [], rows: [
    { given: {}, weights: { sun: 3, rain: 1 } }
  ] }]
});
try {
  console.log(model.posterior('weather'));
  console.log(model.sample(rng, { weather: 'rain' }));
} finally {
  model.close();
  rng.close();
}
```

Rows inherit target and parent scope from their table. Separate constraints combine by conjunction; alternatives inside an `allow` group combine by disjunction.

Posterior inference and conditional sampling share one evidence path. Sampling supports non-root evidence. Work-limit exhaustion raises an error rather than returning an approximate result.

This is a new major API. `RandomSampler`, immutable subclasses, static DTO methods, and batch classes are replaced by explicit random streams and ordinary models.
