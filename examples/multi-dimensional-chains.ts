/**
 * Multi-Dimensional Chains Examples
 *
 * Demonstrates MultiDimMarkovChain for modeling systems with structured
 * state spaces that should not be flattened into strings.
 */

import { MultiDimMarkovChain } from '../src';

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

const tileChain = new MultiDimMarkovChain<TileState>({
  seed: 1,
  maxOrder: 1,
  stateKey: (s) => `${s.terrain}_${s.x}_${s.y}_${s.biome}`
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
  const terrainIcon = {
    grass: '🌱',
    forest: '🌲',
    water: '💧',
    sand: '🏖️',
    mountain: '⛰️'
  }[tile.terrain] || '❓';
  console.log(`  ${i + 1}. ${terrainIcon} ${tile.terrain.padEnd(10)} at (${tile.x},${tile.y}) - ${tile.biome}`);
});
console.log();

// ============================================================================
// Example 2: Character State with Multiple Attributes
// ============================================================================
console.log('--- Example 2: RPG Character State Machine ---\n');

interface CharacterState {
  action: string;
  emotion: string;
  location: string;
  timeOfDay: string;
}

const characterChain = new MultiDimMarkovChain<CharacterState>({
  seed: 2,
  maxOrder: 2,
  stateKey: (s) => `${s.action}_${s.emotion}_${s.location}_${s.timeOfDay}`
});

// Story sequences
const storySequences = [
  [
    { action: 'sleeping', emotion: 'peaceful', location: 'inn', timeOfDay: 'night' },
    { action: 'waking', emotion: 'refreshed', location: 'inn', timeOfDay: 'morning' },
    { action: 'eating', emotion: 'content', location: 'tavern', timeOfDay: 'morning' },
    { action: 'traveling', emotion: 'excited', location: 'road', timeOfDay: 'day' },
    { action: 'fighting', emotion: 'determined', location: 'dungeon', timeOfDay: 'day' },
    { action: 'resting', emotion: 'tired', location: 'camp', timeOfDay: 'evening' }
  ],
  [
    { action: 'shopping', emotion: 'curious', location: 'market', timeOfDay: 'morning' },
    { action: 'talking', emotion: 'friendly', location: 'market', timeOfDay: 'morning' },
    { action: 'traveling', emotion: 'anxious', location: 'forest', timeOfDay: 'day' },
    { action: 'hiding', emotion: 'scared', location: 'forest', timeOfDay: 'evening' },
    { action: 'fleeing', emotion: 'panicked', location: 'road', timeOfDay: 'evening' },
    { action: 'arriving', emotion: 'relieved', location: 'inn', timeOfDay: 'night' }
  ]
];

const trainedCharacter = characterChain.addSequences(storySequences);

// Generate character story
const story = trainedCharacter.generate({ order: 2, min: 6, max: 10 });
console.log('Generated character story:');
story.forEach((state, i) => {
  const actionIcon = {
    sleeping: '😴',
    waking: '🌅',
    eating: '🍽️',
    traveling: '🚶',
    fighting: '⚔️',
    resting: '🏕️',
    shopping: '🛍️',
    talking: '💬',
    hiding: '🫣',
    fleeing: '🏃',
    arriving: '🚪'
  }[state.action] || '📍';
  console.log(`  ${(i + 1).toString().padStart(2)}. ${actionIcon} ${state.action.padEnd(10)} | ${state.emotion.padEnd(10)} | ${state.location.padEnd(10)} | ${state.timeOfDay}`);
});
console.log();

// ============================================================================
// Example 3: Spatial/Coordinate-Based System
// ============================================================================
console.log('--- Example 3: Entity Movement Patterns ---\n');

interface EntityPosition {
  entityId: string;
  x: number;
  y: number;
  velocity: number;
}

const movementChain = new MultiDimMarkovChain<EntityPosition>({
  seed: 3,
  maxOrder: 2,
  stateKey: (s) => `${s.entityId}_${s.x}_${s.y}_${s.velocity}`
});

