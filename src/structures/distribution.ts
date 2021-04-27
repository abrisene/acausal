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

export interface DistributionConstructor extends RandomDTO {
  engine?: Random;
  source?: WeightedDistribution;
  normal?: WeightedDistribution;
}

/**
 # Constants
 */

const defaultDTO: DistributionSourceDTO = {
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
  private _source?: WeightedDistribution;
  private _normal: WeightedDistribution;

  constructor(config: DistributionConstructor) {
    const { engine, source, normal, ...randomConfig } = config;
    this._engine = engine || new Random(randomConfig);

    if (source !== undefined) {
      const dto = Distribution.addSourceValues(defaultDTO, source);
      this._source = dto.source;
      this._normal = dto.normal;
    } else if (normal !== undefined) {
      const dto = Distribution.addNormalValues(defaultDTO, normal);
      this._normal = dto.normal;
    } else {
      this._source = defaultDTO.source;
      this._normal = defaultDTO.normal;
    }
  }

  get seed() {
    return this._engine.seed;
  }

  get uses() {
    return this._engine.uses;
  }

  get source() {
    return this._source;
  }

  get normal() {
    return this._normal;
  }

  /**
   * Applies a DTO's data to the source and normal distributions.
   * @param data A Distribution data transfer object.
   */
  private update(data: DistributionDTO) {
    this._source = data.source;
    this._normal = data.normal;
    return this;
  }

  /**
   * Picks one more values from a Distribution without exclusion.
   * If you just need to pick one value, you should use pickOne instead.
   * @param count       The number of picks to make (default 1).
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param exclusive   If true picks are considered exclusive and are removed.
   */
  public pick(count = 1, mask?: string[], exclusive = false) {
    return Distribution.pick(
      { source: this._source, normal: this._normal },
      count,
      mask,
      exclusive,
      this._engine
    );
  }

  /**
   * Picks a single value from a Distribution.
   * If you are picking multiple values, use pick instead.
   * @param mask        A mask containing keys in the distribution that should be ignored.
   */
  public pickOne(mask?: string[]) {
    return this._engine.pickWeighted(this._normal, mask);
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public add(key: string, value: number) {
    const data = Distribution.addValues(
      { source: this._source, normal: this._normal },
      { [key]: value }
    );
    return this.update(data);
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  /* public addValue(key: string, value: number) {
    const data = Distribution.addValues({ source: this._source, normal: this._normal }, { [key]: value });
    return this.update(data);
  } */

  /**
   * Adds an object of values to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param additions   An object containing additions.
   */
  public addValues(additions: WeightedDistribution) {
    const data = Distribution.addValues(
      { source: this._source, normal: this._normal },
      additions
    );
    return this.update(data);
  }

  /**
   * Removes a key or array of keys from a Distribution and renormalizes.
   * @param keys  Key or Keys to be removed.
   */
  public remove(keys: string | string[]) {
    const data = Distribution.remove(
      { source: this._source, normal: this._normal },
      keys
    );
    return this.update(data);
  }

  /**
   * Creates a clone of a Distribution instance.
   * @param stripSource If true this will strip out the source.
   */
  public clone(stripSource = false) {
    const { source, normal } = Distribution.clone(
      { source: this._source, normal: this._normal },
      stripSource
    );
    return new Distribution({
      seed: this.seed,
      uses: this.uses,
      source,
      normal,
    });
  }

  /* public serialize(): DistributionDTO {

  } */

  /**
   * Picks multiple values from a Distribution without exclusion.
   * @param data        A Distribution data transfer object.
   * @param count       The number of picks to make (default 1).
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param exclusive   If true picks are considered exclusive and are removed.
   * @param engine      A Random engine. This is created if not provided.
   */
  /*   public static pickValues(
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
  } */

  /**
   * Picks one more values from a Distribution without exclusion.
   * If you just need to pick one value, you should use pickOne instead.
   * @param data        A Distribution data transfer object.
   * @param count       The number of picks to make (default 1).
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param exclusive   If true picks are considered exclusive and are removed.
   * @param engine      A Random engine. This is created if not provided.
   */
  public static pick(
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
   * If you are picking multiple values, use pick instead.
   * @param data        A Distribution data transfer object.
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param engine      A Random engine. This is created if not provided.
   */
  public static pickOne(
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
    const nrm = Object.keys(src).length > 0 ? normalizeObject(src) : {};
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
      source !== undefined && Object.keys(source).length > 0
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
   * Adds an object of values to a Distribution.
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
  /* public static addValue(
    data: DistributionDTO,
    key: string,
    value: number
  ): DistributionDTO {
    return Distribution.addValues(data, { [key]: value });
  } */

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
   * Removes a key or array of keys from a Distribution and renormalizes.
   * @param data  A Distribution data transfer object.
   * @param keys  Key or Keys to be removed.
   */
  public static remove(data: DistributionDTO, keys: string | string[]) {
    // Determine whether we're using the source or the normal distribution.
    const rem = Array.isArray(keys) ? keys : [keys];
    const ref = data.source || data.normal || {}; // The fallback should be unreachable.
    const res: WeightedDistribution = {};

    // Filter out the keys when creating the new distribution.
    for (const key of Object.keys(ref)) {
      if (!rem.includes(key)) res[key] = ref[key];
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
  /* public static removeValue(data: DistributionDTO, keys: string | string[]) {
    return Distribution.removeValues(data, Array.isArray(keys) ? keys : [keys]);
  } */

  /**
   * Removes a key from a Distribution and renormalizes.
   * @param data  A Distribution data transfer object.
   * @param key   Key(s) to be removed.
   */
  /* public static remove(data: DistributionDTO, keys: string | string[]) {
    return Distribution.removeValues(data, Array.isArray(keys) ? keys : [keys]);
  } */

  /**
   * Initializes a new DistributionSourceDTO.
   * @param source An optional source of values to generate the distribution from.
   */
  public static new(source?: WeightedDistribution) {
    return source
      ? Distribution.addSourceValues(defaultDTO, source)
      : defaultDTO;
  }

  /**
   * Creates a clone of a Distribution DTO.
   * @param data        A Distribution data transfer object.
   * @param stripSource If true this will strip out the source.
   */
  public static clone(
    data: DistributionDTO,
    stripSource = false
  ): DistributionDTO {
    const { source, normal, ...dtoData } = data;
    return stripSource || data.source === undefined
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
