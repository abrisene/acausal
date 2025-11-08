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

const motherChain = new MarkovChain<string>({ seed: 1, maxOrder: 2 });
motherChain.addSequences(motherHair);

const fatherChain = new MarkovChain<string>({ seed: 2, maxOrder: 2 });
fatherChain.addSequences(fatherHair);

// Create a child with 50/50 blend of parent traits
const childChain = MarkovChain.blend([
  { chain: motherChain, weight: 0.5 },
  { chain: fatherChain, weight: 0.5 }
]);

console.log('Parent traits:');
console.log('  Mother hair:', motherChain.generate({ order: 1, length: 5 }));
console.log('  Father hair:', fatherChain.generate({ order: 1, length: 5 }));
console.log('  Child hair (50/50 blend):', childChain.generate({ order: 1, length: 5 }));

// Using interpolate for different genetic dominance
const moreLikeMother = motherChain.interpolate(fatherChain, 0.25); // 75% mother, 25% father
const moreLikeFather = motherChain.interpolate(fatherChain, 0.75); // 25% mother, 75% father

console.log('  More like mother (75/25):', moreLikeMother.generate({ order: 1, length: 5 }));
console.log('  More like father (25/75):', moreLikeFather.generate({ order: 1, length: 5 }));
console.log();

// ============================================================================
// Example 2: Loot Table Mixing
// ============================================================================
console.log('--- Example 2: Loot Table Mixing ---\n');

// Common loot drops (frequently found items)
const commonLoot = [
  ['copper', 'copper', 'copper', 'wood'],
  ['wood', 'copper', 'stone', 'copper'],
  ['stone', 'copper', 'wood', 'wood'],
  ['copper', 'wood', 'copper', 'copper']
];

// Rare loot drops (high-value items)
const rareLoot = [
  ['gold', 'diamond', 'emerald', 'gold'],
  ['diamond', 'gold', 'ruby', 'gold'],
  ['emerald', 'gold', 'diamond', 'diamond'],
  ['ruby', 'emerald', 'gold', 'emerald']
];

// Epic loot drops (legendary items)
const epicLoot = [
  ['artifact', 'relic', 'artifact', 'legendary'],
  ['legendary', 'artifact', 'relic', 'artifact'],
  ['relic', 'legendary', 'artifact', 'artifact']
];

const commonTable = new MarkovChain<string>({ seed: 3, maxOrder: 2 });
commonTable.addSequences(commonLoot);

const rareTable = new MarkovChain<string>({ seed: 4, maxOrder: 2 });
rareTable.addSequences(rareLoot);

const epicTable = new MarkovChain<string>({ seed: 5, maxOrder: 2 });
epicTable.addSequences(epicLoot);

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

// Special event: 100% epic (no blending needed, but showing flexibility)
const eventChest = MarkovChain.blend([
  { chain: epicTable, weight: 1.0 }
]);

console.log('Loot drops:');
console.log('  Standard chest:', standardChest.generate({ order: 1, length: 5 }));
console.log('  Boss chest:', bossChest.generate({ order: 1, length: 5 }));
console.log('  Event chest:', eventChest.generate({ order: 1, length: 5 }));
console.log();

// Using minWeight to filter out very low probability items
const filteredChest = MarkovChain.blend([
  { chain: commonTable, weight: 0.70 },
  { chain: rareTable, weight: 0.25 },
  { chain: epicTable, weight: 0.05 }
], {
  minWeight: 0.1 // Only include items with at least 10% combined weight
});

console.log('  Filtered chest (minWeight=0.1):', filteredChest.generate({ order: 1, length: 5 }));
console.log();

// ============================================================================
// Example 3: Name Generation with Style Mixing
// ============================================================================
console.log('--- Example 3: Name Generation with Style Mixing ---\n');

