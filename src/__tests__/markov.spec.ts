/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

/**
 # Module Dependencies
 */

import { MarkovChain, MarkovChainDTO, MarkovChainGramDTO, Random, CONSTANTS } from '..';
import { MCGeneratorOptions, MCDirectionOption, MCGeneratorStaticOptions } from '../structures';
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

const defaultGenOptions = {
  min: 1,
  max: 100,
  direction: 'next' as MCDirectionOption,
  strict: true,
  trim: true,
};

const defaultDTO: MarkovChainDTO = { ...defaultOptions, sequences: [], grams: {} };
// const defaultDTO1 = { ...defaultDTO, maxOrder: 1, sequences: [], grams: {} };
// const defaultDTO2 = { ...defaultDTO, maxOrder: 2, sequences: [], grams: {} };
const defaultDTO6 = { ...defaultDTO, maxOrder: 6, sequences: [], grams: {} };

const defaultGramDTO: MarkovChainGramDTO = { ...defaultOptions, grams: {} };
// const defaultGramDTO1 = { ...defaultGramDTO, maxOrder: 1, grams: {} };
const defaultGramDTO2 = { ...defaultGramDTO, maxOrder: 2, grams: {} };
// const defaultGramDTO6 = { ...defaultGramDTO, maxOrder: 6, grams: {} };

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
  expect(m.dto).toEqual(data);
  expect(m.model).toEqual(data);
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

