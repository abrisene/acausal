/*
 # examples/dist.howto.js
 # Distribution Howto Example
 */

//  import { MarkovChain } from '..';
const { MarkovChain, Random } = require('../lib');

// Format the starting source data
const src = [
  ['sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'sunny', 'sunny'],
  ['sunny', 'cloudy', 'cloudy', 'cloudy', 'cloudy', 'rainy', 'cloudy'],
];

/*
  ['cloudy', 'rainy', 'rainy', 'stormy', 'rainy', 'cloudy', 'cloudy'],
  ['sunny', 'cloudy', 'rainy', 'sunny', 'rainy', 'stormy', 'stormy'],
*/

/**
 * MARKOV INSTANCE
 */

(() => {

/*
  CREATION
*/

// Create a new Markov Chain instance
const weather = new MarkovChain({
  seed: 5,
  sequences: src,
  maxOrder: 2,
});

// Create a clone of the instance
const weatherClone = weather.clone();

// We can serialize the Markov Chain in the following ways:
let weatherData;

weatherData = weather.serialize();
weatherData = weather.model;
weatherData = weather.dto;

/*
  UPDATING
*/

// Add a new sequence.
weather.addSequence(['sunny', 'cloudy', 'cloudy', 'cloudy', 'cloudy', 'rainy', 'cloudy']);

// Add multiple sequences.
weather.addSequences([
  ['cloudy', 'rainy', 'rainy', 'stormy', 'rainy', 'cloudy', 'cloudy'],
  ['cloudy', 'rainy', 'stormy', 'rainy', 'rainy', 'cloudy', 'sunny'],
]);

/*
  We can also *insert* sequences.

  By default, sequences a have start and end states prepended and appended.
  This allows the Markov Chain to determine which states to pick from a cold start,
  and where it should naturally end a generated sequence.

  Insertion allows us to explicitly define where we want to add our sequences.
  There are three types of insertion:

  - 'middle' inserts sequences without any start or end state.
  - 'start' inserts sequences with a start state, but no end state.
  - 'end' inserts sequences with an end state, but no start state.

  This is useful if we want to manipulate the probability of a sequence
  without affecting the probability of transitioning to or from the start
  and end states.

  For example in the current data:
  - The only possible start and end states are 'cloudy' and 'sunny'
  - A 'stormy' day must be preceded and followed by a 'rainy' day.
*/

// Insert a sequence that lets 'stormy' days to be followed by 'cloudy' days.
// Inserting 'middle' will make sure that we don't start on 'stormy', or affect
// the likelihood of ending on 'cloudy'.
weather.addSequence(['stormy', 'cloudy'], 'middle');

// Insert a sequence that lets us start on a 'rainy' day.
// Inserting 'start' will allow us to start on 'rainy', but won't affect the likelihood
// of ending on this state.
weather.addSequence(['rainy'], 'start');

// Insert a sequence that lets us end on a 'stormy' day.
// Insterting 'end' will allow us to end on 'stormy', but won't affect the likelihood
// of starting on this state.
weather.addSequence(['stormy'], 'end');

/*
  GENERATION
*/

/*
  Single Picks
*/

// Pick a random next state from the start.
const p1a = weather.pick();
// => 'rainy'

// Pick a random previous state from the end.
const p1b = weather.pick(false, false);
//    'cloudy' <=

// Pick the next state starting from a 'cloudy' day.
const p1c = weather.pick(['cloudy']);
// => 'sunny'

// Pick the next state starting from a 'stormy' day, excluding 'cloudy'.
const p1d = weather.pick(['stormy'], true, ['cloudy']);
// => 'rainy'

// Pick the next state after a two 'rainy' days in a row.
const p1e = weather.pick(['rainy', 'rainy']);
// => 'cloudy'

// Alias for picking a next state after a stormy day.
const p1f = weather.next(['stormy']);
// => 'cloudy'

// Alias for picking a previous state prior to a stormy day.
const p1g = weather.last(['stormy']);
//   'rainy' <=

/*
  Sequence Generation
*/

// Generate weather for at least 3 days
const s1a = weather.generate({
  order: 1,
  min: 3,
});
// => [ 'cloudy', 'sunny', 'cloudy', 'sunny', 'sunny' ]

// Generate weather for at most 5 days.
const s1b = weather.generate({
  order: 1,
  max: 5,
});
// => [ 'sunny', 'cloudy', 'cloudy', 'sunny', 'sunny' ]

// Generate weather for exactly 5 days starting on 'sunny'.
const s1c = weather.generate({
  order: 1,
  min: 5,
  max: 5,
  start: ['sunny'],
});
// => ['sunny', 'cloudy', 'cloudy', 'sunny', 'sunny']

// Generate weather for exactly 5 days, but don't allow 'sunny' or 'cloudy' weather.
const s1d = weather.generate({
  order: 1,
  min: 5,
  max: 5,
  mask: ['sunny', 'cloudy'],
});
// => [ 'rainy', 'rainy', 'rainy', 'stormy', 'rainy' ]

// Generate weather for the PREVIOUS 4 days if today's weather is 'stormy'
const s1e = weather.generate({
  order: 1,
  min: 4,
  max: 4,
  start: ['stormy'],
  direction: 'last',
});
//    [ 'rainy', 'stormy', 'rainy', 'stormy' ] <=


// console.log(p1a, p1b, p1c, p1d, p1e, p1f, p1g);
// console.log(s1a, s1b, s1c, s1d, s1e);

})();

/**
 * MARKOV FUNCTIONAL METHODS
 */

(() => {

/*
  CREATION
*/

// Create a new Markov Chain instance
let weatherData = MarkovChain.new({
  seed: 5,
  sequences: src,
  maxOrder: 2,
});

// Create a clone of the instance
const weatherClone = MarkovChain.clone(weatherData);

/*
  UPDATING
*/

// Add a new sequence.
weatherData = MarkovChain.addSequence(weatherData, ['sunny', 'cloudy', 'cloudy', 'cloudy', 'cloudy', 'rainy', 'cloudy']);

// Add multiple sequences.
weatherData = MarkovChain.addSequences(
  weatherData,
  [
    ['cloudy', 'rainy', 'rainy', 'stormy', 'rainy', 'cloudy', 'cloudy'],
    ['cloudy', 'rainy', 'stormy', 'rainy', 'rainy', 'cloudy', 'sunny'],
  ]
);

/*
  We can also *insert* sequences.

  By default, sequences a have start and end states prepended and appended.
  This allows the Markov Chain to determine which states to pick from a cold start,
  and where it should naturally end a generated sequence.

  Insertion allows us to explicitly define where we want to add our sequences.
  There are three types of insertion:

  - 'middle' inserts sequences without any start or end state.
  - 'start' inserts sequences with a start state, but no end state.
  - 'end' inserts sequences with an end state, but no start state.

  This is useful if we want to manipulate the probability of a sequence
  without affecting the probability of transitioning to or from the start
  and end states.

  For example in the current data:
  - The only possible start and end states are 'cloudy' and 'sunny'
  - A 'stormy' day must be preceded and followed by a 'rainy' day.
*/

// Insert a sequence that lets 'stormy' days to be followed by 'cloudy' days.
// Inserting 'middle' will make sure that we don't start on 'stormy', or affect
// the likelihood of ending on 'cloudy'.
weatherData = MarkovChain.addSequence(weatherData, ['stormy', 'cloudy'], 'middle');

// Insert a sequence that lets us start on a 'rainy' day.
// Inserting 'start' will allow us to start on 'rainy', but won't affect the likelihood
// of ending on this state.
weatherData = MarkovChain.addSequence(weatherData, ['rainy'], 'start');

// Insert a sequence that lets us end on a 'stormy' day.
// Insterting 'end' will allow us to end on 'stormy', but won't affect the likelihood
// of starting on this state.
weatherData = MarkovChain.addSequence(weatherData, ['stormy'], 'end');

/*
  GENERATION
*/

/*
  Single Picks
*/

// If we want seeded results, we need to create a new random number generator,
// however this is not necessary - an RNG will be created automatically if none is defined.
const rng = new Random({ seed: 5 });

// Pick a random next state from the start.
const p1a = MarkovChain.pick(weatherData, undefined, undefined, undefined, rng);
// => 'rainy'

// Pick a random previous state from the end.
const p1b = MarkovChain.pick(weatherData, false, false, undefined, rng);
//    'cloudy' <=

// Pick the next state starting from a 'cloudy' day.
const p1c = MarkovChain.pick(weatherData, ['cloudy'], undefined, undefined, rng);
// => 'sunny'

// Pick the next state starting from a 'stormy' day, excluding 'cloudy'.
const p1d = MarkovChain.pick(weatherData, ['stormy'], true, ['cloudy'], rng);
// => 'rainy'

// Pick the next state after a two 'rainy' days in a row.
const p1e = MarkovChain.pick(weatherData, ['rainy', 'rainy'], undefined, undefined, rng);
// => 'cloudy'

// Alias for picking a next state after a stormy day.
const p1f = MarkovChain.next(weatherData, ['stormy'], undefined, rng);
// => 'cloudy'

// Alias for picking a previous state prior to a stormy day.
const p1g = MarkovChain.last(weatherData, ['stormy'], undefined, rng);
//   'rainy' <=

/*
  Sequence Generation
*/

// Generate weather for at least 3 days
const s1a = MarkovChain.generate({
  model: weatherData,
  engine: rng,
  order: 1,
  min: 3,
});
// => [ 'cloudy', 'sunny', 'cloudy', 'sunny', 'sunny' ]

// Generate weather for at most 5 days.
const s1b = MarkovChain.generate({
  model: weatherData,
  engine: rng,
  order: 1,
  max: 5,
});
// => [ 'sunny', 'cloudy', 'cloudy', 'sunny', 'sunny' ]

// Generate weather for exactly 5 days starting on 'sunny'.
const s1c = MarkovChain.generate({
  model: weatherData,
  engine: rng,
  order: 1,
  min: 5,
  max: 5,
  start: ['sunny'],
});
// => ['sunny', 'cloudy', 'cloudy', 'sunny', 'sunny']

// Generate weather for exactly 5 days, but don't allow 'sunny' or 'cloudy' weather.
const s1d = MarkovChain.generate({
  model: weatherData,
  engine: rng,
  order: 1,
  min: 5,
  max: 5,
  mask: ['sunny', 'cloudy'],
});
// => [ 'rainy', 'rainy', 'rainy', 'stormy', 'rainy' ]

// Generate weather for the PREVIOUS 4 days if today's weather is 'stormy'
const s1e = MarkovChain.generate({
  model: weatherData,
  engine: rng,
  order: 1,
  min: 4,
  max: 4,
  start: ['stormy'],
  direction: 'last',
});
//    [ 'rainy', 'stormy', 'rainy', 'stormy' ] <=


console.log(p1a, p1b, p1c, p1d, p1e, p1f, p1g);
console.log(s1a, s1b, s1c, s1d, s1e);
})();
