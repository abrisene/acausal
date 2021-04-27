/*
 # distribution.test.js
 # Distribution Class Test
 */

/**
 # Module Dependencies
 */

import {
  Distribution,
  DistributionDTO,
  CONSTANTS,
  Random,
  WeightedDistribution,
} from '..';

/**
 # Utility Functions
 */

function addObjects(...objects: WeightedDistribution[]) {
  const result: WeightedDistribution = {};
  for (const object of objects) {
    for (const key of Object.keys(object)) {
      if (result[key] === undefined) result[key] = 0;
      result[key] += object[key];
    }
  }
  return result;
}

function stripSource(dto: DistributionDTO) {
  return Distribution.clone(dto, true);
}

/**
 # Constants
 */

// Engine
const engine = new Random({ seed: 50 });

// Additions
const addA1 = { a: 1 };
const addAB1 = { a: 1, b: 1 };
const addABC1 = { a: 1, b: 1, c: 1 };

const addA10p = { a: 0.1 };
// const addAB10p = { a: 0.10, b: 0.10 };
// const addABC10p = { a: 0.10, b: 0.10, c: 0.10 };

// const addA50p = { a: 0.5 };
const addAB50p = { a: 0.5, b: 0.5 };
// const addABC50p = { a: 0.5, b: 0.5, c: 0.5 };

const swapAB10p = { a: -0.1, b: 0.1 };

// DTOs
const dtoDefault = { source: {}, normal: {} };

const dtoEmpty = Distribution.new();

const dtoEmptyAddAB1Expected = { source: addAB1, normal: addAB50p };

// Unit DTO
const sourceU1: WeightedDistribution = { a: 1 };
const sourceU2: WeightedDistribution = { a: 1, b: 1 };
const sourceU3: WeightedDistribution = { a: 1, b: 1, c: 2 };

const dtoU1 = Distribution.new(sourceU1);
const dtoU2 = Distribution.new(sourceU2);
const dtoU3 = Distribution.new(sourceU3);

const dtoU1Expected = { source: sourceU1, normal: { a: 1 } };
const dtoU2Expected = { source: sourceU2, normal: { a: 0.5, b: 0.5 } };
const dtoU3Expected = {
  source: sourceU3,
  normal: { a: 0.25, b: 0.25, c: 0.5 },
};

const dtoU1AddA10pExpected = { source: addObjects(sourceU1), normal: { a: 1 } };
const dtoU1AddB100pExpected = {
  source: { a: 0.5, b: 0.5 },
  normal: { a: 0.5, b: 0.5 },
};
// const dtoU1AddAB10pExpected = { source: { a: (1.1 / 1.2), b: (0.1 / 1.2) }, normal: { a: (1.1 / 1.2), b: (0.1 / 1.2) } };

// Mixed DTO
const sourceA1: WeightedDistribution = { a: 1, b: 2 };
const sourceA2: WeightedDistribution = { a: 1, b: 3 };
const sourceA3: WeightedDistribution = { a: 2, b: 5 };

const dtoA1 = Distribution.new(sourceA1);
const dtoA2 = Distribution.new(sourceA2);
const dtoA3 = Distribution.new(sourceA3);

const dtoA1AddA1Expected = {
  source: addObjects(sourceA1, addA1),
  normal: { a: 0.5, b: 0.5 },
};
const dtoA2AddAB1Expected = {
  source: addObjects(sourceA2, addAB1),
  normal: { a: 2 / 6, b: 4 / 6 },
};
const dtoA3AddABC1Expected = {
  source: addObjects(sourceA3, addABC1),
  normal: { a: 0.3, b: 0.6, c: 0.1 },
};

// Mixed DTO for Rescaling
const sourceB1: WeightedDistribution = { a: 6, b: 4 };
const sourceB2: WeightedDistribution = { a: 6, b: 3, c: 1 };
const sourceB3: WeightedDistribution = { a: 7, b: 1, c: 1, d: 1 };

