/*
 # examples/mc.basic.ts
 # Markov Chain Basic Example
 */

//  import { MarkovChain } from '..';
const { MarkovChain } = require('../lib');

// Sample Data
const jpNames = ['honoka', 'akari', 'himari', 'mei', 'ema'];
const ieNames = ['grace', 'fiadh', 'emily', 'sophie', 'ava'];
const names = [...jpNames, ...ieNames];

// Prepare Data Source - the class expects an array of arrays.
const src = names.map(name => name.split(''));

/* Should result in:
[
  [ 'h', 'o', 'n', 'o', 'k', 'a' ],
  [ 'a', 'k', 'a', 'r', 'i' ],
  [ 'h', 'i', 'm', 'a', 'r', 'i' ],
  [ 'm', 'e', 'i' ],
  [ 'e', 'm', 'a' ],
  [ 'g', 'r', 'a', 'c', 'e' ],
  [ 'f', 'i', 'a', 'd', 'h' ],
  [ 'e', 'm', 'i', 'l', 'y' ],
  [ 's', 'o', 'p', 'h', 'i', 'e' ],
  [ 'a', 'v', 'a' ]
]
*/


// Create the Markov Chain from the source data.
const chain = new MarkovChain({
  seed: 33,       // Random Seed - if this is empty it will be generated.
  maxOrder: 2,    // Maximum Order - Chain will generate orders up to this value.
  sequences: src, // Source data, expects an array of arrays.
});

// Generate 5 picks.
for (let i = 0; i < 3; i += 1) {
  const pick = chain.generate({
    min: 4,       // Min Picks - This will force the model to pick at least 4 times.
    max: 10,      // Max Picks - Stops generation after 10 picks if no end has been reached.
    order: 2,     // Order - The largest gram size used to calculate the next pick.
    strict: false // Strict Order - Dynamically adjusts order up or down each pick if false.
  });
  console.log(pick.join(''));
}

/* Should print:

    sophimari
    emari
    hie

*/
