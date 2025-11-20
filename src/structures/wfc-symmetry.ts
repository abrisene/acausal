/*
 # wfc-symmetry.ts
 # Wave Function Collapse Symmetry Support
 */

/**
 * Symmetry utilities for WFC.
 *
 * Automatically generate symmetric constraints from partial specifications.
 * Works with arbitrary dimensions - not limited to 2D grids.
 */

import type {State, Dimension, ConstraintRules, SymmetryConfig} from './wfc-types';
import {Distribution} from './distribution';

/**
 * Symmetry transformation - maps dimensions to other dimensions
 */
export interface SymmetryTransform {
  /** Name of this transformation (e.g., "rotate90", "reflectX") */
  name: string;

  /** Maps each dimension to its transformed dimension */
  mapping: {[dimension: Dimension]: Dimension};
}

/**
 * Predefined symmetry transforms for common topologies
 */
export const SYMMETRY_PRESETS = {
  /**
   * 2D Grid (north, south, east, west)
   */
  grid2D: {
    rotate90: {
      name: 'rotate90',
      mapping: {
        north: 'east',
        east: 'south',
        south: 'west',
        west: 'north',
      },
    } as SymmetryTransform,

    rotate180: {
      name: 'rotate180',
      mapping: {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      },
    } as SymmetryTransform,

    rotate270: {
      name: 'rotate270',
      mapping: {
        north: 'west',
        west: 'south',
        south: 'east',
        east: 'north',
      },
    } as SymmetryTransform,

    reflectHorizontal: {
      name: 'reflectHorizontal',
      mapping: {
        north: 'south',
        south: 'north',
        east: 'east',
        west: 'west',
      },
    } as SymmetryTransform,

    reflectVertical: {
      name: 'reflectVertical',
      mapping: {
        north: 'north',
        south: 'south',
        east: 'west',
        west: 'east',
      },
    } as SymmetryTransform,
  },

  /**
   * 3D Voxels (up, down, north, south, east, west)
   */
  voxel3D: {
    rotateX90: {
      name: 'rotateX90',
      mapping: {
        up: 'north',
        north: 'down',
        down: 'south',
        south: 'up',
        east: 'east',
        west: 'west',
      },
    } as SymmetryTransform,

    rotateY90: {
      name: 'rotateY90',
      mapping: {
        up: 'up',
        down: 'down',
        north: 'east',
        east: 'south',
        south: 'west',
        west: 'north',
      },
    } as SymmetryTransform,

    rotateZ90: {
      name: 'rotateZ90',
      mapping: {
        up: 'east',
        east: 'down',
        down: 'west',
        west: 'up',
        north: 'north',
        south: 'south',
      },
    } as SymmetryTransform,
  },

  /**
   * Hex Grid (n, ne, se, s, sw, nw)
   */
  hex: {
    rotate60: {
      name: 'rotate60',
      mapping: {
        n: 'ne',
        ne: 'se',
        se: 's',
        s: 'sw',
        sw: 'nw',
        nw: 'n',
      },
    } as SymmetryTransform,

    reflectVertical: {
      name: 'reflectVertical',
      mapping: {
        n: 'n',
        ne: 'nw',
        nw: 'ne',
        s: 's',
        se: 'sw',
        sw: 'se',
      },
    } as SymmetryTransform,
  },
};

/**
 * Symmetry utility for auto-generating WFC constraints
 */
