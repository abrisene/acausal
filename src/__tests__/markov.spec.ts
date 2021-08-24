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

// Sequence
const sequenceUnitA = ['a'];
const sequenceUnitB = ['b'];

const sequenceA1 = ['a', 'b'];
const sequenceA2 = ['b', 'a'];

const sequenceB1 = ['a', 'b', 'c'];
const sequenceB2 = ['a', 'b', 'd'];

// Maze
const sequenceC1a = ['ocean', 'beach', 'forest'];
const sequenceC2a = ['ocean', 'beach', 'plains'];
const sequenceC3a = ['ocean', 'beach', 'town'];
// const sequenceC4a = ['desert', 'mesa'];
// const sequenceC5a = ['desert', 'mountains'];

const sequenceC1b = ['ocean', 'beach', 'forest'];
const sequenceC2b = ['beach', 'plains'];
const sequenceC3b = ['beach', 'town'];
// const sequenceC4b = ['desert', 'mesa'];
// const sequenceC5b = ['desert', 'mountains'];

// Sequences
const sequencesUnitAB = [sequenceUnitA, sequenceUnitB];

const sequencesA = [sequenceA1, sequenceA2];
const sequencesB = [sequenceB1, sequenceB2];
const sequencesCa = [
  sequenceC1a,
  sequenceC2a,
  sequenceC3a,
  // sequenceC4a,
  // sequenceC5a,
];

const sequencesAB = [...sequencesA, ...sequencesB];
const sequencesABC = [...sequencesAB, ...sequencesCa];

// DTOs
const dtoDefault = {
  maxOrder: CONSTANTS.MC_MAX_ORDER_DEFAULT,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
  sequences: [],
  grams: {},
};

// Unit DTOs
const dtoUnitEmpty = MarkovChain.new(undefined, 1);
const dtoUnitA = MarkovChain.new([sequenceUnitA], 1);
const dtoUnitB = MarkovChain.new([sequenceUnitB], 1);
const dtoUnitAB = MarkovChain.new(sequencesUnitAB, 1);

// Standard DTOs
const dtoEmpty = MarkovChain.new();
const dtoUA = MarkovChain.new([sequenceUnitA]);
const dtoUB = MarkovChain.new([sequenceUnitB]);
const dtoUAB = MarkovChain.new(sequencesUnitAB);

