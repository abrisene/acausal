/*
 # wfc.ts
 # Wave Function Collapse Implementation
 */

/**
 * Wave Function Collapse implementation for acausal.
 *
 * This is a topology-agnostic implementation that works on abstract graphs.
 * The core algorithm handles constraint propagation and cell collapse without
 * making assumptions about spatial structure.
 *
 * Design principles:
 * - Topology-agnostic: Works on any graph structure
 * - Composable: Integrates with Distribution and MarkovChain
 * - Configurable: All options exposed for flexibility
 * - Deterministic: Same seed produces same results
 */

import {Random} from '../services';
import {Distribution} from './distribution';
import type {
  State,
  Dimension,
  CellId,
  WFCCell,
  WFCGraph,
  ConstraintRules,
  WFCOptions,
  WFCGenerateOptions,
  WFCResult,
  WFCDTO,
  WFCStats,
  EntropyMode,
  EntropyFunction,
} from './wfc-types';
import {isEntropyFunction} from './wfc-types';

/**
 * Wave Function Collapse class
 *
 * Implements the WFC algorithm for constraint-based generation on arbitrary graphs.
 */
export class WFC {
  private readonly _states: State[];
  private readonly _constraints: ConstraintRules;
  private readonly _frequencies: Distribution<State>;
  private readonly _engine: Random;
  private readonly _options: WFCOptions;

  /**
   * Create a new WFC instance
   *
   * @param options - Configuration options for WFC
   */
  constructor(options: WFCOptions) {
    // Validate required options
    this.validateOptions(options);

    // Store states
    this._states = [...options.states];

    // Store constraints (deep copy to prevent mutation)
    this._constraints = this.cloneConstraints(options.constraints);

    // Create frequency distribution
    const freqSource = options.frequencies || this.uniformFrequencies();
    this._frequencies = new Distribution({
      seed: options.seed,
      source: freqSource,
    });

    // Create random engine
    this._engine = new Random({seed: options.seed});

    // Store full options
    this._options = {...options};
  }

