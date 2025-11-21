#!/usr/bin/env node
/**
 * Generate examples showing WFC working on different topologies
 * (hex grids, 3D voxels, custom graphs)
 */

import {WFC} from '../dist/index.js';
import type {WFCGraph, WFCCell, State} from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// HEX GRID TOPOLOGY
// ============================================================================

/**
 * Create a hexagonal grid topology with 6-directional adjacency
 */
function createHexGrid(
  rows: number,
  cols: number
): {graph: WFCGraph; coords: Map<string, {q: number; r: number}>} {
  const cells = new Map<string, WFCCell>();
  const coords = new Map<string, {q: number; r: number}>();

  // Axial coordinates for hex grid
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const id = `${q},${r}`;
      cells.set(id, {
        id,
        possibleStates: new Set(),
        collapsed: false,
        collapsedState: null,
      });
      coords.set(id, {q, r});
    }
  }

  // Define hex adjacency (6 directions in axial coordinates)
  const hexDirections = [
    {dim: 'east', dq: 1, dr: 0},
    {dim: 'west', dq: -1, dr: 0},
    {dim: 'northeast', dq: 1, dr: -1},
    {dim: 'northwest', dq: 0, dr: -1},
    {dim: 'southeast', dq: 0, dr: 1},
    {dim: 'southwest', dq: -1, dr: 1},
  ];

  for (const [id, cell] of cells) {
    const {q, r} = coords.get(id)!;

    for (const {dim, dq, dr} of hexDirections) {
      const nq = q + dq;
      const nr = r + dr;
      const neighborId = `${nq},${nr}`;

      if (cells.has(neighborId)) {
        if (!cell.adjacencies) cell.adjacencies = new Map();
        cell.adjacencies.set(dim, neighborId);
      }
    }
  }

  return {graph: {cells}, coords};
}

/**
 * Generate SVG for hex grid
 */
function generateHexSVG(
  coords: Map<string, {q: number; r: number}>,
  states: Map<string, State>,
  palette: {[state: string]: string}
): string {
  const hexSize = 25;
  const width = 600;
  const height = 500;

  let hexagons = '';

  for (const [id, {q, r}] of coords) {
    const x = hexSize * Math.sqrt(3) * (q + r / 2) + 100;
    const y = hexSize * (3 / 2) * r + 50;

    const state = states.get(id) || 'empty';
    const color = palette[state] || '#999999';

    // Draw hexagon
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const hx = x + hexSize * Math.cos(angle);
      const hy = y + hexSize * Math.sin(angle);
      points.push(`${hx},${hy}`);
    }

    hexagons += `
      <polygon points="${points.join(' ')}"
        fill="${color}"
        stroke="#ffffff"
        stroke-width="1.5"
        opacity="0.9"/>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#1a1a1a"/>
  ${hexagons}
</svg>`;
}

function generateHexExample() {
  console.log('⬡  Generating Hex Grid example...');

  const {graph, coords} = createHexGrid(10, 12);

  // Define states
  const states = ['water', 'sand', 'grass', 'forest'];

  // Define hex-specific constraints (terrain)
  const constraints = {
    water: {
      east: ['water', 'sand'],
      west: ['water', 'sand'],
      northeast: ['water', 'sand'],
      northwest: ['water', 'sand'],
      southeast: ['water', 'sand'],
      southwest: ['water', 'sand'],
    },
    sand: {
      east: ['water', 'sand', 'grass'],
      west: ['water', 'sand', 'grass'],
      northeast: ['water', 'sand', 'grass'],
      northwest: ['water', 'sand', 'grass'],
      southeast: ['water', 'sand', 'grass'],
      southwest: ['water', 'sand', 'grass'],
    },
    grass: {
      east: ['sand', 'grass', 'forest'],
      west: ['sand', 'grass', 'forest'],
      northeast: ['sand', 'grass', 'forest'],
      northwest: ['sand', 'grass', 'forest'],
      southeast: ['sand', 'grass', 'forest'],
      southwest: ['sand', 'grass', 'forest'],
    },
    forest: {
      east: ['grass', 'forest'],
      west: ['grass', 'forest'],
      northeast: ['grass', 'forest'],
      northwest: ['grass', 'forest'],
      southeast: ['grass', 'forest'],
      southwest: ['grass', 'forest'],
    },
  };

  const wfc = new WFC({
    seed: 42,
    states,
    constraints,
    frequencies: {water: 1.5, sand: 1.2, grass: 2, forest: 1},
    entropyMode: 'weighted-shannon',
  });

  // Initialize possibleStates for each cell
  for (const cell of graph.cells.values()) {
    cell.possibleStates = new Set(states);
  }

  console.log(`  Starting with ${graph.cells.size} cells`);
  const result = wfc.collapse(graph);
  console.log(`  Result success: ${result.success}`);
  console.log(`  Collapsed cells: ${Array.from(result.graph.cells.values()).filter(c => c.collapsed).length}`);

  if (result.success) {
    const stateMap = new Map<string, State>();
    for (const [id, cell] of result.graph.cells) {
      if (cell.collapsedState) {
        stateMap.set(id, cell.collapsedState);
      }
    }

    const palette = {
      water: '#2E5266',
      sand: '#E8C468',
      grass: '#6B9A3F',
      forest: '#2D5016',
    };

    const svg = generateHexSVG(coords, stateMap, palette);
    fs.writeFileSync(
      path.join('readme', 'images', 'hex-terrain.svg'),
      svg
    );
    console.log('  ✓ Hex grid terrain');
  } else {
    console.log('  ✗ Failed to generate hex grid');
  }
}

