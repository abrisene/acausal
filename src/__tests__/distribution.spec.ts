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

// Picks

const pickOneU1 = Distribution.pickValue(dtoU1);
const pickOneU2 = Distribution.pickValue(dtoU2);
const pickOneU3 = Distribution.pickValue(dtoU3);

const pickOneMaskU1 = Distribution.pickValue(dtoU1, ['a'], engine);
const pickOneMaskU2 = Distribution.pickValue(dtoU2, ['a'], engine);
const pickOneMaskU3 = Distribution.pickValue(dtoU3, ['a', 'b'], engine);

const pickFiveMaskU3 = Distribution.pickValues(
  dtoU3,
  5,
  ['a', 'b'],
  false,
  engine
);

const pickTwoU3 = Distribution.pickValues(dtoU3, 2);
const pickFiveU3 = Distribution.pickValues(dtoU3, 5);
const pickTwentyU3 = Distribution.pickValues(dtoU3, 20);

const sampleCount = 50000;
const sampleB3 = Distribution.pickValues(dtoB3, sampleCount);
const sampleB3Summary = sampleB3.reduce((l, k) => {
  const result = { ...l };
  if (result[k] === undefined) result[k] = 0;
  result[k] += 1;
  return result;
}, {} as WeightedDistribution);

/**
 # Tests
 */

describe('Distributions', () => {
  describe('statically', () => {
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
      expect(Distribution.removeValue(dtoU2, ['a', 'b'])).toEqual(dtoEmpty);
      expect(Distribution.removeValue(dtoU3, ['b', 'c'])).toEqual(dtoU1);

      expect(Distribution.remove(dtoU2, ['a', 'b'])).toEqual(dtoEmpty);
      expect(Distribution.remove(dtoU3, ['b', 'c'])).toEqual(dtoU1);

      // Single Value
      expect(Distribution.removeValue(dtoU1, 'a')).toEqual(dtoEmpty);
      expect(Distribution.removeValue(dtoU2, 'b')).toEqual(dtoU1);
      expect(Distribution.removeValue(dtoU3, 'c')).toEqual(dtoU2);

      expect(Distribution.remove(dtoU1, 'a')).toEqual(dtoEmpty);
      expect(Distribution.remove(dtoU2, 'b')).toEqual(dtoU1);
      expect(Distribution.remove(dtoU3, 'c')).toEqual(dtoU2);

      // Multi-Value (No Source)
      expect(stripSource(Distribution.removeValue(dtoU2, ['a', 'b']))).toEqual(
        stripSource(dtoEmpty)
      );
      expect(stripSource(Distribution.removeValue(dtoU3, ['b', 'c']))).toEqual(
        stripSource(dtoU1)
      );

      expect(stripSource(Distribution.remove(dtoU2, ['a', 'b']))).toEqual(
        stripSource(dtoEmpty)
      );
      expect(stripSource(Distribution.remove(dtoU3, ['b', 'c']))).toEqual(
        stripSource(dtoU1)
      );

      // Single Value (No Source)
      expect(stripSource(Distribution.removeValue(dtoU1, 'a'))).toEqual(
        stripSource(dtoEmpty)
      );
      expect(stripSource(Distribution.removeValue(dtoU2, 'b'))).toEqual(
        stripSource(dtoU1)
      );
      expect(stripSource(Distribution.removeValue(dtoU3, 'c'))).toEqual(
        stripSource(dtoU2)
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
});