const dtoB1 = Distribution.new(sourceB1);
const dtoB2 = Distribution.new(sourceB2);
const dtoB3 = Distribution.new(sourceB3);

const dtoB1SwapAB10pExpected = {
  source: { a: 5, b: 5 },
  normal: { a: 0.5, b: 0.5 },
};
const dtoB2SwapAB10pExpected = {
  source: { a: 5, b: 4, c: 1 },
  normal: { a: 0.5, b: 0.4, c: 0.1 },
};
const dtoB3SwapAB10pExpected = {
  source: { a: 6, b: 2, c: 1, d: 1 },
  normal: { a: 0.6, b: 0.2, c: 0.1, d: 0.1 },
};

// Distribution Instances

// Picks
const pickOneU1 = Distribution.pickOne(dtoU1, undefined, engine);
const pickOneU2 = Distribution.pickOne(dtoU2, undefined, engine);
const pickOneU3 = Distribution.pickOne(dtoU3, undefined, engine);

const pickOneMaskU1 = Distribution.pickOne(dtoU1, ['a'], engine);
const pickOneMaskU2 = Distribution.pickOne(dtoU2, ['a'], engine);
const pickOneMaskU3 = Distribution.pickOne(dtoU3, ['a', 'b'], engine);

const pickFiveMaskU3 = Distribution.pick(dtoU3, 5, ['a', 'b'], false, engine);

const pickTwoU3 = Distribution.pick(dtoU3, 2);
const pickFiveU3 = Distribution.pick(dtoU3, 5);
const pickTwentyU3 = Distribution.pick(dtoU3, 20);

const sampleCount = 50000;
const sampleB3 = Distribution.pick(
  dtoB3,
  sampleCount,
  undefined,
  false,
  engine
);
const sampleB3Summary = sampleB3.reduce((l, k) => {
  const result = { ...l };
  if (result[k] === undefined) result[k] = 0;
  result[k] += 1;
  return result;
}, {} as WeightedDistribution);

/**
 # Tests
 */

