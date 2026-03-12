/*
 # distribution.ts
 # Distribution Class
 */

/*
 # Specification
 - Class definition for weighted distribution.
 - Randomly picks a value from a weighted distribution.
 - All static functions should be immutable.
 - All member functions should utilize immutable static functions.
 - Supports READ ONLY functionality by providing only normalized distribution.
 */

/**
 # Module Dependencies
 */

import { normalizeObject, scaleNormalObject, sumObject } from 'scalr';
import { Random, RandomDTO } from '../services';
import { WeightedDistribution } from '../types';

/**
 # Types
 */

/** @internal */
export interface DistributionSourceDTO {
  source: WeightedDistribution;
  normal: WeightedDistribution;
}

/** @internal */
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

export interface DistributionPickOptions<T extends string = string> {
  count?: number;
  mask?: T[];
  exclusive?: boolean;
  engine?: Random;
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

function addObjects(...objects: WeightedDistribution[]): WeightedDistribution {
  const result: WeightedDistribution = {};
  for (const object of objects) {
    for (const key of Object.keys(object)) {
      const value = object[key];
      if (value === undefined) continue;
      if (result[key] === undefined) result[key] = 0;
      result[key]! += value;
    }
  }
  return result;
}

function validateWeights(additions: WeightedDistribution): void {
  for (const v of Object.values(additions)) {
    if (v !== undefined && !Number.isFinite(v)) {
      throw new RangeError('Distribution: weight must be a finite number');
    }
  }
}

/**
 # Class
 */

export class Distribution<T extends string = string> {
  protected _engine: Random;
  protected _source?: WeightedDistribution;
  protected _normal: WeightedDistribution;

