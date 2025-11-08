/*
 # markov.ts
 # Markov Chain Class
 */

/*
 # Specification
 */

/****************
SUMMARY:
- Class definition for markov chain.
- All static functions should be immutable.
- All member functions should utilize immutable static functions.
- Supports source obfuscation by providing optional sequenceless distributions.

TESTING:


TODO:
- Add methods for remove sequence(s), edges and grams.
- Add methods for editing sequence(s) and grams.
- Refactor sequences array into weighted dictionary to reduce duplication.
- Expose ability to set weight when adding a sequence (dependent on above).
- Add methods for start / end analysis.
- Add methods for sequence dictionary reconstruction from GramDTOs.
*****************/

/**
 # Module Dependencies
 */

import { normalizeObject } from 'scalr';
import { Random, RandomDTO } from '../services';
import { Distribution, DistributionSourceDTO } from './distribution';
import { CONSTANTS } from '..';

/**
 # Types
 */

// State type can be anything, but internally stored as strings
export type StateId = string | number;
export type StateSelector<T> = (id: StateId) => T | undefined;

export type MCDirectionOption = 'next' | 'last';
export type MCInsertOption = boolean | 'start' | 'end' | 'middle';
export type MCDelimitersShort = [string, string, string];
export type GramDictionary = { [key: string]: Gram };

export interface MarkovChainOptions extends RandomDTO {
  maxOrder: number;
  delimiter: string;
  startDelimiter: string;
  endDelimiter: string;
}

export interface MarkovChainSequenceDTO extends MarkovChainOptions {
  sequences: string[][];
  grams: GramDictionary;
}

export interface MarkovChainGramDTO extends MarkovChainOptions {
  sequences?: string[][];
  grams: GramDictionary;
}

export type MarkovChainDTO = MarkovChainSequenceDTO | MarkovChainGramDTO;

export interface MarkovChainConstructor<T extends string = string> extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
  engine?: Random;
  sequences?: string[][];
  grams?: GramDictionary;
  insert?: MCInsertOption;
  stateSelector?: StateSelector<T>;
}

export interface Gram {
  id: string;
  last: DistributionSourceDTO;
  next: DistributionSourceDTO;
  order: number;
  frequency: number;
  degreeIn: number;
  degreeOut: number;
}

export interface MCConstraints {
  minLength?: number;
  maxLength?: number;
  mustContain?: string[];
  mustNotContain?: string[];
  pattern?: RegExp;
  validator?: (sequence: string[]) => boolean;
  maxRetries?: number;
}

export interface MCGeneratorOptions {
  start?: string[];
  order?: number;
  min?: number;
  max?: number;
  direction?: MCDirectionOption;
  mask?: string[];
  strict?: boolean;
  trim?: boolean;
  constraints?: MCConstraints;
}

export interface MCGeneratorStaticOptions extends MCGeneratorOptions {
  model: MarkovChainDTO;
  engine?: Random;
}

export interface MCAnalyzeOptions extends MCGeneratorOptions {
  samples?: number;
  normalize?: boolean;
}

export interface MCAnalyzeStaticOptions extends MCAnalyzeOptions, MCGeneratorStaticOptions {}

export interface MCAnalysis {
  sequence: string[];
  sources: { [key: string]: number };
  sinks: { [key: string]: number };
}

export interface MarkovChainStats {
  gramCount: number;
  sequenceCount: number;
  orderRange: [number, number];
  avgDegreeIn: number;
  avgDegreeOut: number;
}

export interface MCSequenceScore {
  sequence: string[];
  logProb: number;
  perplexity: number;
  isValid: boolean;
  normalized: number;
}

export interface MCRankedSequence extends MCSequenceScore {
  rank: number;
}

/**
 # Constants
 */

const defaultOptions = {
  maxOrder: 4,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
};

const defaultDTO: MarkovChainDTO = {
  ...defaultOptions,
  sequences: [],
  grams: {},
};

const defaultGenOptions = {
  min: 1,
  max: 100,
  direction: 'next' as MCDirectionOption,
  strict: true,
  trim: true,
};

const defaultAnalyzeOptions = {
  ...defaultGenOptions,
  samples: 1000,
  normalize: true,
};

/**
 # Utility Functions
 */

/**
 * We define these here because scope of immutability depends on the
 * scope of the function's changes.
 **/

/**
 * Formats a sequence for addition or insertion into a gram dictionary.
 * @param gramSequence  The sequence to be formatted.
 * @param insert        The addition / insertion type.
 * @param delimiters    The delimiters for start / middle / end states.
 */
function formatGramSequence(gramSequence: string[], insert: MCInsertOption, delimiters: MCDelimitersShort): string[] {
  let result: string[];
  switch (insert) {
    case 'start':
      result = [delimiters[0], ...gramSequence];
      break;
    case 'end':
      result = [...gramSequence, delimiters[2]];
      break;
    case 'middle':
    case true:
      result = [...gramSequence];
      break;
    case false:
    default:
      result = [delimiters[0], ...gramSequence, delimiters[2]];
      break;
  }
  return result;
}

/**
 * Determines the Gram id of a sequence given a between-state delimiter.
 * @param gramSequence  The sequence to be identified.
 * @param delimiter     The between-state delimiter to use.
 */
function getGramId(gramSequence: string[], delimiter: string) {
  return gramSequence.join(delimiter);
}

/**
 * Extracts delimiters from a Markov Chain and formats them in short format.
 * @param data A Markov Chain data transfer object to extract delimiters from.
 */
function getDelimiters(data: MarkovChainDTO): MCDelimitersShort {
  const start = data.startDelimiter[0];
  const middle = data.delimiter[0];
  const end = data.endDelimiter[0];

  // Delimiters must have at least one character
  if (!start || !middle || !end) {
    throw new Error('Delimiters must have at least one character');
  }

  return [start, middle, end];
}

/**
 * Breaks down a sequence into Grams and adds them plus any edges to
 * the gram dictionary.
 * @param grams       The Gram Dictionary.
 * @param sequence    The sequence to be added to the dictionary.
 * @param insert      Whether or not the sequence should be added or inserted.
 * @param weight      The weight of any edges created between Grams and states.
 * @param maxOrder    The maximum allowed order to generate.
 * @param delimiters  The delimiters for start / middle / end states.
 */
function addSequence(
  grams: GramDictionary,
  sequence: string[],
  insert: MCInsertOption,
  weight: number,
  maxOrder: number,
  delimiters: MCDelimitersShort
) {
  // Format the sequence for addition or insertion.
  const seq = formatGramSequence(sequence, insert, delimiters);

  // Iterate through each order.
  for (let order = 1; order <= maxOrder; order += 1) {
    // Iterate through each position in the array.
    for (let pos = 0; pos < seq.length; pos += 1) {
      const nextPos = pos + order;
      const lastPos = pos - 1;

      // Find the previous and next states.
      const lastState = lastPos >= 0 ? seq[lastPos] : undefined;
      const nextState = nextPos < seq.length ? seq[nextPos] : undefined;

      // Get the gram sequence and id.
      const gramSeq = seq.slice(pos, nextPos);
      const delimiter = delimiters[1]?.[0];
      if (!delimiter) {
        throw new Error('Invalid delimiter configuration');
      }
      const gramId = getGramId(gramSeq, delimiter);

      // Add the gram to the dictionary if it doesn't exist.
      // NOTE: We don't do this here anymore because addEdge does this for us.
      // if (grams[gramId] === undefined) addGram(grams, gramId, gramSeq.length);

      // Add the gram and the edges.
      addEdge(grams, gramId, lastState, nextState, order, weight);

      // Break if we've hit the end.
      if (nextState === undefined) break;
    }
  }

  return grams;
}

/**
 * Adds a Gram and related edges to a dictionary.
 * @param grams   The Gram Dictionary.
 * @param gramId  The id of the Gram to add.
 * @param lastId  The id of the last State in the sequence.
 * @param nextId  The id of the next State in the sequence.
 * @param order   The order of the Gram we're adding.
 * @param weight  The weight to add to the edge.
 */
