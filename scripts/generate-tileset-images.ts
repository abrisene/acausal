#!/usr/bin/env node
/**
 * Generate stylish SVG tileset visualizations for WFC documentation
 */

import {WFC, WFCGrid2D, WFCConstraintLearner} from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Modern color palettes
const PALETTES = {
  terrain: {
    water: {fill: '#2E5266', accent: '#4A7C8C', pattern: 'waves'},
    sand: {fill: '#E8C468', accent: '#F4D58D', pattern: 'dots'},
    grass: {fill: '#6B9A3F', accent: '#8BC34A', pattern: 'grass'},
    forest: {fill: '#2D5016', accent: '#4A7C2C', pattern: 'trees'},
    mountain: {fill: '#6B7A8F', accent: '#95A3B3', pattern: 'peaks'},
  },
  dungeon: {
    wall: {fill: '#3A3A3A', accent: '#555555', pattern: 'brick'},
    floor: {fill: '#C4B5A0', accent: '#D4C5B0', pattern: 'tiles'},
    door: {fill: '#8B4513', accent: '#A0522D', pattern: 'wood'},
    corridor: {fill: '#A89F91', accent: '#B8AFA1', pattern: 'stone'},
  },
  circuit: {
    wire: {fill: '#00D9FF', accent: '#33E0FF', pattern: 'lines'},
    node: {fill: '#FF6B9D', accent: '#FF8BB3', pattern: 'circle'},
    gate: {fill: '#FFA500', accent: '#FFB833', pattern: 'square'},
    empty: {fill: '#1A1A2E', accent: '#25254A', pattern: 'grid'},
  },
  abstract: {
    A: {fill: '#FF6B6B', accent: '#FF8787', pattern: 'diagonal1'},
    B: {fill: '#4ECDC4', accent: '#6ED9D1', pattern: 'diagonal2'},
    C: {fill: '#45B7D1', accent: '#67C5DA', pattern: 'circles'},
    D: {fill: '#FFA07A', accent: '#FFB599', pattern: 'squares'},
    E: {fill: '#98D8C8', accent: '#B0E0D0', pattern: 'waves'},
  },
};

interface TileStyle {
  fill: string;
  accent: string;
  pattern: string;
}

/**
 * Generate SVG pattern definitions
 */
