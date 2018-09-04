/*
 # examples/basic.js
 # Basic Example
 */

const { Markov } = require('../lib');

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

// Create the Chain
const chain = new Markov({
  seed: 555,    // Random Seed - if this is empty it will be generated.
  maxOrder: 1,  // Maximum Order - Chain will generate orders up to this value.
  source,       // Source data, expects an array of arrays.
});

// Generate a value
const value = chain.generate({
  min: 4,       // Minimum Length of the result.
  max: 10,      // Maximum Length of the result.
  order: 1,     // Maximum Order - this will adjust up or down dynamically.
});

console.log(value);

// value => [ 'a', 'l', 'i', 'n' ]