function addEdge(
  grams: GramDictionary,
  gramId: string,
  lastId: string | undefined,
  nextId: string | undefined,
  order: number,
  weight: number
  // order: number,
) {
  // Add the gram to the dictionary if it doesn't exist.
  // const order = gramId.length > 1 ? Math.ceil(gramId.length / 2) : 1;
  if (grams[gramId] === undefined) addGram(grams, gramId, order);

  // Add the edges to the distributions.
  const gram = grams[gramId];
  if (!gram) {
    throw new Error(`Failed to create or retrieve gram: ${gramId}`);
  }

  // Add edge weights, and if this is a new state, update degree.
  if (lastId !== undefined) {
    if (!gram.last.normal[lastId]) gram.degreeIn += 1;
    addEdgeWeight(gram, lastId, weight, 'last');
  }

  if (nextId !== undefined) {
    if (!gram.next.normal[nextId]) gram.degreeOut += 1;
    addEdgeWeight(gram, nextId, weight, 'next');
  }
}

/**
 * Adds weight to a directed edge between a Gram and a State.
 * @param source    The Gram to use as the source.
 * @param targetId  The id of the State to use as the target.
 * @param weight    The weight to add to the edge.
 * @param direction The direction of the edge in the chain.
 */
function addEdgeWeight(source: Gram, targetId: string, weight: number, direction: MCDirectionOption) {
  source[direction] = Distribution.addSourceValue(source[direction], targetId, weight);
}

/**
 * Adds a Gram to a Gram dictionary.
 * @param grams   A dictionary of Grams.
 * @param gramId  The id of the Gram to be added to the dictionary.
 * @param order   The order of the Gram.
 */
function addGram(grams: GramDictionary, gramId: string, order: number) {
  const result = (grams[gramId] = {
    id: gramId,
    order,
    last: Distribution.new(),
    next: Distribution.new(),
    degreeIn: 0,
    degreeOut: 0,
    frequency: 0,
  });
  return result;
}

/**
 # Class
 */