// Movement patterns
const movementPatterns = [
  [
    { entityId: 'player', x: 0, y: 0, velocity: 0 },
    { entityId: 'player', x: 1, y: 0, velocity: 1 },
    { entityId: 'player', x: 2, y: 0, velocity: 2 },
    { entityId: 'player', x: 3, y: 1, velocity: 2 },
    { entityId: 'player', x: 4, y: 2, velocity: 2 }
  ],
  [
    { entityId: 'enemy', x: 10, y: 5, velocity: 1 },
    { entityId: 'enemy', x: 9, y: 5, velocity: 1 },
    { entityId: 'enemy', x: 8, y: 4, velocity: 2 },
    { entityId: 'enemy', x: 7, y: 3, velocity: 3 },
    { entityId: 'enemy', x: 6, y: 2, velocity: 3 }
  ]
];

const trainedMovement = movementChain.addSequences(movementPatterns);

// Generate movement sequence
const movement = trainedMovement.generate({ order: 2, min: 4, max: 6 });
console.log('Generated entity movement:');
movement.forEach((pos, i) => {
  const arrow = pos.velocity === 0 ? '⏸️' : pos.velocity === 1 ? '➡️' : pos.velocity === 2 ? '⏩' : '⚡';
  console.log(`  ${(i + 1).toString().padStart(2)}. ${arrow} ${pos.entityId.padEnd(8)} at (${pos.x.toString().padStart(2)},${pos.y.toString().padStart(2)}) velocity=${pos.velocity}`);
});
console.log();

// ============================================================================
// Example 4: Game Event System with Context
// ============================================================================
console.log('--- Example 4: Event System with Multi-Attribute Context ---\n');

interface GameEvent {
  eventType: string;
  playerLevel: number;
  questStage: string;
  difficulty: string;
}

const eventChain = new MultiDimMarkovChain<GameEvent>({
  seed: 4,
  maxOrder: 1,
  stateKey: (s) => `${s.eventType}_${s.playerLevel}_${s.questStage}_${s.difficulty}`
});

// Event sequences
const eventSequences = [
  [
    { eventType: 'combat', playerLevel: 1, questStage: 'intro', difficulty: 'easy' },
    { eventType: 'dialogue', playerLevel: 1, questStage: 'intro', difficulty: 'easy' },
    { eventType: 'exploration', playerLevel: 2, questStage: 'main', difficulty: 'medium' },
    { eventType: 'combat', playerLevel: 2, questStage: 'main', difficulty: 'medium' },
    { eventType: 'boss', playerLevel: 3, questStage: 'climax', difficulty: 'hard' }
  ],
  [
    { eventType: 'exploration', playerLevel: 1, questStage: 'intro', difficulty: 'easy' },
    { eventType: 'puzzle', playerLevel: 1, questStage: 'intro', difficulty: 'easy' },
    { eventType: 'dialogue', playerLevel: 2, questStage: 'main', difficulty: 'medium' },
    { eventType: 'combat', playerLevel: 2, questStage: 'main', difficulty: 'medium' },
    { eventType: 'combat', playerLevel: 3, questStage: 'main', difficulty: 'hard' }
  ]
];

const trainedEvents = eventChain.addSequences(eventSequences);

// Generate event sequence
const events = trainedEvents.generate({ order: 1, min: 5, max: 7 });
console.log('Generated game event sequence:');
events.forEach((event, i) => {
  const eventIcon = {
    combat: '⚔️',
    dialogue: '💬',
    exploration: '🔍',
    puzzle: '🧩',
    boss: '👹'
  }[event.eventType] || '🎮';
  const difficultyBar = event.difficulty === 'easy' ? '▰▱▱' : event.difficulty === 'medium' ? '▰▰▱' : '▰▰▰';
  console.log(`  ${(i + 1).toString().padStart(2)}. ${eventIcon} ${event.eventType.padEnd(12)} [Lv${event.playerLevel}] ${event.questStage.padEnd(8)} ${difficultyBar}`);
});
console.log();

// ============================================================================
// Example 5: Query State Information
// ============================================================================
console.log('--- Example 5: Querying Chain State Information ---\n');

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

// Get statistics
const stats = trainedTileChain.getStats();
console.log('Chain statistics:');
console.log(`  Total grams: ${stats.grams}`);
console.log(`  Max order: ${stats.maxOrder}`);
console.log(`  Unique states: ${stats.categories}`);
console.log();

console.log('=== End of Examples ===');