describe('Distribution', () => {
  describe('static methods', () => {
    it('can create new distributions.', () => {
      // Empty
      expect(dtoEmpty).toEqual(dtoDefault);
      expect(dtoEmpty).toHaveProperty('source');
      expect(dtoEmpty).toHaveProperty('normal');
      expect(dtoEmpty.source).toEqual({});
      expect(dtoEmpty.normal).toEqual({});

      // With Values
      expect(dtoU1).toEqual(dtoU1Expected);
      expect(dtoU1).toHaveProperty('source');
      expect(dtoU1).toHaveProperty('normal');
      expect(dtoU1.source).toEqual(dtoU1Expected.source);
      expect(dtoU1.normal).toEqual(dtoU1Expected.normal);

      expect(dtoU2).toEqual(dtoU2Expected);
      expect(dtoU2).toHaveProperty('source');
      expect(dtoU2).toHaveProperty('normal');
      expect(dtoU2.source).toEqual(dtoU2Expected.source);
      expect(dtoU2.normal).toEqual(dtoU2Expected.normal);

      expect(dtoU3).toEqual(dtoU3Expected);
      expect(dtoU3).toHaveProperty('source');
      expect(dtoU3).toHaveProperty('normal');
      expect(dtoU3.source).toEqual(dtoU3Expected.source);
      expect(dtoU3.normal).toEqual(dtoU3Expected.normal);
    });
    it('can clone existing distributions.', () => {
      // Direct Clones
      expect(Distribution.clone(dtoDefault, false)).toEqual(dtoDefault);
      expect(Distribution.clone(dtoU1, false)).toEqual(dtoU1);
      expect(Distribution.clone(dtoU2, false)).toEqual(dtoU2);
      expect(Distribution.clone(dtoU3, false)).toEqual(dtoU3);
      expect(Distribution.clone(dtoA1, false)).toEqual(dtoA1);
      expect(Distribution.clone(dtoA2, false)).toEqual(dtoA2);
      expect(Distribution.clone(dtoA3, false)).toEqual(dtoA3);

      // Stripping Sources
      expect(Distribution.clone(dtoDefault, true)).toEqual({
        normal: dtoDefault.normal,
      });
      expect(Distribution.clone(dtoU1, true)).toEqual({ normal: dtoU1.normal });
      expect(Distribution.clone(dtoU2, true)).toEqual({ normal: dtoU2.normal });
      expect(Distribution.clone(dtoU3, true)).toEqual({ normal: dtoU3.normal });
      expect(Distribution.clone(dtoA1, true)).toEqual({ normal: dtoA1.normal });
      expect(Distribution.clone(dtoA2, true)).toEqual({ normal: dtoA2.normal });
      expect(Distribution.clone(dtoA3, true)).toEqual({ normal: dtoA3.normal });
    });
    it('can add one or more values to a source.', () => {
      // Multi-Value
      expect(Distribution.addSourceValues(dtoEmpty, addAB1)).toEqual(
        dtoEmptyAddAB1Expected
      );
      expect(Distribution.addSourceValues(dtoA1, addA1)).toEqual(
        dtoA1AddA1Expected
      );
      expect(Distribution.addSourceValues(dtoA2, addAB1)).toEqual(
        dtoA2AddAB1Expected
      );
      expect(Distribution.addSourceValues(dtoA3, addABC1)).toEqual(
        dtoA3AddABC1Expected
      );

      // Single Value
      expect(Distribution.addSourceValue(dtoA1, 'a', 1)).toEqual(
        dtoA1AddA1Expected
      );
      expect(Distribution.add(dtoA1, 'a', 1)).toEqual(dtoA1AddA1Expected);
    });
    it('can add one or more values to a normal distribution.', () => {
      // Multi-Value
      expect(Distribution.addNormalValues(dtoU1, addA10p)).toEqual(
        dtoU1AddA10pExpected
      );
      expect(Distribution.addNormalValues(dtoB1, swapAB10p)).toEqual(
        dtoB1SwapAB10pExpected
      );
      expect(Distribution.addNormalValues(dtoB2, swapAB10p)).toEqual(
        dtoB2SwapAB10pExpected
      );
      expect(Distribution.addNormalValues(dtoB3, swapAB10p)).toEqual(
        dtoB3SwapAB10pExpected
      );

      // Single Value
      expect(Distribution.addNormalValue(dtoU1, 'b', 1)).toEqual(
        dtoU1AddB100pExpected
      );

      // Multi-Value (No Source)
      expect(stripSource(Distribution.addNormalValues(dtoU1, addA10p))).toEqual(
        stripSource(dtoU1AddA10pExpected)
      );
      expect(
        stripSource(Distribution.addNormalValues(dtoB1, swapAB10p))
      ).toEqual(stripSource(dtoB1SwapAB10pExpected));
      expect(
        stripSource(Distribution.addNormalValues(dtoB2, swapAB10p))
      ).toEqual(stripSource(dtoB2SwapAB10pExpected));
      expect(
        stripSource(Distribution.addNormalValues(dtoB3, swapAB10p))
      ).toEqual(stripSource(dtoB3SwapAB10pExpected));

      // Single Value (No Source)
      expect(stripSource(Distribution.addNormalValue(dtoU1, 'b', 1))).toEqual(
        stripSource(dtoU1AddB100pExpected)
      );

      // Routing Method
      expect(stripSource(Distribution.add(dtoU1, 'b', 1))).toEqual(
        stripSource(dtoU1AddB100pExpected)
      );
    });
    it('can remove one or more values from a distribution.', () => {
      // Multi-Value
      expect(Distribution.remove(dtoU2, ['a', 'b'])).toEqual(dtoEmpty);
      expect(Distribution.remove(dtoU3, ['b', 'c'])).toEqual(dtoU1);

      // Single Value
      expect(Distribution.remove(dtoU1, 'a')).toEqual(dtoEmpty);
      expect(Distribution.remove(dtoU2, 'b')).toEqual(dtoU1);
      expect(Distribution.remove(dtoU3, 'c')).toEqual(dtoU2);

      // Multi-Value (No Source)
      expect(stripSource(Distribution.remove(dtoU2, ['a', 'b']))).toEqual(
        stripSource(dtoEmpty)
      );
      expect(stripSource(Distribution.remove(dtoU3, ['b', 'c']))).toEqual(
        stripSource(dtoU1)
      );

      expect(stripSource(Distribution.remove(dtoU1, 'a'))).toEqual(
        stripSource(dtoEmpty)
      );
      expect(stripSource(Distribution.remove(dtoU2, 'b'))).toEqual(
        stripSource(dtoU1)
      );
      expect(stripSource(Distribution.remove(dtoU3, 'c'))).toEqual(
        stripSource(dtoU2)
      );
    });
    it('can pick one or more values from a distribution.', () => {
      // Single Pick
      expect(pickOneU1).toBe('a');
      expect(pickOneU2).toBeDefined();
      expect(pickOneU3).toBeDefined();

      // Single Pick (Masked)
      expect(pickOneMaskU1).toBeUndefined();
      expect(pickOneMaskU2).toBe('b');
      expect(pickOneMaskU3).toBe('c');

      // Multi Pick
      expect(pickTwoU3.length).toBe(2);
      expect(pickFiveU3.length).toBe(5);
      expect(pickTwentyU3.length).toBe(20);

      // Multi Pick Masked
      expect(pickFiveMaskU3).toEqual(['c', 'c', 'c', 'c', 'c']);
    });
    it('samples properly over many picks.', () => {
      Object.keys(sampleB3Summary).forEach(k => {
        expect(sampleB3Summary[k] / sampleCount).toBeCloseTo(dtoB3.normal[k]);
      });
    });
  });

  describe('class methods', () => {
    it('can create new distributions.', () => {
      // Setup
      const dtoE = {};
      const dtoU = { seed: 25, ...dtoU3 };
      const dtoUs = { seed: dtoU.seed, source: dtoU.source };
      const dtoUn = { seed: dtoU.seed, normal: dtoU.normal };
      const distEmpty = new Distribution(dtoE);
      const distSource = new Distribution(dtoUs);
      const distNormal = new Distribution(dtoUn);
      // const distU1 = new Distribution(dtoU1);
      // const distA1 = new Distribution(dtoA1);

      // Empty
      expect(distEmpty.source).toEqual({});
      expect(distEmpty.normal).toEqual({});

      // With Source
      expect(distSource.source).toEqual(dtoU.source);
      expect(distSource.normal).toEqual(dtoU.normal);
      expect(distSource.seed).toEqual(dtoU.seed);
      expect(distSource.uses).toEqual(CONSTANTS.MT_PREWARM);

      // With Normal
      expect(distNormal.source).toBeUndefined();
      expect(distNormal.normal).toEqual(dtoU.normal);
      expect(distNormal.seed).toEqual(dtoU.seed);
      expect(distNormal.uses).toEqual(CONSTANTS.MT_PREWARM);
    });
    it('can clone existing distributions.', () => {
      // Setup
      const dtoU = { seed: 25, ...dtoU3 };
      const dtoA = { seed: 50, ...dtoA3 };
      const distU = new Distribution(dtoU);
      const distA = new Distribution(dtoA);
      const distUn = new Distribution({ seed: 75, normal: dtoU.normal });
      const distAn = new Distribution({ seed: 100, normal: dtoA.normal });

      // Direct Clones
      const distUClone = distU.clone();
      expect(distUClone.source).toEqual(distU.source);
      expect(distUClone.normal).toEqual(distU.normal);
      expect(distUClone.seed).toEqual(distU.seed);
      expect(distUClone.uses).toEqual(CONSTANTS.MT_PREWARM);

      const distAClone = distA.clone();
      expect(distAClone.source).toEqual(distA.source);
      expect(distAClone.normal).toEqual(distA.normal);
      expect(distAClone.seed).toEqual(distA.seed);
      expect(distAClone.uses).toEqual(CONSTANTS.MT_PREWARM);

      // Direct Clones of Sourceless Distributions
      const distUnClone = distUn.clone();
      expect(distUnClone.source).toEqual(distUn.source);
      expect(distUnClone.normal).toEqual(distUn.normal);
      expect(distUnClone.seed).toEqual(distUn.seed);
      expect(distUnClone.uses).toEqual(CONSTANTS.MT_PREWARM);

      const distAnClone = distAn.clone();
      expect(distAnClone.source).toEqual(distAn.source);
      expect(distAnClone.normal).toEqual(distAn.normal);
      expect(distAnClone.seed).toEqual(distAn.seed);
      expect(distAnClone.uses).toEqual(CONSTANTS.MT_PREWARM);

      // Stripping Sources
      const distUsClone = distUClone.clone(true);
      expect(distUsClone.source).toBeUndefined();
      expect(distUsClone.normal).toEqual(distUClone.normal);
      expect(distUsClone.seed).toEqual(distUClone.seed);
      expect(distUsClone.uses).toEqual(CONSTANTS.MT_PREWARM);

      const distAsClone = distAClone.clone(true);
      expect(distAsClone.source).toBeUndefined();
      expect(distAsClone.normal).toEqual(distAClone.normal);
      expect(distAsClone.seed).toEqual(distAClone.seed);
      expect(distAsClone.uses).toEqual(CONSTANTS.MT_PREWARM);
    });
    it('can add one or more values to a source.', () => {
      // Setup
      const dtoE = {};
      const distEmpty = new Distribution(dtoE);
      const distA1 = new Distribution(dtoA1);
      const distA2 = new Distribution(dtoA2);
      const distA3 = new Distribution(dtoA3);

      const distA1a = distA1.clone(false);

      // Multi-Value
      distEmpty.addValues(addAB1);
      expect(distEmpty.source).toEqual(dtoEmptyAddAB1Expected.source);
      expect(distEmpty.normal).toEqual(dtoEmptyAddAB1Expected.normal);

      distA1.addValues(addA1);
      expect(distA1.source).toEqual(dtoA1AddA1Expected.source);
      expect(distA1.normal).toEqual(dtoA1AddA1Expected.normal);

      distA2.addValues(addAB1);
      expect(distA2.source).toEqual(dtoA2AddAB1Expected.source);
      expect(distA2.normal).toEqual(dtoA2AddAB1Expected.normal);

      distA3.addValues(addABC1);
      expect(distA3.source).toEqual(dtoA3AddABC1Expected.source);
      expect(distA3.normal).toEqual(dtoA3AddABC1Expected.normal);

      // // Single Value
      distA1a.add('a', 1);
      expect(distA1a.source).toEqual(dtoA1AddA1Expected.source);
      expect(distA1a.normal).toEqual(dtoA1AddA1Expected.normal);
    });
    it('can add one or more values to a normal distribution.', () => {
      // Setup
      const distU1 = new Distribution({ normal: dtoU1.normal });
      const distB1 = new Distribution({ normal: dtoB1.normal });
      // const distB2 = new Distribution({ normal: dtoB2.normal });
      // const distB3 = new Distribution({ normal: dtoB3.normal });

      // Multi-Value
      // This is not currently supported.

      // // Multi-Value (No Source)
      distB1.addValues(swapAB10p);
      expect(distB1.source).toBeUndefined();
      expect(distB1.normal).toEqual(dtoB1SwapAB10pExpected.normal);

      // distB2.addValues(swapAB10p);
      // expect(distB2.source).toBeUndefined();
      // expect(distB2.normal).toEqual(dtoB2SwapAB10pExpected.normal);

      // distB3.addValues(swapAB10p);
      // expect(distB3.source).toBeUndefined();
      // expect(distB3.normal).toEqual(dtoB3SwapAB10pExpected.normal);

      // // Single Value
      distU1.add('b', 1);
      expect(distU1.source).toBeUndefined();
      expect(distU1.normal).toEqual(dtoU1AddB100pExpected.normal);
    });
    it('can remove one or more values from a distribution.', () => {
      // Setup
      const distU1a = new Distribution(dtoU1);
      const distU1b = new Distribution(dtoU1);
      // const distU1c = distU1a.clone(true);
      const distU1d = distU1a.clone(true);
      const distU2a = new Distribution(dtoU2);
      const distU2b = new Distribution(dtoU2);
      const distU2c = distU2b.clone(true);
      const distU2d = distU2b.clone(true);
      const distU3a = new Distribution(dtoU3);
      const distU3b = new Distribution(dtoU3);
      const distU3c = distU2c.clone(true);
      const distU3d = distU2c.clone(true);

      // Multi-Value

      distU2a.remove(['a', 'b']);
      expect(distU2a.source).toEqual(dtoEmpty.source);
      expect(distU2a.normal).toEqual(dtoEmpty.normal);

      distU3a.remove(['b', 'c']);
      expect(distU3a.source).toEqual(dtoU1.source);
      expect(distU3a.normal).toEqual(dtoU1.normal);

      // Single Value
      distU1b.remove('a');
      expect(distU1b.source).toEqual(dtoEmpty.source);
      expect(distU1b.normal).toEqual(dtoEmpty.normal);

      distU2b.remove('b');
      expect(distU2b.source).toEqual(dtoU1.source);
      expect(distU2b.normal).toEqual(dtoU1.normal);

      distU3b.remove('c');
      expect(distU3b.source).toEqual(dtoU2.source);
      expect(distU3b.normal).toEqual(dtoU2.normal);

      // Multi-Value (No Source)
      distU2c.remove(['a', 'b']);
      expect(distU2c.source).toBeUndefined();
      expect(distU2c.normal).toEqual(dtoEmpty.normal);

      distU3c.remove(['b', 'c']);
      expect(distU3c.source).toBeUndefined();
      expect(distU3c.normal).toEqual(dtoU1.normal);

      // Single Value (No Source)
      distU1d.remove('a');
      expect(distU1d.source).toBeUndefined();
      expect(distU1d.normal).toEqual(dtoEmpty.normal);

      distU2d.remove('b');
      expect(distU2d.source).toBeUndefined();
      expect(distU2d.normal).toEqual(dtoU1.normal);

      distU3d.remove('c');
      expect(distU3d.source).toBeUndefined();
      expect(distU3d.normal).toEqual(dtoU2.normal);
    });
    it('can pick one or more values from a distribution.', () => {
      // Setup
      const distU1 = new Distribution({ seed: 50, ...dtoU1 });
      const distU2 = new Distribution({ seed: 50, ...dtoU2 });
      const distU3 = new Distribution({ seed: 50, ...dtoU3 });

      // Single Pick
      expect(distU1.pickOne(undefined)).toBe('a');
      expect(distU2.pickOne(undefined)).toBeDefined();
      expect(distU3.pickOne(undefined)).toBeDefined();

      // // Single Pick (Masked)
      expect(distU1.pickOne(['a'])).toBeUndefined();
      expect(distU2.pickOne(['a'])).toBe('b');
      expect(distU3.pickOne(['a', 'b'])).toBe('c');

      // // Multi Pick
      expect(distU3.pick(2).length).toBe(2);
      expect(distU3.pick(5).length).toBe(5);
      expect(distU3.pick(20).length).toBe(20);

      // // Multi Pick Masked
      expect(distU3.pick(5, ['a', 'b'])).toEqual(['c', 'c', 'c', 'c', 'c']);
    });
    it('samples properly over many picks.', () => {
      /* Object.keys(sampleB3Summary).forEach(k => {
        expect(sampleB3Summary[k] / sampleCount).toBeCloseTo(dtoB3.normal[k]);
      }); */
    });
  });
});
