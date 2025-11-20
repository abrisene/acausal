# Wave Function Collapse - Architecture Design

This document outlines the architecture for implementing Wave Function Collapse (WFC) as a first-class primitive in acausal, following the library's design philosophy of composable, topology-agnostic primitives.

## Core Design Principles

### 1. Separation of Algorithm and Topology
The core WFC algorithm should be **completely independent** of spatial structure. It operates on abstract graphs where:
- **Nodes** represent cells/tiles/states to be determined
- **Edges** represent adjacency relationships with typed dimensions
- **Constraints** define which states can be adjacent along each dimension

This allows WFC to work on:
- 2D rectangular grids
- 3D voxel grids
- Hex grids
- Voronoi/irregular tessellations
- Graph-based structures (dialogue trees, state machines)
- Custom topologies

### 2. Composability with Existing Primitives
WFC should integrate naturally with Distribution and MarkovChain:
- Use **Distribution** for weighted tile selection when multiple options are valid
- Use **MarkovChain** to learn adjacency patterns from example data
- Support hybrid approaches combining statistical and constraint-based generation

### 3. Immutability and Portability
All WFC models must be:
- Serializable to JSON for storage/transfer
- Deterministic given the same seed
- Immutable (operations return new instances)
- Buildable from DTOs (data transfer objects)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     WFC Core Algorithm                       │
│  (Topology-agnostic collapse with constraint propagation)   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Uses
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Constraint System                         │
│  (Defines valid adjacencies between states per dimension)   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Uses
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Distribution (existing)                   │
│       (Weighted random selection of states/tiles)           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Topology Adapters                         │
│   Grid2D | Grid3D | Hex | Voronoi | Custom Graph           │
│  (Convert spatial structures to graph representation)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Provides to
                              │
                         WFC Algorithm
```

## Core Types

```typescript
/**
 * A dimension represents a type of adjacency relationship.
 * Examples:
 * - 2D Grid: 'north', 'south', 'east', 'west'
 * - 3D Grid: 'north', 'south', 'east', 'west', 'up', 'down'
 * - Hex: 'ne', 'e', 'se', 'sw', 'w', 'nw'
 * - Graph: 'next', 'prev', 'child', 'parent', etc.
 */
type Dimension = string;

/**
 * A state represents a possible value for a cell.
 * Generic to support any type (strings, objects, etc.)
 */
type State = string;

/**
 * Constraint rules define which states can be adjacent.
 * Organized by: sourceState -> dimension -> allowedStates
 */
interface ConstraintRules {
  [sourceState: State]: {
    [dimension: Dimension]: State[] | Distribution<State>;
  };
}

/**
 * A cell in the WFC graph with its possible states.
 */
interface WFCCell {
  id: string | number;
  possibleStates: Set<State>;
  collapsed: boolean;
  collapsedState?: State;
}

/**
 * Adjacency information for a cell.
 */
interface Adjacency {
  neighbor: string | number; // ID of neighbor cell
  dimension: Dimension;       // Which direction/relationship
}

/**
 * Graph structure defining the topology.
 * This is provided by topology adapters.
 */
interface WFCGraph {
  cells: Map<string | number, WFCCell>;
  getNeighbors: (cellId: string | number) => Adjacency[];
}

/**
 * Core WFC configuration.
 */
interface WFCOptions extends RandomDTO {
  states: State[];
  constraints: ConstraintRules;
  frequencies?: { [state: State]: number }; // For weighted selection
  backtrack?: boolean; // Enable backtracking on contradiction
}

/**
 * WFC serialization format.
 */
interface WFCDTO extends WFCOptions {
  // Inherits all options for portability
}
```

## Core Algorithm Implementation

### Phase 1: Initialization
```typescript
class WFC {
  private constraints: ConstraintRules;
  private frequencies: Distribution<State>;
  private engine: Random;

  constructor(options: WFCOptions) {
    // Store constraints
    this.constraints = options.constraints;

    // Create distribution for weighted selection
    this.frequencies = new Distribution({
      seed: options.seed,
      source: options.frequencies || this.uniformFrequencies(options.states)
    });

    this.engine = options.engine || new Random({ seed: options.seed });
  }

  /**
   * Initialize all cells with all possible states.
   */
  private initialize(graph: WFCGraph): void {
    for (const [id, cell] of graph.cells) {
      cell.possibleStates = new Set(this.frequencies.keys());
      cell.collapsed = false;
    }
  }
```

### Phase 2: Observation (Collapse)
```typescript
  /**
   * Find the cell with minimum entropy (fewest possible states).
   * Returns null if all cells are collapsed or contradiction found.
   */
  private findMinEntropyCell(graph: WFCGraph): WFCCell | null {
    let minEntropy = Infinity;
    let minCell: WFCCell | null = null;

    for (const cell of graph.cells.values()) {
      if (cell.collapsed) continue;

      const entropy = cell.possibleStates.size;
      if (entropy === 0) {
        // Contradiction - no valid states
        return null;
      }

      if (entropy < minEntropy) {
        minEntropy = entropy;
        minCell = cell;
      }
    }

    return minCell;
  }

