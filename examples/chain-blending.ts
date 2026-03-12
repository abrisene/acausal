/**
 * Chain Blending Examples
 *
 * This example demonstrates how to blend multiple Markov chains together,
 * useful for genetics simulation, loot table mixing, and style interpolation.
 */

import { MarkovChain } from '../src';

console.log('=== Chain Blending Examples ===\n');

// ============================================================================
// Example 1: Character Trait Inheritance (Genetics)
// ============================================================================
console.log('--- Example 1: Character Trait Inheritance ---\n');

// Mother's hair color patterns (mostly dark hair)
const motherHair = [
  ['black', 'black', 'black'],
  ['black', 'brown', 'black'],
  ['brown', 'brown', 'black'],
  ['brown', 'black', 'brown']
];

// Father's hair color patterns (mostly light hair)
const fatherHair = [
  ['blonde', 'blonde', 'blonde'],
  ['blonde', 'light-brown', 'blonde'],
  ['light-brown', 'blonde', 'blonde'],
  ['blonde', 'blonde', 'light-brown']
];

const motherChain = new MarkovChain<string>({ seed: 1, maxOrder: 2 })
  .addSequences(motherHair);

const fatherChain = new MarkovChain<string>({ seed: 2, maxOrder: 2 })
  .addSequences(fatherHair);

// Create a child with 50/50 blend of parent traits
const childChain = MarkovChain.blend([
  { chain: motherChain, weight: 0.5 },
  { chain: fatherChain, weight: 0.5 }
]);

console.log('Parent traits:');
console.log('  Mother hair:', motherChain.generate({ order: 1, min: 1, max: 5 }));
console.log('  Father hair:', fatherChain.generate({ order: 1, min: 1, max: 5 }));
console.log('  Child hair (50/50 blend):', childChain.generate({ order: 1, min: 1, max: 5 }));

// Using interpolate for different genetic dominance
const moreLikeMother = motherChain.interpolate(fatherChain, 0.25); // 75% mother, 25% father
const moreLikeFather = motherChain.interpolate(fatherChain, 0.75); // 25% mother, 75% father

console.log('  More like mother (75/25):', moreLikeMother.generate({ order: 1, min: 1, max: 5 }));
console.log('  More like father (25/75):', moreLikeFather.generate({ order: 1, min: 1, max: 5 }));
console.log();

// ============================================================================
// Example 2: Loot Table Mixing
// ============================================================================
console.log('--- Example 2: Loot Table Mixing ---\n');

const commonLoot = [
  ['copper', 'copper', 'copper', 'wood'],
  ['wood', 'copper', 'stone', 'copper'],
  ['stone', 'copper', 'wood', 'wood'],
  ['copper', 'wood', 'copper', 'copper']
];

const rareLoot = [
  ['gold', 'diamond', 'emerald', 'gold'],
  ['diamond', 'gold', 'ruby', 'gold'],
  ['emerald', 'gold', 'diamond', 'diamond'],
  ['ruby', 'emerald', 'gold', 'emerald']
];

const epicLoot = [
  ['artifact', 'relic', 'artifact', 'legendary'],
  ['legendary', 'artifact', 'relic', 'artifact'],
  ['relic', 'legendary', 'artifact', 'artifact']
];

const commonTable = new MarkovChain<string>({ seed: 3, maxOrder: 2 })
  .addSequences(commonLoot);

const rareTable = new MarkovChain<string>({ seed: 4, maxOrder: 2 })
  .addSequences(rareLoot);

const epicTable = new MarkovChain<string>({ seed: 5, maxOrder: 2 })
  .addSequences(epicLoot);

// Standard chest: 70% common, 25% rare, 5% epic
const standardChest = MarkovChain.blend([
  { chain: commonTable, weight: 0.70 },
  { chain: rareTable, weight: 0.25 },
  { chain: epicTable, weight: 0.05 }
]);

// Boss chest: 20% common, 50% rare, 30% epic
const bossChest = MarkovChain.blend([
  { chain: commonTable, weight: 0.20 },
  { chain: rareTable, weight: 0.50 },
  { chain: epicTable, weight: 0.30 }
]);

console.log('Loot drops:');
console.log('  Standard chest:', standardChest.generate({ order: 1, min: 1, max: 5 }));
console.log('  Boss chest:', bossChest.generate({ order: 1, min: 1, max: 5 }));

// Using minWeight to filter out very low probability items
const filteredChest = MarkovChain.blend([
  { chain: commonTable, weight: 0.70 },
  { chain: rareTable, weight: 0.25 },
  { chain: epicTable, weight: 0.05 }
], {
  minWeight: 0.1
});

console.log('  Filtered chest (minWeight=0.1):', filteredChest.generate({ order: 1, min: 1, max: 5 }));
console.log();

// ============================================================================
// Example 3: Name Generation with Style Mixing
// ============================================================================
console.log('--- Example 3: Name Generation with Style Mixing ---\n');

const fantasyNames = [
  ['e', 'l', 'r', 'o', 'n', 'd'],
  ['g', 'a', 'l', 'a', 'd', 'r', 'i', 'e', 'l'],
  ['a', 'r', 'a', 'g', 'o', 'r', 'n'],
  ['l', 'e', 'g', 'o', 'l', 'a', 's']
];

const scifiNames = [
  ['z', 'y', 'x', 'o', 'n'],
  ['v', 'e', 'x', 'a', 'r'],
  ['n', 'e', 'u', 'r', 'o', 'x'],
  ['c', 'y', 'b', 'e', 'r']
];

const fantasyChain = new MarkovChain<string>({ seed: 6, maxOrder: 2 })
  .addSequences(fantasyNames);

const scifiChain = new MarkovChain<string>({ seed: 7, maxOrder: 2 })
  .addSequences(scifiNames);

console.log('Name styles:');
console.log('  Pure fantasy:', fantasyChain.generate({ order: 1, min: 3, max: 7 }).join(''));
console.log('  Pure sci-fi:', scifiChain.generate({ order: 1, min: 3, max: 7 }).join(''));

// Hybrid styles using different blend strategies
const hybrid50 = fantasyChain.interpolate(scifiChain, 0.5, { strategy: 'arithmetic' });
console.log('  Hybrid (50/50 arithmetic):', hybrid50.generate({ order: 1, min: 3, max: 7 }).join(''));

const hybridGeo = MarkovChain.blend([
  { chain: fantasyChain, weight: 0.5 },
  { chain: scifiChain, weight: 0.5 }
], {
  strategy: 'geometric'
});
console.log('  Hybrid (50/50 geometric):', hybridGeo.generate({ order: 1, min: 3, max: 7 }).join(''));
console.log();

console.log('=== End of Examples ===');