// Fantasy names (elf-style)
const fantasyNames = [
  ['e', 'l', 'r', 'o', 'n', 'd'],
  ['g', 'a', 'l', 'a', 'd', 'r', 'i', 'e', 'l'],
  ['a', 'r', 'a', 'g', 'o', 'r', 'n'],
  ['l', 'e', 'g', 'o', 'l', 'a', 's']
];

// Sci-fi names (tech-style)
const scifiNames = [
  ['z', 'y', 'x', 'o', 'n'],
  ['v', 'e', 'x', 'a', 'r'],
  ['n', 'e', 'u', 'r', 'o', 'x'],
  ['c', 'y', 'b', 'e', 'r']
];

const fantasyChain = new MarkovChain<string>({ seed: 6, maxOrder: 2 });
fantasyChain.addSequences(fantasyNames);

const scifiChain = new MarkovChain<string>({ seed: 7, maxOrder: 2 });
scifiChain.addSequences(scifiNames);

// Pure fantasy
console.log('Name styles:');
console.log('  Pure fantasy:', fantasyChain.generate({ order: 1, length: 7 }).join(''));

// Pure sci-fi
console.log('  Pure sci-fi:', scifiChain.generate({ order: 1, length: 7 }).join(''));

// Hybrid styles using different blend strategies
const hybrid50 = fantasyChain.interpolate(scifiChain, 0.5, { strategy: 'arithmetic' });
console.log('  Hybrid (50/50 arithmetic):', hybrid50.generate({ order: 1, length: 7 }).join(''));

const hybridGeo = MarkovChain.blend([
  { chain: fantasyChain, weight: 0.5 },
  { chain: scifiChain, weight: 0.5 }
], {
  strategy: 'geometric' // Multiplicative blend, preserves relative probabilities
});
console.log('  Hybrid (50/50 geometric):', hybridGeo.generate({ order: 1, length: 7 }).join(''));

// Mostly fantasy with a hint of sci-fi
const subtleHybrid = fantasyChain.interpolate(scifiChain, 0.15);
console.log('  Subtle sci-fi influence:', subtleHybrid.generate({ order: 1, length: 7 }).join(''));

// Mostly sci-fi with a hint of fantasy
const techHybrid = scifiChain.interpolate(fantasyChain, 0.15);
console.log('  Subtle fantasy influence:', techHybrid.generate({ order: 1, length: 7 }).join(''));
console.log();

// ============================================================================
// Example 4: Multiple Blend Strategies Comparison
// ============================================================================
console.log('--- Example 4: Blend Strategy Comparison ---\n');

const chain1 = new MarkovChain<string>({ seed: 8, maxOrder: 1 });
chain1.addSequence(['a', 'b', 'c', 'd']);

const chain2 = new MarkovChain<string>({ seed: 9, maxOrder: 1 });
chain2.addSequence(['x', 'y', 'z', 'w']);

console.log('Blending strategies with equal weights:');
console.log('  Arithmetic (average):', MarkovChain.blend([
  { chain: chain1, weight: 1 },
  { chain: chain2, weight: 1 }
], { strategy: 'arithmetic' }).generate({ order: 1, length: 8 }));

console.log('  Geometric (multiplicative):', MarkovChain.blend([
  { chain: chain1, weight: 1 },
  { chain: chain2, weight: 1 }
], { strategy: 'geometric' }).generate({ order: 1, length: 8 }));

console.log('  Harmonic (reciprocal):', MarkovChain.blend([
  { chain: chain1, weight: 1 },
  { chain: chain2, weight: 1 }
], { strategy: 'harmonic' }).generate({ order: 1, length: 8 }));

console.log('  Max (takes maximum):', MarkovChain.blend([
  { chain: chain1, weight: 1 },
  { chain: chain2, weight: 1 }
], { strategy: 'max' }).generate({ order: 1, length: 8 }));

console.log('  Min (takes minimum):', MarkovChain.blend([
  { chain: chain1, weight: 1 },
  { chain: chain2, weight: 1 }
], { strategy: 'min' }).generate({ order: 1, length: 8 }));
console.log();

console.log('=== End of Examples ===');
