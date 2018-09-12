/*
 # transition.matrix.test.js
 # Transition Matrix Test
 */

/**
 # Module Dependencies
 */

const { TransitionMatrix } = require('../lib');

/**
 # Variables
 */

const config = {
  seed: 1,
  uses: 5,
  edges: {
    a: { x: 10, y: 10 },
    b: { z: 5, w: 10 },
    c: { u: 1 },
  },
};

const matrix = new TransitionMatrix(config);

/**
 # Tests
 */

test('Transition Matrix instantiates correctly', () => {
  expect(matrix).toBeDefined();
  expect(matrix.seed).toBe(config.seed);
  expect(matrix.mt).toBeDefined();
  expect(matrix.edges).toBeDefined();
  expect(Object.keys(matrix.edges).length).toBe(Object.keys(config.edges).length);
  expect(matrix.mt.getUseCount()).toBe(config.uses);
});

test('Transition Matrix normalizes edge weights', () => {
  Object.keys(matrix.edges).forEach((key) => {
    const dictionary = matrix.edges[key];
    const sum = Object.keys(dictionary).reduce((a, b) => a + dictionary[b], 0);
    expect(sum).toBe(1);
  });
});

test('Transition Matrix can pick values', () => {
  expect(matrix.pick('a')).toBe('x');
  expect(matrix.pick('a', ['x'])).toBe('y');
  expect(matrix.pick('a', ['x', 'y'])).toBeUndefined();
});

test('Transition Matrix can be serialized', () => {
  const serial = matrix.serialize();
  const edges = matrix.serialize(true);
  expect(edges).toEqual(matrix.edges);
  expect(serial).toEqual({
    seed: matrix.seed,
    edges: matrix.edges,
    uses: matrix.mt.getUseCount(),
  });
});

test('Transition Matrix can be deserialized', () => {
  const serial = matrix.serialize();
  const dsMatrix = TransitionMatrix.deserialize(serial);
  expect(dsMatrix.seed).toBe(serial.seed);
  expect(dsMatrix.mt).toBeDefined();
  expect(dsMatrix.edges).toEqual(serial.edges);
  expect(Object.keys(dsMatrix.edges).length).toBe(Object.keys(serial.edges).length);
  expect(dsMatrix.mt.getUseCount()).toBe(serial.uses);
  expect(matrix.pick('a')).toBe('x');
  expect(matrix.pick('a', ['x'])).toBe('y');
  expect(matrix.pick('a', ['x', 'y'])).toBeUndefined();
});
