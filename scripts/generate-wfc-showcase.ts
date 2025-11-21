#!/usr/bin/env node
/**
 * Generate WFC showcase visualizations that demonstrate learning from
 * real procedural generation algorithms
 */

import {WFC, WFCGrid2D, WFCConstraintLearner} from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// COLOR PALETTES
// ============================================================================

const PALETTES = {
  dungeon: {
    wall: {fill: '#3A3A3A', accent: '#555555', pattern: 'brick'},
    floor: {fill: '#C4B5A0', accent: '#D4C5B0', pattern: 'tiles'},
    door: {fill: '#8B4513', accent: '#A0522D', pattern: 'wood'},
    corridor: {fill: '#A89F91', accent: '#B8AFA1', pattern: 'stone'},
    room: {fill: '#D4C5B0', accent: '#E4D5C0', pattern: 'tiles'},
  },
  city: {
    building: {fill: '#4A5568', accent: '#5A6578', pattern: 'brick'},
    street: {fill: '#2D3748', accent: '#3D4758', pattern: 'asphalt'},
    park: {fill: '#48BB78', accent: '#68D998', pattern: 'grass'},
    plaza: {fill: '#CBD5E0', accent: '#DBE5F0', pattern: 'tiles'},
    water: {fill: '#2E5266', accent: '#4A7C8C', pattern: 'waves'},
  },
};

// ============================================================================
// SVG GENERATION
// ============================================================================

interface TileStyle {
  fill: string;
  accent: string;
  pattern: string;
}

function generatePatterns(): string {
  return `
    <defs>
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

      <!-- Asphalt pattern -->
      <pattern id="asphalt" patternUnits="userSpaceOnUse" width="30" height="30">
        <line x1="0" y1="15" x2="30" y2="15" stroke="white" stroke-width="2" opacity="0.4" stroke-dasharray="8,4"/>
      </pattern>

      <!-- Grass pattern -->
      <pattern id="grass" patternUnits="userSpaceOnUse" width="8" height="12">
        <line x1="2" y1="12" x2="2" y2="6" stroke="white" stroke-width="1" opacity="0.3"/>
        <line x1="6" y1="12" x2="6" y2="4" stroke="white" stroke-width="1" opacity="0.3"/>
      </pattern>

      <!-- Wave pattern -->
      <pattern id="waves" patternUnits="userSpaceOnUse" width="20" height="10">
        <path d="M0 5 Q 5 0, 10 5 T 20 5" stroke="white" stroke-width="1" fill="none" opacity="0.3"/>
      </pattern>
    </defs>
  `;
}

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
    <rect x="${x}" y="${y}" width="${size}" height="${size}"
      fill="url(#${gradientId})" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.3"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="url(#${style.pattern})"/>
  `;
}

function generateSVG(
  grid: string[][],
  palette: {[state: string]: TileStyle},
  tileSize: number = 20
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
  <rect width="${width}" height="${height}" fill="#1a1a1a"/>
  ${tiles}
</svg>`;
}

// ============================================================================
// BSP DUNGEON GENERATOR (Traditional Roguelike Algorithm)
// ============================================================================

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

