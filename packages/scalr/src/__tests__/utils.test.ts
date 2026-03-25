/*
 # utils.test.js
 # Scalr Utilities Test
 */

/**
 # Module Dependencies
 */

import { arrayToObject } from '../utils';

/**
 # Constants
 */

const a0 = [1, 2, 3];
const a1 = [50, 25, 15];
const a2 = [500, 200, 5];

const b0 = [
  { id: 'a', v: 1 },
  { id: 'b', v: 2 },
  { id: 'c', v: 3 },
];
const b1 = [
  { id: 'a', v: 50 },
  { id: 'b', v: 25 },
  { id: 'c', v: 15 },
];
const b2 = [
  { id: 'a', v: 500 },
  { id: 'b', v: 200 },
  { id: 'c', v: 5 },
];

const c = [
  { id: 0, v: 500 },
  { id: 'b', v: 200 },
  { id: 35, v: 5 },
];

/**
 # Tests
 */

test('Array to Object Utility converts arrays to objects.', () => {
  // Default
  expect(arrayToObject(a0)).toEqual({ 0: 1, 1: 2, 2: 3 });
  expect(arrayToObject(a1)).toEqual({ 0: 50, 1: 25, 2: 15 });
  expect(arrayToObject(a2)).toEqual({ 0: 500, 1: 200, 2: 5 });

  // With Number Keys
  expect(arrayToObject(a0, (v, i) => i)).toEqual({ 0: 1, 1: 2, 2: 3 });
  expect(arrayToObject(a1, (v, i) => i)).toEqual({ 0: 50, 1: 25, 2: 15 });
  expect(arrayToObject(a2, (v, i) => i)).toEqual({ 0: 500, 1: 200, 2: 5 });

  // With String Keys
  expect(arrayToObject(b0, v => v.id)).toEqual({
    a: { id: 'a', v: 1 },
    b: { id: 'b', v: 2 },
    c: { id: 'c', v: 3 },
  });
  expect(arrayToObject(b1, v => v.id)).toEqual({
    a: { id: 'a', v: 50 },
    b: { id: 'b', v: 25 },
    c: { id: 'c', v: 15 },
  });
  expect(arrayToObject(b2, v => v.id)).toEqual({
    a: { id: 'a', v: 500 },
    b: { id: 'b', v: 200 },
    c: { id: 'c', v: 5 },
  });

  // With Calculated Keys
  expect(arrayToObject(b0, (v, i) => v.id + i)).toEqual({
    a0: { id: 'a', v: 1 },
    b1: { id: 'b', v: 2 },
    c2: { id: 'c', v: 3 },
  });
  expect(arrayToObject(b1, (v, i) => v.id + i)).toEqual({
    a0: { id: 'a', v: 50 },
    b1: { id: 'b', v: 25 },
    c2: { id: 'c', v: 15 },
  });
  expect(arrayToObject(b2, (v, i) => v.id + i)).toEqual({
    a0: { id: 'a', v: 500 },
    b1: { id: 'b', v: 200 },
    c2: { id: 'c', v: 5 },
  });

  // With Mixed Number / String Keys
  expect(arrayToObject(c, v => v.id)).toEqual({
    0: { id: 0, v: 500 },
    b: { id: 'b', v: 200 },
    35: { id: 35, v: 5 },
  });
});