function generatePatterns(): string {
  return `
    <defs>
      <!-- Wave pattern -->
      <pattern id="waves" patternUnits="userSpaceOnUse" width="20" height="10">
        <path d="M0 5 Q 5 0, 10 5 T 20 5" stroke="white" stroke-width="1" fill="none" opacity="0.3"/>
      </pattern>

      <!-- Dots pattern -->
      <pattern id="dots" patternUnits="userSpaceOnUse" width="10" height="10">
        <circle cx="5" cy="5" r="1.5" fill="white" opacity="0.4"/>
      </pattern>

      <!-- Grass pattern -->
      <pattern id="grass" patternUnits="userSpaceOnUse" width="8" height="12">
        <line x1="2" y1="12" x2="2" y2="6" stroke="white" stroke-width="1" opacity="0.3"/>
        <line x1="6" y1="12" x2="6" y2="4" stroke="white" stroke-width="1" opacity="0.3"/>
      </pattern>

      <!-- Trees pattern -->
      <pattern id="trees" patternUnits="userSpaceOnUse" width="16" height="16">
        <circle cx="8" cy="12" r="4" fill="white" opacity="0.2"/>
        <rect x="7" y="12" width="2" height="4" fill="white" opacity="0.3"/>
      </pattern>

      <!-- Mountain peaks pattern -->
      <pattern id="peaks" patternUnits="userSpaceOnUse" width="20" height="15">
        <path d="M0 15 L 5 5 L 10 15 L 15 8 L 20 15" stroke="white" stroke-width="1.5" fill="none" opacity="0.3"/>
      </pattern>

      <!-- Brick pattern -->
      <pattern id="brick" patternUnits="userSpaceOnUse" width="20" height="10">
        <rect x="0" y="0" width="10" height="5" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
        <rect x="10" y="0" width="10" height="5" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
        <rect x="-5" y="5" width="10" height="5" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
        <rect x="5" y="5" width="10" height="5" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
        <rect x="15" y="5" width="10" height="5" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
      </pattern>

      <!-- Floor tiles pattern -->
      <pattern id="tiles" patternUnits="userSpaceOnUse" width="15" height="15">
        <rect x="0" y="0" width="15" height="15" stroke="white" stroke-width="0.5" fill="none" opacity="0.2"/>
        <line x1="0" y1="7.5" x2="15" y2="7.5" stroke="white" stroke-width="0.3" opacity="0.15"/>
        <line x1="7.5" y1="0" x2="7.5" y2="15" stroke="white" stroke-width="0.3" opacity="0.15"/>
      </pattern>

      <!-- Wood grain pattern -->
      <pattern id="wood" patternUnits="userSpaceOnUse" width="30" height="8">
        <path d="M0 4 Q 7.5 2, 15 4 T 30 4" stroke="white" stroke-width="1" fill="none" opacity="0.2"/>
        <path d="M0 6 Q 7.5 4, 15 6 T 30 6" stroke="white" stroke-width="0.5" fill="none" opacity="0.15"/>
      </pattern>

      <!-- Stone pattern -->
      <pattern id="stone" patternUnits="userSpaceOnUse" width="25" height="25">
        <circle cx="8" cy="8" r="3" stroke="white" stroke-width="0.5" fill="none" opacity="0.2"/>
        <circle cx="18" cy="15" r="2.5" stroke="white" stroke-width="0.5" fill="none" opacity="0.2"/>
      </pattern>

      <!-- Circuit lines pattern -->
      <pattern id="lines" patternUnits="userSpaceOnUse" width="20" height="20">
        <line x1="0" y1="10" x2="20" y2="10" stroke="white" stroke-width="1.5" opacity="0.4"/>
        <circle cx="10" cy="10" r="2" fill="white" opacity="0.5"/>
      </pattern>

      <!-- Circuit node pattern -->
      <pattern id="circle" patternUnits="userSpaceOnUse" width="20" height="20">
        <circle cx="10" cy="10" r="6" stroke="white" stroke-width="1.5" fill="none" opacity="0.4"/>
        <circle cx="10" cy="10" r="3" fill="white" opacity="0.5"/>
      </pattern>

      <!-- Circuit gate pattern -->
      <pattern id="square" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect x="5" y="5" width="10" height="10" stroke="white" stroke-width="1.5" fill="none" opacity="0.4"/>
        <rect x="8" y="8" width="4" height="4" fill="white" opacity="0.5"/>
      </pattern>

      <!-- Circuit grid pattern -->
      <pattern id="grid" patternUnits="userSpaceOnUse" width="10" height="10">
        <line x1="0" y1="0" x2="0" y2="10" stroke="white" stroke-width="0.3" opacity="0.2"/>
        <line x1="0" y1="0" x2="10" y2="0" stroke="white" stroke-width="0.3" opacity="0.2"/>
      </pattern>

      <!-- Diagonal patterns -->
      <pattern id="diagonal1" patternUnits="userSpaceOnUse" width="10" height="10">
        <line x1="0" y1="0" x2="10" y2="10" stroke="white" stroke-width="1.5" opacity="0.3"/>
      </pattern>

      <pattern id="diagonal2" patternUnits="userSpaceOnUse" width="10" height="10">
        <line x1="10" y1="0" x2="0" y2="10" stroke="white" stroke-width="1.5" opacity="0.3"/>
      </pattern>

      <!-- Circle scatter pattern -->
      <pattern id="circles" patternUnits="userSpaceOnUse" width="15" height="15">
        <circle cx="5" cy="5" r="2" fill="white" opacity="0.3"/>
        <circle cx="12" cy="10" r="1.5" fill="white" opacity="0.3"/>
      </pattern>

      <!-- Square scatter pattern -->
      <pattern id="squares" patternUnits="userSpaceOnUse" width="12" height="12">
        <rect x="2" y="2" width="3" height="3" fill="white" opacity="0.3"/>
        <rect x="7" y="7" width="2" height="2" fill="white" opacity="0.3"/>
      </pattern>
    </defs>
  `;
}

/**
 * Render a single tile with gradient and pattern
 */
function renderTile(
  state: string,
  x: number,
  y: number,
  size: number,
  style: TileStyle
): string {
  const gradientId = `grad-${state}-${x}-${y}`;

  return `
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${style.fill};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${style.accent};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect
      x="${x}"
      y="${y}"
      width="${size}"
      height="${size}"
      fill="url(#${gradientId})"
      stroke="#ffffff"
      stroke-width="1"
      stroke-opacity="0.3"
    />
    <rect
      x="${x}"
      y="${y}"
      width="${size}"
      height="${size}"
      fill="url(#${style.pattern})"
    />
  `;
}

/**
 * Generate a complete SVG from a WFC grid result
 */