function generateBSPDungeon(
  width: number,
  height: number,
  seed: number
): string[][] {
  // Simple seeded random
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };

  const randomInt = (min: number, max: number) =>
    Math.floor(random() * (max - min + 1)) + min;

  // Initialize with walls
  const grid: string[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill('wall'));

  // BSP tree split
  function split(node: BSPNode, depth: number): void {
    if (depth === 0) return;

    const horizontal = random() > 0.5;

    if (horizontal) {
      if (node.height < 10) return;
      const splitY = randomInt(
        node.y + 4,
        node.y + node.height - 5
      );
      node.left = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: splitY - node.y,
      };
      node.right = {
        x: node.x,
        y: splitY,
        width: node.width,
        height: node.y + node.height - splitY,
      };
    } else {
      if (node.width < 10) return;
      const splitX = randomInt(
        node.x + 4,
        node.x + node.width - 5
      );
      node.left = {
        x: node.x,
        y: node.y,
        width: splitX - node.x,
        height: node.height,
      };
      node.right = {
        x: splitX,
        y: node.y,
        width: node.x + node.width - splitX,
        height: node.height,
      };
    }

    if (node.left) split(node.left, depth - 1);
    if (node.right) split(node.right, depth - 1);
  }

  // Create rooms in leaf nodes
  function createRooms(node: BSPNode): void {
    if (node.left && node.right) {
      createRooms(node.left);
      createRooms(node.right);
    } else {
      // Leaf node - create room
      const roomWidth = randomInt(4, Math.min(node.width - 2, 8));
      const roomHeight = randomInt(4, Math.min(node.height - 2, 8));
      const roomX = randomInt(node.x + 1, node.x + node.width - roomWidth - 1);
      const roomY = randomInt(
        node.y + 1,
        node.y + node.height - roomHeight - 1
      );

      node.room = {x: roomX, y: roomY, width: roomWidth, height: roomHeight};

      // Carve room
      for (let y = roomY; y < roomY + roomHeight; y++) {
        for (let x = roomX; x < roomX + roomWidth; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            grid[y][x] = 'room';
          }
        }
      }
    }
  }

  // Connect rooms with corridors
  function connectRooms(node: BSPNode): Room | null {
    if (node.left && node.right) {
      const leftRoom = connectRooms(node.left);
      const rightRoom = connectRooms(node.right);

      if (leftRoom && rightRoom) {
        // Create corridor between rooms
        const x1 = leftRoom.x + Math.floor(leftRoom.width / 2);
        const y1 = leftRoom.y + Math.floor(leftRoom.height / 2);
        const x2 = rightRoom.x + Math.floor(rightRoom.width / 2);
        const y2 = rightRoom.y + Math.floor(rightRoom.height / 2);

        // L-shaped corridor
        if (random() > 0.5) {
          // Horizontal first
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (y1 >= 0 && y1 < height && x >= 0 && x < width) {
              if (grid[y1][x] === 'wall') grid[y1][x] = 'corridor';
            }
          }
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (y >= 0 && y < height && x2 >= 0 && x2 < width) {
              if (grid[y][x2] === 'wall') grid[y][x2] = 'corridor';
            }
          }
        } else {
          // Vertical first
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (y >= 0 && y < height && x1 >= 0 && x1 < width) {
              if (grid[y][x1] === 'wall') grid[y][x1] = 'corridor';
            }
          }
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (y2 >= 0 && y2 < height && x >= 0 && x < width) {
              if (grid[y2][x] === 'wall') grid[y2][x] = 'corridor';
            }
          }
        }

        return leftRoom;
      }
      return leftRoom || rightRoom;
    }
    return node.room || null;
  }

  // Add doors
  function addDoors(): void {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] === 'corridor') {
          const neighbors = [
            grid[y - 1][x],
            grid[y + 1][x],
            grid[y][x - 1],
            grid[y][x + 1],
          ];
          const hasRoom = neighbors.includes('room');
          const hasWall = neighbors.includes('wall');
          if (hasRoom && hasWall && random() > 0.7) {
            grid[y][x] = 'door';
          }
        }
      }
    }
  }

  // Generate dungeon
  const root: BSPNode = {x: 0, y: 0, width, height};
  split(root, 4);
  createRooms(root);
  connectRooms(root);
  addDoors();

  return grid;
}

// ============================================================================
// CITY MAP GENERATOR
// ============================================================================

function generateCityMap(width: number, height: number, seed: number): string[][] {
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };

  const grid: string[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill('building'));

  // Create main streets (grid pattern)
  const streetSpacing = 8;
  for (let y = 0; y < height; y += streetSpacing) {
    for (let x = 0; x < width; x++) {
      if (y < height) grid[y][x] = 'street';
      if (y + 1 < height) grid[y + 1][x] = 'street';
    }
  }

  for (let x = 0; x < width; x += streetSpacing) {
    for (let y = 0; y < height; y++) {
      if (x < width) grid[y][x] = 'street';
      if (x + 1 < width) grid[y][x + 1] = 'street';
    }
  }

  // Add plazas at intersections
  for (let y = 0; y < height; y += streetSpacing) {
    for (let x = 0; x < width; x += streetSpacing) {
      if (random() > 0.6) {
        for (let dy = 0; dy < 3 && y + dy < height; dy++) {
          for (let dx = 0; dx < 3 && x + dx < width; dx++) {
            grid[y + dy][x + dx] = 'plaza';
          }
        }
      }
    }
  }

  // Add parks
  for (let i = 0; i < 3; i++) {
    const parkX = Math.floor(random() * (width - 5)) + 2;
    const parkY = Math.floor(random() * (height - 5)) + 2;
    const parkW = Math.floor(random() * 3) + 3;
    const parkH = Math.floor(random() * 3) + 3;

    for (let y = parkY; y < Math.min(parkY + parkH, height); y++) {
      for (let x = parkX; x < Math.min(parkX + parkW, width); x++) {
        if (grid[y][x] === 'building') {
          grid[y][x] = 'park';
        }
      }
    }
  }

  // Add water feature
  const waterX = Math.floor(random() * (width - 10));
  const waterY = Math.floor(random() * (height - 4));
  for (let y = waterY; y < Math.min(waterY + 3, height); y++) {
    for (let x = waterX; x < Math.min(waterX + 10, width); x++) {
      grid[y][x] = 'water';
    }
  }

  return grid;
}

