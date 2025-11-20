/*
 # wfc-types.ts
 # Wave Function Collapse Type Definitions
 */

/**
 * Type definitions for Wave Function Collapse implementation.
 *
 * Design principles:
 * - Topology-agnostic: Works on any graph structure
 * - Composable: Integrates with Distribution and MarkovChain
 * - Portable: Fully serializable via DTOs
 * - Type-safe: Strong TypeScript types throughout
 */

import type {RandomDTO} from '../services';
import type {Distribution} from './distribution';

/**
 * Core Types
 */

/**
 * A state represents a possible value for a cell.
 * States are identified by strings for flexibility and serializability.
 */
export type State = string;

/**
 * A dimension represents a type of adjacency relationship.
 * Examples:
 * - 2D Grid: 'north', 'south', 'east', 'west'
 * - 3D Grid: 'north', 'south', 'east', 'west', 'up', 'down'
 * - Hex Grid: 'ne', 'e', 'se', 'sw', 'w', 'nw'
 * - Graph: 'next', 'prev', 'child', 'parent', etc.
 */
export type Dimension = string;

/**
 * Cell identifier - can be number or string for flexibility
 */
export type CellId = string | number;

/**
 * Cell Types
 */

/**
 * A cell in the WFC graph with its possible states.
 */
export interface WFCCell {
  /** Unique identifier for this cell */
  id: CellId;

  /** Set of states this cell could potentially be */
  possibleStates: Set<State>;

  /** Whether this cell has been collapsed to a single state */
  collapsed: boolean;

  /** The final state if collapsed (undefined if not collapsed) */
  collapsedState?: State;
}

/**
 * Adjacency information for a cell.
 */
export interface Adjacency {
  /** ID of the neighboring cell */
  neighbor: CellId;

  /** Which direction/relationship this neighbor represents */
  dimension: Dimension;
}

/**
 * Graph Types
 */

/**
 * Graph structure defining the topology.
 * This is the core interface that makes WFC topology-agnostic.
 */
export interface WFCGraph {
  /** Map of cell IDs to cell data */
  cells: Map<CellId, WFCCell>;

  /**
   * Function to get neighbors for a given cell.
   * This function encodes the topology - different topologies
   * implement this differently.
   */
  getNeighbors: (cellId: CellId) => Adjacency[];
}

/**
 * Constraint Types
 */

/**
 * Constraint rules define which states can be adjacent.
 * Organized by: sourceState -> dimension -> allowedStates
 *
 * Can be either an array of allowed states or a Distribution
 * for weighted selection.
 */
export interface ConstraintRules {
  [sourceState: State]: {
    [dimension: Dimension]: State[] | Distribution<State>;
  };
}

/**
 * Entropy Types
 */

/**
 * Entropy calculation modes
 */
export type EntropyMode = 'count' | 'shannon' | 'weighted-shannon';

/**
 * Custom entropy function type
 */
export type EntropyFunction = (
  cell: WFCCell,
  frequencies: Distribution<State>
) => number;

/**
 * Configuration Types
 */

/**
 * Boundary condition strategies
 */
export type BoundaryMode = 'wrap' | 'open' | 'fixed';

/**
 * Per-dimension boundary configuration
 */
export interface BoundaryConfig {
  /** Default boundary mode for unspecified dimensions */
  default?: BoundaryMode;

  /** Per-dimension boundary settings */
  perDimension?: {
    [dimension: Dimension]:
      | BoundaryMode
      | State
      | State[]; // Can specify state(s) for 'fixed' mode
  };
}

/**
 * Symmetry configuration for auto-generating constraints
 */
export interface SymmetryConfig {
  /** Rotational symmetry: true = 4-way, number = n-way */
  rotational?: boolean | number;

  /** Reflective symmetry */
  reflective?: boolean | 'horizontal' | 'vertical' | 'both';

  /** Whether to auto-generate symmetric constraints */
  autoGenerate?: boolean;
}

/**
 * Backtracking configuration
 */
export interface BacktrackConfig {
  /** Enable backtracking */
  enabled: true;

  /** Maximum backtrack depth */
  maxDepth?: number;

  /** Maximum retry attempts before failing */
  maxAttempts?: number;
}

/**
 * Core WFC configuration options
 */
export interface WFCOptions extends RandomDTO {
  /** All possible states in the system */
  states: State[];

  /** Constraint rules defining valid adjacencies */
  constraints: ConstraintRules;

  /** Frequency weights for state selection (optional) */
  frequencies?: {[state: State]: number};

  /** Entropy calculation mode */
  entropyMode?: EntropyMode | EntropyFunction;

  /** Small random noise to break entropy ties */
  entropyNoise?: number;

