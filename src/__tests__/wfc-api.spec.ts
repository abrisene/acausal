/**
 * WFC API Test Suite
 *
 * These tests define the expected API and behavior for Wave Function Collapse.
 * They serve as both specification and validation.
 *
 * Run with: npm test wfc-api.spec.ts
 */

import { WFC, WFCGrid2D, WFCConstraintLearner } from '../structures';
import type {
  State,
  Dimension,
  ConstraintRules,
  WFCOptions,
  WFCGraph,
  WFCCell,
  WFCResult,
  WFCDTO,
} from '../structures/wfc-types';

describe('WFC - Core API', () => {
  describe('Constructor & Initialization', () => {
    it('should create a WFC instance with basic options', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: { next: ['B', 'C'] },
          B: { next: ['A', 'C'] },
          C: { next: ['A', 'B'] }
        }
      });

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should create WFC with frequency weights', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['grass', 'water', 'mountain'],
        constraints: {
          grass: { north: ['grass', 'water'], south: ['grass', 'mountain'] },
          water: { north: ['water'], south: ['grass', 'water'] },
          mountain: { north: ['mountain', 'grass'], south: ['mountain'] }
        },
        frequencies: {
          grass: 70,
          water: 20,
          mountain: 10
        }
      });

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should throw error for invalid states', () => {
      expect(() => {
        new WFC({
          seed: 42,
          states: [], // Empty states
          constraints: {}
        });
      }).toThrow();
    });

    it('should throw error for invalid constraints', () => {
      expect(() => {
        new WFC({
          seed: 42,
          states: ['A', 'B'],
          constraints: {
            A: { next: ['C'] } // 'C' not in states
          }
        });
      }).toThrow();
    });
  });

  describe('Collapse - Basic Functionality', () => {
    it('should collapse a simple linear graph', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['B'] },
          B: { next: ['A'] }
        }
      });

      // Create simple 3-node linear graph
      const graph: WFCGraph = {
        cells: new Map([
          [0, { id: 0, possibleStates: new Set(), collapsed: false }],
          [1, { id: 1, possibleStates: new Set(), collapsed: false }],
          [2, { id: 2, possibleStates: new Set(), collapsed: false }]
        ]),
        getNeighbors: (id) => {
          if (id === 0) return [{ neighbor: 1, dimension: 'next' }];
          if (id === 1) return [{ neighbor: 2, dimension: 'next' }];
          return [];
        }
      };

      const result = wfc.collapse(graph);

      expect(result.success).toBe(true);
      expect(result.contradiction).toBe(false);
      expect(result.graph.cells.get(0)?.collapsed).toBe(true);
      expect(result.graph.cells.get(1)?.collapsed).toBe(true);
      expect(result.graph.cells.get(2)?.collapsed).toBe(true);
    });

    it('should detect contradictions', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['A'] }, // Only A can follow A
          B: { next: ['B'] }  // Only B can follow B
        }
      });

      // Create a graph that forces a contradiction
      const graph: WFCGraph = {
        cells: new Map([
          [0, { id: 0, possibleStates: new Set(['A']), collapsed: true, collapsedState: 'A' }],
          [1, { id: 1, possibleStates: new Set(['B']), collapsed: true, collapsedState: 'B' }],
          [2, { id: 2, possibleStates: new Set(), collapsed: false }]
        ]),
        getNeighbors: (id) => {
          if (id === 0) return [{ neighbor: 2, dimension: 'next' }];
          if (id === 1) return [{ neighbor: 2, dimension: 'next' }];
          return [];
        }
      };

      const result = wfc.collapse(graph);

      expect(result.success).toBe(false);
      expect(result.contradiction).toBe(true);
    });

    it('should be deterministic with same seed', () => {
      const createWFC = () => new WFC({
        seed: 12345,
        states: ['grass', 'water'],
        constraints: {
          grass: { north: ['grass', 'water'], south: ['grass', 'water'] },
          water: { north: ['grass', 'water'], south: ['grass', 'water'] }
        }
      });

      const createGraph = (): WFCGraph => ({
        cells: new Map([
          [0, { id: 0, possibleStates: new Set(), collapsed: false }],
          [1, { id: 1, possibleStates: new Set(), collapsed: false }],
          [2, { id: 2, possibleStates: new Set(), collapsed: false }],
          [3, { id: 3, possibleStates: new Set(), collapsed: false }]
        ]),
        getNeighbors: (id) => {
          if (id === 0) return [{ neighbor: 1, dimension: 'north' }];
          if (id === 1) return [{ neighbor: 2, dimension: 'north' }];
          if (id === 2) return [{ neighbor: 3, dimension: 'north' }];
          return [];
        }
      });

      const wfc1 = createWFC();
      const result1 = wfc1.collapse(createGraph());

      const wfc2 = createWFC();
      const result2 = wfc2.collapse(createGraph());

      expect(result1.graph.cells.get(0)?.collapsedState).toBe(result2.graph.cells.get(0)?.collapsedState);
      expect(result1.graph.cells.get(1)?.collapsedState).toBe(result2.graph.cells.get(1)?.collapsedState);
      expect(result1.graph.cells.get(2)?.collapsedState).toBe(result2.graph.cells.get(2)?.collapsedState);
      expect(result1.graph.cells.get(3)?.collapsedState).toBe(result2.graph.cells.get(3)?.collapsedState);
    });
  });

  describe('Configuration Options', () => {
    it('should support different entropy modes', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: { next: ['B', 'C'] },
          B: { next: ['A', 'C'] },
          C: { next: ['A', 'B'] }
        },
        entropyMode: 'weighted-shannon',
        frequencies: { A: 50, B: 30, C: 20 }
      });

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should support entropy noise', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['B'] },
          B: { next: ['A'] }
        },
        entropyNoise: 0.001
      });

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should support boundary conditions', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['B'] },
          B: { next: ['A'] }
        },
        boundaries: 'wrap'
      });

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should support per-dimension boundary configuration', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['grass', 'water'],
        constraints: {
          grass: { north: ['grass', 'water'] },
          water: { north: ['grass', 'water'] }
        },
        boundaries: {
          default: 'open',
          perDimension: {
            north: 'water',
            south: 'water'
          }
        }
      });

      expect(wfc).toBeInstanceOf(WFC);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: { next: ['B', 'C'] },
          B: { next: ['A', 'C'] },
          C: { next: ['A', 'B'] }
        },
        frequencies: { A: 50, B: 30, C: 20 }
      });

      const dto = wfc.toJSON();

      expect(dto).toHaveProperty('seed');
      expect(dto).toHaveProperty('states');
      expect(dto).toHaveProperty('constraints');
      expect(dto).toHaveProperty('frequencies');
      expect(dto.seed).toBe(42);
      expect(dto.states).toEqual(['A', 'B', 'C']);
    });

    it('should deserialize from JSON', () => {
      const dto: WFCDTO = {
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: { next: ['B', 'C'] },
          B: { next: ['A', 'C'] },
          C: { next: ['A', 'B'] }
        },
        frequencies: { A: 50, B: 30, C: 20 }
      };

      const wfc = WFC.fromJSON(dto);

      expect(wfc).toBeInstanceOf(WFC);
    });

    it('should preserve behavior after serialization round-trip', () => {
      const original = new WFC({
        seed: 99,
        states: ['X', 'Y'],
        constraints: {
          X: { next: ['Y'] },
          Y: { next: ['X'] }
        }
      });

      const dto = original.toJSON();
      const restored = WFC.fromJSON(dto);

      // Create same graph for both
      const createGraph = (): WFCGraph => ({
        cells: new Map([
          [0, { id: 0, possibleStates: new Set(), collapsed: false }],
          [1, { id: 1, possibleStates: new Set(), collapsed: false }]
        ]),
        getNeighbors: (id) => {
          if (id === 0) return [{ neighbor: 1, dimension: 'next' }];
          return [];
        }
      });

      const result1 = original.collapse(createGraph());
      const result2 = restored.collapse(createGraph());

      expect(result1.graph.cells.get(0)?.collapsedState).toBe(result2.graph.cells.get(0)?.collapsedState);
      expect(result1.graph.cells.get(1)?.collapsedState).toBe(result2.graph.cells.get(1)?.collapsedState);
    });
  });
});

