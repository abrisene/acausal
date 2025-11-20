/**
 * WFC Symmetry Test Suite
 *
 * Tests for automatic symmetry generation (dimension-agnostic)
 */

import {WFC, WFCGrid2D, WFCSymmetry, SYMMETRY_PRESETS} from '../structures';
import type {ConstraintRules} from '../structures/wfc-types';
import type {SymmetryTransform} from '../structures/wfc-symmetry';

describe('WFC Symmetry - Dimension-Agnostic', () => {
  describe('Basic Transform Application', () => {
    it('should apply a single transformation', () => {
      const baseConstraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          east: ['B']
        }
      };

      // Rotate 90° clockwise: north -> east, east -> south
      const symmetric = WFCSymmetry.applyTransform(
        baseConstraints,
        SYMMETRY_PRESETS.grid2D.rotate90
      );

      // Original constraints should be preserved
      expect(symmetric.A.north).toEqual(['A', 'B']);
      expect(symmetric.A.east).toEqual(['B']);

      // New constraints should be filled in from rotation
      expect(symmetric.A.south).toEqual(['B']);  // From east
      expect(symmetric.A.west).toEqual(['A', 'B']);  // From north
    });

    it('should apply multiple transformations in sequence', () => {
      const baseConstraints: ConstraintRules = {
        X: {
          north: ['X', 'Y']
        }
      };

      const symmetric = WFCSymmetry.applyTransforms(baseConstraints, [
        SYMMETRY_PRESETS.grid2D.rotate90,
        SYMMETRY_PRESETS.grid2D.rotate180,
      ]);

      // Should have all 4 directions filled
      expect(symmetric.X.north).toBeDefined();
      expect(symmetric.X.east).toBeDefined();
      expect(symmetric.X.south).toBeDefined();
      expect(symmetric.X.west).toBeDefined();
    });

    it('should work with custom dimensions', () => {
      const baseConstraints: ConstraintRules = {
        tile: {
          forward: ['tile', 'wall'],
          left: ['tile']
        }
      };

      const customTransform: SymmetryTransform = {
        name: 'rotate180',
        mapping: {
          forward: 'back',
          back: 'forward',
          left: 'right',
          right: 'left',
        },
      };

      const symmetric = WFCSymmetry.applyTransform(baseConstraints, customTransform);

      expect(symmetric.tile.forward).toEqual(['tile', 'wall']);
      expect(symmetric.tile.left).toEqual(['tile']);
      expect(symmetric.tile.back).toEqual(['tile', 'wall']);  // From forward
      expect(symmetric.tile.right).toEqual(['tile']);  // From left
    });
  });

  describe('2D Grid Symmetry', () => {
    it('should apply all 2D rotations', () => {
      const baseConstraints: ConstraintRules = {
        A: {
          north: ['A', 'B']
        }
      };

      const symmetric = WFCSymmetry.applyAllRotations(baseConstraints, 'grid2D');

      // All four directions should be filled with the same constraints
      expect(symmetric.A.north).toEqual(['A', 'B']);
      expect(symmetric.A.east).toEqual(['A', 'B']);
      expect(symmetric.A.south).toEqual(['A', 'B']);
      expect(symmetric.A.west).toEqual(['A', 'B']);
    });

    it('should apply 2D reflections', () => {
      const baseConstraints: ConstraintRules = {
        X: {
          north: ['X', 'Y'],
          east: ['Y', 'Z']
        }
      };

      const symmetric = WFCSymmetry.applyAllReflections(baseConstraints, 'grid2D');

      // Horizontal reflection: north <-> south
      expect(symmetric.X.north).toEqual(['X', 'Y']);
      expect(symmetric.X.south).toEqual(['X', 'Y']);

      // Vertical reflection: east <-> west
      expect(symmetric.X.east).toEqual(['Y', 'Z']);
      expect(symmetric.X.west).toEqual(['Y', 'Z']);
    });

    it('should apply full 2D symmetry (rotations + reflections)', () => {
      const baseConstraints: ConstraintRules = {
        tile: {
          north: ['tile', 'wall']
        }
      };

      const symmetric = WFCSymmetry.applyFullSymmetry(baseConstraints, 'grid2D');

      // All directions should have the same constraints
      const expected = ['tile', 'wall'];
      expect(symmetric.tile.north).toEqual(expected);
      expect(symmetric.tile.south).toEqual(expected);
      expect(symmetric.tile.east).toEqual(expected);
      expect(symmetric.tile.west).toEqual(expected);
    });

    it('should generate valid grids with 2D symmetry', () => {
      const baseConstraints: ConstraintRules = {
        floor: {
          north: ['floor', 'wall']
        },
        wall: {
          north: ['wall']
        }
      };

      const symmetric = WFCSymmetry.applyFullSymmetry(baseConstraints, 'grid2D');

      const wfc = new WFC({
        seed: 42,
        states: ['floor', 'wall'],
        constraints: symmetric
      });

      const grid = new WFCGrid2D({width: 8, height: 8, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
      if (result) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            expect(['floor', 'wall']).toContain(result[y][x]);
          }
        }
      }
    });
  });

  describe('Hex Grid Symmetry', () => {
    it('should apply hex rotations (60° increments)', () => {
      const baseConstraints: ConstraintRules = {
        A: {
          n: ['A', 'B']
        }
      };

      const symmetric = WFCSymmetry.applyAllRotations(baseConstraints, 'hex');

      // Should have all 6 hex directions filled
      expect(symmetric.A.n).toBeDefined();
      expect(symmetric.A.ne).toBeDefined();
      expect(symmetric.A.se).toBeDefined();
      expect(symmetric.A.s).toBeDefined();
      expect(symmetric.A.sw).toBeDefined();
      expect(symmetric.A.nw).toBeDefined();
    });

    it('should apply hex reflections', () => {
      const baseConstraints: ConstraintRules = {
        X: {
          ne: ['X', 'Y']
        }
      };

      const symmetric = WFCSymmetry.applyAllReflections(baseConstraints, 'hex');

      // Vertical reflection: ne <-> nw, se <-> sw
      expect(symmetric.X.ne).toEqual(['X', 'Y']);
      expect(symmetric.X.nw).toEqual(['X', 'Y']);
    });
  });

  describe('3D Voxel Symmetry', () => {
    it('should apply 3D rotations around Y axis', () => {
      const baseConstraints: ConstraintRules = {
        block: {
          north: ['block', 'air']
        }
      };

      const transform = SYMMETRY_PRESETS.voxel3D.rotateY90;
      const symmetric = WFCSymmetry.applyTransform(baseConstraints, transform);

      // north -> east after Y rotation
      expect(symmetric.block.north).toEqual(['block', 'air']);
      expect(symmetric.block.east).toEqual(['block', 'air']);
    });

    it('should work with all 3D voxel dimensions', () => {
      const baseConstraints: ConstraintRules = {
        voxel: {
          up: ['voxel'],
          north: ['voxel', 'solid']
        }
      };

      // Apply rotation around X axis
      const symmetric = WFCSymmetry.applyTransform(
        baseConstraints,
        SYMMETRY_PRESETS.voxel3D.rotateX90
      );

      // up -> north, north -> down
      expect(symmetric.voxel.up).toEqual(['voxel']);
      expect(symmetric.voxel.north).toEqual(['voxel', 'solid']);
      expect(symmetric.voxel.down).toEqual(['voxel', 'solid']);  // From north
    });
  });

  describe('Transform Composition', () => {
    it('should compose two transformations', () => {
      const rotate90 = SYMMETRY_PRESETS.grid2D.rotate90;
      const rotate180 = WFCSymmetry.composeTransforms(rotate90, rotate90);

      // Rotating 90° twice = 180°
      expect(rotate180.mapping.north).toBe('south');
      expect(rotate180.mapping.south).toBe('north');
      expect(rotate180.mapping.east).toBe('west');
      expect(rotate180.mapping.west).toBe('east');
    });

    it('should compose multiple rotations to get full cycle', () => {
      const rotate90 = SYMMETRY_PRESETS.grid2D.rotate90;
      const rotate360 = WFCSymmetry.composeTransforms(
        WFCSymmetry.composeTransforms(
          WFCSymmetry.composeTransforms(rotate90, rotate90),
          rotate90
        ),
        rotate90
      );

      // 360° rotation = identity
      expect(rotate360.mapping.north).toBe('north');
      expect(rotate360.mapping.south).toBe('south');
      expect(rotate360.mapping.east).toBe('east');
      expect(rotate360.mapping.west).toBe('west');
    });
  });

  describe('Symmetry Detection', () => {
    it('should detect symmetric constraints', () => {
      const symmetric: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'B'],
          east: ['A', 'B'],
          west: ['A', 'B']
        }
      };

      expect(WFCSymmetry.hasSymmetry(symmetric, SYMMETRY_PRESETS.grid2D.rotate90)).toBe(true);
      expect(WFCSymmetry.hasSymmetry(symmetric, SYMMETRY_PRESETS.grid2D.reflectHorizontal)).toBe(true);
    });

    it('should detect asymmetric constraints', () => {
      const asymmetric: ConstraintRules = {
        A: {
          north: ['A'],
          south: ['B'],
          east: ['A', 'B'],
          west: ['A']
        }
      };

      expect(WFCSymmetry.hasSymmetry(asymmetric, SYMMETRY_PRESETS.grid2D.rotate90)).toBe(false);
      expect(WFCSymmetry.hasSymmetry(asymmetric, SYMMETRY_PRESETS.grid2D.reflectHorizontal)).toBe(false);
    });
  });

  describe('Custom Topologies', () => {
    it('should work with custom dimension names', () => {
      // Custom graph with connections: prev/next (linear), up/down (vertical)
      const customTransform: SymmetryTransform = {
        name: 'flipVertical',
        mapping: {
          up: 'down',
          down: 'up',
          prev: 'prev',
          next: 'next',
        },
      };

      const baseConstraints: ConstraintRules = {
        node: {
          up: ['node', 'terminal'],
          prev: ['node']
        }
      };

      const symmetric = WFCSymmetry.applyTransform(baseConstraints, customTransform);

      expect(symmetric.node.up).toEqual(['node', 'terminal']);
      expect(symmetric.node.down).toEqual(['node', 'terminal']);
      expect(symmetric.node.prev).toEqual(['node']);
    });

    it('should support fully custom topology with multiple transforms', () => {
      // Define a custom 3-way topology
      const rotateCustom: SymmetryTransform = {
        name: 'rotate120',
        mapping: {
          a: 'b',
          b: 'c',
          c: 'a',
        },
      };

      const baseConstraints: ConstraintRules = {
        tri: {
          a: ['tri', 'edge']
        }
      };

      const symmetric = WFCSymmetry.applyTransforms(baseConstraints, [
        rotateCustom,
        WFCSymmetry.composeTransforms(rotateCustom, rotateCustom),  // 240°
      ]);

      // All three directions should be filled
      expect(symmetric.tri.a).toBeDefined();
      expect(symmetric.tri.b).toBeDefined();
      expect(symmetric.tri.c).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty constraints', () => {
      const baseConstraints: ConstraintRules = {
        A: {}
      };

      const symmetric = WFCSymmetry.applyAllRotations(baseConstraints, 'grid2D');

      expect(symmetric.A).toBeDefined();
    });

    it('should preserve existing constraints when applying symmetry', () => {
      const baseConstraints: ConstraintRules = {
        A: {
          north: ['A', 'B'],
          south: ['A', 'C'],  // Different from north
          east: ['B']
        }
      };

      const symmetric = WFCSymmetry.applyAllRotations(baseConstraints, 'grid2D');

      // Original constraints should be preserved
      expect(symmetric.A.north).toEqual(['A', 'B']);
      expect(symmetric.A.south).toEqual(['A', 'C']);
      // Missing west should be filled in
      expect(symmetric.A.west).toBeDefined();
    });

    it('should handle single-state systems', () => {
      const baseConstraints: ConstraintRules = {
        only: {
          north: ['only']
        }
      };

      const symmetric = WFCSymmetry.applyAllRotations(baseConstraints, 'grid2D');

      expect(symmetric.only.north).toEqual(['only']);
      expect(symmetric.only.south).toEqual(['only']);
      expect(symmetric.only.east).toEqual(['only']);
      expect(symmetric.only.west).toEqual(['only']);
    });
  });

  describe('Integration with WFC Generation', () => {
    it('should generate valid content with symmetric constraints', () => {
      const baseConstraints: ConstraintRules = {
        corridor: {
          north: ['corridor', 'wall']
        },
        wall: {
          north: ['wall']
        }
      };

      // Apply full 2D symmetry
      const symmetric = WFCSymmetry.applyFullSymmetry(baseConstraints, 'grid2D');

      const wfc = new WFC({
        seed: 123,
        states: ['corridor', 'wall'],
        constraints: symmetric,
        frequencies: {
          corridor: 70,
          wall: 30
        }
      });

      const grid = new WFCGrid2D({width: 10, height: 10, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
      if (result) {
        let corridors = 0;
        let walls = 0;

        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            if (result[y][x] === 'corridor') corridors++;
            if (result[y][x] === 'wall') walls++;
          }
        }

        expect(corridors + walls).toBe(100);
        expect(corridors).toBeGreaterThan(0);
        expect(walls).toBeGreaterThan(0);
      }
    });

    it('should work with constraint learning and symmetry', () => {
      // This test verifies that learned constraints can be made symmetric
      const manualConstraints: ConstraintRules = {
        A: {north: ['A', 'B'], east: ['B']},
        B: {north: ['B'], east: ['A', 'B']}
      };

      const symmetric = WFCSymmetry.applyFullSymmetry(manualConstraints, 'grid2D');

      const wfc = new WFC({
        seed: 456,
        states: ['A', 'B'],
        constraints: symmetric
      });

      const grid = new WFCGrid2D({width: 5, height: 5, wfc});
      const result = grid.generate();

      expect(result).not.toBeNull();
    });
  });
});
