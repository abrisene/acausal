/*
 # markov.ts
 # Markov Class
 */

/**
 # Module Dependencies
 */

import { Random, RandomDTO } from '../services';
import { Distribution, DistributionSourceDTO } from './distribution';
// import { MC_START_DELIMITER, MC_END_DELIMITER } from '../constants';
import { CONSTANTS } from '..';
// import { WeightedDistribution } from '../types';

/**
 # Types
 */

type MarkovChainDirection = 'next' | 'last';

export interface MarkovChainOptions extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
}

export interface MarkovChainSequenceDTO extends MarkovChainOptions {
  sequences: string[][];
  grams: { [key: string]: Gram };
}

export interface MarkovChainGramDTO extends MarkovChainOptions {
  sequences?: string[][];
  grams: { [key: string]: Gram };
}

export type MarkovChainDTO = MarkovChainSequenceDTO | MarkovChainGramDTO;

export interface MarkovChainConstructor extends MarkovChainOptions, RandomDTO {
  engine?: Random;
  sequences?: string[][];
  grams?: { [key: string]: Gram };
}

/* export interface MarkovChainSequenceConstructor extends MarkovChainOptions {
  engine?: Random;
  sequences: string[][];
  // distributions: DistributionSourceDTO;
} */

/* export interface MarkovChainGramConstructor extends MarkovChainOptions {
  engine?: Random;
  grams: { [key: string]: Gram };
}

export interface MarkovChainConstructor extends MarkovChainOptions {
  engine?: Random;
  sequences?: string[][];
  grams?: { [key: string]: Gram };
} */

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

const defaultDTO: MarkovChainSequenceDTO = {
  ...defaultOptions,
  sequences: [],
  grams: {},
};

/**
 # Class
 */

export class MarkovChain {
  private _engine: Random;

  private _maxOrder: number;
  private _delimiter: string;
  private _startDelimiter: string;
  private _endDelimiter: string;

  private _sequences: string[][];
  private _grams: { [key: string]: Gram };

  constructor({
    engine,
    seed,
    uses,

    maxOrder = 4,
    delimiter = '⏐',
    startDelimiter = '○',
    endDelimiter = '◍',

    sequences = defaultDTO.sequences,
    grams = defaultDTO.grams,
  }: MarkovChainConstructor) {
    this._engine = engine || new Random({ seed, uses });

    this._maxOrder = maxOrder;
    this._delimiter = delimiter;
    this._startDelimiter = startDelimiter;
    this._endDelimiter = endDelimiter;

    this._sequences = sequences || [];
    this._grams = grams || {};
  }

  /**
   * Regenerates the normalized distribution map.
   * Called any time that the underlying distribution changes.
   */
  private regenerate() {
    // this._distributionNormal = normalizeObject(this._distribution);
    return this;
  }

  static getGramId(data: MarkovChainDTO, gramSequence: string[]) {
    return gramSequence.join(data.delimiter);
  }

  static getGram(data: MarkovChainDTO, gramSequence: string[]) {
    const id = MarkovChain.getGramId(data, gramSequence);
    return data.grams[id];
  }

  static addSequences(
    data: MarkovChainSequenceDTO,
    sequences: string[][],
    copy = true
  ): MarkovChainSequenceDTO {
    // Configs
    let m = copy ? (MarkovChain.clone(data) as MarkovChainSequenceDTO) : data;

    // Add the sequences.
    for (let i = 0; i < sequences.length; i += 1) {
      m = MarkovChain.addSequence(m, sequences[i], false);
    }

    return m;
  }

  static addSequence(
    data: MarkovChainSequenceDTO,
    sequence: string[],
    copy = true
  ): MarkovChainSequenceDTO {
    // Configs
    let m = copy ? (MarkovChain.clone(data) as MarkovChainSequenceDTO) : data;

    // Delimiters
    const maxOrder = m.maxOrder || defaultOptions.maxOrder;
    const startDelimiter = m.startDelimiter || defaultOptions.startDelimiter;
    const endDelimiter = m.endDelimiter || defaultOptions.endDelimiter;

    // If we wanted to store the raw sequences, we'd do it here.
    if (m.sequences !== undefined) m.sequences.push(sequence);

    // Add delimiters so we can properly generate the grams.
    const seq = [startDelimiter, ...sequence, endDelimiter];

    // Iterate through each order.
    for (let order = 1; order <= maxOrder; order += 1) {
      // Iterate through each position in the array.
      for (let pos = 0; pos < seq.length; pos += 1) {
        const nextPos = pos + order;
        const lastPos = pos - 1;

        // if (nextPos > seq.length - 1) break;

        // Find the previous and next states.
        const lastState = lastPos >= 0 ? seq[lastPos] : undefined;
        const nextState = nextPos < seq.length ? seq[nextPos] : undefined;

        // Get the gram sequence and id.
        const gramSeq = seq.slice(pos, nextPos);
        const gramId = MarkovChain.getGramId(m, gramSeq);

        // Add the gram and edge.
        m = MarkovChain.addEdge(m, gramId, lastState, nextState, order, false);

        // Break if we've hit the end delimiter.
        // if (nextState === data.endDelimiter) break;
        if (nextState === undefined) break;
      }
    }

    return m;
  }

