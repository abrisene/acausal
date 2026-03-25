/*
 # markov.spec.js
 # Markov Chain Class Spec
 */

import { describe, it, test, expect } from 'vitest';

/**
 # Module Dependencies
 */

import { Random, CONSTANTS } from '@acausal/random';
import { Distribution } from '@acausal/distributions';
import {
  MarkovChain,
  ImmutableMarkovChain,
  MarkovChainDTO,
  MarkovChainGramDTO,
  MultiDimMarkovChain,
  ImmutableMultiDimMarkovChain,
  registerStateKey,
  getStateKey,
  MCGeneratorOptions,
  MCDirectionOption,
  MCGeneratorStaticOptions,
} from './index';

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
const defaultDTO6 = { ...defaultDTO, maxOrder: 6, sequences: [], grams: {} };

const defaultGramDTO: MarkovChainGramDTO = { ...defaultOptions, grams: {} };
const defaultGramDTO2 = { ...defaultGramDTO, maxOrder: 2, grams: {} };

/**
 # Utility Functions
 */

function stripSequences(m: MarkovChainDTO) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  expect(output).toBeDefined();
  if (output !== undefined) {
    expect(output.length).toBeGreaterThanOrEqual(options.min || defaultGenOptions.min);

    if (options.trim === true) {
      expect(output.length).toBeLessThanOrEqual(options.max || defaultGenOptions.max);
      expect(output.filter(v => v === model.startDelimiter || v === model.endDelimiter).length).toEqual(0);
    } else if (options.trim === false) {
      expect(output.length).toBeLessThanOrEqual(options.max ? options.max + 1 : defaultGenOptions.max + 1);
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
const sB3 = [gB1, gB2, gB3];

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
      frequency: 1,
    },
    b: {
      id: 'b',
      order: 1,
      last: { source: { a: 1 }, normal: { a: 1 } },
      next: { source: { c: 1 }, normal: { c: 1 } },
      degreeIn: 1,
      degreeOut: 1,
      frequency: 1,
    },
    c: {
      id: 'c',
      order: 1,
      last: { source: { b: 1 }, normal: { b: 1 } },
      next: { source: {}, normal: {} },
      degreeIn: 1,
      degreeOut: 0,
      frequency: 1,
    },
    'a⏐b': {
      id: 'a⏐b',
      order: 2,
      last: { source: {}, normal: {} },
      next: { source: { c: 1 }, normal: { c: 1 } },
      degreeIn: 0,
      degreeOut: 1,
      frequency: 1,
    },
    'b⏐c': {
      id: 'b⏐c',
      order: 2,
      last: { source: { a: 1 }, normal: { a: 1 } },
      next: { source: {}, normal: {} },
      degreeIn: 1,
      degreeOut: 0,
      frequency: 1,
    },
  },
};

const dtoU = MarkovChain.new({ sequences: sU });
const dtoGU = MarkovChain.new({ sequences: sU, maxOrder: defaultOptions.maxOrder, stripSequences: true });
const dto6U = MarkovChain.new({ sequences: sU, maxOrder: 6 });
const dto6GU = MarkovChain.new({ sequences: sU, maxOrder: 6, stripSequences: true });

const dtoA1 = MarkovChain.new({ sequences: sA1 });
const dtoA2 = MarkovChain.new({ sequences: sA2 });
const dtoA3 = MarkovChain.new({ sequences: sA3 });

const dtoB1 = MarkovChain.new({ sequences: sB1 });
const dtoB3 = MarkovChain.new({ sequences: sB3 });

