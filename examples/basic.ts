/*
 # examples/basic.ts
 # Basic Example
 */

//  import { MarkovChain } from '../';
const { MarkovChain } = require('../lib');

// Prepare Data Source - the class expects an array of arrays.
const names = ['alice', 'bob', 'erwin'];
const source = names.map(name => name.split(''));

/* Should result in:
[
  ['a','l','i','c','e'],
  ['b','o','b'],
  ['e','r','w','i','n'],
]
*/

const chain = new MarkovChain({
  seed: 555, // Random Seed - if this is empty it will be generated.
  maxOrder: 1, // Maximum Order - Chain will generate orders up to this value.
  sequences: source, // Source data, expects an array of arrays.
});

// chain.addSequences(source);
// const pickA = chain.pick();
const pickA = chain.generate({ start: ['a'], trim: false });

console.log(chain.sequences);
console.log(pickA);
