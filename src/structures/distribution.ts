/*
 # distribution.ts
 # Distribution Class
 */

/*
 # Specification
 */

/****************
SUMMARY:
- Class definition for weighted distribution.
- Randomly picks a value from a weighted distribution.
- All static functions should be immutable.
- All member functions should utilize immutable static functions.
- Supports READ ONLY functionality by providing only normalized distribution.

TESTING:


TODO:
- Figure out whether or not we care about negative values.
*****************/

/**
 # Module Dependencies
 */

import {
  normalizeObject,
  scaleNormalObject,
  // isNormalizedObject,
  sumObject,
} from 'scalr';
import { Random, RandomDTO } from '../services';
import { WeightedDistribution } from '../types';

/**
 # Types
 */

export interface DistributionSourceDTO {
  source: WeightedDistribution;
  normal: WeightedDistribution;
}

export interface DistributionNormalDTO {
  source?: WeightedDistribution;
  normal: WeightedDistribution;
}

export type DistributionDTO = DistributionSourceDTO | DistributionNormalDTO;

export interface DistributionConstructor
  extends DistributionSourceDTO,
    RandomDTO {
  engine?: Random;
}

/**
 # Constants
 */

const defaultDTO: DistributionDTO = {
  source: {},
  normal: {},
};

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

/**
 # Class
 */

export class Distribution {
  private _engine: Random;
  private _source: WeightedDistribution;
  private _normal: WeightedDistribution;

  constructor(config: DistributionConstructor) {
    this._engine = config.engine || new Random(config);
    this._source = config.source || {};
    this._normal = {};
    // this.regenerate();
  }

  get distribution() {
    return this._source;
  }

  get distributionNormal() {
    return this._normal;
  }

  get isReadOnly() {
    return (
      Object.keys(this._normal).length > 0 &&
      Object.keys(this._source).length === 0
    );
  }

  /**
   * Picks multiple values from a Distribution without exclusion.
   * @param data        A Distribution data transfer object.
   * @param count       The number of picks to make (default 1).
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param exclusive   If true picks are considered exclusive and are removed
   * @param engine      A Random engine. This is created if not provided.
   */
  public static pickValues(
    data: DistributionNormalDTO,
    count = 1,
    mask?: string[],
    exclusive = false,
    engine?: Random
  ) {
    const eng = engine || new Random({});
    const picks: string[] = [];
    const iMask = mask ? [...mask] : exclusive ? [] : undefined;
    for (let i = 0; i < count; i += 1) {
      const pick = eng.pickWeighted(data.normal, iMask);
      if (pick) {
        picks.push(pick);
        if (exclusive && iMask) iMask.push(pick);
      } else {
        break;
      }
    }

    return picks;
  }

  /**
   * Picks a single value from a Distribution.
   * @param data        A Distribution data transfer object.
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param engine      A Random engine. This is created if not provided.
   */
  public static pickValue(
    data: DistributionNormalDTO,
    mask?: string[],
    engine?: Random
  ) {
    const eng = engine || new Random({});
    return eng.pickWeighted(data.normal, mask);
  }