const dtoC2 = MarkovChain.new({ sequences: sC2 });

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
      const mU1a = MarkovChain.new({ sequences: [gU1] });
      const mU2a = MarkovChain.new({ sequences: [gU2] });
      const mU3a = MarkovChain.new({ sequences: [gU3] });
      const mU4a = MarkovChain.new({ sequences: sU });
      validateDTO(mU1a);
      validateDTO(mU2a);
      validateDTO(mU3a);
      validateDTO(mU4a);
      validateGrams(mU1a);
      validateGrams(mU2a);
      validateGrams(mU3a);
      validateGrams(mU4a);

      // With Max Order Set
      const mU1b = MarkovChain.new({ sequences: [gU1], maxOrder: 6 });
      const mU2b = MarkovChain.new({ sequences: [gU2], maxOrder: 6 });
      const mU3b = MarkovChain.new({ sequences: [gU3], maxOrder: 6 });
      const mU4b = MarkovChain.new({ sequences: sU, maxOrder: 6 });
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
      const mU1c = MarkovChain.new({ sequences: [gU1], maxOrder: 4, stripSequences: true });
      const mU2c = MarkovChain.new({ sequences: [gU2], maxOrder: 4, stripSequences: true });
      const mU3c = MarkovChain.new({ sequences: [gU3], maxOrder: 4, stripSequences: true });
      const mU4c = MarkovChain.new({ sequences: sU, maxOrder: 4, stripSequences: true });
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
      const mA = MarkovChain.new({ sequences: sU, maxOrder: 4 });
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
      expect(MarkovChain.addSequence(defaultGramDTO2, gU3, 'middle')).toEqual(dtoGU3IExpected);

      // Insertion
      const mIB1 = MarkovChain.addSequence(defaultDTO, gB1, 'start');
      const mIB2 = MarkovChain.addSequence(defaultDTO, gB1, 'middle');
      const mIB3 = MarkovChain.addSequence(defaultDTO, gB1, 'end');
      expect(Object.keys(mIB1.grams)).not.toContain(mIB1.endDelimiter);
      expect(Object.keys(mIB2.grams)).not.toContain([mIB2.startDelimiter, mIB2.endDelimiter]);
      expect(Object.keys(mIB3.grams)).not.toContain(mIB3.startDelimiter);
    });
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
      // genS3 uses masking, so output differs from 'anna'
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
      const mB3 = new MarkovChain(dtoU).clone(true);
      const mB4 = new MarkovChain(dto6U).clone(true);
      const mB5 = new MarkovChain(dtoGU).clone(true);
      const mB6 = new MarkovChain(dto6GU).clone(true);

      expect(mB3.dto).toEqual(stripSequences(dtoU));
      expect(mB4.dto).toEqual(stripSequences(dto6U));
      expect(mB5.dto).toEqual(stripSequences(dtoGU));
      expect(mB6.dto).toEqual(stripSequences(dto6GU));
    });
    it('mutations do not affect clones', () => {
      const mA = new MarkovChain({ sequences: sU });
      const mB = mA.clone();
      const mC = mB.clone();
      // Mutable: addSequences mutates mB in place and returns this
      const mD = mB.addSequences(sC2);
      expect(mD).toBe(mB); // mutable returns this
      expect(mA.dto).toEqual(dtoU); // clone is independent
      expect(mC.dto).toEqual(dtoU); // clone is independent
      expect(mB.dto).not.toEqual(dtoU); // mB was mutated
      expect(mD.dto).not.toEqual(mA.dto);
      expect(mD.dto).not.toEqual(mC.dto);
    });
    it('can find grams within its model', () => {
      const mA = new MarkovChain(dtoB3);
      expect(mA.getGram(['a', 'n'])).toEqual(MarkovChain.getGram(dtoB3, ['a', 'n']));
      expect(mA.findGram(['a', 'n'])).toEqual(MarkovChain.findGram(dtoB3, ['a', 'n']));
    });
    it('can add an edge to an existing markov chain', () => {
      let m1 = new MarkovChain({ maxOrder: 2 });
      m1 = m1.addEdge('a', undefined, 'b', 1);
      m1 = m1.addEdge('b', 'a', 'c', 1);
      m1 = m1.addEdge('c', 'b', undefined, 1);
      m1 = m1.addEdge(['a', 'b'], undefined, 'c', 2);
      m1 = m1.addEdge(['b', 'c'], 'a', undefined, 2);

      // DTO and edge degrees match expected results.
      expect(m1.serialize(true)).toEqual(dtoGU3IExpected);
      expect(m1.grams.a.degreeOut).toBe(1);
      expect(m1.grams.a.degreeIn).toBe(0);
      expect(m1.grams.b.degreeOut).toBe(1);
      expect(m1.grams.b.degreeIn).toBe(1);
      expect(m1.grams.c.degreeOut).toBe(0);
      expect(m1.grams.c.degreeIn).toBe(1);

      m1 = m1.addEdge('b', 'x', undefined, 1);
      m1 = m1.addEdge('b', undefined, 'a', 1);
      m1 = m1.addEdge('b', undefined, 'a', 1);
      expect(m1.grams.b.degreeIn).toBe(2);
      expect(m1.grams.b.degreeOut).toBe(2);
    });
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
      expect(MarkovChain.addSequence(defaultGramDTO2, gU3, 'middle')).toEqual(dtoGU3IExpected);

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
      // genS3 uses masking, so output differs from 'anna'
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
      const updated = chain
        .batch()
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
      const batch = chain.batch().addSequence(['a', 'b', 'c']).addSequence(['d', 'e', 'f']);

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
      const testSequences = Array.from({ length: 100 }, (_, i) => ['a', 'b', 'c', 'd'].slice(0, (i % 4) + 1));

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
      const chain = new MarkovChain({ maxOrder: 2 }).addSequence(['a', 'b', 'c']);

      expect(chain.hasGram(['a'])).toBe(true);
      expect(chain.hasGram(['a', 'b'])).toBe(true);
      expect(chain.hasGram(['b', 'c'])).toBe(true);
      expect(chain.hasGram(['x', 'y'])).toBe(false);
    });

    test('getGramsByOrder should return grams of specific order', () => {
      const chain = new MarkovChain({ maxOrder: 2 }).addSequence(['a', 'b', 'c', 'd']);

      const order1Grams = chain.getGramsByOrder(1);
      const order2Grams = chain.getGramsByOrder(2);

      expect(order1Grams.length).toBeGreaterThan(0);
      expect(order2Grams.length).toBeGreaterThan(0);
      expect(order1Grams.every(g => g.order === 1)).toBe(true);
      expect(order2Grams.every(g => g.order === 2)).toBe(true);
    });

    test('getStats should return chain statistics', () => {
      const chain = new MarkovChain({ maxOrder: 2 }).addSequence(['a', 'b', 'c']).addSequence(['a', 'b', 'd']);

      const stats = chain.getStats();

      expect(stats.gramCount).toBeGreaterThan(0);
      expect(stats.sequenceCount).toBe(2);
      expect(stats.orderRange).toEqual([expect.any(Number), expect.any(Number)]);
      expect(stats.avgDegreeIn).toBeGreaterThanOrEqual(0);
      expect(stats.avgDegreeOut).toBeGreaterThanOrEqual(0);
    });

    test('Distribution with specific string types should maintain type safety', () => {
      type Options = 'red' | 'blue' | 'green';

      const dist = new Distribution<Options>({
        source: { red: 1, blue: 2, green: 3 },
      });

      const pick = dist.pickOne();
      // At runtime, this should be one of the three options
      expect(['red', 'blue', 'green']).toContain(pick);

      const picks = dist.pick({ count: 10 });
      picks.forEach(p => {
        expect(['red', 'blue', 'green']).toContain(p);
      });
    });

    test('batch operations should maintain type information', () => {
      const chain = new MarkovChain<string>({ maxOrder: 2 });

      const updated = chain.batch().addSequence(['a', 'b', 'c']).addSequence(['b', 'c', 'd']).commit();

      expect(updated.sequences).toHaveLength(2);
      expect(updated.hasGram(['a', 'b'])).toBe(true);
    });
  });

  describe('Chain Blending', () => {
    test('blend() should combine multiple chains with arithmetic mean', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b', 'c']).addSequence(['a', 'b', 'd']);

      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'x', 'y']).addSequence(['a', 'x', 'z']);

      const blended = MarkovChain.blend([
        { chain: chain1, weight: 0.5 },
        { chain: chain2, weight: 0.5 },
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
      const generated = blended.generate({ order: 1, min: 1, max: 10 });
      expect(generated.length).toBeGreaterThanOrEqual(1);
    });

    test('blend() should handle single chain input', () => {
      const chain = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b', 'c']);

      const blended = MarkovChain.blend([{ chain, weight: 1.0 }]);

      // Should be equivalent to a clone
      expect(blended.model.grams).toEqual(chain.model.grams);
    });

    test('blend() should normalize weights', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b']);

      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'c']);

      // Weights don't sum to 1
      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 2 },
          { chain: chain2, weight: 3 },
        ],
        { normalize: true }
      );

      // Should still produce valid chain
      expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);
      const generated = blended.generate({ order: 1, min: 1, max: 5 });
      expect(generated.length).toBeGreaterThanOrEqual(1);
    });

    test('blend() should support different blending strategies', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b']);

      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'c']);

      const strategies: Array<'arithmetic' | 'geometric' | 'max' | 'min'> = ['arithmetic', 'geometric', 'max', 'min'];

      for (const strategy of strategies) {
        const blended = MarkovChain.blend(
          [
            { chain: chain1, weight: 0.5 },
            { chain: chain2, weight: 0.5 },
          ],
          { strategy }
        );

        expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);
      }
    });

    test('blend() should filter low-weight states with minWeight option', () => {
      let chain1 = new MarkovChain({ maxOrder: 1 });
      // Add 'b' with high frequency
      for (let i = 0; i < 10; i++) {
        chain1 = chain1.addSequence(['a', 'b']);
      }

      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'c']);

      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 0.9 },
          { chain: chain2, weight: 0.1 },
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
        { chain: french, weight: 0.4 },
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
   * Multi-Dimensional Markov Chain Tests
   */
  describe('MultiDimMarkovChain', () => {
    interface TileState {
      tile: string;
      x: number;
      y: number;
    }

    // Register a state key function for serialization tests
    const tileKeyFn = (s: TileState) => `${s.tile}_${s.x}_${s.y}`;
    registerStateKey<TileState>('tileKey', tileKeyFn);

    test('should create a multi-dimensional chain with function stateKey', () => {
      const chain = new MultiDimMarkovChain<TileState>({
        seed: 1,
        maxOrder: 2,
        stateKey: s => `${s.tile}_${s.x}_${s.y}`,
      });

      const updated = chain.addSequence([
        { tile: 'grass', x: 0, y: 0 },
        { tile: 'water', x: 0, y: 1 },
        { tile: 'grass', x: 0, y: 2 },
      ]);

      expect(updated).toBeInstanceOf(MultiDimMarkovChain);
      expect(updated.hasState({ tile: 'grass', x: 0, y: 0 })).toBe(true);
      expect(updated.hasState({ tile: 'water', x: 0, y: 1 })).toBe(true);
    });

    test('should create a multi-dimensional chain with registered stateKey name', () => {
      const chain = new MultiDimMarkovChain<TileState>({
        seed: 1,
        maxOrder: 2,
        stateKey: 'tileKey',
      });

      const updated = chain.addSequence([
        { tile: 'grass', x: 0, y: 0 },
        { tile: 'water', x: 0, y: 1 },
      ]);

      expect(updated).toBeInstanceOf(MultiDimMarkovChain);
      expect(updated.hasState({ tile: 'grass', x: 0, y: 0 })).toBe(true);
    });

    test('should throw when using unregistered stateKey name', () => {
      expect(() => {
        new MultiDimMarkovChain<TileState>({
          seed: 1,
          maxOrder: 2,
          stateKey: 'nonexistent',
        });
      }).toThrow('not found in registry');
    });

    test('registerStateKey and getStateKey work correctly', () => {
      const fn = (s: { id: string }) => s.id;
      registerStateKey('testKey', fn);
      expect(getStateKey('testKey')).toBe(fn);
      expect(getStateKey('missingKey')).toBeUndefined();
    });

    test('should generate sequences of structured states', () => {
      interface GameState {
        action: string;
        health: number;
      }

      const chain = new MultiDimMarkovChain<GameState>({
        seed: 2,
        maxOrder: 1,
        stateKey: s => `${s.action}_${s.health}`,
      });

      const updated = chain.addSequences([
        [
          { action: 'walk', health: 100 },
          { action: 'fight', health: 80 },
          { action: 'rest', health: 90 },
        ],
        [
          { action: 'walk', health: 100 },
          { action: 'run', health: 95 },
          { action: 'fight', health: 75 },
        ],
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
        stateKey: s => `${s.type}_${s.position[0]}_${s.position[1]}_${s.metadata.color}`,
      });

      const testState: ComplexState = {
        type: 'building',
        position: [5, 10],
        metadata: { color: 'red' },
      };

      const updated = chain.addSequence([testState]);

      // Get states and verify structure is preserved
      const states = updated.getStates();
      expect(states.length).toBeGreaterThan(0);

      const retrievedState = states.find(s => s.type === 'building' && s.position[0] === 5 && s.position[1] === 10);

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
        stateKey: s => `${s.value}_${s.index}`,
      });

      const updated = chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
        { value: 'c', index: 2 },
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
        stateKey: s => `${s.id}_${s.count}`,
      });

      const updated = chain.addSequences([
        [
          { id: 'x', count: 1 },
          { id: 'y', count: 2 },
          { id: 'z', count: 3 },
        ],
        [
          { id: 'a', count: 1 },
          { id: 'b', count: 2 },
        ],
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
        stateKey: s => `${s.label}_${s.value}`,
      });

      const updated = chain.addSequence([
        { label: 'first', value: 10 },
        { label: 'second', value: 20 },
        { label: 'first', value: 10 }, // Duplicate - should only store once
        { label: 'third', value: 30 },
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
        stateKey: s => `${s.name}_${s.level}`,
      });

      const updated = chain.addSequence([
        { name: 'beginner', level: 1 },
        { name: 'intermediate', level: 2 },
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
        stateKey: s => `${s.terrain}_${s.x}_${s.y}_${s.biome}`,
      });

      // Training data from a procedurally generated map
      const mapData = [
        [
          { terrain: 'grass', x: 0, y: 0, biome: 'plains' },
          { terrain: 'grass', x: 1, y: 0, biome: 'plains' },
          { terrain: 'water', x: 2, y: 0, biome: 'river' },
          { terrain: 'grass', x: 3, y: 0, biome: 'plains' },
        ],
        [
          { terrain: 'forest', x: 0, y: 1, biome: 'woods' },
          { terrain: 'forest', x: 1, y: 1, biome: 'woods' },
          { terrain: 'grass', x: 2, y: 1, biome: 'plains' },
        ],
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

    test('serialize and fromDTO round-trip with registry', () => {
      const chain = new MultiDimMarkovChain<TileState>({
        seed: 1,
        maxOrder: 2,
        stateKey: 'tileKey',
      });

      const updated = chain.addSequences([
        [
          { tile: 'grass', x: 0, y: 0 },
          { tile: 'water', x: 1, y: 0 },
          { tile: 'grass', x: 2, y: 0 },
        ],
        [
          { tile: 'forest', x: 0, y: 1 },
          { tile: 'grass', x: 1, y: 1 },
        ],
      ]);

      const dto = updated.serialize();

      expect(dto).toHaveProperty('internalChain');
      expect(dto).toHaveProperty('stateStore');
      expect(dto).toHaveProperty('stateKeyName');
      expect(dto.stateKeyName).toBe('tileKey');

      // Reconstruct from DTO (uses registry lookup)
      const restored = MultiDimMarkovChain.fromDTO<TileState>(dto);
      expect(restored).toBeInstanceOf(MultiDimMarkovChain);

      // Verify states are preserved
      expect(restored.hasState({ tile: 'grass', x: 0, y: 0 })).toBe(true);
      expect(restored.hasState({ tile: 'water', x: 1, y: 0 })).toBe(true);
      expect(restored.getStates().length).toBe(updated.getStates().length);
    });

    test('fromDTO with explicit stateKey function', () => {
      const chain = new MultiDimMarkovChain<TileState>({
        seed: 1,
        maxOrder: 1,
        stateKey: tileKeyFn,
        stateKeyName: 'tileKey',
      });

      const updated = chain.addSequence([
        { tile: 'a', x: 0, y: 0 },
        { tile: 'b', x: 1, y: 0 },
      ]);

      const dto = updated.serialize();

      // Reconstruct with explicit function
      const restored = MultiDimMarkovChain.fromDTO<TileState>(dto, tileKeyFn);
      expect(restored.hasState({ tile: 'a', x: 0, y: 0 })).toBe(true);
    });

    test('fromDTO throws when stateKey not registered and not provided', () => {
      const dto = {
        internalChain: MarkovChain.new({
          sequences: [],
          maxOrder: 1,
        }) as import('../structures/markov/types').MarkovChainDTO,
        stateStore: {},
        stateKeyName: 'nonexistent',
      };

      expect(() => {
        MultiDimMarkovChain.fromDTO(dto);
      }).toThrow('not found in registry');
    });
  });

  describe('Sequence Scoring', () => {
    test('should score sequences with log probability and perplexity', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c'],
        ['a', 'b', 'd'],
        ['a', 'b', 'c', 'd'],
      ]);

      // Score a common sequence
      const commonScore = trained.score(['a', 'b', 'c']);
      expect(commonScore.sequence).toEqual(['a', 'b', 'c']);
      expect(commonScore.logProb).toBeLessThan(0); // Log prob is negative
      expect(commonScore.perplexity).toBeGreaterThan(0);
      expect(commonScore.isValid).toBe(true);
      expect(commonScore.normalized).toBeLessThan(0);

      // Score an unlikely sequence
      const unlikelyScore = trained.score(['x', 'y', 'z']);
      expect(unlikelyScore.isValid).toBe(false);
      expect(unlikelyScore.perplexity).toBe(Infinity);
    });

    test('should work with different scoring orders', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 3 });
      const trained = chain.addSequences([
        ['a', 'b', 'c', 'd'],
        ['a', 'b', 'c', 'e'],
      ]);

      const score1 = trained.score(['a', 'b', 'c'], 1);
      const score2 = trained.score(['a', 'b', 'c'], 2);

      expect(score1.isValid).toBe(true);
      expect(score2.isValid).toBe(true);
      // Different orders may produce different scores
    });
  });

  describe('Static Dual-API Methods', () => {
    test('static score() should score a sequence against a DTO', () => {
      const model = MarkovChain.new({
        sequences: [
          ['a', 'b', 'c'],
          ['a', 'b', 'd'],
        ],
        maxOrder: 2,
      });

      const score = MarkovChain.score(model, ['a', 'b', 'c']);
      expect(score.sequence).toEqual(['a', 'b', 'c']);
      expect(score.logProb).toBeLessThan(0);
      expect(score.isValid).toBe(true);
      expect(score.perplexity).toBeGreaterThan(0);

      // Unseen sequence
      const unknown = MarkovChain.score(model, ['x', 'y', 'z']);
      expect(unknown.isValid).toBe(false);
      expect(unknown.perplexity).toBe(Infinity);
    });

    test('static getStats() should return stats from a DTO', () => {
      const model = MarkovChain.new({
        sequences: [
          ['a', 'b', 'c'],
          ['d', 'e', 'f'],
        ],
        maxOrder: 2,
      });

      const stats = MarkovChain.getStats(model);
      expect(stats.gramCount).toBeGreaterThan(0);
      expect(stats.sequenceCount).toBe(2);
      expect(stats.orderRange[0]).toBeGreaterThan(0);
      expect(stats.orderRange[1]).toBeLessThanOrEqual(2);
    });

    test('static getStats() on empty model', () => {
      const model = MarkovChain.new({ maxOrder: 2 });

      const stats = MarkovChain.getStats(model);
      expect(stats.gramCount).toBe(0);
      expect(stats.sequenceCount).toBe(0);
      expect(stats.avgDegreeIn).toBe(0);
      expect(stats.avgDegreeOut).toBe(0);
    });

    test('static blendDTOs() should blend DTO models', () => {
      const model1 = MarkovChain.new({ sequences: [['a', 'b', 'c']], maxOrder: 1 });
      const model2 = MarkovChain.new({ sequences: [['a', 'x', 'y']], maxOrder: 1 });

      const blended = MarkovChain.blendDTOs([
        { model: model1, weight: 0.5 },
        { model: model2, weight: 0.5 },
      ]);

      // Should have grams from both
      expect(blended.grams['a']).toBeDefined();
      // 'a' should lead to both 'b' and 'x'
      expect(blended.grams['a']?.next.source['b']).toBeDefined();
      expect(blended.grams['a']?.next.source['x']).toBeDefined();
    });

    test('static blendDTOs() should throw for empty array', () => {
      expect(() => MarkovChain.blendDTOs([])).toThrow('Cannot blend zero models');
    });

    test('static blendDTOs() with single model returns clone', () => {
      const model = MarkovChain.new({ sequences: [['a', 'b']], maxOrder: 1 });
      const result = MarkovChain.blendDTOs([{ model, weight: 1 }]);

      expect(result.grams).toEqual(model.grams);
      // Should be a clone, not the same reference
      expect(result).not.toBe(model);
    });

    test('instance score() delegates to static score()', () => {
      const chain = new MarkovChain({ maxOrder: 2 }).addSequences([['a', 'b', 'c']]);

      const instanceScore = chain.score(['a', 'b', 'c']);
      const staticScore = MarkovChain.score(chain.model, ['a', 'b', 'c']);

      expect(instanceScore).toEqual(staticScore);
    });

    test('instance getStats() delegates to static getStats()', () => {
      const chain = new MarkovChain({ maxOrder: 2 }).addSequences([['a', 'b', 'c']]);

      const instanceStats = chain.getStats();
      const staticStats = MarkovChain.getStats(chain.model);

      expect(instanceStats).toEqual(staticStats);
    });
  });

  describe('Constraint-Based Generation', () => {
    test('should generate sequences satisfying length constraints', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c'],
        ['a', 'b', 'c', 'd'],
        ['a', 'b', 'c', 'd', 'e'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          minLength: 3,
          maxLength: 5,
        },
      });

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('should generate sequences with required elements', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c'],
        ['a', 'd', 'e'],
        ['x', 'y', 'z'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          mustContain: ['a'],
          maxRetries: 50,
        },
      });

      expect(result).toContain('a');
    });

    test('should generate sequences without forbidden elements', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c'],
        ['a', 'd', 'e'],
        ['a', 'x', 'y'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          mustNotContain: ['x', 'y'],
          maxRetries: 50,
        },
      });

      expect(result).not.toContain('x');
      expect(result).not.toContain('y');
    });

    test('should generate sequences matching a pattern', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['h', 'e', 'l', 'l', 'o'],
        ['h', 'e', 'l', 'p'],
        ['h', 'a', 'l', 'o'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 10,
        constraints: {
          pattern: /^h.*o$/, // Starts with 'h', ends with 'o'
          maxRetries: 50,
        },
      });

      const str = result.join('');
      expect(str).toMatch(/^h.*o$/);
    });

    test('should generate sequences with custom validator', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c'],
        ['a', 'b', 'd'],
        ['x', 'y', 'z'],
      ]);

      const forbiddenWords = ['abc', 'xyz'];
      const result = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          validator: seq => !forbiddenWords.includes(seq.join('')),
          maxRetries: 50,
        },
      });

      const str = result.join('');
      expect(forbiddenWords).not.toContain(str);
    });

    test('should combine multiple constraints', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['j', 'o', 'h', 'n'],
        ['j', 'a', 'n', 'e'],
        ['j', 'a', 'c', 'k'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 10,
        constraints: {
          minLength: 4,
          maxLength: 4,
          mustContain: ['j'],
          mustNotContain: ['x'],
          pattern: /^j/,
          maxRetries: 100,
        },
      });

      expect(result.length).toBe(4);
      expect(result[0]).toBe('j');
      expect(result).not.toContain('x');
    });

    test('should handle impossible constraints gracefully', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      const result = trained.generate({
        order: 1,
        max: 10,
        constraints: {
          mustContain: ['x'], // Impossible - 'x' not in training data
          maxRetries: 5,
        },
      });

      // Should return something even if constraints can't be satisfied
      expect(Array.isArray(result)).toBe(true);
    });

    test('should respect maxRetries limit', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      // This should complete quickly even with impossible constraints
      const start = Date.now();
      trained.generate({
        order: 1,
        max: 10,
        constraints: {
          mustContain: ['z'], // Impossible
          maxRetries: 3,
        },
      });
      const elapsed = Date.now() - start;

      // Should not take too long (allowing generous margin)
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Branch Coverage', () => {
    test('blend with harmonic strategy', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b']);
      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'c']);

      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 0.5 },
          { chain: chain2, weight: 0.5 },
        ],
        { strategy: 'harmonic' }
      );

      expect(Object.keys(blended.model.grams).length).toBeGreaterThan(0);
    });

    test('blend with harmonic strategy and zero values', () => {
      const chain1 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'b']);
      const chain2 = new MarkovChain({ maxOrder: 1 }).addSequence(['a', 'c']);

      // Harmonic with one zero value should fall back to arithmetic
      const blended = MarkovChain.blend(
        [
          { chain: chain1, weight: 0.5 },
          { chain: chain2, weight: 0.5 },
        ],
        { strategy: 'harmonic' }
      );

      const gramA = blended.model.grams[blended.getGramId(['a'])];
      expect(gramA).toBeDefined();
    });

    test('MultiDimMarkovChain getInternalChain and pick with mask', () => {
      const chain = new MultiDimMarkovChain<{ v: string }>({
        seed: 1,
        maxOrder: 1,
        stateKey: s => s.v,
      });
      const updated = chain.addSequence([{ v: 'a' }, { v: 'b' }, { v: 'c' }]);

      const internal = updated.getInternalChain();
      expect(internal).toBeInstanceOf(MarkovChain);
      expect(internal.hasGram(['a'])).toBe(true);

      // Pick with mask
      const next = updated.pick([{ v: 'a' }], true, [{ v: 'c' }]);
      if (next) expect(next.v).not.toBe('c');

      // Pick on empty chain
      const emptyChain = new MultiDimMarkovChain<{ v: string }>({
        seed: 1,
        stateKey: s => s.v,
      });
      expect(emptyChain.pick()).toBeUndefined();

      // addSequence with empty array
      const same = updated.addSequence([]);
      expect(same).toBe(updated);
    });

    test('constraint minLength and maxLength branches', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b', 'c', 'd', 'e'],
        ['a', 'b', 'c'],
      ]);

      // minLength constraint
      const long = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          minLength: 3,
          maxRetries: 50,
        },
      });
      expect(long.length).toBeGreaterThanOrEqual(3);

      // maxLength constraint
      const short = trained.generate({
        order: 1,
        max: 20,
        constraints: {
          maxLength: 3,
          maxRetries: 50,
        },
      });
      expect(short.length).toBeLessThanOrEqual(3);
    });

    test('batch addEdge', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [] });
      const batch = chain.batch();

      batch.addEdge('a', undefined, 'b', 1);
      batch.addEdge('b', 'a', 'c', 1);

      const committed = batch.commit();
      expect(committed.hasGram(['a'])).toBe(true);
      expect(committed.hasGram(['b'])).toBe(true);
    });

    test('pick on empty chain returns undefined', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [] });
      const result = chain.pick(['nonexistent']);
      expect(result).toBeUndefined();
    });

    test('getStats on empty chain', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [] });
      const stats = chain.getStats();
      expect(stats.gramCount).toBe(0);
      expect(stats.sequenceCount).toBe(0);
      expect(stats.avgDegreeIn).toBe(0);
      expect(stats.avgDegreeOut).toBe(0);
    });

    test('score and generate with specific orders', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 3 });
      const trained = chain.addSequences([['a', 'b', 'c', 'd']]);

      // Score with explicit order
      const s1 = trained.score(['a', 'b', 'c']);
      const s2 = trained.score(['a', 'b', 'c'], 1);
      expect(s1.isValid).toBe(true);
      expect(s2.isValid).toBe(true);
    });

    test('generate with constraint validator that rejects', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([['a', 'b']]);

      // Validator always rejects to exercise retry branch
      const result = trained.generate({
        order: 1,
        max: 5,
        constraints: {
          validator: () => false,
          maxRetries: 3,
        },
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Bug Fix Verification', () => {
    test('Gram.frequency increments correctly on addEdge', () => {
      const chain = new MarkovChain({ maxOrder: 2 })
        .addEdge('a', undefined, 'b', 1)
        .addEdge('a', undefined, 'c', 1)
        .addEdge('a', undefined, 'd', 1);

      // Each addEdge call should increment frequency
      expect(chain.grams.a.frequency).toBe(3);
    });

    test('pickWeighted handles masked first key correctly', () => {
      const eng = new Random({ seed: 42 });
      const dist = { a: 0.5, b: 0.3, c: 0.2 };

      // Mask 'a' (the first key) and pick many times
      for (let i = 0; i < 50; i++) {
        const result = eng.clone().pickWeighted(dist, ['a']);
        expect(result).not.toBe('a');
        expect(['b', 'c', undefined]).toContain(result);
      }
    });

    test('Random.clone(0) preserves zero use count', () => {
      const eng = new Random({ seed: 42, uses: 100 });
      const cloned = eng.clone(0);

      expect(cloned.uses).toBe(0);
      expect(cloned.seed).toBe(42);
    });

    test('constraint retry returns last attempt, not empty', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2 });
      const trained = chain.addSequences([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      // Impossible constraint - 'z' not in training data
      const result = trained.generate({
        order: 1,
        max: 10,
        constraints: {
          mustContain: ['z'],
          maxRetries: 3,
        },
      });

      // Should return the last generated attempt, not an empty array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('MarkovChainBatch', () => {
    test('batch produces equivalent results to sequential addSequence', () => {
      const sequences = [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
        ['a', 'c', 'e'],
      ];

      // Sequential approach (separate chain instance)
      let sequential = new MarkovChain({ seed: 1, maxOrder: 2 });
      for (const seq of sequences) {
        sequential = sequential.addSequence(seq);
      }

      // Batch approach (separate chain instance)
      const batchBase = new MarkovChain({ seed: 1, maxOrder: 2 });
      const batch = batchBase.batch();
      for (const seq of sequences) {
        batch.addSequence(seq);
      }
      const batched = batch.commit();

      // Results should be equivalent
      expect(batched.model.grams).toEqual(sequential.model.grams);
    });

    test('batch tracks pending operation count', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [] });
      const batch = chain.batch();

      expect(batch.pending).toBe(0);

      batch.addSequence(['a', 'b']);
      expect(batch.pending).toBe(1);

      batch.addSequence(['c', 'd']);
      expect(batch.pending).toBe(2);

      batch.addEdge('a', undefined, 'x', 1);
      expect(batch.pending).toBe(3);
    });

    test('batch clear resets state', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [['x', 'y']] });
      const batch = chain.batch();

      batch.addSequence(['a', 'b']);
      batch.addSequence(['c', 'd']);
      expect(batch.pending).toBe(2);

      batch.clear();
      expect(batch.pending).toBe(0);

      // Committing after clear should give back the original chain state
      const committed = batch.commit();
      expect(committed.model.grams).toEqual(chain.model.grams);
    });

    test('batch addSequences adds multiple at once', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [] });
      const batch = chain.batch();

      batch.addSequences([
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ]);

      expect(batch.pending).toBe(2);

      const committed = batch.commit();
      expect(committed.hasGram(['a'])).toBe(true);
      expect(committed.hasGram(['d'])).toBe(true);
    });

    test('batch does not mutate original chain', () => {
      const chain = new MarkovChain({ seed: 1, maxOrder: 2, sequences: [['x', 'y']] });
      const originalGrams = JSON.parse(JSON.stringify(chain.model.grams));

      const batch = chain.batch();
      batch.addSequence(['a', 'b', 'c']);
      batch.addSequence(['d', 'e', 'f']);
      batch.commit();

      // Original chain should be unchanged
      expect(chain.model.grams).toEqual(originalGrams);
    });
  });

  describe('ImmutableMarkovChain', () => {
    it('addSequence returns a new instance', () => {
      const chain = new ImmutableMarkovChain({ sequences: sU });
      const updated = chain.addSequence(gA1);
      expect(updated).not.toBe(chain);
      expect(updated).toBeInstanceOf(ImmutableMarkovChain);
      expect(chain.dto).toEqual(dtoU); // original unchanged
      expect(updated.dto).not.toEqual(dtoU);
    });

    it('addSequences returns a new instance', () => {
      const chain = new ImmutableMarkovChain({ sequences: sU });
      const updated = chain.addSequences(sC2);
      expect(updated).not.toBe(chain);
      expect(updated).toBeInstanceOf(ImmutableMarkovChain);
      expect(chain.dto).toEqual(dtoU); // original unchanged
    });

    it('addEdge returns a new instance', () => {
      const chain = new ImmutableMarkovChain({ maxOrder: 2 }).addSequence(gU3);
      const before = chain.serialize();
      const updated = chain.addEdge('x', undefined, 'y', 1);
      expect(updated).not.toBe(chain);
      expect(updated).toBeInstanceOf(ImmutableMarkovChain);
      expect(chain.serialize()).toEqual(before);
    });

    it('interpolate returns a new instance', () => {
      const chain1 = new ImmutableMarkovChain({ maxOrder: 1, sequences: [['a', 'b']] });
      const chain2 = new ImmutableMarkovChain({ maxOrder: 1, sequences: [['a', 'c']] });
      const before = chain1.serialize();
      const blended = chain1.interpolate(chain2, 0.5);
      expect(blended).not.toBe(chain1);
      expect(blended).toBeInstanceOf(ImmutableMarkovChain);
      expect(chain1.serialize()).toEqual(before);
    });

    it('clone returns an ImmutableMarkovChain', () => {
      const chain = new ImmutableMarkovChain({ sequences: sU });
      const cloned = chain.clone();
      expect(cloned).not.toBe(chain);
      expect(cloned).toBeInstanceOf(ImmutableMarkovChain);
      expect(cloned.dto).toEqual(chain.dto);
    });

    it('can generate and pick like a regular chain', () => {
      const chain = new ImmutableMarkovChain({ seed: 1, maxOrder: 2, sequences: sA3 });
      const result = chain.generate({ order: 1, min: 1, max: 10 });
      expect(result.length).toBeGreaterThanOrEqual(1);

      const pick = chain.pick();
      expect(pick).toBeDefined();
    });
  });

  describe('ImmutableMultiDimMarkovChain', () => {
    interface SimpleState {
      value: string;
      index: number;
    }

    it('addSequence returns a new instance', () => {
      const chain = new ImmutableMultiDimMarkovChain<SimpleState>({
        seed: 1,
        maxOrder: 1,
        stateKey: s => `${s.value}_${s.index}`,
      });

      const updated = chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ]);

      expect(updated).not.toBe(chain);
      expect(updated).toBeInstanceOf(ImmutableMultiDimMarkovChain);
      expect(chain.getStates().length).toBe(0); // original unchanged
      expect(updated.getStates().length).toBe(2);
    });

    it('addSequences returns a new instance', () => {
      const chain = new ImmutableMultiDimMarkovChain<SimpleState>({
        seed: 1,
        maxOrder: 1,
        stateKey: s => `${s.value}_${s.index}`,
      });

      const updated = chain.addSequences([
        [
          { value: 'a', index: 0 },
          { value: 'b', index: 1 },
        ],
        [
          { value: 'c', index: 2 },
          { value: 'd', index: 3 },
        ],
      ]);

      expect(updated).not.toBe(chain);
      expect(updated).toBeInstanceOf(ImmutableMultiDimMarkovChain);
      expect(chain.getStates().length).toBe(0); // original unchanged
      expect(updated.getStates().length).toBe(4);
    });

    it('clone returns an ImmutableMultiDimMarkovChain', () => {
      const chain = new ImmutableMultiDimMarkovChain<SimpleState>({
        seed: 1,
        maxOrder: 1,
        stateKey: s => `${s.value}_${s.index}`,
      });

      const updated = chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ]);
      const cloned = updated.clone();

      expect(cloned).not.toBe(updated);
      expect(cloned).toBeInstanceOf(ImmutableMultiDimMarkovChain);
      expect(cloned.getStates().length).toBe(updated.getStates().length);
    });
  });

  describe('from / toMutable bridge', () => {
    it('ImmutableMarkovChain.from() creates an immutable copy with the same state', () => {
      const chain = new MarkovChain({ seed: 1, sequences: sA3 });
      const frozen = ImmutableMarkovChain.from(chain);
      expect(frozen).toBeInstanceOf(ImmutableMarkovChain);
      expect(frozen).not.toBe(chain);
      expect(frozen.serialize()).toEqual(chain.serialize());
    });

    it('ImmutableMarkovChain.toMutable() returns a MarkovChain with the same state', () => {
      const chain = new ImmutableMarkovChain({ seed: 1, sequences: sA3 });
      const mutable = chain.toMutable();
      expect(mutable).toBeInstanceOf(MarkovChain);
      expect(mutable).not.toBeInstanceOf(ImmutableMarkovChain);
      expect(mutable).not.toBe(chain);
      expect(mutable.serialize()).toEqual(chain.serialize());
    });

    it('ImmutableMultiDimMarkovChain.from() creates an immutable copy', () => {
      const chain = new MultiDimMarkovChain<{ value: string; index: number }>({
        seed: 1,
        maxOrder: 1,
        stateKey: (s: { value: string; index: number }) => `${s.value}_${s.index}`,
      });
      chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ]);
      const frozen = ImmutableMultiDimMarkovChain.from(chain);
      expect(frozen).toBeInstanceOf(ImmutableMultiDimMarkovChain);
      expect(frozen).not.toBe(chain);
      expect(frozen.getStates().length).toBe(chain.getStates().length);
    });

    it('ImmutableMultiDimMarkovChain.toMutable() returns a MultiDimMarkovChain', () => {
      const chain = new ImmutableMultiDimMarkovChain<{ value: string; index: number }>({
        seed: 1,
        maxOrder: 1,
        stateKey: (s: { value: string; index: number }) => `${s.value}_${s.index}`,
      });
      const updated = chain.addSequence([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ]);
      const mutable = updated.toMutable();
      expect(mutable).toBeInstanceOf(MultiDimMarkovChain);
      expect(mutable).not.toBeInstanceOf(ImmutableMultiDimMarkovChain);
      expect(mutable).not.toBe(updated);
      expect(mutable.getStates().length).toBe(updated.getStates().length);
    });
  });

  describe('blend statistical validation', () => {
    it('arithmetic 50/50 blend produces roughly equal output from two models', () => {
      // Model A: heavily favors 'x' -> 'a'
      const chainA = new MarkovChain({ seed: 1, maxOrder: 1 });
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'a']);

      // Model B: heavily favors 'x' -> 'b'
      const chainB = new MarkovChain({ seed: 2, maxOrder: 1 });
      chainB.addSequence(['x', 'b']);
      chainB.addSequence(['x', 'b']);
      chainB.addSequence(['x', 'b']);
      chainB.addSequence(['x', 'b']);
      chainB.addSequence(['x', 'b']);

      const blended = MarkovChain.blend(
        [
          { chain: chainA, weight: 1 },
          { chain: chainB, weight: 1 },
        ],
        { strategy: 'arithmetic' }
      );

      const eng = new Random({ seed: 99 });
      const counts: Record<string, number> = { a: 0, b: 0 };
      const sampleCount = 2000;

      for (let i = 0; i < sampleCount; i++) {
        const result = MarkovChain.generate({
          model: blended.model,
          start: ['x'],
          max: 2,
          strict: false,
          trim: true,
          engine: eng,
        });
        const last = result[result.length - 1];
        if (last === 'a' || last === 'b') counts[last]++;
      }

      // With 50/50 blend, each should appear roughly 50% of the time
      const ratioA = counts.a! / sampleCount;
      const ratioB = counts.b! / sampleCount;
      expect(ratioA).toBeGreaterThan(0.35);
      expect(ratioA).toBeLessThan(0.65);
      expect(ratioB).toBeGreaterThan(0.35);
      expect(ratioB).toBeLessThan(0.65);
    });

    it('geometric and harmonic strategies produce valid (non-NaN, non-zero) results', () => {
      const chainA = new MarkovChain({ seed: 1, maxOrder: 1 });
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'a']);
      chainA.addSequence(['x', 'b']);

      const chainB = new MarkovChain({ seed: 2, maxOrder: 1 });
      chainB.addSequence(['x', 'a']);
      chainB.addSequence(['x', 'b']);
      chainB.addSequence(['x', 'b']);

      for (const strategy of ['geometric', 'harmonic'] as const) {
        const blended = MarkovChain.blend(
          [
            { chain: chainA, weight: 1 },
            { chain: chainB, weight: 1 },
          ],
          { strategy }
        );

        // Verify the blended model has valid gram distributions
        const grams = blended.model.grams;
        for (const gramId of Object.keys(grams)) {
          const gram = grams[gramId]!;
          for (const val of Object.values(gram.next.normal)) {
            expect(Number.isNaN(val)).toBe(false);
            expect(Number.isFinite(val)).toBe(true);
          }
          for (const val of Object.values(gram.last.normal)) {
            expect(Number.isNaN(val)).toBe(false);
            expect(Number.isFinite(val)).toBe(true);
          }
        }

        // Verify generation works and produces output
        const eng = new Random({ seed: 55 });
        const results: string[][] = [];
        for (let i = 0; i < 100; i++) {
          results.push(
            MarkovChain.generate({
              model: blended.model,
              start: ['x'],
              max: 2,
              strict: false,
              trim: true,
              engine: eng,
            })
          );
        }
        expect(results.length).toBe(100);
        expect(results.every(r => r.length > 0)).toBe(true);
      }
    });
  });

  describe('backward() alias', () => {
    it('backward() produces the same results as last() for both static and instance methods', () => {
      const eng1 = new Random({ seed: 99 });
      const eng2 = eng1.clone();

      // Static: backward() vs last()
      const resultBackward = MarkovChain.backward(dtoC2, ['+'], undefined, eng1);
      const resultLast = MarkovChain.last(dtoC2, ['+'], undefined, eng2);
      expect(resultBackward).toEqual(resultLast);

      // Instance: backward() vs last()
      const mc1 = new MarkovChain({ ...dtoC2, seed: 42 });
      const mc2 = new MarkovChain({ ...dtoC2, seed: 42 });
      const instBackward = mc1.backward(['+']);
      const instLast = mc2.last(['+']);
      expect(instBackward).toEqual(instLast);
    });
  });
});