// ============================================================================
// 3D VOXEL GRID (shown as isometric slices)
// ============================================================================

/**
 * Create a 3D voxel grid topology
 */
function create3DGrid(
  width: number,
  height: number,
  depth: number
): {graph: WFCGraph; coords: Map<string, {x: number; y: number; z: number}>} {
  const cells = new Map<string, WFCCell>();
  const coords = new Map<string, {x: number; y: number; z: number}>();

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const id = `${x},${y},${z}`;
        cells.set(id, {
          id,
          possibleStates: new Set(),
          collapsed: false,
          collapsedState: null,
        });
        coords.set(id, {x, y, z});
      }
    }
  }

  // Define 3D adjacency (6 directions)
  for (const [id, cell] of cells) {
    const {x, y, z} = coords.get(id)!;

    const neighbors = [
      {dim: 'north', dx: 0, dy: -1, dz: 0},
      {dim: 'south', dx: 0, dy: 1, dz: 0},
      {dim: 'east', dx: 1, dy: 0, dz: 0},
      {dim: 'west', dx: -1, dy: 0, dz: 0},
      {dim: 'up', dx: 0, dy: 0, dz: 1},
      {dim: 'down', dx: 0, dy: 0, dz: -1},
    ];

    for (const {dim, dx, dy, dz} of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const neighborId = `${nx},${ny},${nz}`;

      if (cells.has(neighborId)) {
        if (!cell.adjacencies) cell.adjacencies = new Map();
        cell.adjacencies.set(dim, neighborId);
      }
    }
  }

  return {graph: {cells}, coords};
}

/**
 * Generate isometric SVG showing 3 slices
 */
function generate3DSVG(
  coords: Map<string, {x: number; y: number; z: number}>,
  states: Map<string, State>,
  palette: {[state: string]: string},
  width: number,
  height: number,
  depth: number
): string {
  const tileSize = 20;
  const svgWidth = 800;
  const svgHeight = 600;

  let voxels = '';

  // Draw 3 horizontal slices at different Z levels
  const slices = [0, Math.floor(depth / 2), depth - 1];

  for (let sliceIdx = 0; sliceIdx < slices.length; sliceIdx++) {
    const z = slices[sliceIdx];
    const offsetY = sliceIdx * 150 + 50;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const id = `${x},${y},${z}`;
        const state = states.get(id) || 'empty';
        const color = palette[state] || '#666666';

        const px = x * tileSize + 50;
        const py = y * tileSize + offsetY;

        voxels += `
          <rect x="${px}" y="${py}" width="${tileSize}" height="${tileSize}"
            fill="${color}" stroke="#ffffff" stroke-width="0.5" opacity="0.9"/>
          <text x="${px + 2}" y="${py + 12}" font-size="8" fill="#ffffff" opacity="0.5">
            z${z}
          </text>
        `;
      }
    }

    // Label
    voxels += `
      <text x="10" y="${offsetY + height * tileSize / 2}"
        font-size="14" fill="#ffffff" font-weight="bold">
        Slice Z=${z}
      </text>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="#1a1a1a"/>
  <text x="10" y="30" font-size="18" fill="#ffffff" font-weight="bold">
    3D Voxel Grid (${width}×${height}×${depth})
  </text>
  ${voxels}
</svg>`;
}

