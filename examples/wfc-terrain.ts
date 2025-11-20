/**
 * WFC Terrain Generation Example
 *
 * This example demonstrates using Wave Function Collapse to generate
 * tile-based terrain with biomes, transitions, and natural-looking patterns.
 *
 * Run with: npx ts-node examples/wfc-terrain.ts
 */

import {WFC, WFCGrid2D, WFCConstraintLearner} from '../src';
import type {ConstraintRules} from '../src/structures/wfc-types';

// ============================================================================
// Example 1: Basic Terrain with Manual Constraints
// ============================================================================

console.log('='.repeat(60));
console.log('Example 1: Basic Terrain Generation');
console.log('='.repeat(60));

// Define terrain tiles
const WATER = '~';
const SAND = '∴';
const GRASS = '▓';
const FOREST = '♣';
const MOUNTAIN = '▲';

// Define realistic terrain constraints
const terrainConstraints: ConstraintRules = {
  [WATER]: {
    north: [WATER, SAND],
    south: [WATER, SAND],
    east: [WATER, SAND],
    west: [WATER, SAND],
  },
  [SAND]: {
    north: [WATER, SAND, GRASS],
    south: [WATER, SAND, GRASS],
    east: [WATER, SAND, GRASS],
    west: [WATER, SAND, GRASS],
  },
  [GRASS]: {
    north: [SAND, GRASS, FOREST],
    south: [SAND, GRASS, FOREST],
    east: [SAND, GRASS, FOREST],
    west: [SAND, GRASS, FOREST],
  },
  [FOREST]: {
    north: [GRASS, FOREST, MOUNTAIN],
    south: [GRASS, FOREST, MOUNTAIN],
    east: [GRASS, FOREST, MOUNTAIN],
    west: [GRASS, FOREST, MOUNTAIN],
  },
  [MOUNTAIN]: {
    north: [FOREST, MOUNTAIN],
    south: [FOREST, MOUNTAIN],
    east: [FOREST, MOUNTAIN],
    west: [FOREST, MOUNTAIN],
  },
};

