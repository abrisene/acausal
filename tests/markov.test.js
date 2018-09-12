/*
 # markov.test.js
 # Markov Chain Test
 */

/**
 # Module Dependencies
 */

const { Markov } = require('../lib');

/**
 # Variables
 */

const configA = {
  seed: 555,
  maxOrder: 1,
};

const configB = {
  seed: 555,
  maxOrder: 2,
  uses: 3,
};

const names = ['alice', 'bob', 'erwin'];
const nameSource = names.map(name => name.split(''));

const objectSource = [
  [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'c' }, { id: 'b' }, { id: 'a' }],
  [{ id: 'c' }, { id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'c' }, { id: 'c' }],
  [{ id: 'a' }, { id: 'd' }, { id: 'a' }],
  [{ id: 'b' }, { id: 'c' }, { id: 'd' }],
  [{ id: 'c' }, { id: 'c' }, { id: 'c' }],
];

const objectExtractor = obj => obj.id;


const markovA = new Markov({
  ...configA,
  source: nameSource,
});

const markovB = new Markov({
  ...configB,
  source: objectSource,
  extractor: objectExtractor,
});

/**
 # Tests
 */

test('Markov Chain instantiates correctly', () => {
  expect(markovB).toBeDefined();
  expect(markovB.seed).toBe(configB.seed);
  expect(markovB.sources).toEqual(objectSource);
  expect(markovA.sources).toEqual(nameSource);
  expect(markovB.maxOrder).toBe(configB.maxOrder);
  expect(markovB.delimiter).toBeDefined();
  expect(markovB.start).toBeDefined();
  expect(markovB.end).toBeDefined();
  expect(markovA.extractor).toBeUndefined();
  expect(markovB.extractor).toBeDefined();
  expect(markovB.states).toBeDefined();
  expect(markovB.ngrams).toBeDefined();
  expect(markovB.edges).toBeDefined();
  expect(markovB.matrix).toBeDefined();
  expect(markovB.mt).toBeDefined();
  expect(markovB.mt.getUseCount()).toBe(configB.uses);
});

test('Markov Chain can pick values', () => {
  const configA = { min: 4, max: 10, order: 2 };
  const configB = { min: 4, max: 5, order: 2, start: ['c'] };
  const valueA = markovA.generate(configA);
  const valueB = markovB.generate(configB);
  expect(valueA).toEqual(['a', 'l', 'i', 'n']);
  expect(valueB).toEqual([{ id: 'c' }, { id: 'b' }, { id: 'c' }, { id: 'b' }, { id: 'c' }]);
  expect(valueB[0].id).toEqual(configB.start[0]);
});

test('Markov Chain can be serialized', () => {
  const serial = markovA.serialize();
  expect(serial).toEqual({
    seed: markovA.seed,
    maxOrder: markovA.maxOrder,
    delimiter: markovA.delimiter,
    start: markovA.start,
    end: markovA.end,
    sources: markovA.sources,
    states: markovA.states,
    ngrams: markovA.ngrams,
    edges: markovA.edges,
    matrix: markovA.matrix.serialize(),
    uses: markovA.mt.getUseCount(),
  });
});

test('Markov Chain can be deserialized', () => {
  const serialA = markovA.serialize();
  const serialB = markovB.serialize();
  const dsMarkovA = Markov.deserialize(serialA);
  const dsMarkovB = Markov.deserialize(serialB, objectExtractor);

  expect(dsMarkovA.seed).toBe(serialA.seed);
  expect(dsMarkovA.maxOrder).toBe(serialA.maxOrder);
  expect(dsMarkovA.delimiter).toBe(serialA.delimiter);
  expect(dsMarkovA.start).toBe(serialA.start);
  expect(dsMarkovA.end).toBe(serialA.end);
  expect(dsMarkovA.extractor).toBeUndefined();
  expect(dsMarkovB.extractor).toBeDefined();
  expect(dsMarkovA.delimiter).toBe(serialA.delimiter);
  expect(dsMarkovA.sources).toEqual(serialA.sources);
  expect(dsMarkovA.states).toEqual(serialA.states);
  expect(dsMarkovA.ngrams).toEqual(serialA.ngrams);
  expect(dsMarkovA.edges).toEqual(serialA.edges);
  expect(dsMarkovA.matrix.serialize()).toEqual(serialA.matrix);
  expect(dsMarkovA.mt).toBeDefined();
  expect(markovA.mt.getUseCount()).toBe(serialA.uses);
  expect(markovB.mt.getUseCount()).toBe(serialB.uses);
});