  /**
   * Collapse a cell to a single state.
   * Use Distribution for weighted random selection.
   */
  private collapseCell(cell: WFCCell): void {
    // Create temporary distribution from possible states
    const possibleDist = this.frequencies.filter(
      state => cell.possibleStates.has(state)
    );

    // Pick weighted random state
    cell.collapsedState = possibleDist.pick();
    cell.possibleStates = new Set([cell.collapsedState]);
    cell.collapsed = true;
  }
```

### Phase 3: Propagation (Constraint Satisfaction)
```typescript
  /**
   * Propagate constraints from a collapsed cell to neighbors.
   * Returns false if contradiction detected.
   */
  private propagate(
    cellId: string | number,
    graph: WFCGraph
  ): boolean {
    const queue: Array<string | number> = [cellId];
    const visited = new Set<string | number>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = graph.cells.get(currentId)!;
      const neighbors = graph.getNeighbors(currentId);

      for (const { neighbor: neighborId, dimension } of neighbors) {
        const neighbor = graph.cells.get(neighborId)!;
        if (neighbor.collapsed) continue;

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
   * Get all states allowed adjacent to any of the given states
   * in the specified dimension.
   */
  private getAllowedStates(
    states: Set<State>,
    dimension: Dimension
  ): Set<State> {
    const allowed = new Set<State>();

    for (const state of states) {
      const rules = this.constraints[state]?.[dimension];
      if (!rules) continue;

      // Rules can be array or Distribution
      const allowedForState = Array.isArray(rules)
        ? rules
        : rules.keys();

      for (const s of allowedForState) {
        allowed.add(s);
      }
    }

    return allowed;
  }
```

### Phase 4: Main Loop
```typescript
  /**
   * Run WFC algorithm on a graph until complete or contradiction.
   */
  collapse(graph: WFCGraph): WFCResult {
    this.initialize(graph);

    while (true) {
      // Find cell with minimum entropy
      const cell = this.findMinEntropyCell(graph);

      if (cell === null) {
        // Check if done or contradiction
        const allCollapsed = [...graph.cells.values()].every(c => c.collapsed);
        return {
          success: allCollapsed,
          graph,
          contradiction: !allCollapsed
        };
      }

      // Collapse the cell
      this.collapseCell(cell);

      // Propagate constraints
      const success = this.propagate(cell.id, graph);

      if (!success) {
        // Contradiction - would need backtracking here
        return {
          success: false,
          graph,
          contradiction: true
        };
      }
    }
  }
}
```

## Topology Adapters

Adapters convert spatial structures to WFCGraph format.

### 2D Grid Adapter
```typescript
class WFCGrid2D {
  private width: number;
  private height: number;
  private wfc: WFC;

  constructor(options: { width: number; height: number; wfc: WFC }) {
    this.width = options.width;
    this.height = options.height;
    this.wfc = options.wfc;
  }

  /**
   * Create graph from 2D grid structure.
   */
  private createGraph(): WFCGraph {
    const cells = new Map<number, WFCCell>();

    // Create cells
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const id = y * this.width + x;
        cells.set(id, {
          id,
          possibleStates: new Set(),
          collapsed: false
        });
      }
    }

    // Define neighbor function
    const getNeighbors = (cellId: number): Adjacency[] => {
      const x = cellId % this.width;
      const y = Math.floor(cellId / this.width);
      const neighbors: Adjacency[] = [];

      // North
      if (y > 0) {
        neighbors.push({
          neighbor: (y - 1) * this.width + x,
          dimension: 'north'
        });
      }

      // South
      if (y < this.height - 1) {
        neighbors.push({
          neighbor: (y + 1) * this.width + x,
          dimension: 'south'
        });
      }

      // East
      if (x < this.width - 1) {
        neighbors.push({
          neighbor: y * this.width + (x + 1),
          dimension: 'east'
        });
      }

      // West
      if (x > 0) {
        neighbors.push({
          neighbor: y * this.width + (x - 1),
          dimension: 'west'
        });
      }

      return neighbors;
    };

    return { cells, getNeighbors };
  }