function validateGen(model: MarkovChainDTO, output: string[], options: MCGeneratorOptions = defaultGenOptions) {
  expect(output).toBeDefined(); // If we're testing this, we expect it to be defined.
  if (output !== undefined) {
    expect(output.length).toBeGreaterThan(options.min || defaultGenOptions.min);
    expect(output.length).toBeLessThan(options.max || defaultGenOptions.max);

    if (options.trim) {
      expect(output.filter(v => v === model.startDelimiter || v === model.endDelimiter).length).toEqual(0);
    } else {
      // expect(output.filter(v => (v === model.startDelimiter || v === model.endDelimiter)).length).toBeGreaterThanOrEqual(1);
      expect(output.filter(v => v === model.startDelimiter || v === model.endDelimiter).length).toBeLessThanOrEqual(2);
    }
  }
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
// const sB2 = [gB1, gB2];
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
// const dtoB2 = MarkovChain.new(sB2);
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
    it('can pick values from a gram', () => {
      const eng = engine.clone();

      // Grams
      const gsBS = MarkovChain.findGram(dtoB1, [dtoB1.startDelimiter]);
      const gsB0 = MarkovChain.findGram(dtoB1, [gB1[0]]);
      const gsB1 = MarkovChain.findGram(dtoB1, [gB1[1]]);
      const gsC1 = MarkovChain.findGram(dtoC2, ['+']);

      for (let i = 0; i < 20; i += 1) {
        // Standard Pick
        const pickStandard = MarkovChain.pickGram(eng, gsBS);
        expect(pickStandard).toEqual(gB1[0]);

        // Next
        const pickSNext = MarkovChain.pickGram(eng, gsB0, true);
        expect(pickSNext).toEqual(gB1[1]);

        // Last
        const pickSLast = MarkovChain.pickGram(eng, gsB1, false);
        expect(pickSLast).toEqual(gB1[0]);

        // Masks
        const pickMask1 = MarkovChain.pickGram(eng, gsC1, true, ['a', 'y']);
        expect(pickMask1).toEqual('z');
      }
    });
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

      // Default
      const optD0: MCGeneratorStaticOptions = { model: dtoA3 };
      const optD1: MCGeneratorStaticOptions = { model: dtoA3, direction: 'last' };
      const optD2: MCGeneratorStaticOptions = { model: dtoA3, strict: false };
      const optD3: MCGeneratorStaticOptions = { model: dtoA3, trim: false };

      const genD0 = MarkovChain.generate(optD0);
      const genD1 = MarkovChain.generate(optD1); // Backward
      const genD2 = MarkovChain.generate(optD2); // Unstrict
      const genD3 = MarkovChain.generate(optD3); // Untrimmed

      expect(sA3.map(e => e.join())).toContain(genD0.join());
      expect(sA3.map(e => e.join())).toContain(genD1.join());
      expect(sA3.map(e => e.join())).toContain(genD2.join());
      validateGen(dtoA3, genD0, optD0);
      validateGen(dtoA3, genD1, optD1);
      validateGen(dtoA3, genD2, optD2);
      validateGen(dtoA3, genD3, optD3);

      // Starting Values
      const optS1: MCGeneratorStaticOptions = { model: dtoA3, engine: eng, start: ['a', 'n'] };
      const optS2: MCGeneratorStaticOptions = { model: dtoA3, engine: eng, start: ['n', 'a'], direction: 'last' };
      const optS3: MCGeneratorStaticOptions = { model: dtoA3, engine: eng, start: ['a'], mask: ['l'] };
      const optS4: MCGeneratorStaticOptions = { model: dtoA3, engine: eng, start: ['a', 'n'], order: 2 };

      const genS1 = MarkovChain.generate(optS1); // Forward
      const genS2 = MarkovChain.generate(optS2); // Backward
      const genS3 = MarkovChain.generate(optS3); // Masked
      const genS4 = MarkovChain.generate(optS4); // Order

      expect(genS1.join('')).toEqual('anna');
      expect(genS2.join('')).toEqual('anna');
      // expect(genS3.join('')).toEqual('anna');
      expect(genS4.join('')).toEqual('anna');
      validateGen(dtoA3, genS1, optS1);
      validateGen(dtoA3, genS2, optS2);
      validateGen(dtoA3, genS3, optS3);
      validateGen(dtoA3, genS4, optS4);

      // Non-Strict Cases
      const optN1: MCGeneratorStaticOptions = {
        model: dtoA3,
        engine: eng,
        start: ['a', 'a', 'a', 'n'],
        strict: false,
        order: 10,
      };
      const optN2: MCGeneratorStaticOptions = {
        model: dtoA3,
        engine: eng,
        start: ['n', 'a', 'a', 'a'],
        strict: false,
        order: 10,
        direction: 'last',
      };
      const optN3: MCGeneratorStaticOptions = { model: dtoA3, engine: eng, start: ['a', 'a', 'a', 'n'], strict: false };
      const optN4: MCGeneratorStaticOptions = {
        model: dtoA3,
        engine: eng,
        start: ['n', 'a', 'a', 'a'],
        strict: false,
        direction: 'last',
      };

      const genN1 = MarkovChain.generate(optN1); // Forward
      const genN2 = MarkovChain.generate(optN2); // Last
      const genN3 = MarkovChain.generate(optN3); // Forward (No Order)
      const genN4 = MarkovChain.generate(optN4); // Last (No Order)

      validateGen(dtoA3, genN1, optN1);
      validateGen(dtoA3, genN2, optN2);
      validateGen(dtoA3, genN3, optN3);
      validateGen(dtoA3, genN4, optN4);

      // Failure Cases
      const optF0: MCGeneratorStaticOptions = { model: dtoA3, start: ['x', 'y', 'z'] }; // Shouldn't find a Gram
      const optF1: MCGeneratorStaticOptions = { model: dtoA3, mask: ['a'] }; // All values should be masked.

      const genF0 = MarkovChain.generate(optF0);
      const genF1 = MarkovChain.generate(optF1);

      expect(genF0).toEqual(optF0.start);
      expect(genF1).toEqual([]);
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

      expect(mA0.dto).toEqual(defaultDTO);
      expect(mA1.dto).toEqual(defaultDTO);
      expect(mA2.dto).toEqual(defaultDTO); // Differs from Static
      expect(mA3.dto).toEqual(dtoU);
      expect(mA4.dto).toEqual(dto6U);
      expect(mA5.dto).toEqual(dtoGU);
      expect(mA6.dto).toEqual(dto6GU);

      // Clones with Sequences Stripped
      // const mB0 = new MarkovChain({}).clone(true); // This won't work.
      // const mB1 = new MarkovChain(defaultDTO).clone(true);
      // const mB2 = new MarkovChain(defaultGramDTO).clone(true);
      const mB3 = new MarkovChain(dtoU).clone(true);
      const mB4 = new MarkovChain(dto6U).clone(true);
      const mB5 = new MarkovChain(dtoGU).clone(true);
      const mB6 = new MarkovChain(dto6GU).clone(true);

      // expect(mB0.dto).toEqual(stripSequences(defaultDTO));
      // expect(mB1.dto).toEqual(stripSequences(defaultDTO));
      // expect(mB2.dto).toEqual(stripSequences(defaultGramDTO));
      expect(mB3.dto).toEqual(stripSequences(dtoU));
      expect(mB4.dto).toEqual(stripSequences(dto6U));
      expect(mB5.dto).toEqual(stripSequences(dtoGU));
      expect(mB6.dto).toEqual(stripSequences(dto6GU));
    });
    it('create immutable clones', () => {
      const mA = new MarkovChain({ sequences: sU });
      const mB = mA.clone();
      const mC = mB.clone();
      mB.addSequences(sC2);
      expect(mA.dto).toEqual(dtoU);
      expect(mB.dto).not.toEqual(dtoU);
      expect(mC.dto).toEqual(dtoU);
      expect(mB.dto).not.toEqual(mA.dto);
      expect(mB.dto).not.toEqual(mC.dto);
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

      expect(mA0.dto).toEqual(dtoA1);
      expect(mA1.dto).toEqual(dtoA1);
      expect(mA2.dto).toEqual(dtoA2);
      expect(mA.dto).toEqual(dtoA3);
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
      expect(m0.dto).toEqual(dtoA3);
      expect(mA.dto).toEqual(dtoA3);
      expect(mB.dto).toEqual(dtoB3);

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
    it('can generate sequences a markov chain', () => {
      const mA = new MarkovChain({ ...dtoA3, seed: engine.seed, uses: engine.uses });

      // Default
      const optD0: MCGeneratorOptions = {};
      const optD1: MCGeneratorOptions = { direction: 'last' };
      const optD2: MCGeneratorOptions = { strict: false };
      const optD3: MCGeneratorOptions = { trim: false };
      const genD0 = mA.generate(optD0);
      const genD1 = mA.generate(optD1); // Backward
      const genD2 = mA.generate(optD2); // Unstrict
      const genD3 = mA.generate(optD3); // Untrimmed

      expect(sA3.map(e => e.join())).toContain(genD0.join());
      expect(sA3.map(e => e.join())).toContain(genD1.join());
      expect(sA3.map(e => e.join())).toContain(genD2.join());
      validateGen(mA.dto, genD0, optD0);
      validateGen(mA.dto, genD1, optD1);
      validateGen(mA.dto, genD2, optD2);
      validateGen(mA.dto, genD3, optD3);

      // Starting Values
      const optS1: MCGeneratorOptions = { start: ['a', 'n'] };
      const optS2: MCGeneratorOptions = { start: ['n', 'a'], direction: 'last' };
      const optS3: MCGeneratorOptions = { start: ['a'], mask: ['l'] };
      const optS4: MCGeneratorOptions = { start: ['a', 'n'], order: 2 };

      const genS1 = mA.generate(optS1); // Forward
      const genS2 = mA.generate(optS2); // Backward
      const genS3 = mA.generate(optS3); // Masked
      const genS4 = mA.generate(optS4); // Order

      expect(genS1.join('')).toEqual('anna');
      expect(genS2.join('')).toEqual('anna');
      // expect(genS3.join('')).toEqual('anna');
      expect(genS4.join('')).toEqual('anna');
      validateGen(mA.dto, genS1, optS1);
      validateGen(mA.dto, genS2, optS2);
      validateGen(mA.dto, genS3, optS3);
      validateGen(mA.dto, genS4, optS4);

      // Non-Strict Cases
      const optN1: MCGeneratorOptions = { start: ['a', 'a', 'a', 'n'], strict: false, order: 10 };
      const optN2: MCGeneratorOptions = { start: ['n', 'a', 'a', 'a'], strict: false, order: 10, direction: 'last' };
      const optN3: MCGeneratorOptions = { start: ['a', 'a', 'a', 'n'], strict: false };
      const optN4: MCGeneratorOptions = { start: ['n', 'a', 'a', 'a'], strict: false, direction: 'last' };

      const genN1 = mA.generate(optN1); // Forward
      const genN2 = mA.generate(optN2); // Last
      const genN3 = mA.generate(optN3); // Forward (No Order)
      const genN4 = mA.generate(optN4); // Last (No Order)

      validateGen(mA.dto, genN1, optN1);
      validateGen(mA.dto, genN2, optN2);
      validateGen(mA.dto, genN3, optN3);
      validateGen(mA.dto, genN4, optN4);

      // Failure Cases
      const optF0: MCGeneratorOptions = { start: ['x', 'y', 'z'] }; // Shouldn't find a Gram
      const optF1: MCGeneratorOptions = { mask: ['a'] }; // All values should be masked.

      const genF0 = mA.generate(optF0);
      const genF1 = mA.generate(optF1);

      expect(genF0).toEqual(optF0.start);
      expect(genF1).toEqual([]);
    });
  });
});
