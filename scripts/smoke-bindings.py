"""Exercise the installed Python binding through its real native library."""
from contextlib import ExitStack
import json
import math
from pathlib import Path
from acausal import Rng, Weighted, Markov, Model, AcausalError

root = Path(__file__).resolve().parents[1]

def fails(function):
    try:
        function()
    except AcausalError:
        return
    raise AssertionError("expected a Rust operation error")

with ExitStack() as stack:
    keep = stack.enter_context
    specs = [
        {"type":"uniform","min":1,"max":10}, {"type":"normal","mean":170,"stddev":7},
        {"type":"clampedNormal","mean":170,"stddev":7,"min":160,"max":180}, {"type":"logNormal","mean":1,"stddev":0.5},
        {"type":"exponential","rate":2}, {"type":"poisson","rate":4}, {"type":"binomial","trials":10,"probability":0.3},
        {"type":"geometric","probability":0.4}, {"type":"beta","alpha":2,"beta":3}, {"type":"gamma","shape":2,"scale":3},
        {"type":"weibull","shape":2,"scale":3,"location":1}, {"type":"cauchy","location":0,"scale":1},
        {"type":"logistic","location":0,"scale":1}, {"type":"bernoulli","probability":0.3}
    ]
    for spec in specs:
        stream = keep(Rng(42))
        copy = keep(stream.clone())
        result = stream.sample(spec)
        assert math.isfinite(result) and result == copy.sample(spec)
        assert stream.uses() == copy.uses()
    array_seed = keep(Rng([1,2,3,4]))
    assert array_seed.int(0,999) == 79
    legacy = keep(Rng.from_legacy(250,100))
    assert legacy.int(0,1000) == 182
    rng = keep(Rng(42))
    assert [rng.int(1, 6) for _ in range(4)] == [3, 2, 4, 6]
    fork = keep(Rng.from_state(rng.snapshot()))
    assert [rng.int(1, 1000) for _ in range(8)] == [fork.int(1, 1000) for _ in range(8)]
    weights = keep(Weighted({"common":60,"uncommon":25,"rare":12,"legendary":3}))
    before = rng.uses()
    fails(lambda: weights.draw_many(rng, 5, replacement=False))
    assert rng.uses() == before
    selected = weights.draw_many(rng, 3, replacement=False, exclude=["legendary"])
    assert len(set(selected)) == 3 and "legendary" not in selected
    zero = keep(Weighted({"zero":0}))
    before = rng.uses()
    fails(lambda: zero.draw(rng))
    assert rng.uses() == before
    fails(lambda: weights.adjust("common", -1000))
    assert dict(weights.entries())["common"] == 60
    corpus = json.loads((root / "fixtures/markov.json").read_text())["cases"][0]["sequences"]
    chain = keep(Markov(2))
    chain.learn(corpus)
    generated = chain.generate(rng,min=4,max=12,max_attempts=50)
    assert 4 <= len(generated) <= 12
    assert not chain.score(["the","not-in-the-corpus"])["is_valid"]
    restored = keep(Markov.from_state(chain.snapshot()))
    assert restored.stats() == chain.stats()
    other_rng = keep(rng.clone())
    assert chain.generate(rng) == restored.generate(other_rng)
    model = keep(Model(json.loads((root / "examples/soldier.json").read_text())))
    evidence = {"profession":"soldier"}
    posterior = model.posterior("gender",evidence)
    assert abs(posterior["probabilities"]["male"] - 6/11) < 1e-14
    assert model.posterior("profession",evidence)["probabilities"]["soldier"] == 1
    sample_rng = keep(Rng(42))
    samples = [model.sample(sample_rng,evidence) for _ in range(8)]
    assert all(value["profession"] == "soldier" for value in samples)
    fails(lambda: model.posterior("gender",evidence,{"max_operations":1}))
    model_copy = keep(Model.from_state(model.snapshot()))
    assert model_copy.posterior("gender",evidence) == posterior
    unicode = keep(Model({"variables":[{"id":"café","domain":["王","queen"]}],"tables":[{"target":"café","parents":[],"rows":[{"given":{},"weights":{"王":1,"queen":1}}]}]}))
    assert unicode.posterior("café",{"café":"王"})["probabilities"]["王"] == 1
    print(json.dumps({"samples":samples,"uses":sample_rng.uses(),"generated":generated,"posterior":posterior["probabilities"]},separators=(",",":")))
