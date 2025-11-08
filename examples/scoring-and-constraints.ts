/**
 * Scoring and Constraint-Based Generation Examples
 *
 * Demonstrates Phase 8 features: sequence scoring, ranking, anomaly detection,
 * and constraint-based generation.
 */

import { MarkovChain } from '../src';

console.log('=== Scoring and Constraint-Based Generation Examples ===\n');

// ============================================================================
// Example 1: Sequence Scoring & Likelihood Analysis
// ============================================================================
console.log('--- Example 1: Name Quality Scoring ---\n');

const nameChain = new MarkovChain({ seed: 1, maxOrder: 2 });

const names = [
  'alice', 'bob', 'charlie', 'david', 'emma',
  'frank', 'grace', 'henry', 'iris', 'jack'
];

const trainedNames = nameChain.addSequences(names.map(n => n.split('')));

// Score different name candidates
const candidates = ['alice', 'bob', 'xqzrf', 'emma', 'zzz'];

console.log('Scoring name candidates:');
candidates.forEach(name => {
  const score = trainedNames.score(name.split(''));
  console.log(`  "${name}"`);
  console.log(`    Log Probability: ${score.logProb.toFixed(3)}`);
  console.log(`    Perplexity: ${score.perplexity.toFixed(3)}`);
  console.log(`    Is Valid: ${score.isValid}`);
  console.log(`    Normalized: ${score.normalized.toFixed(3)}`);
  console.log();
});

// ============================================================================
// Example 2: Ranking by Likelihood
// ============================================================================
console.log('--- Example 2: Ranking Generated vs Random Names ---\n');

const testNames = ['alice', 'grace', 'xqzyw', 'emma', 'zzzz', 'bob'];
const ranked = trainedNames.rankByLikelihood(testNames.map(n => n.split('')));

console.log('Names ranked by likelihood (best to worst):');
ranked.forEach(result => {
  const name = result.sequence.join('');
  console.log(`  ${result.rank}. "${name}" (perplexity: ${result.perplexity.toFixed(2)})`);
});
console.log();

// ============================================================================
// Example 3: Anomaly Detection
// ============================================================================
console.log('--- Example 3: Anomaly Detection in Weather Patterns ---\n');

const weatherChain = new MarkovChain({ seed: 2, maxOrder: 2 });

const weatherPatterns = [
  ['sunny', 'sunny', 'cloudy'],
  ['sunny', 'cloudy', 'rainy'],
  ['cloudy', 'rainy', 'cloudy'],
  ['rainy', 'cloudy', 'sunny'],
  ['cloudy', 'cloudy', 'rainy'],
];

const trainedWeather = weatherChain.addSequences(weatherPatterns);

// Test various patterns for anomalies
const testPatterns = [
  ['sunny', 'cloudy'],           // Normal
  ['cloudy', 'rainy'],           // Normal
  ['blizzard', 'tornado'],       // Anomaly - never seen
  ['rainy', 'rainy', 'rainy'],   // Potentially anomalous
];

console.log('Detecting weather anomalies (threshold: 50):');
testPatterns.forEach(pattern => {
  const isAnomaly = trainedWeather.isAnomaly(pattern, 50);
  const score = trainedWeather.score(pattern);
  console.log(`  ${pattern.join(' → ')}`);
  console.log(`    Anomalous: ${isAnomaly ? '⚠️  YES' : '✅  NO'}`);
  console.log(`    Perplexity: ${score.perplexity.toFixed(2)}`);
  console.log();
});

// ============================================================================
// Example 4: Constraint-Based Name Generation
// ============================================================================
console.log('--- Example 4: Generating Names with Constraints ---\n');

// Generate names with specific requirements
console.log('Generating names with length 5-7:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      minLength: 5,
      maxLength: 7,
      maxRetries: 100,
    },
  }).join('');
  console.log(`  ${i + 1}. ${name} (length: ${name.length})`);
}
console.log();

console.log('Generating names containing specific letters:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      mustContain: ['a', 'e'],
      minLength: 4,
      maxRetries: 100,
    },
  }).join('');
  console.log(`  ${i + 1}. ${name} (contains: ${name.includes('a') && name.includes('e') ? '✓ a,e' : '✗'})`);
}
console.log();

console.log('Generating names without certain letters:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      mustNotContain: ['z', 'x', 'q'],
      minLength: 4,
      maxRetries: 100,
    },
  }).join('');
  const hasZ = name.includes('z') || name.includes('x') || name.includes('q');
  console.log(`  ${i + 1}. ${name} (no z/x/q: ${hasZ ? '✗' : '✓'})`);
}
console.log();

// ============================================================================
// Example 5: Pattern-Based Generation
// ============================================================================
console.log('--- Example 5: Pattern-Based Generation ---\n');

