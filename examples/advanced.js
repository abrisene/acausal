/*
 # examples/basic.js
 # Basic Example
 */

const { Markov } = require('../lib');

// Prepare Data Source - the class expects an array of arrays.
const source = [
  [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'c' }, { id: 'b' }, { id: 'a' }],
  [{ id: 'c' }, { id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'c' }, { id: 'c' }],
  [{ id: 'a' }, { id: 'd' }, { id: 'a' }],
  [{ id: 'b' }, { id: 'c' }, { id: 'd' }],
  [{ id: 'c' }, { id: 'c' }, { id: 'c' }],
];

// Extractor - this extracts an id from an item in the source.
const extractor = obj => obj.id;

// Create the Chain
const chain = new Markov({
  seed: 555,    // Random Seed - if this is empty it will be generated.
  maxOrder: 2,  // Maximum Order - Chain will generate orders up to this value.
  source,       // Source data, expects an array of arrays.
  extractor,    // Id extractor function.
});

// Generate a value
const value = chain.generate({
  min: 4,       // Minimum Length of the result.
  max: 5,       // Maximum Length of the result.
  order: 2,     // Maximum Order - this will adjust up or down dynamically.
  start: ['c'], // Starts generation from this sequence.
});

console.log(value); 

// value => [[ { id: 'c' }, { id: 'c' }, { id: 'b' }, { id: 'c' }, { id: 'c' } ]
