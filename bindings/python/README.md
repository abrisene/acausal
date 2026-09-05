# acausal 4

The Python binding calls the Rust native library through ctypes. It has no runtime package dependencies and requires Python 3.11 or later.

```python
from acausal import Rng, Weighted

with Rng(42) as rng, Weighted({"common": 60, "rare": 12}) as rewards:
    print(rewards.draw(rng))
    print(rewards.probabilities())
```

Each wheel includes a native library for its platform. To use a separately built library, set `ACAUSAL_LIBRARY` to its absolute path.

`Rng` owns random state. `Weighted`, `Markov`, and `Model` receive it explicitly. Use context managers or `close()` to release native handles.

`rng.snapshot()` returns versioned bytes. `Rng.from_state(bytes)` resumes directly. Models expose their own snapshots independently of random state.

Numeric distributions use `rng.sample({"type": "normal", "mean": 170, "stddev": 7})` and the other declared distribution descriptions.

```python
from acausal import Rng, Markov, Model

with Rng(42) as rng, Markov(2) as names:
    names.learn([list("alice"), list("alina")])
    print(names.generate(rng, min=4, max=8, max_attempts=20))

description = {
    "variables": [{"id": "weather", "domain": ["sun", "rain"]}],
    "tables": [{"target": "weather", "parents": [], "rows": [
        {"given": {}, "weights": {"sun": 3, "rain": 1}}
    ]}]
}
with Rng(42) as rng, Model(description) as model:
    print(model.posterior("weather"))
    print(model.sample(rng, {"weather": "rain"}))
```

Conditioning supports evidence on any variable. Work-limit exhaustion and empty support are explicit errors. String values support Unicode.

The old JavaScript class families are not reproduced. Bulk learning is an ordinary model operation, and model cloning is separate from random-stream cloning.
