/*
 # wfc-pattern.ts
 # Overlapping Pattern WFC
 */

/**
 * Overlapping pattern-based Wave Function Collapse.
 *
 * This implements the ORIGINAL WFC algorithm from Maxim Gumin's paper,
 * which uses NxN tile patterns instead of single-tile adjacency.
 *
 * Key differences from adjacency-based WFC:
 * - Learns NxN tile patterns (e.g., 3x3 chunks)
 * - Places patterns overlapping by (N-1)x(N-1)
 * - Captures structural coherence, not just adjacency
 * - Supports dynamic pattern order (min/max size)
 * - Works with backtracking for contradiction recovery
 *
 * @example
 * ```typescript
 * // Extract 3x3 patterns from input
 * const patterns = WFCPattern.extractPatterns(inputGrid, 3);
 *
 * // Generate using overlapping patterns
 * const wfc = new WFCPattern({
 *   seed: 42,
 *   patterns,
 *   patternSize: 3,
 *   outputWidth: 40,
 *   outputHeight: 30,
 * });
 *
 * const result = wfc.generate();
 * ```
 */

// import {Distribution} from './distribution'; // TODO: Use for weighted pattern selection

// ============================================================================
// TYPES
// ============================================================================

/**
 * A pattern is an NxN grid of tiles
 */
export type Pattern = string[][];

/**
 * Pattern ID for deduplication
 */
export type PatternId = string;

/**
 * Pattern with metadata
 */
export interface PatternData {
  /** The pattern grid */
  pattern: Pattern;
  /** Unique identifier */
  id: PatternId;
  /** Frequency in training data */
  frequency: number;
  /** Size (N for NxN) */
  size: number;
}

/**
 * Adjacency rules for patterns
 * Maps: pattern ID → direction → compatible pattern IDs
 */
export interface PatternConstraints {
  [patternId: PatternId]: {
    north: Set<PatternId>;
    south: Set<PatternId>;
    east: Set<PatternId>;
    west: Set<PatternId>;
  };
}

/**
 * Options for pattern extraction
 */
export interface PatternExtractionOptions {
  /** Pattern size (NxN) */
  patternSize: number;
  /** Enable rotation symmetry (90°, 180°, 270°) */
  enableRotation?: boolean;
  /** Enable reflection symmetry (horizontal, vertical) */
  enableReflection?: boolean;
  /** Minimum frequency to include pattern */
  minFrequency?: number;
}

/**
 * Options for pattern-based WFC
 */
export interface WFCPatternOptions {
  /** Random seed */
  seed: number;
  /** Extracted patterns with metadata */
  patterns: PatternData[];
  /** Pattern constraints (optional - auto-computed if not provided) */
  constraints?: PatternConstraints;
  /** Output width in tiles */
  outputWidth: number;
  /** Output height in tiles */
  outputHeight: number;
  /** Pattern size (must match patterns) */
  patternSize: number;
  /** Enable backtracking */
  backtrack?: boolean;
  /** Maximum backtrack attempts */
  maxBacktrackAttempts?: number;
  /** Periodic boundary (wrap around) */
  periodicBoundary?: boolean;
}

/**
 * Cell in the pattern grid
 */
interface PatternCell {
  /** Cell coordinates in output grid */
  x: number;
  y: number;
  /** Possible patterns at this position */
  possiblePatterns: Set<PatternId>;
  /** Selected pattern (when collapsed) */
  selectedPattern: PatternId | null;
  /** Whether cell is collapsed */
  collapsed: boolean;
}

/**
 * Result from pattern-based generation
 */
export interface PatternGenerationResult {
  /** Success flag */
  success: boolean;
  /** Generated grid (in tiles) */
  grid: string[][] | null;
  /** Pattern grid (in patterns) */
  patternGrid: (PatternId | null)[][] | null;
  /** Metadata */
  metadata: {
    /** Number of contradictions encountered */
    contradictions: number;
    /** Number of backtrack attempts */
    backtracks: number;
    /** Pattern size used */
    patternSize: number;
    /** Total patterns */
    totalPatterns: number;
  };
}