  /**
   * Generate 2D grid using WFC.
   */
  generate(): State[][] {
    const graph = this.createGraph();
    const result = this.wfc.collapse(graph);

    if (!result.success) {
      throw new Error('WFC failed - contradiction detected');
    }

    // Convert back to 2D array
    const output: State[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: State[] = [];
      for (let x = 0; x < this.width; x++) {
        const id = y * this.width + x;
        const cell = result.graph.cells.get(id)!;
        row.push(cell.collapsedState!);
      }
      output.push(row);
    }

    return output;
  }
}
```

### Voronoi Adapter (Irregular Topology)
```typescript
interface VoronoiSite {
  id: number;
  x: number;
  y: number;
}

interface VoronoiEdge {
  site1: number;
  site2: number;
}

class WFCVoronoi {
  private sites: VoronoiSite[];
  private edges: VoronoiEdge[];
  private wfc: WFC;

  constructor(options: {
    sites: VoronoiSite[];
    edges: VoronoiEdge[];
    wfc: WFC;
  }) {
    this.sites = options.sites;
    this.edges = options.edges;
    this.wfc = options.wfc;
  }

  private createGraph(): WFCGraph {
    const cells = new Map<number, WFCCell>();

    // Create cell for each site
    for (const site of this.sites) {
      cells.set(site.id, {
        id: site.id,
        possibleStates: new Set(),
        collapsed: false
      });
    }

    // Build adjacency map from edges
    const adjacencyMap = new Map<number, number[]>();
    for (const edge of this.edges) {
      if (!adjacencyMap.has(edge.site1)) {
        adjacencyMap.set(edge.site1, []);
      }
      if (!adjacencyMap.has(edge.site2)) {
        adjacencyMap.set(edge.site2, []);
      }
      adjacencyMap.get(edge.site1)!.push(edge.site2);
      adjacencyMap.get(edge.site2)!.push(edge.site1);
    }

    // For irregular graphs, use generic 'adjacent' dimension
    const getNeighbors = (cellId: number): Adjacency[] => {
      const neighbors = adjacencyMap.get(cellId) || [];
      return neighbors.map(id => ({
        neighbor: id,
        dimension: 'adjacent' // Single dimension for irregular graphs
      }));
    };

    return { cells, getNeighbors };
  }

  generate(): Map<number, State> {
    const graph = this.createGraph();
    const result = this.wfc.collapse(graph);

    if (!result.success) {
      throw new Error('WFC failed - contradiction detected');
    }

    // Return map of site ID to collapsed state
    const output = new Map<number, State>();
    for (const [id, cell] of result.graph.cells) {
      output.set(id as number, cell.collapsedState!);
    }

    return output;
  }
}
```

## Learning Constraints from Examples

One key differentiator: learn WFC rules from example data using MarkovChain.

```typescript
class WFCConstraintLearner {
  /**
   * Learn 2D adjacency rules from example grids.
   */
  static learn2DConstraints(examples: State[][][]): ConstraintRules {
    const constraints: ConstraintRules = {};

    for (const grid of examples) {
      const height = grid.length;
      const width = grid[0].length;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const state = grid[y][x];

          // Initialize if needed
          if (!constraints[state]) {
            constraints[state] = {
              north: [],
              south: [],
              east: [],
              west: []
            };
          }

          // Learn north adjacency
          if (y > 0) {
            const north = grid[y - 1][x];
            if (!constraints[state].north.includes(north)) {
              constraints[state].north.push(north);
            }
          }

          // Learn south adjacency
          if (y < height - 1) {
            const south = grid[y + 1][x];
            if (!constraints[state].south.includes(south)) {
              constraints[state].south.push(south);
            }
          }

          // Learn east adjacency
          if (x < width - 1) {
            const east = grid[y][x + 1];
            if (!constraints[state].east.includes(east)) {
              constraints[state].east.push(east);
            }
          }

          // Learn west adjacency
          if (x > 0) {
            const west = grid[y][x - 1];
            if (!constraints[state].west.includes(west)) {
              constraints[state].west.push(west);
            }
          }
        }
      }
    }

    return constraints;
  }

  /**
   * Learn weighted constraints using Distribution for frequency.
   */
  static learnWeightedConstraints(examples: State[][][]): ConstraintRules {
    const frequencies: {
      [state: State]: {
        [dimension: Dimension]: { [neighbor: State]: number };
      };
    } = {};

    // Count adjacencies
    for (const grid of examples) {
      const height = grid.length;
      const width = grid[0].length;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const state = grid[y][x];

          if (!frequencies[state]) {
            frequencies[state] = {
              north: {},
              south: {},
              east: {},
              west: {}
            };
          }

          // Count north
          if (y > 0) {
            const north = grid[y - 1][x];
            frequencies[state].north[north] =
              (frequencies[state].north[north] || 0) + 1;
          }

          // Count south
          if (y < height - 1) {
            const south = grid[y + 1][x];
            frequencies[state].south[south] =
              (frequencies[state].south[south] || 0) + 1;
          }

          // Count east
          if (x < width - 1) {
            const east = grid[y][x + 1];
            frequencies[state].east[east] =
              (frequencies[state].east[east] || 0) + 1;
          }

          // Count west
          if (x > 0) {
            const west = grid[y][x - 1];
            frequencies[state].west[west] =
              (frequencies[state].west[west] || 0) + 1;
          }
        }
      }
    }

    // Convert to Distribution objects
    const constraints: ConstraintRules = {};
    for (const [state, dims] of Object.entries(frequencies)) {
      constraints[state] = {};
      for (const [dim, freqs] of Object.entries(dims)) {
        constraints[state][dim] = new Distribution({ source: freqs });
      }
    }

    return constraints;
  }
}
```

## Integration with Existing Primitives

### Using Distribution for Tile Selection
```typescript
// WFC already uses Distribution internally for weighted selection
const wfc = new WFC({
  seed: 42,
  states: ['grass', 'water', 'sand'],
  constraints: rules,
  frequencies: {
    grass: 50,  // More grass
    water: 20,  // Less water
    sand: 30    // Medium sand
  }
});
```

### Using MarkovChain for Sequential Patterns
```typescript
// Learn patterns from example sequences
const sequences = examples.map(grid => grid.flat());
const chain = new MarkovChain({ sequences, maxOrder: 2 });

