/**
 * WFC Dungeon Generation Example
 *
 * This example demonstrates using Wave Function Collapse to generate
 * dungeon layouts with rooms, corridors, and walls.
 *
 * Run with: npx ts-node examples/wfc-dungeon.ts
 */

import {WFC, WFCGrid2D, WFCConstraintLearner} from '../src';
import type {ConstraintRules} from '../src/structures/wfc-types';

// ============================================================================
// Example 1: Simple Dungeon with Manual Constraints
// ============================================================================

console.log('='.repeat(60));
console.log('Example 1: Simple Dungeon with Manual Constraints');
console.log('='.repeat(60));

// Define dungeon tiles
const WALL = '█';
const FLOOR = '·';
const DOOR = '▓';
const CORRIDOR = '░';

// Define constraints manually
const dungeonConstraints: ConstraintRules = {
  [WALL]: {
    north: [WALL, DOOR],
    south: [WALL, DOOR],
    east: [WALL, DOOR],
    west: [WALL, DOOR],
  },
  [FLOOR]: {
    north: [FLOOR, CORRIDOR, DOOR],
    south: [FLOOR, CORRIDOR, DOOR],
    east: [FLOOR, CORRIDOR, DOOR],
    west: [FLOOR, CORRIDOR, DOOR],
  },
  [DOOR]: {
    north: [WALL, FLOOR, CORRIDOR],
    south: [WALL, FLOOR, CORRIDOR],
    east: [WALL, FLOOR, CORRIDOR],
    west: [WALL, FLOOR, CORRIDOR],
  },
  [CORRIDOR]: {
    north: [CORRIDOR, FLOOR, DOOR],
    south: [CORRIDOR, FLOOR, DOOR],
    east: [CORRIDOR, FLOOR, DOOR],
    west: [CORRIDOR, FLOOR, DOOR],
  },
};

// Create WFC instance
const dungeonWFC = new WFC({
  seed: 12345,
  states: [WALL, FLOOR, DOOR, CORRIDOR],
  constraints: dungeonConstraints,
  frequencies: {
    [WALL]: 3, // More walls
    [FLOOR]: 4, // Open rooms
    [DOOR]: 1, // Rare doors
    [CORRIDOR]: 2, // Some corridors
  },
  entropyMode: 'weighted-shannon',
  backtrack: true, // Enable backtracking for better results
});

// Generate dungeon
const dungeonGrid = new WFCGrid2D({
  width: 30,
  height: 15,
  wfc: dungeonWFC,
  boundaries: 'fixed', // Fix boundaries to walls
});

const dungeon = dungeonGrid.generate();

