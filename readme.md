# _acausal_ [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

[![npm version](https://badge.fury.io/js/acausal.svg)](https://badge.fury.io/js/acausal) [![GitHub version](https://badge.fury.io/gh/abrisene%2Facausal.svg)](https://badge.fury.io/gh/abrisene%2Facausal) [![Build Status](https://travis-ci.com/abrisene/acausal.svg?branch=main)](https://travis-ci.com/abrisene/acausal) [![Coverage Status](https://coveralls.io/repos/github/abrisene/acausal/badge.svg?branch=feature/typescript)](https://coveralls.io/github/abrisene/acausal?branch=feature/typescript)

**Note: This is a beta release. API stability and documentation completeness are not guaranteed.**

*acausal* is a Typescript module that makes it easy to create, edit and generate pseudo random data from **Weighted Random Distributions** and **Markov Chains**.


**Design Philosophy**
- **Immutable:** all classes are built on top of pure functions which do not mutate state, ensuring that models retain their integrity, and making them easy to use with Redux.
- **Portable:** all classes are easily serializable and deserializable into data transfer objects, making them easy to store and rebuild regardless of whether it's on the client or the server.
- **Easy to Use:** all APIs are written to prioritize developer usability, making it easy to rapidly prototype and implement new models.


**Basic Examples:**
```typescript
import { MarkovChain, Distribution, Random } from 'acausal';

// Random Rarity Distribution
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

console.log(mc.generate({ order: 1 }));

/* Results in:

[ 'a', 'l', 'i', 'n' ]

*/

// Random Numbers
const rand = new Random({ seed: 1 });

rand.integer(1, 6); // Roll 1d6

// Results in: 6

```

## Quick Links

- [_acausal_ Home](https://abrisene.github.io/acausal/)
- [Random Distribution Quickstart](https://abrisene.github.io/acausal/readme/distribution.md)
- [Markov Chain Quickstart](https://abrisene.github.io/acausal/readme/markov.md)

## Installation

Run:

```bash
npm install -s acausal
```

### Gocausal

*acausal* is also implemented in Golang. You can find the module here:
* [Gocausal](https://github.com/abrisene/gocausal)

## Random Distributions
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

You can learn more about how to use Random Distributions with _acausal_ in the
[Random Distribution Quickstart](https://abrisene.github.io/acausal/readme/distribution.md).

## Markov Chains

A **Markov Chain** is a mathematical model of a system in which the future state of the system depends only on its present state.

Markov Chains are usually generated by building a statistical model off of sample data, such as a list of names, which can then be used to output sequences which resemble the sampled data. A useful property of this process is that sample data can be "mixed" together like paint to achieve a desired result.

For example, if you wanted to generate names which sounded like a mix of Irish and Japanese, you could generate a Markov Chain from a sample of Irish and Japanese names and the resulting model would be able to output names that mixed the two.

**Markov Chain Quickstart Example - Name Generator:**
```typescript
import { MarkovChain } from 'acausal';

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
```

You can learn more about how to use Markov Chains with _acausal_ in the  [Markov Chain Quickstart](https://abrisene.github.io/acausal/readme/markov.md).


## Extended API Documentation

For documentation of underlying classes and functions, please see the [docs](https://abrisene.github.io/acausal/modules.html).
