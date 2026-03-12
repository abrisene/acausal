/**
 * MarkovChain Class
 *
 * Core Markov Chain implementation with both instance and static methods.
 * Static methods are immutable (clone-then-mutate pattern).
 * Instance methods delegate to statics.
 */

import { normalizeObject } from 'scalr';
import { Random } from '../../services';
import { Distribution } from '../distribution';
import { CONSTANTS } from '../../constants';
import {
  MCInsertOption,
  GramDictionary,
  Gram,
  MarkovChainDTO,
  MarkovChainConstructor,
  MCGeneratorOptions,
  MCGeneratorStaticOptions,
  MCAnalyzeOptions,
  MCAnalyzeStaticOptions,
  MCAnalysis,
  MarkovChainStats,
  MCSequenceScore,
  MCConstraints,
} from './types';
import { defaultOptions, defaultDTO, defaultGenOptions, defaultAnalyzeOptions } from './defaults';
import { addSequence, addEdge, getGramId, getDelimiters } from './utils';
import { MarkovChainBatch } from './batch';
import { blendMultipleDistributions } from './blend';
import type { BlendOptions, ChainBlendConfig } from './blend';

export class MarkovChain<T extends string = string> {
  protected _engine: Random;
  protected _model: MarkovChainDTO;

  constructor({
    engine,
    seed,
    uses,

    maxOrder = CONSTANTS.MC_MAX_ORDER_DEFAULT,
    delimiter = CONSTANTS.MC_GRAM_DELIMITER,
    startDelimiter = CONSTANTS.MC_START_DELIMITER,
    endDelimiter = CONSTANTS.MC_END_DELIMITER,

    insert = false,
    sequences,
    grams,
  }: MarkovChainConstructor) {
    if (maxOrder <= 0) {
      throw new RangeError(`MarkovChain: maxOrder must be > 0 (got ${maxOrder})`);
    }
    this._engine = engine || new Random({ seed, uses });
    this._model = {
      ...defaultOptions,
      maxOrder,
      delimiter,
      startDelimiter,
      endDelimiter,
      grams: {},
    };

    // Add seed / uses to the DTO if we're utilizing them.
    if (seed) this._model.seed = seed;
    if (uses) this._model.uses = uses;

    // If we have no sequences
    if (!sequences || sequences.length === 0) {
      // And we have no grams
      if (!grams || Object.keys(grams).length === 0) {
        // Then create an empty dictionary.
        this._model.grams = {};
        this._model.sequences = [];
      } else {
        // If we have grams, set the grams and null out sequences so we know not to add them.
        this._model.grams = grams;
        this._model.sequences = undefined;
      }
    } else {
      // If we have sequences
      // And we have no grams
      if (!grams || Object.keys(grams).length === 0) {
        // Then add the sequences.
        this._model.grams = {};
        this._model.sequences = [];
        this._model = MarkovChain.addSequences(this._model, sequences, insert);
      } else {
        // Otherwise, if we have sequences and grams, then add them.
        this._model.grams = grams;
        this._model.sequences = sequences;
      }
    }
  }

  /** Alias for {@link model}. */
  get dto() {
    return this._model;
  }

  get model() {
    return this._model;
  }

  get seed() {
    return this._engine.seed;
  }

  get uses() {
    return this._engine.uses;
  }

  get maxOrder() {
    return this._model.maxOrder;
  }

  get delimiter() {
    return this._model.delimiter;
  }

  get startDelimiter() {
    return this._model.startDelimiter;
  }

  get endDelimiter() {
    return this._model.endDelimiter;
  }

  get sequences() {
    return this._model.sequences;
  }

  get grams() {
    return this._model.grams;
  }

  /**
   * Returns the id of a Gram from its sequence.
   */
  public getGramId(gramSequence: string[]) {
    return gramSequence.join(this._model.delimiter);
  }

  /**
   * Returns the corresponding Gram from a sequence.
   */
  public getGram(gramSequence: string[]) {
    const id = this.getGramId(gramSequence);
    return this._model.grams[id];
  }

  /**
   * Finds the valid gram of the highest valid order in a sequence.
   */
  public findGram(gramSequence: string[], order?: number, direction = 'next') {
    return MarkovChain.findGram(this._model, gramSequence, order, direction);
  }

  /**
   * Adds or inserts a list of Sequences into a Markov Chain DTO.
   * Mutates internal state and returns `this` for chaining.
   */
  public addSequences(sequences: string[][], insert: MCInsertOption = false): this {
    this._model = MarkovChain.addSequences(this._model, sequences, insert);
    return this;
  }

