/*
 # markov.js
 # Markov Chain Generator
 */

/*
 # Module Dependencies
 */

const random = require('random-js');
const { normalizeObject, pickWeight } = require('../utilities');

/*
 # Class
 */

class Markov {
  /**
   * Markov Chain
   * @param {number} seed - Random seed
   * @param {array} source - Initial source
   * @param {number} maxOrder - Max Order
   * @param {string} delimiter - State ID Gram Delimiter
   * @param {string} start - Start delimiter
   * @param {string} end - End delimiter
   * @param {function} extractor - Function to get a state's key from the raw state
   */
  constructor({
    seed, // Random seed
    source = [], // Initial source
    maxOrder, // Max Order
    delimiter = '⏐', // State ID Gram Delimiter
    start = '○', // Start delimiter
    end = '◍', // End delimiter
    extractor, // Function to get a state's key from the raw state
  }) {
    this.mt = seed ? random.engines.mt19937().seed(seed) : random.engines.mt19937().autoSeed();
    this.seed = seed;
    this.sources = [];

    this.maxOrder = maxOrder;
    this.delimiter = delimiter;
    this.start = start;
    this.end = end;

    this.states = {}; // Individual states, mapped ID => Payload
    this.ngrams = {}; // Collections of state IDs, mapped => Lookup ID
    this.edges = {}; // Collections of edges between ngrams
    this.matrix = {}; // Transition matrix - normalized edges

    this.extractor = extractor;

    if (source) {
      this.addSource(source);
    }
  }

  /**
   * Transforms a gram id from an array of state ids
   * @param {array} gram - Array of state ids
   */
  getGramId(gram) {
    return gram.join(this.delimiter);
  }

  /**
   * Adds an array of sequences to the model
   * @param {array} source - Array of sequences.
   * @param {boolean} regenerate - Determines whether transition matrix should be regenerated.
   */
  addSource(source, regenerate = true) {
    const gramIds = [];
    source.forEach((i) => {
      this.sources.push(i);
      const ids = this.addSequence(i);
      ids.forEach(id => gramIds.push(id));
    });

    return regenerate ? this.regenerateMatrix() : gramIds;
  }

  /**
   * Adds a sequence of states to the model
   * @param {array} item - Sequence
   * @param {boolean} regenerate - Determines whether transition matrix should be regenerated.
   */
  add(item, regenerate) {
    return this.addSequence(item, regenerate);
  }

  /**
 * Adds a sequence of states to the model
 * @param {array} item - Sequence
 * @param {boolean} regenerate - Determines whether transition matrix should be regenerated.
 */
  addSequence(item, regenerate) {
    const sequence = item.map((e) => {
      const state = this.addState(e);
      return state.key;
    });

    const maxOrder = this.maxOrder ? this.maxOrder : sequence.length;
    const gramIds = [];

    sequence.unshift(this.start);
    sequence.push(this.end);

    for (let order = 1; order <= maxOrder; order += 1) {
      for (let pos = 0; pos < sequence.length; pos += 1) {
        const nextPos = pos + order;
        const nextElementId = sequence[nextPos];
        const gram = sequence.slice(pos, nextPos);
        const gramId = this.getGramId(gram);

        if (!nextElementId) break;
        if (!gramIds.includes(gramId)) gramIds.push(gramId);

        this.addGram(gramId, gram, order);
        this.addEdge(gramId, nextElementId);
      }
    }

    return regenerate ? this.regenerateMatrix(gramIds) : gramIds;
  }

  /**
   * Adds a state to the model
   * @param {*} state - State to be added
   */
  addState(state) {
    const key = this.extractor ? this.extractor(state) : state;

    if (!this.states[key]) {
      this.states[key] = { state, frequency: 1 };
    } else {
      this.states[key].frequency += 1;
    }
    return { key, state };
  }

  /**
   * Adds a gram
   * @param {string} id - The id of the gram
   * @param {array} gram - The gram
   * @param {number} order - The order of the gram
   */
  addGram(id, gram, order) {
    if (!this.ngrams[id]) {
      this.ngrams[id] = {
        frequency: 1,
        gram,
        order,
        degreeOut: 0,
      };
      this.edges[id] = {};
    } else {
      this.ngrams[id].frequency += 1;
    }
    return this.ngrams[id];
  }

  /**
   * Adds an edge to the model
   * @param {string} fromId - Origin id
   * @param {string} toId - Destination id
   */
  addEdge(fromId, toId) {
    if (!this.edges[fromId][toId]) {
      this.edges[fromId][toId] = 0;
      this.ngrams[fromId].degreeOut += 1;
    }
    this.edges[fromId][toId] += 1;
    return this.edges[fromId][toId];
  }

  /**
   * Regenerates some or all of the transition matrix
   * @param {array} ids - Array of ids to regenerate
   */
  regenerateMatrix(ids) {
    const gramIds = ids || Object.keys(this.edges);

    gramIds.forEach((id) => {
      this.matrix[id] = normalizeObject(this.edges[id]);
    });

    return this.gramIds;
  }

  /**
   * Randomly picks a state from a transition matrix
   * @param {string} id - The id of the gram to generate from
   * @param {array} mask - An array of ids to exclude
   */
  pickState(id, mask = []) {
    const value = random.real(0, 1)(this.mt);
    const result = pickWeight(this.matrix[id], value, mask);
    return result;
  }

  /**
   * Generates a sequence
   * @param {string|array} start - Optional starting id(s) for the sequence
   * @param {number} min - Minimum length of the generated sequence
   * @param {number} max - Maximum length of the generated sequence
   * @param {number} order - Maximum order of the sequence
   * @param {boolean} returnIds - Returns array of ids instead of states if true
   */
  generate({
    start,
    min = 4,
    max = 10,
    order = 3,
    returnIds = false,
  }) {
    const sequence = start || [this.start];
    let currentOrder = sequence.length;
    let result;

    for (let i = 0; i < max; i += 1) {
      const mask = i < min ? [this.end] : [];
      let gramId;

      for (let o = currentOrder; o > 0; o -= 1) {
        const gram = sequence.slice(sequence.length - o, sequence.length).filter(x => x);
        gramId = this.getGramId(gram);

        if (this.matrix[gramId]) break;
      }

      const nextState = i < max - 1 ? this.pickState(gramId, mask) : this.end;
      sequence.push(nextState);

      if (nextState === this.end) break;
      if (currentOrder < order) {
        currentOrder += 1;
      } else if (currentOrder === order && order > 1) {
        currentOrder -= 1;
      }
    }

    result = sequence.filter(id => id && id !== this.start && id !== this.end);
    if (!returnIds) result = result.map(id => this.states[id].value);

    return result;
  }
}

/*
 # Module Exports
 */

module.exports = Markov;