  /**
   * Main collapse method - runs WFC algorithm on a graph
   *
   * @param graph - The graph structure to collapse
   * @param options - Optional generation-time options
   * @returns Result object with success status and collapsed graph
   */
  public collapse(
    graph: WFCGraph,
    options?: WFCGenerateOptions
  ): WFCResult {
    const startTime = Date.now();
    let steps = 0;
    let backtracks = 0;

    try {
      // Initialize all cells with all possible states
      this.initialize(graph);

      // Propagate from any pre-collapsed cells to detect initial contradictions
      for (const cell of graph.cells.values()) {
        if (cell.collapsed) {
          const propagated = this.propagate(cell.id, graph);
          if (!propagated) {
            return {
              success: false,
              graph,
              contradiction: true,
              error: `Contradiction detected in initial state from cell ${cell.id}`,
              metadata: {
                steps: 0,
                backtracks,
                timeMs: Date.now() - startTime,
              },
            };
          }
        }
      }

      // Main WFC loop: observe → propagate until done or contradiction
      while (true) {
        // Find cell with minimum entropy
        const cell = this.findMinEntropyCell(graph, options);

        // Check if we're done
        if (cell === null) {
          const allCollapsed = this.allCellsCollapsed(graph);

          return {
            success: allCollapsed,
            graph,
            contradiction: !allCollapsed,
            error: allCollapsed ? undefined : 'Contradiction detected',
            metadata: {
              steps,
              backtracks,
              timeMs: Date.now() - startTime,
            },
          };
        }

        // Collapse the cell
        this.collapseCell(cell);
        steps++;

        // Propagate constraints
        const propagated = this.propagate(cell.id, graph);

        if (!propagated) {
          // Contradiction detected
          return {
            success: false,
            graph,
            contradiction: true,
            error: `Contradiction detected after collapsing cell ${cell.id}`,
            metadata: {
              steps,
              backtracks,
              timeMs: Date.now() - startTime,
            },
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        graph,
        contradiction: true,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          steps,
          backtracks,
          timeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Serialize WFC instance to JSON
   */
  public toJSON(): WFCDTO {
    // Convert constraints to serializable format
    const constraints: WFCDTO['constraints'] = {};

    for (const [state, dims] of Object.entries(this._constraints)) {
      constraints[state] = {};

      for (const [dim, value] of Object.entries(dims)) {
        if (Array.isArray(value)) {
          constraints[state][dim] = value;
        } else if (value instanceof Distribution) {
          // Convert Distribution to frequency object
          const freqs = value.source || value.normal;
          constraints[state][dim] = freqs;
        }
      }
    }

    return {
      seed: this._options.seed,
      states: this._states,
      constraints,
      frequencies: this._options.frequencies,
      entropyMode: isEntropyFunction(this._options.entropyMode)
        ? undefined
        : this._options.entropyMode,
      entropyNoise: this._options.entropyNoise,
      boundaries: this._options.boundaries,
      symmetry: this._options.symmetry,
      backtrack: this._options.backtrack,
    };
  }

  /**
   * Deserialize WFC instance from JSON
   */
  public static fromJSON(dto: WFCDTO): WFC {
    // Convert constraint frequency objects back to proper format
    const constraints: ConstraintRules = {};

    for (const [state, dims] of Object.entries(dto.constraints)) {
      constraints[state] = {};

      for (const [dim, value] of Object.entries(dims)) {
        if (Array.isArray(value)) {
          constraints[state][dim] = value;
        } else {
          // Frequency object - convert to Distribution
          constraints[state][dim] = new Distribution({
            seed: dto.seed,
            source: value,
          });
        }
      }
    }

    return new WFC({
      seed: dto.seed,
      states: dto.states,
      constraints,
      frequencies: dto.frequencies,
      entropyMode: dto.entropyMode,
      entropyNoise: dto.entropyNoise,
      boundaries: dto.boundaries,
      symmetry: dto.symmetry,
      backtrack: dto.backtrack,
    });
  }

  /**
   * Get statistics about this WFC model
   */
  public getStats(): WFCStats {
    const dimensions = new Set<Dimension>();
    let constraintCount = 0;
    let totalAllowed = 0;

    for (const dims of Object.values(this._constraints)) {
      for (const [dim, value] of Object.entries(dims)) {
        dimensions.add(dim);
        constraintCount++;

        if (Array.isArray(value)) {
          totalAllowed += value.length;
        } else if (value instanceof Distribution) {
          const keys = Object.keys(value.normal);
          totalAllowed += keys.length;
        }
      }
    }

    return {
      stateCount: this._states.length,
      constraintCount,
      dimensions: Array.from(dimensions),
      avgAllowedStates:
        constraintCount > 0 ? totalAllowed / constraintCount : 0,
      hasFrequencies: this._options.frequencies !== undefined,
    };
  }

  /**
   * Private Methods
   */

  /**
   * Initialize graph - set all cells to all possible states
   */
  private initialize(graph: WFCGraph): void {
    const allStates = new Set(this._states);

    for (const cell of graph.cells.values()) {
      if (!cell.collapsed) {
        cell.possibleStates = new Set(allStates);
      }
    }
  }

  /**
   * Find cell with minimum entropy
   */
  private findMinEntropyCell(
    graph: WFCGraph,
    options?: WFCGenerateOptions
  ): WFCCell | null {
    let minEntropy = Infinity;
    let minCell: WFCCell | null = null;

    const entropyMode = options?.entropyMode || this._options.entropyMode || 'count';
    const entropyNoise = this._options.entropyNoise || 0;

    for (const cell of graph.cells.values()) {
      if (cell.collapsed) continue;

      // Check for contradiction (no possible states)
      if (cell.possibleStates.size === 0) {
        return null;
      }

      // Calculate entropy
      let entropy = this.calculateEntropy(cell, entropyMode);

      // Add noise to break ties
      if (entropyNoise > 0) {
        entropy += this._engine.real(0, entropyNoise);
      }

      if (entropy < minEntropy) {
        minEntropy = entropy;
        minCell = cell;
      }
    }

    return minCell;
  }

  /**
   * Calculate entropy for a cell
   */
  private calculateEntropy(
    cell: WFCCell,
    mode: EntropyMode | EntropyFunction | undefined
  ): number {
    // Handle custom function
    if (typeof mode === 'function') {
      return mode(cell, this._frequencies);
    }

    const size = cell.possibleStates.size;

    switch (mode) {
      case 'shannon': {
        // Shannon entropy with uniform probabilities
        if (size === 0) return 0;
        if (size === 1) return 0;
        const p = 1 / size;
        return -size * (p * Math.log2(p));
      }

      case 'weighted-shannon': {
        // Shannon entropy weighted by actual frequencies
        if (size === 0) return 0;
        if (size === 1) return 0;

        let entropy = 0;
        let totalWeight = 0;
        const freqs = this._frequencies.normal;

        // Calculate total weight for normalization
        for (const state of cell.possibleStates) {
          const weight = freqs[state] || 0;
          totalWeight += weight;
        }

        if (totalWeight === 0) return 0;

        // Calculate weighted entropy
        for (const state of cell.possibleStates) {
          const weight = freqs[state] || 0;
          if (weight > 0) {
            const p = weight / totalWeight;
            entropy -= p * Math.log2(p);
          }
        }

        return entropy;
      }

      case 'count':
      default:
        // Simple count of possible states
        return size;
    }
  }

  /**
   * Collapse a cell to a single state
   */
  private collapseCell(cell: WFCCell): void {
    // Create temporary distribution from possible states
    const possibleSource: {[state: State]: number} = {};
    const freqs = this._frequencies.normal;

    for (const state of cell.possibleStates) {
      possibleSource[state] = freqs[state] || 1;
    }

    const tempDist = new Distribution({
      seed: this._engine.integer(0, 1000000),
      source: possibleSource,
    });

    // Pick weighted random state
    const picked = tempDist.pick();
    if (!picked || picked.length === 0 || !picked[0]) {
      throw new Error('Failed to pick state for cell collapse');
    }
    const chosen: State = picked[0];

    // Collapse cell
    cell.collapsedState = chosen;
    cell.possibleStates = new Set<State>([chosen]);
    cell.collapsed = true;
  }

  /**
   * Propagate constraints from a collapsed cell
   */
  private propagate(cellId: CellId, graph: WFCGraph): boolean {
    const queue: CellId[] = [cellId];
    const visited = new Set<CellId>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = graph.cells.get(currentId);
      if (!current) continue;

      const neighbors = graph.getNeighbors(currentId);

      for (const {neighbor: neighborId, dimension} of neighbors) {
        const neighbor = graph.cells.get(neighborId);
        if (!neighbor || neighbor.collapsed) continue;

        // Calculate allowed states for this neighbor
        const allowedStates = this.getAllowedStates(
          current.possibleStates,
          dimension
        );

        // Intersect with neighbor's current possible states
        const newPossibleStates = new Set(
          [...neighbor.possibleStates].filter(s => allowedStates.has(s))
        );

        // If we removed any states, need to propagate further
        if (newPossibleStates.size < neighbor.possibleStates.size) {
          if (newPossibleStates.size === 0) {
            // Contradiction!
            return false;
          }

          neighbor.possibleStates = newPossibleStates;
          queue.push(neighborId);
        }
      }
    }

    return true;
  }

  /**
   * Get all states allowed adjacent to any of the given states in a dimension
   */
  private getAllowedStates(
    states: Set<State>,
    dimension: Dimension
  ): Set<State> {
    const allowed = new Set<State>();

    for (const state of states) {
      const rules = this._constraints[state]?.[dimension];
      if (!rules) continue;

      // Rules can be array or Distribution
      const allowedForState = Array.isArray(rules)
        ? rules
        : Object.keys(rules.normal);

      for (const s of allowedForState) {
        allowed.add(s);
      }
    }

    return allowed;
  }

  /**
   * Check if all cells are collapsed
   */
  private allCellsCollapsed(graph: WFCGraph): boolean {
    for (const cell of graph.cells.values()) {
      if (!cell.collapsed) return false;
    }
    return true;
  }

  /**
   * Validation and Helper Methods
   */

  /**
   * Validate WFC options
   */
  private validateOptions(options: WFCOptions): void {
    if (!options.states || options.states.length === 0) {
      throw new Error('States array cannot be empty');
    }

    if (!options.constraints) {
      throw new Error('Constraints are required');
    }

    // Validate constraint references
    const stateSet = new Set(options.states);

    for (const [state, dims] of Object.entries(options.constraints)) {
      if (!stateSet.has(state)) {
        throw new Error(
          `Invalid state in constraints: "${state}" not in states array`
        );
      }

      for (const [dim, value] of Object.entries(dims)) {
        const states: State[] = Array.isArray(value)
          ? value
          : value instanceof Distribution
            ? Object.keys(value.normal)
            : [];

        for (const s of states) {
          if (!stateSet.has(s as State)) {
            throw new Error(
              `Invalid state "${s}" in constraint for "${state}" dimension "${dim}"`
            );
          }
        }
      }
    }

    // Validate entropy mode if string
    if (
      typeof options.entropyMode === 'string' &&
      !['count', 'shannon', 'weighted-shannon'].includes(options.entropyMode)
    ) {
      throw new Error(
        `Invalid entropy mode: "${options.entropyMode}". Must be "count", "shannon", "weighted-shannon", or a function`
      );
    }
  }

  /**
   * Create uniform frequency distribution
   */
  private uniformFrequencies(): {[state: State]: number} {
    const freqs: {[state: State]: number} = {};
    for (const state of this._states) {
      freqs[state] = 1;
    }
    return freqs;
  }

  /**
   * Deep clone constraints
   */
  private cloneConstraints(constraints: ConstraintRules): ConstraintRules {
    const cloned: ConstraintRules = {};

    for (const [state, dims] of Object.entries(constraints)) {
      cloned[state] = {};

      for (const [dim, value] of Object.entries(dims)) {
        if (Array.isArray(value)) {
          cloned[state][dim] = [...value];
        } else {
          // Keep Distribution reference (it's immutable)
          cloned[state][dim] = value;
        }
      }
    }

    return cloned;
  }
}