  /**
   * Adds or inserts a Sequence into a Markov Chain DTO.
   * Mutates internal state and returns `this` for chaining.
   */
  public addSequence(sequence: string[], insert: MCInsertOption = false): this {
    this._model = MarkovChain.addSequence(this._model, sequence, insert);
    return this;
  }

  /**
   * Adds an edge from a gram to the items before and after it in the sequence.
   * Mutates internal state and returns `this` for chaining.
   */
  public addEdge(gram: string | string[], lastId: string | undefined, nextId: string | undefined, order: number): this {
    this._model = MarkovChain.addEdge(this._model, gram, lastId, nextId, order);
    return this;
  }

  /**
   * Picks the next or last random value from a Markov Chain.
   */
  public pick(gramSequence?: string[], next = true, mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, next, mask, this._engine);
  }

  /**
   * Picks the next random value from a Markov Chain given a sequence.
   */
  public next(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, true, mask, this._engine);
  }

  /**
   * Picks the previous (backward) random value from a Markov Chain given a sequence.
   */
  public backward(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, false, mask, this._engine);
  }

  /**
   * Picks the previous (backward) random value from a Markov Chain given a sequence.
   * @deprecated Use {@link backward} instead. Will be removed in a future major version.
   */
  public last(gramSequence?: string[], mask?: string[]) {
    return this.backward(gramSequence, mask);
  }

  /**
   * Generates a sequence from a Markov Chain.
   *
   * When `constraints` are provided, the generator retries up to
   * `constraints.maxRetries` times (default 100) to find a sequence that
   * satisfies all constraints. If no valid sequence is found within the retry
   * limit, the last attempted sequence is returned as a best-effort fallback.
   */
  public generate({
    start,
    order,
    min = defaultGenOptions.min,
    max = defaultGenOptions.max,
    direction = defaultGenOptions.direction,
    mask,
    strict = defaultGenOptions.strict,
    trim = defaultGenOptions.trim,
    constraints,
  }: MCGeneratorOptions) {
    return MarkovChain.generate({
      model: this._model,
      start,
      order,
      min,
      max,
      direction,
      mask,
      strict,
      trim,
      constraints,
      engine: this._engine,
    });
  }

  /**
   * Analyzes a sequence's sources and sinks by generating sample sequences.
   *
   * **Side effect:** This method generates `samples` forward and backward
   * sequences, which advances the PRNG engine state. If you need deterministic
   * generation after calling `analyze()`, clone the engine or use a separate
   * `MarkovChain` instance for analysis.
   */
  public analyze({
    start,
    order,
    samples = defaultAnalyzeOptions.samples,
    normalize = true,
    min = defaultAnalyzeOptions.min,
    max = defaultAnalyzeOptions.max,
    mask,
    strict = defaultAnalyzeOptions.strict,
  }: MCAnalyzeOptions) {
    return MarkovChain.analyze({
      model: this.dto,
      start,
      order,
      samples,
      normalize,
      min,
      max,
      mask,
      strict,
      engine: this._engine,
    });
  }

  /**
   * Serializes a Markov Chain instance into a DTO.
   */
  public serialize(stripSequences = false): MarkovChainDTO {
    return MarkovChain.clone(this._model, stripSequences);
  }

  /**
   * Creates a clone of the Markov Chain.
   */
  public clone(stripSequences = false) {
    return new MarkovChain(this.serialize(stripSequences));
  }

  /**
   * Returns a new {@link ImmutableMarkovChain} from the current state.
   * Uses a dynamic import to avoid circular module dependencies.
   */
  public async freeze(): Promise<MarkovChain<T>> {
    const { ImmutableMarkovChain } = await import('./immutable-markov-chain');
    return new ImmutableMarkovChain<T>(this.serialize());
  }

  /**
   * Start a batch operation for efficient incremental updates.
   */
  public batch(): MarkovChainBatch<T> {
    return new MarkovChainBatch<T>(this);
  }

  /**
   * Blend this chain with another chain using interpolation.
   * Alpha controls the blend: 0 = all this chain, 1 = all other chain.
   * Mutates internal state and returns `this` for chaining.
   */
  public interpolate(otherChain: MarkovChain<T>, alpha: number, options?: BlendOptions): this {
    this._model = MarkovChain.blendDTOs(
      [
        { model: this._model, weight: 1 - alpha },
        { model: otherChain.model, weight: alpha },
      ],
      options
    );
    return this;
  }

  /**
   * Check if a gram exists in the chain.
   */
  public hasGram(gramSequence: string[]): boolean {
    const id = this.getGramId(gramSequence);
    return id in this._model.grams;
  }

  /**
   * Get all grams of a specific order.
   */
  public getGramsByOrder(order: number): Gram[] {
    return Object.values(this._model.grams).filter(gram => gram.order === order);
  }

  /**
   * Get statistics about the Markov Chain.
   */
  public getStats(): MarkovChainStats {
    return MarkovChain.getStats(this._model);
  }

  /**
   * Calculate the log probability and perplexity of a sequence.
   */
  public score(sequence: string[], order?: number): MCSequenceScore {
    return MarkovChain.score(this._model, sequence, order);
  }

  /**
   * Validate a sequence against constraints.
   */
  private static validateConstraints(
    sequence: string[],
    constraints: MCConstraints | undefined,
    model: MarkovChainDTO
  ): boolean {
    if (!constraints) return true;

    const trimmed = sequence.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v));

    if (constraints.minLength !== undefined && trimmed.length < constraints.minLength) return false;
    if (constraints.maxLength !== undefined && trimmed.length > constraints.maxLength) return false;

    if (constraints.mustContain) {
      for (const required of constraints.mustContain) {
        if (!trimmed.includes(required)) return false;
      }
    }

    if (constraints.mustNotContain) {
      for (const forbidden of constraints.mustNotContain) {
        if (trimmed.includes(forbidden)) return false;
      }
    }

    if (constraints.pattern) {
      const joined = trimmed.join('');
      if (!constraints.pattern.test(joined)) return false;
    }

    if (constraints.validator && !constraints.validator(trimmed)) {
      return false;
    }

    return true;
  }

  // ---- Static Methods ----

  static getGramId(model: MarkovChainDTO, gramSequence: string[]) {
    return gramSequence.join(model.delimiter);
  }

  static getGram(model: MarkovChainDTO, gramSequence: string[]) {
    const id = MarkovChain.getGramId(model, gramSequence);
    return model.grams[id];
  }

  static findGram(model: MarkovChainDTO, gramSequence: string[], order?: number, direction = 'next') {
    const dirForward = direction === 'next';
    const curOrder = order || gramSequence.length;
    let sequence = dirForward ? gramSequence.slice(curOrder * -1) : gramSequence.slice(0, curOrder);
    let gram = MarkovChain.getGram(model, sequence);

    if (!gram) {
      for (let o = curOrder - 1; o > 0; o -= 1) {
        sequence = dirForward ? gramSequence.slice(o * -1) : gramSequence.slice(0, o);
        gram = MarkovChain.getGram(model, sequence);
        if (gram !== undefined) break;
      }
    }

    return gram;
  }

  static getSequence(gramSequence: string[], order: number, next: boolean) {
    return next ? gramSequence.slice(order * -1) : gramSequence.slice(0, order);
  }

  static addSequences(model: MarkovChainDTO, sequences: string[][], insert: MCInsertOption = false): MarkovChainDTO {
    const m = MarkovChain.clone(model);
    const delimiters = getDelimiters(m);

    for (let i = 0; i < sequences.length; i += 1) {
      const sequence = sequences[i];
      if (!sequence) continue;
      for (const element of sequence) {
        if (element === '') throw new RangeError('addSequence: sequence elements must be non-empty strings');
      }
      if (m.sequences !== undefined) m.sequences.push(sequence);
      addSequence(m.grams, sequence, insert, 1, m.maxOrder, delimiters);
    }

    return m;
  }

  static addSequence(model: MarkovChainDTO, sequence: string[], insert: MCInsertOption = false): MarkovChainDTO {
    for (const element of sequence) {
      if (element === '') throw new RangeError('addSequence: sequence elements must be non-empty strings');
    }
    const m = MarkovChain.clone(model);
    const delimiters = getDelimiters(m);

    if (m.sequences !== undefined) m.sequences.push(sequence);
    addSequence(m.grams, sequence, insert, 1, m.maxOrder, delimiters);

    return m;
  }

  static addEdge(
    model: MarkovChainDTO,
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined,
    order: number,
    weight = 1
  ) {
    const m = MarkovChain.clone(model);

    const delimiter = m.delimiter[0];
    if (!delimiter) {
      throw new Error('Invalid delimiter configuration');
    }
    const id = Array.isArray(gram) ? getGramId(gram, delimiter) : gram;

    addEdge(m.grams, id, lastId, nextId, order, weight);

    return m;
  }

  static pickGram(gram: Gram, next = true, mask?: string[], engine?: Random) {
    const distribution = next ? gram.next : gram.last;
    return Distribution.pickOne(distribution, mask, engine);
  }

  static pick(model: MarkovChainDTO, gramSequence?: string[], next = true, mask?: string[], engine?: Random) {
    const eng = engine || new Random({});
    const seq = gramSequence ? gramSequence : next ? [model.startDelimiter] : [model.endDelimiter];
    const gram = MarkovChain.getGram(model, seq);
    if (!gram) {
      return undefined;
    }
    return MarkovChain.pickGram(gram, next, mask, eng);
  }

  static next(model: MarkovChainDTO, gramSequence?: string[], mask?: string[], engine?: Random) {
    return MarkovChain.pick(model, gramSequence, true, mask, engine);
  }

  /**
   * Picks the previous (backward) random value from a Markov Chain DTO.
   */
  static backward(model: MarkovChainDTO, gramSequence?: string[], mask?: string[], engine?: Random) {
    return MarkovChain.pick(model, gramSequence, false, mask, engine);
  }

  /**
   * Picks the previous (backward) random value from a Markov Chain DTO.
   * @deprecated Use {@link MarkovChain.backward} instead. Will be removed in a future major version.
   */
  static last(model: MarkovChainDTO, gramSequence?: string[], mask?: string[], engine?: Random) {
    return MarkovChain.backward(model, gramSequence, mask, engine);
  }

  /**
   * Generates a sequence from a Markov Chain DTO.
   *
   * When `constraints` are provided, the generator retries up to
   * `constraints.maxRetries` times (default 100) to find a sequence that
   * satisfies all constraints. If no valid sequence is found within the retry
   * limit, the last attempted sequence is returned as a best-effort fallback.
   */
  static generate({
    model,
    start,
    order,
    min = defaultGenOptions.min,
    max = defaultGenOptions.max,
    direction = defaultGenOptions.direction,
    mask,
    strict = defaultGenOptions.strict,
    trim = defaultGenOptions.trim,
    constraints,
    engine,
  }: MCGeneratorStaticOptions) {
    if (min < 0) throw new RangeError('generate: min must be >= 0');
    if (max < 0) throw new RangeError('generate: max must be >= 0');
    if (min > max) throw new RangeError('generate: min must be <= max');
    const eng = engine || new Random({});
    const maxRetries = constraints?.maxRetries ?? (constraints ? 100 : 1);

    // Track the last attempt for fallback when all retries fail
    let lastAttempt: string[] | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const dirForward = direction === 'next';
      const picks = start !== undefined ? [...start] : dirForward ? [model.startDelimiter] : [model.endDelimiter];
      const terminator = dirForward ? model.endDelimiter : model.startDelimiter;

      const maxOrder = order !== undefined ? order : start ? start.length : model.maxOrder;
      let curOrder = start !== undefined ? start.length : 1;

      const tempMask = mask !== undefined ? [terminator, ...mask] : [terminator];

      for (let i = 0; picks.length <= max; i += 1) {
        if (curOrder < maxOrder) curOrder += 1;

        const pickMask = picks.length < min ? tempMask : mask;

        const gram = strict
          ? MarkovChain.getGram(model, MarkovChain.getSequence(picks, curOrder, dirForward))
          : MarkovChain.findGram(model, picks, curOrder, direction);

        if (gram === undefined) break;

        curOrder = gram.order;

        const gramSequence = gram.id.split(model.delimiter);

        const pick = MarkovChain.pick(model, gramSequence, dirForward, pickMask, eng);

        if (pick) {
          if (dirForward) {
            picks.push(pick);
          } else {
            picks.unshift(pick);
          }

          if (pick === terminator) break;
        } else {
          break;
        }
      }

      // Track this attempt for fallback
      const trimmedPicks = trim ? picks.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v)) : picks;
      lastAttempt = trimmedPicks;

      if (MarkovChain.validateConstraints(picks, constraints, model)) {
        return trimmedPicks;
      }
    }

    return lastAttempt ?? [];
  }

  /**
   * Analyzes a sequence's sources and sinks by generating sample sequences.
   *
   * **Side effect:** This method generates `samples` forward and backward
   * sequences, which advances the PRNG engine state. If you need deterministic
   * generation after calling `analyze()`, clone the engine before passing it,
   * or use a dedicated engine instance for analysis.
   */
  static analyze({
    model,
    start,
    order,
    samples = defaultAnalyzeOptions.samples,
    normalize = true,
    min = defaultAnalyzeOptions.min,
    max = defaultAnalyzeOptions.max,
    mask,
    strict = defaultAnalyzeOptions.strict,
    engine,
  }: MCAnalyzeStaticOptions) {
    const s = start || [model.startDelimiter];
    const results: MCAnalysis = { sequence: s, sources: {}, sinks: {} };

    for (let i = 0; i < samples; i += 1) {
      const sink = MarkovChain.generate({
        model,
        start: s,
        order,
        min,
        max,
        direction: 'next',
        mask,
        strict,
        trim: true,
        engine,
      });

      const source = MarkovChain.generate({
        model,
        start: s,
        order,
        min,
        max,
        direction: 'last',
        mask,
        strict,
        trim: true,
        engine,
      });

      const sinkState = sink[sink.length - 1];
      const sourceState = source[0];

      if (sinkState !== undefined) {
        if (results.sinks[sinkState] === undefined) results.sinks[sinkState] = 0;
        results.sinks[sinkState]! += 1;
      }

      if (sourceState !== undefined) {
        if (results.sources[sourceState] === undefined) results.sources[sourceState] = 0;
        results.sources[sourceState]! += 1;
      }
    }

    return normalize
      ? {
          sequence: s,
          sources: normalizeObject(results.sources),
          sinks: normalizeObject(results.sinks),
        }
      : results;
  }

  static new(
    options: {
      sequences?: string[][];
      maxOrder?: number;
      insert?: MCInsertOption;
      stripSequences?: boolean;
    } = {}
  ): MarkovChainDTO {
    const { sequences, maxOrder = defaultOptions.maxOrder, insert = false, stripSequences = false } = options;
    if (maxOrder <= 0) {
      throw new RangeError(`MarkovChain.new: maxOrder must be > 0 (got ${maxOrder})`);
    }
    const dto = stripSequences ? { ...defaultOptions, maxOrder, grams: {} } : { ...defaultDTO, maxOrder };
    return sequences ? MarkovChain.addSequences(dto, sequences, insert) : { ...defaultDTO, maxOrder };
  }

  static clone(model: MarkovChainDTO, stripSequences = false): MarkovChainDTO {
    const { sequences, grams, ...dtoData } = model;

    const sequencesClone = sequences !== undefined && !stripSequences ? sequences.map(s => s.slice()) : undefined;

    const gramsClone: GramDictionary = {};
    for (const key in grams) {
      const gram = grams[key];
      if (!gram) continue;

      gramsClone[key] = {
        ...gram,
        last: { source: { ...gram.last.source }, normal: { ...gram.last.normal } },
        next: { source: { ...gram.next.source }, normal: { ...gram.next.normal } },
      };
    }

    return sequencesClone !== undefined
      ? ({
          ...dtoData,
          sequences: sequencesClone,
          grams: gramsClone,
        } as MarkovChainDTO)
      : ({ ...dtoData, grams: gramsClone } as MarkovChainDTO);
  }

  /**
   * Score a sequence against a DTO model.
   * Static dual-API counterpart to the instance `score()` method.
   */
  static score(model: MarkovChainDTO, sequence: string[], order?: number): MCSequenceScore {
    const useOrder = order ?? model.maxOrder;
    let logProb = 0;
    let validTransitions = 0;

    const formatted = [model.startDelimiter, ...sequence, model.endDelimiter];

    for (let i = 0; i < formatted.length; i++) {
      const context = formatted.slice(Math.max(0, i - useOrder), i);
      const nextState = formatted[i];

      if (context.length === 0 || nextState === undefined) continue;

      const gram = MarkovChain.findGram(model, context, useOrder, 'next');
      if (gram) {
        const prob = gram.next.normal[nextState];
        if (prob !== undefined && prob > 0) {
          logProb += Math.log(prob);
          validTransitions++;
        }
      }
    }

    const isValid = validTransitions > 0;
    const perplexity = isValid ? Math.exp(-logProb / validTransitions) : Infinity;
    const normalized = validTransitions > 0 ? logProb / validTransitions : -Infinity;

    return { sequence, logProb, perplexity, isValid, normalized };
  }

  /**
   * Get statistics about a DTO model.
   * Static dual-API counterpart to the instance `getStats()` method.
   */
  static getStats(model: MarkovChainDTO): MarkovChainStats {
    const grams = Object.values(model.grams);
    const orders = grams.map(g => g.order);
    const minOrder = orders.length > 0 ? Math.min(...orders) : 0;
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;

    return {
      gramCount: grams.length,
      sequenceCount: model.sequences?.length ?? 0,
      orderRange: [minOrder, maxOrder],
      avgDegreeIn: grams.length > 0 ? grams.reduce((sum, g) => sum + g.degreeIn, 0) / grams.length : 0,
      avgDegreeOut: grams.length > 0 ? grams.reduce((sum, g) => sum + g.degreeOut, 0) / grams.length : 0,
    };
  }

  /**
   * Blend multiple Markov chain DTOs together with weighted combination.
   * Static dual-API: operates on DTOs directly without requiring instances.
   */
  static blendDTOs(models: { model: MarkovChainDTO; weight: number }[], options?: BlendOptions): MarkovChainDTO {
    if (models.length === 0) {
      throw new Error('Cannot blend zero models');
    }

    if (models.length === 1) {
      return MarkovChain.clone(models[0]!.model);
    }

    const { strategy = 'arithmetic', normalize = true, minWeight = 0 } = options || {};

    const totalWeight = models.reduce((sum, c) => sum + c.weight, 0);
    const normalizedModels = normalize ? models.map(c => ({ ...c, weight: c.weight / totalWeight })) : models;

    const allGramIds = new Set<string>();
    for (const { model } of models) {
      Object.keys(model.grams).forEach(id => allGramIds.add(id));
    }

    const blendedGrams: GramDictionary = {};

    for (const gramId of allGramIds) {
      const gramConfigs: Array<{ gram: Gram; weight: number }> = [];

      for (const { model, weight } of normalizedModels) {
        const gram = model.grams[gramId];
        if (gram) {
          gramConfigs.push({ gram, weight });
        }
      }

      if (gramConfigs.length === 0) continue;

      const nextDists = gramConfigs.map(g => g.gram.next);
      const weights = gramConfigs.map(g => g.weight);
      const blendedNext = blendMultipleDistributions(nextDists, weights, strategy);

      const lastDists = gramConfigs.map(g => g.gram.last);
      const blendedLast = blendMultipleDistributions(lastDists, weights, strategy);

      const firstGram = gramConfigs[0]!.gram;

      if (minWeight > 0) {
        const filteredNext: { [key: string]: number } = {};
        for (const [k, v] of Object.entries(blendedNext.source)) {
          if ((v as number) >= minWeight) filteredNext[k] = v as number;
        }
        const filteredLast: { [key: string]: number } = {};
        for (const [k, v] of Object.entries(blendedLast.source)) {
          if ((v as number) >= minWeight) filteredLast[k] = v as number;
        }

        blendedNext.source = filteredNext;
        blendedNext.normal = normalizeObject(filteredNext);
        blendedLast.source = filteredLast;
        blendedLast.normal = normalizeObject(filteredLast);
      }

      blendedGrams[gramId] = {
        id: firstGram.id,
        order: firstGram.order,
        next: blendedNext,
        last: blendedLast,
        frequency: gramConfigs.reduce((sum, { gram, weight }) => sum + gram.frequency * weight, 0),
        degreeIn: Object.keys(blendedLast.source).length,
        degreeOut: Object.keys(blendedNext.source).length,
      };
    }

    const baseModel = models[0]!.model;

    return {
      maxOrder: baseModel.maxOrder,
      delimiter: baseModel.delimiter,
      startDelimiter: baseModel.startDelimiter,
      endDelimiter: baseModel.endDelimiter,
      grams: blendedGrams,
    };
  }

  /**
   * Blend multiple Markov chains together with weighted combination.
   * Convenience wrapper around `blendDTOs` that accepts chain instances.
   */
  static blend<T extends string = string>(chains: ChainBlendConfig<T>[], options?: BlendOptions): MarkovChain<T> {
    if (chains.length === 0) {
      throw new Error('Cannot blend zero chains');
    }

    if (chains.length === 1) {
      return chains[0]!.chain.clone() as MarkovChain<T>;
    }

    const dtoModels = chains.map(c => ({ model: c.chain.model, weight: c.weight }));
    const blendedDTO = MarkovChain.blendDTOs(dtoModels, options);

    return new MarkovChain<T>({
      maxOrder: blendedDTO.maxOrder,
      delimiter: blendedDTO.delimiter,
      startDelimiter: blendedDTO.startDelimiter,
      endDelimiter: blendedDTO.endDelimiter,
      grams: blendedDTO.grams,
    });
  }
}