  static addEdge(
    data: MarkovChainSequenceDTO,
    id: string,
    last: string | undefined,
    next: string | undefined,
    order: number,
    copy = true
  ): MarkovChainSequenceDTO {
    // Configs
    const m = copy ? (MarkovChain.clone(data) as MarkovChainSequenceDTO) : data;
    const { grams } = m;

    // Add the gram if it doesn't exist.
    if (grams[id] === undefined) {
      grams[id] = {
        id,
        order,
        last: Distribution.new(),
        next: Distribution.new(),
        degreeIn: 0,
        degreeOut: 0,
        frequency: 0,
      };
    }

    // Add the edges to the distributions.
    const gram = grams[id];

    // TODO: FIX
    if (last !== undefined) {
      gram.last = Distribution.addSourceValue(gram.last, last, 1);
      gram.degreeIn += 1;
      gram.frequency += 1;
    }

    if (next !== undefined) {
      gram.next = Distribution.addSourceValue(gram.next, next, 1);
      gram.degreeOut += 1;
      gram.frequency += 1;
    }

    return m;
  }

  static pick(
    engine: Random,
    model: MarkovChainDTO,
    gramSequence: string[],
    next = true,
    mask?: string[]
  ) {
    const gram = MarkovChain.getGram(model, gramSequence);
    let result;
    if (gram !== undefined) {
      const distribution = next ? gram.next : gram.last;
      if (distribution !== undefined) {
        result = Distribution.pickOne(gram.next, mask, engine);
      }
    }
    return result;
  }

  static next(
    engine: Random,
    model: MarkovChainDTO,
    gramSequence: string[],
    mask?: string[]
  ) {
    return MarkovChain.pick(engine, model, gramSequence, true, mask);
  }

  static last(
    engine: Random,
    model: MarkovChainDTO,
    gramSequence: string[],
    mask?: string[]
  ) {
    return MarkovChain.pick(engine, model, gramSequence, false, mask);
  }

  static generate(
    engine: Random,
    model: MarkovChainDTO,
    start = [],
    order?: number,
    min = 4,
    max = 100,
    strict = false
  ) {
    const startDelimiter =
      model.startDelimiter || defaultOptions.startDelimiter;
    const endDelimiter = model.endDelimiter || defaultOptions.endDelimiter;
    const sequence = [startDelimiter, ...start];
    const defaultOrder = order || sequence.length;
    let currentOrder = defaultOrder;
    let nextState: string | undefined;

    for (let i = 0; i < max; i += 1) {
      // Set the mask if applicable.
      const mask: string[] = [];
      if (i < max - 1) {
        let gram = undefined as Gram | undefined;
        if (i < min) mask.push(endDelimiter);

        // Find a gram of the highest possible order.
        for (let o = currentOrder; o > 0; o -= 1) {
          const gramSeq = sequence.slice(sequence.length - o, sequence.length);
          gram = this.getGram(model, gramSeq);

          // If we have a Gram and we're over our min, or we're not guaranteed to end, then break.
          if (
            gram !== undefined &&
            (i > min || gram.next.normal[endDelimiter] < 1)
          )
            break;
        }

        // Add our next state to the sequence.
        if (gram !== undefined)
          nextState = Distribution.pickOne(gram.next, mask, engine);
        if (nextState !== undefined) sequence.push(nextState);

        // Break if our next state is the end delimiter.
        if (nextState === endDelimiter) break;

        // Adjust the order if dynamic.
        if (currentOrder < defaultOrder) {
          currentOrder += 1;
        } else if (
          currentOrder === defaultOrder &&
          defaultOrder > 1 &&
          !strict
        ) {
          currentOrder -= 1;
        }
      } else {
        // Set the final state to end delimiter and break.
        nextState = endDelimiter;
        sequence.push(nextState);
        break;
      }
    }

    return sequence;
  }

  /**
   * Initializes a new Markov Chain Sequence DTO.
   * @param sequences An optional source of values to generate the distribution from.
   */
  static new(sequences?: string[][]): MarkovChainSequenceDTO {
    return sequences
      ? MarkovChain.addSequences(defaultDTO, sequences)
      : defaultDTO;
  }

  /**
   * Create a deep copy of a Markov Chain DTO.
   * @param data Markov DTO to clone.
   */
  static clone(data: MarkovChainDTO, stripSequences = false): MarkovChainDTO {
    const { sequences, grams, ...dtoData } = data;

    const sequencesClone =
      sequences !== undefined && !stripSequences
        ? sequences.map(s => [...s])
        : undefined;
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
        } as MarkovChainSequenceDTO)
      : ({ ...dtoData, grams: gramsClone } as MarkovChainGramDTO);
  }
}