  /**
   * Adds an object of values to a Distribution's source and renormalizes it.
   * @param data        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addSourceValues(
    data: DistributionSourceDTO,
    additions: WeightedDistribution
  ): DistributionSourceDTO {
    // Create the new distribution and normalize.
    const src = addObjects(data.source, additions);
    const nrm = normalizeObject(src);
    return { ...data, source: src, normal: nrm };
  }

  /**
   * Adds a key / value pair to a distribution's source and renormalizes it.
   * If a source distribution exists, it will be recalculated based off of the
   * new normal distribution.
   * @param data  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static addSourceValue(
    data: DistributionSourceDTO,
    key: string,
    value: number
  ): DistributionSourceDTO {
    return Distribution.addSourceValues(data, { [key]: value });
  }

  /**
   * Adds an object of values to a normal Distribution and renormalizes it.
   * If a source distribution exists, it will be recalculated by scaling the
   * new normal distribution to fit its sum.
   * @param data        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addNormalValues(
    data: DistributionDTO,
    additions: WeightedDistribution
  ): DistributionDTO {
    //  Add the values and then renormalize. We have to strip out the distribution because it'll no longer be valid.
    const { normal, source, ...dto } = data;

    // Calculate the normalized values.
    let nrm: WeightedDistribution = {};
    if (normal !== undefined) {
      nrm = normalizeObject(addObjects(normal, additions));
    } else if (source !== undefined) {
      nrm = addObjects(normalizeObject(source), additions);
    }

    // If we have sources, recalculate it from the normalized values.
    const src =
      source !== undefined
        ? scaleNormalObject(nrm, sumObject(source))
        : undefined;

    return { ...dto, source: src, normal: nrm };
  }

  /**
   * Adds a key / value pair to a normal distribution and renormalizes it.
   * If a source distribution exists, it will be recalculated based off of the
   * new normal distribution.
   * @param data  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static addNormalValue(
    data: DistributionDTO,
    key: string,
    value: number
  ): DistributionDTO {
    return Distribution.addNormalValues(data, { [key]: value });
  }

  /**
   * Adds an object of values to a Distribution source.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param data        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addValues(
    data: DistributionDTO,
    additions: WeightedDistribution
  ) {
    // Determine whether we're adding to the source or the normal distribution and assign the proper function.
    const fn =
      data.source !== undefined
        ? Distribution.addSourceValues
        : Distribution.addNormalValues;
    return fn(data, additions);
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param data  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static addValue(
    data: DistributionDTO,
    key: string,
    value: number
  ): DistributionDTO {
    return Distribution.addValues(data, { [key]: value });
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param data  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static add(
    data: DistributionDTO,
    key: string,
    value: number
  ): DistributionDTO {
    return Distribution.addValues(data, { [key]: value });
  }

  /**
   * Removes a key / value pair from a Distribution and renormalizes.
   * @param data  A Distribution data transfer object.
   * @param keys   Keys to be removed.
   */
  public static removeValues(data: DistributionDTO, keys: string[]) {
    // Determine whether we're using the source or the normal distribution.
    const ref = data.source || data.normal || {}; // The fallback should be unreachable.
    const res: WeightedDistribution = {};

    // Filter out the keys when creating the new distribution.
    for (const key of Object.keys(ref)) {
      if (!keys.includes(key)) res[key] = ref[key];
    }

    // Renormalize and return the result.
    const normal = Object.keys(res).length > 0 ? normalizeObject(res) : {};

    const result: DistributionDTO =
      data.source !== undefined
        ? { ...data, source: { ...res }, normal }
        : { ...data, normal };

    return result;
  }

  /**
   * Removes a key from a Distribution and renormalizes.
   * @param data  A Distribution data transfer object.
   * @param key   Key(s) to be removed.
   */
  public static removeValue(data: DistributionDTO, keys: string | string[]) {
    return Distribution.removeValues(data, Array.isArray(keys) ? keys : [keys]);
  }

  /**
   * Removes a key from a Distribution and renormalizes.
   * @param data  A Distribution data transfer object.
   * @param key   Key(s) to be removed.
   */
  public static remove(data: DistributionDTO, keys: string | string[]) {
    return Distribution.removeValues(data, Array.isArray(keys) ? keys : [keys]);
  }

  /**
   * Initializes a new DistributionSourceDTO.
   * @param source An optional source of values to generate the distribution from.
   */
  public static new(source?: WeightedDistribution) {
    const dto = { source: {}, normal: {} };
    return source ? Distribution.addSourceValues(dto, source) : dto;
  }

  /**
   * Creates a clone of a Distribution DTO.
   * @param data        A Distribution data transfer object.
   * @param stripSource If true this will strip out the source.
   */
  public static clone(
    data: DistributionDTO,
    stripSource = false
  ): DistributionDTO | DistributionNormalDTO {
    const { source, normal, ...dtoData } = data;
    return stripSource
      ? {
          ...dtoData,
          normal: { ...normal },
        }
      : {
          ...dtoData,
          source: { ...source },
          normal: { ...normal },
        };
  }
}
