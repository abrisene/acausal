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

import { Random, RandomDTO } from '../services';
import { Distribution, DistributionSourceDTO } from './distribution';
import { CONSTANTS } from '..';

/**
 # Types
 */

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

export interface MarkovChainConstructor extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
  engine?: Random;
  sequences?: string[][];
  grams?: GramDictionary;
  insert?: MCInsertOption;
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

export interface MCGeneratorOptions {
  start?: string[];
  order?: number;
  min?: number;
  max?: number;
  direction?: MCDirectionOption;
  mask?: string[];
  strict?: boolean;
  trim?: boolean;
}

export interface MCGeneratorStaticOptions extends MCGeneratorOptions {
  model: MarkovChainDTO;
  engine?: Random;
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
function formatGramSequence(gramSequence: string[], insert: MCInsertOption, delimiters: MCDelimitersShort) {
  let result;
  switch (insert) {
    case 'start':
      result = [delimiters[0][0], ...gramSequence];
      break;
    case 'end':
      result = [...gramSequence, delimiters[2][0]];
      break;
    case 'middle':
    case true:
      result = [...gramSequence];
      break;
    case false:
    default:
      result = [delimiters[0][0], ...gramSequence, delimiters[2][0]];
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
  return [data.startDelimiter[0], data.delimiter[0], data.endDelimiter[0]];
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
      const gramId = getGramId(gramSeq, delimiters[1][0]);

      // Add the gram to the dictionary if it doesn't exist.
      // NOTE: We don't do this here anymore because addEdge does this for us.
      // if (grams[gramId] === undefined) addGram(grams, gramId, gramSeq.length);

      // Add the gram and the edges.
      addEdge(grams, gramId, lastState, nextState, weight);

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
 * @param weight  The weight to add to the edge.
 */
function addEdge(
  grams: GramDictionary,
  gramId: string,
  lastId: string | undefined,
  nextId: string | undefined,
  weight: number
  // order: number,
) {
  // Add the gram to the dictionary if it doesn't exist.
  const order = gramId.length > 1 ? Math.ceil(gramId.length / 2) : 1;
  if (grams[gramId] === undefined) addGram(grams, gramId, order);

  // Add the edges to the distributions.
  const gram = grams[gramId];

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

export class MarkovChain {
  private _engine: Random;
  private _model: MarkovChainDTO;

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
   */
  public addEdge(gram: string | string[], lastId: string | undefined, nextId: string | undefined) {
    const data = MarkovChain.addEdge(this._model, gram, lastId, nextId);
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
      if (m.sequences !== undefined) m.sequences.push(sequences[i]);
      addSequence(m.grams, sequences[i], insert, 1, m.maxOrder, delimiters);
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
   */
  static addEdge(
    model: MarkovChainDTO,
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined
  ) {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(model);
    const weight = 1;

    // Check to see if we need to calculate the id.
    const id = Array.isArray(gram) ? getGramId(gram, m.delimiter[0]) : gram;

    // Add the edge.
    addEdge(m.grams, id, lastId, nextId, weight);

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
    let result;
    if (gram !== undefined) {
      const distribution = next ? gram.next : gram.last;
      if (distribution !== undefined) {
        result = Distribution.pickOne(distribution, mask, engine);
      }
    }
    return result;
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
    const seq = gramSequence ? gramSequence : [model.startDelimiter];
    const gram = MarkovChain.getGram(model, seq);
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
    engine,
  }: MCGeneratorStaticOptions) {
    const eng = engine || new Random({});

    // SETUP
    // Set the starting sequence and the terminating character.
    const dirForward = direction === 'next';
    const picks = start || (dirForward ? [model.startDelimiter] : [model.endDelimiter]);
    const terminator = dirForward ? model.endDelimiter : model.startDelimiter;

    // Determine the order
    const maxOrder = order !== undefined ? order : start ? start.length : model.maxOrder;
    let curOrder = start !== undefined ? start.length : 1;

    // Determine the offset for our picks.
    const pickOffset = trim ? 2 : 0;
    const minPicks = min + pickOffset;
    const maxPicks = max + pickOffset;

    // Determine the temporary mask to use while sequence is less than min.
    const tempMask = mask !== undefined ? [terminator, ...mask] : [terminator];

    // Utility function for finding the current sequence given order and direction.

    // MAKE THE PICKS
    for (let i = 0; picks.length <= maxPicks; i += 1) {
      // Increase the order if we're below the desired value.
      if (curOrder < maxOrder) curOrder += 1;

      // Determine which mask we should use.
      const pickMask = picks.length < minPicks ? tempMask : mask;

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

    // FORMAT THE RESULT
    return trim ? picks.filter(v => ![model.startDelimiter, model.endDelimiter].includes(v)) : picks;
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

    const sequencesClone = sequences !== undefined && !stripSequences ? sequences.map(s => [...s]) : undefined;
    const gramsClone = Object.keys(grams).reduce((l, k) => {
      const gram = grams[k];
      const gramClone = {
        ...gram,
        last: { ...gram.last },
        next: { ...gram.next },
      };
      return { ...l, [k]: gramClone };
    }, {});

    return sequencesClone !== undefined
      ? ({
          ...dtoData,
          sequences: sequencesClone,
          grams: gramsClone,
        } as MarkovChainDTO)
      : ({ ...dtoData, grams: gramsClone } as MarkovChainDTO);
  }
}