// Use chain probabilities to inform WFC frequencies
const frequencies: { [state: State]: number } = {};
for (const state of states) {
  const stats = chain.getStats(); // hypothetical API
  frequencies[state] = stats.frequency(state);
}

const wfc = new WFC({ states, constraints, frequencies });
```

### Hybrid: Markov + WFC
```typescript
// Use Markov for global patterns, WFC for local constraints
class HybridGenerator {
  private markov: MarkovChain;
  private wfc: WFC;

  generate() {
    // First pass: Markov chain generates initial pattern
    const sequence = this.markov.generate({ length: 100 });

    // Second pass: WFC refines with constraints
    const graph = this.createGraphWithHints(sequence);
    return this.wfc.collapse(graph);
  }
}
```

## API Summary

### Low-Level: Custom Topologies
```typescript
const wfc = new WFC({
  seed: 42,
  states: ['A', 'B', 'C'],
  constraints: {
    A: { next: ['B', 'C'], prev: ['C'] },
    B: { next: ['A'], prev: ['A', 'B'] },
    C: { next: ['A'], prev: ['A', 'B', 'C'] }
  }
});

const graph = createCustomGraph();
const result = wfc.collapse(graph);
```

### High-Level: Built-in Topologies
```typescript
// 2D Grid
const grid = new WFCGrid2D({
  width: 50,
  height: 50,
  wfc: wfc
});
const map = grid.generate();

// Hex Grid
const hex = new WFCHexGrid({
  radius: 20,
  wfc: wfc
});
const hexMap = hex.generate();

// Voronoi
const voronoi = new WFCVoronoi({
  sites: sites,
  edges: edges,
  wfc: wfc
});
const irregularMap = voronoi.generate();
```

### Learning from Examples
```typescript
const examples = loadExampleMaps(); // State[][][]
const constraints = WFCConstraintLearner.learnWeightedConstraints(examples);

const wfc = new WFC({
  seed: 42,
  states: extractStates(examples),
  constraints
});
```

## Testing Strategy

1. **Unit Tests**: Core algorithm with simple graphs
2. **Topology Tests**: Each adapter with known inputs/outputs
3. **Constraint Learning**: Verify learned rules match examples
4. **Serialization**: Round-trip JSON conversion
5. **Determinism**: Same seed produces same results
6. **Performance**: Benchmark on large grids (1000x1000)

## Open Questions

1. **Backtracking**: Should we implement backtracking for contradictions?
   - Pro: More robust, handles complex constraints
   - Con: Performance impact, non-deterministic without careful seeding

2. **Entropy Calculation**: Use true Shannon entropy or just count?
   - Current: Simple count (faster)
   - Alternative: Weighted entropy with frequencies (more accurate)

3. **Symmetry**: Support rotational/reflective symmetry in constraints?
   - Useful for tile-based generation
   - Adds complexity to constraint definition

4. **Boundary Conditions**: How to handle graph edges?
   - Option 1: Wraparound (toroidal topology)
   - Option 2: Special boundary states
   - Option 3: Leave unconstrained

## Next Steps

1. Implement core WFC algorithm (topology-agnostic)
2. Implement Grid2D adapter with tests
3. Add constraint learning from examples
4. Add serialization (toJSON/fromJSON)
5. Implement additional adapters (Grid3D, Hex, Voronoi)
6. Document with game-focused examples
7. Performance optimization
8. Integration tests with MarkovChain and Distribution
