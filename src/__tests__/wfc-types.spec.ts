/**
 * WFC Types Test Suite
 *
 * These tests validate the type system for Wave Function Collapse.
 * They ensure type inference, type guards, and type constraints work correctly.
 */

import type {
  State,
  Dimension,
  CellId,
  WFCCell,
  Adjacency,
  WFCGraph,
  ConstraintRules,
  WFCOptions,
  WFCGenerateOptions,
  WFCResult,
  WFCDTO,
  WFCStats,
  BoundaryConfig,
  SymmetryConfig,
  BacktrackConfig,
} from '../structures/wfc-types';

import {
  isBacktrackConfig,
  isBoundaryConfig,
  isEntropyFunction,
} from '../structures/wfc-types';

describe('WFC Types', () => {
  describe('Basic Type Assignments', () => {
    it('should allow valid State assignments', () => {
      const state1: State = 'grass';
      const state2: State = 'water';

      expect(typeof state1).toBe('string');
      expect(typeof state2).toBe('string');
    });

    it('should allow valid Dimension assignments', () => {
      const dim1: Dimension = 'north';
      const dim2: Dimension = 'next';
      const dim3: Dimension = 'custom-dimension';

      expect(typeof dim1).toBe('string');
      expect(typeof dim2).toBe('string');
      expect(typeof dim3).toBe('string');
    });

    it('should allow valid CellId assignments', () => {
      const id1: CellId = 42;
      const id2: CellId = 'cell-123';

      expect(typeof id1).toBe('number');
      expect(typeof id2).toBe('string');
    });
  });

  describe('WFCCell Structure', () => {
    it('should create valid uncollapsed cell', () => {
      const cell: WFCCell = {
        id: 0,
        possibleStates: new Set(['A', 'B', 'C']),
        collapsed: false,
      };

      expect(cell.id).toBe(0);
      expect(cell.possibleStates.size).toBe(3);
      expect(cell.collapsed).toBe(false);
      expect(cell.collapsedState).toBeUndefined();
    });

    it('should create valid collapsed cell', () => {
      const cell: WFCCell = {
        id: 'cell-1',
        possibleStates: new Set(['A']),
        collapsed: true,
        collapsedState: 'A',
      };

      expect(cell.id).toBe('cell-1');
      expect(cell.possibleStates.size).toBe(1);
      expect(cell.collapsed).toBe(true);
      expect(cell.collapsedState).toBe('A');
    });
  });

  describe('Adjacency Structure', () => {
    it('should create valid adjacency', () => {
      const adj: Adjacency = {
        neighbor: 5,
        dimension: 'north',
      };

      expect(adj.neighbor).toBe(5);
      expect(adj.dimension).toBe('north');
    });

    it('should create adjacency with string cell ID', () => {
      const adj: Adjacency = {
        neighbor: 'neighbor-cell',
        dimension: 'east',
      };

      expect(adj.neighbor).toBe('neighbor-cell');
      expect(adj.dimension).toBe('east');
    });
  });

  describe('WFCGraph Structure', () => {
    it('should create valid graph', () => {
      const cells = new Map<CellId, WFCCell>([
        [0, {id: 0, possibleStates: new Set(['A']), collapsed: false}],
        [1, {id: 1, possibleStates: new Set(['B']), collapsed: false}],
      ]);

      const getNeighbors = (id: CellId): Adjacency[] => {
        if (id === 0) return [{neighbor: 1, dimension: 'next'}];
        return [];
      };

      const graph: WFCGraph = {cells, getNeighbors};

      expect(graph.cells.size).toBe(2);
      expect(graph.getNeighbors(0)).toHaveLength(1);
      expect(graph.getNeighbors(1)).toHaveLength(0);
    });
  });

  describe('ConstraintRules Structure', () => {
    it('should create constraints with state arrays', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['B', 'C'],
          south: ['A'],
        },
        B: {
          north: ['A', 'C'],
          south: ['B', 'C'],
        },
      };

      expect(Object.keys(constraints)).toEqual(['A', 'B']);
      expect(constraints.A.north).toContain('B');
      expect(constraints.A.north).toContain('C');
    });

    it('should accept empty constraint dimensions', () => {
      const constraints: ConstraintRules = {
        A: {},
      };

      expect(Object.keys(constraints.A)).toHaveLength(0);
    });
  });

  describe('WFCOptions Structure', () => {
    it('should create minimal valid options', () => {
      const options: WFCOptions = {
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: {next: ['B']},
          B: {next: ['A']},
        },
      };

      expect(options.seed).toBe(42);
      expect(options.states).toHaveLength(2);
      expect(options.constraints.A.next).toContain('B');
    });

    it('should create full options with all properties', () => {
      const options: WFCOptions = {
        seed: 42,
        states: ['grass', 'water', 'mountain'],
        constraints: {
          grass: {north: ['grass', 'water']},
          water: {north: ['water']},
          mountain: {north: ['mountain', 'grass']},
        },
        frequencies: {
          grass: 70,
          water: 20,
          mountain: 10,
        },
        entropyMode: 'weighted-shannon',
        entropyNoise: 0.001,
        boundaries: 'wrap',
      };

      expect(options.frequencies).toBeDefined();
      expect(options.frequencies!.grass).toBe(70);
      expect(options.entropyMode).toBe('weighted-shannon');
      expect(options.entropyNoise).toBe(0.001);
      expect(options.boundaries).toBe('wrap');
    });
  });

  describe('BoundaryConfig Structure', () => {
    it('should create simple boundary config', () => {
      const config: BoundaryConfig = {
        default: 'wrap',
      };

      expect(config.default).toBe('wrap');
    });

    it('should create per-dimension boundary config', () => {
      const config: BoundaryConfig = {
        default: 'open',
        perDimension: {
          north: 'water',
          south: 'water',
          east: 'wrap',
          west: 'wrap',
        },
      };

      expect(config.default).toBe('open');
      expect(config.perDimension!.north).toBe('water');
      expect(config.perDimension!.east).toBe('wrap');
    });

    it('should allow array of states for fixed boundaries', () => {
      const config: BoundaryConfig = {
        perDimension: {
          north: ['water', 'ice'],
        },
      };

      expect(Array.isArray(config.perDimension!.north)).toBe(true);
    });
  });

  describe('WFCResult Structure', () => {
    it('should create successful result', () => {
      const graph: WFCGraph = {
        cells: new Map([
          [0, {id: 0, possibleStates: new Set(['A']), collapsed: true, collapsedState: 'A'}],
        ]),
        getNeighbors: () => [],
      };

      const result: WFCResult = {
        success: true,
        graph,
        contradiction: false,
      };

      expect(result.success).toBe(true);
      expect(result.contradiction).toBe(false);
      expect(result.graph.cells.size).toBe(1);
    });

    it('should create failed result with error', () => {
      const graph: WFCGraph = {
        cells: new Map(),
        getNeighbors: () => [],
      };

      const result: WFCResult = {
        success: false,
        graph,
        contradiction: true,
        error: 'No valid states for cell 5',
      };

      expect(result.success).toBe(false);
      expect(result.contradiction).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should include metadata', () => {
      const graph: WFCGraph = {
        cells: new Map(),
        getNeighbors: () => [],
      };

      const result: WFCResult = {
        success: true,
        graph,
        contradiction: false,
        metadata: {
          steps: 42,
          backtracks: 3,
          timeMs: 125.5,
        },
      };

      expect(result.metadata?.steps).toBe(42);
      expect(result.metadata?.backtracks).toBe(3);
      expect(result.metadata?.timeMs).toBe(125.5);
    });
  });

  describe('WFCDTO Structure', () => {
    it('should create serializable DTO', () => {
      const dto: WFCDTO = {
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: {next: ['B', 'C']},
          B: {next: ['A']},
          C: {next: ['A', 'B']},
        },
      };

      // Should be JSON-serializable
      const json = JSON.stringify(dto);
      const parsed = JSON.parse(json);

      expect(parsed.seed).toBe(42);
      expect(parsed.states).toEqual(['A', 'B', 'C']);
    });

    it('should handle frequency distribution as object', () => {
      const dto: WFCDTO = {
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: {
            next: {A: 0.7, B: 0.3}, // Frequency object instead of array
          },
        },
      };

      const json = JSON.stringify(dto);
      const parsed = JSON.parse(json);

      expect(parsed.constraints.A.next).toEqual({A: 0.7, B: 0.3});
    });
  });

  describe('Type Guards', () => {
    describe('isBacktrackConfig', () => {
      it('should identify boolean as not config', () => {
        expect(isBacktrackConfig(true)).toBe(false);
        expect(isBacktrackConfig(false)).toBe(false);
      });

      it('should identify undefined as not config', () => {
        expect(isBacktrackConfig(undefined)).toBe(false);
      });

      it('should identify valid config object', () => {
        const config: BacktrackConfig = {
          enabled: true,
          maxDepth: 10,
          maxAttempts: 5,
        };

        expect(isBacktrackConfig(config)).toBe(true);
      });
    });

    describe('isBoundaryConfig', () => {
      it('should identify string mode as not config', () => {
        expect(isBoundaryConfig('wrap')).toBe(false);
        expect(isBoundaryConfig('open')).toBe(false);
      });

      it('should identify undefined as not config', () => {
        expect(isBoundaryConfig(undefined)).toBe(false);
      });

      it('should identify valid config object', () => {
        const config: BoundaryConfig = {
          default: 'wrap',
          perDimension: {north: 'fixed'},
        };

        expect(isBoundaryConfig(config)).toBe(true);
      });

      it('should identify config with only default', () => {
        const config: BoundaryConfig = {
          default: 'open',
        };

        expect(isBoundaryConfig(config)).toBe(true);
      });

      it('should identify config with only perDimension', () => {
        const config: BoundaryConfig = {
          perDimension: {north: 'water'},
        };

        expect(isBoundaryConfig(config)).toBe(true);
      });
    });

    describe('isEntropyFunction', () => {
      it('should identify string mode as not function', () => {
        expect(isEntropyFunction('count')).toBe(false);
        expect(isEntropyFunction('shannon')).toBe(false);
        expect(isEntropyFunction('weighted-shannon')).toBe(false);
      });

      it('should identify undefined as not function', () => {
        expect(isEntropyFunction(undefined)).toBe(false);
      });

      it('should identify function', () => {
        const fn = () => 5;
        expect(isEntropyFunction(fn)).toBe(true);
      });
    });
  });

  describe('Type Inference', () => {
    it('should infer cell ID from graph', () => {
      const graph: WFCGraph = {
        cells: new Map([[42, {id: 42, possibleStates: new Set(), collapsed: false}]]),
        getNeighbors: () => [],
      };

      const cell = graph.cells.get(42);
      expect(cell?.id).toBe(42);
    });

    it('should infer adjacencies from getNeighbors', () => {
      const graph: WFCGraph = {
        cells: new Map(),
        getNeighbors: (id: CellId): Adjacency[] => {
          return [{neighbor: 'next-cell', dimension: 'next'}];
        },
      };

      const neighbors = graph.getNeighbors(0);
      expect(neighbors[0].neighbor).toBe('next-cell');
      expect(neighbors[0].dimension).toBe('next');
    });
  });

  describe('Type Constraints', () => {
    it('should enforce required WFCOptions properties', () => {
      // This should compile - has all required properties
      const valid: WFCOptions = {
        seed: 1,
        states: ['A'],
        constraints: {},
      };

      expect(valid).toBeDefined();

      // These should NOT compile (commented out to prevent TypeScript errors):
      // const missing1: WFCOptions = { seed: 1, states: ['A'] }; // Missing constraints
      // const missing2: WFCOptions = { seed: 1, constraints: {} }; // Missing states
      // const missing3: WFCOptions = { states: ['A'], constraints: {} }; // Missing seed
    });

    it('should allow optional properties', () => {
      const minimal: WFCOptions = {
        seed: 1,
        states: ['A'],
        constraints: {},
      };

      expect(minimal.frequencies).toBeUndefined();
      expect(minimal.entropyMode).toBeUndefined();
      expect(minimal.boundaries).toBeUndefined();

      const full: WFCOptions = {
        ...minimal,
        frequencies: {A: 1},
        entropyMode: 'count',
        boundaries: 'wrap',
      };

      expect(full.frequencies).toBeDefined();
      expect(full.entropyMode).toBe('count');
    });
  });
});
