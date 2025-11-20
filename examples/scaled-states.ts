/**
 * Scaled States & Continuous Values Examples
 *
 * Demonstrates ScaledMarkovChain for modeling systems where states
 * have both categorical values and continuous magnitudes.
 */

import { ScaledMarkovChain } from '../src';

console.log('=== Scaled States Examples ===\n');

// ============================================================================
// Example 1: Stock Market Sentiment with Price Changes
// ============================================================================
console.log('--- Example 1: Market Sentiment Tracking ---\n');

const marketChain = new ScaledMarkovChain<'bullish' | 'bearish' | 'neutral'>({
  seed: 1,
  maxOrder: 2,
  magnitudeRange: [-100, 100],
  samplingStrategy: 'mean'
});

// Historical market data: sentiment + price change percentage
const marketData = [
  [
    { category: 'neutral', magnitude: 0 },
    { category: 'bullish', magnitude: 15 },
    { category: 'bullish', magnitude: 22 },
    { category: 'neutral', magnitude: -5 },
    { category: 'bearish', magnitude: -18 }
  ],
  [
    { category: 'bullish', magnitude: 12 },
    { category: 'bullish', magnitude: 8 },
    { category: 'neutral', magnitude: 2 },
    { category: 'bearish', magnitude: -12 },
    { category: 'bearish', magnitude: -20 }
  ]
];

const trainedMarket = marketChain.addScaledSequences(marketData);

// Generate market forecast
const forecast = trainedMarket.generateScaled({ order: 2, min: 3, max: 5 });
console.log('Market forecast:');
forecast.forEach((state, i) => {
  console.log(`  Day ${i + 1}: ${state.category.padEnd(10)} (${state.magnitude > 0 ? '+' : ''}${state.magnitude.toFixed(1)}%)`);
});
console.log();

// Get statistics for bullish periods
const bullishStats = trainedMarket.getMagnitudeStats('bullish');
console.log('Bullish period statistics:');
console.log(`  Average change: +${bullishStats?.mean.toFixed(1)}%`);
console.log(`  Range: ${bullishStats?.min.toFixed(1)}% to ${bullishStats?.max.toFixed(1)}%`);
console.log();

// ============================================================================
// Example 2: Weather Patterns with Temperature
// ============================================================================
console.log('--- Example 2: Weather with Temperature ---\n');

const weatherChain = new ScaledMarkovChain<'sunny' | 'cloudy' | 'rainy' | 'stormy'>({
  seed: 2,
  maxOrder: 1,
  magnitudeRange: [-10, 40],  // Temperature in Celsius
  samplingStrategy: 'median'
});

const weatherData = [
  [
    { category: 'sunny', magnitude: 25 },
    { category: 'sunny', magnitude: 27 },
    { category: 'cloudy', magnitude: 22 },
    { category: 'rainy', magnitude: 18 },
    { category: 'cloudy', magnitude: 20 }
  ],
  [
    { category: 'cloudy', magnitude: 19 },
    { category: 'rainy', magnitude: 16 },
    { category: 'stormy', magnitude: 14 },
    { category: 'rainy', magnitude: 15 },
    { category: 'cloudy', magnitude: 17 }
  ]
];

const trainedWeather = weatherChain.addScaledSequences(weatherData);

// Generate weather forecast
const weekForecast = trainedWeather.generateScaled({ order: 1, min: 7, max: 7 });
console.log('7-day weather forecast:');
weekForecast.forEach((state, i) => {
  console.log(`  Day ${i + 1}: ${state.category.padEnd(8)} ${state.magnitude.toFixed(1)}°C`);
});
console.log();

// ============================================================================
// Example 3: Game Character States with Health
// ============================================================================
console.log('--- Example 3: Character State Machine ---\n');

const characterChain = new ScaledMarkovChain<'idle' | 'walking' | 'running' | 'fighting' | 'resting'>({
  seed: 3,
  maxOrder: 2,
  magnitudeRange: [0, 100],  // Health/stamina level
  samplingStrategy: 'mean'
});

// Gameplay sequences
const gameplayData = [
  [
    { category: 'idle', magnitude: 100 },
    { category: 'walking', magnitude: 98 },
    { category: 'fighting', magnitude: 75 },
    { category: 'fighting', magnitude: 60 },
    { category: 'resting', magnitude: 70 }
  ],
  [
    { category: 'idle', magnitude: 100 },
    { category: 'running', magnitude: 90 },
    { category: 'fighting', magnitude: 70 },
    { category: 'resting', magnitude: 80 },
    { category: 'idle', magnitude: 95 }
  ]
];

const trainedCharacter = characterChain.addScaledSequences(gameplayData);

// Simulate character behavior
const behavior = trainedCharacter.generateScaled({ order: 2, min: 5, max: 8 });
console.log('Character behavior simulation:');
behavior.forEach((state, i) => {
  const healthBar = '█'.repeat(Math.floor(state.magnitude / 10)) + '░'.repeat(10 - Math.floor(state.magnitude / 10));
  console.log(`  ${(i + 1).toString().padStart(2)}: ${state.category.padEnd(10)} [${healthBar}] ${state.magnitude.toFixed(0)}%`);
});
console.log();

// ============================================================================
// Example 4: Different Sampling Strategies
// ============================================================================
console.log('--- Example 4: Sampling Strategy Comparison ---\n');

const testData = [
  [
    { category: 'value', magnitude: 10 },
    { category: 'value', magnitude: 20 },
    { category: 'value', magnitude: 30 },
    { category: 'value', magnitude: 40 },
    { category: 'value', magnitude: 50 }
  ]
];

// Mean strategy
const meanChain = new ScaledMarkovChain<'value'>({
  seed: 4,
  maxOrder: 1,
  samplingStrategy: 'mean'
}).addScaledSequences(testData);

// Median strategy
const medianChain = new ScaledMarkovChain<'value'>({
  seed: 5,
  maxOrder: 1,
  samplingStrategy: 'median'
}).addScaledSequences(testData);

// Weighted sample strategy (uses RNG for reproducibility)
const sampleChain = new ScaledMarkovChain<'value'>({
  seed: 6,
  maxOrder: 1,
  samplingStrategy: 'weighted-sample'
}).addScaledSequences(testData);

console.log('Sampling strategies (data: 10, 20, 30, 40, 50):');
console.log(`  Mean:            ${meanChain.generateScaled({ order: 1, min: 1, max: 1 })[0]?.magnitude.toFixed(1)} (average)`);
console.log(`  Median:          ${medianChain.generateScaled({ order: 1, min: 1, max: 1 })[0]?.magnitude.toFixed(1)} (middle value)`);
console.log(`  Weighted sample: ${sampleChain.generateScaled({ order: 1, min: 1, max: 1 })[0]?.magnitude.toFixed(1)} (random from observed)`);
console.log();

console.log('=== End of Examples ===');
