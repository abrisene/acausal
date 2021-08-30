/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

/**
 # Module Dependencies
 */

import { MarkovChain, MarkovChainDTO, MarkovChainGramDTO, GramDictionary, Random, CONSTANTS } from '..';
// import { MarkovChainSequenceDTO } from '../structures';

/**
 # Constants
 */

const defaultOptions = {
  maxOrder: 4,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
};

const defaultDTO: MarkovChainDTO = { ...defaultOptions, sequences: [], grams: {} };
const defaultDTO1 = { ...defaultDTO, maxOrder: 1, sequences: [], grams: {} };
const defaultDTO2 = { ...defaultDTO, maxOrder: 2, sequences: [], grams: {} };
const defaultDTO6 = { ...defaultDTO, maxOrder: 6, sequences: [], grams: {} };

const defaultGramDTO: MarkovChainGramDTO = { ...defaultOptions, grams: {} };
const defaultGramDTO1 = { ...defaultGramDTO, maxOrder: 1, grams: {} };
const defaultGramDTO2 = { ...defaultGramDTO, maxOrder: 2, grams: {} };
const defaultGramDTO6 = { ...defaultGramDTO, maxOrder: 6, grams: {} };

/**
 # Utility Functions
 */

function stripSequences(m: MarkovChainDTO) {
  const { sequences, ...dto } = m;
  return dto;
}

function validateDTO(m: MarkovChainDTO, ref = defaultDTO) {
  expect(Object.keys(m).sort()).toEqual(Object.keys(ref).sort());
  expect(m.maxOrder).toEqual(ref.maxOrder);
  expect(m.delimiter).toEqual(ref.delimiter);
  expect(m.startDelimiter).toEqual(ref.startDelimiter);
  // We don't check sequences or grams.
}

function validateInstance(m: MarkovChain, ref = defaultDTO) {
  const data = m.serialize();
  expect(m.maxOrder).toEqual(ref.maxOrder);
  expect(m.delimiter).toEqual(ref.delimiter);
  expect(m.startDelimiter).toEqual(ref.startDelimiter);
  expect(m).toHaveProperty('sequences');
  expect(m).toHaveProperty('grams');
  validateDTO(data, ref);
}

function validateGrams(m: MarkovChainDTO) {
  const grams = m.grams;
  Object.keys(grams).forEach(key => {
    const gram = grams[key];
    expect(gram).toHaveProperty('id');
    expect(gram.id).toEqual(key);
    expect(gram).toHaveProperty('last');
    expect(gram).toHaveProperty('next');
    expect(gram).toHaveProperty('order');
    expect(gram).toHaveProperty('frequency');
    expect(gram).toHaveProperty('degreeIn');
    expect(gram).toHaveProperty('degreeOut');

    const expectLSum = gram.degreeIn > 0 ? 1 : 0;
    const expectNSum = gram.degreeOut > 0 ? 1 : 0;

    expect(Object.values(gram.last.normal).reduce((a, b) => a + b, 0)).toBeCloseTo(expectLSum);

    expect(Object.values(gram.next.normal).reduce((a, b) => a + b, 0)).toBeCloseTo(expectNSum);

    expect(gram.order).toBeLessThanOrEqual(m.maxOrder);
    expect(gram.order).toBeGreaterThan(0);
    expect(gram.order).toEqual(gram.id.split(m.delimiter).length);
  });
}

/**
 # Test Constants
 */

// Engine
const engine = new Random({ seed: 25 });

// Gram Sequences
const gU1 = ['a'];
const gU2 = ['a', 'b'];
const gU3 = ['a', 'b', 'c'];

const gA1 = ['a', 'l', 'i', 'c', 'e'];
const gA2 = ['a', 'n', 'n', 'a'];
const gA3 = ['a', 'l', 'i', 's', 'a'];

const gB1 = ['a', 'b', 'c'];
const gB2 = ['1', '2', '3'];
const gB3 = ['@', '$', '%'];

