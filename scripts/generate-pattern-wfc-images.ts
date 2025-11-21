#!/usr/bin/env node
/**
 * Generate Tileset Images for WFC Documentation (Overlapping Pattern Version)
 *
 * This script generates stylish SVG visualizations demonstrating:
 * 1. Overlapping pattern WFC learning from structured examples
 * 2. Terrain generation with natural transitions
 * 3. Dungeon generation with architectural patterns
 * 4. Comparison of adjacency vs pattern-based approaches
 */

import fs from 'fs';
import path from 'path';
import { WFCPattern, WFCPatternUtils } from '../dist/index.js';

// ============================================================
// SVG PATTERN GENERATORS
// ============================================================

interface TileStyle {
  fill: string;
  pattern?: string;
}

const TILE_SIZE = 16;

// Define tile styles with modern color palettes
const TILE_STYLES: { [key: string]: TileStyle } = {
  // Terrain
  '~': { fill: '#3b82f6', pattern: 'water' },     // Water - blue
  '∴': { fill: '#fbbf24', pattern: 'sand' },       // Sand - yellow
  '▓': { fill: '#10b981', pattern: 'grass' },      // Grass - green
  '♣': { fill: '#064e3b', pattern: 'forest' },     // Forest - dark green
  '▲': { fill: '#6b7280', pattern: 'mountain' },   // Mountain - gray

  // Dungeon
  '#': { fill: '#1f2937', pattern: 'wall' },       // Wall - dark gray
  '.': { fill: '#f3f4f6', pattern: 'floor' },      // Floor - light gray
  '▓': { fill: '#92400e', pattern: 'door' },       // Door - brown
  '█': { fill: '#111827', pattern: 'solid' },      // Solid wall - black
  '·': { fill: '#e5e7eb', pattern: 'empty' },      // Empty - very light gray
};

// SVG pattern definitions
function generatePatternDefs(): string {
  return `
  <defs>
    <!-- Water pattern -->
    <pattern id="water" patternUnits="userSpaceOnUse" width="8" height="8">
      <path d="M0,4 Q2,2 4,4 T8,4" stroke="#60a5fa" stroke-width="1" fill="none" opacity="0.5"/>
    </pattern>

    <!-- Sand pattern -->
    <pattern id="sand" patternUnits="userSpaceOnUse" width="4" height="4">
      <circle cx="1" cy="1" r="0.5" fill="#f59e0b" opacity="0.3"/>
      <circle cx="3" cy="3" r="0.5" fill="#f59e0b" opacity="0.3"/>
    </pattern>

    <!-- Grass pattern -->
    <pattern id="grass" patternUnits="userSpaceOnUse" width="4" height="4">
      <line x1="1" y1="4" x2="1" y2="2" stroke="#059669" stroke-width="0.5"/>
      <line x1="3" y1="4" x2="3" y2="1" stroke="#059669" stroke-width="0.5"/>
    </pattern>

    <!-- Forest pattern -->
    <pattern id="forest" patternUnits="userSpaceOnUse" width="8" height="8">
      <polygon points="4,1 6,7 2,7" fill="#065f46" opacity="0.5"/>
    </pattern>

    <!-- Mountain pattern -->
    <pattern id="mountain" patternUnits="userSpaceOnUse" width="8" height="8">
      <polygon points="4,1 8,8 0,8" fill="#4b5563" opacity="0.3"/>
    </pattern>

    <!-- Wall pattern -->
    <pattern id="wall" patternUnits="userSpaceOnUse" width="8" height="8">
      <rect x="0" y="0" width="8" height="4" fill="#374151" opacity="0.5"/>
    </pattern>

    <!-- Floor pattern -->
    <pattern id="floor" patternUnits="userSpaceOnUse" width="16" height="16">
      <rect x="0" y="0" width="8" height="8" fill="#e5e7eb"/>
      <rect x="8" y="8" width="8" height="8" fill="#e5e7eb"/>
    </pattern>

    <!-- Door pattern -->
    <pattern id="door" patternUnits="userSpaceOnUse" width="4" height="16">
      <line x1="2" y1="0" x2="2" y2="16" stroke="#78350f" stroke-width="2"/>
    </pattern>
  </defs>
  `;
}

