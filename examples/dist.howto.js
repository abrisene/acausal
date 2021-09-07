/*
 # examples/dist.howto.js
 # Distribution Howto Example
 */

//  import { MarkovChain } from '..';
const { Distribution, Random } = require('../lib');

/*
  In this example we create a jar containing:
  - 1000 White Marbles
  - 500 Green Marbles
  - 100 Blue Marbles
  - 50 Purple Marbles
*/

// Format the source data
const src = {
  white: 1000,
  green: 500,
  blue: 100,
  purple: 50,
};

/**
 * DISTRIBUTION INSTANCE
 */

(() => {

/*
  CREATION
*/

// Create a new Distribution instance
const jar = new Distribution({
  seed: 5,
  source: src,
});

// Create a clone of the instance
const jarClone = jar.clone();

// Serialize the Jar
const jarData = jar.serialize();

// console.log(jar.serialize());

/*
  UPDATING
*/

// Add 5 yellow marbles
jar.add('yellow', 5);

// Add 1 black, 2 silver, 5 yellow and 10 purple marbles
jar.addValues({ black: 1, silver: 2, yellow: 5, purple: 10 });

// If we wanted to reverse everything, we could do the following:

// Remove 5 yellow marbles
jar.add('yellow', -5);

// Remove 1 black, 5 yellow and 10 purple marbles
jar.addValues({ black: -1, yellow: -5, purple: -10 });

// Remove all black, silver and yellow marbles.
// This removes their keys from both the Normal and Source distributions.
jar.remove(['black', 'silver', 'yellow']);

// console.log(jar.serialize());

// Pick one
const p1a = jar.pickOne();
// => "green"

// Pick one, but ignore white and green marbles.
const p1b = jar.pickOne(['white', 'green']);
// => "blue"

// Pick 5
const p5a = jar.pick(5);
// => [ 'white', 'green', 'green', 'white', 'white' ]

// Pick 5, but ignore white marbles.
const p5b = jar.pick(5, ['white', 'green']);
// => [ 'blue', 'blue', 'blue', 'blue', 'blue' ]

// Pick 5, but remove marble colors we've seen before.
const p5c = jar.pick(5, undefined, true);
// => [ 'green', 'white', 'blue', 'purple' ]

console.log(p1a);
console.log(p1b);
console.log(p5a);
console.log(p5b);
console.log(p5c);
})();

/**
 * DISTRIBUTION FUNCTIONAL METHODS
 */

(() => {

/*
  CREATION
*/

// Create new Distribution data.
let jarData = Distribution.new(src);

// Create a clone of the data.
let jarClone = Distribution.clone(jarData);

/*
  UPDATING
*/

// Add 5 yellow marbles
jarData = Distribution.add(jarData, 'yellow', 5);

// Add 1 black, 2 silver, 5 yellow and 10 purple marbles
jarData = Distribution.addValues(jarData, { black: 1, silver: 2, yellow: 5, purple: 10 });

// console.log(jarData);

// If we wanted to reverse everything, we could do the following:

// Remove 5 yellow marbles
jarData = Distribution.add(jarData, 'yellow', -5);

// Remove 1 black, 5 yellow and 10 purple marbles
jarData = Distribution.addValues(jarData, { black: -1, yellow: -5, purple: -10 });

// Remove all black, silver and yellow marbles.
// This removes their keys from both the Normal and Source distributions.
jarData = Distribution.remove(jarData, ['black', 'silver', 'yellow']);

// console.log(jarData);

// If we want seeded results, we need to create a new random number generator,
// however this is not necessary - an RNG will be created automatically if none is defined.
const rng = new Random({ seed: 5 });

// Pick one
const p1a = Distribution.pickOne(jarData, undefined, rng);
// => "green"

// Pick one, but ignore white and green marbles.
const p1b = Distribution.pickOne(jarData, ['white', 'green'], rng);
// => "blue"

// Pick 5
const p5a = Distribution.pick(jarData, 5, undefined, undefined, rng);
// => [ 'white', 'green', 'green', 'white', 'white' ]

// Pick 5, but ignore white marbles.
const p5b = Distribution.pick(jarData, 5, ['white', 'green'], undefined, rng);
// => [ 'blue', 'blue', 'blue', 'blue', 'blue' ]

// Pick 5, but remove marble colors we've seen before.
const p5c = Distribution.pick(jarData, 5, undefined, true, rng);
// => [ 'green', 'white', 'blue', 'purple' ]

console.log(p1a);
console.log(p1b);
console.log(p5a);
console.log(p5b);
console.log(p5c);
})();

/* Should both result in:
{
  source: {
    white: 1000
    green: 500
    blue: 100
    purple: 50
  },
  normal: {
    white: 0.6060606060606061,
    green: 0.30303030303030304,
    blue: 0.06060606060606061,
    purple: 0.030303030303030304
  }
}
*/
