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

// Order Maze
const sequenceD1 = ['x', 'y', 'z', 'a', 'w'];
const sequenceD2 = ['a', 'b'];

// Sequences
const sequencesUnitAB = [sequenceUnitA, sequenceUnitB];

const sequencesA = [sequenceA1, sequenceA2];
const sequencesB = [sequenceB1, sequenceB2];
const sequencesC = [
  sequenceC1a,
  sequenceC2a,
  sequenceC3a,
  // sequenceC4a,
  // sequenceC5a,
];
const sequencesD = [sequenceD1, sequenceD2];
for (let i = 0; i < 1000; i += 1) {
  sequencesD.push(sequenceD2);
}

const sequencesAB = [...sequencesA, ...sequencesB];
const sequencesABC = [...sequencesAB, ...sequencesC];

// DTOs
const dtoDefault = {
  maxOrder: CONSTANTS.MC_MAX_ORDER_DEFAULT,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
  sequences: [],
  grams: {},
};

const dtoMin = {
  sequences: [],
  grams: {},
};

// Unit DTOs
const dtoUnitEmpty = MarkovChain.new(undefined, 1);
const dtoUnitA = MarkovChain.new([sequenceUnitA], 1);
const dtoUnitB = MarkovChain.new([sequenceUnitB], 1);
const dtoUnitAB = MarkovChain.new(sequencesUnitAB, 1);

// Standard DTOs
// const dtoEmpty = MarkovChain.new();

const dtoUA = MarkovChain.new([sequenceUnitA]);
const dtoUB = MarkovChain.new([sequenceUnitB]);
const dtoUAB = MarkovChain.new(sequencesUnitAB);

const dtoA1 = MarkovChain.new([sequenceA1]);
const dtoSeqA = MarkovChain.new(sequencesA);
const dtoSeqALoop = MarkovChain.new(sequencesA, CONSTANTS.MC_MAX_ORDER_DEFAULT, 'middle');
const dtoSeqB = MarkovChain.new(sequencesB);
const dtoSeqC = MarkovChain.new(sequencesC);
const dtoSeqD = MarkovChain.new(sequencesD);
const dtoSeqAB = MarkovChain.new(sequencesAB);
const dtoSeqABC = MarkovChain.new(sequencesABC);

/**
 # Tests
 */