function generateSVG(
  grid: string[][],
  palette: {[state: string]: TileStyle},
  tileSize: number = 40
): string {
  const width = grid[0].length * tileSize;
  const height = grid.length * tileSize;

  let tiles = '';
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const state = grid[y][x];
      const style = palette[state];
      if (style) {
        tiles += renderTile(state, x * tileSize, y * tileSize, tileSize, style);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${generatePatterns()}
  <rect width="${width}" height="${height}" fill="#f8f9fa"/>
  ${tiles}
</svg>`;
}

/**
 * Generate terrain tileset
 */
function generateTerrainTileset() {
  console.log('Generating terrain tileset...');

  const constraints = {
    water: {
      north: ['water', 'sand'],
      south: ['water', 'sand'],
      east: ['water', 'sand'],
      west: ['water', 'sand'],
    },
    sand: {
      north: ['water', 'sand', 'grass'],
      south: ['water', 'sand', 'grass'],
      east: ['water', 'sand', 'grass'],
      west: ['water', 'sand', 'grass'],
    },
    grass: {
      north: ['sand', 'grass', 'forest'],
      south: ['sand', 'grass', 'forest'],
      east: ['sand', 'grass', 'forest'],
      west: ['sand', 'grass', 'forest'],
    },
    forest: {
      north: ['grass', 'forest', 'mountain'],
      south: ['grass', 'forest', 'mountain'],
      east: ['grass', 'forest', 'mountain'],
      west: ['grass', 'forest', 'mountain'],
    },
    mountain: {
      north: ['forest', 'mountain'],
      south: ['forest', 'mountain'],
      east: ['forest', 'mountain'],
      west: ['forest', 'mountain'],
    },
  };

  const wfc = new WFC({
    seed: 42,
    states: ['water', 'sand', 'grass', 'forest', 'mountain'],
    constraints,
    frequencies: {water: 1.5, sand: 1.2, grass: 2, forest: 1.3, mountain: 0.8},
    entropyMode: 'weighted-shannon',
  });

  const grid = new WFCGrid2D({wfc, width: 20, height: 15});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const svg = generateSVG(result.grid, PALETTES.terrain);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-terrain.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-terrain.svg');
  }
}

/**
 * Generate dungeon tileset
 */
function generateDungeonTileset() {
  console.log('Generating dungeon tileset...');

  const constraints = {
    wall: {
      north: ['wall', 'door'],
      south: ['wall', 'door'],
      east: ['wall', 'door'],
      west: ['wall', 'door'],
    },
    floor: {
      north: ['floor', 'corridor', 'door'],
      south: ['floor', 'corridor', 'door'],
      east: ['floor', 'corridor', 'door'],
      west: ['floor', 'corridor', 'door'],
    },
    door: {
      north: ['wall', 'floor', 'corridor'],
      south: ['wall', 'floor', 'corridor'],
      east: ['wall', 'floor', 'corridor'],
      west: ['wall', 'floor', 'corridor'],
    },
    corridor: {
      north: ['floor', 'corridor', 'door'],
      south: ['floor', 'corridor', 'door'],
      east: ['floor', 'corridor', 'door'],
      west: ['floor', 'corridor', 'door'],
    },
  };

  const wfc = new WFC({
    seed: 123,
    states: ['wall', 'floor', 'door', 'corridor'],
    constraints,
    frequencies: {wall: 2, floor: 3, door: 0.5, corridor: 1.5},
    entropyMode: 'weighted-shannon',
  });

  const grid = new WFCGrid2D({wfc, width: 24, height: 16});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const svg = generateSVG(result.grid, PALETTES.dungeon);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-dungeon.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-dungeon.svg');
  }
}

/**
 * Generate circuit/tech tileset
 */
function generateCircuitTileset() {
  console.log('Generating circuit tileset...');

  const constraints = {
    empty: {
      north: ['empty', 'wire', 'node'],
      south: ['empty', 'wire', 'node'],
      east: ['empty', 'wire', 'node'],
      west: ['empty', 'wire', 'node'],
    },
    wire: {
      north: ['empty', 'wire', 'node', 'gate'],
      south: ['empty', 'wire', 'node', 'gate'],
      east: ['empty', 'wire', 'node', 'gate'],
      west: ['empty', 'wire', 'node', 'gate'],
    },
    node: {
      north: ['wire', 'node', 'gate'],
      south: ['wire', 'node', 'gate'],
      east: ['wire', 'node', 'gate'],
      west: ['wire', 'node', 'gate'],
    },
    gate: {
      north: ['wire', 'node', 'gate'],
      south: ['wire', 'node', 'gate'],
      east: ['wire', 'node', 'gate'],
      west: ['wire', 'node', 'gate'],
    },
  };

  const wfc = new WFC({
    seed: 789,
    states: ['empty', 'wire', 'node', 'gate'],
    constraints,
    frequencies: {empty: 2, wire: 2.5, node: 1, gate: 0.8},
    entropyMode: 'weighted-shannon',
  });

  const grid = new WFCGrid2D({wfc, width: 22, height: 16});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const svg = generateSVG(result.grid, PALETTES.circuit);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-circuit.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-circuit.svg');
  }
}

/**
 * Generate abstract pattern tileset
 */
function generateAbstractTileset() {
  console.log('Generating abstract pattern tileset...');

  // Simple symmetric constraints that are more likely to succeed
  const constraints = {
    A: {
      north: ['A', 'B'],
      south: ['A', 'B'],
      east: ['A', 'C'],
      west: ['A', 'C'],
    },
    B: {
      north: ['A', 'B', 'D'],
      south: ['A', 'B', 'D'],
      east: ['B', 'C'],
      west: ['B', 'C'],
    },
    C: {
      north: ['C', 'D'],
      south: ['C', 'D'],
      east: ['A', 'B', 'C', 'E'],
      west: ['A', 'B', 'C', 'E'],
    },
    D: {
      north: ['B', 'C', 'D', 'E'],
      south: ['B', 'C', 'D', 'E'],
      east: ['D', 'E'],
      west: ['D', 'E'],
    },
    E: {
      north: ['D', 'E'],
      south: ['D', 'E'],
      east: ['C', 'D', 'E'],
      west: ['C', 'D', 'E'],
    },
  };

  const wfc = new WFC({
    seed: 456,
    states: ['A', 'B', 'C', 'D', 'E'],
    constraints,
    entropyMode: 'shannon',
    backtrack: {maxAttempts: 100},
  });

  const grid = new WFCGrid2D({wfc, width: 25, height: 18});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const svg = generateSVG(result.grid, PALETTES.abstract);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-abstract.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-abstract.svg');
  }
}

/**
 * Generate a learned pattern from an example
 */
function generateLearnedTileset() {
  console.log('Generating learned pattern tileset...');

  // Create a simple example pattern
  const example: string[][] = [
    ['A', 'A', 'B', 'B', 'C'],
    ['A', 'B', 'B', 'C', 'C'],
    ['B', 'B', 'C', 'C', 'D'],
    ['B', 'C', 'C', 'D', 'D'],
    ['C', 'C', 'D', 'D', 'E'],
  ];

  // Learn constraints from the example
  const constraints = WFCConstraintLearner.learn2DConstraints([example]);

  const wfc = new WFC({
    seed: 999,
    states: ['A', 'B', 'C', 'D', 'E'],
    constraints,
    entropyMode: 'shannon',
  });

  const grid = new WFCGrid2D({wfc, width: 30, height: 20});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const svg = generateSVG(result.grid, PALETTES.abstract, 30);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-learned.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-learned.svg');
  }
}

/**
 * Generate a compact example for quick reference
 */
function generateCompactExample() {
  console.log('Generating compact example...');

  const constraints = {
    water: {
      north: ['water', 'sand'],
      south: ['water', 'sand'],
      east: ['water', 'sand'],
      west: ['water', 'sand'],
    },
    sand: {
      north: ['water', 'sand', 'grass'],
      south: ['water', 'sand', 'grass'],
      east: ['water', 'sand', 'grass'],
      west: ['water', 'sand', 'grass'],
    },
    grass: {
      north: ['sand', 'grass'],
      south: ['sand', 'grass'],
      east: ['sand', 'grass'],
      west: ['sand', 'grass'],
    },
  };

  const wfc = new WFC({
    seed: 321,
    states: ['water', 'sand', 'grass'],
    constraints,
    frequencies: {water: 1.5, sand: 1, grass: 2},
    entropyMode: 'weighted-shannon',
  });

  const grid = new WFCGrid2D({wfc, width: 12, height: 8});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const palette = {
      water: PALETTES.terrain.water,
      sand: PALETTES.terrain.sand,
      grass: PALETTES.terrain.grass,
    };
    const svg = generateSVG(result.grid, palette, 50);
    fs.writeFileSync(
      path.join('readme', 'images', 'wfc-compact.svg'),
      svg
    );
    console.log('✓ Generated: readme/images/wfc-compact.svg');
  }
}

// Main execution
console.log('🎨 Generating WFC tileset visualizations...\n');

generateTerrainTileset();
generateDungeonTileset();
generateCircuitTileset();
generateAbstractTileset();
generateLearnedTileset();
generateCompactExample();

console.log('\n✨ All tilesets generated successfully!');
console.log('\nGenerated files:');
console.log('  - readme/images/wfc-terrain.svg (20x15 terrain with 5 biomes)');
console.log('  - readme/images/wfc-dungeon.svg (24x16 dungeon layout)');
console.log('  - readme/images/wfc-circuit.svg (22x16 circuit board)');
console.log('  - readme/images/wfc-abstract.svg (25x18 abstract patterns)');
console.log('  - readme/images/wfc-learned.svg (30x20 learned from example)');
console.log('  - readme/images/wfc-compact.svg (12x8 compact example)');