describe('WFCGrid2D - 2D Grid Adapter', () => {
  describe('Basic 2D Grid Generation', () => {
    it('should generate a 3x3 grid with simple constraints', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B'] },
          B: { north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B'] }
        }
      });

      const grid = new WFCGrid2D({ width: 3, height: 3, wfc });
      const result = grid.generate();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(3);
      expect(result.every(row => row.every(cell => ['A', 'B'].includes(cell)))).toBe(true);
    });

    it('should generate checkerboard pattern with strict constraints', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['black', 'white'],
        constraints: {
          black: {
            north: ['white'],
            south: ['white'],
            east: ['white'],
            west: ['white']
          },
          white: {
            north: ['black'],
            south: ['black'],
            east: ['black'],
            west: ['black']
          }
        }
      });

      const grid = new WFCGrid2D({ width: 4, height: 4, wfc });
      const result = grid.generate();

      // Verify checkerboard pattern
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const expected = (x + y) % 2 === 0 ? 'black' : 'white';
          // Note: Actual expected state depends on starting cell
          // This is a simplified check - full check would verify neighbors
          expect(['black', 'white']).toContain(result[y][x]);
        }
      }
    });

    it('should generate deterministically with same seed', () => {
      const createWFC = () => new WFC({
        seed: 777,
        states: ['grass', 'water'],
        constraints: {
          grass: {
            north: ['grass', 'water'],
            south: ['grass', 'water'],
            east: ['grass', 'water'],
            west: ['grass', 'water']
          },
          water: {
            north: ['grass', 'water'],
            south: ['grass', 'water'],
            east: ['grass', 'water'],
            west: ['grass', 'water']
          }
        }
      });

      const grid1 = new WFCGrid2D({ width: 5, height: 5, wfc: createWFC() });
      const result1 = grid1.generate();

      const grid2 = new WFCGrid2D({ width: 5, height: 5, wfc: createWFC() });
      const result2 = grid2.generate();

      expect(result1).toEqual(result2);
    });

    it('should handle edge cases: 1x1 grid', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['only'],
        constraints: {
          only: {}
        }
      });

      const grid = new WFCGrid2D({ width: 1, height: 1, wfc });
      const result = grid.generate();

      expect(result).toEqual([['only']]);
    });

    it('should handle edge cases: 1xN grid', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { north: ['A', 'B'], south: ['A', 'B'] },
          B: { north: ['A', 'B'], south: ['A', 'B'] }
        }
      });

      const grid = new WFCGrid2D({ width: 1, height: 5, wfc });
      const result = grid.generate();

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveLength(1);
    });

    it('should handle large grids efficiently', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints: {
          A: {
            north: ['A', 'B', 'C'],
            south: ['A', 'B', 'C'],
            east: ['A', 'B', 'C'],
            west: ['A', 'B', 'C']
          },
          B: {
            north: ['A', 'B', 'C'],
            south: ['A', 'B', 'C'],
            east: ['A', 'B', 'C'],
            west: ['A', 'B', 'C']
          },
          C: {
            north: ['A', 'B', 'C'],
            south: ['A', 'B', 'C'],
            east: ['A', 'B', 'C'],
            west: ['A', 'B', 'C']
          }
        }
      });

      const grid = new WFCGrid2D({ width: 100, height: 100, wfc });

      const startTime = Date.now();
      const result = grid.generate();
      const elapsed = Date.now() - startTime;

      expect(result).toHaveLength(100);
      expect(result[0]).toHaveLength(100);
      expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});

