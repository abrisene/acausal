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

  getGramId(gram) {
    return gram.join(this.delimiter);
  }

  addSource(source, regenerate = true) {
    const gramIds = [];
    source.forEach((i) => {
      this.sources.push(i);
      const ids = this.addSequence(i);
      ids.forEach(id => gramIds.push(id));
    });

    return regenerate ? this.regenerateMatrix() : gramIds;
  }

  add(item, regenerate) {
    return this.addSequence(item, regenerate);
  }

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

  addState(value) {
    const key = this.extractor ? this.extractor(value) : value;

    if (!this.states[key]) {
      this.states[key] = { value, frequency: 1 };
    } else {
      this.states[key].frequency += 1;
    }
    return { key, value };
  }

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

  addEdge(fromId, toId) {
    if (!this.edges[fromId][toId]) {
      this.edges[fromId][toId] = 0;
      this.ngrams[fromId].degreeOut += 1;
    }
    this.edges[fromId][toId] += 1;
    return this.edges[fromId][toId];
  }

  regenerateMatrix(ids) {
    const gramIds = ids || Object.keys(this.edges);

    gramIds.forEach((id) => {
      this.matrix[id] = normalizeObject(this.edges[id]);
    });

    return this.gramIds;
  }

  pickState(id, mask = []) {
    const value = random.real(0, 1)(this.mt);
    const result = pickWeight(this.matrix[id], value, mask);
    return result;
  }

  generate({
    start,
    min = 4,
    max = 20,
    order = 3,
  }) {
    const sequence = start || [this.start];
    let currentOrder = sequence.length;
    for (let i = 0; i < max; i += 1) {
      const mask = i < min ? [this.end] : [];
      let gramId;

      for (let o = currentOrder; o > 0; o -= 1) {
        const gram = sequence.slice(sequence.length - currentOrder, sequence.length).filter(x => x);
        gramId = this.getGramId(gram);

        if (this.matrix[gramId]) break;
      }

      const nextState = i < max - 1 ? this.pickState(gramId, mask) : this.end;
      sequence.push(nextState);

      if (nextState === this.end) break;
      if (currentOrder < order) {
        currentOrder += 1;
      } else if (currentOrder === order) {
        currentOrder -= 1;
      }
    }

    return sequence;
  }
}

/*
 # Module Exports
 */

module.exports = Markov;
