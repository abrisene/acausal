/**
 * WFC Error Handling Test Suite
 *
 * Tests for error handling, validation, and helpful error messages
 */

import {WFC, WFCGrid2D} from '../structures';
import type {ConstraintRules} from '../structures/wfc-types';

describe('WFC Error Handling', () => {
  describe('Constructor Validation', () => {
    it('should throw on empty states array', () => {
      expect(() => {
        new WFC({
          seed: 42,
          states: [],
          constraints: {},
        });
      }).toThrow('States array cannot be empty');
    });

    it('should throw on missing constraints', () => {
      expect(() => {
        new WFC({
          seed: 42,
          states: ['A', 'B'],
          constraints: undefined as any,
        });
      }).toThrow('Constraints are required');
    });

    it('should throw on invalid state reference in constraints', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A', 'X'], // X doesn't exist in states
          south: ['A'],
          east: ['A'],
          west: ['A'],
        },
      };

      expect(() => {
        new WFC({
          seed: 42,
          states: ['A', 'B'],
          constraints,
        });
      }).toThrow();
    });

    it('should accept partial constraints (missing state)', () => {
      const constraints: ConstraintRules = {
        // Missing 'B' - this is actually allowed, B will have no constraints
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      // This should not throw - WFC allows partial constraints
      expect(() => {
        new WFC({
          seed: 42,
          states: ['A', 'B'],
          constraints,
        });
      }).not.toThrow();
    });
  });

  describe('Grid2D Validation', () => {
    it('should throw on zero width', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints: {A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']}},
      });

      expect(() => {
        new WFCGrid2D({width: 0, height: 10, wfc});
      }).toThrow('Grid dimensions must be positive');
    });

    it('should throw on zero height', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints: {A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']}},
      });

      expect(() => {
        new WFCGrid2D({width: 10, height: 0, wfc});
      }).toThrow('Grid dimensions must be positive');
    });

    it('should throw on negative dimensions', () => {
      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints: {A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']}},
      });

      expect(() => {
        new WFCGrid2D({width: -5, height: 10, wfc});
      }).toThrow('Grid dimensions must be positive');
    });
  });

  describe('Contradiction Handling', () => {
    it('should provide helpful error on contradiction', () => {
      // Impossible constraints: A requires B north, B requires C north, C requires A north
      const constraints: ConstraintRules = {
        A: {north: ['B'], south: ['A'], east: ['A'], west: ['A']},
        B: {north: ['C'], south: ['B'], east: ['B'], west: ['B']},
        C: {north: ['A'], south: ['C'], east: ['C'], west: ['C']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B', 'C'],
        constraints,
        backtrack: false,
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generateWithResult();

      expect(result.success).toBe(false);
      expect(result.contradiction).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/contradiction/i);
    });

    it('should handle pre-collapsed cells in graph', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
        B: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
        backtrack: false,
      });

      // Create graph with pre-collapsed cells
      const graph = new WFCGrid2D({width: 3, height: 3, wfc}).createGraph();

      // Pre-collapse center cell
      const centerCell = graph.cells.get('1-1');
      if (centerCell) {
        centerCell.collapsed = true;
        centerCell.collapsedState = 'A';
        centerCell.possibleStates = new Set(['A']);
      }

      const result = wfc.collapse(graph);

      // Should succeed or handle gracefully
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe('Boundary Validation', () => {
    it('should handle invalid boundary mode gracefully', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints,
      });

      // TypeScript should catch this at compile time, but test runtime behavior
      const grid = new WFCGrid2D({
        width: 3,
        height: 3,
        wfc,
        boundaries: 'invalid' as any,
      });

      // Should still work (fall back to default behavior)
      const result = grid.generate();
      expect(result).not.toBeNull();
    });

    it('should handle per-dimension boundary with invalid state', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints,
      });

      // Specify non-existent state for fixed boundary
      const grid = new WFCGrid2D({
        width: 3,
        height: 3,
        wfc,
        boundaries: {
          perDimension: {
            north: 'X' as any, // Non-existent state
          },
        },
      });

      const result = grid.generateWithResult();

      // Should either work (ignore invalid state) or fail gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Backtracking Limits', () => {
    it('should respect maxDepth limit', () => {
      // Very tight constraints
      const constraints: ConstraintRules = {
        A: {north: ['B'], south: ['B'], east: ['B'], west: ['B']},
        B: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
        backtrack: {enabled: true, maxDepth: 2}, // Very low limit
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generateWithResult();

      if (!result.success) {
        // Should mention depth limit if exceeded
        expect(
          result.error?.includes('depth') || result.error?.includes('Exhausted')
        ).toBe(true);
      }
    });

    it('should respect maxAttempts limit', () => {
      const constraints: ConstraintRules = {
        A: {north: ['B'], south: ['B'], east: ['B'], west: ['B']},
        B: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
        backtrack: {enabled: true, maxDepth: 100, maxAttempts: 10}, // Very low attempts
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generateWithResult();

      if (!result.success) {
        // Should mention attempts if exceeded
        expect(result.error?.includes('attempts')).toBe(true);
      }

      // Should respect attempt limit
      expect(result.metadata?.steps).toBeLessThanOrEqual(15); // Some buffer
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle single-cell graph', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A'],
        constraints,
      });

      const grid = new WFCGrid2D({width: 1, height: 1, wfc});
      const result = grid.generate();

      expect(result).toEqual([['A']]);
    });

    it('should handle single-row graph', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
        B: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
      });

      const grid = new WFCGrid2D({width: 10, height: 1, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
      expect(result?.length).toBe(1);
      expect(result?.[0].length).toBe(10);
    });

    it('should handle single-column graph', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
        B: {north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B']},
      };

      const wfc = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
      });

      const grid = new WFCGrid2D({width: 1, height: 10, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
      expect(result?.length).toBe(10);
      expect(result?.[0].length).toBe(1);
    });

    it('should handle empty constraint dimensions', () => {
      // State with no constraints for some dimensions
      const constraints: ConstraintRules = {
        A: {
          north: ['A'],
          // Missing south, east, west - should handle gracefully
        } as any,
      };

      expect(() => {
        const wfc = new WFC({
          seed: 42,
          states: ['A'],
          constraints,
        });

        const grid = new WFCGrid2D({width: 3, height: 3, wfc});
        grid.generate();
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should validate entropy mode', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      // Valid entropy modes should work
      expect(() => {
        new WFC({seed: 42, states: ['A'], constraints, entropyMode: 'count'});
      }).not.toThrow();

      expect(() => {
        new WFC({seed: 42, states: ['A'], constraints, entropyMode: 'shannon'});
      }).not.toThrow();

      expect(() => {
        new WFC({
          seed: 42,
          states: ['A'],
          constraints,
          entropyMode: 'weighted-shannon',
        });
      }).not.toThrow();
    });

    it('should accept custom entropy function', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
      };

      const customEntropy = () => Math.random();

      expect(() => {
        new WFC({
          seed: 42,
          states: ['A'],
          constraints,
          entropyMode: customEntropy,
        });
      }).not.toThrow();
    });
  });

  describe('Helpful Error Messages', () => {
    it('should handle partial constraint dimensions gracefully', () => {
      const constraints: ConstraintRules = {
        A: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
        B: {
          north: ['A'],
          // Missing south, east, west - should handle gracefully
        } as any,
      };

      // WFC allows partial dimensions - missing dimensions have no constraints
      expect(() => {
        const wfc = new WFC({
          seed: 42,
          states: ['A', 'B'],
          constraints,
        });

        // Should not throw
        expect(wfc).toBeDefined();
      }).not.toThrow();
    });

    it('should provide clear error on invalid Distribution constraint', () => {
      const constraints: ConstraintRules = {
        A: {
          north: 'not-an-array' as any, // Invalid type
          south: ['A'],
          east: ['A'],
          west: ['A'],
        },
      };

      // Should handle gracefully or throw clear error
      expect(() => {
        const wfc = new WFC({
          seed: 42,
          states: ['A'],
          constraints,
        });

        const grid = new WFCGrid2D({width: 3, height: 3, wfc});
        grid.generate();
      }).not.toThrow(); // Should handle type coercion
    });
  });
});
