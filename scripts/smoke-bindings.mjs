import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modulePath = process.env.ACAUSAL_JS_MODULE ?? '../bindings/javascript/index.mjs';
const { init, Rng, Weighted, Markov, Model } = await import(modulePath);
await init();
const resources = [];
const keep = value => (resources.push(value), value);
try {
  const specs = [
    {type:'uniform',min:1,max:10}, {type:'normal',mean:170,stddev:7},
    {type:'clampedNormal',mean:170,stddev:7,min:160,max:180}, {type:'logNormal',mean:1,stddev:0.5},
    {type:'exponential',rate:2}, {type:'poisson',rate:4}, {type:'binomial',trials:10,probability:0.3},
    {type:'geometric',probability:0.4}, {type:'beta',alpha:2,beta:3}, {type:'gamma',shape:2,scale:3},
    {type:'weibull',shape:2,scale:3,location:1}, {type:'cauchy',location:0,scale:1},
    {type:'logistic',location:0,scale:1}, {type:'bernoulli',probability:0.3}
  ];
  for (const spec of specs) {
    const stream = keep(new Rng(42));
    const copy = keep(stream.clone());
    const result = stream.sample(spec);
    assert(Number.isFinite(result));
    assert.equal(result,copy.sample(spec));
    assert.equal(stream.uses(),copy.uses());
  }
  const arraySeed = keep(new Rng([1,2,3,4]));
  assert.equal(arraySeed.int(0,999),79);
  const legacy = keep(Rng.fromLegacy(250,100));
  assert.equal(legacy.int(0,1000),182);
  const rng = keep(new Rng(42));
  assert.deepEqual(Array.from({length: 4}, () => rng.int(1, 6)), [3, 2, 4, 6]);
  const fork = keep(Rng.fromState(rng.snapshot()));
  assert.deepEqual(Array.from({length: 8}, () => rng.int(1, 1000)), Array.from({length: 8}, () => fork.int(1, 1000)));
  const weights = keep(new Weighted({common: 60, uncommon: 25, rare: 12, legendary: 3}));
  const before = rng.uses();
  assert.throws(() => weights.drawMany(rng, 5, {replacement: false}));
  assert.equal(rng.uses(), before);
  const selected = weights.drawMany(rng, 3, {replacement: false, exclude: ['legendary']});
  assert.equal(new Set(selected).size, 3);
  assert(!selected.includes('legendary'));
  const zero = keep(new Weighted({zero: 0}));
  const zeroBefore = rng.uses();
  assert.throws(() => zero.draw(rng));
  assert.equal(rng.uses(), zeroBefore);
  assert.throws(() => weights.adjust('common', -1000));
  assert.equal(weights.entries().find(([key]) => key === 'common')[1], 60);

  const corpus = JSON.parse(await readFile(new URL('../fixtures/markov.json', import.meta.url), 'utf8')).cases[0].sequences;
  const chain = keep(new Markov(2));
  chain.learn(corpus);
  const generated = chain.generate(rng, {min: 4, max: 12, maxAttempts: 50});
  assert(generated.length >= 4 && generated.length <= 12);
  assert.equal(chain.score(['the', 'not-in-the-corpus']).isValid, false);
  const restored = keep(Markov.fromState(chain.snapshot()));
  assert.deepEqual(restored.stats(),chain.stats());
  const otherRng = keep(rng.clone());
  assert.deepEqual(chain.generate(rng), restored.generate(otherRng));

  const description = JSON.parse(await readFile(new URL('../examples/soldier.json', import.meta.url), 'utf8'));
  const model = keep(new Model(description));
  const evidence = {profession: 'soldier'};
  const posterior = model.posterior('gender', evidence);
  assert(Math.abs(posterior.probabilities.male - 6 / 11) < 1e-14);
  assert.equal(model.posterior('profession', evidence).probabilities.soldier, 1);
  const sampleRng = keep(new Rng(42));
  const samples = Array.from({length: 8}, () => model.sample(sampleRng, evidence));
  assert(samples.every(value => value.profession === 'soldier'));
  assert.throws(() => model.posterior('gender', evidence, {maxOperations: 1}));
  const modelCopy = keep(Model.fromState(model.snapshot()));
  assert.deepEqual(modelCopy.posterior('gender', evidence), posterior);
  const unicode = keep(new Model({variables: [{id: 'café', domain: ['王','queen']}], tables: [{target: 'café', parents: [], rows: [{given: {}, weights: {'王': 1, queen: 1}}]}]}));
  assert.equal(unicode.posterior('café', {'café':'王'}).probabilities['王'], 1);
  console.log(JSON.stringify({samples, uses: sampleRng.uses(), generated, posterior: posterior.probabilities}));
} finally {
  for (const resource of resources.reverse()) resource.close();
}
