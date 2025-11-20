/**
 * WFC + MarkovChain Hybrid Generation Example
 *
 * This example demonstrates combining Wave Function Collapse with
 * Markov Chains for more dynamic and context-aware generation.
 *
 * Run with: npx ts-node examples/wfc-markov-hybrid.ts
 */

import {WFC, WFCGrid2D, MarkovChain, Distribution} from '../src';
import type {ConstraintRules} from '../src/structures/wfc-types';

// ============================================================================
// Example 1: Use MarkovChain to Weight WFC State Selection
// ============================================================================

console.log('='.repeat(60));
console.log('Example 1: Markov-Weighted Terrain Generation');
console.log('='.repeat(60));

// Define terrain
const WATER = '~';
const SAND = '∴';
const GRASS = '▓';
const FOREST = '♣';
const MOUNTAIN = '▲';

// Train Markov chain on example terrain sequences
const terrainSequences = [
  [WATER, SAND, GRASS, GRASS, FOREST, MOUNTAIN],
  [WATER, SAND, GRASS, GRASS, GRASS, FOREST],
  [WATER, WATER, SAND, GRASS, FOREST, FOREST],
  [MOUNTAIN, FOREST, GRASS, GRASS, SAND, WATER],
  [FOREST, GRASS, GRASS, SAND, WATER, WATER],
];

console.log('\nTraining Markov chain on terrain sequences...');
const terrainChain = new MarkovChain<string>({seed: 42, order: 1});

for (const seq of terrainSequences) {
  terrainChain.train([seq]);
}

console.log(`Trained on ${terrainSequences.length} sequences`);

// Extract frequencies from Markov chain
const markovFrequencies = terrainChain.getStats().frequencyStats;
console.log('\nLearned terrain frequencies from Markov chain:');
console.log(markovFrequencies);

// Use Markov frequencies for WFC
const terrainConstraints: ConstraintRules = {
  [WATER]: {north: [WATER, SAND], south: [WATER, SAND], east: [WATER, SAND], west: [WATER, SAND]},
  [SAND]: {north: [WATER, SAND, GRASS], south: [WATER, SAND, GRASS], east: [WATER, SAND, GRASS], west: [WATER, SAND, GRASS]},
  [GRASS]: {north: [SAND, GRASS, FOREST], south: [SAND, GRASS, FOREST], east: [SAND, GRASS, FOREST], west: [SAND, GRASS, FOREST]},
  [FOREST]: {north: [GRASS, FOREST, MOUNTAIN], south: [GRASS, FOREST, MOUNTAIN], east: [GRASS, FOREST, MOUNTAIN], west: [GRASS, FOREST, MOUNTAIN]},
  [MOUNTAIN]: {north: [FOREST, MOUNTAIN], south: [FOREST, MOUNTAIN], east: [FOREST, MOUNTAIN], west: [FOREST, MOUNTAIN]},
};