const gC1 = ['a', '+', 'y'];
const gC2 = ['b', '+', 'z'];

// Sequences
const sU = [gU1, gU2, gU3];

const sA1 = [gA1];
const sA2 = [gA1, gA2];
const sA3 = [gA1, gA2, gA3];

const sB1 = [gB1];
const sB2 = [gB1, gB2];
const sB3 = [gB1, gB2, gB3];

// const sC1 = [gC1];
const sC2 = [gC1, gC2];

// DTOs

const dtoGU3IExpected = {
  ...defaultGramDTO2,
  grams: {
    a: {
      id: 'a',
      order: 1,
      last: { source: {}, normal: {} },
      next: { source: { b: 1 }, normal: { b: 1 } },
      degreeIn: 0,
      degreeOut: 1,
      frequency: 0,
    },
    b: {
      id: 'b',
      order: 1,
      last: { source: { a: 1 }, normal: { a: 1 } },
      next: { source: { c: 1 }, normal: { c: 1 } },
      degreeIn: 1,
      degreeOut: 1,
      frequency: 0,
    },
    c: {
      id: 'c',
      order: 1,
      last: { source: { b: 1 }, normal: { b: 1 } },
      next: { source: {}, normal: {} },
      degreeIn: 1,
      degreeOut: 0,
      frequency: 0,
    },
    'a⏐b': {
      id: 'a⏐b',
      order: 2,
      last: { source: {}, normal: {} },
      next: { source: { c: 1 }, normal: { c: 1 } },
      degreeIn: 0,
      degreeOut: 1,
      frequency: 0,
    },
    'b⏐c': {
      id: 'b⏐c',
      order: 2,
      last: { source: { a: 1 }, normal: { a: 1 } },
      next: { source: {}, normal: {} },
      degreeIn: 1,
      degreeOut: 0,
      frequency: 0,
    },
  },
};

const dtoU = MarkovChain.new(sU);
const dtoGU = MarkovChain.new(sU, defaultOptions.maxOrder, false, true);
const dto6U = MarkovChain.new(sU, 6, false, false);
const dto6GU = MarkovChain.new(sU, 6, false, true);

const dtoA1 = MarkovChain.new(sA1);
const dtoA2 = MarkovChain.new(sA2);
const dtoA3 = MarkovChain.new(sA3);

const dtoB1 = MarkovChain.new(sB1);
const dtoB2 = MarkovChain.new(sB2);
const dtoB3 = MarkovChain.new(sB3);

// const dtoIB1 = MarkovChain.new(sB1, 4, 'start');
// const dtoIB2 = MarkovChain.new(sB2, 4, 'middle');
// const dtoIB3 = MarkovChain.new(sB3, 4, 'end');

// const dtoC1 = MarkovChain.new(sC1);
const dtoC2 = MarkovChain.new(sC2);

/**
 # Tests
 */