export class MarkovChain<T extends string = string> {
  private _engine: Random;
  private _model: MarkovChainDTO;
  private _stateSelector?: StateSelector<T>;

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
    stateSelector,
  }: MarkovChainConstructor<T>) {
    this._engine = engine || new Random({ seed, uses });
    this._stateSelector = stateSelector;
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
      if (!grams || Object(grams).length === 0) {
        // Then add the sequences.
        this._model.grams = {};
        this._model.sequences = [];
        this.addSequences(sequences, insert);
      } else {
        // Otherwise, if we have sequences and grams, then add them.
        this._model.grams = grams;
        this._model.sequences = sequences;
      }
    }
  }

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

  get stateSelector() {
    return this._stateSelector;
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
   * Updates a Markov Chain's members from a DTO.
   * @param dto
   */
  private update(dto: MarkovChainDTO) {
    this._model = dto;
    return this;
  }

  /**
   * Returns the id of a Gram from its sequence.
   * @param gramSequence  An array containing the Gram sequence.
   */
  public getGramId(gramSequence: string[]) {
    return gramSequence.join(this._model.delimiter);
  }

  /**
   * Returns the corresponding Gram from a sequence.
   * @param gramSequence  An array containing the Gram sequence.
   */
  public getGram(gramSequence: string[]) {
    const id = this.getGramId(gramSequence);
    return this._model.grams[id];
  }

  /**
   * Finds the valid gram of the highest valid order in a sequence.
   * @param model           A Markov Chain data transfer object.
   * @param gramSequence    An array containing the Gram sequence.
   * @param order           The highest order to look for.
   * @param direction       The direction we are looking for sequences in.
   *                        "next" will look for grams at the end of the sequence.
   *                        "last" will look for grams at the beginning of the sequence.
   */
  public findGram(gramSequence: string[], order?: number, direction = 'next') {
    return MarkovChain.findGram(this._model, gramSequence, order, direction);
  }

  /**
   * Adds or inserts a list of Sequences into a Markov Chain DTO.
   * @param sequences  The sequences to be added.
   * @param insert    Determines how sequences should be inserted. If false, delimiters will be
   *                  prepended and appended to the sequences.
   *                  "start" or setting true will only prepend the start delimiter, while
   *                  "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  public addSequences(sequences: string[][], insert: MCInsertOption = false) {
    const data = MarkovChain.addSequences(this._model, sequences, insert);
    return this.update(data);
  }

  /**
   * Adds or inserts a Sequence into a Markov Chain DTO.
   * @param sequence  The sequence to be added.
   * @param insert    Determines how sequences should be inserted. If false, delimiters will be
   *                  prepended and appended to the sequences.
   *                  "start" or setting true will only prepend the start delimiter, while
   *                  "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  public addSequence(sequence: string[], insert: MCInsertOption = false) {
    const data = MarkovChain.addSequence(this._model, sequence, insert);
    return this.update(data);
  }

  /**
   * Adds an edge from a gram to the items before and after it in the sequence.
   * @param gram    The id of a gram, or the gram sequence.
   * @param lastId  The id of the previous gram in the sequence.
   * @param nextId  The id of the next gram in the sequence.
   * @param order   The order of the Gram we're adding.
   */
  public addEdge(gram: string | string[], lastId: string | undefined, nextId: string | undefined, order: number) {
    const data = MarkovChain.addEdge(this._model, gram, lastId, nextId, order);
    return this.update(data);
  }

  /**
   * Picks the next or last random value from a Markov Chain.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param next          If true states that come after the gram will be picked.
   *                      If false states that came before the gram will be picked.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public pick(gramSequence?: string[], next = true, mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, next, mask, this._engine);
  }

  /**
   * Picks the next random value from a Markov Chain given a sequence.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public next(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, true, mask, this._engine);
  }

  /**
   * Picks the last random value from a Markov Chain given a sequence.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public last(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._model, gramSequence, false, mask, this._engine);
  }

  /**
   * Generates a sequence from a Markov Chain.
   * @param start       The sequence to start with. If this is not defined, the sequence will start from the beginning or end (as appropriate to the direction).
   * @param order       The desired order (gram length) for the picks. Higher values will reduce randomness. If this is not defined it will default to the model's max order.
   * @param min         The minimum length of the sequence. This will not prevent early termination if suitable grams or states cannot be found.
   * @param max         The maximum length of the sequence.
   * @param direction   The direction of the picks - "next" will pick states after the sequence, "last" will pick states before.
   * @param mask        A mask containing keys in the chain that should be ignored.
   * @param strict      If true, order will not be dynamically adjusted to find suitable grams.
   *                    Order will still be adjusted if the starting sequence provided is less than the max order to get up to the preferred order.
   * @param trim        If true, delimiters will be trimmed from the chain.
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
   * Analyze's a sequences sources and sinks. Generates a number of samples from a given gram sequence, and gives the resulting
   * distribution of where the generated sequences terminated both backwards (sources) and forwards (sinks).
   * @param start       The sequence to start with. If this is not defined, the sequence will start from the beginning or end (as appropriate to the direction).
   * @param order       The desired order (gram length) for the picks. Higher values will reduce randomness. If this is not defined it will default to the model's max order.
   * @param samples     The desired number of samples to collect.
   * @param min         The minimum length of the sequence. This will not prevent early termination if suitable grams or states cannot be found.
   * @param max         The maximum length of the sequence.
   * @param mask        A mask containing keys in the chain that should be ignored.
   * @param strict      If true, order will not be dynamically adjusted to find suitable grams.
   *                    Order will still be adjusted if the starting sequence provided is less than the max order to get up to the preferred order.
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
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  public serialize(stripSequences = false): MarkovChainDTO {
    // Create the DTO
    return MarkovChain.clone(this._model, stripSequences);
  }

  /**
   * Ceates a clone of the Markov Chain.
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  public clone(stripSequences = false) {
    return new MarkovChain(this.serialize(stripSequences));
  }

  /**
   * Start a batch operation for efficient incremental updates.
   * All operations are queued and applied in a single clone operation.
   *
   * @example
   * ```ts
   * const chain = new MarkovChain({ seed: 1 });
   * const updated = chain.batch()
   *   .addSequence(['a', 'b', 'c'])
   *   .addSequence(['d', 'e', 'f'])
   *   .addEdge(['a', 'b'], 'x', 'y', 2)
   *   .commit();
   * ```
   */
  public batch(): MarkovChainBatch<T> {
    // Import is handled at top of file to avoid issues
    return new MarkovChainBatch<T>(this);
  }

  /**
   * Blend this chain with another chain using interpolation.
   * Creates a new chain where probabilities are a weighted combination of both chains.
   *
   * @param otherChain The chain to blend with
   * @param alpha Interpolation factor (0 = all this chain, 1 = all other chain)
   * @param options Blending options
   * @returns A new blended chain
   *
   * @example
   * ```ts
   * const mother = new MarkovChain({ sequences: motherTraits });
   * const father = new MarkovChain({ sequences: fatherTraits });
   *
   * // 70% mother, 30% father
   * const child = mother.interpolate(father, 0.3);
   * ```
   */
  public interpolate<U extends string = string>(
    otherChain: MarkovChain<U>,
    alpha: number,
    options?: BlendOptions
  ): MarkovChain<T> {
    return MarkovChain.blend(
      [
        { chain: this, weight: 1 - alpha },
        { chain: otherChain as unknown as MarkovChain<T>, weight: alpha }
      ],
      options
    );
  }

  /**
   * Attach a state selector for resolving IDs to values.
   * Useful when storing numeric/string IDs in the chain and want to resolve to objects.
   *
   * @param selector Function to resolve state IDs to values
   * @returns A new MarkovChain instance with the selector attached
   *
   * @example
   * ```ts
   * const lookup = new Map([[1, obj1], [2, obj2]]);
   * const withSelector = chain.withSelector(id => lookup.get(id as number));
   * const values = withSelector.generate({ order: 2 }); // Returns T[] instead of string[]
   * ```
   */
  public withSelector<U extends string = string>(selector: StateSelector<U>): MarkovChain<U> {
    const cloned = this.clone();
    const newChain = cloned as unknown as MarkovChain<U>;
    (newChain as any)._stateSelector = selector;
    return newChain;
  }

  /**
   * Check if a gram exists in the chain.
   * @param gramSequence The gram sequence to check
   * @returns True if the gram exists
   */
  public hasGram(gramSequence: string[]): boolean {
    const id = this.getGramId(gramSequence);
    return id in this._model.grams;
  }

  /**
   * Get all grams of a specific order.
   * @param order The order to filter by
   * @returns Array of grams with the specified order
   */
  public getGramsByOrder(order: number): Gram[] {
    return Object.values(this._model.grams).filter(gram => gram.order === order);
  }

  /**
   * Get statistics about the Markov Chain.
   * @returns Statistics including gram count, sequence count, and degree information
   */
  public getStats(): MarkovChainStats {
    const grams = Object.values(this._model.grams);
    const orders = grams.map(g => g.order);
    const minOrder = orders.length > 0 ? Math.min(...orders) : 0;
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;

    return {
      gramCount: grams.length,
      sequenceCount: this._model.sequences?.length ?? 0,
      orderRange: [minOrder, maxOrder],
      avgDegreeIn: grams.length > 0 ? grams.reduce((sum, g) => sum + g.degreeIn, 0) / grams.length : 0,
      avgDegreeOut: grams.length > 0 ? grams.reduce((sum, g) => sum + g.degreeOut, 0) / grams.length : 0,
    };
  }

  /**
   * Calculate the log probability and perplexity of a sequence.
   * @param sequence The sequence to score
   * @param order The order to use for scoring (defaults to maxOrder)
   * @returns Score object with logProb, perplexity, and validity
   */
  public score(sequence: string[], order?: number): MCSequenceScore {
    const useOrder = order ?? this._model.maxOrder;
    let logProb = 0;
    let validTransitions = 0;
    let totalTransitions = 0;

    // Format sequence with delimiters
    const formatted = [this._model.startDelimiter, ...sequence, this._model.endDelimiter];

    // Calculate log probability for each transition
    for (let i = 0; i < formatted.length; i++) {
      const context = formatted.slice(Math.max(0, i - useOrder), i);
      const nextState = formatted[i];

      if (context.length === 0 || nextState === undefined) continue;

      const gram = MarkovChain.findGram(this._model, context, useOrder, 'next');
      if (gram) {
        const prob = gram.next.normal[nextState];
        if (prob !== undefined && prob > 0) {
          logProb += Math.log(prob);
          validTransitions++;
        }
      }
      totalTransitions++;
    }

    const isValid = validTransitions > 0;
    const perplexity = isValid ? Math.exp(-logProb / validTransitions) : Infinity;

    // Normalize log probability by sequence length for comparison
    const normalized = validTransitions > 0 ? logProb / validTransitions : -Infinity;

    return {
      sequence,
      logProb,
      perplexity,
      isValid,
      normalized,
    };
  }

  /**
   * Rank multiple sequences by their likelihood.
   * @param sequences Array of sequences to rank
   * @param order The order to use for scoring
   * @returns Ranked sequences sorted by likelihood (best first)
   */
  public rankByLikelihood(sequences: string[][], order?: number): MCRankedSequence[] {
    const scored = sequences.map(seq => this.score(seq, order));

    // Sort by normalized log probability (higher is better)
    scored.sort((a, b) => b.normalized - a.normalized);

    // Add ranks
    return scored.map((score, index) => ({
      ...score,
      rank: index + 1,
    }));
  }

  /**
   * Detect if a sequence is anomalous based on its probability.
   * @param sequence The sequence to check
   * @param threshold The perplexity threshold above which a sequence is considered anomalous
   * @param order The order to use for scoring
   * @returns True if the sequence is anomalous (unlikely)
   */
  public isAnomaly(sequence: string[], threshold: number = 50, order?: number): boolean {
    const score = this.score(sequence, order);
    return !score.isValid || score.perplexity > threshold;
  }

  /**
   * Validate a sequence against constraints.
   * @param sequence The sequence to validate
   * @param constraints The constraints to check against
   * @param model The Markov Chain model (for delimiter trimming)
   * @returns True if the sequence satisfies all constraints
   */
  private static validateConstraints(
    sequence: string[],
    constraints: MCConstraints | undefined,
    model: MarkovChainDTO
  ): boolean {
    if (!constraints) return true;

    // Trim delimiters for constraint checking
    const trimmed = sequence.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v));

    // Check length constraints
    if (constraints.minLength !== undefined && trimmed.length < constraints.minLength) return false;
    if (constraints.maxLength !== undefined && trimmed.length > constraints.maxLength) return false;

    // Check mustContain
    if (constraints.mustContain) {
      for (const required of constraints.mustContain) {
        if (!trimmed.includes(required)) return false;
      }
    }

    // Check mustNotContain
    if (constraints.mustNotContain) {
      for (const forbidden of constraints.mustNotContain) {
        if (trimmed.includes(forbidden)) return false;
      }
    }

    // Check pattern
    if (constraints.pattern) {
      const joined = trimmed.join('');
      if (!constraints.pattern.test(joined)) return false;
    }

    // Check custom validator
    if (constraints.validator && !constraints.validator(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Returns the id of a Gram from its sequence.
   * @param model          A Markov Chain data transfer object.
   * @param gramSequence  An array containing the Gram sequence.
   */
  static getGramId(model: MarkovChainDTO, gramSequence: string[]) {
    return gramSequence.join(model.delimiter);
  }

  /**
   * Returns the corresponding Gram from a sequence.
   * @param model          A Markov Chain data transfer object.
   * @param gramSequence  An array containing the Gram sequence.
   */
  static getGram(model: MarkovChainDTO, gramSequence: string[]) {
    const id = MarkovChain.getGramId(model, gramSequence);
    return model.grams[id];
  }

  /**
   * Finds the valid gram of the highest valid order in a sequence.
   * @param model           A Markov Chain data transfer object.
   * @param gramSequence    An array containing the Gram sequence.
   * @param order           The highest order to look for.
   * @param direction       The direction we are looking for sequences in.
   *                        "next" will look for grams at the end of the sequence.
   *                        "last" will look for grams at the beginning of the sequence.
   */
  static findGram(model: MarkovChainDTO, gramSequence: string[], order?: number, direction = 'next') {
    // Determine the max order for the pick and our sequence.
    const dirForward = direction === 'next';
    const curOrder = order || gramSequence.length;
    let sequence = dirForward ? gramSequence.slice(curOrder * -1) : gramSequence.slice(0, curOrder);
    let gram = MarkovChain.getGram(model, sequence);

    // If we don't find a gram immediately, find a suitable gram by stepping down our current order until we find one.
    if (!gram) {
      for (let o = curOrder - 1; o > 0; o -= 1) {
        sequence = dirForward ? gramSequence.slice(o * -1) : gramSequence.slice(0, o);
        gram = MarkovChain.getGram(model, sequence);
        if (gram !== undefined) break;
      }
    }

    return gram;
  }

  /**
   * Utility function to find a sequence given an order and a direction.
   * This returns an array containing the first or last elements of an array equal to the order.
   * @param gramSequence    An array containing the Gram sequence.
   * @param order           The length of the array to return.
   * @param next            If true, will find elements at the end. If false will find elements at the beginning.
   */
  static getSequence(gramSequence: string[], order: number, next: boolean) {
    return next ? gramSequence.slice(order * -1) : gramSequence.slice(0, order);
  }

  /**
   * Adds or inserts a list of Sequences into a Markov Chain DTO.
   * @param model       A Markov Chain data transfer object.
   * @param sequences   The sequences to be added.
   * @param insert      Determines how sequences should be inserted. If false, delimiters will be
   *                    prepended and appended to the sequences.
   *                    "start" or setting true will only prepend the start delimiter, while
   *                    "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  static addSequences(model: MarkovChainDTO, sequences: string[][], insert: MCInsertOption = false): MarkovChainDTO {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(model);
    const delimiters = getDelimiters(m);

    // Add the sequences.
    for (let i = 0; i < sequences.length; i += 1) {
      const sequence = sequences[i];
      if (!sequence) continue;
      if (m.sequences !== undefined) m.sequences.push(sequence);
      addSequence(m.grams, sequence, insert, 1, m.maxOrder, delimiters);
    }

    return m;
  }

  // static removeSequences() {}

  /**
   * Adds or inserts a Sequence into a Markov Chain DTO.
   * @param model      A Markov Chain data transfer object.
   * @param sequence  The sequence to be added.
   * @param insert    Determines how sequences should be inserted. If false, delimiters will be
   *                  prepended and appended to the sequences.
   *                  "start" or setting true will only prepend the start delimiter, while
   *                  "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  static addSequence(model: MarkovChainDTO, sequence: string[], insert: MCInsertOption = false): MarkovChainDTO {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(model);
    const delimiters = getDelimiters(m);

    // Add the sequence.
    if (m.sequences !== undefined) m.sequences.push(sequence);
    addSequence(m.grams, sequence, insert, 1, m.maxOrder, delimiters);

    return m;
  }

  /**
   * Adds an edge from a gram to the items before and after it in the sequence.
   * @param model    A Markov Chain data transfer object.
   * @param gram    The id of a gram, or the gram sequence.
   * @param lastId  The id of the previous gram in the sequence.
   * @param nextId  The id of the next gram in the sequence.
   * @param order   The order of the Gram we're adding.
   */
  static addEdge(
    model: MarkovChainDTO,
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined,
    order: number,
    weight = 1
  ) {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(model);

    // Check to see if we need to calculate the id.
    const delimiter = m.delimiter[0];
    if (!delimiter) {
      throw new Error('Invalid delimiter configuration');
    }
    const id = Array.isArray(gram) ? getGramId(gram, delimiter) : gram;

    // Add the edge.
    addEdge(m.grams, id, lastId, nextId, order, weight);

    return m;
  }

  // static removeEdge() {}

  /**
   * Makes a random pick from the next or last state of a given Gram.
   * @param gram    The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param next    If true states that come after the gram will be picked.
   *                If false states that came before the gram will be picked.
   * @param mask    A mask containing keys in the chain that should be ignored.
   * @param engine  A Random engine.
   */
  static pickGram(gram: Gram, next = true, mask?: string[], engine?: Random) {
    const distribution = next ? gram.next : gram.last;
    return Distribution.pickOne(distribution, mask, engine);
  }

  /**
   * Picks the next or last random value from a Markov Chain.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param next          If true states that come after the gram will be picked.
   *                      If false states that came before the gram will be picked.
   * @param mask          A mask containing keys in the chain that should be ignored.
   * @param engine  A Random engine.
   */
  static pick(model: MarkovChainDTO, gramSequence?: string[], next = true, mask?: string[], engine?: Random) {
    const eng = engine || new Random({});
    const seq = gramSequence ? gramSequence : next ? [model.startDelimiter] : [model.endDelimiter];
    const gram = MarkovChain.getGram(model, seq);
    if (!gram) {
      return undefined;
    }
    return MarkovChain.pickGram(gram, next, mask, eng);
  }

  /**
   * Picks the next random value from a Markov Chain given a sequence.
   * @param engine        A Random engine.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  static next(model: MarkovChainDTO, gramSequence?: string[], mask?: string[], engine?: Random) {
    return MarkovChain.pick(model, gramSequence, true, mask, engine);
  }

  /**
   * Picks the last random value from a Markov Chain given a sequence.
   * @param engine        A Random engine.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  static last(model: MarkovChainDTO, gramSequence?: string[], mask?: string[], engine?: Random) {
    return MarkovChain.pick(model, gramSequence, false, mask, engine);
  }

  /**
   * Generates a sequence from a Markov Chain.
   * @param model       A Markov Chain data transfer object.
   * @param start       The sequence to start with. If this is not defined, the sequence will start from the beginning or end (as appropriate to the direction).
   * @param order       The desired order (gram length) for the picks. Higher values will reduce randomness. If this is not defined it will default to the model's max order.
   * @param min         The minimum length of the sequence. This will not prevent early termination if suitable grams or states cannot be found.
   * @param max         The maximum length of the sequence.
   * @param direction   The direction of the picks - "next" will pick states after the sequence, "last" will pick states before.
   * @param mask        A mask containing keys in the chain that should be ignored.
   * @param strict      If true, order will not be dynamically adjusted to find suitable grams.
   *                    Order will still be adjusted if the starting sequence provided is less than the max order to get up to the preferred order.
   * @param trim        If true, delimiters will be trimmed from the chain.
   * @param engine      A Random engine. If one is not provided, a new one will be created for the generation.
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
    const eng = engine || new Random({});
    const maxRetries = constraints?.maxRetries ?? (constraints ? 100 : 1);

    // If constraints are specified, wrap generation in retry logic
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // SETUP
      // Set the starting sequence and the terminating character.
      const dirForward = direction === 'next';
      const picks = start !== undefined ? [...start] : dirForward ? [model.startDelimiter] : [model.endDelimiter];
      const terminator = dirForward ? model.endDelimiter : model.startDelimiter;

      // Determine the order
      const maxOrder = order !== undefined ? order : start ? start.length : model.maxOrder;
      let curOrder = start !== undefined ? start.length : 1;

      // Determine the offset for our picks.
      // Removed this because it wasn't necessary and causing a bug.
      // TODO: Keep as a reminder and then remove if there aren't any long term issues.
      // const pickOffset = trim ? 0 : 0;
      // const minPicks = min + pickOffset;
      // const maxPicks = max + pickOffset;

      // Determine the temporary mask to use while sequence is less than min.
      const tempMask = mask !== undefined ? [terminator, ...mask] : [terminator];

      // Utility function for finding the current sequence given order and direction.

      // MAKE THE PICKS
      for (let i = 0; picks.length <= max; i += 1) {
        // Increase the order if we're below the desired value.
        if (curOrder < maxOrder) curOrder += 1;

        // Determine which mask we should use.
        const pickMask = picks.length < min ? tempMask : mask;

        // Find the gram
        const gram = strict
          ? MarkovChain.getGram(model, MarkovChain.getSequence(picks, curOrder, dirForward))
          : MarkovChain.findGram(model, picks, curOrder, direction);

        // If we can't find a gram, then we need to break;
        if (gram === undefined) break;

        // Set the current order to the Gram's order.
        curOrder = gram.order;

        // Get the Gram sequence.
        const gramSequence = gram.id.split(model.delimiter);

        // Get the gram sequence and then make the pick.
        const pick = MarkovChain.pick(model, gramSequence, dirForward, pickMask, eng);

        // If we have a pick, figure out whether we need to add it to the beginning or end of the picks array.
        if (pick) {
          if (dirForward) {
            picks.push(pick);
          } else {
            picks.unshift(pick);
          }

          // If we've picked the terminator, then break.
          if (pick === terminator) break;
        } else {
          // If we don't have a pick, then break.
          // This could result because of an error in the chain, or because all possible values are masked.
          break;
        }
      }

      // Validate constraints
      if (MarkovChain.validateConstraints(picks, constraints, model)) {
        // FORMAT THE RESULT
        return trim ? picks.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v)) : picks;
      }

      // If constraints not satisfied and not the last attempt, continue to next iteration
    }

    // If all retries failed, return best effort (last attempt)
    const dirForward = direction === 'next';
    const picks = start !== undefined ? [...start] : dirForward ? [model.startDelimiter] : [model.endDelimiter];
    return trim ? picks.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v)) : picks;
  }

  /**
   * Analyze's a sequences sources and sinks. Generates a number of samples from a given gram sequence, and gives the resulting
   * distribution of where the generated sequences terminated both backwards (sources) and forwards (sinks).
   * @param model       A Markov Chain data transfer object.
   * @param start       The sequence to start with. If this is not defined, the sequence will start from the beginning or end (as appropriate to the direction).
   * @param order       The desired order (gram length) for the picks. Higher values will reduce randomness. If this is not defined it will default to the model's max order.
   * @param samples     The desired number of samples to collect.
   * @param min         The minimum length of the sequence. This will not prevent early termination if suitable grams or states cannot be found.
   * @param max         The maximum length of the sequence.
   * @param mask        A mask containing keys in the chain that should be ignored.
   * @param strict      If true, order will not be dynamically adjusted to find suitable grams.
   *                    Order will still be adjusted if the starting sequence provided is less than the max order to get up to the preferred order.
   * @param engine      A Random engine. If one is not provided, a new one will be created for the generation.
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
    // Get the starting sequence.
    const s = start || [model.startDelimiter];
    const results: MCAnalysis = { sequence: s, sources: {}, sinks: {} };

    // Sample the sequences.
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
      ? { sequence: s, sources: normalizeObject(results.sources), sinks: normalizeObject(results.sinks) }
      : results;
  }

  /**
   * Creates a new Markov Chain data transfer object.
   * @param sequences   An optional array of sequences to generate the grams from.
   * @param maxOrder    The maximum gram size of the markov chain.
   * @param insert      Determines how sequences should be inserted. If false, delimiters will be
   *                    prepended and appended to the sequences. "start" or setting true will only prepend the start delimiter, while
   *                    "end" will append the end delimiter. "middle" will not add any delimiters.
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  static new(
    sequences?: string[][],
    maxOrder = defaultOptions.maxOrder,
    insert: MCInsertOption = false,
    stripSequences = false
  ): MarkovChainDTO {
    // Determine whether to store sequences or not.
    const dto = stripSequences ? { ...defaultOptions, maxOrder, grams: {} } : { ...defaultDTO, maxOrder };
    return sequences ? MarkovChain.addSequences(dto, sequences, insert) : { ...defaultDTO, maxOrder };
  }

  /**
   * Create a deep copy of a Markov Chain DTO.
   * @param model           Markov DTO to clone.
   * @param stripSequences  If true this will strip out the sequences, removing the chain's source data.
   */
  static clone(model: MarkovChainDTO, stripSequences = false): MarkovChainDTO {
    const { sequences, grams, ...dtoData } = model;

    // Optimized: Use slice() instead of spread operator for arrays
    const sequencesClone = sequences !== undefined && !stripSequences
      ? sequences.map(s => s.slice())
      : undefined;

    // Optimized: Pre-allocate object and mutate instead of spreading accumulator
    const gramsClone: GramDictionary = {};
    for (const key in grams) {
      const gram = grams[key];
      if (!gram) continue;

      gramsClone[key] = {
        ...gram,
        last: { ...gram.last },
        next: { ...gram.next },
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
   * Blend multiple Markov chains together with weighted combination.
   * Creates a new chain where gram probabilities are combined according to weights.
   *
   * @param chains Array of chains with their weights
   * @param options Blending options
   * @returns A new blended chain
   *
   * @example
   * ```ts
   * const irish = new MarkovChain({ sequences: irishNames });
   * const japanese = new MarkovChain({ sequences: japaneseNames });
   *
   * // 70% Irish, 30% Japanese
   * const blended = MarkovChain.blend([
   *   { chain: irish, weight: 0.7 },
   *   { chain: japanese, weight: 0.3 }
   * ]);
   *
   * // Generate from blended probabilities
   * const name = blended.generate({ order: 2 });
   * ```
   */
  static blend<T extends string = string>(
    chains: ChainBlendConfig<T>[],
    options?: BlendOptions
  ): MarkovChain<T> {
    if (chains.length === 0) {
      throw new Error('Cannot blend zero chains');
    }

    if (chains.length === 1) {
      return chains[0]!.chain.clone() as MarkovChain<T>;
    }

    const {
      strategy = 'arithmetic',
      normalize = true,
      minWeight = 0
    } = options || {};

    // Normalize weights if requested
    const totalWeight = chains.reduce((sum, c) => sum + c.weight, 0);
    const normalizedChains = normalize
      ? chains.map(c => ({ ...c, weight: c.weight / totalWeight }))
      : chains;

    // Collect all unique gram IDs from all chains
    const allGramIds = new Set<string>();
    for (const { chain } of chains) {
      Object.keys(chain.model.grams).forEach(id => allGramIds.add(id));
    }

    // Blend grams
    const blendedGrams: GramDictionary = {};

    for (const gramId of allGramIds) {
      // Collect this gram from all chains that have it
      const gramConfigs: Array<{ gram: Gram; weight: number }> = [];

      for (const { chain, weight } of normalizedChains) {
        const gram = chain.model.grams[gramId];
        if (gram) {
          gramConfigs.push({ gram, weight });
        }
      }

      if (gramConfigs.length === 0) continue;

      // Blend the next distributions
      const nextDists = gramConfigs.map(g => g.gram.next);
      const weights = gramConfigs.map(g => g.weight);
      const blendedNext = blendMultipleDistributions(nextDists, weights, strategy);

      // Blend the last distributions
      const lastDists = gramConfigs.map(g => g.gram.last);
      const blendedLast = blendMultipleDistributions(lastDists, weights, strategy);

      // Use properties from the first gram, but with blended distributions
      const firstGram = gramConfigs[0]!.gram;

      // Filter out low-weight states if threshold is set
      if (minWeight > 0) {
        const filteredNext = Object.fromEntries(
          Object.entries(blendedNext.source).filter(([_, v]) => v >= minWeight)
        );
        const filteredLast = Object.fromEntries(
          Object.entries(blendedLast.source).filter(([_, v]) => v >= minWeight)
        );

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

    // Create new chain with blended grams
    // Use properties from the first chain as defaults
    const baseChain = chains[0]!.chain;

    return new MarkovChain<T>({
      maxOrder: baseChain.maxOrder,
      delimiter: baseChain.model.delimiter,
      startDelimiter: baseChain.model.startDelimiter,
      endDelimiter: baseChain.model.endDelimiter,
      grams: blendedGrams,
      // Don't include sequences as we've synthesized new probabilities
    });
  }
}

/**
 # Batch Operations
 */

type BatchOperation = (model: MarkovChainDTO) => void;

/**
 * Batch builder for efficient bulk operations on Markov Chains.
 * All operations are queued and applied in a single clone operation.
 *
 * @example
 * ```ts
 * const chain = new MarkovChain({ seed: 1 });
 * const updated = chain.batch()
 *   .addSequence(['a', 'b', 'c'])
 *   .addSequence(['d', 'e', 'f'])
 *   .addEdge(['a', 'b'], 'x', 'y', 2)
 *   .commit();
 * ```
 */
export class MarkovChainBatch<T extends string = string> {
  private _operations: BatchOperation[] = [];
  private _chain: MarkovChain<T>;

  constructor(chain: MarkovChain<T>) {
    this._chain = chain;
  }

  /**
   * Add a single sequence to the chain.
   * @param sequence  The sequence to be added.
   * @param insert    Determines how sequences should be inserted.
   */
  public addSequence(sequence: string[], insert: MCInsertOption = false): this {
    this._operations.push((model) => {
      // Use the static method's internal logic
      const updated = MarkovChain.addSequence(model, sequence, insert);
      // Copy the updated grams and sequences back to the model
      model.grams = updated.grams;
      if (model.sequences !== undefined && updated.sequences !== undefined) {
        model.sequences = updated.sequences;
      }
    });
    return this;
  }

  /**
   * Add multiple sequences to the chain.
   * @param sequences  The sequences to be added.
   * @param insert     Determines how sequences should be inserted.
   */
  public addSequences(sequences: string[][], insert: MCInsertOption = false): this {
    sequences.forEach(seq => this.addSequence(seq, insert));
    return this;
  }

  /**
   * Add an edge between states in the chain.
   * @param gram    The id of a gram, or the gram sequence.
   * @param lastId  The id of the previous gram in the sequence.
   * @param nextId  The id of the next gram in the sequence.
   * @param order   The order of the Gram we're adding.
   * @param weight  The weight to add to the edge (default 1).
   */
  public addEdge(
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined,
    order: number,
    weight = 1
  ): this {
    this._operations.push((model) => {
      const updated = MarkovChain.addEdge(model, gram, lastId, nextId, order, weight);
      model.grams = updated.grams;
    });
    return this;
  }

  /**
   * Commit all queued operations and return a new MarkovChain instance.
   * This performs a single clone operation for all queued changes.
   */
  public commit(): MarkovChain {
    // If no operations, just return a clone
    if (this._operations.length === 0) {
      return this._chain.clone();
    }

    // Clone the model once
    const cloned = MarkovChain.clone(this._chain.model);

    // Apply all operations to the cloned model
    for (const operation of this._operations) {
      operation(cloned);
    }

    // Create and return a new MarkovChain instance
    return new MarkovChain({
      ...cloned,
      seed: this._chain.seed,
      uses: this._chain.uses,
    });
  }

  /**
   * Get the number of pending operations.
   */
  public get pending(): number {
    return this._operations.length;
  }

  /**
   * Clear all pending operations without committing.
   */
  public clear(): this {
    this._operations = [];
    return this;
  }
}

/**
 * # Chain Blending
 *
 * Utilities for blending and interpolating multiple Markov chains.
 */

/**
 * Blending strategy for combining probability distributions
 */
export type BlendStrategy = 'arithmetic' | 'geometric' | 'harmonic' | 'max' | 'min';

/**
 * Configuration for blending a single chain
 */
export interface ChainBlendConfig<T extends string = string> {
  chain: MarkovChain<T>;
  weight: number;
}

/**
 * Options for chain blending
 */
export interface BlendOptions {
  strategy?: BlendStrategy;
  normalize?: boolean;
  minWeight?: number; // Minimum weight threshold to include a state
}

/**
 * Helper function to blend multiple distributions
 */
function blendMultipleDistributions(
  distributions: DistributionSourceDTO[],
  weights: number[],
  strategy: BlendStrategy = 'arithmetic'
): DistributionSourceDTO {
  if (distributions.length === 0) {
    return { source: {}, normal: {} };
  }

  if (distributions.length === 1) {
    return distributions[0]!;
  }

  // Collect all unique keys
  const allKeys = new Set<string>();
  for (const dist of distributions) {
    Object.keys(dist.source).forEach(key => allKeys.add(key));
  }

  const blended: { [key: string]: number } = {};

  for (const key of allKeys) {
    const values = distributions.map((d, i) => ({
      value: d.source[key] || 0,
      weight: weights[i] || 0
    }));

    switch (strategy) {
      case 'arithmetic':
        blended[key] = values.reduce((sum, { value, weight }) => sum + value * weight, 0);
        break;
      case 'geometric': {
        const nonZeroValues = values.filter(v => v.value > 0);
        if (nonZeroValues.length === values.length) {
          blended[key] = nonZeroValues.reduce((prod, { value, weight }) =>
            prod * Math.pow(value, weight), 1
          );
        } else {
          blended[key] = values.reduce((sum, { value, weight }) => sum + value * weight, 0);
        }
        break;
      }
      case 'harmonic': {
        const nonZeroValues = values.filter(v => v.value > 0);
        if (nonZeroValues.length === values.length) {
          const sum = nonZeroValues.reduce((s, { value, weight }) => s + weight / value, 0);
          blended[key] = 1 / sum;
        } else {
          blended[key] = values.reduce((sum, { value, weight }) => sum + value * weight, 0);
        }
        break;
      }
      case 'max':
        blended[key] = Math.max(...values.map(v => v.value));
        break;
      case 'min': {
        const nonZeroValues = values.filter(v => v.value > 0).map(v => v.value);
        blended[key] = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
        break;
      }
    }
  }

  return {
    source: blended,
    normal: normalizeObject(blended)
  };
}

/**
 * # Scaled States & Continuous Values
 */

/**
 * Represents a state with both a categorical value and a continuous magnitude.
 * Useful for modeling systems where states have associated numerical values.
 */
export interface ScaledState<T extends string = string> {
  category: T;
  magnitude: number;
}

/**
 * Strategy for sampling magnitudes from stored distributions
 */
export type MagnitudeSamplingStrategy = 'mean' | 'median' | 'sample' | 'weighted-sample';

/**
 * Statistics for magnitude distributions
 */
export interface MagnitudeStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Options for ScaledMarkovChain construction
 */
export interface ScaledMarkovChainOptions<T extends string = string> extends MarkovChainConstructor<T> {
  magnitudeRange?: [number, number];
  samplingStrategy?: MagnitudeSamplingStrategy;
}

/**
 * Storage for magnitude samples associated with gram-category transitions
 */
interface MagnitudeStore {
  [gramId: string]: {
    [category: string]: number[];
  };
}

/**
 * MarkovChain that tracks both categorical states and continuous magnitude values.
 * Useful for modeling systems where transitions have associated numerical values,
 * such as market movements, physics simulations, or game states with attributes.
 *
 * @example
 * ```typescript
 * const marketChain = new ScaledMarkovChain<'up' | 'down' | 'stable'>({
 *   maxOrder: 2,
 *   magnitudeRange: [-100, 100]
 * });
 *
 * marketChain.addScaledSequence([
 *   { category: 'up', magnitude: 20 },
 *   { category: 'up', magnitude: 35 },
 *   { category: 'stable', magnitude: 2 },
 *   { category: 'down', magnitude: -15 }
 * ]);
 *
 * const next = marketChain.generateScaled({ order: 1, length: 5 });
 * // Returns: [{ category: 'up', magnitude: 28 }, ...]
 * ```
 */
export class ScaledMarkovChain<T extends string = string> {
  private categoryChain: MarkovChain<T>;
  private magnitudeStore: MagnitudeStore;
  private samplingStrategy: MagnitudeSamplingStrategy;
  private magnitudeRange?: [number, number];
  private _engine: Random;
  private categorySequences: string[][];
  private chainOptions: MarkovChainOptions;

  constructor(options: ScaledMarkovChainOptions<T> = { maxOrder: 2 }) {
    this._engine = options.engine || new Random({ seed: options.seed, uses: options.uses });

    // Store chain options for rebuilding
    this.chainOptions = {
      maxOrder: options.maxOrder || 2,
      delimiter: options.delimiter || CONSTANTS.MC_GRAM_DELIMITER,
      startDelimiter: options.startDelimiter || CONSTANTS.MC_START_DELIMITER,
      endDelimiter: options.endDelimiter || CONSTANTS.MC_END_DELIMITER,
      seed: options.seed,
      uses: options.uses
    };

    this.categorySequences = [];

    this.categoryChain = new MarkovChain<T>({
      ...this.chainOptions,
      engine: this._engine,
      sequences: [],  // Start with empty sequences
      grams: options.grams
    });
    this.magnitudeStore = {};
    this.samplingStrategy = options.samplingStrategy || 'mean';
    this.magnitudeRange = options.magnitudeRange;
  }

  /**
   * Add a sequence of scaled states to the chain
   */
  public addScaledSequence(
    sequence: ScaledState<T>[]
  ): ScaledMarkovChain<T> {
    if (sequence.length === 0) return this;

    // Extract categories for the category chain
    const categories = sequence.map(s => s.category);

    // Clone category sequences and add new one
    const newCategorySequences = [...this.categorySequences, categories];

    // Clone magnitude store
    const newMagnitudeStore = this.cloneMagnitudeStore();

    // Store magnitude samples for each transition
    const maxOrder = this.chainOptions.maxOrder;

    for (let i = 0; i < sequence.length; i++) {
      const state = sequence[i]!;

      // Track magnitude for each order
      for (let order = 0; order <= Math.min(maxOrder, i); order++) {
        const gramSequence = categories.slice(Math.max(0, i - order), i);
        // Use start delimiter for empty gram (start context)
        const gramId = gramSequence.length === 0
          ? this.chainOptions.startDelimiter
          : getGramId(gramSequence, this.chainOptions.delimiter);

        // Initialize storage for this gram if needed
        if (!newMagnitudeStore[gramId]) {
          newMagnitudeStore[gramId] = {};
        }
        if (!newMagnitudeStore[gramId]![state.category]) {
          newMagnitudeStore[gramId]![state.category] = [];
        }

        // Store the magnitude sample
        newMagnitudeStore[gramId]![state.category]!.push(state.magnitude);
      }
    }

    // Create new category chain with all sequences
    // Note: Don't pass insert to constructor - it defaults to adding delimiters
    // The insert parameter in addScaledSequence is for potential future use
    const newCategoryChain = new MarkovChain<T>({
      ...this.chainOptions,
      engine: this._engine,
      sequences: newCategorySequences
    });

    // Create new instance with updated data
    const updated = new ScaledMarkovChain<T>({
      ...this.chainOptions,
      engine: this._engine,
      samplingStrategy: this.samplingStrategy,
      magnitudeRange: this.magnitudeRange
    });
    updated.categoryChain = newCategoryChain;
    updated.categorySequences = newCategorySequences;
    updated.magnitudeStore = newMagnitudeStore;
    updated.samplingStrategy = this.samplingStrategy;
    updated.magnitudeRange = this.magnitudeRange;
    updated.chainOptions = this.chainOptions;

    return updated;
  }

  /**
   * Add multiple scaled sequences
   */
  public addScaledSequences(
    sequences: ScaledState<T>[][]
  ): ScaledMarkovChain<T> {
    let result: ScaledMarkovChain<T> = this;
    for (const seq of sequences) {
      result = result.addScaledSequence(seq);
    }
    return result;
  }

  /**
   * Generate a sequence of scaled states
   */
  public generateScaled(options: MCGeneratorOptions = {}): ScaledState<T>[] {
    // First generate categories using the category chain
    const categories = this.categoryChain.generate(options);

    // Then sample magnitudes for each category
    const result: ScaledState<T>[] = [];
    const model = this.categoryChain.model;

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]!;

      // Determine the gram context for this position
      const order = options.order ?? model.maxOrder;
      const gramSequence = categories.slice(Math.max(0, i - order), i);
      const gramId = gramSequence.length === 0
        ? model.startDelimiter
        : getGramId(gramSequence, model.delimiter);

      // Sample magnitude for this category given the gram context
      const magnitude = this.sampleMagnitude(gramId, category);

      result.push({ category: category as T, magnitude });
    }

    return result;
  }

  /**
   * Pick a single next scaled state
   */
  public pickScaled(
    current?: ScaledState<T>[] | string[],
    next: boolean = true,
    mask?: string[]
  ): ScaledState<T> | undefined {
    // Extract categories if scaled states provided
    const categories = current
      ? (typeof current[0] === 'object' && 'category' in current[0]
        ? (current as ScaledState<T>[]).map(s => s.category)
        : current as string[])
      : undefined;

    // Pick next category
    const nextCategory = this.categoryChain.pick(categories, next, mask);
    if (!nextCategory) return undefined;

    // Determine gram context
    const model = this.categoryChain.model;
    const gramSequence = categories || [];
    const gramId = gramSequence.length === 0
      ? model.startDelimiter
      : getGramId(gramSequence, model.delimiter);

    // Sample magnitude
    const magnitude = this.sampleMagnitude(gramId, nextCategory);

    return { category: nextCategory as T, magnitude };
  }

  /**
   * Get magnitude statistics for a category given a gram context
   */
  public getMagnitudeStats(
    category: string,
    gramContext?: string[]
  ): MagnitudeStats | undefined {
    const model = this.categoryChain.model;
    const gramId = gramContext
      ? getGramId(gramContext, model.delimiter)
      : model.startDelimiter; // Use start context if none provided

    const magnitudes = this.magnitudeStore[gramId]?.[category];
    if (!magnitudes || magnitudes.length === 0) return undefined;

    const sorted = magnitudes.slice().sort((a, b) => a - b);
    const sum = magnitudes.reduce((s, m) => s + m, 0);
    const mean = sum / magnitudes.length;
    const variance = magnitudes.reduce((s, m) => s + Math.pow(m - mean, 2), 0) / magnitudes.length;

    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)]!,
      std: Math.sqrt(variance),
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      count: magnitudes.length
    };
  }

  /**
   * Get all magnitude samples for a category given a gram context
   */
  public getMagnitudeSamples(
    category: string,
    gramContext?: string[]
  ): number[] {
    const model = this.categoryChain.model;
    const gramId = gramContext
      ? getGramId(gramContext, model.delimiter)
      : model.startDelimiter;

    return this.magnitudeStore[gramId]?.[category]?.slice() || [];
  }

  /**
   * Clone the magnitude store
   */
  private cloneMagnitudeStore(): MagnitudeStore {
    const clone: MagnitudeStore = {};
    for (const gramId in this.magnitudeStore) {
      clone[gramId] = {};
      for (const category in this.magnitudeStore[gramId]) {
        clone[gramId]![category] = this.magnitudeStore[gramId]![category]!.slice();
      }
    }
    return clone;
  }

  /**
   * Sample a magnitude value for a category given a gram context
   */
  private sampleMagnitude(gramId: string, category: string): number {
    const magnitudes = this.magnitudeStore[gramId]?.[category];

    // If no samples, return midpoint of range or 0
    if (!magnitudes || magnitudes.length === 0) {
      if (this.magnitudeRange) {
        return (this.magnitudeRange[0] + this.magnitudeRange[1]) / 2;
      }
      return 0;
    }

    // Sample based on strategy
    switch (this.samplingStrategy) {
      case 'mean': {
        const sum = magnitudes.reduce((s, m) => s + m, 0);
        return sum / magnitudes.length;
      }
      case 'median': {
        const sorted = magnitudes.slice().sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)]!;
      }
      case 'sample': {
        // Random sample from observed values
        const idx = Math.floor(Math.random() * magnitudes.length);
        return magnitudes[idx]!;
      }
      case 'weighted-sample': {
        // Sample using RNG for reproducibility
        const idx = this._engine.integer(0, magnitudes.length - 1);
        return magnitudes[idx]!;
      }
    }
  }

  /**
   * Get the underlying category chain
   */
  public getCategoryChain(): MarkovChain<T> {
    return this.categoryChain;
  }

  /**
   * Clone this scaled chain
   */
  public clone(): ScaledMarkovChain<T> {
    const cloned = new ScaledMarkovChain<T>({
      ...this.chainOptions,
      engine: this._engine,
      samplingStrategy: this.samplingStrategy,
      magnitudeRange: this.magnitudeRange
    });
    cloned.categoryChain = this.categoryChain.clone() as MarkovChain<T>;
    cloned.categorySequences = [...this.categorySequences];
    cloned.magnitudeStore = this.cloneMagnitudeStore();
    cloned.samplingStrategy = this.samplingStrategy;
    cloned.magnitudeRange = this.magnitudeRange;
    cloned.chainOptions = { ...this.chainOptions };
    cloned._engine = this._engine;
    return cloned;
  }
}