const markovWFC = new WFC({
  seed: 12345,
  states: [WATER, SAND, GRASS, FOREST, MOUNTAIN],
  constraints: terrainConstraints,
  frequencies: markovFrequencies, // Use Markov-learned frequencies!
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

const markovGrid = new WFCGrid2D({
  width: 35,
  height: 15,
  wfc: markovWFC,
  boundaries: 'wrap',
});

const markovTerrain = markovGrid.generate();

if (markovTerrain) {
  console.log('\nGenerated terrain with Markov-learned weights:');
  console.log(markovTerrain.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate terrain');
}

// ============================================================================
// Example 2: Generate Narrative Quests with WFC + Markov
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 2: Quest Structure Generation');
console.log('='.repeat(60));

// Quest components
type QuestStep = string;

const INTRO: QuestStep = '[Intro]';
const TRAVEL: QuestStep = '[Travel]';
const COMBAT: QuestStep = '[Combat]';
const PUZZLE: QuestStep = '[Puzzle]';
const REWARD: QuestStep = '[Reward]';
const BOSS: QuestStep = '[Boss]';

// Train Markov chain on quest structures
const questSequences = [
  [INTRO, TRAVEL, COMBAT, TRAVEL, PUZZLE, REWARD],
  [INTRO, TRAVEL, COMBAT, COMBAT, BOSS, REWARD],
  [INTRO, PUZZLE, TRAVEL, COMBAT, PUZZLE, REWARD],
  [INTRO, TRAVEL, PUZZLE, COMBAT, COMBAT, BOSS, REWARD],
];

console.log('\nTraining Markov chain on quest structures...');
const questChain = new MarkovChain<QuestStep>({seed: 999, order: 1});

for (const quest of questSequences) {
  questChain.train([quest]);
}

// Extract transition probabilities
const questFreqs = questChain.getStats().frequencyStats;
console.log('\nQuest step frequencies:', questFreqs);

// Define WFC constraints for quest structure
const questConstraints: ConstraintRules = {
  [INTRO]: {north: [INTRO], south: [TRAVEL, PUZZLE], east: [INTRO], west: [INTRO]},
  [TRAVEL]: {north: [INTRO, TRAVEL], south: [COMBAT, PUZZLE], east: [TRAVEL], west: [TRAVEL]},
  [COMBAT]: {north: [TRAVEL], south: [COMBAT, PUZZLE, BOSS, REWARD], east: [COMBAT, PUZZLE], west: [COMBAT]},
  [PUZZLE]: {north: [TRAVEL, COMBAT], south: [TRAVEL, COMBAT, REWARD], east: [PUZZLE, COMBAT], west: [PUZZLE]},
  [BOSS]: {north: [COMBAT], south: [REWARD], east: [BOSS], west: [BOSS]},
  [REWARD]: {north: [COMBAT, PUZZLE, BOSS], south: [REWARD], east: [REWARD], west: [REWARD]},
};

const questWFC = new WFC({
  seed: 54321,
  states: [INTRO, TRAVEL, COMBAT, PUZZLE, BOSS, REWARD],
  constraints: questConstraints,
  frequencies: questFreqs, // Use Markov frequencies
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

// Generate quest "map"
const questGrid = new WFCGrid2D({
  width: 20,
  height: 10,
  wfc: questWFC,
  boundaries: {perDimension: {north: [INTRO], south: [REWARD]}},
});

const questMap = questGrid.generate();

if (questMap) {
  console.log('\nGenerated Quest Structure Map:');
  console.log(questMap.map(row => row.join(' ')).join('\n'));
} else {
  console.log('Failed to generate quest map');
}

// Generate linear quest with pure Markov
console.log('\nCompare: Pure Markov Quest Generation:');
const linearQuest = questChain.generate({length: 8, start: [INTRO]});
console.log(linearQuest.join(' → '));

// ============================================================================
// Example 3: Dynamic Constraint Generation from Markov Chain
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 3: Learn WFC Constraints from Markov Chain');
console.log('='.repeat(60));

// Train Markov chain on dungeon patterns
const WALL = '█';
const FLOOR = '·';
const DOOR = '▓';

const dungeonRows = [
  [WALL, WALL, WALL, WALL, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, DOOR, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, WALL, WALL, WALL, WALL],
];

console.log('\nTraining Markov chain on dungeon row patterns...');
const dungeonChain = new MarkovChain<string>({seed: 777, order: 1});

for (const row of dungeonRows) {
  dungeonChain.train([row]);
}

// Use Markov chain to generate constraint distributions
function createMarkovConstraints(
  chain: MarkovChain<string>,
  states: string[]
): ConstraintRules {
  const constraints: ConstraintRules = {};

  for (const state of states) {
    // Get likely next states from Markov chain
    const nextStates = chain.generate({length: 100, start: [state]});

    // Count occurrences to build distribution
    const counts: {[key: string]: number} = {};
    for (const next of nextStates) {
      counts[next] = (counts[next] || 0) + 1;
    }

    // Convert to constraint rules (all directions same for simplicity)
    const allowedStates = states.filter(s => counts[s] && counts[s] > 0);
    constraints[state] = {
      north: allowedStates,
      south: allowedStates,
      east: allowedStates,
      west: allowedStates,
    };
  }

  return constraints;
}

const markovConstraints = createMarkovConstraints(dungeonChain, [
  WALL,
  FLOOR,
  DOOR,
]);
console.log('\nGenerated WFC constraints from Markov chain:');
console.log(JSON.stringify(markovConstraints, null, 2));

// Use the Markov-generated constraints
const hybridWFC = new WFC({
  seed: 88888,
  states: [WALL, FLOOR, DOOR],
  constraints: markovConstraints,
  frequencies: dungeonChain.getStats().frequencyStats,
  entropyMode: 'weighted-shannon',
  backtrack: true,
});

const hybridGrid = new WFCGrid2D({
  width: 25,
  height: 12,
  wfc: hybridWFC,
  boundaries: {perDimension: {north: [WALL], south: [WALL], east: [WALL], west: [WALL]}},
});

const hybridDungeon = hybridGrid.generate();

if (hybridDungeon) {
  console.log('\nGenerated dungeon from Markov-derived constraints:');
  console.log(hybridDungeon.map(row => row.join('')).join('\n'));
} else {
  console.log('Failed to generate dungeon');
}

// ============================================================================
// Example 4: Sequential WFC → Markov Pipeline
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 4: WFC Layout → Markov Detail Generation');
console.log('='.repeat(60));

// Step 1: Generate room layout with WFC
const ROOM = 'R';
const CORRIDOR = 'C';
const EMPTY = ' ';

const layoutConstraints: ConstraintRules = {
  [ROOM]: {
    north: [ROOM, CORRIDOR, EMPTY],
    south: [ROOM, CORRIDOR, EMPTY],
    east: [ROOM, CORRIDOR, EMPTY],
    west: [ROOM, CORRIDOR, EMPTY],
  },
  [CORRIDOR]: {
    north: [ROOM, CORRIDOR, EMPTY],
    south: [ROOM, CORRIDOR, EMPTY],
    east: [ROOM, CORRIDOR, EMPTY],
    west: [ROOM, CORRIDOR, EMPTY],
  },
  [EMPTY]: {north: [EMPTY, CORRIDOR], south: [EMPTY, CORRIDOR], east: [EMPTY, CORRIDOR], west: [EMPTY, CORRIDOR]},
};

const layoutWFC = new WFC({
  seed: 11111,
  states: [ROOM, CORRIDOR, EMPTY],
  constraints: layoutConstraints,
  frequencies: {[ROOM]: 3, [CORRIDOR]: 2, [EMPTY]: 1},
  backtrack: true,
});

const layoutGrid = new WFCGrid2D({
  width: 15,
  height: 8,
  wfc: layoutWFC,
});

const layout = layoutGrid.generate();

console.log('\nStep 1: Generated high-level layout with WFC:');
if (layout) {
  console.log(layout.map(row => row.join(' ')).join('\n'));
} else {
  console.log('Failed to generate layout');
}

// Step 2: Use Markov chain to add detail to each room
const roomDetails = ['chest', 'enemy', 'trap', 'empty', 'npc'];
const detailChain = new MarkovChain<string>({seed: 22222, order: 1});

// Train on example room content patterns
detailChain.train([
  ['empty', 'enemy', 'enemy', 'chest'],
  ['trap', 'enemy', 'chest', 'empty'],
  ['empty', 'npc', 'chest', 'empty'],
  ['enemy', 'enemy', 'trap', 'chest'],
]);

console.log('\nStep 2: Generate room details with Markov chain:');

if (layout) {
  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      if (layout[y][x] === ROOM) {
        const contents = detailChain.generate({length: 2, start: ['empty']});
        console.log(`  Room at (${x},${y}): ${contents.join(', ')}`);
      }
    }
  }
}

// ============================================================================
// Example 5: Adaptive Constraints using Markov Feedback
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 5: Adaptive Generation with Markov Feedback');
console.log('='.repeat(60));

// Generate initial terrain with WFC
const adaptiveWFC = new WFC({
  seed: 33333,
  states: [WATER, SAND, GRASS, FOREST],
  constraints: {
    [WATER]: {north: [WATER, SAND], south: [WATER, SAND], east: [WATER, SAND], west: [WATER, SAND]},
    [SAND]: {north: [WATER, SAND, GRASS], south: [WATER, SAND, GRASS], east: [WATER, SAND, GRASS], west: [WATER, SAND, GRASS]},
    [GRASS]: {north: [SAND, GRASS, FOREST], south: [SAND, GRASS, FOREST], east: [SAND, GRASS, FOREST], west: [SAND, GRASS, FOREST]},
    [FOREST]: {north: [GRASS, FOREST], south: [GRASS, FOREST], east: [GRASS, FOREST], west: [GRASS, FOREST]},
  },
  frequencies: {[WATER]: 2, [SAND]: 1, [GRASS]: 4, [FOREST]: 2},
  backtrack: true,
});

const adaptiveGrid = new WFCGrid2D({
  width: 20,
  height: 10,
  wfc: adaptiveWFC,
});

const adaptiveTerrain = adaptiveGrid.generate();

console.log('\nInitial WFC-generated terrain:');
if (adaptiveTerrain) {
  console.log(adaptiveTerrain.map(row => row.join('')).join('\n'));

  // Train Markov chain on generated result
  const feedbackChain = new MarkovChain<string>({seed: 44444, order: 1});

  for (const row of adaptiveTerrain) {
    feedbackChain.train([row]);
  }

  // Analyze what was generated
  const generatedFreqs = feedbackChain.getStats().frequencyStats;
  console.log('\nAnalyzed frequencies from generated terrain:');
  console.log(generatedFreqs);

  // Generate next iteration with adjusted weights
  console.log('\nGenerating refined terrain with adjusted weights...');

  const refinedWFC = new WFC({
    seed: 55555,
    states: [WATER, SAND, GRASS, FOREST],
    constraints: adaptiveWFC.getConstraints(),
    frequencies: generatedFreqs, // Use feedback frequencies!
    backtrack: true,
  });

  const refinedGrid = new WFCGrid2D({
    width: 20,
    height: 10,
    wfc: refinedWFC,
  });

  const refinedTerrain = refinedGrid.generate();

  if (refinedTerrain) {
    console.log('\nRefined terrain with Markov feedback:');
    console.log(refinedTerrain.map(row => row.join('')).join('\n'));
  }
} else {
  console.log('Failed to generate initial terrain');
}

console.log('\n' + '='.repeat(60));
console.log('WFC + Markov Hybrid Examples Complete!');
console.log('='.repeat(60));
console.log('\nKey Takeaways:');
console.log('1. Use Markov chains to learn frequency weights for WFC');
console.log('2. Generate WFC constraints from Markov transition probabilities');
console.log('3. Combine WFC (spatial) with Markov (sequential) for rich generation');
console.log('4. Use WFC for layout, Markov for details');
console.log('5. Create feedback loops: WFC → analyze → adjust → regenerate');
console.log('='.repeat(60));
