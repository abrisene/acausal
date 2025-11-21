#!/usr/bin/env node
/**
 * Generate WFC demonstrations using ACTUAL tile patterns where WFC excels:
 * - Hand-designed game levels
 * - Terrain blending with smooth transitions
 * - Architectural patterns (corners, edges, fills)
 */

import {WFC, WFCGrid2D, WFCConstraintLearner} from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// HAND-DESIGNED ROGUELIKE DUNGEON LEVEL (like real game design)
// ============================================================================

/**
 * A hand-crafted dungeon room with proper architecture
 * This is the kind of input WFC works GREAT with
 */
const HANDCRAFTED_DUNGEON = `
####################
#..................#
#.####......####...#
#.#..#......#..#...#
#.#..#......#..#...#
#.#..########..#...#
#.#............#...#
#.##############...#
#..................#
#...####...####....#
#...#..#...#..#....#
#...#..#...#..#....#
#...#..#####..#....#
#...#.........#....#
#...###########....#
#..................#
####################
`.trim();

/**
 * Parse ASCII map to grid
 */
function parseASCII(ascii: string): string[][] {
  return ascii.split('\n').map(line => line.split(''));
}

/**
 * Generate SVG with proper styling
 */
function generateStyledSVG(
  grid: string[][],
  palette: {[key: string]: {fill: string; stroke?: string}},
  tileSize: number = 20,
  title?: string
): string {
  const width = grid[0].length * tileSize;
  const height = grid.length * tileSize;

  let tiles = '';
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const state = grid[y][x];
      const style = palette[state] || {fill: '#666666'};

      tiles += `
        <rect x="${x * tileSize}" y="${y * tileSize}"
              width="${tileSize}" height="${tileSize}"
              fill="${style.fill}"
              stroke="${style.stroke || '#ffffff'}"
              stroke-width="0.5"/>
      `;
    }
  }

  const titleText = title ? `
    <text x="10" y="30" font-size="18" fill="#ffffff" font-weight="bold">
      ${title}
    </text>
  ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height + 50}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height + 50}" fill="#1a1a1a"/>
  ${titleText}
  <g transform="translate(0, ${title ? 40 : 0})">
    ${tiles}
  </g>
</svg>`;
}

/**
 * Create a larger hand-designed dungeon with varied patterns
 */
const LARGE_HANDCRAFTED = `
################################
#..............................#
#.#####.#####.#####.#####......#
#.#...#.#...#.#...#.#...#......#
#.#...#.#...#.#...#.#...#......#
#.#...###...###...###...#......#
#.#.........................####
#.#.........................#..#
#.#######################...#..#
#.......................#...#..#
#.#####.#####.#####.####....#..#
#.#...#.#...#.#...#.#.......####
#.#...#.#...#.#...#.#..........#
#.#...###...###...###..........#
#.#............................#
#.##############################
#..............................#
################################
`.trim();

function generateDungeonExample() {
  console.log('🏰 Generating from hand-designed dungeon levels...');

  const dungeon1 = parseASCII(HANDCRAFTED_DUNGEON);
  const dungeon2 = parseASCII(LARGE_HANDCRAFTED);

  const palette = {
    '#': {fill: '#3A3A3A', stroke: '#555555'},
    '.': {fill: '#C4B5A0', stroke: '#D4C5B0'},
  };

  // Save original
  const originalSVG = generateStyledSVG(
    dungeon1,
    palette,
    25,
    'Original Hand-Designed Level'
  );
  fs.writeFileSync(
    path.join('readme', 'images', 'handcrafted-original.svg'),
    originalSVG
  );
  console.log('  ✓ Original hand-crafted dungeon');

  // Learn from both examples
  const constraints = WFCConstraintLearner.learn2DConstraints([
    dungeon1,
    dungeon2,
  ]);

  console.log('  Learned constraints:');
  console.log(`    Wall (#): can be adjacent to: ${JSON.stringify(constraints['#'])}`);
  console.log(`    Floor (.): can be adjacent to: ${JSON.stringify(constraints['.'])}`);

  // Generate new levels using learned patterns
  const wfc = new WFC({
    seed: 42,
    states: ['#', '.'],
    constraints,
    backtrack: {maxAttempts: 1000},
  });

  const grid = new WFCGrid2D({wfc, width: 32, height: 24});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const learnedSVG = generateStyledSVG(
      result.grid,
      palette,
      25,
      'WFC Learned from Hand-Designed Levels'
    );
    fs.writeFileSync(
      path.join('readme', 'images', 'handcrafted-learned.svg'),
      learnedSVG
    );
    console.log('  ✓ WFC learned dungeon patterns');
    console.log(`  Generated ${result.grid.length}x${result.grid[0].length} level`);
  } else {
    console.log('  ✗ Failed to generate learned dungeon');
  }
}

// ============================================================================
// TERRAIN BLENDING (WFC's bread and butter)
// ============================================================================

/**
 * Hand-designed terrain with proper transitions
 */
const TERRAIN_EXAMPLE_1 = `
WWWWWWWWWWWWWW
WWWWSSSSSSSSSS
WWSSSSGGGGGGGG
WSSSGGGGGGGGGG
WSSGGGGGGGGGGG
WSGGGGGGGGGGFF
WSGGGGGGGGGFFF
WSGGGGGGGGGFFF
WSGGGGGGGGGGFF
WSSGGGGGGGGGGG
WSSSGGGGGGGGGG
WWSSSSGGGGGGGG
WWWWSSSSSSSSSS
WWWWWWWWWWWWWW
`.trim();

