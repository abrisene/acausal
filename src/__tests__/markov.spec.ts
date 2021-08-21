/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

/**
 # Module Dependencies
 */

import { MarkovChain, Random, CONSTANTS } from '..';
import { MarkovChainSequenceDTO } from '../structures';

/**
 # Utility Functions
 */

/**
 # Constants
 */

// Engine
const engineA = new Random({ seed: 4 });
const engineB = new Random({ ...engineA.serialize() });

// Sequences
const sequenceUnitA = ['a'];
const sequenceUnitB = ['b'];

const sequenceA1 = ['a', 'b'];
const sequenceA2 = ['b', 'a'];

const sequenceB1 = ['a', 'b', 'c'];
const sequenceB2 = ['a', 'b', 'd'];

const sequencesUnitAB = [sequenceUnitA, sequenceUnitB];

const sequencesA = [sequenceA1, sequenceA2];

const sequencesB = [sequenceB1, sequenceB2];

const sequencesC = [
  ['a', 'b', 'c'],
  ['a', 'b', 'd'],
  ['a', 'b', 'a'],
  ['c', 'b'],
  ['c', 'a'],
];

const sequencesAU = [...sequencesA, sequenceUnitA];
const sequencesAB = [...sequencesA, ...sequencesB];
const sequencesABC = [...sequencesAB, ...sequencesC];

// DTOs
const dtoDefault = {
  maxOrder: 4,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
  sequences: [],
  grams: {},
};

const dtoEmpty = MarkovChain.new();
const dtoUnitA = MarkovChain.new([sequenceUnitA]);
const dtoUnitB = MarkovChain.new([sequenceUnitB]);
const dtoUnitAB = MarkovChain.new(sequencesUnitAB);

const dtoSeqA = MarkovChain.new(sequencesA);
const dtoSeqB = MarkovChain.new(sequencesB);
const dtoSeqC = MarkovChain.new(sequencesC);
const dtoSeqUA = MarkovChain.new(sequencesAU);
const dtoSeqAB = MarkovChain.new(sequencesAB);
const dtoSeqABC = MarkovChain.new(sequencesABC);

/**
 # Tests
 */

