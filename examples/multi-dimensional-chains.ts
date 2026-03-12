/**
 * Multi-Dimensional Chains Examples
 *
 * Demonstrates MultiDimMarkovChain for modeling systems with structured
 * state spaces that should not be flattened into strings.
 */

import { MultiDimMarkovChain, registerStateKey } from '../src';

console.log('=== Multi-Dimensional Chains Examples ===\n');

// ============================================================================
// Example 1: Tile-Based Procedural Generation (WFC-style)
// ============================================================================
console.log('--- Example 1: Tile-Based Map Generation ---\n');

interface TileState {
  terrain: string;
  x: number;
  y: number;
  biome: string;
}

// Register a named state key function for serialization support
registerStateKey<TileState>('tileKey', (s) => `${s.terrain}_${s.x}_${s.y}_${s.biome}`);

const tileChain = new MultiDimMarkovChain<TileState>({
  seed: 1,
  maxOrder: 1,
  stateKey: 'tileKey', // Use registered name
});

// Training data: sample map patterns
const mapPatterns = [
  [
    { terrain: 'grass', x: 0, y: 0, biome: 'plains' },
    { terrain: 'grass', x: 1, y: 0, biome: 'plains' },
    { terrain: 'forest', x: 2, y: 0, biome: 'woodland' },
    { terrain: 'forest', x: 3, y: 0, biome: 'woodland' }
  ],
  [
    { terrain: 'water', x: 0, y: 1, biome: 'lake' },
    { terrain: 'sand', x: 1, y: 1, biome: 'beach' },
    { terrain: 'grass', x: 2, y: 1, biome: 'plains' },
    { terrain: 'forest', x: 3, y: 1, biome: 'woodland' }
  ],
  [
    { terrain: 'mountain', x: 0, y: 2, biome: 'highland' },
    { terrain: 'mountain', x: 1, y: 2, biome: 'highland' },
    { terrain: 'forest', x: 2, y: 2, biome: 'woodland' },
    { terrain: 'grass', x: 3, y: 2, biome: 'plains' }
  ]
];

const trainedTileChain = tileChain.addSequences(mapPatterns);

// Generate new map
const generatedMap = trainedTileChain.generate({ order: 1, min: 5, max: 8 });
console.log('Generated map tiles:');
generatedMap.forEach((tile, i) => {
  console.log(`  ${i + 1}. ${tile.terrain.padEnd(10)} at (${tile.x},${tile.y}) - ${tile.biome}`);
});
console.log();

// ============================================================================
// Example 2: Serialization Round-Trip
// ============================================================================
console.log('--- Example 2: Serialization Round-Trip ---\n');

// Serialize to a portable DTO
const dto = trainedTileChain.serialize();
console.log('Serialized DTO keys:', Object.keys(dto));
console.log('State key name:', dto.stateKeyName);
console.log('State store size:', Object.keys(dto.stateStore).length);

// Reconstruct from DTO (looks up 'tileKey' from registry)
const restored = MultiDimMarkovChain.fromDTO<TileState>(dto);
console.log('Restored chain states:', restored.getStates().length);
const restoredMap = restored.generate({ order: 1, min: 3, max: 5 });
console.log('Generated from restored:', restoredMap.map(t => t.terrain));
console.log();

// ============================================================================
// Example 3: Character State with Multiple Attributes
// ============================================================================
console.log('--- Example 3: RPG Character State Machine ---\n');

interface CharacterState {
  action: string;
  emotion: string;
  location: string;
}

const characterChain = new MultiDimMarkovChain<CharacterState>({
  seed: 2,
  maxOrder: 2,
  stateKey: (s) => `${s.action}_${s.emotion}_${s.location}`,
  stateKeyName: 'characterKey',
});

// Story sequences
const storySequences = [
  [
    { action: 'sleeping', emotion: 'peaceful', location: 'inn' },
    { action: 'waking', emotion: 'refreshed', location: 'inn' },
    { action: 'eating', emotion: 'content', location: 'tavern' },
    { action: 'traveling', emotion: 'excited', location: 'road' },
    { action: 'fighting', emotion: 'determined', location: 'dungeon' },
    { action: 'resting', emotion: 'tired', location: 'camp' }
  ],
  [
    { action: 'shopping', emotion: 'curious', location: 'market' },
    { action: 'talking', emotion: 'friendly', location: 'market' },
    { action: 'traveling', emotion: 'anxious', location: 'forest' },
    { action: 'hiding', emotion: 'scared', location: 'forest' },
    { action: 'fleeing', emotion: 'panicked', location: 'road' },
    { action: 'arriving', emotion: 'relieved', location: 'inn' }
  ]
];

const trainedCharacter = characterChain.addSequences(storySequences);

// Generate character story
const story = trainedCharacter.generate({ order: 2, min: 4, max: 8 });
console.log('Generated character story:');
story.forEach((state, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. ${state.action.padEnd(10)} | ${state.emotion.padEnd(10)} | ${state.location}`);
});
console.log();

// ============================================================================
// Example 4: Query State Information
// ============================================================================
console.log('--- Example 4: Querying Chain State Information ---\n');

// Get all unique states from the tile chain
const allTileStates = trainedTileChain.getStates();
console.log(`Total unique tile states: ${allTileStates.length}`);
console.log('Unique terrains:', [...new Set(allTileStates.map(t => t.terrain))].join(', '));
console.log('Unique biomes:', [...new Set(allTileStates.map(t => t.biome))].join(', '));
console.log();

// Check if specific state exists
const testState: TileState = { terrain: 'forest', x: 2, y: 0, biome: 'woodland' };
const exists = trainedTileChain.hasState(testState);
console.log(`State exists in training:`, exists);
console.log();

// Get statistics from internal chain
const stats = trainedTileChain.getStats();
console.log('Chain statistics:');
console.log(`  Total grams: ${stats.gramCount}`);
console.log(`  Sequences: ${stats.sequenceCount}`);
console.log(`  Order range: [${stats.orderRange[0]}, ${stats.orderRange[1]}]`);
console.log();

console.log('=== End of Examples ===');