describe('Markov Chain', () => {
  describe('static methods', () => {
    it('can create new markov chains.', () => {
      // Default
      const dtoEmpty = MarkovChain.new();
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
        if (dtoSeqA.maxOrder !== undefined) expect(gram.order).toBeLessThanOrEqual(dtoSeqA.maxOrder);
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
        if (dtoUnitAB.maxOrder !== undefined) expect(gram.order).toBeLessThanOrEqual(dtoUnitAB.maxOrder);
        expect(Object.keys(gram.next).length).toBeGreaterThan(0);
        expect(Object.keys(gram.last).length).toBeGreaterThan(0);
      });
    });
    it('can clone existing markov chains', () => {
      // Direct Clones
      expect(MarkovChain.clone(MarkovChain.new(), false)).toEqual(dtoDefault);
      expect(MarkovChain.clone(dtoDefault, false)).toEqual(dtoDefault);
      expect(MarkovChain.clone(dtoMin, false)).toEqual(dtoMin);
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
      cloneB.sequences = cloneB.sequences ? [...cloneB.sequences, ['x']] : [['x']];
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
      expect(MarkovChain.addSequence(dtoDefault, sequenceUnitA, false, true)).toEqual(dtoUA);
      expect(MarkovChain.addSequence(dtoUA, sequenceUnitB, false, true)).toEqual(dtoUAB);
      expect(MarkovChain.addSequence(dtoDefault, sequenceA1, false, true)).toEqual(dtoA1);
      expect(MarkovChain.addSequence(dtoA1, sequenceA2, false, true)).toEqual(dtoSeqA);

      // Single Sequence without Cloning
      const dtoCloneSeqA = MarkovChain.clone(dtoDefault) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneSeqA, sequenceA1, false, false);
      expect(dtoCloneSeqA).toEqual(dtoA1);
      MarkovChain.addSequence(dtoCloneSeqA, sequenceA2, false, false);
      expect(dtoCloneSeqA).toEqual(dtoSeqA);

      const dtoCloneSeqAB = MarkovChain.clone(dtoDefault) as MarkovChainSequenceDTO;
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceA1, false, false);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceA2, false, false);
      expect(dtoCloneSeqAB).toEqual(dtoSeqA);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceB1, false, false);
      MarkovChain.addSequence(dtoCloneSeqAB, sequenceB2, false, false);
      expect(dtoCloneSeqAB).toEqual(dtoSeqAB);

      // Multiple Sequences with Cloning
      expect(MarkovChain.addSequences(dtoDefault, sequencesA, false, true)).toEqual(dtoSeqA);
      expect(MarkovChain.addSequences(dtoSeqA, sequencesB, false, true)).toEqual(dtoSeqAB);

      // Multiple Sequences without Cloning
      const dtoCloneABC = MarkovChain.clone(dtoDefault) as MarkovChainSequenceDTO;
      MarkovChain.addSequences(dtoCloneABC, sequencesA, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqA);
      MarkovChain.addSequences(dtoCloneABC, sequencesB, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqAB);
      MarkovChain.addSequences(dtoCloneABC, sequencesC, false, false);
      expect(dtoCloneABC).toEqual(dtoSeqABC);
    });
    it('can insert sequences into an existing markov chain', () => {
      // Middle with Cloning
      const dtoInsertMiddleA = MarkovChain.new([sequenceA1, sequenceA2], 2, true);
      const dtoInsertMiddleB = MarkovChain.new([sequenceA1, sequenceA2], 2, 'middle');
      expect(dtoInsertMiddleA).toEqual(dtoInsertMiddleB);
      expect(dtoInsertMiddleA).not.toEqual(dtoSeqA);
      expect(dtoInsertMiddleB).not.toEqual(dtoSeqA);
      expect(MarkovChain.getGram(dtoInsertMiddleA, [CONSTANTS.MC_START_DELIMITER])).toBeUndefined();
      expect(MarkovChain.getGram(dtoInsertMiddleA, [CONSTANTS.MC_END_DELIMITER])).toBeUndefined();

      // Middle without Cloning
      const dtoInsertMiddleA2 = MarkovChain.new();

      // Start
      const dtoInsertStart = MarkovChain.new([sequenceA1, sequenceA2], 2, 'start');
      expect(dtoInsertStart).not.toEqual(dtoSeqA);
      expect(MarkovChain.getGram(dtoInsertStart, [CONSTANTS.MC_START_DELIMITER])).toBeDefined();
      expect(MarkovChain.getGram(dtoInsertStart, [CONSTANTS.MC_END_DELIMITER])).toBeUndefined();

      // End
      const dtoInsertEnd = MarkovChain.new([sequenceA1, sequenceA2], 2, 'end');
      expect(dtoInsertEnd).not.toEqual(dtoSeqA);
      expect(MarkovChain.getGram(dtoInsertEnd, [CONSTANTS.MC_START_DELIMITER])).toBeUndefined();
      expect(MarkovChain.getGram(dtoInsertEnd, [CONSTANTS.MC_END_DELIMITER])).toBeDefined();
    });
    it('can add an edge to an existing markov chain', () => {
      // Adding an edge with Cloning
      let dtoUnitABCloneIterative = MarkovChain.clone(dtoUnitA, true) as MarkovChainSequenceDTO;
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
      expect(dtoUnitABCloneIterative).toEqual(MarkovChain.clone(dtoUnitAB, true));

      // Adding an edge without Cloning
      dtoUnitABCloneIterative = MarkovChain.clone(dtoUnitA, true) as MarkovChainSequenceDTO;
      MarkovChain.addEdge(dtoUnitABCloneIterative, CONSTANTS.MC_START_DELIMITER, undefined, 'b', 1, false);
      MarkovChain.addEdge(
        dtoUnitABCloneIterative,
        'b',
        CONSTANTS.MC_START_DELIMITER,
        CONSTANTS.MC_END_DELIMITER,
        1,
        false
      );
      MarkovChain.addEdge(dtoUnitABCloneIterative, CONSTANTS.MC_END_DELIMITER, 'b', undefined, 1, false);
      // We need to strip sequences, because this function does not update them.
      expect(dtoUnitABCloneIterative).toEqual(MarkovChain.clone(dtoUnitAB, true));
    });
    it('can pick values from the chain', () => {
      // Next
      const engA = new Random({ ...engineA.serialize() });
      const pickAN = MarkovChain.pick(engA, dtoSeqB, ['a'], true, undefined);
      const pickBN = MarkovChain.pick(engA, dtoSeqB, ['b'], true, undefined);
      const pickCN = MarkovChain.pick(engA, dtoSeqB, ['a', 'b'], true, undefined);
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
      const pickCL = MarkovChain.pick(engA, dtoSeqB, ['b', 'c'], false, undefined);

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
        const pickM = MarkovChain.pick(engA, dtoSeqC, ['ocean', 'beach'], true, ['forest', 'plains']);
        expect(pickM).toBe('town');
      }
    });
    it('can generate sequences from a chain', () => {
      const engA = new Random({ ...engineA.serialize() });

      // Trim
      const genTrimTrue = MarkovChain.generate(engA, dtoA1, [], 1, 1, 25, true, true);
      expect(genTrimTrue[0] !== CONSTANTS.MC_START_DELIMITER).toEqual(true);
      expect(genTrimTrue[genTrimTrue.length - 1] !== CONSTANTS.MC_END_DELIMITER).toEqual(true);

      const genTrimFalse = MarkovChain.generate(engA, dtoA1, [], 1, 1, 25, true, false);
      expect(genTrimFalse[0] === CONSTANTS.MC_START_DELIMITER).toEqual(true);
      expect(genTrimFalse[genTrimFalse.length - 1] === CONSTANTS.MC_END_DELIMITER).toEqual(true);

      const genTrimTrueLength = MarkovChain.generate(engA, dtoSeqA, ['a'], 1, 25, 25, true, true);

      const genTrimFalseLength = MarkovChain.generate(engA, dtoSeqA, ['a'], 1, 25, 25, true, false);

      expect(genTrimTrueLength.length).toEqual(25);
      expect(genTrimFalseLength.length).toEqual(25 + 2);

      // From Start
      const genSA = MarkovChain.generate(engA, dtoA1, [], 1, 1, 25, true, true);

      // From Prepopulated

      // Strict Order 1 & n
      const genO1Dist = { w: 0, b: 0, error: 0 };
      for (let i = 0; i < 1000; i += 1) {
        // It shouldn't be possible to get final result 'b' if we're using greater than order 1.
        const genO1 = MarkovChain.generate(engA, dtoSeqD, ['x'], 1, 1, 25, true, true);
        if (genO1 !== undefined) {
          const result = genO1.pop();
          switch (result) {
            case 'w':
              genO1Dist.w += 1;
              break;
            case 'b':
              genO1Dist.b += 1;
              break;
            default:
              genO1Dist.error += 1;
              break;
          }
        } else {
          genO1Dist.error += 1;
        }
      }

      expect(genO1Dist.w).toBeLessThan(genO1Dist.b);
      expect(genO1Dist.b).toBeGreaterThan(990);
      expect(genO1Dist.error).toEqual(0);

      // Strict Order n
      const genONDist = { w: 0, b: 0, error: 0 };
      for (let i = 0; i < 1000; i += 1) {
        // It shouldn't be possible to get final result 'b' if we're using greater than order 1.
        const genON = MarkovChain.generate(engA, dtoSeqD, ['x'], 4, 1, 25, true, true);
        if (genON !== undefined) {
          const result = genON.pop();
          switch (result) {
            case 'w':
              genONDist.w += 1;
              break;
            case 'b':
              genONDist.b += 1;
              break;
            default:
              genONDist.error += 1;
              break;
          }
        } else {
          genONDist.error += 1;
        }
      }

      expect(genONDist.w).toEqual(1000);
      expect(genONDist.b).toEqual(0);
      expect(genONDist.error).toEqual(0);

      // Variable Order (Non-Strict)
      const genOVDistA = { w: 0, b: 0, error: 0 };
      const genOVDistB = { w: 0, b: 0, error: 0 };
      for (let i = 0; i < 1000; i += 1) {
        // It shouldn't be possible to get final result 'b' if we're using greater than order 1,
        // but we can use the starting sequence to force down to order 1.
        const genOVA = MarkovChain.generate(engA, dtoSeqD, ['x', 'y', 'a'], 4, 1, 25, false, true);
        if (genOVA !== undefined) {
          const result = genOVA.pop();
          switch (result) {
            case 'w':
              genOVDistA.w += 1;
              break;
            case 'b':
              genOVDistA.b += 1;
              break;
            default:
              genOVDistA.error += 1;
              break;
          }
        } else {
          genOVDistA.error += 1;
        }

        const genOVB = MarkovChain.generate(engA, dtoSeqD, ['x'], 4, 1, 25, false, true);
        if (genOVB !== undefined) {
          const result = genOVB.pop();
          switch (result) {
            case 'w':
              genOVDistB.w += 1;
              break;
            case 'b':
              genOVDistB.b += 1;
              break;
            default:
              genOVDistB.error += 1;
              break;
          }
        } else {
          genOVDistB.error += 1;
        }
      }

      expect(genOVDistA.w).toBeLessThan(genOVDistA.b);
      expect(genOVDistA.b).toBeGreaterThan(990);
      expect(genOVDistA.error).toEqual(0);

      expect(genOVDistB.w).toEqual(1000);
      expect(genOVDistB.b).toEqual(0);
      expect(genOVDistB.error).toEqual(0);
      // console.log(genO1Dist);
      // console.log(genONDist);
      // console.log(genOVDistA);
      // console.log(genOVDistB);

      // Infinite Loops & Min / Max Length
      for (let i = 1; i < 200; i += 1) {
        const genMaxA = MarkovChain.generate(engA, dtoSeqALoop, ['a'], 1, 1, i, true, true);
        expect(genMaxA.length).toEqual(i);

        const genMinA = MarkovChain.generate(engA, dtoSeqA, ['a'], 1, i, i + 100, true, true);
        expect(genMinA.length >= i).toEqual(true);
      }

      // Mask
    });
  });

  describe('class methods', () => {});
});

test('Markov Chains can be created functionally.', () => {});
