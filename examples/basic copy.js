/*
 # examples/basic.ts
 # Basic Example
 */

//  import { MarkovChain } from '..';
const { MarkovChain } = require('../lib');

// Prepare Data Source - the class expects an array of arrays.
const names = ['alice', 'bob', 'erwin'];
// const names = ['anna', 'alice', 'elsa', 'elise', 'eve'];
const source = names.map(name => name.split(''));

/* Should result in:
[
  ['a','l','i','c','e'],
  ['b','o','b'],
  ['e','r','w','i','n'],
]
*/

// Create the Markov Chain from the source data.
const chain = new MarkovChain({
  seed: 22, // Random Seed - if this is empty it will be generated.
  maxOrder: 1, // Maximum Order - Chain will generate orders up to this value.
  sequences: source, // Source data, expects an array of arrays.
});

// Generate 5 picks.
for (let i = 0; i < 3; i += 1) {
  const pick = chain.generate({ max: 5 });
  console.log(pick.join(''));
}

/* Should print:

    alin
    bob
    erwicer

*/
