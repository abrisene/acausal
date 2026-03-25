/*
 # operations.test.js
 # Scalr Mathematical Operations Tests
 */

/**
 # Module Dependencies
 */

import { sum, difference, product, quotient } from '..';

/**
 # Constants
 */

const a0 = [1];
const a1 = [1, 2];
const a2 = [1, 2, 3];

const o0 = { a: 1 };
const o1 = { a: 1, b: 2 };
const o2 = { a: 1, b: 2, c: 3 };
const o2w = { c: 3, b: 2, a: 1 };

const ab0 = [3];
const ab1 = [3, 2];
const ab2 = [3, 2, 1];

const ob0 = { a: 3 };
const ob1 = { a: 3, b: 2 };
const ob2 = { a: 3, b: 2, c: 1 };
const ob2w = { c: 1, b: 2, a: 3 };

const ac0 = [4];
const ac1 = [4, 2];
const ac2 = [4, 2, 1];

const oc0 = { a: 4 };
const oc1 = { a: 4, b: 2 };
const oc2 = { a: 4, b: 2, c: 1 };
const oc2w = { c: 1, b: 2, a: 4 };

/**
 # Tests
 */

test('Sums add correctly for arrays.', () => {
  expect(sum(a0)).toEqual(1);
  expect(sum(a1)).toEqual(3);
  expect(sum(a2)).toEqual(6);
});

test('Sums add correctly for objects.', () => {
  expect(sum(o0)).toEqual(1);
  expect(sum(o1)).toEqual(3);
  expect(sum(o2)).toEqual(6);
});

test('Differences subtract correctly for arrays.', () => {
  expect(difference(a0)).toEqual(1);
  expect(difference(a1)).toEqual(-1);
  expect(difference(a2)).toEqual(-4);
});

test('Differences subtract correctly for objects.', () => {
  expect(difference(o0)).toEqual(1);
  expect(difference(o1)).toEqual(-1);
  expect(difference(o2)).toEqual(-4);
  expect(difference(o2w)).toEqual(-4);
});

test('Products multiply correctly for arrays.', () => {
  expect(product(ab0)).toEqual(3);
  expect(product(ab1)).toEqual(6);
  expect(product(ab2)).toEqual(6);
});

test('Products multiply correctly for objects.', () => {
  expect(product(ob0)).toEqual(3);
  expect(product(ob1)).toEqual(6);
  expect(product(ob2)).toEqual(6);
  expect(product(ob2w)).toEqual(6);
});

test('Quotients divide correctly for arrays.', () => {
  expect(quotient(ac0)).toEqual(4);
  expect(quotient(ac1)).toEqual(2);
  expect(quotient(ac2)).toEqual(2);
});

test('Quotients divide correctly for objects.', () => {
  expect(quotient(oc0)).toEqual(4);
  expect(quotient(oc1)).toEqual(2);
  expect(quotient(oc2)).toEqual(2);
  expect(quotient(oc2w)).toEqual(2);
});