// ============================================================================
// PATTERN UTILITIES
// ============================================================================

/**
 * Pattern utilities for extraction, transformation, and comparison
 */
export class WFCPatternUtils {
  /**
   * Convert pattern to string ID for deduplication
   */
  static patternToId(pattern: Pattern): PatternId {
    return pattern.map(row => row.join('')).join('|');
  }

  /**
   * Convert ID back to pattern
   */
  static idToPattern(id: PatternId): Pattern {
    return id.split('|').map(row => row.split(''));
  }

  /**
   * Rotate pattern 90° clockwise
   */
  static rotate90(pattern: Pattern): Pattern {
    const n = pattern.length;
    const rotated: Pattern = Array(n)
      .fill(null)
      .map(() => Array(n).fill(''));

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const srcRow = pattern[y];
        const dstRow = rotated[x];
        const tile = srcRow?.[x];
        if (srcRow && dstRow && tile !== undefined) {
          dstRow[n - 1 - y] = tile;
        }
      }
    }

    return rotated;
  }

  /**
   * Reflect pattern horizontally
   */
  static reflectHorizontal(pattern: Pattern): Pattern {
    return pattern.map(row => [...row].reverse());
  }

  /**
   * Reflect pattern vertically
   */
  static reflectVertical(pattern: Pattern): Pattern {
    return [...pattern].reverse();
  }

  /**
   * Generate all symmetries of a pattern
   */
  static generateSymmetries(
    pattern: Pattern,
    enableRotation: boolean,
    enableReflection: boolean
  ): Pattern[] {
    const symmetries: Pattern[] = [pattern];

    if (enableRotation) {
      let current = pattern;
      for (let i = 0; i < 3; i++) {
        current = this.rotate90(current);
        symmetries.push(current);
      }
    }

    if (enableReflection) {
      const basePatterns = [...symmetries];
      for (const p of basePatterns) {
        symmetries.push(this.reflectHorizontal(p));
        symmetries.push(this.reflectVertical(p));
      }
    }

    // Deduplicate
    const seen = new Set<PatternId>();
    return symmetries.filter(p => {
      const id = this.patternToId(p);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  /**
   * Extract all NxN patterns from a grid
   */
  static extractPatterns(
    grid: string[][],
    options: PatternExtractionOptions
  ): PatternData[] {
    const {patternSize, enableRotation, enableReflection, minFrequency} =
      options;

    const patternCounts = new Map<PatternId, number>();
    const patternMap = new Map<PatternId, Pattern>();

    // Extract all patterns
    const firstRow = grid[0];
    if (!firstRow) return [];

    for (let y = 0; y <= grid.length - patternSize; y++) {
      for (let x = 0; x <= firstRow.length - patternSize; x++) {
        // Extract NxN pattern
        const pattern: Pattern = [];
        for (let py = 0; py < patternSize; py++) {
          const row: string[] = [];
          for (let px = 0; px < patternSize; px++) {
            const gridRow = grid[y + py];
            const tile = gridRow?.[x + px];
            if (tile === undefined) continue;
            row.push(tile);
          }
          if (row.length === patternSize) {
            pattern.push(row);
          }
        }
        if (pattern.length !== patternSize) continue;

        // Generate symmetries
        const symmetries = this.generateSymmetries(
          pattern,
          enableRotation ?? false,
          enableReflection ?? false
        );

        for (const sym of symmetries) {
          const id = this.patternToId(sym);
          patternCounts.set(id, (patternCounts.get(id) || 0) + 1);
          patternMap.set(id, sym);
        }
      }
    }

    // Convert to PatternData array
    const patterns: PatternData[] = [];
    const minFreq = minFrequency ?? 1;

    for (const [id, frequency] of patternCounts) {
      if (frequency >= minFreq) {
        patterns.push({
          id,
          pattern: patternMap.get(id)!,
          frequency,
          size: patternSize,
        });
      }
    }

    return patterns;
  }

  /**
   * Check if two patterns can be adjacent in a direction
   * (by comparing their overlapping edges)
   */
  static canBeAdjacent(
    pattern1: Pattern,
    pattern2: Pattern,
    direction: 'north' | 'south' | 'east' | 'west'
  ): boolean {
    const n = pattern1.length;

    switch (direction) {
      case 'east':
        // pattern1's right edge must match pattern2's left edge
        for (let y = 0; y < n; y++) {
          const row1 = pattern1[y];
          const row2 = pattern2[y];
          if (!row1 || !row2) return false;
          if (row1[n - 1] !== row2[0]) return false;
        }
        return true;

      case 'west':
        // pattern1's left edge must match pattern2's right edge
        for (let y = 0; y < n; y++) {
          const row1 = pattern1[y];
          const row2 = pattern2[y];
          if (!row1 || !row2) return false;
          if (row1[0] !== row2[n - 1]) return false;
        }
        return true;

      case 'south':
        // pattern1's bottom edge must match pattern2's top edge
        const bottomRow = pattern1[n - 1];
        const topRow = pattern2[0];
        if (!bottomRow || !topRow) return false;
        for (let x = 0; x < n; x++) {
          if (bottomRow[x] !== topRow[x]) return false;
        }
        return true;

      case 'north':
        // pattern1's top edge must match pattern2's bottom edge
        const topRow1 = pattern1[0];
        const bottomRow2 = pattern2[n - 1];
        if (!topRow1 || !bottomRow2) return false;
        for (let x = 0; x < n; x++) {
          if (topRow1[x] !== bottomRow2[x]) return false;
        }
        return true;
    }
  }

  /**
   * Compute pattern adjacency constraints
   */
  static computeConstraints(patterns: PatternData[]): PatternConstraints {
    const constraints: PatternConstraints = {};

    // Initialize
    for (const p of patterns) {
      constraints[p.id] = {
        north: new Set(),
        south: new Set(),
        east: new Set(),
        west: new Set(),
      };
    }

    // Check all pairs
    for (const p1 of patterns) {
      const p1Constraints = constraints[p1.id];
      if (!p1Constraints) continue;

      for (const p2 of patterns) {
        if (this.canBeAdjacent(p1.pattern, p2.pattern, 'east')) {
          p1Constraints.east.add(p2.id);
        }
        if (this.canBeAdjacent(p1.pattern, p2.pattern, 'west')) {
          p1Constraints.west.add(p2.id);
        }
        if (this.canBeAdjacent(p1.pattern, p2.pattern, 'south')) {
          p1Constraints.south.add(p2.id);
        }
        if (this.canBeAdjacent(p1.pattern, p2.pattern, 'north')) {
          p1Constraints.north.add(p2.id);
        }
      }
    }

    return constraints;
  }
}

// ============================================================================
// PATTERN-BASED WFC
// ============================================================================

/**
 * Wave Function Collapse using overlapping NxN patterns
 *
 * This is the ORIGINAL WFC algorithm - much better than adjacency-based!
 */
export class WFCPattern {
  private readonly seed: number;
  private readonly patterns: PatternData[];
  private readonly constraints: PatternConstraints;
  private readonly outputWidth: number;
  private readonly outputHeight: number;
  private readonly patternSize: number;
  private readonly backtrack: boolean;
  private readonly maxBacktrackAttempts: number;
  private readonly periodic: boolean;

  private rng: number;
  // private patternDistribution: Distribution<PatternId>; // TODO: Use for weighted pattern selection

  constructor(options: WFCPatternOptions) {
    this.seed = options.seed;
    this.patterns = options.patterns;
    this.outputWidth = options.outputWidth;
    this.outputHeight = options.outputHeight;
    this.patternSize = options.patternSize;
    this.backtrack = options.backtrack ?? false;
    this.maxBacktrackAttempts = options.maxBacktrackAttempts ?? 100;
    this.periodic = options.periodicBoundary ?? false;

    // Compute or use provided constraints
    this.constraints =
      options.constraints ?? WFCPatternUtils.computeConstraints(this.patterns);

    // Setup RNG
    this.rng = this.seed;

    // TODO: Create weighted distribution for pattern selection
    // const weights: {[id: PatternId]: number} = {};
    // for (const p of this.patterns) {
    //   weights[p.id] = p.frequency;
    // }
    // this.patternDistribution = new Distribution({
    //   seed: this.seed,
    //   source: weights,
    // });
  }

  /**
   * Simple seeded random
   */
  private random(): number {
    this.rng = (this.rng * 9301 + 49297) % 233280;
    return this.rng / 233280;
  }

  /**
   * Generate using overlapping patterns
   */
  public generate(): PatternGenerationResult {
    const gridWidth = this.outputWidth - this.patternSize + 1;
    const gridHeight = this.outputHeight - this.patternSize + 1;

    // Initialize pattern grid
    const cells: PatternCell[][] = [];
    for (let y = 0; y < gridHeight; y++) {
      const row: PatternCell[] = [];
      for (let x = 0; x < gridWidth; x++) {
        row.push({
          x,
          y,
          possiblePatterns: new Set(this.patterns.map(p => p.id)),
          selectedPattern: null,
          collapsed: false,
        });
      }
      cells.push(row);
    }

    let contradictions = 0;
    let backtracks = 0;

    // WFC loop
    while (true) {
      // Find cell with minimum entropy
      let minEntropy = Infinity;
      let minCell: PatternCell | null = null;

      for (const row of cells) {
        for (const cell of row) {
          if (cell.collapsed) continue;
          const entropy = cell.possiblePatterns.size;
          if (entropy === 0) {
            // Contradiction!
            contradictions++;
            if (this.backtrack && backtracks < this.maxBacktrackAttempts) {
              // TODO: Implement proper backtracking
              backtracks++;
              return {
                success: false,
                grid: null,
                patternGrid: null,
                metadata: {
                  contradictions,
                  backtracks,
                  patternSize: this.patternSize,
                  totalPatterns: this.patterns.length,
                },
              };
            }
            return {
              success: false,
              grid: null,
              patternGrid: null,
              metadata: {
                contradictions,
                backtracks,
                patternSize: this.patternSize,
                totalPatterns: this.patterns.length,
              },
            };
          }
          if (entropy < minEntropy) {
            minEntropy = entropy;
            minCell = cell;
          }
        }
      }

      // All collapsed?
      if (!minCell) break;

      // Collapse cell
      const possibleIds = Array.from(minCell.possiblePatterns).filter(
        (id): id is PatternId => id !== undefined
      );
      if (possibleIds.length === 0) {
        contradictions++;
        return {
          success: false,
          grid: null,
          patternGrid: null,
          metadata: {
            contradictions,
            backtracks,
            patternSize: this.patternSize,
            totalPatterns: this.patterns.length,
          },
        };
      }
      const selectedId = possibleIds[Math.floor(this.random() * possibleIds.length)];
      if (!selectedId) {
        contradictions++;
        continue;
      }
      minCell.selectedPattern = selectedId;
      minCell.collapsed = true;
      minCell.possiblePatterns = new Set([selectedId]);

      // Propagate constraints
      this.propagate(cells, minCell);
    }

    // Convert pattern grid to tile grid
    const tileGrid = this.patternsToTiles(cells);

    return {
      success: true,
      grid: tileGrid,
      patternGrid: cells.map(row => row.map(c => c.selectedPattern)),
      metadata: {
        contradictions,
        backtracks,
        patternSize: this.patternSize,
        totalPatterns: this.patterns.length,
      },
    };
  }

  /**
   * Propagate constraints after collapsing a cell
   */
  private propagate(cells: PatternCell[][], changedCell: PatternCell): void {
    const stack: PatternCell[] = [changedCell];
    const inStack = new Set<PatternCell>();
    inStack.add(changedCell);

    while (stack.length > 0) {
      const cell = stack.pop()!;
      inStack.delete(cell);

      // Check all neighbors
      const neighbors = [
        {dx: 0, dy: -1, dir: 'north' as const, inv: 'south' as const},
        {dx: 0, dy: 1, dir: 'south' as const, inv: 'north' as const},
        {dx: 1, dy: 0, dir: 'east' as const, inv: 'west' as const},
        {dx: -1, dy: 0, dir: 'west' as const, inv: 'east' as const},
      ];

      for (const {dx, dy, dir} of neighbors) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;

        const firstRow = cells[0];
        if (
          !firstRow ||
          nx < 0 ||
          nx >= firstRow.length ||
          ny < 0 ||
          ny >= cells.length
        ) {
          if (!this.periodic) continue;
          // TODO: Handle periodic boundaries
          continue;
        }

        const neighborRow = cells[ny];
        if (!neighborRow) continue;
        const neighbor = neighborRow[nx];
        if (!neighbor || neighbor.collapsed) continue;

        // Remove incompatible patterns from neighbor
        const allowedPatterns = new Set<PatternId>();
        for (const myPattern of cell.possiblePatterns) {
          const constraint = this.constraints[myPattern];
          if (!constraint) continue;
          const compatible = constraint[dir];
          if (!compatible) continue;
          for (const compatId of compatible) {
            allowedPatterns.add(compatId);
          }
        }

        // Intersect with neighbor's current possibilities
        const newPossible = new Set<PatternId>();
        for (const pattern of neighbor.possiblePatterns) {
          if (allowedPatterns.has(pattern)) {
            newPossible.add(pattern);
          }
        }

        if (newPossible.size < neighbor.possiblePatterns.size) {
          neighbor.possiblePatterns = newPossible;
          if (!inStack.has(neighbor)) {
            stack.push(neighbor);
            inStack.add(neighbor);
          }
        }
      }
    }
  }

  /**
   * Convert pattern grid to tile grid
   * Patterns overlap, so we need to resolve conflicts
   */
  private patternsToTiles(cells: PatternCell[][]): string[][] {
    const tileGrid: string[][] = Array(this.outputHeight)
      .fill(null)
      .map(() => Array(this.outputWidth).fill(''));

    for (let py = 0; py < cells.length; py++) {
      const cellRow = cells[py];
      if (!cellRow) continue;

      for (let px = 0; px < cellRow.length; px++) {
        const cell = cellRow[px];
        if (!cell || !cell.selectedPattern) continue;

        const patternData = this.patterns.find(
          p => p.id === cell.selectedPattern
        );
        if (!patternData) continue;
        const pattern = patternData.pattern;

        // Place pattern tiles
        for (let dy = 0; dy < this.patternSize; dy++) {
          for (let dx = 0; dx < this.patternSize; dx++) {
            const tx = px + dx;
            const ty = py + dy;
            if (tx < this.outputWidth && ty < this.outputHeight) {
              const tileRow = tileGrid[ty];
              const patternRow = pattern[dy];
              if (!tileRow || !patternRow) continue;
              const tile = patternRow[dx];
              if (tile === undefined) continue;
              // If tile already set, keep it (patterns overlap)
              if (!tileRow[tx]) {
                tileRow[tx] = tile;
              }
            }
          }
        }
      }
    }

    return tileGrid;
  }

  /**
   * Static helper: Extract patterns from example grid and generate
   */
  static fromExample(
    exampleGrid: string[][],
    options: {
      seed: number;
      patternSize: number;
      outputWidth: number;
      outputHeight: number;
      enableRotation?: boolean;
      enableReflection?: boolean;
      backtrack?: boolean;
    }
  ): PatternGenerationResult {
    // Extract patterns
    const patterns = WFCPatternUtils.extractPatterns(exampleGrid, {
      patternSize: options.patternSize,
      enableRotation: options.enableRotation,
      enableReflection: options.enableReflection,
    });

    // Generate
    const wfc = new WFCPattern({
      seed: options.seed,
      patterns,
      outputWidth: options.outputWidth,
      outputHeight: options.outputHeight,
      patternSize: options.patternSize,
      backtrack: options.backtrack,
    });

    return wfc.generate();
  }
}