describe('Markov Chain', () => {
  describe('static methods', () => {
    it('can create new markov chains.', () => {
      // Empty
      expect(dtoEmpty).toEqual(dtoDefault);
      expect(dtoEmpty).toHaveProperty('maxOrder');
      expect(dtoEmpty).toHaveProperty('delimiter');
      expect(dtoEmpty).toHaveProperty('startDelimiter');
      expect(dtoEmpty).toHaveProperty('endDelimiter');
      expect(dtoEmpty).toHaveProperty('sequences');
      expect(dtoEmpty).toHaveProperty('grams');
      expect(dtoEmpty.maxOrder).toEqual(4);
      expect(dtoEmpty.delimiter).toEqual(CONSTANTS.MC_GRAM_DELIMITER);
      expect(dtoEmpty.startDelimiter).toEqual(CONSTANTS.MC_START_DELIMITER);
      expect(dtoEmpty.endDelimiter).toEqual(CONSTANTS.MC_END_DELIMITER);
      expect(dtoEmpty.sequences).toEqual([]);
      expect(dtoEmpty.grams).toEqual({});

      // With Values
      // expect(dtoSeqA).toEqual(dtoDefault);
      expect(dtoSeqA).toHaveProperty('maxOrder');
      expect(dtoSeqA).toHaveProperty('delimiter');
      expect(dtoSeqA).toHaveProperty('startDelimiter');
      expect(dtoSeqA).toHaveProperty('endDelimiter');
      expect(dtoSeqA).toHaveProperty('sequences');
      expect(dtoSeqA).toHaveProperty('grams');
      expect(dtoSeqA.maxOrder).toEqual(4);
      expect(dtoSeqA.delimiter).toEqual(CONSTANTS.MC_GRAM_DELIMITER);
      expect(dtoSeqA.startDelimiter).toEqual(CONSTANTS.MC_START_DELIMITER);
      expect(dtoSeqA.endDelimiter).toEqual(CONSTANTS.MC_END_DELIMITER);
      expect(dtoSeqA.sequences).toEqual(sequencesA);

      Object.keys(dtoSeqA.grams).forEach(k => {
        const gram = dtoSeqA.grams[k];
        expect(gram).toHaveProperty('id');
        expect(gram).toHaveProperty('order');
        expect(gram).toHaveProperty('last');
        expect(gram).toHaveProperty('next');
        expect(gram).toHaveProperty('degreeIn');
        expect(gram).toHaveProperty('degreeOut');
        expect(gram).toHaveProperty('frequency');

        expect(gram.id).toEqual(k);
        expect(gram.order).toBeGreaterThan(0);
        if (dtoSeqA.maxOrder !== undefined)
          expect(gram.order).toBeLessThanOrEqual(dtoSeqA.maxOrder);
        expect(Object.keys(gram.next).length).toBeGreaterThan(0);
        expect(Object.keys(gram.last).length).toBeGreaterThan(0);
      });
    });
    it('can clone existing markov chains', () => {
      // Direct Clones
      expect(MarkovChain.clone(dtoDefault, false)).toEqual(dtoDefault);
      expect(MarkovChain.clone(dtoSeqA, false)).toEqual(dtoSeqA);
      expect(MarkovChain.clone(dtoSeqB, false)).toEqual(dtoSeqB);
      expect(MarkovChain.clone(dtoSeqC, false)).toEqual(dtoSeqC);

      // Stripping Sequences
      const defaultStripped = { ...dtoDefault, sequences: undefined };
      const seqAStripped = { ...dtoSeqA, sequences: undefined };
      const seqBStripped = { ...dtoSeqB, sequences: undefined };
      const seqCStripped = { ...dtoSeqC, sequences: undefined };

      expect(MarkovChain.clone(dtoDefault, true)).toEqual(defaultStripped);
      expect(MarkovChain.clone(dtoSeqA, true)).toEqual(seqAStripped);
      expect(MarkovChain.clone(dtoSeqB, true)).toEqual(seqBStripped);
      expect(MarkovChain.clone(dtoSeqC, true)).toEqual(seqCStripped);
    });
    it('can add sequences to existing markov chains', () => {
      // Single Sequence with Cloning
      expect(MarkovChain.addSequence(dtoEmpty, sequenceUnitA, true)).toEqual(
        dtoUnitA
      );
      expect(MarkovChain.addSequence(dtoSeqA, sequenceUnitA, true)).toEqual(
        dtoSeqUA
      );

      // Single Sequence without Cloning
      const dtoCloneEU = MarkovChain.clone(dtoEmpty) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneEU, sequenceUnitA, false);
      expect(dtoCloneEU).toEqual(dtoUnitA);

      const dtoCloneUnitAB = MarkovChain.clone(
        dtoUnitA
      ) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneUnitAB, sequenceUnitB, false);
      expect(dtoCloneUnitAB).toEqual(dtoUnitAB);

      const dtoCloneAB = MarkovChain.clone(dtoEmpty) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneAB, sequenceA1, false);
      MarkovChain.addSequence(dtoCloneAB, sequenceA2, false);
      expect(dtoCloneAB).toEqual(dtoSeqA);
      MarkovChain.addSequence(dtoCloneAB, sequenceB1, false);
      MarkovChain.addSequence(dtoCloneAB, sequenceB2, false);
      expect(dtoCloneAB).toEqual(dtoSeqAB);

      // Multiple Sequences with Cloning
      expect(MarkovChain.addSequences(dtoEmpty, sequencesA, true)).toEqual(
        dtoSeqA
      );
      expect(MarkovChain.addSequences(dtoSeqA, sequencesB, true)).toEqual(
        dtoSeqAB
      );

      // Multiple Sequences without Cloning
      const dtoCloneABC = MarkovChain.clone(dtoEmpty) as MarkovChainSequenceDTO;
      MarkovChain.addSequences(dtoCloneABC, sequencesA, false);
      expect(dtoCloneABC).toEqual(dtoSeqA);
      MarkovChain.addSequences(dtoCloneABC, sequencesB, false);
      expect(dtoCloneABC).toEqual(dtoSeqAB);
      MarkovChain.addSequences(dtoCloneABC, sequencesC, false);
      expect(dtoCloneABC).toEqual(dtoSeqABC);
    });
    /* it('can add an edge to an existing markov chain', () => {

    }) */
  });

  describe('class methods', () => {});
});

test('Markov Chains can be created functionally.', () => {});
