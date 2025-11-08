/*
 * Pattern Analysis Examples
 * Demonstrates pattern extraction and similarity search in Markov chains
 */

import { MarkovChain } from '../dist/index.js';

console.log('=== Pattern Extraction & Analysis Examples ===\n');

// ============================================================================
// Example 1: Basic Pattern Extraction
// ============================================================================
console.log('--- Example 1: Discovering Frequent Patterns ---\n');

const textChain = new MarkovChain({ maxOrder: 3 });
textChain.addSequences([
  ['the', 'quick', 'brown', 'fox', 'jumps'],
  ['the', 'lazy', 'brown', 'dog', 'sleeps'],
  ['the', 'quick', 'red', 'fox', 'runs'],
  ['the', 'quick', 'brown', 'cat', 'jumps'],
]);

const patterns = textChain.extractPatterns({
  minOrder: 2,
  maxOrder: 3,
  minFrequency: 2,
  topN: 10,
});

console.log('Frequent patterns discovered:');
patterns.forEach(p => {
  console.log(`  "${p.pattern.join(' ')}" - appears ${p.frequency} times (${(p.probability * 100).toFixed(1)}%)`);
});
console.log();

// ============================================================================
// Example 2: Content Deduplication
// ============================================================================
console.log('--- Example 2: Detecting Duplicate Content ---\n');

const issueChain = new MarkovChain({ maxOrder: 3 });
issueChain.addSequences([
  ['fix', 'the', 'bug', 'in', 'authentication'],
  ['fix', 'authentication', 'bug'],
  ['resolve', 'auth', 'issue'],
  ['update', 'user', 'profile', 'page'],
  ['fix', 'bug', 'in', 'auth'],
]);

const newIssue = ['fix', 'the', 'authentication', 'bug'];

console.log(`New issue: "${newIssue.join(' ')}"`);
console.log('\nChecking for similar existing issues...');

const duplicates = issueChain.findSimilar(newIssue, {
  metric: 'jaccard',
  threshold: 0.6,
  topN: 3,
});

if (duplicates.length > 0) {
  console.log('Potential duplicates found:');
  duplicates.forEach((dup, i) => {
    console.log(`  ${i + 1}. "${dup.sequence.join(' ')}" (${(dup.similarity * 100).toFixed(0)}% similar)`);
  });
} else {
  console.log('No duplicates found - this is a new issue');
}
console.log();

// ============================================================================
// Example 3: Recommendation System
// ============================================================================
console.log('--- Example 3: User Behavior Recommendations ---\n');

const userJourneyChain = new MarkovChain({ maxOrder: 2 });
userJourneyChain.addSequences([
  ['home', 'products', 'laptop', 'specs', 'cart', 'checkout'],
  ['home', 'products', 'laptop', 'reviews', 'cart', 'checkout'],
  ['home', 'products', 'phone', 'specs', 'compare', 'exit'],
  ['search', 'laptop', 'compare', 'reviews', 'cart', 'checkout'],
  ['home', 'products', 'laptop', 'specs', 'reviews', 'cart'],
]);

const currentJourney = ['home', 'products', 'laptop', 'specs'];

console.log(`Current user journey: ${currentJourney.join(' → ')}`);
console.log('\nFinding similar user journeys...');

const similarJourneys = userJourneyChain.findSimilar(currentJourney, {
  metric: 'cosine',
  topN: 3,
});

console.log('\nUsers with similar journeys typically:');
similarJourneys.forEach((journey, i) => {
  console.log(`  ${i + 1}. ${journey.sequence.join(' → ')}`);
  console.log(`     (${(journey.similarity * 100).toFixed(0)}% similar)`);
});
console.log();

// ============================================================================
// Example 4: Log Pattern Mining
// ============================================================================
console.log('--- Example 4: Mining System Log Patterns ---\n');

const logChain = new MarkovChain({ maxOrder: 4 });
logChain.addSequences([
  ['login', 'query', 'query', 'error', 'retry', 'success'],
  ['login', 'query', 'success', 'logout'],
  ['login', 'query', 'query', 'error', 'timeout'],
  ['login', 'update', 'error', 'rollback'],
  ['login', 'query', 'query', 'error', 'retry', 'timeout'],
  ['login', 'query', 'success', 'update', 'success'],
]);

console.log('Discovering common patterns in system logs...\n');

const logPatterns = logChain.extractPatterns({
  minOrder: 3,
  maxOrder: 4,
  minFrequency: 2,
  topN: 5,
});

console.log('Most common operation sequences:');
logPatterns.forEach(p => {
  console.log(`  ${p.pattern.join(' → ')} (occurs ${p.frequency} times)`);
});

console.log('\nError patterns:');
const errorPatterns = logPatterns.filter(p => p.pattern.includes('error'));
errorPatterns.forEach(p => {
  console.log(`  ${p.pattern.join(' → ')}`);
});
console.log();

// ============================================================================
// Example 5: Text Autocorrect
// ============================================================================
console.log('--- Example 5: Name Autocorrect ---\n');