const dtoA1 = MarkovChain.new([sequenceA1]);
const dtoSeqA = MarkovChain.new(sequencesA);
const dtoSeqB = MarkovChain.new(sequencesB);
const dtoSeqC = MarkovChain.new(sequencesCa);
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
      expect(dtoEmpty.maxOrder).toEqual(CONSTANTS.MC_MAX_ORDER_DEFAULT);
      expect(dtoEmpty.delimiter).toEqual(CONSTANTS.MC_GRAM_DELIMITER);
      expect(dtoEmpty.startDelimiter).toEqual(CONSTANTS.MC_START_DELIMITER);
      expect(dtoEmpty.endDelimiter).toEqual(CONSTANTS.MC_END_DELIMITER);
      expect(dtoEmpty.sequences).toEqual([]);
      expect(dtoEmpty.grams).toEqual({});

      // With Values
      expect(dtoSeqA).toHaveProperty('maxOrder');
      expect(dtoSeqA).toHaveProperty('delimiter');
      expect(dtoSeqA).toHaveProperty('startDelimiter');
      expect(dtoSeqA).toHaveProperty('endDelimiter');
      expect(dtoSeqA).toHaveProperty('sequences');
      expect(dtoSeqA).toHaveProperty('grams');
      expect(dtoSeqA.maxOrder).toEqual(CONSTANTS.MC_MAX_ORDER_DEFAULT);
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

      // With Max Order Defined
      expect(dtoUnitAB).toHaveProperty('maxOrder');
      expect(dtoUnitAB).toHaveProperty('delimiter');
      expect(dtoUnitAB).toHaveProperty('startDelimiter');
      expect(dtoUnitAB).toHaveProperty('endDelimiter');
      expect(dtoUnitAB).toHaveProperty('sequences');
      expect(dtoUnitAB).toHaveProperty('grams');
      expect(dtoUnitAB.maxOrder).toEqual(1);
      expect(dtoUnitAB.delimiter).toEqual(CONSTANTS.MC_GRAM_DELIMITER);
      expect(dtoUnitAB.startDelimiter).toEqual(CONSTANTS.MC_START_DELIMITER);
      expect(dtoUnitAB.endDelimiter).toEqual(CONSTANTS.MC_END_DELIMITER);
      expect(dtoUnitAB.sequences).toEqual(sequencesUnitAB);

      Object.keys(dtoUnitAB.grams).forEach(k => {
        const gram = dtoUnitAB.grams[k];
        expect(gram).toHaveProperty('id');
        expect(gram).toHaveProperty('order');
        expect(gram).toHaveProperty('last');
        expect(gram).toHaveProperty('next');
        expect(gram).toHaveProperty('degreeIn');
        expect(gram).toHaveProperty('degreeOut');
        expect(gram).toHaveProperty('frequency');

        expect(gram.id).toEqual(k);
        expect(gram.order).toBeGreaterThan(0);
        if (dtoUnitAB.maxOrder !== undefined)
          expect(gram.order).toBeLessThanOrEqual(dtoUnitAB.maxOrder);
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
    it('creates immutable clones', () => {
      const cloneA = MarkovChain.new([sequenceUnitB], 4);
      const cloneB = MarkovChain.clone(cloneA);
      const cloneC = MarkovChain.clone(cloneB);

      cloneB.seed = 50;
      cloneB.uses = 250;
      cloneB.maxOrder = 10;
      cloneB.delimiter = '.';
      cloneB.startDelimiter = '>>';
      cloneB.endDelimiter = '<<';
      cloneB.sequences = cloneB.sequences
        ? [...cloneB.sequences, ['x']]
        : [['x']];
      cloneB.grams.xk = {
        id: '-.-.-.-',
        last: { source: {}, normal: {} },
        next: { source: {}, normal: {} },
        order: 4,
        frequency: 0,
        degreeIn: 0,
        degreeOut: 0,
      };

      expect(cloneA).toEqual(dtoUB);
      expect(cloneB).toHaveProperty('grams.xk');
      expect(cloneC).toEqual(cloneA);
    });
    it('can add sequences to existing markov chains', () => {
      // Single Sequence with Cloning
      expect(
        MarkovChain.addSequence(dtoEmpty, sequenceUnitA, false, true)
      ).toEqual(dtoUA);
      expect(
        MarkovChain.addSequence(dtoUA, sequenceUnitB, false, true)
      ).toEqual(dtoUAB);
      expect(
        MarkovChain.addSequence(dtoEmpty, sequenceA1, false, true)
      ).toEqual(dtoA1);
      expect(MarkovChain.addSequence(dtoA1, sequenceA2, false, true)).toEqual(
        dtoSeqA
      );

      // Single Sequence without Cloning
      const dtoCloneSeqA = MarkovChain.clone(
        dtoEmpty
      ) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneSeqA, sequenceA1, false, false);
      expect(dtoCloneSeqA).toEqual(dtoA1);
      MarkovChain.addSequence(dtoCloneSeqA, sequenceA2, false, false);
      expect(dtoCloneSeqA).toEqual(dtoSeqA);

      const dtoCloneSeqAB = MarkovChain.clone(
        dtoEmpty
      ) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceA1, false, false);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceA2, false, false);
      expect(dtoCloneSeqAB).toEqual(dtoSeqA);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceB1, false, false);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceB2, false, false);
      expect(dtoCloneSeqAB).toEqual(dtoSeqAB);

      // Multiple Sequences with Cloning
      expect(
        MarkovChain.addSequences(dtoEmpty, sequencesA, false, true)
      ).toEqual(dtoSeqA);
      expect(
        MarkovChain.addSequences(dtoSeqA, sequencesB, false, true)
      ).toEqual(dtoSeqAB);

      // Multiple Sequences without Cloning
      const dtoCloneABC = MarkovChain.clone(dtoEmpty) as MarkovChainSequenceDTO;
      MarkovChain.addSequences(dtoCloneABC, sequencesA, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqA);
      MarkovChain.addSequences(dtoCloneABC, sequencesB, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqAB);
      MarkovChain.addSequences(dtoCloneABC, sequencesCa, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqABC);

      // TODO - TEST INSERTION
    });
    it('can insert sequences into an existing markov chain', () => {
      // Middle
      const dtoInsertMiddleA = MarkovChain.new(
        [sequenceA1, sequenceA2],
        2,
        true
      );
      const dtoInsertMiddleB = MarkovChain.new(
        [sequenceA1, sequenceA2],
        2,
        'middle'
      );
      expect(dtoInsertMiddleA).toEqual(dtoInsertMiddleB);
      expect(dtoInsertMiddleA).not.toEqual(dtoSeqA);
      expect(dtoInsertMiddleB).not.toEqual(dtoSeqA);
      expect(
        MarkovChain.getGram(dtoInsertMiddleA, [CONSTANTS.MC_START_DELIMITER])
      ).toBeUndefined();
      expect(
        MarkovChain.getGram(dtoInsertMiddleA, [CONSTANTS.MC_END_DELIMITER])
      ).toBeUndefined();

      // Start
      const dtoInsertStart = MarkovChain.new(
        [sequenceA1, sequenceA2],
        2,
        'start'
      );
      expect(dtoInsertStart).not.toEqual(dtoSeqA);
      expect(
        MarkovChain.getGram(dtoInsertStart, [CONSTANTS.MC_START_DELIMITER])
      ).toBeDefined();
      expect(
        MarkovChain.getGram(dtoInsertStart, [CONSTANTS.MC_END_DELIMITER])
      ).toBeUndefined();

      // End
      const dtoInsertEnd = MarkovChain.new([sequenceA1, sequenceA2], 2, 'end');
      expect(dtoInsertEnd).not.toEqual(dtoSeqA);
      expect(
        MarkovChain.getGram(dtoInsertEnd, [CONSTANTS.MC_START_DELIMITER])
      ).toBeUndefined();
      expect(
        MarkovChain.getGram(dtoInsertEnd, [CONSTANTS.MC_END_DELIMITER])
      ).toBeDefined();
    });
    it('can add an edge to an existing markov chain', () => {
      // Adding an edge with Cloning
      let dtoUnitABCloneIterative = MarkovChain.clone(
        dtoUnitA,
        true
      ) as MarkovChainSequenceDTO;
      dtoUnitABCloneIterative = MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        CONSTANTS.MC_START_DELIMITER,
        undefined,
        'b',
        1,
        true
      );
      dtoUnitABCloneIterative = MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        'b',
        CONSTANTS.MC_START_DELIMITER,
        CONSTANTS.MC_END_DELIMITER,
        1,
        true
      );
      dtoUnitABCloneIterative = MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        CONSTANTS.MC_END_DELIMITER,
        'b',
        undefined,
        1,
        true
      );
      // We need to strip sequences, because this function does not update them.
      expect(dtoUnitABCloneIterative).toEqual(
        MarkovChain.clone(dtoUnitAB, true)
      );

      // Adding an edge without Cloning
      dtoUnitABCloneIterative = MarkovChain.clone(
        dtoUnitA,
        true
      ) as MarkovChainSequenceDTO;
      MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        CONSTANTS.MC_START_DELIMITER,
        undefined,
        'b',
        1,
        false
      );
      MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        'b',
        CONSTANTS.MC_START_DELIMITER,
        CONSTANTS.MC_END_DELIMITER,
        1,
        false
      );
      MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        CONSTANTS.MC_END_DELIMITER,
        'b',
        undefined,
        1,
        false
      );
      // We need to strip sequences, because this function does not update them.
      expect(dtoUnitABCloneIterative).toEqual(
        MarkovChain.clone(dtoUnitAB, true)
      );
    });
    it('can pick values from the chain', () => {
      // Next
      const engA = new Random({ ...engineA.serialize() });
      const pickAN = MarkovChain.pick(engA, dtoSeqB, ['a'], true, undefined);
      const pickBN = MarkovChain.pick(engA, dtoSeqB, ['b'], true, undefined);
      const pickCN = MarkovChain.pick(
        engA,
        dtoSeqB,
        ['a', 'b'],
        true,
        undefined
      );
      expect([sequenceB1[1], sequenceB2[1]]).toContain(pickAN);
      expect([sequenceB1[2], sequenceB2[2]]).toContain(pickBN);
      expect([sequenceB1[2], sequenceB2[2]]).toContain(pickCN);

      const nextA = MarkovChain.next(engA, dtoSeqB, ['a'], undefined);
      const nextB = MarkovChain.next(engA, dtoSeqB, ['b'], undefined);
      const nextC = MarkovChain.next(engA, dtoSeqB, ['a', 'b'], undefined);
      expect([sequenceB1[1], sequenceB2[1]]).toContain(nextA);
      expect([sequenceB1[2], sequenceB2[2]]).toContain(nextB);
      expect([sequenceB1[2], sequenceB2[2]]).toContain(nextC);

      // Last
      const pickAL = MarkovChain.pick(engA, dtoSeqB, ['b'], false, undefined);
      const pickBL = MarkovChain.pick(engA, dtoSeqB, ['c'], false, undefined);
      const pickCL = MarkovChain.pick(
        engA,
        dtoSeqB,
        ['b', 'c'],
        false,
        undefined
      );

      expect([sequenceB1[0], sequenceB2[0]]).toContain(pickAL);
      expect([sequenceB1[1], sequenceB2[1]]).toContain(pickBL);
      expect([sequenceB1[0], sequenceB2[0]]).toContain(pickCL);

      const lastA = MarkovChain.last(engA, dtoSeqB, ['b'], undefined);
      const lastB = MarkovChain.last(engA, dtoSeqB, ['c'], undefined);
      const lastC = MarkovChain.last(engA, dtoSeqB, ['b', 'c'], undefined);
      expect([sequenceB1[0], sequenceB2[0]]).toContain(lastA);
      expect([sequenceB1[1], sequenceB2[1]]).toContain(lastB);
      expect([sequenceB1[0], sequenceB2[0]]).toContain(lastC);

      // Masks
      for (let i = 0; i < 20; i += 1) {
        const pickM = MarkovChain.pick(
          engA,
          dtoSeqC,
          ['ocean', 'beach'],
          true,
          ['forest', 'plains']
        );
        expect(pickM).toBe('town');
      }
    });
    it('can generate sequences from a chain', () => {
      const engA = new Random({ ...engineA.serialize() });

      // Trim
      const genTrimTrue = MarkovChain.generate(
        engA,
        dtoA1,
        [],
        1,
        1,
        25,
        true,
        true
      );
      expect(genTrimTrue[0] !== CONSTANTS.MC_START_DELIMITER).toEqual(true);
      expect(
        genTrimTrue[genTrimTrue.length - 1] !== CONSTANTS.MC_END_DELIMITER
      ).toEqual(true);

      const genTrimFalse = MarkovChain.generate(
        engA,
        dtoA1,
        [],
        1,
        1,
        25,
        true,
        false
      );
      expect(genTrimFalse[0] === CONSTANTS.MC_START_DELIMITER).toEqual(true);
      expect(
        genTrimFalse[genTrimFalse.length - 1] === CONSTANTS.MC_END_DELIMITER
      ).toEqual(true);

      // From Start
      const genSA = MarkovChain.generate(engA, dtoA1, [], 1, 1, 25, true);
      // console.log(genSA);

      // From Prepopulated

      // Order 1

      // Order n

      // Min / Max Length

      // Infinite Loops & Min / Max Length
      const genIA = MarkovChain.generate(
        engA,
        dtoSeqA,
        [],
        1,
        1,
        25,
        true,
        true
      );
      // console.log(genIA);
      // console.log(genIA.length);
      // console.log(JSON.stringify(dtoSeqA));

      // Strict Order
    });
  });

  describe('class methods', () => {});
});

test('Markov Chains can be created functionally.', () => {});
