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
*****************/

/**
 # Module Dependencies
 */

import { Random, RandomDTO } from '../services';
import { Distribution, DistributionSourceDTO } from './distribution';
import { CONSTANTS } from '..';
// import { WeightedDistribution } from '../types';

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

/* export interface MarkovChainConstructor extends MarkovChainOptions {
  engine?: Random;
  sequences?: string[][];
  grams?: GramDictionary;
  insert?: MCInsertOption;
} */

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

  private _maxOrder: number;
  private _delimiter: string;
  private _startDelimiter: string;
  private _endDelimiter: string;

  private _sequences: string[][] | undefined;
  private _grams: { [key: string]: Gram };

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

    this._maxOrder = maxOrder;
    this._delimiter = delimiter;
    this._startDelimiter = startDelimiter;
    this._endDelimiter = endDelimiter;

    // If we have no sequences
    if (!sequences || sequences.length === 0) {
      // And we have no grams
      if (!grams || Object.keys(grams).length === 0) {
        this._grams = {};
        this._sequences = [];
      } else {
        this._grams = grams;
        this._sequences = undefined;
      }
    } else {
      // If we have sequences
      // And no grams, then add them.
      if (!grams || Object(grams).length === 0) {
        this._grams = {};
        this._sequences = [];
        this.addSequences(this._sequences, insert);
      } else {
        // Otherwise, if we have sequences and no grams, add them.
        this._grams = grams || {};
        this._sequences = sequences;
      }
    }
  }

  get maxOrder() {
    return this._maxOrder;
  }

  get delimiter() {
    return this._delimiter;
  }

  get startDelimiter() {
    return this._startDelimiter;
  }

  get endDelimiter() {
    return this._endDelimiter;
  }

  get sequences() {
    return this._sequences;
  }

  get grams() {
    return this._grams;
  }

  /**
   * Updates a Markov Chain's members from a DTO.
   * @param dto
   */
  private update(dto: MarkovChainDTO) {
    this._maxOrder = dto.maxOrder;
    this._delimiter = dto.delimiter;
    this._startDelimiter = dto.startDelimiter;
    this._endDelimiter = dto.endDelimiter;

    this._sequences = dto.sequences;
    this._grams = dto.grams;

    return this;
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
    this.update(MarkovChain.addSequences(this.serialize(), sequences, insert));
    return this;
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
    this.update(MarkovChain.addSequence(this.serialize(), sequence, insert));
    return this;
  }

  /**
   * Adds an edge from a gram to the items before and after it in the sequence.
   * @param gram    The id of a gram, or the gram sequence.
   * @param lastId  The id of the previous gram in the sequence.
   * @param nextId  The id of the next gram in the sequence.
   */
  public addEdge(gram: string | string[], lastId: string | undefined, nextId: string | undefined) {
    this.update(MarkovChain.addEdge(this.serialize(), gram, lastId, nextId));
    return this;
  }

  /**
   * Picks the next or last random value from a Markov Chain.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param next          If true values that come after the gram will be picked.
   *                      If false values that came before the gram will be picked.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public pick(gramSequence?: string[], next = true, mask?: string[]) {
    return MarkovChain.pick(this._engine, this.serialize(), gramSequence, next, mask);
  }

  /**
   * Picks the next random value from a Markov Chain given a sequence.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public next(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._engine, this.serialize(), gramSequence, true, mask);
  }

  /**
   * Picks the last random value from a Markov Chain given a sequence.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  public last(gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(this._engine, this.serialize(), gramSequence, false, mask);
  }

  public generateSequence() {}

  /**
   * Serializes a Markov Chain instance into a DTO.
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  public serialize(stripSequences = false): MarkovChainDTO {
    // Create the DTO
    const data: MarkovChainDTO = {
      maxOrder: this._maxOrder,
      delimiter: this._delimiter,
      startDelimiter: this._startDelimiter,
      endDelimiter: this._endDelimiter,
      grams: {},
    };

    // Copy Sequences
    if (this._sequences !== undefined && !stripSequences) {
      data.sequences = this._sequences.map(s => [...s]);
    }

    // Deep Clone Grams
    data.grams = Object.keys(this._grams).reduce((l, k) => {
      const gram = this._grams[k];
      const gramClone = {
        ...gram,
        last: { ...gram.last },
        next: { ...gram.next },
      };
      return { ...l, [k]: gramClone };
    }, {});

    return data;
  }

  /**
   * Ceates a clone of the Markov Chain.
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  public clone(stripSequences = false) {
    return new MarkovChain(this.serialize(stripSequences));
  }

  /**
   *
   * @param data
   * @param gramSequence
   */
  static getGramId(data: MarkovChainDTO, gramSequence: string[]) {
    return gramSequence.join(data.delimiter);
  }

  static getGram(data: MarkovChainDTO, gramSequence: string[]) {
    const id = MarkovChain.getGramId(data, gramSequence);
    return data.grams[id];
  }

  /**
   * Adds or inserts a list of Sequences into a Markov Chain DTO.
   * @param data      A Markov Chain data transfer object.
   * @param sequences  The sequences to be added.
   * @param insert    Determines how sequences should be inserted. If false, delimiters will be
   *                  prepended and appended to the sequences.
   *                  "start" or setting true will only prepend the start delimiter, while
   *                  "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  static addSequences(data: MarkovChainDTO, sequences: string[][], insert: MCInsertOption = false): MarkovChainDTO {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(data);
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
   * @param data      A Markov Chain data transfer object.
   * @param sequence  The sequence to be added.
   * @param insert    Determines how sequences should be inserted. If false, delimiters will be
   *                  prepended and appended to the sequences.
   *                  "start" or setting true will only prepend the start delimiter, while
   *                  "end" will append the end delimiter. "middle" will not add any delimiters.
   */
  static addSequence(data: MarkovChainDTO, sequence: string[], insert: MCInsertOption = false): MarkovChainDTO {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(data);
    const delimiters = getDelimiters(m);

    // Add the sequence.
    if (m.sequences !== undefined) m.sequences.push(sequence);
    addSequence(m.grams, sequence, insert, 1, m.maxOrder, delimiters);

    return m;
  }

  /**
   * Adds an edge from a gram to the items before and after it in the sequence.
   * @param data    A Markov Chain data transfer object.
   * @param gram    The id of a gram, or the gram sequence.
   * @param lastId  The id of the previous gram in the sequence.
   * @param nextId  The id of the next gram in the sequence.
   */
  static addEdge(
    data: MarkovChainDTO,
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined
  ) {
    // Clone the Markov Chain DTO.
    const m = MarkovChain.clone(data);
    const weight = 1;

    // Check to see if we need to calculate the id.
    const id = Array.isArray(gram) ? getGramId(gram, m.delimiter[0]) : gram;

    // Add the edge.
    addEdge(m.grams, id, lastId, nextId, weight);

    return m;
  }

  // static removeEdge() {}

  /**
   * Picks the next or last random value from a Markov Chain.
   * @param engine        A Random engine.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param next          If true values that come after the gram will be picked.
   *                      If false values that came before the gram will be picked.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  static pick(engine: Random, model: MarkovChainDTO, gramSequence?: string[], next = true, mask?: string[]) {
    const seq = gramSequence ? gramSequence : [model.startDelimiter];
    const gram = MarkovChain.getGram(model, seq);
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
   * Picks the next random value from a Markov Chain given a sequence.
   * @param engine        A Random engine.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  static next(engine: Random, model: MarkovChainDTO, gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(engine, model, gramSequence, true, mask);
  }

  /**
   * Picks the last random value from a Markov Chain given a sequence.
   * @param engine        A Random engine.
   * @param model         A Markov Chain data transfer object.
   * @param gramSequence  The starting Gram sequence. If this isn't supplied this defaults to the start.
   * @param mask          A mask containing keys in the chain that should be ignored.
   */
  static last(engine: Random, model: MarkovChainDTO, gramSequence?: string[], mask?: string[]) {
    return MarkovChain.pick(engine, model, gramSequence, false, mask);
  }

  static generate(
    engine: Random,
    model: MarkovChainDTO,
    start: string[] = [],
    order?: number,
    min = 4,
    max = 100,
    strict = false,
    trim = true
  ) {}

  /**
   * Creates a new Markov Chain data transfer object.
   * @param sequences An optional array of sequences to generate the grams from.
   * @param maxOrder The maximum gram size of the markov chain.
   * @param insert Determines how sequences should be inserted. If false, delimiters will be
   * prepended and appended to the sequences. "start" or setting true will only prepend the start delimiter, while
   * "end" will append the end delimiter. "middle" will not add any delimiters.
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
   * @param data Markov DTO to clone.
   * @param stripSequences If true this will strip out the sequences, removing the chain's source data.
   */
  static clone(data: MarkovChainDTO, stripSequences = false): MarkovChainDTO {
    const { sequences, grams, ...dtoData } = data;

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