// Render a grid to SVG
function gridToSVG(
  grid: string[][],
  title: string,
  subtitle: string,
  width: number,
  height: number
): string {
  const svgWidth = width * TILE_SIZE + 40;
  const svgHeight = height * TILE_SIZE + 80;

  let tiles = '';
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const tile = grid[y][x];
      const style = TILE_STYLES[tile] || { fill: '#gray' };
      const px = x * TILE_SIZE + 20;
      const py = y * TILE_SIZE + 60;

      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${style.fill}"/>`;
      if (style.pattern) {
        tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="url(#${style.pattern})"/>`;
      }

      // Grid lines
      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="none" stroke="#00000010" stroke-width="0.5"/>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
  ${generatePatternDefs()}

  <!-- Background -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff"/>

  <!-- Title -->
  <text x="${svgWidth / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#111827">
    ${title}
  </text>

  <!-- Subtitle -->
  <text x="${svgWidth / 2}" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
    ${subtitle}
  </text>

  <!-- Grid -->
  ${tiles}
</svg>`;
}

// ============================================================
// EXAMPLE PATTERNS
// ============================================================

// Terrain example with clear biome transitions
const TERRAIN_EXAMPLE = `
~~~~~~~~
~∴∴∴∴∴~~
~∴▓▓▓▓∴~
~∴▓♣♣▓∴~
~∴▓♣▲♣∴~
~∴▓♣♣▓∴~
~∴▓▓▓▓∴~
~∴∴∴∴∴~~
~~~~~~~~
`.trim().split('\n').map(row => row.split(''));

// Dungeon example with structured rooms
const DUNGEON_EXAMPLE = `
####################
#..................#
#..###..###..###...#
#..#.#..#.#..#.#...#
#..###..###..###...#
#..................#
#..###..###..###...#
#..#.#..#.#..#.#...#
#..###..###..###...#
#..................#
####################
`.trim().split('\n').map(row => row.split(''));

// Platformer example with platforms and gaps
const PLATFORMER_EXAMPLE = `
................
................
###...###...####
................
..###...........
................
####..###..###..
................
`.trim().split('\n').map(row => row.split(''));

// ============================================================
// GENERATION FUNCTIONS
// ============================================================

console.log('🎨 Generating WFC Pattern Tileset Images\n');

// 1. Generate terrain with overlapping patterns
console.log('1️⃣  Generating terrain with 3x3 patterns...');

const terrainResult = WFCPattern.fromExample(TERRAIN_EXAMPLE, {
  seed: 42,
  patternSize: 3,
  outputWidth: 50,
  outputHeight: 30,
  enableRotation: false,
  enableReflection: false,
  backtrack: false,
});

if (terrainResult.success && terrainResult.grid) {
  const svg = gridToSVG(
    terrainResult.grid,
    'WFC Pattern: Terrain Generation',
    `Learned from example using ${terrainResult.metadata.totalPatterns} unique 3x3 patterns`,
    50,
    30
  );

  fs.writeFileSync('readme/images/wfc-pattern-terrain.svg', svg);
  console.log('   ✅ Saved: readme/images/wfc-pattern-terrain.svg');
  console.log(`   📊 Patterns: ${terrainResult.metadata.totalPatterns}`);

  // Count biomes
  const counts: { [key: string]: number } = {};
  for (const row of terrainResult.grid) {
    for (const tile of row) {
      counts[tile] = (counts[tile] || 0) + 1;
    }
  }
  console.log('   🌍 Biomes:', counts);
} else {
  console.log('   ❌ Failed to generate terrain');
}

// 2. Generate dungeon with overlapping patterns
console.log('\n2️⃣  Generating dungeon with 3x3 patterns...');

// Use a simpler dungeon example
const SIMPLE_DUNGEON = `
##########
#........#
#.###.##.#
#.#.....##
#.###.####
#........#
##########
`.trim().split('\n').map(row => row.split(''));

const dungeonResult = WFCPattern.fromExample(SIMPLE_DUNGEON, {
  seed: 123,
  patternSize: 3,
  outputWidth: 40,
  outputHeight: 25,
  enableRotation: false,
  enableReflection: false,
  backtrack: false,
});

if (dungeonResult.success && dungeonResult.grid) {
  // Count 3x3 pillar structures
  let pillarCount = 0;
  for (let y = 0; y < dungeonResult.grid.length - 2; y++) {
    for (let x = 0; x < (dungeonResult.grid[0]?.length || 0) - 2; x++) {
      const r0 = dungeonResult.grid[y];
      const r1 = dungeonResult.grid[y + 1];
      const r2 = dungeonResult.grid[y + 2];

      if (r0 && r1 && r2 &&
          r0[x] === '#' && r0[x + 1] === '#' && r0[x + 2] === '#' &&
          r1[x] === '#' && r1[x + 1] === '.' && r1[x + 2] === '#' &&
          r2[x] === '#' && r2[x + 1] === '#' && r2[x + 2] === '#') {
        pillarCount++;
      }
    }
  }

  const svg = gridToSVG(
    dungeonResult.grid,
    'WFC Pattern: Dungeon Generation',
    `Found ${pillarCount} complete 3x3 pillar structures from ${dungeonResult.metadata.totalPatterns} patterns`,
    40,
    25
  );

  fs.writeFileSync('readme/images/wfc-pattern-dungeon.svg', svg);
  console.log('   ✅ Saved: readme/images/wfc-pattern-dungeon.svg');
  console.log(`   📊 Patterns: ${dungeonResult.metadata.totalPatterns}`);
  console.log(`   🏛️  Pillars: ${pillarCount}`);
} else {
  console.log('   ❌ Failed to generate dungeon');
}

// 3. Generate with different pattern sizes
console.log('\n3️⃣  Generating with different pattern orders...');

const orders = [2, 3, 5];
for (const order of orders) {
  console.log(`\n   Order-${order} (${order}x${order} patterns):`);

  const result = WFCPattern.fromExample(DUNGEON_EXAMPLE, {
    seed: 42 + order,
    patternSize: order,
    outputWidth: 30,
    outputHeight: 20,
    enableRotation: false,
    enableReflection: false,
    backtrack: false,
  });

  if (result.success && result.grid) {
    const svg = gridToSVG(
      result.grid,
      `WFC Pattern: Order-${order}`,
      `Using ${order}x${order} tile patterns (${result.metadata.totalPatterns} unique patterns)`,
      30,
      20
    );

    fs.writeFileSync(`readme/images/wfc-pattern-order${order}.svg`, svg);
    console.log(`      ✅ Saved: readme/images/wfc-pattern-order${order}.svg`);
    console.log(`      📊 Unique patterns: ${result.metadata.totalPatterns}`);
  } else {
    console.log(`      ❌ Failed`);
  }
}

// 4. Generate with rotation and reflection symmetries
console.log('\n4️⃣  Generating with symmetries (rotation + reflection)...');

const symmetryResult = WFCPattern.fromExample(DUNGEON_EXAMPLE, {
  seed: 999,
  patternSize: 3,
  outputWidth: 35,
  outputHeight: 22,
  enableRotation: true,
  enableReflection: true,
  backtrack: false,
});

if (symmetryResult.success && symmetryResult.grid) {
  const svg = gridToSVG(
    symmetryResult.grid,
    'WFC Pattern: With Symmetries',
    `Using rotation and reflection (${symmetryResult.metadata.totalPatterns} patterns with symmetries)`,
    35,
    22
  );

  fs.writeFileSync('readme/images/wfc-pattern-symmetry.svg', svg);
  console.log('   ✅ Saved: readme/images/wfc-pattern-symmetry.svg');
  console.log(`   📊 Patterns: ${symmetryResult.metadata.totalPatterns}`);
} else {
  console.log('   ❌ Failed to generate with symmetries');
}

// 5. Generate side-by-side comparison of original vs learned
console.log('\n5️⃣  Generating side-by-side comparison...');

function createComparisonSVG(
  original: string[][],
  generated: string[][],
  title: string
): string {
  const origWidth = original[0]?.length || 0;
  const origHeight = original.length;
  const genWidth = generated[0]?.length || 0;
  const genHeight = generated.length;

  const svgWidth = Math.max(origWidth, genWidth) * TILE_SIZE * 2 + 60;
  const svgHeight = Math.max(origHeight, genHeight) * TILE_SIZE + 100;

  let tiles = '';

  // Original
  for (let y = 0; y < original.length; y++) {
    for (let x = 0; x < original[y].length; x++) {
      const tile = original[y][x];
      const style = TILE_STYLES[tile] || { fill: '#gray' };
      const px = x * TILE_SIZE + 20;
      const py = y * TILE_SIZE + 80;

      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${style.fill}"/>`;
      if (style.pattern) {
        tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="url(#${style.pattern})"/>`;
      }
      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="none" stroke="#00000010" stroke-width="0.5"/>`;
    }
  }

  // Generated
  const offsetX = (origWidth * TILE_SIZE) + 40;
  for (let y = 0; y < generated.length; y++) {
    for (let x = 0; x < generated[y].length; x++) {
      const tile = generated[y][x];
      const style = TILE_STYLES[tile] || { fill: '#gray' };
      const px = x * TILE_SIZE + offsetX;
      const py = y * TILE_SIZE + 80;

      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${style.fill}"/>`;
      if (style.pattern) {
        tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="url(#${style.pattern})"/>`;
      }
      tiles += `<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="none" stroke="#00000010" stroke-width="0.5"/>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
  ${generatePatternDefs()}

  <!-- Background -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff"/>

  <!-- Title -->
  <text x="${svgWidth / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#111827">
    ${title}
  </text>

  <!-- Labels -->
  <text x="${origWidth * TILE_SIZE / 2 + 20}" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#3b82f6">
    Original Example
  </text>
  <text x="${offsetX + genWidth * TILE_SIZE / 2}" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#10b981">
    Generated with WFC
  </text>

  <!-- Grids -->
  ${tiles}
</svg>`;
}

if (terrainResult.success && terrainResult.grid) {
  const comparisonSvg = createComparisonSVG(
    TERRAIN_EXAMPLE,
    terrainResult.grid.slice(0, TERRAIN_EXAMPLE.length),
    'WFC Pattern Learning: Terrain'
  );

  fs.writeFileSync('readme/images/wfc-pattern-comparison-terrain.svg', comparisonSvg);
  console.log('   ✅ Saved: readme/images/wfc-pattern-comparison-terrain.svg');
}

if (dungeonResult.success && dungeonResult.grid) {
  const comparisonSvg = createComparisonSVG(
    SIMPLE_DUNGEON,
    dungeonResult.grid.slice(0, SIMPLE_DUNGEON.length),
    'WFC Pattern Learning: Dungeon'
  );

  fs.writeFileSync('readme/images/wfc-pattern-comparison-dungeon.svg', comparisonSvg);
  console.log('   ✅ Saved: readme/images/wfc-pattern-comparison-dungeon.svg');
}

console.log('\n✅ All images generated successfully!');
console.log('\nGenerated files:');
console.log('  - wfc-pattern-terrain.svg');
console.log('  - wfc-pattern-dungeon.svg');
console.log('  - wfc-pattern-order2.svg');
console.log('  - wfc-pattern-order3.svg');
console.log('  - wfc-pattern-order5.svg');
console.log('  - wfc-pattern-symmetry.svg');
console.log('  - wfc-pattern-comparison-terrain.svg');
console.log('  - wfc-pattern-comparison-dungeon.svg');