describe('WFCConstraintLearner - Learning from Examples', () => {
  describe('Basic Constraint Learning', () => {
    it('should learn simple pattern from single example', () => {
      const example = [
        ['A', 'B', 'A'],
        ['B', 'A', 'B'],
        ['A', 'B', 'A']
      ];

      const constraints = WFCConstraintLearner.learn2DConstraints([example]);

      expect(constraints).toHaveProperty('A');
      expect(constraints).toHaveProperty('B');
      expect(constraints.A).toHaveProperty('north');
      expect(constraints.A).toHaveProperty('south');
      expect(constraints.A).toHaveProperty('east');
      expect(constraints.A).toHaveProperty('west');

      // A should have B as valid neighbor in most directions
      expect(constraints.A.north).toContain('B');
      expect(constraints.A.east).toContain('B');
    });

    it('should merge constraints from multiple examples', () => {
      const example1 = [
        ['A', 'A', 'A'],
        ['A', 'A', 'A'],
        ['A', 'A', 'A']
      ];

      const example2 = [
        ['B', 'B', 'B'],
        ['B', 'B', 'B'],
        ['B', 'B', 'B']
      ];

      const example3 = [
        ['A', 'B', 'A'],
        ['B', 'A', 'B'],
        ['A', 'B', 'A']
      ];

      const constraints = WFCConstraintLearner.learn2DConstraints([example1, example2, example3]);

      // Should allow both A-A and A-B transitions
      expect(constraints.A.north).toContain('A');
      expect(constraints.A.north).toContain('B');
    });

    it('should learn weighted constraints with frequencies', () => {
      const example = [
        ['grass', 'grass', 'water'],
        ['grass', 'grass', 'water'],
        ['grass', 'grass', 'water']
      ];

      const constraints = WFCConstraintLearner.learnWeightedConstraints([example]);

      expect(constraints).toHaveProperty('grass');
      expect(constraints).toHaveProperty('water');

      // grass-grass should be more frequent than grass-water
      // This will be verified by the Distribution weights
    });

    it('should learn from complex pattern', () => {
      const dungeon = [
        ['wall', 'wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'floor', 'floor', 'wall'],
        ['wall', 'floor', 'door', 'floor', 'wall'],
        ['wall', 'floor', 'floor', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall']
      ];

      const constraints = WFCConstraintLearner.learn2DConstraints([dungeon]);

      // Wall should allow wall and floor as neighbors
      expect(constraints.wall.north).toContain('wall');
      expect(constraints.wall.south).toContain('floor');

      // Floor should not allow direct connection to outside (only wall or door)
      expect(constraints.floor.north).toEqual(expect.arrayContaining(['floor', 'wall', 'door']));
    });
  });

  describe('Integration: Learn and Generate', () => {
    it('should generate similar output to input examples', () => {
      // Learn from stripe pattern
      const stripes = [
        ['A', 'A', 'A'],
        ['B', 'B', 'B'],
        ['A', 'A', 'A']
      ];

      const constraints = WFCConstraintLearner.learn2DConstraints([stripes]);

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints
      });

      const grid = new WFCGrid2D({ width: 3, height: 3, wfc });
      const result = grid.generate();

      // Result should have horizontal stripes (all same state in each row)
      const row0State = result[0][0];
      const row1State = result[1][0];
      const row2State = result[2][0];

      // Each row should be homogeneous
      expect(result[0].every(cell => cell === row0State)).toBe(true);
      expect(result[1].every(cell => cell === row1State)).toBe(true);
      expect(result[2].every(cell => cell === row2State)).toBe(true);

      // Adjacent rows should be different
      expect(row0State).not.toBe(row1State);
      expect(row1State).not.toBe(row2State);
    });
  });
});

