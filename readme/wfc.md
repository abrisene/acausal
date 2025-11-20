# acausal

[![npm version](https://badge.fury.io/js/acausal.svg)](https://badge.fury.io/js/acausal) [![GitHub version](https://badge.fury.io/gh/abrisene%2Facausal.svg)](https://badge.fury.io/gh/abrisene%2Facausal) [![Build Status](https://app.travis-ci.com/abrisene/acausal.svg?branch=master)](https://app.travis-ci.com/abrisene/acausal) [![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)](https://github.com/emersion/stability-badges#stable) [![Coverage Status](https://coveralls.io/repos/github/abrisene/acausal/badge.svg?branch=master)](https://coveralls.io/github/abrisene/acausal?branch=master)

## Wave Function Collapse (WFC)

- [_acausal_ Home](https://github.com/abrisene/acausal/#readme)
- [Markov Chain Quickstart](https://github.com/abrisene/acausal/blob/master/readme/markov.md#acausal-)
- [Random Distribution Quickstart](https://github.com/abrisene/acausal/blob/master/readme/distribution.md#acausal-)

**Wave Function Collapse** is a constraint-based procedural generation algorithm that creates coherent outputs by iteratively collapsing cells from a superposition of possible states to definite states, while propagating constraints to maintain local consistency.

Think of WFC as solving a sudoku puzzle where each cell can be multiple values until observed, and each observation constrains what its neighbors can be.

**Key Features:**
- **Topology-Agnostic**: Works on 2D grids, 3D voxels, graphs, or any custom structure
- **Constraint-Based**: Define adjacency rules for coherent generation
- **Learnable**: Automatically extract constraints from example patterns
- **Deterministic**: Same seed produces same results
- **Composable**: Integrates with Distribution and MarkovChain
- **Backtracking**: Intelligent contradiction recovery
- **Boundaries**: Configurable edge behavior (wrap, open, fixed)
- **Symmetry**: Auto-generate symmetric constraints

**WFC Quickstart Example - Terrain Generation:**

```typescript
import { WFC, WFCGrid2D } from 'acausal';

// Define terrain tiles and adjacency rules
const wfc = new WFC({
  seed: 42,
  states: ['water', 'sand', 'grass', 'forest'],
  constraints: {
    water: {
      north: ['water', 'sand'],
      south: ['water', 'sand'],
      east: ['water', 'sand'],
      west: ['water', 'sand']
    },
    sand: {
      north: ['water', 'sand', 'grass'],
      south: ['water', 'sand', 'grass'],
      east: ['water', 'sand', 'grass'],
      west: ['water', 'sand', 'grass']
    },
    grass: {
      north: ['sand', 'grass', 'forest'],
      south: ['sand', 'grass', 'forest'],
      east: ['sand', 'grass', 'forest'],
      west: ['sand', 'grass', 'forest']
    },
    forest: {
      north: ['grass', 'forest'],
      south: ['grass', 'forest'],
      east: ['grass', 'forest'],
      west: ['grass', 'forest']
    }
  },
  frequencies: {
    water: 2,
    sand: 1,
    grass: 5,    // Most common
    forest: 3
  },
  entropyMode: 'weighted-shannon',
  backtrack: true  // Enable smart contradiction recovery
});

// Generate a 2D terrain grid
const grid = new WFCGrid2D({
  width: 40,
  height: 20,
  wfc,
  boundaries: 'wrap'  // Seamless toroidal world
});

const terrain = grid.generate();

if (terrain) {
  console.log(terrain);
  // [
  //   ['water', 'water', 'sand', 'grass', ...],
  //   ['water', 'sand', 'grass', 'grass', ...],
  //   ['sand', 'grass', 'grass', 'forest', ...],
  //   ...
  // ]
}
```

---

## Table of Contents

### Getting Started
- [What is WFC?](#what-is-wfc)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)

### API Reference
- [WFC Class](#wfc-class)
- [WFCGrid2D Adapter](#wfcgrid2d-adapter)
- [WFCConstraintLearner](#wfcconstraintlearner)
- [WFCSymmetry](#wfcsymmetry)

### Configuration
- [Entropy Modes](#entropy-modes)
- [Frequency Weights](#frequency-weights)
- [Boundary Conditions](#boundary-conditions)
- [Backtracking](#backtracking-configuration)
- [Symmetry Transforms](#symmetry-transforms)

### Advanced Topics
- [Custom Topologies](#custom-topologies)
- [Integration with MarkovChain](#integration-with-markovchain)
- [Integration with Distribution](#integration-with-distribution)
- [Performance Optimization](#performance-optimization)
- [Serialization](#serialization)

### Examples
- [Dungeon Generation](#dungeon-generation-example)
- [Terrain Generation](#terrain-generation-example)
- [Learning from Examples](#learning-from-examples)
- [Hybrid Generation](#hybrid-generation-with-markov)

---

## What is WFC?

Wave Function Collapse generates coherent content through constraint propagation:

1. **Initialize**: All cells start in superposition (all possible states)
2. **Observe**: Pick a cell with minimum entropy and collapse it to one state
3. **Propagate**: Update neighbors' possible states based on constraints
4. **Repeat**: Continue until all cells are collapsed or contradiction occurs

### When to Use WFC

**Best For:**
- Tile-based level generation (dungeons, maps, puzzles)
- Texture synthesis from examples
- Procedural content with local coherence rules
- Constraint satisfaction problems
- Pattern generation with hard requirements

**Compared to Markov Chains:**
- **WFC**: Spatial constraints, bidirectional rules, local coherence
- **Markov**: Sequential patterns, temporal dependencies, global structure

**Compared to Noise (Perlin, Simplex):**
- **WFC**: Discrete states, hard constraints, perfect coherence
- **Noise**: Continuous values, soft gradients, no guarantees

---

## Quick Start

### Installation

```bash
npm install acausal
```

### 1. Basic 2D Grid Generation

```typescript
import { WFC, WFCGrid2D } from 'acausal';

// Define simple dungeon constraints
const dungeonWFC = new WFC({
  seed: 123,
  states: ['wall', 'floor', 'door'],
  constraints: {
    wall: {
      north: ['wall', 'door'],
      south: ['wall', 'door'],
      east: ['wall', 'door'],
      west: ['wall', 'door']
    },
    floor: {
      north: ['floor', 'door'],
      south: ['floor', 'door'],
      east: ['floor', 'door'],
      west: ['floor', 'door']
    },
    door: {
      north: ['wall', 'floor'],
      south: ['wall', 'floor'],
      east: ['wall', 'floor'],
      west: ['wall', 'floor']
    }
  },
  frequencies: {
    wall: 3,
    floor: 5,
    door: 1
  }
});

const grid = new WFCGrid2D({
  width: 20,
  height: 10,
  wfc: dungeonWFC,
  boundaries: 'fixed'  // Lock edges
});

const dungeon = grid.generate();
console.log(dungeon);
```

### 2. Learn Constraints from Examples

```typescript
import { WFCConstraintLearner } from 'acausal';

// Hand-craft a small example pattern
const example = [
  ['~', '~', '~', '~', '~'],
  ['~', '∴', '∴', '∴', '~'],
  ['~', '∴', '▓', '∴', '~'],
  ['~', '∴', '∴', '∴', '~'],
  ['~', '~', '~', '~', '~']
];

// Learn constraints automatically
const constraints = WFCConstraintLearner.learn2DConstraints([example]);
const states = WFCConstraintLearner.extractStates([example]);
const frequencies = WFCConstraintLearner.extractFrequencies([example]);

// Use learned rules
const learnedWFC = new WFC({
  seed: 456,
  states,
  constraints,
  frequencies
});

const grid = new WFCGrid2D({ width: 15, height: 10, wfc: learnedWFC });
const result = grid.generate();
// Generates patterns similar to the example!
```

### 3. Weighted Generation with Entropy Modes

```typescript
const wfc = new WFC({
  seed: 789,
  states: ['A', 'B', 'C'],
  constraints: {
    A: { north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B'] },
    B: { north: ['A', 'B', 'C'], south: ['A', 'B', 'C'], east: ['A', 'B', 'C'], west: ['A', 'B', 'C'] },
    C: { north: ['B', 'C'], south: ['B', 'C'], east: ['B', 'C'], west: ['B', 'C'] }
  },
  frequencies: {
    A: 1,
    B: 5,  // Most common
    C: 2
  },
  entropyMode: 'weighted-shannon',  // Frequency-aware collapse
  entropyNoise: 0.01  // Break ties randomly
});
```

---

## Core Concepts

### States

States represent the possible values for each cell:

```typescript
const states = ['grass', 'water', 'sand', 'forest', 'mountain'];
```

States are identified by strings for flexibility and serializability.

### Constraints

Constraints define adjacency rules - which states can be next to each other:

```typescript
const constraints = {
  grass: {
    north: ['grass', 'forest'],  // Grass can have grass or forest to its north
    south: ['grass', 'sand'],
    east: ['grass', 'water'],
    west: ['grass', 'mountain']
  },
  // ... more states
};
```

### Dimensions

Dimensions represent adjacency relationships. Common topologies:

- **2D Grid**: `north`, `south`, `east`, `west`
- **Hex Grid**: `ne`, `e`, `se`, `sw`, `w`, `nw`
- **3D Voxel**: `north`, `south`, `east`, `west`, `up`, `down`
- **Custom**: Any string identifiers you define

### Entropy

Entropy measures the "disorder" or uncertainty of a cell:

- **High Entropy**: Many possible states, harder to predict
- **Low Entropy**: Few possible states, easier to collapse

WFC always collapses the **lowest entropy cell** first for optimal constraint propagation.

---

## WFC Class

The core WFC algorithm implementation.

### Constructor

```typescript
new WFC(options: WFCOptions)
```

**WFCOptions:**

```typescript
interface WFCOptions {
  // Required
  seed: number;                  // Random seed for deterministic generation
  states: State[];               // All possible states
  constraints: ConstraintRules;  // Adjacency rules

  // Optional
  frequencies?: {[state: State]: number};  // State weights (default: uniform)
  entropyMode?: 'count' | 'shannon' | 'weighted-shannon' | EntropyFunction;
  entropyNoise?: number;         // Random noise to break ties (default: 0)
  boundaries?: BoundaryMode | BoundaryConfig;
  symmetry?: SymmetryConfig;
  backtrack?: boolean | BacktrackConfig;
}
```

### Methods

#### `collapse(graph: WFCGraph, options?: WFCGenerateOptions): WFCResult`

Runs the WFC algorithm on a graph.

```typescript
const graph = createMyGraph();  // Your custom topology
const result = wfc.collapse(graph);

if (result.success) {
  console.log('Generation succeeded!');
  console.log('Steps:', result.metadata.steps);
  console.log('Backtracks:', result.metadata.backtracks);
} else {
  console.log('Contradiction:', result.error);
}
```

**Returns:**

```typescript
interface WFCResult {
  success: boolean;
  graph: WFCGraph;
  contradiction: boolean;
  error?: string;
  metadata?: {
    steps: number;
    backtracks: number;
    timeMs: number;
  };
}
```

#### `toJSON(): WFCDTO`

Serializes the WFC instance to JSON.

```typescript
const dto = wfc.toJSON();
const json = JSON.stringify(dto);
// Save to file or send over network
```

#### `static fromJSON(dto: WFCDTO): WFC`

Deserializes a WFC instance from JSON.

```typescript
const dto = JSON.parse(json);
const wfc = WFC.fromJSON(dto);
// Same constraints and configuration
```

#### `getStats(): WFCStats`

Returns statistics about the WFC model.

```typescript
const stats = wfc.getStats();
console.log('States:', stats.stateCount);
console.log('Constraints:', stats.constraintCount);
console.log('Dimensions:', stats.dimensions);
console.log('Avg allowed states:', stats.avgAllowedStates);
```

#### `getConstraints(): ConstraintRules`

Returns a copy of the constraint rules.

```typescript
const constraints = wfc.getConstraints();
```

---

## WFCGrid2D Adapter

Convenient adapter for 2D grid generation with cardinal directions.

### Constructor

```typescript
new WFCGrid2D(options: Grid2DOptions)
```

**Grid2DOptions:**

```typescript
interface Grid2DOptions {
  width: number;
  height: number;
  wfc: WFC;
  boundaries?: BoundaryMode | BoundaryConfig;
}
```

### Methods

#### `generate(): State[][] | null`

Generates a 2D grid of states.

```typescript
const grid = new WFCGrid2D({ width: 20, height: 10, wfc });
const result = grid.generate();

if (result) {
  // result[y][x] = state at (x, y)
  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y].length; x++) {
      console.log(`(${x},${y}): ${result[y][x]}`);
    }
  }
}
```

#### `generateWithResult(): WFCResult & { grid: State[][] | null }`

Returns full result with metadata.

```typescript
const result = grid.generateWithResult();

if (result.success) {
  console.log('Grid:', result.grid);
  console.log('Steps:', result.metadata.steps);
  console.log('Time:', result.metadata.timeMs, 'ms');
} else {
  console.log('Failed:', result.error);
}
```

#### `createGraph(): WFCGraph`

Creates the underlying graph structure (advanced usage).

```typescript
const graph = grid.createGraph();
// Manually manipulate graph before collapsing
const result = wfc.collapse(graph);
```

---

## WFCConstraintLearner

Automatically extracts constraints from example grids.

### Static Methods

#### `learn2DConstraints(examples: State[][][]): ConstraintRules`

Learns adjacency constraints from 2D grid examples.

```typescript
const examples = [
  [
    ['A', 'B', 'A'],
    ['B', 'A', 'B'],
    ['A', 'B', 'A']
  ],
  [
    ['B', 'A', 'B'],
    ['A', 'B', 'A'],
    ['B', 'A', 'B']
  ]
];

const constraints = WFCConstraintLearner.learn2DConstraints(examples);
// Automatically extracts which states can be adjacent
```

#### `extractStates(examples: State[][][]): State[]`

Extracts all unique states from examples.

```typescript
const states = WFCConstraintLearner.extractStates(examples);
// ['A', 'B']
```

#### `extractFrequencies(examples: State[][][]): {[state: State]: number}`

Calculates state frequencies from examples.

```typescript
const frequencies = WFCConstraintLearner.extractFrequencies(examples);
// { A: 9, B: 9 }
```

### Complete Learning Example

```typescript
import { WFC, WFCGrid2D, WFCConstraintLearner } from 'acausal';

// Provide multiple example patterns
const examples = [
  [
    ['█', '█', '█', '█'],
    ['█', '·', '·', '█'],
    ['█', '·', '·', '█'],
    ['█', '█', '▓', '█']
  ],
  [
    ['█', '█', '█', '█', '█'],
    ['█', '·', '·', '·', '█'],
    ['█', '█', '▓', '█', '█']
  ]
];

// Learn everything automatically
const constraints = WFCConstraintLearner.learn2DConstraints(examples);
const states = WFCConstraintLearner.extractStates(examples);
const frequencies = WFCConstraintLearner.extractFrequencies(examples);

// Create WFC from learned rules
const wfc = new WFC({
  seed: 42,
  states,
  constraints,
  frequencies,
  backtrack: true
});

// Generate new content in the same style
const grid = new WFCGrid2D({ width: 30, height: 15, wfc });
const dungeon = grid.generate();
```

---

## WFCSymmetry

Dimension-agnostic symmetry transformations for automatic constraint generation.

### Transform Interface

```typescript
interface SymmetryTransform {
  name: string;
  mapping: {[dimension: Dimension]: Dimension};
}
```

### SYMMETRY_PRESETS

Pre-defined transforms for common topologies:

```typescript
import { SYMMETRY_PRESETS } from 'acausal';

// 2D Grid transformations
SYMMETRY_PRESETS.grid2D.rotate90     // {north -> east, east -> south, ...}
SYMMETRY_PRESETS.grid2D.rotate180
SYMMETRY_PRESETS.grid2D.rotate270
SYMMETRY_PRESETS.grid2D.flipH        // Horizontal flip
SYMMETRY_PRESETS.grid2D.flipV        // Vertical flip

// Hex grid transformations
SYMMETRY_PRESETS.hex.rotate60
SYMMETRY_PRESETS.hex.rotate120
// ... etc

// 3D voxel transformations
SYMMETRY_PRESETS.voxel3D.rotateX90
SYMMETRY_PRESETS.voxel3D.rotateY90
SYMMETRY_PRESETS.voxel3D.rotateZ90
```

### Static Methods

#### `applyTransform(constraints: ConstraintRules, transform: SymmetryTransform): ConstraintRules`

Applies a symmetry transform to constraints.

```typescript
import { WFCSymmetry, SYMMETRY_PRESETS } from 'acausal';

// Start with partial constraints
const constraints = {
  A: {
    north: ['A', 'B'],
    east: ['B']
    // Missing south and west!
  },
  B: {
    north: ['B'],
    // Missing south, east, west!
  }
};

// Apply 90° rotation to fill in missing directions
let symmetric = WFCSymmetry.applyTransform(
  constraints,
  SYMMETRY_PRESETS.grid2D.rotate90
);

// Apply again for full coverage
symmetric = WFCSymmetry.applyTransform(
  symmetric,
  SYMMETRY_PRESETS.grid2D.rotate180
);

// Now all directions are filled in!
```

#### `composeTransforms(t1: SymmetryTransform, t2: SymmetryTransform): SymmetryTransform`

Combines two transforms.

```typescript
const rotate90 = SYMMETRY_PRESETS.grid2D.rotate90;
const flipH = SYMMETRY_PRESETS.grid2D.flipH;

const combined = WFCSymmetry.composeTransforms(rotate90, flipH);
// Creates a new transform that does both
```

#### `isSymmetric(constraints: ConstraintRules, transform: SymmetryTransform): boolean`

Checks if constraints already have a symmetry.

```typescript
const hasRotationalSymmetry = WFCSymmetry.isSymmetric(
  constraints,
  SYMMETRY_PRESETS.grid2D.rotate90
);

if (hasRotationalSymmetry) {
  console.log('Constraints are rotationally symmetric!');
}
```

### Custom Symmetry Example

```typescript
// Define custom transform for your topology
const customTransform: SymmetryTransform = {
  name: 'my-transform',
  mapping: {
    'up': 'down',
    'down': 'up',
    'left': 'right',
    'right': 'left'
  }
};

const symmetric = WFCSymmetry.applyTransform(constraints, customTransform);
```

---

## Entropy Modes

Entropy determines which cell to collapse next. Lower entropy = collapsed first.

### Count Mode (Fastest)

Simple count of possible states:

```typescript
entropyMode: 'count'
```

- **Best for**: Maximum performance
- **Behavior**: Collapses cells with fewest possibilities first
- **Use when**: Speed matters more than distribution quality

### Shannon Entropy (Balanced)

Information-theoretic entropy with uniform probabilities:

```typescript
entropyMode: 'shannon'
```

- **Best for**: Balanced generation
- **Behavior**: Considers information content
- **Use when**: You want good results without frequency weights

### Weighted Shannon (Frequency-Aware)

Shannon entropy weighted by state frequencies:

```typescript
entropyMode: 'weighted-shannon',
frequencies: {
  common: 10,
  rare: 1
}
```

- **Best for**: Realistic distributions
- **Behavior**: Frequency-aware collapse order
- **Use when**: You have frequency data from examples

### Custom Entropy Function

Define your own entropy calculation:

```typescript
import type { EntropyFunction } from 'acausal';

const customEntropy: EntropyFunction = (cell, frequencies) => {
  // Your custom logic
  const size = cell.possibleStates.size;
  return size * Math.random();  // Random with size bias
};

const wfc = new WFC({
  // ...
  entropyMode: customEntropy
});
```

### Entropy Noise

Add small random variation to break ties:

```typescript
const wfc = new WFC({
  // ...
  entropyMode: 'shannon',
  entropyNoise: 0.01  // Small random variation
});
```

Prevents deterministic patterns when multiple cells have same entropy.

---

## Frequency Weights

Control state distribution with frequency weights:

```typescript
const wfc = new WFC({
  // ...
  frequencies: {
    common: 100,  // Very common
    normal: 10,   // Normal
    rare: 1,      // Rare
    legendary: 0.1  // Very rare
  }
});
```

**Effects:**
- **Collapse Priority**: Weighted-shannon mode considers frequencies
- **State Selection**: When collapsing, states picked according to weights
- **Distribution**: Output reflects frequency ratios

**Example - Terrain:**

```typescript
frequencies: {
  water: 2,    // Oceans
  sand: 1,     // Beaches
  grass: 5,    // Most of land
  forest: 3,   // Some forest
  mountain: 1  // Rare peaks
}
```

---

## Boundary Conditions

Control behavior at grid edges.

### Boundary Modes

#### Open (Default)

Edges have no connections:

```typescript
boundaries: 'open'
```

- Edges are free to be any state
- No wrapping or constraints at boundaries
- Best for: Isolated regions, islands

#### Wrap (Toroidal)

Opposite edges connect (seamless tiling):

```typescript
boundaries: 'wrap'
```

- North edge connects to south edge
- East edge connects to west edge
- Creates seamless, tileable output
- Best for: Infinite worlds, repeating patterns

#### Fixed (Locked States)

Lock edge cells to specific state(s):

```typescript
boundaries: 'fixed'  // Uses default fixed state

// Or specify states per dimension:
boundaries: {
  perDimension: {
    north: 'wall',           // Single state
    south: 'wall',
    east: ['wall', 'door'],  // Multiple allowed states
    west: ['wall', 'door']
  }
}
```

- Forces edges to specific states
- Best for: Walls, borders, constrained regions

### Per-Dimension Configuration

Mix different boundary modes:

```typescript
boundaries: {
  default: 'open',      // Default for unspecified dimensions
  perDimension: {
    north: 'wrap',      // North wraps to south
    south: 'wrap',
    east: 'fixed',      // East/west locked to wall
    west: 'fixed'
  }
}
```

### Examples

**Island in Ocean:**

```typescript
const grid = new WFCGrid2D({
  width: 30,
  height: 20,
  wfc,
  boundaries: {
    perDimension: {
      north: ['water'],
      south: ['water'],
      east: ['water'],
      west: ['water']
    }
  }
});
```

**Seamless Tiling:**

```typescript
const grid = new WFCGrid2D({
  width: 64,
  height: 64,
  wfc,
  boundaries: 'wrap'  // Tiles seamlessly!
});
```

**Walled Dungeon:**

```typescript
const grid = new WFCGrid2D({
  width: 40,
  height: 25,
  wfc,
  boundaries: 'fixed'  // All edges locked
});
```

---

## Backtracking Configuration

Enable intelligent contradiction recovery.

### Simple Enable

```typescript
backtrack: true  // Use default settings
```

Defaults:
- `maxDepth`: 100
- `maxAttempts`: 1000

### Detailed Configuration

```typescript
backtrack: {
  enabled: true,
  maxDepth: 50,      // Maximum backtrack depth
  maxAttempts: 5000  // Maximum retry attempts
}
```

### How Backtracking Works

1. **Snapshot**: Before each cell collapse, save graph state
2. **Contradiction**: If propagation fails, restore snapshot
3. **Retry**: Try a different state for that cell
4. **Recurse**: If all states fail, backtrack to previous cell
5. **Success**: Continue forward when a valid state is found

### When to Use Backtracking

**Enable backtracking when:**
- Constraints are tight and contradictions are common
- Generation success is more important than speed
- Working with complex constraint networks
- Learning constraints from small examples

**Disable backtracking when:**
- Constraints are loose and contradictions are rare
- Performance is critical
- Generating large grids quickly
- Contradictions are acceptable (can regenerate)

### Performance Impact

```typescript
// Without backtracking: Fast but may fail
backtrack: false
// Time: ~50ms, Success: 80%

// With backtracking: Slower but reliable
backtrack: { enabled: true, maxDepth: 100 }
// Time: ~200ms, Success: 98%
```

### Backtrack Metadata

Results include backtrack statistics:

```typescript
const result = grid.generateWithResult();

console.log('Steps:', result.metadata.steps);
console.log('Backtracks:', result.metadata.backtracks);
console.log('Backtrack rate:',
  (result.metadata.backtracks / result.metadata.steps * 100).toFixed(1) + '%'
);
```

---

## Symmetry Transforms

Auto-generate symmetric constraints to reduce manual work.

### Basic Usage

```typescript
import { WFCSymmetry, SYMMETRY_PRESETS } from 'acausal';

// Define constraints for one direction
const partial = {
  A: {
    north: ['A', 'B']
    // Missing south, east, west
  }
};

// Apply rotation to fill in other directions
const complete = WFCSymmetry.applyTransform(
  partial,
  SYMMETRY_PRESETS.grid2D.rotate90
);

// Now has constraints for all 4 directions!
```

### Multiple Transforms

Apply several transforms for full symmetry:

```typescript
let constraints = partialConstraints;

// Apply all rotations
constraints = WFCSymmetry.applyTransform(constraints, SYMMETRY_PRESETS.grid2D.rotate90);
constraints = WFCSymmetry.applyTransform(constraints, SYMMETRY_PRESETS.grid2D.rotate180);
constraints = WFCSymmetry.applyTransform(constraints, SYMMETRY_PRESETS.grid2D.rotate270);

// Apply reflections
constraints = WFCSymmetry.applyTransform(constraints, SYMMETRY_PRESETS.grid2D.flipH);
constraints = WFCSymmetry.applyTransform(constraints, SYMMETRY_PRESETS.grid2D.flipV);

// Now fully symmetric in all directions!
```

### Custom Topologies

Define transforms for your own topology:

```typescript
// Hex grid custom transform
const hexRotate60: SymmetryTransform = {
  name: 'hex-rotate-60',
  mapping: {
    'ne': 'e',
    'e': 'se',
    'se': 'sw',
    'sw': 'w',
    'w': 'nw',
    'nw': 'ne'
  }
};

const symmetric = WFCSymmetry.applyTransform(constraints, hexRotate60);
```

### Checking Symmetry

Verify if constraints already have a symmetry:

```typescript
const hasRotational = WFCSymmetry.isSymmetric(
  constraints,
  SYMMETRY_PRESETS.grid2D.rotate90
);

const hasReflective = WFCSymmetry.isSymmetric(
  constraints,
  SYMMETRY_PRESETS.grid2D.flipH
);

if (hasRotational && hasReflective) {
  console.log('Constraints have full dihedral symmetry!');
}
```

---

## Custom Topologies

WFC works on any graph structure, not just 2D grids.

### Graph Interface

```typescript
interface WFCGraph {
  cells: Map<CellId, WFCCell>;
  getNeighbors: (cellId: CellId) => Adjacency[];
}

interface WFCCell {
  id: CellId;
  possibleStates: Set<State>;
  collapsed: boolean;
  collapsedState?: State;
}

interface Adjacency {
  neighbor: CellId;
  dimension: Dimension;
}
```

### Hex Grid Example

```typescript
function createHexGraph(radius: number): WFCGraph {
  const cells = new Map<CellId, WFCCell>();

  // Create hex cells in axial coordinates
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        const id = `${q},${r}`;
        cells.set(id, {
          id,
          possibleStates: new Set(allStates),
          collapsed: false
        });
      }
    }
  }

  // Define hex neighbors
  const getNeighbors = (cellId: CellId): Adjacency[] => {
    const [q, r] = cellId.split(',').map(Number);
    const neighbors: Adjacency[] = [];

    const hexDirs = [
      { dq: 1, dr: 0, dim: 'e' },
      { dq: 1, dr: -1, dim: 'ne' },
      { dq: 0, dr: -1, dim: 'nw' },
      { dq: -1, dr: 0, dim: 'w' },
      { dq: -1, dr: 1, dim: 'sw' },
      { dq: 0, dr: 1, dim: 'se' }
    ];

    for (const {dq, dr, dim} of hexDirs) {
      const nq = q + dq;
      const nr = r + dr;
      const neighborId = `${nq},${nr}`;

      if (cells.has(neighborId)) {
        neighbors.push({
          neighbor: neighborId,
          dimension: dim
        });
      }
    }

    return neighbors;
  };

  return { cells, getNeighbors };
}

// Use with WFC
const hexGraph = createHexGraph(10);
const result = wfc.collapse(hexGraph);
```

### 3D Voxel Example

```typescript
function createVoxelGraph(width: number, height: number, depth: number): WFCGraph {
  const cells = new Map<CellId, WFCCell>();

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        const id = `${x},${y},${z}`;
        cells.set(id, {
          id,
          possibleStates: new Set(allStates),
          collapsed: false
        });
      }
    }
  }

  const getNeighbors = (cellId: CellId): Adjacency[] => {
    const [x, y, z] = cellId.split(',').map(Number);
    const neighbors: Adjacency[] = [];

    const dirs = [
      { dx: 0, dy: 0, dz: 1, dim: 'up' },
      { dx: 0, dy: 0, dz: -1, dim: 'down' },
      { dx: 1, dy: 0, dz: 0, dim: 'east' },
      { dx: -1, dy: 0, dz: 0, dim: 'west' },
      { dx: 0, dy: 1, dz: 0, dim: 'north' },
      { dx: 0, dy: -1, dz: 0, dim: 'south' }
    ];

    for (const {dx, dy, dz, dim} of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;

      if (nx >= 0 && nx < width &&
          ny >= 0 && ny < height &&
          nz >= 0 && nz < depth) {
        neighbors.push({
          neighbor: `${nx},${ny},${nz}`,
          dimension: dim
        });
      }
    }

    return neighbors;
  };

  return { cells, getNeighbors };
}
```

---

## Integration with MarkovChain

Combine WFC's spatial coherence with Markov's sequential patterns.

### Use Markov to Learn WFC Frequencies

```typescript
import { MarkovChain, WFC, WFCGrid2D } from 'acausal';

// Train Markov chain on terrain sequences
const terrainChain = new MarkovChain<string>({ seed: 42, order: 1 });

const sequences = [
  ['water', 'sand', 'grass', 'forest'],
  ['water', 'sand', 'grass', 'grass'],
  ['forest', 'grass', 'sand', 'water']
];

for (const seq of sequences) {
  terrainChain.train([seq]);
}

// Extract frequencies for WFC
const frequencies = terrainChain.getStats().frequencyStats;

const wfc = new WFC({
  seed: 123,
  states: ['water', 'sand', 'grass', 'forest'],
  constraints: terrainConstraints,
  frequencies,  // Use Markov-learned frequencies!
  entropyMode: 'weighted-shannon'
});
```

### WFC for Layout, Markov for Details

```typescript
// Step 1: Generate high-level layout with WFC
const layoutWFC = new WFC({
  seed: 1,
  states: ['room', 'corridor', 'empty'],
  constraints: layoutConstraints
});

const layoutGrid = new WFCGrid2D({ width: 20, height: 15, wfc: layoutWFC });
const layout = layoutGrid.generate();

// Step 2: Use Markov to fill in room details
const roomChain = new MarkovChain({ seed: 2, order: 1 });
roomChain.train([
  ['empty', 'enemy', 'chest'],
  ['trap', 'enemy', 'chest'],
  ['enemy', 'enemy', 'treasure']
]);

if (layout) {
  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      if (layout[y][x] === 'room') {
        const contents = roomChain.generate({ length: 3 });
        console.log(`Room at (${x},${y}):`, contents);
      }
    }
  }
}
```

### Feedback Loop

```typescript
// Generate with WFC
const result = grid.generate();

// Analyze with Markov
const analyzer = new MarkovChain({ seed: 1, order: 1 });
if (result) {
  for (const row of result) {
    analyzer.train([row]);
  }
}

// Use analysis to adjust next generation
const newFrequencies = analyzer.getStats().frequencyStats;

const refinedWFC = new WFC({
  seed: 2,
  states: originalStates,
  constraints: originalConstraints,
  frequencies: newFrequencies  // Adjusted from analysis!
});
```

See [examples/wfc-markov-hybrid.ts](../examples/wfc-markov-hybrid.ts) for complete examples.

---

## Integration with Distribution

Use Distribution for weighted constraint selection.

### Weighted Adjacency Rules

```typescript
import { Distribution } from 'acausal';

const constraints = {
  grass: {
    // Use Distribution for weighted neighbor selection
    north: new Distribution({
      seed: 1,
      source: {
        grass: 70,   // 70% chance of grass
        forest: 20,  // 20% chance of forest
        sand: 10     // 10% chance of sand
      }
    }),
    south: ['grass', 'sand'],  // Or simple array
    east: ['grass', 'forest'],
    west: ['grass']
  }
};

const wfc = new WFC({
  seed: 42,
  states: ['grass', 'forest', 'sand'],
  constraints
});
```

### Dynamic State Selection

```typescript
// Create distributions for dynamic weights
const rarityDist = new Distribution({
  seed: 1,
  source: {
    common: 80,
    uncommon: 15,
    rare: 4,
    legendary: 1
  }
});

// Use distribution to adjust WFC frequencies
const picked = rarityDist.pick(100);  // Pick 100 items
const frequencies: {[key: string]: number} = {};

for (const item of picked) {
  frequencies[item] = (frequencies[item] || 0) + 1;
}

const wfc = new WFC({
  seed: 2,
  states: ['common', 'uncommon', 'rare', 'legendary'],
  constraints: lootConstraints,
  frequencies  // Dynamic frequencies from distribution!
});
```

---

## Performance Optimization

Tips for optimal WFC performance.

### Choose the Right Entropy Mode

```typescript
// Fastest: Count mode
entropyMode: 'count'
// Use for: Large grids, simple constraints

// Balanced: Shannon
entropyMode: 'shannon'
// Use for: Medium grids, moderate quality needs

// Slowest but best quality: Weighted Shannon
entropyMode: 'weighted-shannon'
// Use for: Small grids, high quality needs
```

### Boundary Selection

```typescript
// Fastest: Open boundaries (no edge processing)
boundaries: 'open'

// Moderate: Wrap boundaries
boundaries: 'wrap'

// Slowest: Fixed boundaries (requires validation)
boundaries: 'fixed'
```

### Backtracking Trade-offs

```typescript
// Fast but may fail:
backtrack: false

// Slower but more reliable:
backtrack: { enabled: true, maxDepth: 50 }

// Very slow but exhaustive:
backtrack: { enabled: true, maxDepth: 200, maxAttempts: 10000 }
```

### Constraint Complexity

```typescript
// Simple constraints (faster)
const simple = {
  A: { north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B'] },
  B: { north: ['A', 'B'], south: ['A', 'B'], east: ['A', 'B'], west: ['A', 'B'] }
};

// Complex constraints (slower)
const complex = {
  A: { north: new Distribution({...}), ... },
  B: { north: new Distribution({...}), ... },
  C: { north: new Distribution({...}), ... },
  D: { north: new Distribution({...}), ... }
  // Many states with Distribution objects
};
```

### Performance Targets

Based on benchmarks:

```
Grid Size    | Target Time | Notes
-------------|-------------|------------------
10x10        | <10ms       | Very fast
50x50        | <100ms      | Fast
100x100      | <1000ms     | Acceptable
200x200      | <5000ms     | Usable for generation
300x300      | <12000ms    | Consider chunking
```

### Optimization Checklist

- ✅ Use `count` entropy mode for speed
- ✅ Disable backtracking if contradictions are rare
- ✅ Use simple array constraints instead of Distributions
- ✅ Minimize number of states
- ✅ Use `open` or `wrap` boundaries
- ✅ Generate smaller grids and tile them
- ✅ Pre-compute learned constraints once, reuse many times

---

## Serialization

Save and load WFC models for reuse.

### Basic Serialization

```typescript
import { WFC } from 'acausal';

// Create WFC
const wfc = new WFC({
  seed: 42,
  states: ['A', 'B', 'C'],
  constraints: myConstraints,
  frequencies: { A: 1, B: 2, C: 3 },
  entropyMode: 'weighted-shannon'
});

// Serialize to JSON
const dto = wfc.toJSON();
const json = JSON.stringify(dto);

// Save to file
import fs from 'fs';
fs.writeFileSync('my-wfc-model.json', json);
```

### Deserialization

```typescript
// Load from file
const json = fs.readFileSync('my-wfc-model.json', 'utf-8');
const dto = JSON.parse(json);

// Recreate WFC instance
const wfc = WFC.fromJSON(dto);

// Same configuration and constraints!
const grid = new WFCGrid2D({ width: 10, height: 10, wfc });
const result = grid.generate();
```

### Model Versioning

```typescript
interface SavedModel {
  version: string;
  created: string;
  wfc: WFCDTO;
  metadata: {
    name: string;
    description: string;
    author: string;
  };
}

// Save with metadata
const model: SavedModel = {
  version: '1.0',
  created: new Date().toISOString(),
  wfc: wfc.toJSON(),
  metadata: {
    name: 'Dungeon Generator',
    description: 'Medieval dungeon with rooms and corridors',
    author: 'Game Designer'
  }
};

fs.writeFileSync('dungeon-v1.json', JSON.stringify(model, null, 2));

// Load with validation
const loaded = JSON.parse(fs.readFileSync('dungeon-v1.json', 'utf-8'));

if (loaded.version === '1.0') {
  const wfc = WFC.fromJSON(loaded.wfc);
  console.log('Loaded:', loaded.metadata.name);
}
```

### Constraints-Only Export

```typescript
// Export just the constraints for sharing
const constraints = wfc.getConstraints();
const constraintsJson = JSON.stringify(constraints, null, 2);

// Import and create new WFC
const importedConstraints = JSON.parse(constraintsJson);

const newWFC = new WFC({
  seed: 999,  // Different seed
  states: myStates,
  constraints: importedConstraints,
  // ... other custom options
});
```

---

## Dungeon Generation Example

Complete example for procedural dungeon generation.

```typescript
import { WFC, WFCGrid2D, WFCSymmetry, SYMMETRY_PRESETS } from 'acausal';

// Define tiles
const WALL = '█';
const FLOOR = '·';
const DOOR = '▓';
const CORRIDOR = '░';

// Define constraints
const dungeonConstraints = {
  [WALL]: {
    north: [WALL, DOOR],
    south: [WALL, DOOR],
    east: [WALL, DOOR],
    west: [WALL, DOOR]
  },
  [FLOOR]: {
    north: [FLOOR, CORRIDOR, DOOR],
    south: [FLOOR, CORRIDOR, DOOR],
    east: [FLOOR, CORRIDOR, DOOR],
    west: [FLOOR, CORRIDOR, DOOR]
  },
  [DOOR]: {
    north: [WALL, FLOOR, CORRIDOR],
    south: [WALL, FLOOR, CORRIDOR],
    east: [WALL, FLOOR, CORRIDOR],
    west: [WALL, FLOOR, CORRIDOR]
  },
  [CORRIDOR]: {
    north: [CORRIDOR, FLOOR, DOOR],
    south: [CORRIDOR, FLOOR, DOOR],
    east: [CORRIDOR, FLOOR, DOOR],
    west: [CORRIDOR, FLOOR, DOOR]
  }
};

// Create WFC with backtracking
const dungeonWFC = new WFC({
  seed: 12345,
  states: [WALL, FLOOR, DOOR, CORRIDOR],
  constraints: dungeonConstraints,
  frequencies: {
    [WALL]: 3,      // More walls
    [FLOOR]: 4,     // Open rooms
    [DOOR]: 1,      // Rare doors
    [CORRIDOR]: 2   // Some corridors
  },
  entropyMode: 'weighted-shannon',
  backtrack: true
});

// Generate dungeon with walls on edges
const grid = new WFCGrid2D({
  width: 30,
  height: 15,
  wfc: dungeonWFC,
  boundaries: 'fixed'  // Lock edges to walls
});

const dungeon = grid.generate();

if (dungeon) {
  console.log('\nProcedural Dungeon:');
  for (const row of dungeon) {
    console.log(row.join(''));
  }
}

// Generate variations
console.log('\nGenerating 3 variations...\n');

for (let i = 0; i < 3; i++) {
  const variantWFC = new WFC({
    seed: 10000 + i * 1000,
    states: [WALL, FLOOR, DOOR, CORRIDOR],
    constraints: dungeonConstraints,
    frequencies: {[WALL]: 3, [FLOOR]: 4, [DOOR]: 1, [CORRIDOR]: 2},
    backtrack: true
  });

  const variantGrid = new WFCGrid2D({
    width: 20,
    height: 8,
    wfc: variantWFC,
    boundaries: 'fixed'
  });

  const variant = variantGrid.generate();

  if (variant) {
    console.log(`Variation ${i + 1}:`);
    for (const row of variant) {
      console.log(row.join(''));
    }
    console.log('');
  }
}
```

See [examples/wfc-dungeon.ts](../examples/wfc-dungeon.ts) for more examples.

---

## Terrain Generation Example

Generate natural-looking terrain with multiple biomes.

```typescript
import { WFC, WFCGrid2D, WFCConstraintLearner } from 'acausal';

// Define terrain types
const WATER = '~';
const SAND = '∴';
const GRASS = '▓';
const FOREST = '♣';
const MOUNTAIN = '▲';

// Realistic terrain constraints (water near water, mountains near forest)
const terrainConstraints = {
  [WATER]: {
    north: [WATER, SAND],
    south: [WATER, SAND],
    east: [WATER, SAND],
    west: [WATER, SAND]
  },
  [SAND]: {
    north: [WATER, SAND, GRASS],
    south: [WATER, SAND, GRASS],
    east: [WATER, SAND, GRASS],
    west: [WATER, SAND, GRASS]
  },
  [GRASS]: {
    north: [SAND, GRASS, FOREST],
    south: [SAND, GRASS, FOREST],
    east: [SAND, GRASS, FOREST],
    west: [SAND, GRASS, FOREST]
  },
  [FOREST]: {
    north: [GRASS, FOREST, MOUNTAIN],
    south: [GRASS, FOREST, MOUNTAIN],
    east: [GRASS, FOREST, MOUNTAIN],
    west: [GRASS, FOREST, MOUNTAIN]
  },
  [MOUNTAIN]: {
    north: [FOREST, MOUNTAIN],
    south: [FOREST, MOUNTAIN],
    east: [FOREST, MOUNTAIN],
    west: [FOREST, MOUNTAIN]
  }
};

// Create WFC with natural distribution
const terrainWFC = new WFC({
  seed: 42,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
  constraints: terrainConstraints,
  frequencies: {
    [WATER]: 2,
    [SAND]: 1,
    [GRASS]: 5,    // Most common
    [FOREST]: 3,
    [MOUNTAIN]: 1  // Rare peaks
  },
  entropyMode: 'weighted-shannon',
  backtrack: true
});

// Generate seamless terrain
const terrain = new WFCGrid2D({
  width: 40,
  height: 20,
  wfc: terrainWFC,
  boundaries: 'wrap'  // Seamless tiling!
});

const result = terrain.generate();

if (result) {
  console.log('Terrain Map:');
  for (const row of result) {
    console.log(row.join(''));
  }
  console.log('\nLegend: ~ Water, ∴ Sand, ▓ Grass, ♣ Forest, ▲ Mountain');
}

// Generate island (water boundaries)
const islandWFC = new WFC({
  seed: 123,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
  constraints: terrainConstraints,
  frequencies: {[WATER]: 1, [SAND]: 2, [GRASS]: 4, [FOREST]: 2, [MOUNTAIN]: 1},
  entropyMode: 'weighted-shannon',
  backtrack: true
});

const island = new WFCGrid2D({
  width: 30,
  height: 15,
  wfc: islandWFC,
  boundaries: {
    perDimension: {
      north: [WATER],
      south: [WATER],
      east: [WATER],
      west: [WATER]
    }
  }
});

const islandResult = island.generate();

if (islandResult) {
  console.log('\nIsland:');
  for (const row of islandResult) {
    console.log(row.join(''));
  }
}
```

See [examples/wfc-terrain.ts](../examples/wfc-terrain.ts) for more examples.

---

## Learning from Examples

Automatically extract constraints from hand-crafted patterns.

```typescript
import { WFC, WFCGrid2D, WFCConstraintLearner } from 'acausal';

// Create example dungeon layouts
const example1 = [
  ['█', '█', '█', '█', '█', '█', '█'],
  ['█', '·', '·', '·', '·', '·', '█'],
  ['█', '·', '█', '█', '█', '·', '█'],
  ['█', '·', '█', '·', '█', '·', '█'],
  ['█', '·', '·', '·', '·', '·', '█'],
  ['█', '█', '▓', '█', '█', '█', '█']
];

const example2 = [
  ['█', '█', '█', '█', '█'],
  ['█', '·', '·', '·', '█'],
  ['█', '█', '▓', '█', '█'],
  ['█', '·', '·', '·', '█'],
  ['█', '█', '█', '█', '█']
];

// Learn from examples
console.log('Learning constraints from examples...');

const constraints = WFCConstraintLearner.learn2DConstraints([example1, example2]);
const states = WFCConstraintLearner.extractStates([example1, example2]);
const frequencies = WFCConstraintLearner.extractFrequencies([example1, example2]);

console.log('Learned states:', states);
console.log('Learned frequencies:', frequencies);

// Create WFC from learned rules
const learnedWFC = new WFC({
  seed: 999,
  states,
  constraints,
  frequencies,
  entropyMode: 'weighted-shannon',
  backtrack: true
});

// Generate new dungeons in the same style
const grid = new WFCGrid2D({
  width: 25,
  height: 15,
  wfc: learnedWFC,
  boundaries: {
    perDimension: {
      north: '█',
      south: '█',
      east: '█',
      west: '█'
    }
  }
});

const generated = grid.generate();

if (generated) {
  console.log('\nGenerated dungeon from learned patterns:');
  for (const row of generated) {
    console.log(row.join(''));
  }
}

// Save learned model
import fs from 'fs';
const model = {
  version: '1.0',
  wfc: learnedWFC.toJSON(),
  metadata: {
    name: 'Learned Dungeon Generator',
    trainingExamples: 2
  }
};

fs.writeFileSync('learned-dungeon.json', JSON.stringify(model, null, 2));
console.log('\nSaved learned model to learned-dungeon.json');
```

---

## Hybrid Generation with Markov

Combine WFC and MarkovChain for powerful hybrid generation.

```typescript
import { WFC, WFCGrid2D, MarkovChain } from 'acausal';

// 1. Use Markov to learn WFC frequencies
const terrainSequences = [
  ['water', 'sand', 'grass', 'forest'],
  ['water', 'sand', 'grass', 'grass'],
  ['forest', 'grass', 'sand', 'water']
];

const terrainChain = new MarkovChain<string>({ seed: 42, order: 1 });

for (const seq of terrainSequences) {
  terrainChain.train([seq]);
}

const markovFrequencies = terrainChain.getStats().frequencyStats;

const wfc = new WFC({
  seed: 123,
  states: ['water', 'sand', 'grass', 'forest'],
  constraints: terrainConstraints,
  frequencies: markovFrequencies,  // Markov-learned frequencies!
  entropyMode: 'weighted-shannon'
});

// 2. WFC for layout, Markov for details
const layoutWFC = new WFC({
  seed: 1,
  states: ['room', 'corridor', 'empty'],
  constraints: layoutConstraints
});

const layout = new WFCGrid2D({ width: 20, height: 15, wfc: layoutWFC }).generate();

const roomChain = new MarkovChain({ seed: 2, order: 1 });
roomChain.train([
  ['empty', 'enemy', 'chest'],
  ['trap', 'enemy', 'chest']
]);

if (layout) {
  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      if (layout[y][x] === 'room') {
        const contents = roomChain.generate({ length: 3 });
        console.log(`Room at (${x},${y}):`, contents);
      }
    }
  }
}

// 3. Adaptive generation with feedback
const initial = grid.generate();

const analyzer = new MarkovChain({ seed: 1, order: 1 });
if (initial) {
  for (const row of initial) {
    analyzer.train([row]);
  }
}

const adjustedFreqs = analyzer.getStats().frequencyStats;

const refinedWFC = new WFC({
  seed: 2,
  states: originalStates,
  constraints: originalConstraints,
  frequencies: adjustedFreqs  // Adjusted from analysis!
});
```

See [examples/wfc-markov-hybrid.ts](../examples/wfc-markov-hybrid.ts) for complete examples.

---

## Additional Resources

### Examples

- [wfc-dungeon.ts](../examples/wfc-dungeon.ts) - Dungeon generation with learning and symmetry
- [wfc-terrain.ts](../examples/wfc-terrain.ts) - Multi-biome terrain generation
- [wfc-markov-hybrid.ts](../examples/wfc-markov-hybrid.ts) - Combining WFC with MarkovChain
- [performance-comparison.ts](../examples/performance-comparison.ts) - Performance benchmarks

### Documentation

- [Advanced Guide](./advanced.md) - Deep dive into all features
- [Markov Chains](./markov.md) - Sequential pattern generation
- [Distributions](./distribution.md) - Weighted random selection

### Community

- [GitHub Repository](https://github.com/abrisene/acausal)
- [Issue Tracker](https://github.com/abrisene/acausal/issues)
- [NPM Package](https://www.npmjs.com/package/acausal)

---

## What's New in v3.6

### Core Features
- Complete WFC implementation as first-class primitive
- Topology-agnostic design (2D, 3D, graphs, custom)
- 236 comprehensive tests (100% passing)

### Configuration Options
- Three entropy modes (count, shannon, weighted-shannon)
- Boundary conditions (wrap, open, fixed)
- Backtracking for contradiction recovery
- Dimension-agnostic symmetry transforms

### Learning & Integration
- WFCConstraintLearner for automatic rule extraction
- Integration with Distribution for weighted constraints
- Integration with MarkovChain for hybrid generation
- Full serialization support

### Performance
- 100x100 grids: <1000ms
- 200x200 grids: <5000ms
- Efficient propagation with queue-based algorithm
- Optimized backtracking with snapshot system

---

**Happy generating! 🎲**