if (dungeon) {
  console.log('\nGenerated Dungeon:');
  console.log(dungeon.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate dungeon (contradiction)');
}

// ============================================================================
// Example 2: Learn from Hand-Crafted Dungeon
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 2: Learn Constraints from Example Dungeon');
console.log('='.repeat(60));

// Hand-crafted dungeon example
const exampleDungeon = [
  '███████████████',
  '█·············█',
  '█·█████·█████·█',
  '█·█···█·█···█·█',
  '█·█·█·█·█·█·█·█',
  '█···█···█·█···█',
  '█████▓███▓█████',
  '█···█···█·█···█',
  '█·█·█·█·█·█·█·█',
  '█·█···█·█···█·█',
  '█·█████·█████·█',
  '█·············█',
  '███████████████',
];

// Convert string rows to 2D array
const exampleGrid = exampleDungeon.map(row => row.split(''));

// Learn constraints
console.log('\nLearning constraints from example...');
const learnedConstraints = WFCConstraintLearner.learn2DConstraints([
  exampleGrid,
]);
const learnedStates = WFCConstraintLearner.extractStates([exampleGrid]);

console.log(`Learned ${learnedStates.length} states`);
console.log(
  `Learned ${Object.keys(learnedConstraints).length} constraint rules`
);

// Create WFC with learned constraints
const learnedWFC = new WFC({
  seed: 54321,
  states: learnedStates,
  constraints: learnedConstraints,
  entropyMode: 'shannon',
  backtrack: {enabled: true, maxDepth: 50},
});

// Generate similar dungeon
const learnedGrid = new WFCGrid2D({
  width: 20,
  height: 12,
  wfc: learnedWFC,
  boundaries: {
    perDimension: {
      north: WALL,
      south: WALL,
      east: WALL,
      west: WALL,
    },
  },
});

const learnedDungeon = learnedGrid.generate();

if (learnedDungeon) {
  console.log('\nGenerated Dungeon (from learned rules):');
  console.log(learnedDungeon.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate dungeon (contradiction)');
}

// ============================================================================
// Example 3: Multi-Room Dungeon with Symmetry
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 3: Symmetric Dungeon Layout');
console.log('='.repeat(60));

import {WFCSymmetry, SYMMETRY_PRESETS} from '../src/structures/wfc-symmetry';

// Define simple room constraints
const roomConstraints: ConstraintRules = {
  [WALL]: {
    north: [WALL],
    south: [FLOOR, DOOR], // Walls can have floor below
    east: [WALL, FLOOR], // Partial constraint
  },
  [FLOOR]: {
    north: [FLOOR, WALL, DOOR],
    south: [FLOOR],
  },
  [DOOR]: {
    north: [WALL],
    south: [FLOOR],
  },
};

// Apply rotational symmetry to fill in missing constraints
console.log('\nApplying 90° rotation symmetry...');
let symmetricConstraints = WFCSymmetry.applyTransform(
  roomConstraints,
  SYMMETRY_PRESETS.grid2D.rotate90
);

// Apply another rotation
symmetricConstraints = WFCSymmetry.applyTransform(
  symmetricConstraints,
  SYMMETRY_PRESETS.grid2D.rotate180
);

console.log('Constraints now cover all 4 directions with symmetry');

// Create WFC with symmetric constraints
const symmetricWFC = new WFC({
  seed: 99999,
  states: [WALL, FLOOR, DOOR],
  constraints: symmetricConstraints,
  frequencies: {
    [WALL]: 2,
    [FLOOR]: 5,
    [DOOR]: 1,
  },
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

// Generate symmetric dungeon
const symmetricGrid = new WFCGrid2D({
  width: 25,
  height: 12,
  wfc: symmetricWFC,
  boundaries: {
    default: 'open',
    perDimension: {
      north: [WALL],
      south: [WALL],
    },
  },
});

const symmetricDungeon = symmetricGrid.generate();

if (symmetricDungeon) {
  console.log('\nGenerated Symmetric Dungeon:');
  console.log(symmetricDungeon.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate dungeon (contradiction)');
}

// ============================================================================
// Example 4: Generate Multiple Dungeon Variations
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 4: Multiple Dungeon Variations');
console.log('='.repeat(60));

console.log('\nGenerating 3 dungeon variations with different seeds...\n');

for (let i = 0; i < 3; i++) {
  const seed = 10000 + i * 1000;

  const variantWFC = new WFC({
    seed,
    states: [WALL, FLOOR, DOOR, CORRIDOR],
    constraints: dungeonConstraints,
    frequencies: {
      [WALL]: 3,
      [FLOOR]: 4,
      [DOOR]: 1,
      [CORRIDOR]: 2,
    },
    backtrack: true,
  });

  const variantGrid = new WFCGrid2D({
    width: 20,
    height: 8,
    wfc: variantWFC,
    boundaries: 'fixed',
  });

  const variant = variantGrid.generate();

  console.log(`Variant ${i + 1} (seed: ${seed}):`);
  if (variant) {
    console.log(variant.map(row => row.join('')).join('\n'));
  } else {
    console.log('Failed to generate (contradiction)');
  }
  console.log('');
}

// ============================================================================
// Performance Stats
// ============================================================================

console.log('='.repeat(60));
console.log('Performance Test: Large Dungeon');
console.log('='.repeat(60));

const largeWFC = new WFC({
  seed: 77777,
  states: [WALL, FLOOR, DOOR, CORRIDOR],
  constraints: dungeonConstraints,
  frequencies: {
    [WALL]: 3,
    [FLOOR]: 4,
    [DOOR]: 1,
    [CORRIDOR]: 2,
  },
  backtrack: {enabled: true, maxDepth: 100, maxAttempts: 5000},
});

const largeGrid = new WFCGrid2D({
  width: 50,
  height: 30,
  wfc: largeWFC,
  boundaries: 'fixed',
});

const startTime = Date.now();
const result = largeGrid.generateWithResult();
const endTime = Date.now();

if (result.success && result.grid) {
  console.log(`\nSuccessfully generated 50x30 dungeon in ${endTime - startTime}ms`);
  console.log(`Steps: ${result.metadata?.steps}`);
  console.log(`Backtracks: ${result.metadata?.backtracks}`);
  console.log('\nFirst 10 rows:');
  const preview = result.grid.slice(0, 10);
  console.log(preview.map(row => row.join('')).join('\n'));
} else {
  console.log(`Failed after ${endTime - startTime}ms`);
  console.log(`Error: ${result.error}`);
}

console.log('\n' + '='.repeat(60));
console.log('Dungeon Generation Examples Complete!');
console.log('='.repeat(60));
