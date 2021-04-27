/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

/**
 # Module Dependencies
 */

import { MarkovChain, Random } from '..';

/**
 # Constants
 */

const engineA = new Random({ seed: 4 });
const engineB = new Random({ ...engineA.serialize() });

const sequencesA = [
  ['a', 'b', 'c'],
  ['a', 'b', 'd'],
];

const sequencesB = [
  ['a', 'b', 'c'],
  ['a', 'b', 'd'],
  ['a', 'b', 'a'],
  ['c', 'b'],
  ['c', 'a'],
];

/**
 # Tests
 */

test('Markov Chains can be created functionally.', () => {
  // expect(seqA).toEqual(seqB);
  const m1 = MarkovChain.new(sequencesB);
  console.log(m1);
  const gen1 = MarkovChain.generate(engineA, m1, [], 1, 20, 100, true);
  const gen2 = MarkovChain.generate(engineA, m1, [], 1, 20, 100, true);
  const gen3 = MarkovChain.generate(engineA, m1, [], 1, 20, 100, true);
  // console.log(gen1);
  // console.log(gen2);
  // console.log(gen3);

  for (let i = 0; i < 3; i += 1) {
    const gen = MarkovChain.generate(engineA, m1, [], 1, 20, 100, true);
    // console.log(gen);
    // console.log(engineA.uses);
  }
});