// Create WFC with weighted frequencies for natural distribution
const terrainWFC = new WFC({
  seed: 42,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
  constraints: terrainConstraints,
  frequencies: {
    [WATER]: 2,
    [SAND]: 1,
    [GRASS]: 5, // Most common
    [FOREST]: 3,
    [MOUNTAIN]: 1, // Rare peaks
  },
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

// Generate terrain
const terrainGrid = new WFCGrid2D({
  width: 40,
  height: 20,
  wfc: terrainWFC,
  boundaries: 'wrap', // Toroidal world
});

const terrain = terrainGrid.generate();

if (terrain) {
  console.log('\nGenerated Terrain (40x20, wrap-around):');
  console.log(terrain.map(row => row.join('')).join('\n'));
  console.log('\nLegend: ~ Water, ∴ Sand, ▓ Grass, ♣ Forest, ▲ Mountain');
} else {
  console.log('Failed to generate terrain');
}

// ============================================================================
// Example 2: Island Generation with Fixed Water Boundaries
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 2: Island Generation');
console.log('='.repeat(60));

// Create island with water boundaries
const islandWFC = new WFC({
  seed: 12345,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
  constraints: terrainConstraints,
  frequencies: {
    [WATER]: 1,
    [SAND]: 2,
    [GRASS]: 4,
    [FOREST]: 2,
    [MOUNTAIN]: 1,
  },
  entropyMode: 'weighted-shannon',
  backtrack: {enabled: true, maxDepth: 100},
});

// Fix boundaries to water for island effect
const islandGrid = new WFCGrid2D({
  width: 30,
  height: 15,
  wfc: islandWFC,
  boundaries: {
    perDimension: {
      north: [WATER],
      south: [WATER],
      east: [WATER],
      west: [WATER],
    },
  },
});

const island = islandGrid.generate();

if (island) {
  console.log('\nGenerated Island (surrounded by water):');
  console.log(island.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate island');
}

// ============================================================================
// Example 3: Learn from Example Terrain
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 3: Learn from Hand-Crafted Terrain');
console.log('='.repeat(60));

// Hand-crafted example terrain showing desired patterns
const exampleTerrain = [
  '~~~∴∴∴∴∴∴∴∴∴~~~',
  '~~∴∴∴▓▓▓▓▓∴∴∴~~',
  '~∴∴▓▓▓▓▓▓▓▓▓∴∴~',
  '~∴▓▓▓▓♣♣▓▓▓▓▓∴~',
  '~∴▓▓♣♣♣♣♣♣▓▓▓∴~',
  '~∴▓▓♣♣▲▲♣♣▓▓▓∴~',
  '~∴▓▓♣♣♣♣♣♣▓▓▓∴~',
  '~∴▓▓▓▓♣♣▓▓▓▓▓∴~',
  '~∴∴▓▓▓▓▓▓▓▓▓∴∴~',
  '~~∴∴∴▓▓▓▓▓∴∴∴~~',
  '~~~∴∴∴∴∴∴∴∴∴~~~',
];

// Convert to 2D array
const exampleGrid = exampleTerrain.map(row => row.split(''));

// Learn constraints
console.log('\nLearning terrain patterns from example...');
const learnedConstraints = WFCConstraintLearner.learn2DConstraints([
  exampleGrid,
]);
const learnedStates = WFCConstraintLearner.extractStates([exampleGrid]);
const learnedFrequencies = WFCConstraintLearner.extractFrequencies([
  exampleGrid,
]);

console.log(`Learned ${learnedStates.length} terrain types`);
console.log('Learned frequencies:', learnedFrequencies);

// Generate terrain with learned rules
const learnedWFC = new WFC({
  seed: 54321,
  states: learnedStates,
  constraints: learnedConstraints,
  frequencies: learnedFrequencies,
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

const learnedGrid = new WFCGrid2D({
  width: 25,
  height: 12,
  wfc: learnedWFC,
  boundaries: {
    perDimension: {
      north: [WATER, SAND],
      south: [WATER, SAND],
      east: [WATER, SAND],
      west: [WATER, SAND],
    },
  },
});

const learnedTerrain = learnedGrid.generate();

if (learnedTerrain) {
  console.log('\nGenerated Terrain (from learned patterns):');
  console.log(learnedTerrain.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate terrain');
}

// ============================================================================
// Example 4: Multi-Biome World with Different Constraints
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 4: Complex Multi-Biome Terrain');
console.log('='.repeat(60));

// Add more terrain types
const DESERT = '░';
const SNOW = '❄';
const SWAMP = '≈';

// Complex constraints with more variety
const multiBiomeConstraints: ConstraintRules = {
  [WATER]: {
    north: [WATER, SAND, SWAMP],
    south: [WATER, SAND, SWAMP],
    east: [WATER, SAND, SWAMP],
    west: [WATER, SAND, SWAMP],
  },
  [SAND]: {
    north: [WATER, SAND, GRASS, DESERT],
    south: [WATER, SAND, GRASS, DESERT],
    east: [WATER, SAND, GRASS, DESERT],
    west: [WATER, SAND, GRASS, DESERT],
  },
  [GRASS]: {
    north: [SAND, GRASS, FOREST, SWAMP],
    south: [SAND, GRASS, FOREST, SWAMP],
    east: [SAND, GRASS, FOREST, SWAMP],
    west: [SAND, GRASS, FOREST, SWAMP],
  },
  [FOREST]: {
    north: [GRASS, FOREST, MOUNTAIN],
    south: [GRASS, FOREST, MOUNTAIN],
    east: [GRASS, FOREST, MOUNTAIN],
    west: [GRASS, FOREST, MOUNTAIN],
  },
  [MOUNTAIN]: {
    north: [FOREST, MOUNTAIN, SNOW],
    south: [FOREST, MOUNTAIN, SNOW],
    east: [FOREST, MOUNTAIN, SNOW],
    west: [FOREST, MOUNTAIN, SNOW],
  },
  [SNOW]: {
    north: [MOUNTAIN, SNOW],
    south: [MOUNTAIN, SNOW],
    east: [MOUNTAIN, SNOW],
    west: [MOUNTAIN, SNOW],
  },
  [DESERT]: {
    north: [SAND, DESERT],
    south: [SAND, DESERT],
    east: [SAND, DESERT],
    west: [SAND, DESERT],
  },
  [SWAMP]: {
    north: [WATER, GRASS, SWAMP],
    south: [WATER, GRASS, SWAMP],
    east: [WATER, GRASS, SWAMP],
    west: [WATER, GRASS, SWAMP],
  },
};

const multiBiomeWFC = new WFC({
  seed: 99999,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN, SNOW, DESERT, SWAMP],
  constraints: multiBiomeConstraints,
  frequencies: {
    [WATER]: 2,
    [SAND]: 1,
    [GRASS]: 5,
    [FOREST]: 3,
    [MOUNTAIN]: 1,
    [SNOW]: 1,
    [DESERT]: 2,
    [SWAMP]: 1,
  },
  entropyMode: 'weighted-shannon',
  backtrack: {enabled: true, maxDepth: 100, maxAttempts: 3000},
});

const multiBiomeGrid = new WFCGrid2D({
  width: 50,
  height: 25,
  wfc: multiBiomeWFC,
  boundaries: 'wrap', // Seamless world
});

const multiBiomeTerrain = multiBiomeGrid.generate();

if (multiBiomeTerrain) {
  console.log('\nGenerated Multi-Biome World (50x25, seamless):');
  console.log(multiBiomeTerrain.map(row => row.join('')).join('\n'));
  console.log(
    '\nLegend: ~ Water, ∴ Sand, ▓ Grass, ♣ Forest, ▲ Mountain, ❄ Snow, ░ Desert, ≈ Swamp'
  );
} else {
  console.log('Failed to generate terrain');
}

// ============================================================================
// Example 5: Generate Terrain Variations
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 5: Terrain Variations with Different Seeds');
console.log('='.repeat(60));

console.log('\nGenerating 3 terrain variations...\n');

for (let i = 0; i < 3; i++) {
  const seed = 20000 + i * 500;

  const variantWFC = new WFC({
    seed,
    states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
    constraints: terrainConstraints,
    frequencies: {
      [WATER]: 2,
      [SAND]: 1,
      [GRASS]: 4,
      [FOREST]: 2,
      [MOUNTAIN]: 1,
    },
    backtrack: true,
  });

  const variantGrid = new WFCGrid2D({
    width: 20,
    height: 10,
    wfc: variantWFC,
    boundaries: 'wrap',
  });

  const variant = variantGrid.generate();

  console.log(`Variant ${i + 1} (seed: ${seed}):`);
  if (variant) {
    console.log(variant.map(row => row.join('')).join('\n'));
  } else {
    console.log('Failed to generate');
  }
  console.log('');
}

// ============================================================================
// Performance & Statistics
// ============================================================================

console.log('='.repeat(60));
console.log('Performance Test: Large Terrain Map');
console.log('='.repeat(60));

const largeWFC = new WFC({
  seed: 88888,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN, SNOW, DESERT, SWAMP],
  constraints: multiBiomeConstraints,
  frequencies: {
    [WATER]: 2,
    [SAND]: 1,
    [GRASS]: 5,
    [FOREST]: 3,
    [MOUNTAIN]: 1,
    [SNOW]: 1,
    [DESERT]: 2,
    [SWAMP]: 1,
  },
  entropyMode: 'weighted-shannon',
  backtrack: {enabled: true, maxDepth: 150, maxAttempts: 10000},
});

const largeTerrainGrid = new WFCGrid2D({
  width: 100,
  height: 50,
  wfc: largeWFC,
  boundaries: 'wrap',
});

console.log('\nGenerating 100x50 terrain map...');
const startTime = Date.now();
const largeResult = largeTerrainGrid.generateWithResult();
const endTime = Date.now();

if (largeResult.success && largeResult.grid) {
  console.log(`\nSuccessfully generated in ${endTime - startTime}ms`);
  console.log(`Steps: ${largeResult.metadata?.steps}`);
  console.log(`Backtracks: ${largeResult.metadata?.backtracks}`);

  // Count tile types
  const tileCounts: {[key: string]: number} = {};
  for (const row of largeResult.grid) {
    for (const tile of row) {
      tileCounts[tile] = (tileCounts[tile] || 0) + 1;
    }
  }

  console.log('\nTile Distribution:');
  for (const [tile, count] of Object.entries(tileCounts)) {
    const percentage = ((count / (100 * 50)) * 100).toFixed(1);
    console.log(`  ${tile}: ${count} tiles (${percentage}%)`);
  }

  console.log('\nFirst 15 rows preview:');
  const preview = largeResult.grid.slice(0, 15);
  console.log(preview.map(row => row.join('')).join('\n'));
} else {
  console.log(`Failed after ${endTime - startTime}ms`);
  console.log(`Error: ${largeResult.error}`);
}

console.log('\n' + '='.repeat(60));
console.log('Terrain Generation Examples Complete!');
console.log('='.repeat(60));