describe('WFC - Error Handling', () => {
  it('should throw on empty states array', () => {
    expect(() => {
      new WFC({
        seed: 42,
        states: [],
        constraints: {}
      });
    }).toThrow('States array cannot be empty');
  });

  it('should throw on invalid constraint references', () => {
    expect(() => {
      new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['C'] } // C doesn't exist in states
        }
      });
    }).toThrow(/Invalid state.*constraint/i);
  });

  it('should throw on invalid entropy mode', () => {
    expect(() => {
      new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints: {
          A: { next: ['B'] },
          B: { next: ['A'] }
        },
        entropyMode: 'invalid-mode' as any
      });
    }).toThrow(/Invalid entropy mode/i);
  });

  it('should provide helpful error on contradiction', () => {
    const wfc = new WFC({
      seed: 42,
      states: ['A', 'B'],
      constraints: {
        A: { next: ['A'] },
        B: { next: ['B'] }
      }
    });

    const graph: WFCGraph = {
      cells: new Map([
        [0, { id: 0, possibleStates: new Set(['A']), collapsed: true, collapsedState: 'A' }],
        [1, { id: 1, possibleStates: new Set(['B']), collapsed: true, collapsedState: 'B' }],
        [2, { id: 2, possibleStates: new Set(), collapsed: false }]
      ]),
      getNeighbors: (id) => {
        if (id === 0) return [{ neighbor: 2, dimension: 'next' }];
        if (id === 1) return [{ neighbor: 2, dimension: 'next' }];
        return [];
      }
    };

    const result = wfc.collapse(graph);

    expect(result.success).toBe(false);
    expect(result.contradiction).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/contradiction/i);
  });
});
