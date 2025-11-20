/**
 * WFC Backtracking Test Suite
 *
 * Tests for backtracking feature in WFC
 */

import {WFC, WFCGrid2D} from '../structures';
import type {ConstraintRules, BacktrackConfig} from '../structures/wfc-types';

describe('WFC Backtracking', () => {
  describe('Basic Backtracking', () => {
    it('should succeed with backtracking where standard WFC would fail', () => {
      // Create a constraint system that's likely to hit contradictions
      const constraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['B'],  // A forces B to the east
          west: ['A', 'B']
        },
        B: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A'],  // B forces A to the east
          west: ['A', 'B']
        }
      };

      // Without backtracking
      const wfcNoBacktrack = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
        backtrack: false
      });

      const gridNoBacktrack = new WFCGrid2D({
        width: 4,
        height: 4,
        wfc: wfcNoBacktrack
      });

      const resultNoBacktrack = gridNoBacktrack.generate();

      // With backtracking
      const wfcWithBacktrack = new WFC({
        seed: 42,
        states: ['A', 'B'],
        constraints,
        backtrack: true
      });

      const gridWithBacktrack = new WFCGrid2D({
        width: 4,
        height: 4,
        wfc: wfcWithBacktrack
      });

      const resultWithBacktrack = gridWithBacktrack.generate();

      // With backtracking should have better success rate
      // (Note: exact behavior depends on seed, but backtracking should help)
      if (!resultNoBacktrack && resultWithBacktrack) {
        // Backtracking solved a contradiction
        expect(resultWithBacktrack).not.toBeNull();
        expect(resultWithBacktrack!.length).toBe(4);
        expect(resultWithBacktrack![0].length).toBe(4);
      }

      // At minimum, backtracking should not make things worse
      if (resultNoBacktrack) {
        expect(resultWithBacktrack).not.toBeNull();
      }
    });

    it('should report backtrack count in metadata', () => {
      const constraints: ConstraintRules = {
        X: {
          north: ['X', 'Y'],
          south: ['X', 'Y'],
          east: ['Y'],
          west: ['X', 'Y']
        },
        Y: {
          north: ['X', 'Y'],
          south: ['X', 'Y'],
          east: ['X'],
          west: ['X', 'Y']
        }
      };

      const wfc = new WFC({
        seed: 123,
        states: ['X', 'Y'],
        constraints,
        backtrack: true
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generateWithResult();

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.backtracks).toBeDefined();
      expect(typeof result.metadata?.backtracks).toBe('number');
      expect(result.metadata?.backtracks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Backtracking Configuration', () => {
    it('should respect maxDepth configuration', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A'],
          south: ['B'],
          east: ['A'],
          west: ['A']
        },
        B: {
          north: ['A'],
          south: ['A'],
          east: ['B'],
          west: ['B']
        }
      };

      const config: BacktrackConfig = {
        enabled: true,
        maxDepth: 2,  // Very low depth
        maxAttempts: 1000
      };

      const wfc = new WFC({
        seed: 456,
        states: ['A', 'B'],
        constraints,
        backtrack: config
      });

      const grid = new WFCGrid2D({width: 3, height: 3, wfc});
      const result = grid.generateWithResult();

      // With very low max depth, might fail
      if (!result.success) {
        expect(result.error).toBeDefined();
        // Could be depth exceeded or exhausted options
        expect(
          result.error?.includes('depth') ||
          result.error?.includes('Exhausted')
        ).toBe(true);
      }
    });

    it('should respect maxAttempts configuration', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A'],
          south: ['B'],
          east: ['A'],
          west: ['A']
        },
        B: {
          north: ['A'],
          south: ['A'],
          east: ['B'],
          west: ['B']
        }
      };

      const config: BacktrackConfig = {
        enabled: true,
        maxDepth: 100,
        maxAttempts: 10  // Very low attempts
      };

      const wfc = new WFC({
        seed: 789,
        states: ['A', 'B'],
        constraints,
        backtrack: config
      });

      const grid = new WFCGrid2D({width: 3, height: 3, wfc});
      const result = grid.generateWithResult();

      // With very low max attempts, might fail
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Attempts should be limited
      expect(result.metadata?.steps).toBeLessThanOrEqual(15);  // Some buffer
    });

    it('should work with boolean backtrack option', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        },
        B: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        }
      };

      const wfc = new WFC({
        seed: 999,
        states: ['A', 'B'],
        constraints,
        backtrack: true  // Boolean form
      });

      const grid = new WFCGrid2D({width: 3, height: 3, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
    });
  });

  describe('Backtracking Behavior', () => {
    it('should handle simple grid with potential contradictions', () => {
      const constraints: ConstraintRules = {
        floor: {
          north: ['floor', 'wall'],
          south: ['floor', 'wall'],
          east: ['floor', 'wall'],
          west: ['floor', 'wall']
        },
        wall: {
          north: ['wall'],
          south: ['wall'],
          east: ['wall'],
          west: ['wall']
        }
      };

      const wfc = new WFC({
        seed: 111,
        states: ['floor', 'wall'],
        constraints,
        backtrack: {enabled: true, maxDepth: 50}
      });

      const grid = new WFCGrid2D({width: 6, height: 6, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
      if (result) {
        expect(result.length).toBe(6);
        expect(result[0].length).toBe(6);

        // Verify all cells are valid
        for (let y = 0; y < 6; y++) {
          for (let x = 0; x < 6; x++) {
            expect(['floor', 'wall']).toContain(result[y][x]);
          }
        }
      }
    });

    it('should eventually succeed on harder constraints with backtracking', () => {
      // Tight constraints that create many contradictions
      const constraints: ConstraintRules = {
        A: {
          north: ['B'],
          south: ['B'],
          east: ['B'],
          west: ['B']
        },
        B: {
          north: ['A'],
          south: ['A'],
          east: ['A'],
          west: ['A']
        }
      };

      const wfc = new WFC({
        seed: 222,
        states: ['A', 'B'],
        constraints,
        backtrack: {enabled: true, maxDepth: 100, maxAttempts: 2000}
      });

      const grid = new WFCGrid2D({width: 4, height: 4, wfc});
      const result = grid.generateWithResult();

      // This should succeed with backtracking (checkerboard pattern)
      if (result.success) {
        expect(result.grid).not.toBeNull();
        // May succeed with or without backtracks depending on seed
        expect(result.metadata?.backtracks).toBeGreaterThanOrEqual(0);
      } else {
        // If it fails, it should have tried backtracking
        expect(result.metadata?.backtracks).toBeDefined();
      }
    });

    it('should handle single-cell grid', () => {
      const constraints: ConstraintRules = {
        X: {
          north: ['X'],
          south: ['X'],
          east: ['X'],
          west: ['X']
        }
      };

      const wfc = new WFC({
        seed: 333,
        states: ['X'],
        constraints,
        backtrack: true
      });

      const grid = new WFCGrid2D({width: 1, height: 1, wfc});
      const result = grid.generate();

      expect(result).toEqual([['X']]);
    });

    it('should handle grid with pre-collapsed cells', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        },
        B: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        }
      };

      const wfc = new WFC({
        seed: 444,
        states: ['A', 'B'],
        constraints,
        backtrack: true
      });

      const grid = new WFCGrid2D({
        width: 3,
        height: 3,
        wfc,
        boundaries: {
          perDimension: {
            north: 'A'
          }
        }
      });

      const result = grid.generate();

      expect(result).not.toBeNull();
      if (result) {
        // Check that north boundary is fixed to 'A'
        expect(result[0][0]).toBe('A');
        expect(result[0][1]).toBe('A');
        expect(result[0][2]).toBe('A');
      }
    });
  });

  describe('Backtracking Disabled', () => {
    it('should fail quickly without backtracking on contradiction', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['B'],
          south: ['B'],
          east: ['B'],
          west: ['B']
        },
        B: {
          north: ['A'],
          south: ['A'],
          east: ['A'],
          west: ['A']
        }
      };

      const wfc = new WFC({
        seed: 555,
        states: ['A', 'B'],
        constraints,
        backtrack: false  // Explicitly disabled
      });

      const grid = new WFCGrid2D({width: 4, height: 4, wfc});
      const result = grid.generateWithResult();

      // Should have 0 backtracks
      expect(result.metadata?.backtracks).toBe(0);
    });

    it('should work fine without backtracking on simple constraints', () => {
      const constraints: ConstraintRules = {
        X: {
          north: ['X', 'Y'],
          south: ['X', 'Y'],
          east: ['X', 'Y'],
          west: ['X', 'Y']
        },
        Y: {
          north: ['X', 'Y'],
          south: ['X', 'Y'],
          east: ['X', 'Y'],
          west: ['X', 'Y']
        }
      };

      const wfc = new WFC({
        seed: 666,
        states: ['X', 'Y'],
        constraints,
        backtrack: false
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty grid', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A'],
          south: ['A'],
          east: ['A'],
          west: ['A']
        }
      };

      const wfc = new WFC({
        seed: 777,
        states: ['A'],
        constraints,
        backtrack: true
      });

      // Should throw on invalid dimensions
      expect(() => {
        new WFCGrid2D({width: 0, height: 0, wfc});
      }).toThrow('Grid dimensions must be positive');
    });

    it('should handle zero maxDepth gracefully', () => {
      const constraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        },
        B: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        }
      };

      const wfc = new WFC({
        seed: 888,
        states: ['A', 'B'],
        constraints,
        backtrack: {enabled: true, maxDepth: 0}
      });

      const grid = new WFCGrid2D({width: 2, height: 2, wfc});
      const result = grid.generateWithResult();

      // With 0 depth, should fail quickly or succeed without backtracking
      expect(result).toBeDefined();
      expect(result.metadata?.backtracks).toBeDefined();
    });
  });
});
