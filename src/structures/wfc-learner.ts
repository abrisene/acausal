/*
 # wfc-learner.ts
 # Wave Function Collapse Constraint Learning
 */

/**
 * Constraint learner for Wave Function Collapse.
 *
 * This module learns constraint rules from example grids,
 * enabling procedural generation that matches the style of input examples.
 *
 * Design principles:
 * - Learn from one or multiple examples
 * - Count adjacencies to build constraint rules
 * - Support weighted constraints (frequency-based)
 * - 2D grid focused (but extensible)
 */

import {Distribution} from './distribution';
import type {State, ConstraintRules} from './wfc-types';

/**
 * Constraint learner for WFC
 *
 * Analyzes example grids to extract constraint rules automatically.
 */
export class WFCConstraintLearner {
  /**
   * Learn constraints from 2D grid examples (unweighted)
   *
   * Analyzes adjacencies in all four cardinal directions and
   * builds constraint rules that allow any state pair seen in examples.
   *
   * @param examples - Array of 2D grids to learn from
   * @returns Constraint rules derived from examples
   */
  public static learn2DConstraints(examples: State[][][]): ConstraintRules {
    if (!examples || examples.length === 0) {
      throw new Error('At least one example is required');
    }

    // Track which states can be adjacent in each direction
    const adjacencies: {
      [state: State]: {
        north: Set<State>;
        south: Set<State>;
        east: Set<State>;
        west: Set<State>;
      };
    } = {};

    // Helper to ensure state exists in adjacency map
    const ensureState = (state: State) => {
      if (!adjacencies[state]) {
        adjacencies[state] = {
          north: new Set(),
          south: new Set(),
          east: new Set(),
          west: new Set(),
        };
      }
    };

    // Process each example
    for (const example of examples) {
      const height = example.length;
      if (height === 0) continue;

      for (let y = 0; y < height; y++) {
        const row = example[y];
        const width = row.length;

        for (let x = 0; x < width; x++) {
          const state = row[x];
          ensureState(state);

          // North neighbor
          if (y > 0) {
            const northState = example[y - 1][x];
            adjacencies[state].north.add(northState);
          }

          // South neighbor
          if (y < height - 1) {
            const southState = example[y + 1][x];
            adjacencies[state].south.add(southState);
          }

          // East neighbor
          if (x < width - 1) {
            const eastState = row[x + 1];
            adjacencies[state].east.add(eastState);
          }

          // West neighbor
          if (x > 0) {
            const westState = row[x - 1];
            adjacencies[state].west.add(westState);
          }
        }
      }
    }

    // Convert sets to arrays for constraint rules
    const constraints: ConstraintRules = {};

    for (const [state, dirs] of Object.entries(adjacencies)) {
      constraints[state] = {
        north: Array.from(dirs.north),
        south: Array.from(dirs.south),
        east: Array.from(dirs.east),
        west: Array.from(dirs.west),
      };
    }

    return constraints;
  }

  /**
   * Learn weighted constraints from 2D grid examples
   *
   * Like learn2DConstraints but tracks frequency of each adjacency
   * to create Distribution objects for weighted constraint rules.
   *
   * @param examples - Array of 2D grids to learn from
   * @param seed - Random seed for distributions (optional)
   * @returns Constraint rules with frequency distributions
   */
  public static learnWeightedConstraints(
    examples: State[][][],
    seed?: number
  ): ConstraintRules {
    if (!examples || examples.length === 0) {
      throw new Error('At least one example is required');
    }

    // Track adjacency frequencies
    const frequencies: {
      [state: State]: {
        north: Map<State, number>;
        south: Map<State, number>;
        east: Map<State, number>;
        west: Map<State, number>;
      };
    } = {};

    // Helper to ensure state exists in frequency map
    const ensureState = (state: State) => {
      if (!frequencies[state]) {
        frequencies[state] = {
          north: new Map(),
          south: new Map(),
          east: new Map(),
          west: new Map(),
        };
      }
    };

    // Helper to increment frequency
    const incrementFreq = (
      map: Map<State, number>,
      state: State,
      amount: number = 1
    ) => {
      map.set(state, (map.get(state) || 0) + amount);
    };

    // Process each example
    for (const example of examples) {
      const height = example.length;
      if (height === 0) continue;

      for (let y = 0; y < height; y++) {
        const row = example[y];
        const width = row.length;

        for (let x = 0; x < width; x++) {
          const state = row[x];
          ensureState(state);

          // North neighbor
          if (y > 0) {
            const northState = example[y - 1][x];
            incrementFreq(frequencies[state].north, northState);
          }

          // South neighbor
          if (y < height - 1) {
            const southState = example[y + 1][x];
            incrementFreq(frequencies[state].south, southState);
          }

          // East neighbor
          if (x < width - 1) {
            const eastState = row[x + 1];
            incrementFreq(frequencies[state].east, eastState);
          }

          // West neighbor
          if (x > 0) {
            const westState = row[x - 1];
            incrementFreq(frequencies[state].west, westState);
          }
        }
      }
    }

    // Convert frequency maps to Distribution objects
    const constraints: ConstraintRules = {};

    for (const [state, dirs] of Object.entries(frequencies)) {
      const mapToObj = (map: Map<State, number>) => {
        const obj: {[state: State]: number} = {};
        for (const [s, count] of map) {
          obj[s] = count;
        }
        return obj;
      };

      constraints[state] = {
        north: new Distribution({
          seed: seed || 42,
          source: mapToObj(dirs.north),
        }),
        south: new Distribution({
          seed: seed || 42,
          source: mapToObj(dirs.south),
        }),
        east: new Distribution({
          seed: seed || 42,
          source: mapToObj(dirs.east),
        }),
        west: new Distribution({
          seed: seed || 42,
          source: mapToObj(dirs.west),
        }),
      };
    }

    return constraints;
  }

  /**
   * Extract all unique states from examples
   *
   * @param examples - Array of 2D grids
   * @returns Array of unique states found
   */
  public static extractStates(examples: State[][][]): State[] {
    const stateSet = new Set<State>();

    for (const example of examples) {
      for (const row of example) {
        for (const state of row) {
          stateSet.add(state);
        }
      }
    }

    return Array.from(stateSet);
  }

  /**
   * Calculate frequency distribution of states in examples
   *
   * @param examples - Array of 2D grids
   * @returns Frequency map of states
   */
  public static calculateFrequencies(
    examples: State[][][]
  ): {[state: State]: number} {
    const frequencies: {[state: State]: number} = {};

    for (const example of examples) {
      for (const row of example) {
        for (const state of row) {
          frequencies[state] = (frequencies[state] || 0) + 1;
        }
      }
    }

    return frequencies;
  }
}
