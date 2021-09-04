/*
 # examples/basic.ts
 # Basic Example
 */

//  import { MarkovChain } from '..';
const { Distribution, MarkovChain, Random } = require('../lib');

// Random Distribution
const dist = new Distribution({ seed: 1 });
dist.add('Green', 10);    // Common
dist.add('Blue', 5);      // Uncommon
dist.add('Purple', 1);    // Rare

dist.pick(10);

/* Results in:
[
  'Green',  'Green',  'Green',  'Blue',  'Green',
  'Blue',  'Purple', 'Green',  'Green',  'Green'
]
*/

// Markov Chain Name Generator
const mc = new MarkovChain({ seed: 1 });
mc.addSequence('alice'.split(''));
mc.addSequence('bob'.split(''));
mc.addSequence('erwin'.split(''));

mc.generate({ order: 1 });

/* Results in:

[ 'a', 'l', 'i', 'n' ]

*/

// Random Numbers
const rand = new Random({ seed: 1 });
rand.integer(1, 6); // Roll 1d6

// Results in: 6
