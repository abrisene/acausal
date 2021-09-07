# acausal

[![npm version](https://badge.fury.io/js/acausal.svg)](https://badge.fury.io/js/acausal) [![GitHub version](https://badge.fury.io/gh/abrisene%2Facausal.svg)](https://badge.fury.io/gh/abrisene%2Facausal) [![Build Status](https://app.travis-ci.com/abrisene/acausal.svg?branch=master)](https://app.travis-ci.com/abrisene/acausal) [![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)](https://github.com/emersion/stability-badges#stable) [![Coverage Status](https://coveralls.io/repos/github/abrisene/acausal/badge.svg?branch=master)](https://coveralls.io/github/abrisene/acausal?branch=master)

## Random Distributions

- [_acausal_ Home](https://github.com/abrisene/acausal/#readme)
- [Markov Chain Quickstart](https://github.com/abrisene/acausal/blob/master/readme/markov.md#acausal-)

A **Random Distribution** is a simple model which can simulate picks from a weighted distribution of items.

Distributions can be used to model random draws from a discrete collection of items, where each item has a different probability of appearing.

**Example Use Cases:**

- Simulating drawing a hand from a standard deck of cards (see below).
- Simulating the outcome of a game of roulette (or nearly any casino game).
- Generating eye or hair color for a fictional person.
- Generating the spectral class of fictional stars.
- Modeling how many McDonalds meals you'd need to buy to win Monopoly.
- Modeling any pseudo-random system through observation.

**Distribution Quickstart Example - Card Deck:**
```typescript
import { Distribution } from 'acausal';

// Create a Deck of Cards
const suits = ['♣️', '♦️', '♥️', '♠️'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Combine the Suits and Ranks
const cards = suits.reduce((last, suit) => {
  return [...last, ...ranks.map(rank => `${rank}${suit}`)];
}, []);

/* Should result in:
[
  'A♣️',  '2♣️',  '3♣️',  '4♣️', '5♣️', '6♣️', '7♣️',
  '8♣️',  '9♣️',  '10♣️', 'J♣️', 'Q♣️', 'K♣️', 'A♦️',
  '2♦️',  '3♦️',  '4♦️',  '5♦️', '6♦️', '7♦️', '8♦️',
  '9♦️',  '10♦️', 'J♦️',  'Q♦️', 'K♦️', 'A♥️', '2♥️',
  '3♥️',  '4♥️',  '5♥️',  '6♥️', '7♥️', '8♥️', '9♥️',
  '10♥️', 'J♥️',  'Q♥️',  'K♥️', 'A♠️', '2♠️', '3♠️',
  '4♠️',  '5♠️',  '6♠️',  '7♠️', '8♠️', '9♠️', '10♠️',
  'J♠️',  'Q♠️',  'K♠️'
]
*/

// Create weighted source data for the Distribution
const src = cards.reduce((last, card) => ({ ...last, [card]: 1 }), {});

/* Should result in:
{
  'A♣️': 1,
  '2♣️': 1,
  '3♣️': 1,
  ...
  'J♠️': 1,
  'Q♠️': 1,
  'K♠️': 1,
}
*/

// Create the Distribution from the deck.
const deck = new Distribution({
  seed: 23,       // Random Seed - if this is empty it will be generated.
  source: src,    // The weighted source to generate the normalized Distribution from.
});

// Add in 2 Jokers
deck.add('🃏', 2);

// Generate 4 picks from the deck without replacement.
const picks = deck.pick(4, undefined, true);
console.log(picks);

/* Should print:

[ 'J♣️', '10♠️', '3♦️', '9♣️' ]

*/
```
### Core Concepts

### How to use Random Distributions

In this example we'll create a jar which a large number of differently colored marbles. We'll create the jar, and then add and remove marbles from it, before pulling out a handful to see what we get.

#### Creation

We'll start by filling the jar with:

- 1000 White Marbles
- 500 Green Marbles
- 100 Blue Marbles
- 50 Purple Marbles

```typescript
// Import the necessary classes
import { Distribution, Random } from 'acausal';

// Format the source data
const src = {
  white: 1000,
  green: 500,
  blue: 100,
  purple: 50,
};
```

##### Instanced Workflow
```typescript
// Create a new Distribution instance
const jar = new Distribution({
  seed: 5,
  source: src,
});

// Create a clone of the instance
const jarClone = jar.clone();

// Serialize the Jar
let jarData = jar.serialize();
```

##### Functional Workflow
```typescript
// Create new Distribution data.
let jarData = Distribution.new(src);

// Create a clone of the data.
let jarClone = Distribution.clone(jarData);
```

##### Results
```typescript
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
```

#### Updating
Here we'll add new black, silver and yellow marbles to our jar, and then remove them.

##### Instanced Workflow

###### Adding to Distributions
```typescript
// Add 5 yellow marbles
jar.add('yellow', 5);

// Add 1 black, 2 silver, 5 yellow and 10 purple marbles
jar.addValues({ black: 1, silver: 2, yellow: 5, purple: 10 });
```

###### Subtracting from Distributions
```typescript
// Remove 5 yellow marbles
jar.add('yellow', -5);

// Remove 1 black, 5 yellow and 10 purple marbles
jar.addValues({ black: -1, yellow: -5, purple: -10 });

// Remove all black, silver and yellow marbles.
// This removes their keys from both the Normal and Source distributions.
jar.remove(['black', 'silver', 'yellow']);
```

##### Functional Workflow

###### Adding to Distributions
```typescript
// Add 5 yellow marbles
jarData = Distribution.add(jarData, 'yellow', 5);

// Add 1 black, 2 silver, 5 yellow and 10 purple marbles
jarData = Distribution.addValues(jarData, { black: 1, silver: 2, yellow: 5, purple: 10 });
```

###### Subtracting from Distributions
```typescript
// Remove 5 yellow marbles
jarData = Distribution.add(jarData, 'yellow', -5);

// Remove 1 black, 5 yellow and 10 purple marbles
jarData = Distribution.addValues(jarData, { black: -1, yellow: -5, purple: -10 });

// Remove all black, silver and yellow marbles.
// This removes their keys from both the Normal and Source distributions.
jarData = Distribution.remove(jarData, ['black', 'silver', 'yellow']);
```

##### Results
```typescript
// After Addition

{
  source: {
    white: 1000,
    green: 500,
    blue: 100,
    purple: 60,
    yellow: 10,
    black: 1,
    silver: 2
  },
  normal: {
    white: 0.5977286312014346,
    green: 0.2988643156007173,
    blue: 0.05977286312014345,
    purple: 0.03586371787208607,
    yellow: 0.005977286312014346,
    black: 0.0005977286312014345,
    silver: 0.001195457262402869
  }
}

// After Subtraction

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
```

#### Generation

Finally, let's pick out some marbles from the jar and see what we get.

##### Instanced Workflow
```typescript
// Pick one marble
const p1a = jar.pickOne();
// => "green"

// Pick one marble, but ignore white and green marbles.
const p1b = jar.pickOne(['white', 'green']);
// => "blue"

// Pick 5 marbles
const p5a = jar.pick(5);
// => [ 'white', 'green', 'green', 'white', 'white' ]

// Pick 5 marbles, but ignore white marbles.
const p5b = jar.pick(5, ['white', 'green']);
// => [ 'blue', 'blue', 'blue', 'blue', 'blue' ]

// Pick 5 marbles, but remove marble colors we've seen before.
const p5c = jar.pick(5, undefined, true);
// => [ 'green', 'white', 'blue', 'purple' ]
```

##### Functional Workflow
```typescript
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
```

### Extended Distribution API Documentation
For documentation of underlying classes and functions, please see the [Distribution Class documentation](https://github.com/abrisene/acausal/modules/structures_distribution.html).

## Next: [Markov Chain Quickstart](https://github.com/abrisene/acausal/blob/master/readme/markov.md#acausal-)
