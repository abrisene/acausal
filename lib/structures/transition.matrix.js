/*
 # transition.matrix.js
 # Transition Matrix
 */

/*
 # Module Dependencies
 */

const random = require('random-js');
const { normalizeObject, pickWeight } = require('../utilities');

/*
 # Class
 */

class TransitionMatrix {
  /**
   * Transition Matrix
   * @param {number} seed - Random seed
   * @param {function} mt - Optional Mersienne Twister
   * @param {object} edges - Object containing edges
   * @param {number} uses - Number of uses on the MT
   */
  constructor({
    seed,
    mt,
    edges,
    uses,
  }) {
    if (mt) {
      this.mt = mt;
    } else {
      this.mt = seed ? random.engines.mt19937().seed(seed) : random.engines.mt19937().autoSeed();
      this.edges = {};
    }
    this.seed = seed;
    this.edges = {};

    if (uses) this.mt.discard(uses);
    if (edges) this.regenerate(edges);
  }

  /**
   * Regenerates some or all of the transition matrix
   * @param {array} ids - Array of ids to regenerate
   */
  regenerate(edges, ids) {
    const edgeIds = ids  || Object.keys(edges);
    edgeIds.forEach((id) => {
      this.edges[id] = normalizeObject(edges[id]);
    });
    return edgeIds;
  }

  /**
   * Randomly picks a state from a transition matrix
   * @param {string} id - The id of the gram to generate from
   * @param {array} mask - An array of ids to exclude
   */
  pick(id, mask = []) {
    const value = random.real(0, 1)(this.mt);
    const result = pickWeight(this.edges[id], value, mask);
    return result;
  }

  /**
   * Serializes matrix into an object
   * @param {boolean} edgesOnly - Returns only edges if true
   */
  serialize(edgesOnly) {
    let result;
    if (edgesOnly) {
      result = this.edges
    } else {
      result = {
        seed: this.seed,
        edges: this.edges,
        uses: this.mt.getUseCount(),
      };
    }
    return result;
  }

  /**
   * Deserializes an object into a Transition Matrix
   * @param {object} data 
   */
  static deserialize(data = {}) {
    const matrix = new TransitionMatrix({
      seed: data.seed,
      uses: data.uses,
      edges: data.edges,
    });
    // matrix.edges = data.edges;
    return matrix;
  }
}

/*
 # Module Exports
 */

module.exports = TransitionMatrix;