// ============================================================================
// MAIN SHOWCASE GENERATION
// ============================================================================

function generateDungeonShowcase() {
  console.log('🏰 Generating BSP Dungeon showcase...');

  // Generate original BSP dungeon
  const original = generateBSPDungeon(40, 30, 12345);
  const originalSVG = generateSVG(original, PALETTES.dungeon, 15);
  fs.writeFileSync(
    path.join('readme', 'images', 'dungeon-original.svg'),
    originalSVG
  );
  console.log('  ✓ Original BSP dungeon');

  // Learn from multiple dungeon examples
  const examples = [
    generateBSPDungeon(20, 15, 111),
    generateBSPDungeon(20, 15, 222),
    generateBSPDungeon(20, 15, 333),
  ];

  const constraints = WFCConstraintLearner.learn2DConstraints(examples);

  // Generate new dungeons using learned constraints
  const wfc = new WFC({
    seed: 999,
    states: ['wall', 'room', 'corridor', 'door'],
    constraints,
    backtrack: {maxAttempts: 1000},
  });

  const grid = new WFCGrid2D({wfc, width: 40, height: 30});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const learnedSVG = generateSVG(result.grid, PALETTES.dungeon, 15);
    fs.writeFileSync(
      path.join('readme', 'images', 'dungeon-learned.svg'),
      learnedSVG
    );
    console.log('  ✓ WFC learned dungeon');
  } else {
    console.log('  ✗ Failed to generate learned dungeon');
  }
}

function generateCityShowcase() {
  console.log('🏙️  Generating City Map showcase...');

  // Generate original city
  const original = generateCityMap(50, 35, 54321);
  const originalSVG = generateSVG(original, PALETTES.city, 12);
  fs.writeFileSync(
    path.join('readme', 'images', 'city-original.svg'),
    originalSVG
  );
  console.log('  ✓ Original procedural city');

  // Learn from multiple city examples
  const examples = [
    generateCityMap(25, 20, 444),
    generateCityMap(25, 20, 555),
    generateCityMap(25, 20, 666),
  ];

  const constraints = WFCConstraintLearner.learn2DConstraints(examples);

  // Generate new city using learned constraints
  const wfc = new WFC({
    seed: 777,
    states: ['building', 'street', 'park', 'plaza', 'water'],
    constraints,
    backtrack: {maxAttempts: 1000},
  });

  const grid = new WFCGrid2D({wfc, width: 50, height: 35});
  const result = grid.generateWithResult();

  if (result.success && result.grid) {
    const learnedSVG = generateSVG(result.grid, PALETTES.city, 12);
    fs.writeFileSync(
      path.join('readme', 'images', 'city-learned.svg'),
      learnedSVG
    );
    console.log('  ✓ WFC learned city');
  } else {
    console.log('  ✗ Failed to generate learned city');
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

console.log('🎨 Generating WFC Showcase: Learning from Real Algorithms\n');

generateDungeonShowcase();
console.log('');
generateCityShowcase();

console.log('\n✨ Showcase complete!');
console.log('\nGenerated:');
console.log('  - dungeon-original.svg: BSP algorithm dungeon');
console.log('  - dungeon-learned.svg: WFC learned from BSP dungeons');
console.log('  - city-original.svg: Grid-based procedural city');
console.log('  - city-learned.svg: WFC learned from cities');