export class WFCSymmetry {
  /**
   * Apply a symmetry transformation to constraints
   *
   * Takes constraints and a transformation mapping, applies the transformation
   * to create new constraint rules. Applies both forward and inverse mappings
   * iteratively until all reachable dimensions are filled.
   *
   * @param constraints - Base constraints
   * @param transform - Symmetry transformation to apply
   * @returns New constraints with transformation applied
   */
  public static applyTransform(
    constraints: ConstraintRules,
    transform: SymmetryTransform
  ): ConstraintRules {
    const result: ConstraintRules = {};

    // Copy existing constraints
    for (const [state, rules] of Object.entries(constraints)) {
      result[state] = {...rules};
    }

    // Create inverse mapping
    const inverseMapping: {[dimension: Dimension]: Dimension} = {};
    for (const [from, to] of Object.entries(transform.mapping)) {
      inverseMapping[to] = from;
    }

    // Apply transformation iteratively until no more changes
    let changed = true;
    let iterations = 0;
    const maxIterations = 20; // Safety limit

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const [state, rules] of Object.entries(result)) {
        // Take a snapshot to avoid seeing mid-iteration modifications
        const currentRules = {...rules};

        // Apply forward mapping: fromDim -> toDim
        for (const [fromDim, toDim] of Object.entries(transform.mapping)) {
          if (currentRules[fromDim] && !currentRules[toDim] && result[state]) {
            result[state][toDim] = currentRules[fromDim];
            changed = true;
          }
        }

        // Apply inverse mapping: toDim <- fromDim
        for (const [toDim, fromDim] of Object.entries(inverseMapping)) {
          if (currentRules[toDim] && !currentRules[fromDim] && result[state]) {
            result[state][fromDim] = currentRules[toDim];
            changed = true;
          }
        }
      }
    }

    return result;
  }

  /**
   * Apply multiple transformations in sequence
   *
   * Useful for generating all rotations/reflections from a base set.
   *
   * @param constraints - Base constraints
   * @param transforms - Array of transformations to apply
   * @returns Constraints with all transformations applied
   */
  public static applyTransforms(
    constraints: ConstraintRules,
    transforms: SymmetryTransform[]
  ): ConstraintRules {
    let result = constraints;

    for (const transform of transforms) {
      result = this.applyTransform(result, transform);
    }

    return result;
  }

  /**
   * Apply all rotations for a topology
   *
   * For 2D grids: applies 90°, 180°, 270° rotations
   * For hex grids: applies 60°, 120°, 180°, 240°, 300° rotations
   *
   * @param constraints - Base constraints
   * @param topology - Topology type ('grid2D', 'hex', etc.) or custom transforms
   * @returns Constraints with all rotations applied
   */
  public static applyAllRotations(
    constraints: ConstraintRules,
    topology: 'grid2D' | 'hex' | SymmetryTransform[]
  ): ConstraintRules {
    let transforms: SymmetryTransform[];

    if (topology === 'grid2D') {
      transforms = [
        SYMMETRY_PRESETS.grid2D.rotate90,
        SYMMETRY_PRESETS.grid2D.rotate180,
        SYMMETRY_PRESETS.grid2D.rotate270,
      ];
    } else if (topology === 'hex') {
      // For hex, we need to apply rotate60 five times to get all 6 rotations
      const rotate60 = SYMMETRY_PRESETS.hex.rotate60;
      transforms = [rotate60];

      // Generate remaining rotations by composing
      for (let i = 0; i < 4; i++) {
        const prev = transforms[transforms.length - 1];
        if (prev) {
          const composed = this.composeTransforms(prev, rotate60);
          transforms.push(composed);
        }
      }
    } else {
      // Custom transforms
      transforms = topology;
    }

    return this.applyTransforms(constraints, transforms);
  }

  /**
   * Apply all reflections for a topology
   *
   * @param constraints - Base constraints
   * @param topology - Topology type or custom transforms
   * @returns Constraints with all reflections applied
   */
  public static applyAllReflections(
    constraints: ConstraintRules,
    topology: 'grid2D' | 'hex' | SymmetryTransform[]
  ): ConstraintRules {
    let transforms: SymmetryTransform[];

    if (topology === 'grid2D') {
      transforms = [
        SYMMETRY_PRESETS.grid2D.reflectHorizontal,
        SYMMETRY_PRESETS.grid2D.reflectVertical,
      ];
    } else if (topology === 'hex') {
      transforms = [
        SYMMETRY_PRESETS.hex.reflectVertical,
      ];
    } else {
      transforms = topology;
    }

    return this.applyTransforms(constraints, transforms);
  }

  /**
   * Apply full symmetry (rotations + reflections)
   *
   * @param constraints - Base constraints
   * @param topology - Topology type or config
   * @param config - Optional symmetry configuration
   * @returns Fully symmetric constraints
   */
  public static applyFullSymmetry(
    constraints: ConstraintRules,
    topology: 'grid2D' | 'hex' | {rotations: SymmetryTransform[], reflections: SymmetryTransform[]},
    config?: SymmetryConfig
  ): ConstraintRules {
    let result = constraints;

    // Determine what to apply based on config
    const applyRotations = !config || config.rotational !== false;
    const applyReflections = !config || config.reflective !== false;

    if (typeof topology === 'string') {
      if (applyRotations) {
        result = this.applyAllRotations(result, topology);
      }
      if (applyReflections) {
        result = this.applyAllReflections(result, topology);
      }
    } else {
      // Custom topology
      if (applyRotations && topology.rotations) {
        result = this.applyTransforms(result, topology.rotations);
      }
      if (applyReflections && topology.reflections) {
        result = this.applyTransforms(result, topology.reflections);
      }
    }

    return result;
  }

  /**
   * Compose two transformations
   *
   * Creates a new transformation that applies b after a.
   *
   * @param a - First transformation
   * @param b - Second transformation
   * @returns Composed transformation
   */
  public static composeTransforms(
    a: SymmetryTransform,
    b: SymmetryTransform
  ): SymmetryTransform {
    const mapping: {[dimension: Dimension]: Dimension} = {};

    for (const [dim, aDest] of Object.entries(a.mapping)) {
      // Apply a, then apply b to the result
      const bDest = b.mapping[aDest];
      mapping[dim] = bDest || aDest;
    }

    return {
      name: `${a.name}_then_${b.name}`,
      mapping,
    };
  }

  /**
   * Check if constraints have a specific symmetry
   *
   * @param constraints - Constraints to check
   * @param transform - Transformation to check for
   * @returns True if constraints are symmetric under this transformation
   */
  public static hasSymmetry(
    constraints: ConstraintRules,
    transform: SymmetryTransform
  ): boolean {
    for (const [_state, rules] of Object.entries(constraints)) {
      for (const [fromDim, toDim] of Object.entries(transform.mapping)) {
        const fromStates = this.normalizeConstraint(rules[fromDim]);
        const toStates = this.normalizeConstraint(rules[toDim]);

        if (!this.arraysEqual(fromStates, toStates)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Normalize a constraint to an array of states (handles Distribution)
   */
  private static normalizeConstraint(
    constraint: State[] | Distribution<State> | undefined
  ): State[] {
    if (!constraint) return [];
    if (Array.isArray(constraint)) return [...constraint].sort();

    // It's a Distribution - extract states from normal
    const dist = constraint as Distribution<State>;
    const states = Object.keys(dist.normal || {});
    return states.sort();
  }

  /**
   * Check if two arrays are equal (order-independent)
   */
  private static arraysEqual(a: State[], b: State[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }
}
