/*
 # wfc-grid2d.ts
 # Wave Function Collapse 2D Grid Adapter
 */

/**
 * 2D Grid adapter for Wave Function Collapse.
 *
 * This adapter converts 2D grids to WFCGraph format and back,
 * providing a convenient interface for the most common WFC use case.
 *
 * Design principles:
 * - Cardinal directions: north, south, east, west
 * - Row-major indexing: (x, y) -> y * width + x
 * - Boundary handling via WFC options
 * - Easy conversion to/from 2D arrays
 */

import {WFC} from './wfc';
import type {
  State,
  WFCGraph,
  WFCCell,
  WFCResult,
  WFCGenerateOptions,
  CellId,
  Adjacency,
} from './wfc-types';

/**
 * Options for creating a 2D grid
 */
export interface Grid2DOptions {
  /** Grid width (columns) */
  width: number;

  /** Grid height (rows) */
  height: number;

  /** WFC instance to use for generation */
  wfc: WFC;
}

/**
 * 2D Grid adapter for WFC
 *
 * Provides convenient methods for generating 2D grids using WFC.
 */
export class WFCGrid2D {
  private readonly _width: number;
  private readonly _height: number;
  private readonly _wfc: WFC;

  /**
   * Create a new 2D grid adapter
   */
  constructor(options: Grid2DOptions) {
    if (options.width <= 0 || options.height <= 0) {
      throw new Error('Grid dimensions must be positive');
    }

    this._width = options.width;
    this._height = options.height;
    this._wfc = options.wfc;
  }

  /**
   * Generate a 2D grid using WFC
   *
   * @param options - Optional generation-time options
   * @returns 2D array of states or null if contradiction
   */
  public generate(options?: WFCGenerateOptions): State[][] | null {
    // Create graph
    const graph = this.createGraph();

    // Collapse
    const result = this._wfc.collapse(graph, options);

    // Convert to 2D array
    if (result.success) {
      return this.graphTo2DArray(result.graph);
    }

    return null;
  }

  /**
   * Generate with full result information
   *
   * @param options - Optional generation-time options
   * @returns WFC result with metadata
   */
  public generateWithResult(options?: WFCGenerateOptions): WFCResult & {
    grid: State[][] | null;
  } {
    const graph = this.createGraph();
    const result = this._wfc.collapse(graph, options);

    return {
      ...result,
      grid: result.success ? this.graphTo2DArray(result.graph) : null,
    };
  }

  /**
   * Create a WFCGraph for this 2D grid
   */
  private createGraph(): WFCGraph {
    const cells = new Map<CellId, WFCCell>();

    // Create cells
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        const id = this.coordsToId(x, y);
        cells.set(id, {
          id,
          possibleStates: new Set(), // Will be initialized by WFC
          collapsed: false,
        });
      }
    }

    // Define neighbor function
    const getNeighbors = (cellId: CellId): Adjacency[] => {
      const [x, y] = this.idToCoords(cellId as number);
      const neighbors: Adjacency[] = [];

      // North
      if (y > 0) {
        neighbors.push({
          neighbor: this.coordsToId(x, y - 1),
          dimension: 'north',
        });
      }

      // South
      if (y < this._height - 1) {
        neighbors.push({
          neighbor: this.coordsToId(x, y + 1),
          dimension: 'south',
        });
      }

      // East
      if (x < this._width - 1) {
        neighbors.push({
          neighbor: this.coordsToId(x + 1, y),
          dimension: 'east',
        });
      }

      // West
      if (x > 0) {
        neighbors.push({
          neighbor: this.coordsToId(x - 1, y),
          dimension: 'west',
        });
      }

      return neighbors;
    };

    return {cells, getNeighbors};
  }

  /**
   * Convert graph back to 2D array
   */
  private graphTo2DArray(graph: WFCGraph): State[][] {
    const grid: State[][] = [];

    for (let y = 0; y < this._height; y++) {
      const row: State[] = [];
      for (let x = 0; x < this._width; x++) {
        const id = this.coordsToId(x, y);
        const cell = graph.cells.get(id);

        if (!cell || !cell.collapsed || !cell.collapsedState) {
          throw new Error(
            `Cell at (${x}, ${y}) is not collapsed or has no state`
          );
        }

        row.push(cell.collapsedState);
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Convert (x, y) coordinates to cell ID
   */
  private coordsToId(x: number, y: number): number {
    return y * this._width + x;
  }

  /**
   * Convert cell ID to (x, y) coordinates
   */
  private idToCoords(id: number): [number, number] {
    const x = id % this._width;
    const y = Math.floor(id / this._width);
    return [x, y];
  }

  /**
   * Accessors
   */

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get wfc(): WFC {
    return this._wfc;
  }
}