/**
 * # Multi-Dimensional States
 */

/**
 * Function that converts a structured state object to a unique string key
 */
export type StateKeyFunction<T> = (state: T) => string;

/**
 * Options for MultiDimMarkovChain construction
 */
export interface MultiDimMarkovChainOptions<T> extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
  engine?: Random;
  stateKey: StateKeyFunction<T>;
}

/**
 * Storage for original structured states indexed by their string keys
 */
interface StateStore<T> {
  [key: string]: T;
}

/**
 * MarkovChain for multi-dimensional/structured state spaces.
 * Solves the problem of having to flatten multi-attribute states into strings.
 *
 * Instead of: `${tile}_${x}_${y}` (loses structure)
 * Use: `{ tile: 'grass', position: [0, 0], neighbors: [...] }`
 *
 * Perfect for:
 * - Tile-based procedural generation (WFC-style)
 * - States with multiple attributes
 * - Spatial/coordinate-based systems
 * - Any structured state space
 *
 * @example
 * ```typescript
 * interface TileState {
 *   tile: string;
 *   x: number;
 *   y: number;
 * }
 *
 * const chain = new MultiDimMarkovChain<TileState>({
 *   maxOrder: 2,
 *   stateKey: (s) => `${s.tile}_${s.x}_${s.y}`
 * });
 *
 * chain.addSequence([
 *   { tile: 'grass', x: 0, y: 0 },
 *   { tile: 'water', x: 0, y: 1 },
 *   { tile: 'grass', x: 0, y: 2 }
 * ]);
 *
 * const generated = chain.generate({ order: 1, length: 5 });
 * // Returns array of TileState objects with full structure
 * ```
 */
