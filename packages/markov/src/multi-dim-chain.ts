/**
 * MultiDimMarkovChain
 *
 * MarkovChain for multi-dimensional/structured state spaces.
 * Uses a named-function registry for serializable state key functions.
 */

import { Random, RandomDTO } from '@acausal/random';
import { MarkovChain } from './markov-chain';
import { MarkovChainDTO, MCGeneratorOptions } from './types';

/**
 * Function that converts a structured state object to a unique string key.
 */
export type StateKeyFunction<T> = (state: T) => string;

// ---- Named-function registry ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateKeyRegistry = new Map<string, StateKeyFunction<any>>();

/**
 * Register a named state key function for use with MultiDimMarkovChain serialization.
 */
export function registerStateKey<T>(name: string, fn: StateKeyFunction<T>): void {
  const existing = stateKeyRegistry.get(name);
  if (existing && existing !== fn) {
    throw new Error(
      `State key '${name}' is already registered with a different function. ` +
        'Use a unique name or pass { overwrite: true }.'
    );
  }
  stateKeyRegistry.set(name, fn);
}

/**
 * Remove a registered state key function by name.
 */
export function unregisterStateKey(name: string): boolean {
  return stateKeyRegistry.delete(name);
}

/**
 * Look up a registered state key function by name.
 */
export function getStateKey<T>(name: string): StateKeyFunction<T> | undefined {
  return stateKeyRegistry.get(name) as StateKeyFunction<T> | undefined;
}

/**
 * Serializable DTO for MultiDimMarkovChain.
 */
export interface MultiDimMarkovChainDTO<T> {
  internalChain: MarkovChainDTO;
  stateStore: { [key: string]: T };
  stateKeyName: string;
}

/**
 * Options for MultiDimMarkovChain construction.
 */
export interface MultiDimMarkovChainOptions<T> extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
  engine?: Random;
  /** State key function, or a registered name. */
  stateKey: string | StateKeyFunction<T>;
  /** Required when stateKey is a function, for serialization. */
  stateKeyName?: string;
}

export class MultiDimMarkovChain<T> {
  protected internalChain: MarkovChain<string>;
  protected stateStore: { [key: string]: T };
  protected stateKeyFn: StateKeyFunction<T>;
  protected stateKeyName: string;
  protected _engine: Random;

  constructor(options: MultiDimMarkovChainOptions<T>) {
    this._engine = options.engine || new Random({ seed: options.seed, uses: options.uses });
    this.stateStore = {};

    // Resolve state key function
    if (typeof options.stateKey === 'string') {
      const fn = getStateKey<T>(options.stateKey);
      if (!fn) {
        throw new Error(
          `State key function '${options.stateKey}' not found in registry. Register it with registerStateKey().`
        );
      }
      this.stateKeyFn = fn;
      this.stateKeyName = options.stateKey;
    } else {
      this.stateKeyFn = options.stateKey;
      this.stateKeyName = options.stateKeyName ?? '';
    }

    this.internalChain = new MarkovChain<string>({
      maxOrder: options.maxOrder || 2,
      delimiter: options.delimiter,
      startDelimiter: options.startDelimiter,
      endDelimiter: options.endDelimiter,
      engine: this._engine,
      sequences: [],
    });
  }

  /**
   * Reconstruct from internal parts (used by addSequence, clone, fromDTO).
   */
  protected static fromParts<T>(
    internalChain: MarkovChain<string>,
    stateStore: { [key: string]: T },
    stateKeyFn: StateKeyFunction<T>,
    stateKeyName: string,
    engine: Random
  ): MultiDimMarkovChain<T> {
    const instance = Object.create(this.prototype) as MultiDimMarkovChain<T>;
    instance.internalChain = internalChain;
    instance.stateStore = stateStore;
    instance.stateKeyFn = stateKeyFn;
    instance.stateKeyName = stateKeyName;
    instance._engine = engine;
    return instance;
  }

  /**
   * Add a sequence of structured states.
   * Mutates internal state and returns `this` for chaining.
   *
   * Note: This mutable variant directly mutates `this.stateStore` in place
   * (writing key-value pairs into the existing object) rather than creating a
   * cloned copy. This is intentional for performance — the mutable API contract
   * permits in-place modification. The immutable override
   * ({@link ImmutableMultiDimMarkovChain.addSequence}) handles cloning of the
   * state store to preserve the original instance.
   */
  public addSequence(sequence: T[]): this {
    if (sequence.length === 0) return this;

    const keys = sequence.map(state => {
      const key = this.stateKeyFn(state);
      this.stateStore[key] = state;
      return key;
    });

    this.internalChain.addSequence(keys);

    return this;
  }

  /**
   * Add multiple sequences of structured states.
   * Mutates internal state and returns `this` for chaining.
   */
  public addSequences(sequences: T[][]): this {
    for (const seq of sequences) {
      this.addSequence(seq);
    }
    return this;
  }

  /**
   * Generate a sequence of structured states.
   */
  public generate(options: MCGeneratorOptions = {}): T[] {
    const keys = this.internalChain.generate(options);
    return keys.map(key => this.stateStore[key]!).filter(state => state !== undefined);
  }

  /**
   * Pick a single next structured state.
   */
  public pick(current?: T[], next = true, mask?: T[]): T | undefined {
    const currentKeys = current?.map(s => this.stateKeyFn(s));
    const maskKeys = mask?.map(s => this.stateKeyFn(s));

    const nextKey = this.internalChain.pick(currentKeys, next, maskKeys);
    if (!nextKey) return undefined;

    return this.stateStore[nextKey];
  }

  /**
   * Get statistics about the internal chain.
   */
  public getStats() {
    return this.internalChain.getStats();
  }

  /**
   * Get all unique states that have been observed.
   */
  public getStates(): T[] {
    return Object.values(this.stateStore);
  }

  /**
   * Check if a state exists in the chain.
   */
  public hasState(state: T): boolean {
    const key = this.stateKeyFn(state);
    return this.stateStore[key] !== undefined;
  }

  /**
   * Get the internal MarkovChain (for advanced use).
   */
  public getInternalChain(): MarkovChain<string> {
    return this.internalChain;
  }

  /**
   * Serialize to a portable DTO.
   * Requires stateKeyName to have been set (either via registry name or constructor option).
   */
  public serialize(): MultiDimMarkovChainDTO<T> {
    return {
      internalChain: this.internalChain.serialize(),
      stateStore: { ...this.stateStore },
      stateKeyName: this.stateKeyName,
    };
  }

  /**
   * Reconstruct from a DTO.
   * Looks up the state key function from the registry by name.
   * If not registered, you must pass it explicitly.
   */
  static fromDTO<T>(dto: MultiDimMarkovChainDTO<T>, stateKey?: StateKeyFunction<T>): MultiDimMarkovChain<T> {
    let fn = stateKey;
    if (!fn) {
      fn = getStateKey<T>(dto.stateKeyName);
      if (!fn) {
        throw new Error(
          `State key function '${dto.stateKeyName}' not found in registry. ` +
            'Either register it with registerStateKey() or pass it to fromDTO().'
        );
      }
    }

    const internalChain = new MarkovChain<string>(dto.internalChain);

    return MultiDimMarkovChain.fromParts(internalChain, { ...dto.stateStore }, fn, dto.stateKeyName, new Random({}));
  }

  /**
   * Clone this multi-dimensional chain.
   */
  public clone(): MultiDimMarkovChain<T> {
    return MultiDimMarkovChain.fromParts(
      this.internalChain.clone(),
      { ...this.stateStore },
      this.stateKeyFn,
      this.stateKeyName,
      this._engine.clone()
    );
  }

}
