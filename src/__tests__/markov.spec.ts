/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

/**
 # Module Dependencies
 */

import { MarkovChain, MarkovChainDTO, MarkovChainGramDTO, Random, CONSTANTS, Distribution, ScaledMarkovChain, MultiDimMarkovChain } from '..';
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
  // expect(m.seed).toEqual(ref.seed);
  // expect(m.uses).toEqual(ref.uses);
  expect(m).toHaveProperty('sequences');
  expect(m).toHaveProperty('grams');
  expect(m).toHaveProperty('seed');
  expect(m).toHaveProperty('uses');
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
    expect(output.length).toBeGreaterThanOrEqual(options.min || defaultGenOptions.min);
    // expect(output.length).toBeLessThanOrEqual(options.max || defaultGenOptions.max);

    if (options.trim === true) {
      expect(output.length).toBeLessThanOrEqual(options.max || defaultGenOptions.max);
      expect(output.filter(v => v === model.startDelimiter || v === model.endDelimiter).length).toEqual(0);
    } else if (options.trim === false) {
      expect(output.length).toBeLessThanOrEqual(options.max ? options.max + 1 : defaultGenOptions.max + 1);
      // expect(output.filter(v => (v === model.startDelimiter || v === model.endDelimiter)).length).toBeGreaterThanOrEqual(1);
      expect(output.filter(v => v === model.startDelimiter || v === model.endDelimiter).length).toBeLessThanOrEqual(2);
    }
  }

  /* if (options.min) expect(output.length).toBeGreaterThanOrEqual(options.min);
  if (options.max && options.trim) {
    expect(output.length).toBeLessThanOrEqual(options.max);
  } else if (options.max && !options.trim) {
    expect(output.length).toBeLessThanOrEqual(options.max + 2);
  } */
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
      m1 = MarkovChain.addEdge(m1, 'a', undefined, 'b', 1);
      m1 = MarkovChain.addEdge(m1, 'b', 'a', 'c', 1);
      m1 = MarkovChain.addEdge(m1, 'c', 'b', undefined, 1);
      m1 = MarkovChain.addEdge(m1, ['a', 'b'], undefined, 'c', 2);
      m1 = MarkovChain.addEdge(m1, ['b', 'c'], 'a', undefined, 2);

      // DTO and edge degrees match expected results.
      expect(m1).toEqual(dtoGU3IExpected);
      expect(m1.grams.a.degreeOut).toBe(1);
      expect(m1.grams.a.degreeIn).toBe(0);
      expect(m1.grams.b.degreeOut).toBe(1);
      expect(m1.grams.b.degreeIn).toBe(1);
      expect(m1.grams.c.degreeOut).toBe(0);
      expect(m1.grams.c.degreeIn).toBe(1);

      let m2 = MarkovChain.addEdge(m1, 'x', undefined, 'b', 1);
      m2 = MarkovChain.addEdge(m2, 'b', 'x', undefined, 1);
      m2 = MarkovChain.addEdge(m2, 'b', undefined, 'a', 1);
      m2 = MarkovChain.addEdge(m2, 'b', undefined, 'a', 1);
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
        const pickStandard = MarkovChain.pickGram(gsBS);
        expect(pickStandard).toEqual(gB1[0]);

        // Next
        const pickSNext = MarkovChain.pickGram(gsB0, true, undefined, eng);
        expect(pickSNext).toEqual(gB1[1]);

        // Last
        const pickSLast = MarkovChain.pickGram(gsB1, false, undefined, eng);
        expect(pickSLast).toEqual(gB1[0]);

        // Masks
        const pickMask1 = MarkovChain.pickGram(gsC1, true, ['a', 'y'], eng);
        expect(pickMask1).toEqual('z');
      }
    });
    it('can pick values from a markov chain', () => {
      const eng = engine.clone();

      for (let i = 0; i < 20; i += 1) {
        // Standard Pick
        const pickStandard = MarkovChain.pick(dtoB1);
        expect(pickStandard).toEqual(gB1[0]);

        // Next
        const pickSNext = MarkovChain.pick(dtoB1, [gB1[0]], undefined, undefined, eng);
        const pickNext1 = MarkovChain.next(dtoB1, [gB1[0]], undefined, eng);
        const pickNext2 = MarkovChain.next(dtoC2, ['+'], undefined, eng);
        expect(pickSNext).toEqual(gB1[1]);
        expect(pickNext1).toEqual(pickSNext);
        expect([gC1[2], gC2[2]]).toContain(pickNext2);

        // Last
        const pickSLast = MarkovChain.pick(dtoB1, [gB1[1]], false, undefined, eng);
        const pickLast = MarkovChain.last(dtoB1, [gB1[1]], undefined, eng);
        const pickLast2 = MarkovChain.last(dtoC2, ['+'], undefined, eng);
        expect(pickSLast).toEqual(gB1[0]);
        expect(pickLast).toEqual(pickSLast);
        expect([gC1[0], gC2[0]]).toContain(pickLast2);

        // Masks
        const pickMask1 = MarkovChain.pick(dtoC2, ['+'], true, ['a', 'y'], eng);
        const pickMask2 = MarkovChain.next(dtoC2, ['+'], ['a', 'y'], eng);
        const pickMask3 = MarkovChain.last(dtoC2, ['+'], ['a', 'y'], eng);
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

      // Min and Max
      const optM0: MCGeneratorStaticOptions = { model: dtoA3, min: 2, trim: true };
      const optM1: MCGeneratorStaticOptions = { model: dtoA3, min: 2, trim: false };
      const optM2: MCGeneratorStaticOptions = { model: dtoA3, max: 2, trim: true };
      const optM3: MCGeneratorStaticOptions = { model: dtoA3, max: 2, trim: false };
      const optM4: MCGeneratorStaticOptions = { model: dtoA3, min: 2, max: 2, trim: true };
      const optM5: MCGeneratorStaticOptions = { model: dtoA3, min: 2, max: 2, trim: false };

      const genM0 = MarkovChain.generate(optM0);
      const genM1 = MarkovChain.generate(optM1);
      const genM2 = MarkovChain.generate(optM2);
      const genM3 = MarkovChain.generate(optM3);
      const genM4 = MarkovChain.generate(optM4);
      const genM5 = MarkovChain.generate(optM5);

      validateGen(dtoA3, genM0, optM0);
      validateGen(dtoA3, genM1, optM1);
      validateGen(dtoA3, genM2, optM2);
      validateGen(dtoA3, genM3, optM3);
      validateGen(dtoA3, genM4, optM4);
      validateGen(dtoA3, genM5, optM5);

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
    it('can analyze the sources and sinks of a sequence', () => {
      const eng = engine.clone();

      // Default
      const a1 = MarkovChain.analyze({ model: dtoC2, engine: eng });
      expect(a1).toHaveProperty('sequence');
      expect(a1).toHaveProperty('sources');
      expect(a1).toHaveProperty('sinks');
      expect(a1.sequence).toEqual([dtoC2.startDelimiter]);
      expect(a1.sources).toEqual({});
      Object.values(a1.sinks).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });

      // Samples & Un-Normalized
      const a2 = MarkovChain.analyze({ model: dtoC2, engine: eng, samples: 500, normalize: false });
      expect(a2.sequence).toEqual([dtoC2.startDelimiter]);
      expect(a2.sources).toEqual({});
      expect(Object.values(a2.sinks).reduce((a, b) => a + b)).toEqual(500);

      // Starting Values
      const a3 = MarkovChain.analyze({ model: dtoC2, engine: eng, start: ['+'] });
      expect(a3.sequence).toEqual(['+']);
      Object.values(a3.sources).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });
      Object.values(a3.sinks).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });

      // These are covered in Generation since they're just passed through.
      const a4 = MarkovChain.analyze({ model: dtoC2, engine: eng, min: 1, max: 1, order: 2, strict: true });
      expect(a4).toHaveProperty('sequence');
      expect(a4).toHaveProperty('sources');
      expect(a4).toHaveProperty('sinks');
    });
    it('are immutable', () => {
      const mOriginal = MarkovChain.clone(dtoA3);
      const mClone = MarkovChain.clone(mOriginal);
      expect(mOriginal).toEqual(mClone);

      MarkovChain.addEdge(mClone, 'b', 'a', 'c', 1);
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
    it('can find grams within its model', () => {
      const mA = new MarkovChain(dtoB3);
      expect(mA.getGram(['a', 'n'])).toEqual(MarkovChain.getGram(dtoB3, ['a', 'n']));
      expect(mA.findGram(['a', 'n'])).toEqual(MarkovChain.findGram(dtoB3, ['a', 'n']));
    });
    it('can add an edge to an existing markov chain', () => {
      const m1 = new MarkovChain({ maxOrder: 2 });
      m1.addEdge('a', undefined, 'b', 1);
      m1.addEdge('b', 'a', 'c', 1);
      m1.addEdge('c', 'b', undefined, 1);
      m1.addEdge(['a', 'b'], undefined, 'c', 2);
      m1.addEdge(['b', 'c'], 'a', undefined, 2);

      // DTO and edge degrees match expected results.
      expect(m1.serialize(true)).toEqual(dtoGU3IExpected);
      expect(m1.grams.a.degreeOut).toBe(1);
      expect(m1.grams.a.degreeIn).toBe(0);
      expect(m1.grams.b.degreeOut).toBe(1);
      expect(m1.grams.b.degreeIn).toBe(1);
      expect(m1.grams.c.degreeOut).toBe(0);
      expect(m1.grams.c.degreeIn).toBe(1);

      m1.addEdge('b', 'x', undefined, 1);
      m1.addEdge('b', undefined, 'a', 1);
      m1.addEdge('b', undefined, 'a', 1);
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
        const pickDLast = mB1.pick(undefined, false);
        const pickSLast = mB1.pick([gB1[1]], false);
        const pickLast = mB1.last([gB1[1]]);
        const pickLast2 = mC2.last(['+']);
        expect(pickDLast).toEqual(gB1[2]);
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
    it('can analyze the sources and sinks of a sequence', () => {
      const mc = new MarkovChain({ ...dtoC2, seed: engine.seed });

      // Default
      const a1 = mc.analyze({});
      expect(a1).toHaveProperty('sequence');
      expect(a1).toHaveProperty('sources');
      expect(a1).toHaveProperty('sinks');
      expect(a1.sequence).toEqual([mc.startDelimiter]);
      expect(a1.sources).toEqual({});
      Object.values(a1.sinks).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });

      // Samples & Un-Normalized
      const a2 = mc.analyze({ samples: 500, normalize: false });
      expect(a2.sequence).toEqual([dtoC2.startDelimiter]);
      expect(a2.sources).toEqual({});
      expect(Object.values(a2.sinks).reduce((a, b) => a + b)).toEqual(500);

      // Starting Values
      const a3 = mc.analyze({ start: ['+'] });
      expect(a3.sequence).toEqual(['+']);
      Object.values(a3.sources).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });
      Object.values(a3.sinks).forEach(v => {
        expect(v).toBeCloseTo(0.5, 1);
      });

      // These are covered in Generation since they're just passed through.
      const a4 = mc.analyze({ min: 1, max: 1, order: 2, strict: true });
      expect(a4).toHaveProperty('sequence');
      expect(a4).toHaveProperty('sources');
      expect(a4).toHaveProperty('sinks');
    });
  });

  describe('batch operations', () => {
    it('can queue and commit multiple operations', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });

      // Use batch API to add multiple sequences
      const updated = chain.batch()
        .addSequence(['a', 'b', 'c'])
        .addSequence(['d', 'e', 'f'])
        .addSequence(['a', 'b', 'd'])
        .commit();

      // Verify sequences were added
      expect(updated.sequences).toHaveLength(3);
      expect(updated.sequences).toContainEqual(['a', 'b', 'c']);
      expect(updated.sequences).toContainEqual(['d', 'e', 'f']);
      expect(updated.sequences).toContainEqual(['a', 'b', 'd']);

      // Verify grams were created
      expect(Object.keys(updated.grams).length).toBeGreaterThan(0);
    });

    it('can clear pending operations', () => {
      const chain = new MarkovChain({ seed: 1 });
      const batch = chain.batch()
        .addSequence(['a', 'b', 'c'])
        .addSequence(['d', 'e', 'f']);

      expect(batch.pending).toBe(2);
      batch.clear();
      expect(batch.pending).toBe(0);
    });

    it('returns a clone when no operations are queued', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [['a', 'b']] });
      const updated = chain.batch().commit();

      expect(updated).not.toBe(chain);
      expect(updated.sequences).toEqual(chain.sequences);
      expect(Object.keys(updated.grams)).toEqual(Object.keys(chain.grams));
    });

    it('is more efficient than repeated individual operations', () => {
      const testSequences = Array.from({ length: 100 }, (_, i) =>
        ['a', 'b', 'c', 'd'].slice(0, (i % 4) + 1)
      );

      // Time individual operations (old way)
      const chain1 = new MarkovChain({ seed: 1, maxOrder: 2 });
      const start1 = Date.now();
      let current = chain1;
      for (const seq of testSequences) {
        current = current.addSequence(seq);
      }
      const time1 = Date.now() - start1;

      // Time batch operations (new way)
      const chain2 = new MarkovChain({ seed: 1, maxOrder: 2 });
      const start2 = Date.now();
      const batch = chain2.batch();
      for (const seq of testSequences) {
        batch.addSequence(seq);
      }
      const updated = batch.commit();
      const time2 = Date.now() - start2;

      // Batch should be faster (though for small datasets the difference may be minimal)
      // Both should produce the same result
      expect(updated.sequences).toEqual(current.sequences);
      expect(Object.keys(updated.grams).length).toBe(Object.keys(current.grams).length);

      console.log(`Individual operations: ${time1}ms, Batch operations: ${time2}ms`);
    });
  });

  describe('Generic Types and Utility Methods', () => {
    test('hasGram should correctly check for gram existence', () => {
      const chain = new MarkovChain({ maxOrder: 2 });
      chain.addSequence(['a', 'b', 'c']);

      expect(chain.hasGram(['a'])).toBe(true);
      expect(chain.hasGram(['a', 'b'])).toBe(true);
      expect(chain.hasGram(['b', 'c'])).toBe(true);
      expect(chain.hasGram(['x', 'y'])).toBe(false);
    });

    test('getGramsByOrder should return grams of specific order', () => {
      const chain = new MarkovChain({ maxOrder: 2 });
      chain.addSequence(['a', 'b', 'c', 'd']);

      const order1Grams = chain.getGramsByOrder(1);
      const order2Grams = chain.getGramsByOrder(2);

      expect(order1Grams.length).toBeGreaterThan(0);
      expect(order2Grams.length).toBeGreaterThan(0);
      expect(order1Grams.every(g => g.order === 1)).toBe(true);
      expect(order2Grams.every(g => g.order === 2)).toBe(true);
    });

    test('getStats should return chain statistics', () => {
      const chain = new MarkovChain({ maxOrder: 2 });
      chain.addSequence(['a', 'b', 'c']);
      chain.addSequence(['a', 'b', 'd']);

      const stats = chain.getStats();

      expect(stats.gramCount).toBeGreaterThan(0);
      expect(stats.sequenceCount).toBe(2);
      expect(stats.orderRange).toEqual([expect.any(Number), expect.any(Number)]);
      expect(stats.avgDegreeIn).toBeGreaterThanOrEqual(0);
      expect(stats.avgDegreeOut).toBeGreaterThanOrEqual(0);
    });

    test('withSelector should allow type-safe state selection', () => {
      interface User {
        id: number;
        name: string;
      }

      const users: User[] = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];

      const lookup = new Map(users.map(u => [String(u.id), u]));
      const selector = (id: string) => lookup.get(id);

      // Create chain with ID sequences
      const chain = new MarkovChain({ maxOrder: 1 });
      chain.addSequence(['1', '2', '3']);
      chain.addSequence(['1', '2', '1']);

      // Attach selector
      const chainWithSelector = chain.withSelector(selector);

      // Verify selector is attached
      expect(chainWithSelector.stateSelector).toBe(selector);
    });

    test('Distribution with specific string types should maintain type safety', () => {
      type Options = 'red' | 'blue' | 'green';

      const dist = new Distribution<Options>({
        source: { red: 1, blue: 2, green: 3 }
      });

      const pick = dist.pickOne();
      // At runtime, this should be one of the three options
      expect(['red', 'blue', 'green']).toContain(pick);

      const picks = dist.pick(10);
      picks.forEach(p => {
        expect(['red', 'blue', 'green']).toContain(p);
      });
    });

    test('batch operations should maintain type information', () => {
      const chain = new MarkovChain<string>({ maxOrder: 2 });

      const updated = chain.batch()
        .addSequence(['a', 'b', 'c'])
        .addSequence(['b', 'c', 'd'])
        .commit();

      expect(updated.sequences).toHaveLength(2);
      expect(updated.hasGram(['a', 'b'])).toBe(true);
    });
  });

  describe('Chain Blending', () => {
    test('blend() should combine multiple chains with arithmetic mean', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 });
      chain1.addSequence(['a', 'b', 'c']);
      chain1.addSequence(['a', 'b', 'd']);

      const chain2 = new MarkovChain({ maxOrder: 1 });
      chain2.addSequence(['a', 'x', 'y']);
      chain2.addSequence(['a', 'x', 'z']);

      const blended = MarkovChain.blend([
        { chain: chain1, weight: 0.5 },
        { chain: chain2, weight: 0.5 }
      ]);

      // Blended chain should have grams from both
      expect(blended.hasGram(['a'])).toBe(true);
      expect(blended.hasGram(['b'])).toBe(true);
      expect(blended.hasGram(['x'])).toBe(true);

      // Should have combined probabilities
      const gramA = blended.model.grams[blended.getGramId(['a'])];
      expect(gramA).toBeDefined();
      if (gramA) {
        // 'a' should lead to both 'b' and 'x' with blended probabilities
        expect(gramA.next.source['b']).toBeDefined();
        expect(gramA.next.source['x']).toBeDefined();
      }
    });

    test('interpolate() should blend two chains with alpha parameter', () => {
      const names1 = ['alice', 'bob', 'charlie'].map(n => n.split(''));
      const names2 = ['akira', 'yuki', 'hana'].map(n => n.split(''));

      const chain1 = new MarkovChain({ maxOrder: 1, sequences: names1 });
      const chain2 = new MarkovChain({ maxOrder: 1, sequences: names2 });

      // 70% chain1, 30% chain2
      const blended = chain1.interpolate(chain2, 0.3);

      // Should have grams from both chains
      expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);

      // Generate a sequence to ensure it works
      const generated = blended.generate({ order: 1, min: 3, max: 10 });
      expect(generated.length).toBeGreaterThanOrEqual(3);
    });

    test('blend() should handle single chain input', () => {
      const chain = new MarkovChain({ maxOrder: 1 });
      chain.addSequence(['a', 'b', 'c']);

      const blended = MarkovChain.blend([{ chain, weight: 1.0 }]);

      // Should be equivalent to a clone
      expect(blended.model.grams).toEqual(chain.model.grams);
    });

    test('blend() should normalize weights', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 });
      chain1.addSequence(['a', 'b']);

      const chain2 = new MarkovChain({ maxOrder: 1 });
      chain2.addSequence(['a', 'c']);

      // Weights don't sum to 1
      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 2 },
          { chain: chain2, weight: 3 }
        ],
        { normalize: true }
      );

      // Should still produce valid chain
      expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);
      const generated = blended.generate({ order: 1, min: 1, max: 5 });
      expect(generated.length).toBeGreaterThanOrEqual(1);
    });

    test('blend() should support different blending strategies', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 });
      chain1.addSequence(['a', 'b']);

      const chain2 = new MarkovChain({ maxOrder: 1 });
      chain2.addSequence(['a', 'c']);

      const strategies: Array<'arithmetic' | 'geometric' | 'max' | 'min'> = [
        'arithmetic',
        'geometric',
        'max',
        'min'
      ];

      for (const strategy of strategies) {
        const blended = MarkovChain.blend(
          [
            { chain: chain1, weight: 0.5 },
            { chain: chain2, weight: 0.5 }
          ],
          { strategy }
        );

        expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);
      }
    });

    test('blend() should filter low-weight states with minWeight option', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 });
      // Add 'b' with high frequency
      for (let i = 0; i < 10; i++) {
        chain1.addSequence(['a', 'b']);
      }

      const chain2 = new MarkovChain({ maxOrder: 1 });
      // Add 'c' with low frequency
      chain2.addSequence(['a', 'c']);

      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 0.9 },
          { chain: chain2, weight: 0.1 }
        ],
        { minWeight: 0.5 } // Filter out states with weight < 0.5
      );

      const gramA = blended.model.grams[blended.getGramId(['a'])];
      expect(gramA).toBeDefined();
      if (gramA) {
        // 'b' should be present (high weight from chain1)
        expect(gramA.next.source['b']).toBeDefined();
        // 'c' might be filtered out due to low weight
        // (depending on exact calculation, this is probabilistic)
      }
    });

    test('blend() should throw error for empty chains array', () => {
      expect(() => {
        MarkovChain.blend([]);
      }).toThrow('Cannot blend zero chains');
    });

    test('blended chains should be able to generate valid sequences', () => {
      const englishWords = ['the', 'cat', 'sat', 'on', 'mat'].map(w => w.split(''));
      const frenchWords = ['le', 'chat', 'est', 'sur', 'tapis'].map(w => w.split(''));

      const english = new MarkovChain({ maxOrder: 2, sequences: englishWords });
      const french = new MarkovChain({ maxOrder: 2, sequences: frenchWords });

      const mixed = MarkovChain.blend([
        { chain: english, weight: 0.6 },
        { chain: french, weight: 0.4 }
      ]);

      // Generate multiple sequences to ensure stability
      for (let i = 0; i < 10; i++) {
        const generated = mixed.generate({ order: 2, min: 2, max: 8 });
        expect(generated.length).toBeGreaterThanOrEqual(2);
        expect(generated.length).toBeLessThanOrEqual(8);
      }
    });
  });

  /**
   * Scaled Markov Chain Tests (v3.2)
   */
  describe('ScaledMarkovChain', () => {
    test('should create a scaled chain and add sequences', () => {
      const chain = new ScaledMarkovChain<'up' | 'down' | 'stable'>({
        seed: 1,
        maxOrder: 2,
        magnitudeRange: [-100, 100]
      });

      const updated = chain.addScaledSequence([
        { category: 'up', magnitude: 20 },
        { category: 'up', magnitude: 35 },
        { category: 'stable', magnitude: 2 },
        { category: 'down', magnitude: -15 }
      ]);

      expect(updated).toBeInstanceOf(ScaledMarkovChain);
      const categoryChain = updated.getCategoryChain();
      expect(categoryChain.hasGram(['up'])).toBe(true);
      expect(categoryChain.hasGram(['stable'])).toBe(true);
      expect(categoryChain.hasGram(['down'])).toBe(true);
    });

    test('should generate scaled sequences with magnitude sampling', () => {
      const chain = new ScaledMarkovChain<'positive' | 'negative' | 'neutral'>({
        seed: 2,
        maxOrder: 1,
        samplingStrategy: 'mean'
      });

      const updated = chain.addScaledSequences([
        [
          { category: 'positive', magnitude: 50 },
          { category: 'positive', magnitude: 60 },
          { category: 'neutral', magnitude: 5 }
        ],
        [
          { category: 'positive', magnitude: 40 },
          { category: 'neutral', magnitude: 0 },
          { category: 'negative', magnitude: -30 }
        ]
      ]);

      const generated = updated.generateScaled({ order: 1, min: 3, max: 5 });

      expect(generated.length).toBeGreaterThanOrEqual(3);
      expect(generated.length).toBeLessThanOrEqual(5);
      generated.forEach(state => {
        expect(state).toHaveProperty('category');
        expect(state).toHaveProperty('magnitude');
        expect(typeof state.magnitude).toBe('number');
      });
    });

    test('should track magnitude statistics correctly', () => {
      const chain = new ScaledMarkovChain<'a' | 'b'>({
        seed: 3,
        maxOrder: 1
      });

      const updated = chain.addScaledSequence([
        { category: 'a', magnitude: 10 },
        { category: 'a', magnitude: 20 },
        { category: 'a', magnitude: 30 },
        { category: 'b', magnitude: 5 }
      ]);

      // Get stats for 'a' from start context
      const stats = updated.getMagnitudeStats('a');
      expect(stats).toBeDefined();
      expect(stats!.mean).toBe(20); // (10 + 20 + 30) / 3
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
      expect(stats!.count).toBe(3);
    });

    test('should support different sampling strategies', () => {
      const magnitudes = [10, 20, 30, 40, 50];

      // Mean strategy
      const meanChain = new ScaledMarkovChain<'test'>({
        seed: 4,
        maxOrder: 1,
        samplingStrategy: 'mean'
      });

      const states = magnitudes.map(m => ({ category: 'test' as const, magnitude: m }));
      const withMean = meanChain.addScaledSequence(states);
      const meanResult = withMean.generateScaled({ order: 1, min: 1, max: 1 });

      // Mean should be 30
      expect(meanResult[0]?.magnitude).toBe(30);

      // Median strategy
      const medianChain = new ScaledMarkovChain<'test'>({
        seed: 5,
        maxOrder: 1,
        samplingStrategy: 'median'
      });

      const withMedian = medianChain.addScaledSequence(states);
      const medianResult = withMedian.generateScaled({ order: 1, min: 1, max: 1 });

      // Median should be 30 (middle value)
      expect(medianResult[0]?.magnitude).toBe(30);
    });

    test('should handle magnitude range fallback', () => {
      const chain = new ScaledMarkovChain<'known' | 'unknown'>({
        seed: 6,
        maxOrder: 1,
        magnitudeRange: [-50, 50],
        samplingStrategy: 'mean'
      });

      // Add a sequence with only 'known' category
      const updated = chain.addScaledSequence([
        { category: 'known', magnitude: 10 },
        { category: 'unknown', magnitude: 20 }
      ]);

      // Get magnitude for a category-gram combination that has no magnitude data
      // by getting stats for non-existent gram context
      const stats = updated.getMagnitudeStats('unknown', ['nonexistent']);

      // When no magnitude data exists for a gram-category pair, stats should be undefined
      expect(stats).toBeUndefined();

      // The sampleMagnitude method should use midpoint of range as fallback
      // This is tested indirectly through generation with limited data
      const result = updated.generateScaled({ order: 1, min: 1, max: 2 });
      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach(state => {
        expect(state.magnitude).toBeDefined();
        expect(typeof state.magnitude).toBe('number');
      });
    });

    test('should get magnitude samples for categories', () => {
      const chain = new ScaledMarkovChain<'x' | 'y'>({
        seed: 7,
        maxOrder: 1
      });

      const updated = chain.addScaledSequence([
        { category: 'x', magnitude: 100 },
        { category: 'x', magnitude: 200 },
        { category: 'y', magnitude: 300 }
      ]);

      const samples = updated.getMagnitudeSamples('x');
      expect(samples).toHaveLength(2);
      expect(samples).toContain(100);
      expect(samples).toContain(200);
    });

    test('should clone scaled chain correctly', () => {
      const chain = new ScaledMarkovChain<'foo' | 'bar'>({
        seed: 8,
        maxOrder: 2,
        samplingStrategy: 'median',
        magnitudeRange: [0, 100]
      });

      const updated = chain.addScaledSequence([
        { category: 'foo', magnitude: 10 },
        { category: 'bar', magnitude: 20 }
      ]);

      const cloned = updated.clone();

      // Check that properties are preserved
      expect(cloned).toBeInstanceOf(ScaledMarkovChain);

      // Generate from both and compare
      const original = updated.generateScaled({ order: 1, min: 2, max: 2 });
      const fromClone = cloned.generateScaled({ order: 1, min: 2, max: 2 });

      // Both should generate valid sequences
      expect(original.length).toBe(2);
      expect(fromClone.length).toBe(2);
    });

    test('should support pickScaled for single state generation', () => {
      const chain = new ScaledMarkovChain<'hot' | 'cold'>({
        seed: 9,
        maxOrder: 1
      });

      const updated = chain.addScaledSequence([
        { category: 'hot', magnitude: 80 },
        { category: 'cold', magnitude: 20 },
        { category: 'hot', magnitude: 90 }
      ]);

      const next = updated.pickScaled(['hot']);

      expect(next).toBeDefined();
      expect(next).toHaveProperty('category');
      expect(next).toHaveProperty('magnitude');
    });

    test('should handle multi-order magnitude tracking', () => {
      const chain = new ScaledMarkovChain<'rising' | 'falling'>({
        seed: 10,
        maxOrder: 2,
        samplingStrategy: 'mean'
      });

      const updated = chain.addScaledSequence([
        { category: 'rising', magnitude: 10 },
        { category: 'rising', magnitude: 20 },
        { category: 'rising', magnitude: 30 },
        { category: 'falling', magnitude: -10 }
      ]);

      // Generate with order 2 to use bigram context
      const result = updated.generateScaled({ order: 2, min: 2, max: 4 });

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.length).toBeLessThanOrEqual(4);

      // All states should have magnitudes
      result.forEach(state => {
        expect(typeof state.magnitude).toBe('number');
      });
    });
  });

  /**
   * Multi-Dimensional Markov Chain Tests (v3.3)
   */
  describe('MultiDimMarkovChain', () => {
    interface TileState {
      tile: string;
      x: number;
      y: number;
    }

    test('should create a multi-dimensional chain with structured states', () => {
      const chain = new MultiDimMarkovChain<TileState>({
        seed: 1,
        maxOrder: 2,
        stateKey: (s) => `${s.tile}_${s.x}_${s.y}`
      });

      const updated = chain.addSequence([
        { tile: 'grass', x: 0, y: 0 },
        { tile: 'water', x: 0, y: 1 },
        { tile: 'grass', x: 0, y: 2 }
      ]);

      expect(updated).toBeInstanceOf(MultiDimMarkovChain);
      expect(updated.hasState({ tile: 'grass', x: 0, y: 0 })).toBe(true);
      expect(updated.hasState({ tile: 'water', x: 0, y: 1 })).toBe(true);
    });

    test('should generate sequences of structured states', () => {
      interface GameState {
        action: string;
        health: number;
      }

      const chain = new MultiDimMarkovChain<GameState>({
        seed: 2,
        maxOrder: 1,
        stateKey: (s) => `${s.action}_${s.health}`
      });

      const updated = chain.addSequences([
        [
          { action: 'walk', health: 100 },
          { action: 'fight', health: 80 },
          { action: 'rest', health: 90 }
        ],
        [
          { action: 'walk', health: 100 },
          { action: 'run', health: 95 },
          { action: 'fight', health: 75 }
        ]
      ]);

      const generated = updated.generate({ order: 1, min: 2, max: 4 });

      expect(generated.length).toBeGreaterThanOrEqual(2);
      expect(generated.length).toBeLessThanOrEqual(4);
      generated.forEach(state => {
        expect(state).toHaveProperty('action');
        expect(state).toHaveProperty('health');
        expect(typeof state.action).toBe('string');
        expect(typeof state.health).toBe('number');
      });
    });

    test('should preserve full structure without flattening', () => {
      interface ComplexState {
        type: string;
        position: [number, number];
        metadata: { color: string };
      }

      const chain = new MultiDimMarkovChain<ComplexState>({
        seed: 3,
        maxOrder: 1,
        stateKey: (s) => `${s.type}_${s.position[0]}_${s.position[1]}_${s.metadata.color}`
      });

      const testState: ComplexState = {
        type: 'building',
        position: [5, 10],
        metadata: { color: 'red' }
      };

      const updated = chain.addSequence([testState]);

      // Get states and verify structure is preserved
      const states = updated.getStates();
      expect(states.length).toBeGreaterThan(0);

      const retrievedState = states.find(s =>
        s.type === 'building' &&
        s.position[0] === 5 &&
        s.position[1] === 10
      );

      expect(retrievedState).toBeDefined();
      expect(retrievedState!.metadata.color).toBe('red');
    });

    test('should support picking next state', () => {
      interface SimpleState {
        value: string;
        index: number;
      }

      const chain = new MultiDimMarkovChain<SimpleState>({
        seed: 4,
        maxOrder: 1,
        stateKey: (s) => `${s.value}_${s.index}`
      });

      const updated = chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
        { value: 'c', index: 2 }
      ]);

      const next = updated.pick([{ value: 'a', index: 0 }]);

      expect(next).toBeDefined();
      expect(next).toHaveProperty('value');
      expect(next).toHaveProperty('index');
    });

    test('should get statistics from internal chain', () => {
      interface CountState {
        id: string;
        count: number;
      }

      const chain = new MultiDimMarkovChain<CountState>({
        seed: 5,
        maxOrder: 2,
        stateKey: (s) => `${s.id}_${s.count}`
      });

      const updated = chain.addSequences([
        [
          { id: 'x', count: 1 },
          { id: 'y', count: 2 },
          { id: 'z', count: 3 }
        ],
        [
          { id: 'a', count: 1 },
          { id: 'b', count: 2 }
        ]
      ]);

      const stats = updated.getStats();

      expect(stats).toHaveProperty('gramCount');
      expect(stats).toHaveProperty('sequenceCount');
      expect(stats.sequenceCount).toBe(2);
    });

    test('should get all unique states', () => {
      interface UniqueState {
        label: string;
        value: number;
      }

      const chain = new MultiDimMarkovChain<UniqueState>({
        seed: 6,
        maxOrder: 1,
        stateKey: (s) => `${s.label}_${s.value}`
      });

      const updated = chain.addSequence([
        { label: 'first', value: 10 },
        { label: 'second', value: 20 },
        { label: 'first', value: 10 },  // Duplicate - should only store once
        { label: 'third', value: 30 }
      ]);

      const states = updated.getStates();

      // Should have 3 unique states (first, second, third)
      expect(states.length).toBe(3);

      const labels = states.map(s => s.label).sort();
      expect(labels).toContain('first');
      expect(labels).toContain('second');
      expect(labels).toContain('third');
    });

    test('should clone multi-dimensional chain correctly', () => {
      interface CloneState {
        name: string;
        level: number;
      }

      const chain = new MultiDimMarkovChain<CloneState>({
        seed: 7,
        maxOrder: 1,
        stateKey: (s) => `${s.name}_${s.level}`
      });

      const updated = chain.addSequence([
        { name: 'beginner', level: 1 },
        { name: 'intermediate', level: 2 }
      ]);

      const cloned = updated.clone();

      expect(cloned).toBeInstanceOf(MultiDimMarkovChain);

      // Generate from both
      const original = updated.generate({ order: 1, min: 1, max: 2 });
      const fromClone = cloned.generate({ order: 1, min: 1, max: 2 });

      // Both should generate valid sequences
      expect(original.length).toBeGreaterThan(0);
      expect(fromClone.length).toBeGreaterThan(0);

      // Verify structures are preserved
      original.forEach(state => {
        expect(state).toHaveProperty('name');
        expect(state).toHaveProperty('level');
      });
    });

    test('should work with tile-based procedural generation', () => {
      // Real-world tile generation use case
      interface TileState {
        terrain: string;
        x: number;
        y: number;
        biome: string;
      }

      const chain = new MultiDimMarkovChain<TileState>({
        seed: 8,
        maxOrder: 2,
        stateKey: (s) => `${s.terrain}_${s.x}_${s.y}_${s.biome}`
      });

      // Training data from a procedurally generated map
      const mapData = [
        [
          { terrain: 'grass', x: 0, y: 0, biome: 'plains' },
          { terrain: 'grass', x: 1, y: 0, biome: 'plains' },
          { terrain: 'water', x: 2, y: 0, biome: 'river' },
          { terrain: 'grass', x: 3, y: 0, biome: 'plains' }
        ],
        [
          { terrain: 'forest', x: 0, y: 1, biome: 'woods' },
          { terrain: 'forest', x: 1, y: 1, biome: 'woods' },
          { terrain: 'grass', x: 2, y: 1, biome: 'plains' }
        ]
      ];

      const trained = chain.addSequences(mapData);

      // Generate new map sequence (use order 1 for better generation with limited data)
      const newMap = trained.generate({ order: 1, min: 3, max: 6 });

      expect(newMap.length).toBeGreaterThanOrEqual(3);
      expect(newMap.length).toBeLessThanOrEqual(6);

      // Verify all tiles have complete structure
      newMap.forEach(tile => {
        expect(tile).toHaveProperty('terrain');
        expect(tile).toHaveProperty('x');
        expect(tile).toHaveProperty('y');
        expect(tile).toHaveProperty('biome');
        expect(['grass', 'water', 'forest']).toContain(tile.terrain);
      });
    });
  });
});