export class MultiDimMarkovChain<T> {
  private internalChain: MarkovChain<string>;
  private stateStore: StateStore<T>;
  private stateKeyFn: StateKeyFunction<T>;
  private _engine: Random;

  constructor(options: MultiDimMarkovChainOptions<T>) {
    this._engine = options.engine || new Random({ seed: options.seed, uses: options.uses });
    this.stateKeyFn = options.stateKey;
    this.stateStore = {};

    this.internalChain = new MarkovChain<string>({
      maxOrder: options.maxOrder || 2,
      delimiter: options.delimiter,
      startDelimiter: options.startDelimiter,
      endDelimiter: options.endDelimiter,
      engine: this._engine,
      sequences: []
    });
  }

  /**
   * Add a sequence of structured states
   */
  public addSequence(sequence: T[]): MultiDimMarkovChain<T> {
    if (sequence.length === 0) return this;

    // Convert structured states to string keys
    const keys = sequence.map(state => {
      const key = this.stateKeyFn(state);
      // Store the original structured state
      this.stateStore[key] = state;
      return key;
    });

    // Create new internal chain with the key sequence
    const newInternalChain = this.internalChain.addSequence(keys);

    // Create new instance with updated data
    const updated = new MultiDimMarkovChain<T>({
      maxOrder: this.internalChain.model.maxOrder,
      delimiter: this.internalChain.model.delimiter,
      startDelimiter: this.internalChain.model.startDelimiter,
      endDelimiter: this.internalChain.model.endDelimiter,
      engine: this._engine,
      stateKey: this.stateKeyFn
    });
    updated.internalChain = newInternalChain;
    updated.stateStore = { ...this.stateStore };
    updated.stateKeyFn = this.stateKeyFn;
    updated._engine = this._engine;

    return updated;
  }