function generate3DExample() {
  console.log('🧊  Generating 3D Voxel example...');

  const width = 20;
  const height = 15;
  const depth = 8;

  const {graph, coords} = create3DGrid(width, height, depth);

  // Define states
  const states = ['air', 'grass', 'dirt', 'stone', 'ore', 'bedrock'];

  // Define 3D constraints (underground layers)
  const constraints = {
    air: {
      north: ['air', 'dirt'],
      south: ['air', 'dirt'],
      east: ['air', 'dirt'],
      west: ['air', 'dirt'],
      up: ['air'],
      down: ['air', 'dirt', 'grass'],
    },
    grass: {
      north: ['grass', 'dirt'],
      south: ['grass', 'dirt'],
      east: ['grass', 'dirt'],
      west: ['grass', 'dirt'],
      up: ['air'],
      down: ['dirt'],
    },
    dirt: {
      north: ['dirt', 'grass', 'stone'],
      south: ['dirt', 'grass', 'stone'],
      east: ['dirt', 'grass', 'stone'],
      west: ['dirt', 'grass', 'stone'],
      up: ['dirt', 'grass', 'air'],
      down: ['dirt', 'stone'],
    },
    stone: {
      north: ['stone', 'dirt', 'ore'],
      south: ['stone', 'dirt', 'ore'],
      east: ['stone', 'dirt', 'ore'],
      west: ['stone', 'dirt', 'ore'],
      up: ['stone', 'dirt'],
      down: ['stone', 'ore', 'bedrock'],
    },
    ore: {
      north: ['stone', 'ore'],
      south: ['stone', 'ore'],
      east: ['stone', 'ore'],
      west: ['stone', 'ore'],
      up: ['stone'],
      down: ['stone', 'bedrock'],
    },
    bedrock: {
      north: ['bedrock', 'stone'],
      south: ['bedrock', 'stone'],
      east: ['bedrock', 'stone'],
      west: ['bedrock', 'stone'],
      up: ['bedrock', 'stone', 'ore'],
      down: ['bedrock'],
    },
  };

  const wfc = new WFC({
    seed: 123,
    states,
    constraints,
    frequencies: {air: 2, grass: 1, dirt: 3, stone: 4, ore: 0.5, bedrock: 2},
    entropyMode: 'weighted-shannon',
    backtrack: {maxAttempts: 500},
  });

  // Initialize possibleStates for each cell
  for (const cell of graph.cells.values()) {
    cell.possibleStates = new Set(states);
  }

  const result = wfc.collapse(graph);

  if (!result.success) {
    console.log(`  ✗ WFC failed: ${result.metadata?.error || 'unknown error'}`);
    console.log(`  Contradictions: ${result.metadata?.contradictions || 0}`);
  }

  if (result.success) {
    const stateMap = new Map<string, State>();
    for (const [id, cell] of result.graph.cells) {
      if (cell.collapsedState) {
        stateMap.set(id, cell.collapsedState);
      }
    }

    const palette = {
      air: '#87CEEB',
      grass: '#6B9A3F',
      dirt: '#8B4513',
      stone: '#808080',
      ore: '#FFD700',
      bedrock: '#2F2F2F',
    };

    const svg = generate3DSVG(coords, stateMap, palette, width, height, depth);
    fs.writeFileSync(
      path.join('readme', 'images', '3d-voxel.svg'),
      svg
    );
    console.log('  ✓ 3D voxel terrain');
  } else {
    console.log('  ✗ Failed to generate 3D voxels');
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

console.log('🌐 Generating Custom Topology Examples\n');

generateHexExample();
console.log('');
generate3DExample();

console.log('\n✨ Topology examples complete!');
console.log('\nGenerated:');
console.log('  - hex-terrain.svg: Hexagonal grid with 6-way adjacency');
console.log('  - 3d-voxel.svg: 3D voxel grid shown as slices');