const nameChain = new MarkovChain({ maxOrder: 2 });
nameChain.addSequences([
  ['a', 'l', 'i', 'c', 'e'],
  ['a', 'l', 'e', 'x'],
  ['a', 'l', 'i', 's', 'o', 'n'],
  ['b', 'o', 'b'],
  ['c', 'a', 'r', 'o', 'l'],
  ['d', 'a', 'v', 'i', 'd'],
]);

const typos = [
  ['a', 'l', 'i', 'x'],      // Should suggest alice, alex
  ['b', 'o', 'n'],           // Should suggest bob
  ['c', 'a', 'r', 'l'],      // Should suggest carol
];

console.log('Autocorrect suggestions:\n');

typos.forEach(typo => {
  const input = typo.join('');
  console.log(`Input: "${input}"`);

  const suggestions = nameChain.findSimilar(typo, {
    metric: 'levenshtein',
    topN: 3,
    threshold: 0.5,
  });

  if (suggestions.length > 0) {
    console.log('  Did you mean:');
    suggestions.forEach((s, i) => {
      const name = s.sequence.join('');
      console.log(`    ${i + 1}. ${name} (${(s.similarity * 100).toFixed(0)}% match)`);
    });
  } else {
    console.log('  No suggestions found');
  }
  console.log();
});

// ============================================================================
// Example 6: Clustering Similar Sequences
// ============================================================================
console.log('--- Example 6: Clustering Similar Phrases ---\n');

const phraseChain = new MarkovChain({ maxOrder: 2 });
const phrases = [
  ['quick', 'brown', 'fox'],
  ['quick', 'red', 'fox'],
  ['lazy', 'brown', 'dog'],
  ['lazy', 'grey', 'dog'],
  ['fast', 'brown', 'rabbit'],
  ['slow', 'grey', 'turtle'],
];

phraseChain.addSequences(phrases);

console.log('Grouping similar phrases into clusters...\n');

// Find clusters
const clusters = new Map<string, string[][]>();

phrases.forEach(phrase => {
  const similar = phraseChain.findSimilar(phrase, {
    metric: 'jaccard',
    threshold: 0.4,
  });

  if (similar.length > 1) {
    const key = phrase.join(' ');
    clusters.set(key, similar.map(s => s.sequence));
  }
});

// Display unique clusters
const processed = new Set<string>();
clusters.forEach((members, center) => {
  if (!processed.has(center)) {
    console.log(`Cluster: "${center}"`);
    members.forEach(member => {
      const memberKey = member.join(' ');
      if (memberKey !== center) {
        console.log(`  - ${memberKey}`);
        processed.add(memberKey);
      }
    });
    processed.add(center);
    console.log();
  }
});

// ============================================================================
// Example 7: Comparing Similarity Metrics
// ============================================================================
console.log('--- Example 7: Comparing Different Similarity Metrics ---\n');

const metricChain = new MarkovChain({ maxOrder: 2 });
metricChain.addSequences([
  ['a', 'b', 'c', 'd'],
  ['a', 'b', 'x', 'y'],
  ['a', 'a', 'b', 'c'],
  ['x', 'y', 'z'],
]);

const testSequence = ['a', 'b', 'c'];

console.log(`Target sequence: ${testSequence.join(' ')}\n`);

const metrics: Array<'jaccard' | 'cosine' | 'levenshtein'> = ['jaccard', 'cosine', 'levenshtein'];

metrics.forEach(metric => {
  console.log(`${metric.toUpperCase()} similarity:`);

  const results = metricChain.findSimilar(testSequence, {
    metric,
    topN: 3,
  });

  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.sequence.join(' ')} - ${(r.similarity * 100).toFixed(1)}%`);
  });
  console.log();
});

// ============================================================================
// Example 8: Finding Anomalous Sequences
// ============================================================================
console.log('--- Example 8: Anomaly Detection via Pattern Analysis ---\n');

const normalChain = new MarkovChain({ maxOrder: 2 });
normalChain.addSequences([
  ['login', 'browse', 'view', 'logout'],
  ['login', 'browse', 'purchase', 'logout'],
  ['login', 'search', 'view', 'logout'],
  ['login', 'browse', 'view', 'purchase', 'logout'],
]);

const sequences = [
  ['login', 'browse', 'view', 'logout'],           // Normal
  ['login', 'admin', 'delete', 'exit'],            // Suspicious
  ['login', 'search', 'view', 'purchase'],         // Normal
];

console.log('Analyzing sequences for anomalies:\n');

sequences.forEach(seq => {
  console.log(`Sequence: ${seq.join(' → ')}`);

  // Find similar known sequences
  const similar = normalChain.findSimilar(seq, {
    metric: 'jaccard',
    topN: 1,
  });

  if (similar.length > 0 && similar[0].similarity > 0.6) {
    console.log(`  ✓ Normal (${(similar[0].similarity * 100).toFixed(0)}% match with known patterns)`);
  } else {
    console.log('  ⚠️  ANOMALY - No similar patterns in training data');
  }
  console.log();
});

console.log('=== End of Examples ===');
