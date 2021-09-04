/*
 # examples/dist.basic.ts
 # Basic Distribution Example
 */

//  import { MarkovChain } from '..';
const { Distribution } = require('../lib');

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

// Add in 2 Jokers
src['🃏'] = 2;

/* Should result in:
{
  'A♣️': 1,
  '2♣️': 1,
  '3♣️': 1,
  ...
  'J♠️': 1,
  'Q♠️': 1,
  'K♠️': 1,
  '🃏': 2
}
*/

console.log(src);

// Create the Distribution from the deck.
const deck = new Distribution({
  seed: 23,       // Random Seed - if this is empty it will be generated.
  source: src,    // The weighted source to generate the normalized Distribution from.
});

// Generate 4 picks from the deck without replacement.
const picks = deck.pick(4, undefined, true);
console.log(picks);

/* Should print:

[ 'J♣️', '10♠️', '3♦️', '9♣️' ]

*/