  constructor({ engine, seed, uses, source, normal }: DistributionConstructor) {
    this._engine = engine || new Random({ seed, uses });

    if (source !== undefined) {
      const dto = Distribution.addSourceValues(defaultDTO, source);
      this._source = dto.source;
      this._normal = dto.normal;
    } else if (normal !== undefined) {
      const dto = Distribution.addNormalValues(defaultDTO, normal);
      this._normal = dto.normal;
    } else {
      this._source = {};
      this._normal = {};
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
   * Picks one more values from a Distribution without exclusion.
   * If you just need to pick one value, you should use pickOne instead.
   * @param options Options for picking values.
   * @param options.count The number of picks to make (default 1).
   * @param options.mask A mask containing keys in the distribution that should be ignored.
   * @param options.exclusive If true picks are considered exclusive and are removed.
   */
  public pick(options: DistributionPickOptions<T> = {}) {
    const { count = 1, mask, exclusive = false } = options;
    return Distribution.pick(
      { source: this._source, normal: this._normal },
      { count, mask, exclusive, engine: this._engine }
    );
  }

  /**
   * Picks a single value from a Distribution.
   * If you are picking multiple values, use pick instead.
   * @param mask        A mask containing keys in the distribution that should be ignored.
   */
  public pickOne(mask?: T[]) {
    return this._engine.pickWeighted(this._normal, mask as string[]);
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * Mutates internal state and returns `this` for chaining.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public add(key: T, value: number): this {
    const data = Distribution.addValues({ source: this._source, normal: this._normal }, { [key]: value });
    this._source = data.source;
    this._normal = data.normal;
    return this;
  }

  /**
   * Adds an object of values to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * Mutates internal state and returns `this` for chaining.
   * @param additions   An object containing additions.
   */
  public addValues(additions: WeightedDistribution): this {
    const data = Distribution.addValues({ source: this._source, normal: this._normal }, additions);
    this._source = data.source;
    this._normal = data.normal;
    return this;
  }

  /**
   * Removes a key or array of keys from a Distribution and renormalizes.
   * Mutates internal state and returns `this` for chaining.
   * @param keys  Key or Keys to be removed.
   */
  public remove(keys: T | T[]): this {
    const data = Distribution.remove({ source: this._source, normal: this._normal }, keys);
    this._source = data.source;
    this._normal = data.normal;
    return this;
  }

  /**
   * Serializes a Distribution instance into a data transfer object.
   * @param stripSource If true this will strip out the source.
   */
  public serialize(stripSource = false): DistributionDTO {
    const { source, normal } = Distribution.clone({ source: this._source, normal: this._normal }, stripSource);
    return {
      source,
      normal,
    };
  }

  /**
   * Creates a clone of a Distribution instance.
   * @param stripSource If true this will strip out the source.
   */
  public clone(stripSource = false) {
    const { source, normal } = this.serialize(stripSource);
    return new Distribution<T>({
      seed: this.seed,
      uses: this.uses,
      source,
      normal,
    });
  }

  /**
   * Returns a new {@link ImmutableDistribution} from the current state.
   */
  public freeze(): ImmutableDistribution<T> {
    const { source, normal } = this.serialize();
    return new ImmutableDistribution<T>({
      seed: this.seed,
      uses: this.uses,
      source,
      normal,
    });
  }

  /**
   * Picks one more values from a Distribution without exclusion.
   * If you just need to pick one value, you should use pickOne instead.
   * @param model        A Distribution data transfer object.
   * @param options      Options for picking values.
   * @param options.count       The number of picks to make (default 1).
   * @param options.mask        A mask containing keys in the distribution that should be ignored.
   * @param options.exclusive   If true picks are considered exclusive and are removed.
   * @param options.engine      A Random engine. This is created if not provided.
   */
  public static pick<T extends string = string>(
    model: DistributionNormalDTO,
    options: DistributionPickOptions<T> = {}
  ) {
    const { count = 1, mask, exclusive = false, engine } = options;
    const eng = engine || new Random({});
    const picks: T[] = [];
    const iMask = mask ? [...mask] : exclusive ? [] : undefined;
    for (let i = 0; i < count; i += 1) {
      const pick = eng.pickWeighted(model.normal, iMask as string[]) as T | undefined;
      if (pick) {
        picks.push(pick);
        if (exclusive && iMask) iMask.push(pick);
      } else {
        // picks.push(undefined);
        break;
      }
    }

    return picks;
  }

  /**
   * Picks a single value from a Distribution.
   * If you are picking multiple values, use pick instead.
   * @param model        A Distribution data transfer object.
   * @param mask        A mask containing keys in the distribution that should be ignored.
   * @param engine      A Random engine. This is created if not provided.
   */
  public static pickOne<T extends string = string>(model: DistributionNormalDTO, mask?: T[], engine?: Random) {
    const eng = engine || new Random({});
    return eng.pickWeighted(model.normal, mask as string[]) as T | undefined;
  }

  /**
   * Adds an object of values to a Distribution's source and renormalizes it.
   * @internal
   * @param model        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addSourceValues(model: DistributionSourceDTO, additions: WeightedDistribution): DistributionSourceDTO {
    validateWeights(additions);
    // Create the new distribution and normalize.
    const src = addObjects(model.source, additions);
    const nrm = Object.keys(src).length > 0 ? normalizeObject(src) : {};
    return { ...model, source: src, normal: nrm };
  }

  /**
   * Adds a key / value pair to a distribution's source and renormalizes it.
   * If a source distribution exists, it will be recalculated based off of the
   * new normal distribution.
   * @internal
   * @param model  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static addSourceValue<T extends string = string>(
    model: DistributionSourceDTO,
    key: T,
    value: number
  ): DistributionSourceDTO {
    return Distribution.addSourceValues(model, { [key]: value });
  }

  /**
   * Adds an object of values to a normal Distribution and renormalizes it.
   * If a source distribution exists, it will be recalculated by scaling the
   * new normal distribution to fit its sum.
   * @internal
   * @param model        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addNormalValues(model: DistributionDTO, additions: WeightedDistribution): DistributionDTO {
    validateWeights(additions);
    //  Add the values and then renormalize. We have to strip out the distribution because it'll no longer be valid.
    const { normal, source, ...dto } = model;

    // If we're trying to add an empty object, just return the data.
    if (Object.keys(additions).length === 0) return model;

    // Calculate the normalized values.
    const nrm = normalizeObject(addObjects(normal, additions));

    // If we have sources, recalculate it from the normalized values.
    const src =
      source !== undefined && Object.keys(source).length > 0 ? scaleNormalObject(nrm, sumObject(source)) : undefined;

    return { ...dto, source: src, normal: nrm };
  }

  /**
   * Adds a key / value pair to a normal distribution and renormalizes it.
   * If a source distribution exists, it will be recalculated based off of the
   * new normal distribution.
   * @internal
   * @param model  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static addNormalValue<T extends string = string>(
    model: DistributionDTO,
    key: T,
    value: number
  ): DistributionDTO {
    return Distribution.addNormalValues(model, { [key]: value });
  }

  /**
   * Adds an object of values to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param model        A Distribution data transfer object.
   * @param additions   An object containing additions.
   */
  public static addValues(model: DistributionDTO, additions: WeightedDistribution) {
    // Determine whether we're adding to the source or the normal distribution and assign the proper function.
    const fn = model.source !== undefined ? Distribution.addSourceValues : Distribution.addNormalValues;
    return fn(model, additions);
  }

  /**
   * Adds a key / value pair to a Distribution.
   * Will add to the source distribution by default, unless the distribution
   * only has normalized values.
   * @param model  A Distribution data transfer object.
   * @param key   Key to be added.
   * @param value Value of the key to add.
   */
  public static add<T extends string = string>(model: DistributionDTO, key: T, value: number): DistributionDTO {
    return Distribution.addValues(model, { [key]: value });
  }

  /**
   * Removes a key or array of keys from a Distribution and renormalizes.
   * @param model  A Distribution data transfer object.
   * @param keys  Key or Keys to be removed.
   */
  public static remove<T extends string = string>(model: DistributionDTO, keys: T | T[]) {
    // Determine whether we're using the source or the normal distribution.
    const rem = Array.isArray(keys) ? keys : [keys];
    const ref = model.source || model.normal;
    const res: WeightedDistribution = {};

    // Filter out the keys when creating the new distribution.
    for (const key of Object.keys(ref)) {
      const value = ref[key];
      if (value !== undefined && !rem.includes(key as T)) {
        res[key] = value;
      }
    }

    // Renormalize and return the result.
    const normal = Object.keys(res).length > 0 ? normalizeObject(res) : {};

    const result: DistributionDTO =
      model.source !== undefined ? { ...model, source: { ...res }, normal } : { ...model, normal };

    return result;
  }

  /**
   * Initializes a new DistributionSourceDTO.
   * @param source An optional source of values to generate the distribution from.
   */
  public static new(source?: WeightedDistribution): DistributionSourceDTO {
    const empty: DistributionSourceDTO = { source: {}, normal: {} };
    return source ? Distribution.addSourceValues(empty, source) : empty;
  }

  /**
   * Creates a clone of a Distribution DTO.
   * @param model        A Distribution data transfer object.
   * @param stripSource If true this will strip out the source.
   */
  public static clone(model: DistributionDTO, stripSource = false): DistributionDTO {
    const { source, normal, ...dtoData } = model;
    return stripSource || model.source === undefined
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

/**
 * Immutable variant of Distribution.
 * Mutating methods return new instances instead of modifying internal state.
 *
 * Note: Forked instances (returned by mutating methods) share initial PRNG
 * state with the original via `engine.clone()`. They will produce identical
 * random sequences until their usage patterns (number of draws) diverge.
 * If independent randomness is needed immediately after forking, re-seed or
 * advance one of the engines before use.
 *
 * Note: Not designed for further subclassing. The `this` return type is a
 * convenience for method chaining, not a polymorphism guarantee.
 */
export class ImmutableDistribution<T extends string = string> extends Distribution<T> {
  public override add(key: T, value: number): this {
    const data = Distribution.addValues({ source: this._source, normal: this._normal }, { [key]: value });
    return new ImmutableDistribution<T>({
      engine: this._engine.clone(),
      source: data.source,
      normal: data.normal,
    }) as this;
  }

  public override addValues(additions: WeightedDistribution): this {
    const data = Distribution.addValues({ source: this._source, normal: this._normal }, additions);
    return new ImmutableDistribution<T>({
      engine: this._engine.clone(),
      source: data.source,
      normal: data.normal,
    }) as this;
  }

  public override remove(keys: T | T[]): this {
    const data = Distribution.remove({ source: this._source, normal: this._normal }, keys);
    return new ImmutableDistribution<T>({
      engine: this._engine.clone(),
      source: data.source,
      normal: data.normal,
    }) as this;
  }

  public override clone(stripSource = false) {
    const { source, normal } = this.serialize(stripSource);
    return new ImmutableDistribution<T>({
      seed: this.seed,
      uses: this.uses,
      source,
      normal,
    });
  }

  /**
   * Returns a new mutable {@link Distribution} from the current state.
   */
  public toMutable(): Distribution<T> {
    const { source, normal } = this.serialize();
    return new Distribution<T>({
      seed: this.seed,
      uses: this.uses,
      source,
      normal,
    });
  }
}