  /**
   * Add multiple sequences of structured states
   */
  public addSequences(sequences: T[][]): MultiDimMarkovChain<T> {
    let result: MultiDimMarkovChain<T> = this;
    for (const seq of sequences) {
      result = result.addSequence(seq);
    }
    return result;
  }

  /**
   * Generate a sequence of structured states
   */
  public generate(options: MCGeneratorOptions = {}): T[] {
    // Generate keys using internal chain
    const keys = this.internalChain.generate(options);

    // Map keys back to structured states
    return keys.map(key => this.stateStore[key]!).filter(state => state !== undefined);
  }

  /**
   * Pick a single next structured state
   */
  public pick(
    current?: T[],
    next: boolean = true,
    mask?: T[]
  ): T | undefined {
    // Convert structured states to keys
    const currentKeys = current?.map(s => this.stateKeyFn(s));
    const maskKeys = mask?.map(s => this.stateKeyFn(s));

    // Pick next key
    const nextKey = this.internalChain.pick(currentKeys, next, maskKeys);
    if (!nextKey) return undefined;

    // Return structured state
    return this.stateStore[nextKey];
  }

  /**
   * Get statistics about the internal chain
   */
  public getStats() {
    return this.internalChain.getStats();
  }

  /**
   * Get all unique states that have been observed
   */
  public getStates(): T[] {
    return Object.values(this.stateStore);
  }

  /**
   * Check if a state exists in the chain
   */
  public hasState(state: T): boolean {
    const key = this.stateKeyFn(state);
    return this.stateStore[key] !== undefined;
  }

  /**
   * Get the internal MarkovChain (for advanced use)
   */
  public getInternalChain(): MarkovChain<string> {
    return this.internalChain;
  }

  /**
   * Clone this multi-dimensional chain
   */
  public clone(): MultiDimMarkovChain<T> {
    const cloned = new MultiDimMarkovChain<T>({
      maxOrder: this.internalChain.model.maxOrder,
      delimiter: this.internalChain.model.delimiter,
      startDelimiter: this.internalChain.model.startDelimiter,
      endDelimiter: this.internalChain.model.endDelimiter,
      engine: this._engine,
      stateKey: this.stateKeyFn
    });
    cloned.internalChain = this.internalChain.clone();
    cloned.stateStore = { ...this.stateStore };
    cloned.stateKeyFn = this.stateKeyFn;
    cloned._engine = this._engine;
    return cloned;
  }
}