// Generate names matching specific patterns
console.log('Generating names starting with vowel:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      pattern: /^[aeiou]/,
      minLength: 4,
      maxRetries: 100,
    },
  }).join('');
  console.log(`  ${i + 1}. ${name}`);
}
console.log();

console.log('Generating names ending with specific pattern:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      pattern: /[aeiou]$/,  // Ends with vowel
      minLength: 4,
      maxRetries: 100,
    },
  }).join('');
  console.log(`  ${i + 1}. ${name}`);
}
console.log();

// ============================================================================
// Example 6: Custom Validator for Content Filtering
// ============================================================================
console.log('--- Example 6: Custom Validator for Content Filtering ---\n');

const sentenceChain = new MarkovChain({ seed: 3, maxOrder: 2 });

const sentences = [
  ['the', 'cat', 'sat', 'on', 'the', 'mat'],
  ['the', 'dog', 'ran', 'in', 'the', 'park'],
  ['a', 'bird', 'flew', 'over', 'the', 'tree'],
];

const trainedSentences = sentenceChain.addSequences(sentences);

// Forbidden words list (profanity filter example)
const forbiddenWords = ['bad', 'ugly', 'hate'];

console.log('Generating sentences without forbidden words:');
for (let i = 0; i < 3; i++) {
  const sentence = trainedSentences.generate({
    order: 2,
    max: 10,
    constraints: {
      minLength: 4,
      maxLength: 8,
      validator: (seq) => {
        const text = seq.join(' ');
        return !forbiddenWords.some(word => text.includes(word));
      },
      maxRetries: 100,
    },
  }).join(' ');
  console.log(`  ${i + 1}. ${sentence}`);
}
console.log();

// ============================================================================
// Example 7: Combined Constraints for Quality Control
// ============================================================================
console.log('--- Example 7: Multi-Constraint Quality Control ---\n');

console.log('Generating high-quality names with multiple constraints:');
for (let i = 0; i < 3; i++) {
  const name = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      minLength: 5,
      maxLength: 8,
      mustContain: ['a'],
      mustNotContain: ['z', 'x', 'q'],
      pattern: /^[a-z]+$/,  // All lowercase
      validator: (seq) => {
        // Custom rule: no repeated characters more than twice
        const str = seq.join('');
        return !/(.)\1{2,}/.test(str);
      },
      maxRetries: 200,
    },
  }).join('');
  console.log(`  ${i + 1}. ${name}`);
}
console.log();

// ============================================================================
// Example 8: Scoring for Autocomplete Ranking
// ============================================================================
console.log('--- Example 8: Autocomplete Ranking ---\n');

const prefix = 'al';
const completions = ['alice', 'albert', 'alex', 'alfred', 'allan'];

console.log(`Ranking autocomplete suggestions for "${prefix}":`);

const rankedCompletions = trainedNames.rankByLikelihood(
  completions.map(c => c.split(''))
);

rankedCompletions.forEach(result => {
  const name = result.sequence.join('');
  console.log(`  ${result.rank}. ${name} (score: ${result.normalized.toFixed(3)})`);
});
console.log();

// ============================================================================
// Example 9: Anomaly Detection in User Input
// ============================================================================
console.log('--- Example 9: Detecting Suspicious User Input ---\n');

// Check if user input matches expected patterns
const userInputs = ['alice', 'bob', 'asdf', 'qwerty', 'grace'];

console.log('Analyzing user inputs for suspicious patterns:');
userInputs.forEach(input => {
  const isAnomalous = trainedNames.isAnomaly(input.split(''), 30);
  const score = trainedNames.score(input.split(''));

  if (isAnomalous) {
    console.log(`  ⚠️  "${input}" - SUSPICIOUS (perplexity: ${score.perplexity.toFixed(2)})`);
  } else {
    console.log(`  ✓  "${input}" - OK (perplexity: ${score.perplexity.toFixed(2)})`);
  }
});
console.log();

// ============================================================================
// Example 10: Constraint Satisfaction for Domain Rules
// ============================================================================
console.log('--- Example 10: Domain-Specific Rules ---\n');

// Generate usernames with specific business rules
console.log('Generating valid usernames (5-10 chars, must start with letter):');
for (let i = 0; i < 5; i++) {
  const username = trainedNames.generate({
    order: 2,
    max: 20,
    constraints: {
      minLength: 5,
      maxLength: 10,
      pattern: /^[a-z]/,  // Must start with letter
      validator: (seq) => {
        const str = seq.join('');
        // No consecutive repeating characters
        if (/(.)\1/.test(str)) return false;
        // Must have at least one vowel
        if (!/[aeiou]/.test(str)) return false;
        return true;
      },
      maxRetries: 200,
    },
  }).join('');
  console.log(`  ${i + 1}. ${username}`);
}
console.log();

console.log('=== End of Examples ===');