const TERRAIN_EXAMPLE_2 = `
GGGGGGGGGGGGGG
GGGGGGGGGGGGGG
GGGGGGGGFFFGGG
GGGGGGGGFFFGGG
GGGGGGGGFFFGGG
GGGGGGSSSSSGGG
GGGGGGSSSSSGG
GGGGGGSSSSSGG
GGGGGGSSSSSGGG
GGGGGGGGGGGGGG
GGGGGGGGGGGGGG
GGGGGGGGGGGGGG
GGGGGGGGGGGGGG
GGGGGGGGGGGGGG
`.trim();

function generateTerrainExample() {
  console.log('🌍 Generating smooth terrain transitions...');

  const terrain1 = parseASCII(TERRAIN_EXAMPLE_1);
  const terrain2 = parseASCII(TERRAIN_EXAMPLE_2);

  const palette = {
    W: {fill: '#2E5266', stroke: '#4A7C8C'},
    S: {fill: '#E8C468', stroke: '#F4D58D'},
    G: {fill: '#6B9A3F', stroke: '#8BC34A'},
    F: {fill: '#2D5016', stroke: '#4A7C2C'},
  };

  // Save original
  const originalSVG = generateStyledSVG(
    terrain1,
    palette,
    30,
    'Original Terrain Design'
  );
  fs.writeFileSync(
    path.join('readme', 'images', 'terrain-original.svg'),
    originalSVG
  );
  console.log('  ✓ Original terrain pattern');

  // Learn constraints
  const constraints = WFCConstraintLearner.learn2DConstraints([
    terrain1,
    terrain2,
  ]);

  console.log('  Learned terrain transitions:');
  console.log(`    Water (W) → ${JSON.stringify(constraints['W'])}`);
  console.log(`    Sand (S) → ${JSON.stringify(constraints['S'])}`);
  console.log(`    Grass (G) → ${JSON.stringify(constraints['G'])}`);
  console.log(`    Forest (F) → ${JSON.stringify(constraints['F'])}`);

  // Generate with learned patterns
  const wfc = new WFC({
    seed: 123,
    states: ['W', 'S', 'G', 'F'],
    constraints,
    frequencies: {W: 1, S: 1, G: 2, F: 1},
    entropyMode: 'weighted-shannon',
    backtrack: {maxAttempts: 1000},
  });

  const grid = new WFCGrid2D({wfc, width: 40, height: 30});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const learnedSVG = generateStyledSVG(
      result.grid,
      palette,
      20,
      'WFC Learned Terrain Blending'
    );
    fs.writeFileSync(
      path.join('readme', 'images', 'terrain-learned.svg'),
      learnedSVG
    );
    console.log('  ✓ WFC learned terrain transitions');

    // Analyze smoothness
    let transitionCount = 0;
    for (let y = 0; y < result.grid.length - 1; y++) {
      for (let x = 0; x < result.grid[y].length - 1; x++) {
        if (result.grid[y][x] !== result.grid[y][x + 1]) transitionCount++;
        if (result.grid[y][x] !== result.grid[y + 1][x]) transitionCount++;
      }
    }
    console.log(`  Smooth transitions: ${transitionCount} tile boundaries`);
  } else {
    console.log('  ✗ Failed to generate learned terrain');
  }
}

// ============================================================================
// PLATFORMER LEVEL PATTERNS
// ============================================================================

/**
 * Hand-designed platformer section
 */
const PLATFORMER_SECTION = `
....................
....................
.........PPP........
.........P.P........
..PPP....P.P....PPP.
..P.P....PPP....P.P.
..P.P...........P.P.
..PPP...........PPP.
....................
....................
SSSSSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSSSSS
`.trim();

function generatePlatformerExample() {
  console.log('🎮 Generating platformer level patterns...');

  const platformer = parseASCII(PLATFORMER_SECTION);

  const palette = {
    '.': {fill: '#87CEEB', stroke: '#A0D8F0'},
    P: {fill: '#8B4513', stroke: '#A0522D'},
    S: {fill: '#654321', stroke: '#7A5230'},
  };

  // Save original
  const originalSVG = generateStyledSVG(
    platformer,
    palette,
    25,
    'Original Platformer Design'
  );
  fs.writeFileSync(
    path.join('readme', 'images', 'platformer-original.svg'),
    originalSVG
  );
  console.log('  ✓ Original platformer section');

  // Learn patterns
  const constraints = WFCConstraintLearner.learn2DConstraints([platformer]);

  // Generate new sections
  const wfc = new WFC({
    seed: 789,
    states: ['.', 'P', 'S'],
    constraints,
    backtrack: {maxAttempts: 1000},
  });

  const grid = new WFCGrid2D({wfc, width: 30, height: 15});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const learnedSVG = generateStyledSVG(
      result.grid,
      palette,
      25,
      'WFC Generated Platformer Section'
    );
    fs.writeFileSync(
      path.join('readme', 'images', 'platformer-learned.svg'),
      learnedSVG
    );
    console.log('  ✓ WFC learned platformer patterns');
  } else {
    console.log('  ✗ Failed to generate platformer');
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

console.log('🎨 Generating REAL WFC Demonstrations\n');
console.log('(Using hand-designed examples where WFC actually excels)\n');

generateDungeonExample();
console.log('');
generateTerrainExample();
console.log('');
generatePlatformerExample();

console.log('\n✨ Real WFC demonstrations complete!');
console.log('\nKey Insight: WFC learns LOCAL tile adjacency patterns,');
console.log('not global structure. Works best with:');
console.log('  - Hand-designed game levels');
console.log('  - Terrain transitions');
console.log('  - Architectural tile patterns');
console.log('  - Any content where local rules define the structure\n');
