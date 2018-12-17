## acausal

[![npm version](https://badge.fury.io/js/acausal.svg)](https://badge.fury.io/js/acausal) [![GitHub version](https://badge.fury.io/gh/abrisene%2Facausal.svg)](https://badge.fury.io/gh/abrisene%2Facausal)

acausal is a toolset for building procedurally generated content using markov models and other probablistic systems.

### Features ###

**Structures**
+ **Transition Matrix** (1.0.2)
+ **Markov Chain** (1.0.0)

## Installation

Run:

```
npm install -S acausal
```

## Gocausal ##

acausal is also implemented in Golang. You can find the module here:
* [Gocausal](https://github.com/abrisene/gocausal)

## API

### Markov

**Basic Example:**

```javascript

const { Markov } = require('acausal');

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

```

**Advanced Example:**
```javascript

const { Markov } = require('acausal');

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

```