  /** Boundary condition strategy */
  boundaries?: BoundaryMode | BoundaryConfig;

  /** Symmetry configuration (optional) */
  symmetry?: SymmetryConfig;

  /** Backtracking configuration (optional) */
  backtrack?: boolean | BacktrackConfig;
}

/**
 * Generation-time options that can override defaults
 */
export interface WFCGenerateOptions {
  /** Override entropy mode for this generation */
  entropyMode?: EntropyMode;

  /** Dynamically adjust entropy calculation during generation */
  dynamicEntropy?: boolean;

  /** Multi-pass generation configuration */
  passes?: WFCPass[];

  /** Constraint strictness level (0 = no constraints, 1+ = increasing strictness) */
  constraintLevel?: number;

  /** Whether to dynamically adjust constraint level */
  strict?: boolean;

  /** Progressive collapse strategy */
  progressive?: {
    /** Start with high or low entropy cells */
    startEntropy?: 'high' | 'low';

    /** Switch strategy after this percentage complete */
    adaptiveThreshold?: number;
  };
}

/**
 * Configuration for a single pass in multi-pass generation
 */
export interface WFCPass {
  /** Name for this pass (for debugging) */
  name?: string;

  /** Constraint strictness level for this pass */
  constraintLevel?: number;

  /** Entropy mode for this pass */
  entropyMode?: EntropyMode;

  /** Filter function to determine which cells to process */
  filter?: (cell: WFCCell) => boolean;

  /** Stop condition for this pass */
  stopCondition?: (graph: WFCGraph) => boolean;
}

/**
 * Result Types
 */

/**
 * Result of a WFC collapse operation
 */
export interface WFCResult {
  /** Whether the collapse succeeded */
  success: boolean;

  /** The graph with collapsed cells */
  graph: WFCGraph;

  /** Whether a contradiction was detected */
  contradiction: boolean;

  /** Error message if failed */
  error?: string;

  /** Metadata about the collapse */
  metadata?: {
    /** Number of collapse steps taken */
    steps?: number;

    /** Number of backtracks (if backtracking enabled) */
    backtracks?: number;

    /** Time taken in milliseconds */
    timeMs?: number;
  };
}

/**
 * Serialization Types
 */

/**
 * Data transfer object for WFC serialization.
 * Must be JSON-serializable.
 */
export interface WFCDTO extends RandomDTO {
  /** All possible states */
  states: State[];

  /** Constraint rules (serialized) */
  constraints: {
    [sourceState: State]: {
      [dimension: Dimension]: State[] | {[state: State]: number};
    };
  };

  /** Frequency weights */
  frequencies?: {[state: State]: number};

  /** Entropy calculation mode (only string modes, not functions) */
  entropyMode?: 'count' | 'shannon' | 'weighted-shannon';

  /** Entropy noise */
  entropyNoise?: number;

  /** Boundary configuration (simplified for JSON) */
  boundaries?: BoundaryMode | BoundaryConfig;

  /** Symmetry configuration */
  symmetry?: SymmetryConfig;

  /** Backtracking configuration */
  backtrack?: boolean | BacktrackConfig;
}

/**
 * Statistics about a WFC model
 */
export interface WFCStats {
  /** Total number of states */
  stateCount: number;

  /** Total number of constraint rules */
  constraintCount: number;

  /** Dimensions used in constraints */
  dimensions: Dimension[];

  /** Average number of allowed states per constraint */
  avgAllowedStates: number;

  /** Whether the model has frequency weights */
  hasFrequencies: boolean;
}

/**
 * Type Guards
 */

/**
 * Type guard to check if backtrack config is the full object
 */
export function isBacktrackConfig(
  backtrack: boolean | BacktrackConfig | undefined
): backtrack is BacktrackConfig {
  return typeof backtrack === 'object' && backtrack !== null;
}

/**
 * Type guard to check if boundary is a config object
 */
export function isBoundaryConfig(
  boundaries: BoundaryMode | BoundaryConfig | undefined
): boundaries is BoundaryConfig {
  return (
    typeof boundaries === 'object' &&
    boundaries !== null &&
    ('default' in boundaries || 'perDimension' in boundaries)
  );
}

/**
 * Type guard to check if entropy mode is a custom function
 */
export function isEntropyFunction(
  mode: EntropyMode | EntropyFunction | undefined
): mode is EntropyFunction {
  return typeof mode === 'function';
}

/**
 * Utility Types
 */

/**
 * Helper type for constraint rule values
 */
export type ConstraintValue = State[] | Distribution<State>;

/**
 * Helper type for extracting distribution source from constraints
 */
export type DistributionSource = {[state: State]: number};