describe('Markov Chain', () => {
  describe('static methods', () => {
    it('can create new markov chain', () => {
      // Empty DTO
      const mEmpty = MarkovChain.new();
      expect(mEmpty).toEqual(defaultDTO);

      // Default DTOs
      const mU1a = MarkovChain.new([gU1]);
      const mU2a = MarkovChain.new([gU2]);
      const mU3a = MarkovChain.new([gU3]);
      const mU4a = MarkovChain.new(sU);
      validateDTO(mU1a);
      validateDTO(mU2a);
      validateDTO(mU3a);
      validateDTO(mU4a);
      validateGrams(mU1a);
      validateGrams(mU2a);
      validateGrams(mU3a);
      validateGrams(mU4a);

      // With Max Order Set
      const mU1b = MarkovChain.new([gU1], 6, false, false);
      const mU2b = MarkovChain.new([gU2], 6, false, false);
      const mU3b = MarkovChain.new([gU3], 6, false, false);
      const mU4b = MarkovChain.new(sU, 6, false, false);
      validateDTO(mU1b, defaultDTO6);
      validateDTO(mU2b, defaultDTO6);
      validateDTO(mU3b, defaultDTO6);
      validateDTO(mU4b, defaultDTO6);
      validateGrams(mU1b);
      validateGrams(mU2b);
      validateGrams(mU3b);
      validateGrams(mU4b);

      // We test insertion later.

      // With Sequences Stripped
      const mU1c = MarkovChain.new([gU1], 4, false, true);
      const mU2c = MarkovChain.new([gU2], 4, false, true);
      const mU3c = MarkovChain.new([gU3], 4, false, true);
      const mU4c = MarkovChain.new(sU, 4, false, true);
      validateDTO(mU1c, defaultGramDTO);
      validateDTO(mU2c, defaultGramDTO);
      validateDTO(mU3c, defaultGramDTO);
      validateDTO(mU4c, defaultGramDTO);
      validateGrams(mU1c);
      validateGrams(mU2c);
      validateGrams(mU3c);
      validateGrams(mU4c);
    });
    it('can clone existing markov chains', () => {
      // Direct Clones
      expect(MarkovChain.clone(MarkovChain.new(), false)).toEqual(defaultDTO);
      expect(MarkovChain.clone(defaultDTO, false)).toEqual(defaultDTO);
      expect(MarkovChain.clone(defaultGramDTO, false)).toEqual(defaultGramDTO);
      expect(MarkovChain.clone(dtoU, false)).toEqual(dtoU);
      expect(MarkovChain.clone(dto6U, false)).toEqual(dto6U);
      expect(MarkovChain.clone(dtoGU, false)).toEqual(dtoGU);
      expect(MarkovChain.clone(dto6GU, false)).toEqual(dto6GU);

      // Clones with Sequences Stripped
      expect(MarkovChain.clone(MarkovChain.new(), true)).toEqual(stripSequences(defaultDTO));
      expect(MarkovChain.clone(defaultDTO, true)).toEqual(stripSequences(defaultDTO));
      expect(MarkovChain.clone(defaultGramDTO, true)).toEqual(stripSequences(defaultGramDTO));
      expect(MarkovChain.clone(dtoU, true)).toEqual(stripSequences(dtoU));
      expect(MarkovChain.clone(dto6U, true)).toEqual(stripSequences(dto6U));
      expect(MarkovChain.clone(dtoGU, true)).toEqual(stripSequences(dtoGU));
      expect(MarkovChain.clone(dto6GU, true)).toEqual(stripSequences(dto6GU));
    });
    it('create immutable clones', () => {
      const mA = MarkovChain.new(sU, 4, false, false);
      const mB = MarkovChain.clone(mA);
      const mC = MarkovChain.clone(mB);

      mB.seed = 50;
      mB.uses = 250;
      mB.maxOrder = 10;
      mB.delimiter = '.';
      mB.startDelimiter = '>>';
      mB.endDelimiter = '<<';
      mB.sequences = mB.sequences ? [...mB.sequences, ['x']] : [['x']];
      mB.grams.xk = {
        id: '-.-.-.-',
        last: { source: {}, normal: {} },
        next: { source: {}, normal: {} },
        order: 4,
        frequency: 0,
        degreeIn: 0,
        degreeOut: 0,
      };

      expect(mA).toEqual(dtoU);
      expect(mB).toHaveProperty('grams.xk');
      expect(mC).toEqual(mA);
    });
    it('can add an edge to an existing markov chain', () => {
      let m1 = MarkovChain.clone(defaultGramDTO2);
      m1 = MarkovChain.addEdge(m1, 'a', undefined, 'b');
      m1 = MarkovChain.addEdge(m1, 'b', 'a', 'c');
      m1 = MarkovChain.addEdge(m1, 'c', 'b', undefined);
      m1 = MarkovChain.addEdge(m1, ['a', 'b'], undefined, 'c');
      m1 = MarkovChain.addEdge(m1, ['b', 'c'], 'a', undefined);

      // DTO and edge degrees match expected results.
      expect(m1).toEqual(dtoGU3IExpected);
      expect(m1.grams.a.degreeOut).toBe(1);
      expect(m1.grams.a.degreeIn).toBe(0);
      expect(m1.grams.b.degreeOut).toBe(1);
      expect(m1.grams.b.degreeIn).toBe(1);
      expect(m1.grams.c.degreeOut).toBe(0);
      expect(m1.grams.c.degreeIn).toBe(1);

      let m2 = MarkovChain.addEdge(m1, 'x', undefined, 'b');
      m2 = MarkovChain.addEdge(m2, 'b', 'x', undefined);
      m2 = MarkovChain.addEdge(m2, 'b', undefined, 'a');
      m2 = MarkovChain.addEdge(m2, 'b', undefined, 'a');
      expect(m2.grams.b.degreeIn).toBe(2);
      expect(m2.grams.b.degreeOut).toBe(2);
    });
    /* it('can remove an edge from an existing markov chain', () => {}); */
    it('can add a sequence to an existing markov chain', () => {
      // Standard Addition
      const mA0 = MarkovChain.addSequence(defaultDTO, gA1);
      const mA1 = MarkovChain.addSequence(defaultDTO, gA1, false);
      const mA2 = MarkovChain.addSequence(mA1, gA2, false);
      const mA3 = MarkovChain.addSequence(mA2, gA3, false);
      expect(mA0).toEqual(dtoA1);
      expect(mA1).toEqual(dtoA1);
      expect(mA2).toEqual(dtoA2);
      expect(mA3).toEqual(dtoA3);
    });
    it('can insert a sequence into an existing markov chain', () => {
      // dtoGU3IExpected
      expect(MarkovChain.addSequence(defaultGramDTO2, gU3, true)).toEqual(dtoGU3IExpected);

      // Insertion
      const mIB1 = MarkovChain.addSequence(defaultDTO, gB1, 'start');
      const mIB2 = MarkovChain.addSequence(defaultDTO, gB1, 'middle');
      const mIB3 = MarkovChain.addSequence(defaultDTO, gB1, 'end');
      expect(Object.keys(mIB1.grams)).not.toContain(mIB1.endDelimiter);
      expect(Object.keys(mIB2.grams)).not.toContain([mIB2.startDelimiter, mIB2.endDelimiter]);
      expect(Object.keys(mIB3.grams)).not.toContain(mIB3.startDelimiter);
    });
    /* it('can remove a sequence to an existing markov chain', () => {}); */
    it('can add sequences to existing markov chains', () => {
      // Standard Addition
      const m0 = MarkovChain.addSequences(defaultDTO, sA3);
      const mA = MarkovChain.addSequences(defaultDTO, sA3, false);
      const mB = MarkovChain.addSequences(defaultDTO, sB3, false);
      expect(m0).toEqual(dtoA3);
      expect(mA).toEqual(dtoA3);
      expect(mB).toEqual(dtoB3);

      // Insertion
      const mIB1 = MarkovChain.addSequences(defaultDTO, sB3, 'start');
      const mIB2 = MarkovChain.addSequences(defaultDTO, sB3, 'middle');
      const mIB3 = MarkovChain.addSequences(defaultDTO, sB3, 'end');
      expect(Object.keys(mIB1.grams)).not.toContain(mIB1.endDelimiter);
      expect(Object.keys(mIB2.grams)).not.toContain([mIB2.startDelimiter, mIB2.endDelimiter]);
      expect(Object.keys(mIB3.grams)).not.toContain(mIB3.startDelimiter);
    });
    /* it('can remove sequences from existing markov chains', () => {}); */
    it('can pick values from a markov chain', () => {
      const eng = engine.clone();

      for (let i = 0; i < 20; i += 1) {
        // Standard Pick
        const pickStandard = MarkovChain.pick(eng, dtoB1);
        expect(pickStandard).toEqual(gB1[0]);

        // Next
        const pickSNext = MarkovChain.pick(eng, dtoB1, [gB1[0]]);
        const pickNext1 = MarkovChain.next(eng, dtoB1, [gB1[0]]);
        const pickNext2 = MarkovChain.next(eng, dtoC2, ['+']);
        expect(pickSNext).toEqual(gB1[1]);
        expect(pickNext1).toEqual(pickSNext);
        expect([gC1[2], gC2[2]]).toContain(pickNext2);

        // Last
        const pickSLast = MarkovChain.pick(eng, dtoB1, [gB1[1]], false);
        const pickLast = MarkovChain.last(eng, dtoB1, [gB1[1]]);
        const pickLast2 = MarkovChain.last(eng, dtoC2, ['+']);
        expect(pickSLast).toEqual(gB1[0]);
        expect(pickLast).toEqual(pickSLast);
        expect([gC1[0], gC2[0]]).toContain(pickLast2);

        // Masks
        const pickMask1 = MarkovChain.pick(eng, dtoC2, ['+'], true, ['a', 'y']);
        const pickMask2 = MarkovChain.next(eng, dtoC2, ['+'], ['a', 'y']);
        const pickMask3 = MarkovChain.last(eng, dtoC2, ['+'], ['a', 'y']);
        expect(pickMask1).toEqual('z');
        expect(pickMask2).toEqual(pickMask1);
        expect(pickMask3).toEqual('b');
      }
    });
    it('can generate sequences a markov chain', () => {
      const eng = engine.clone();
    });
    it('are immutable', () => {
      const mOriginal = MarkovChain.clone(dtoA3);
      const mClone = MarkovChain.clone(mOriginal);
      expect(mOriginal).toEqual(mClone);

      MarkovChain.addEdge(mClone, 'b', 'a', 'c');
      expect(mOriginal).toEqual(mClone);
      MarkovChain.addSequence(mClone, gB2);
      expect(mOriginal).toEqual(mClone);
      MarkovChain.addSequences(mClone, sB3);
      expect(mOriginal).toEqual(mClone);
    });
  });

  describe('class methods', () => {
    it('can create new markov chains', () => {
      const eng = engine.clone();

      // Empty
      const mE0 = new MarkovChain({});
      const mE1 = new MarkovChain({ ...defaultDTO });
      const mE2 = new MarkovChain({ ...defaultDTO, engine: eng });
      validateInstance(mE0);
      validateInstance(mE1);
      validateInstance(mE2);

      // Default DTOs
      const mU1a = new MarkovChain({ sequences: [gU1] });
      const mU2a = new MarkovChain({ sequences: [gU2] });
      const mU3a = new MarkovChain({ sequences: [gU3] });
      const mU4a = new MarkovChain({ sequences: sU });
      validateInstance(mU1a);
      validateInstance(mU2a);
      validateInstance(mU3a);
      validateInstance(mU4a);
      validateGrams(mU1a.serialize());
      validateGrams(mU2a.serialize());
      validateGrams(mU3a.serialize());
      validateGrams(mU4a.serialize());

      // With Max Order Set
      const mU1b = new MarkovChain({ sequences: [gU1], maxOrder: 6 });
      const mU2b = new MarkovChain({ sequences: [gU2], maxOrder: 6 });
      const mU3b = new MarkovChain({ sequences: [gU3], maxOrder: 6 });
      const mU4b = new MarkovChain({ sequences: sU, maxOrder: 6 });
      validateInstance(mU1b, defaultDTO6);
      validateInstance(mU2b, defaultDTO6);
      validateInstance(mU3b, defaultDTO6);
      validateInstance(mU4b, defaultDTO6);
      validateGrams(mU1b.serialize());
      validateGrams(mU2b.serialize());
      validateGrams(mU3b.serialize());
      validateGrams(mU4b.serialize());
    });
    it('can clone existing markov chains', () => {
      // Direct Clones
      const mA0 = new MarkovChain({}).clone();
      const mA1 = new MarkovChain(defaultDTO).clone();
      const mA2 = new MarkovChain(defaultGramDTO).clone();
      const mA3 = new MarkovChain(dtoU).clone();
      const mA4 = new MarkovChain(dto6U).clone();
      const mA5 = new MarkovChain(dtoGU).clone();
      const mA6 = new MarkovChain(dto6GU).clone();

      expect(mA0.serialize()).toEqual(defaultDTO);
      expect(mA1.serialize()).toEqual(defaultDTO);
      expect(mA2.serialize()).toEqual(defaultDTO); // Differs from Static
      expect(mA3.serialize()).toEqual(dtoU);
      expect(mA4.serialize()).toEqual(dto6U);
      expect(mA5.serialize()).toEqual(dtoGU);
      expect(mA6.serialize()).toEqual(dto6GU);

      // Clones with Sequences Stripped
      const mB0 = new MarkovChain({}).clone(true); // This won't work.
      const mB1 = new MarkovChain(defaultDTO).clone(true);
      const mB2 = new MarkovChain(defaultGramDTO).clone(true);
      const mB3 = new MarkovChain(dtoU).clone(true);
      const mB4 = new MarkovChain(dto6U).clone(true);
      const mB5 = new MarkovChain(dtoGU).clone(true);
      const mB6 = new MarkovChain(dto6GU).clone(true);

      // expect(mB0.serialize()).toEqual(stripSequences(defaultDTO));
      // expect(mB1.serialize()).toEqual(stripSequences(defaultDTO));
      // expect(mB2.serialize()).toEqual(stripSequences(defaultGramDTO));
      expect(mB3.serialize()).toEqual(stripSequences(dtoU));
      expect(mB4.serialize()).toEqual(stripSequences(dto6U));
      expect(mB5.serialize()).toEqual(stripSequences(dtoGU));
      expect(mB6.serialize()).toEqual(stripSequences(dto6GU));
    });
    it('create immutable clones', () => {
      const mA = new MarkovChain({ sequences: sU });
      const mB = mA.clone();
      const mC = mB.clone();
      mB.addSequences(sC2);
      expect(mA.serialize()).toEqual(dtoU);
      expect(mB.serialize()).not.toEqual(dtoU);
      expect(mC.serialize()).toEqual(dtoU);
      expect(mB.serialize()).not.toEqual(mA.serialize());
      expect(mB.serialize()).not.toEqual(mC.serialize());
    });
    it('can add an edge to an existing markov chain', () => {
      const m1 = new MarkovChain({ maxOrder: 2 });
      m1.addEdge('a', undefined, 'b');
      m1.addEdge('b', 'a', 'c');
      m1.addEdge('c', 'b', undefined);
      m1.addEdge(['a', 'b'], undefined, 'c');
      m1.addEdge(['b', 'c'], 'a', undefined);

      // DTO and edge degrees match expected results.
      expect(m1.serialize(true)).toEqual(dtoGU3IExpected);
      expect(m1.grams.a.degreeOut).toBe(1);
      expect(m1.grams.a.degreeIn).toBe(0);
      expect(m1.grams.b.degreeOut).toBe(1);
      expect(m1.grams.b.degreeIn).toBe(1);
      expect(m1.grams.c.degreeOut).toBe(0);
      expect(m1.grams.c.degreeIn).toBe(1);

      m1.addEdge('b', 'x', undefined);
      m1.addEdge('b', undefined, 'a');
      m1.addEdge('b', undefined, 'a');
      expect(m1.grams.b.degreeIn).toBe(2);
      expect(m1.grams.b.degreeOut).toBe(2);
    });
    /* it('can remove an edge from an existing markov chain', () => {}); */
    it('can add a sequence to an existing markov chain', () => {
      // Standard Addition
      const mA0 = new MarkovChain({ sequences: [] }).addSequence(gA1);
      const mA1 = new MarkovChain({ sequences: [] }).addSequence(gA1, false);
      const mA2 = new MarkovChain({ sequences: [] }).addSequence(gA1, false).addSequence(gA2);
      const mA = new MarkovChain({ sequences: [] }).addSequence(gA1, false).addSequence(gA2).addSequence(gA3);

      expect(mA0.serialize()).toEqual(dtoA1);
      expect(mA1.serialize()).toEqual(dtoA1);
      expect(mA2.serialize()).toEqual(dtoA2);
      expect(mA.serialize()).toEqual(dtoA3);
    });
    it('can insert a sequence into an existing markov chain', () => {
      expect(MarkovChain.addSequence(defaultGramDTO2, gU3, true)).toEqual(dtoGU3IExpected);

      // Insertion
      const mIB1 = new MarkovChain({ sequences: [] }).addSequence(gB1, 'start');
      const mIB2 = new MarkovChain({ sequences: [] }).addSequence(gB1, 'middle');
      const mIB3 = new MarkovChain({ sequences: [] }).addSequence(gB1, 'end');
      expect(Object.keys(mIB1.grams)).not.toContain(mIB1.endDelimiter);
      expect(Object.keys(mIB2.grams)).not.toContain([mIB2.startDelimiter, mIB2.endDelimiter]);
      expect(Object.keys(mIB3.grams)).not.toContain(mIB3.startDelimiter);
    });
    it('can add sequences to existing markov chains', () => {
      // Standard Addition
      const m0 = new MarkovChain({ sequences: [] }).addSequences(sA3);
      const mA = new MarkovChain({ sequences: [] }).addSequences(sA3, false);
      const mB = new MarkovChain({ sequences: [] }).addSequences(sB3, false);
      expect(m0.serialize()).toEqual(dtoA3);
      expect(mA.serialize()).toEqual(dtoA3);
      expect(mB.serialize()).toEqual(dtoB3);

      // Insertion
      const mIB1 = new MarkovChain({ sequences: [] }).addSequences(sB3, 'start');
      const mIB2 = new MarkovChain({ sequences: [] }).addSequences(sB3, 'middle');
      const mIB3 = new MarkovChain({ sequences: [] }).addSequences(sB3, 'end');
      expect(Object.keys(mIB1.grams)).not.toContain(mIB1.endDelimiter);
      expect(Object.keys(mIB2.grams)).not.toContain([mIB2.startDelimiter, mIB2.endDelimiter]);
      expect(Object.keys(mIB3.grams)).not.toContain(mIB3.startDelimiter);
    });
    it('can pick values from a markov chain', () => {
      const mB1 = new MarkovChain(dtoB1);
      const mC2 = new MarkovChain(dtoC2);

      for (let i = 0; i < 20; i += 1) {
        // Standard Pick
        const pickStandard = new MarkovChain(dtoB1).pick();
        expect(pickStandard).toEqual(gB1[0]);

        // Next
        const pickSNext = mB1.pick([gB1[0]]);
        const pickNext1 = mB1.next([gB1[0]]);
        const pickNext2 = mC2.next(['+']);
        expect(pickSNext).toEqual(gB1[1]);
        expect(pickNext1).toEqual(pickSNext);
        expect([gC1[2], gC2[2]]).toContain(pickNext2);

        // Last
        const pickSLast = mB1.pick([gB1[1]], false);
        const pickLast = mB1.last([gB1[1]]);
        const pickLast2 = mC2.last(['+']);
        expect(pickSLast).toEqual(gB1[0]);
        expect(pickLast).toEqual(pickSLast);
        expect([gC1[0], gC2[0]]).toContain(pickLast2);

        // Masks
        const pickMask1 = mC2.pick(['+'], true, ['a', 'y']);
        const pickMask2 = mC2.next(['+'], ['a', 'y']);
        const pickMask3 = mC2.last(['+'], ['a', 'y']);
        expect(pickMask1).toEqual('z');
        expect(pickMask2).toEqual(pickMask1);
        expect(pickMask3).toEqual('b');
      }
    });
    it('can generate sequences a markov chain', () => {});
  });
});
