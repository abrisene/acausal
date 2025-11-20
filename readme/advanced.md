# Advanced Markov Chain Features

This guide covers advanced features introduced in v3.4-v3.5 including sequence scoring, constraint-based generation, pattern analysis, and model comparison.

**📚 Documentation Guide:**
- This is the **technical API reference** with detailed method signatures and algorithms
- For **game development examples**, see the game-focused guides:
  - [Quality Control & Filtering](./quality-control.md) - Game examples for scoring and constraints
  - [Recommendation Systems](./recommendations.md) - Game examples for pattern analysis
- For basic usage, start with the [Markov Chain Quickstart](./markov.md)

## Table of Contents

- [Sequence Scoring & Ranking](#sequence-scoring--ranking)
- [Constraint-Based Generation](#constraint-based-generation)
- [Pattern Extraction](#pattern-extraction)
- [Similarity Search](#similarity-search)
- [Model Comparison & Diffing](#model-comparison--diffing)
- [Performance Optimization](#performance-optimization)
- [Best Practices](#best-practices)

---

## Sequence Scoring & Ranking

### Overview

Sequence scoring allows you to evaluate the likelihood of any sequence based on your trained model. This is useful for:

- Quality assessment of generated content
- Ranking multiple candidates
- Anomaly detection
- Content filtering
- Validation of user input

### The `score()` Method

```typescript
const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequences([
  ['the', 'quick', 'brown', 'fox'],
  ['the', 'lazy', 'brown', 'dog'],
  ['a', 'quick', 'red', 'fox'],
]);

const score = chain.score(['the', 'quick', 'brown', 'fox']);

console.log(score);
// {
//   sequence: ['the', 'quick', 'brown', 'fox'],
//   logProb: -5.2,          // Log probability (higher is better)
//   perplexity: 2.1,        // Perplexity (lower is better)
//   isValid: true,          // Whether sequence is possible
//   normalized: -1.3        // Normalized score per transition
// }
```

### Understanding the Metrics

**Log Probability:**
- Sum of log probabilities of all transitions
- Higher values indicate more likely sequences
- Range: -∞ to 0 (0 = certain)
- Good for comparing sequences of equal length

**Perplexity:**
- Measures uncertainty in prediction
- Lower values indicate better fit
- Formula: `exp(-logProb / validTransitions)`
- Better for comparing sequences of different lengths

**Normalized Score:**
- Average log probability per transition
- Accounts for sequence length
- Best metric for general comparison

### Ranking Multiple Sequences

```typescript
const candidates = [
  ['the', 'quick', 'brown', 'fox'],
  ['the', 'slow', 'green', 'fox'],
  ['a', 'lazy', 'brown', 'dog'],
];

const ranked = chain.rankByLikelihood(candidates);

ranked.forEach(r => {
  console.log(`Rank ${r.rank}: ${r.sequence.join(' ')}`);
  console.log(`  Score: ${r.normalized.toFixed(2)}`);
  console.log(`  Perplexity: ${r.perplexity.toFixed(2)}\n`);
});

// Output:
// Rank 1: the quick brown fox
//   Score: -1.2
//   Perplexity: 1.8
//
// Rank 2: a lazy brown dog
//   Score: -1.5
//   Perplexity: 2.3
//
// Rank 3: the slow green fox
//   Score: -3.8
//   Perplexity: 8.2
```

### Anomaly Detection

Identify unusual or suspicious sequences:

```typescript
const normalSequences = [
  ['login', 'browse', 'view', 'logout'],
  ['login', 'search', 'purchase', 'logout'],
  ['login', 'browse', 'purchase', 'logout'],
];

const activityChain = new MarkovChain({ maxOrder: 2 });
activityChain.addSequences(normalSequences);

// Check if sequence is anomalous
const suspicious = ['login', 'admin', 'delete', 'users'];
const isAnomaly = activityChain.isAnomaly(suspicious, -5.0);

console.log(isAnomaly); // true - very unusual pattern

// Find the threshold automatically
const scores = normalSequences.map(seq =>
  activityChain.score(seq).normalized
);

const avgScore = scores.reduce((a, b) => a + b) / scores.length;
const stdDev = Math.sqrt(
  scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length
);

const threshold = avgScore - (2 * stdDev); // 2 standard deviations

console.log(`Anomaly threshold: ${threshold.toFixed(2)}`);
```

### Use Case: Content Quality Scoring

```typescript
// Train on high-quality names
const nameChain = new MarkovChain({ maxOrder: 2 });
nameChain.addSequences([
  ['a', 'l', 'i', 'c', 'e'],
  ['b', 'o', 'b'],
  ['c', 'a', 'r', 'o', 'l'],
  // ... more quality names
]);

// Score generated candidates
const generated = [
  ['d', 'a', 'v', 'i', 'd'],    // Good
  ['x', 'q', 'z', 'w', 'p'],    // Poor (random letters)
];

generated.forEach(name => {
  const score = nameChain.score(name);
  const quality = score.perplexity < 5 ? 'GOOD' : 'POOR';

  console.log(`${name.join('')}: ${quality} (perplexity: ${score.perplexity.toFixed(2)})`);
});
```

### Use Case: Search Result Ranking

```typescript
// Train on user click sequences
const clickChain = new MarkovChain({ maxOrder: 3 });
clickChain.addSequences(userClickHistory);

// Rank search results by predicted click likelihood
const searchResults = [
  ['query', 'result1', 'click', 'purchase'],
  ['query', 'result2', 'click', 'back'],
  ['query', 'result3', 'ignore', 'back'],
];

const ranked = clickChain.rankByLikelihood(searchResults);

// Display top results first
ranked
  .filter(r => r.isValid)
  .slice(0, 10)
  .forEach(r => console.log(`Show: ${r.sequence[1]}`));
```

---

## Constraint-Based Generation

### Overview

Constraints allow you to generate sequences that meet specific requirements while maintaining statistical properties of your model.

### Available Constraints

```typescript
interface MCConstraints {
  minLength?: number;              // Minimum sequence length
  maxLength?: number;              // Maximum sequence length
  mustContain?: string[];          // Required elements
  mustNotContain?: string[];       // Forbidden elements
  pattern?: RegExp;                // Regex pattern to match
  validator?: (seq: string[]) => boolean;  // Custom validation
  maxRetries?: number;             // Generation attempts (default: 10)
}
```

### Length Constraints

```typescript
const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequences(weatherData);

// Generate exactly 7 days of weather
const forecast = chain.generate({
  constraints: {
    minLength: 7,
    maxLength: 7
  }
});

console.log(forecast);
// ['sunny', 'sunny', 'cloudy', 'rainy', 'cloudy', 'sunny', 'sunny']
```

### Content Constraints

```typescript
const storyChain = new MarkovChain({ maxOrder: 3 });
storyChain.addSequences(storyData);

// Generate a story that must include specific plot points
const story = storyChain.generate({
  constraints: {
    mustContain: ['dragon', 'sword', 'victory'],
    mustNotContain: ['death', 'failure'],
    minLength: 20,
    maxLength: 50
  }
});

// Ensure all plot points are present
console.log(story.includes('dragon'));  // true
console.log(story.includes('sword'));   // true
console.log(story.includes('victory')); // true
```

### Pattern Matching

```typescript
const usernameChain = new MarkovChain({ maxOrder: 1 });
usernameChain.addSequences(validUsernames);

// Generate username matching pattern
const username = usernameChain.generate({
  constraints: {
    minLength: 6,
    maxLength: 12,
    // Must start with letter, end with letter or digit
    pattern: /^[a-z][a-z0-9]*[a-z0-9]$/,
    maxRetries: 50
  }
});

console.log(username.join(''));
// 'alice42' or 'bob123' etc.
```

### Custom Validators

```typescript
const codeChain = new MarkovChain({ maxOrder: 2 });
codeChain.addSequences(codeSnippets);

// Generate code with custom business rules
const code = codeChain.generate({
  constraints: {
    validator: (seq) => {
      // Must have matching braces
      const open = seq.filter(t => t === '{').length;
      const close = seq.filter(t => t === '}').length;
      if (open !== close) return false;

      // Must not have syntax errors
      if (seq.includes('undefined') && seq.includes('null')) return false;

      // Must follow style guide
      const hasIndent = seq.some(t => t.startsWith('  '));
      return hasIndent;
    },
    maxRetries: 100
  }
});
```

### Combining Constraints

```typescript
const chatChain = new MarkovChain({ maxOrder: 3 });
chatChain.addSequences(chatMessages);

// Generate safe, appropriate chat message
const message = chatChain.generate({
  constraints: {
    minLength: 5,
    maxLength: 20,
    mustNotContain: profanityList,
    pattern: /^[A-Z].*[.!?]$/,  // Proper capitalization and punctuation
    validator: (seq) => {
      const text = seq.join(' ');
      // No repeated words
      const words = new Set(seq);
      if (words.size < seq.length * 0.8) return false;

      // Sentiment check
      return !negativeSentimentCheck(text);
    },
    maxRetries: 50
  }
});
```

### Handling Failed Constraints

```typescript
const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequences(data);

// Try to generate with very strict constraints
const result = chain.generate({
  constraints: {
    mustContain: ['impossible', 'combination'],
    maxRetries: 10
  }
});

// Check if constraints were satisfied
if (result.includes('impossible') && result.includes('combination')) {
  console.log('Success!');
} else {
  console.log('Failed to satisfy constraints - got best attempt');
  console.log(result);
}
```

---

## Pattern Extraction

### Overview

Pattern extraction discovers frequent sequences in your training data, enabling data mining, trend analysis, and feature discovery.

### Basic Extraction

```typescript
const logChain = new MarkovChain({ maxOrder: 4 });
logChain.addSequences(systemLogs);

const patterns = logChain.extractPatterns({
  minOrder: 2,        // Minimum pattern length
  maxOrder: 4,        // Maximum pattern length
  minFrequency: 5,    // Must occur at least 5 times
  topN: 20            // Return top 20 patterns
});

patterns.forEach(p => {
  console.log(`${p.pattern.join(' → ')} (${p.frequency}x, ${(p.probability * 100).toFixed(1)}%)`);
});
```

### Pattern Analysis

```typescript
// Find error patterns
const errorPatterns = patterns.filter(p =>
  p.pattern.includes('error') || p.pattern.includes('failed')
);

// Find success patterns
const successPatterns = patterns.filter(p =>
  p.pattern.includes('success') || p.pattern.includes('complete')
);

// Compare frequencies
console.log(`Error patterns: ${errorPatterns.length}`);
console.log(`Success patterns: ${successPatterns.length}`);
```

### Use Case: Customer Journey Analysis

```typescript
const journeyChain = new MarkovChain({ maxOrder: 3 });
journeyChain.addSequences(customerJourneys);

// Find most common paths to purchase
const purchasePatterns = journeyChain.extractPatterns({
  minOrder: 3,
  maxOrder: 5,
  minFrequency: 10
}).filter(p => p.pattern.includes('purchase'));

// Identify drop-off points
const exitPatterns = journeyChain.extractPatterns({
  minOrder: 2,
  maxOrder: 3,
  minFrequency: 5
}).filter(p => p.pattern.includes('exit'));

console.log('Top conversion paths:');
purchasePatterns.forEach(p => {
  console.log(`  ${p.pattern.join(' → ')} (${p.frequency} conversions)`);
});

console.log('\nCommon exit points:');
exitPatterns.forEach(p => {
  console.log(`  ${p.pattern.join(' → ')} (${p.frequency} exits)`);
});
```

### Use Case: Text Mining

```typescript
const textChain = new MarkovChain({ maxOrder: 5 });
textChain.addSequences(documents.map(d => d.split(' ')));

// Find common phrases
const phrases = textChain.extractPatterns({
  minOrder: 3,
  maxOrder: 5,
  minFrequency: 10,
  topN: 50
});

// Build n-gram index
const ngramIndex = new Map();
phrases.forEach(p => {
  const phrase = p.pattern.join(' ');
  ngramIndex.set(phrase, p.frequency);
});

// Use for autocomplete or text prediction
const userInput = "the quick";
const suggestions = Array.from(ngramIndex.keys())
  .filter(phrase => phrase.startsWith(userInput))
  .sort((a, b) => ngramIndex.get(b)! - ngramIndex.get(a)!);

console.log('Suggestions:', suggestions.slice(0, 5));
```

---

## Similarity Search

### Overview

Find sequences similar to a target using different similarity metrics. Each metric has different strengths:

- **Jaccard**: Fast, set-based, ignores frequency
- **Cosine**: Frequency-weighted, good for repeated elements
- **Levenshtein**: Edit distance, best for sequential similarity

### Jaccard Similarity

Best for: Presence/absence comparisons, fast lookups

```typescript
const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequences(documents);

const target = ['machine', 'learning', 'model'];

const similar = chain.findSimilar(target, {
  metric: 'jaccard',
  topN: 5,
  threshold: 0.6  // 60% overlap
});

// Jaccard similarity = |intersection| / |union|
// Good for finding documents with similar keywords
```

### Cosine Similarity

Best for: Frequency-weighted comparisons, TF-IDF style

```typescript
const target = ['the', 'the', 'cat', 'sat', 'sat'];

const similar = chain.findSimilar(target, {
  metric: 'cosine',
  topN: 5,
  threshold: 0.7
});

// Cosine similarity considers word frequencies
// Good for finding sequences with similar term distributions
```

### Levenshtein Distance

Best for: Finding near-matches, typo correction

```typescript
const target = ['a', 'l', 'i', 'c', 'e'];

const similar = chain.findSimilar(target, {
  metric: 'levenshtein',
  topN: 3,
  threshold: 0.8  // 80% similar (20% edit distance)
});

// Levenshtein measures minimum edit operations
// Good for spell checking, fuzzy matching
```

### Use Case: Duplicate Detection

```typescript
const issueChain = new MarkovChain({ maxOrder: 3 });
issueChain.addSequences(existingIssues);

function checkDuplicate(newIssue: string[]) {
  const duplicates = issueChain.findSimilar(newIssue, {
    metric: 'jaccard',
    threshold: 0.8,
    topN: 5
  });

  if (duplicates.length > 0) {
    console.log('⚠️  Potential duplicates found:');
    duplicates.forEach(dup => {
      console.log(`  - ${dup.sequence.join(' ')} (${(dup.similarity * 100).toFixed(0)}% similar)`);
    });
    return true;
  }

  return false;
}
```

### Use Case: Recommendation Engine

```typescript
const userBehavior = new MarkovChain({ maxOrder: 3 });
userBehavior.addSequences(allUserSessions);

function recommend(currentSession: string[]) {
  // Find similar user sessions
  const similarSessions = userBehavior.findSimilar(currentSession, {
    metric: 'cosine',
    topN: 10,
    threshold: 0.5
  });

  // Extract next actions from similar sessions
  const recommendations = new Map<string, number>();

  similarSessions.forEach(session => {
    const nextSteps = session.sequence.slice(currentSession.length);
    nextSteps.forEach(step => {
      recommendations.set(
        step,
        (recommendations.get(step) || 0) + session.similarity
      );
    });
  });

  // Return top recommendations weighted by similarity
  return Array.from(recommendations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action]) => action);
}
```

---

## Model Comparison & Diffing

### Overview

Compare two Markov chains to identify differences, track changes over time, or analyze dataset variations.

### Basic Comparison

```typescript
const chainV1 = new MarkovChain({ maxOrder: 2 });
chainV1.addSequences(datasetV1);

const chainV2 = new MarkovChain({ maxOrder: 2 });
chainV2.addSequences(datasetV2);

const diff = chainV1.diff(chainV2);

console.log('Comparison Results:');
console.log(`  Added: ${diff.added.length} new grams`);
console.log(`  Removed: ${diff.removed.length} grams`);
console.log(`  Common: ${diff.common.length} grams`);
console.log(`  Modified: ${diff.modified.length} grams`);
```

### Analyzing Changes

```typescript
// Find new patterns
console.log('\nNew patterns in V2:');
diff.added.forEach(gram => console.log(`  + ${gram}`));

// Find deprecated patterns
console.log('\nPatterns no longer present:');
diff.removed.forEach(gram => console.log(`  - ${gram}`));

// Find frequency changes
console.log('\nFrequency changes:');
diff.modified
  .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  .slice(0, 10)
  .forEach(m => {
    const change = m.difference > 0 ? '↑' : '↓';
    console.log(`  ${change} ${m.gram}: ${m.chain1Freq} → ${m.chain2Freq}`);
  });
```

### Use Case: A/B Test Analysis

```typescript
function analyzeABTest(controlData: string[][], treatmentData: string[][]) {
  const control = new MarkovChain({ maxOrder: 2 });
  control.addSequences(controlData);

  const treatment = new MarkovChain({ maxOrder: 2 });
  treatment.addSequences(treatmentData);

  const diff = control.diff(treatment);

  // Calculate impact
  const totalGrams = diff.common.length + diff.added.length + diff.removed.length;
  const changeRate = (diff.added.length + diff.removed.length) / totalGrams;

  console.log(`\nA/B Test Analysis:`);
  console.log(`  Change rate: ${(changeRate * 100).toFixed(1)}%`);
  console.log(`  New behaviors: ${diff.added.length}`);
  console.log(`  Dropped behaviors: ${diff.removed.length}`);

  // Find conversion improvements
  const conversions = diff.modified.filter(m =>
    m.gram.includes('purchase') || m.gram.includes('signup')
  );

  console.log(`\nConversion changes:`);
  conversions.forEach(m => {
    const impact = ((m.chain2Freq - m.chain1Freq) / m.chain1Freq * 100).toFixed(1);
    console.log(`  ${m.gram}: ${impact}% ${m.difference > 0 ? 'increase' : 'decrease'}`);
  });

  return changeRate;
}
```

### Use Case: Model Versioning

```typescript
class VersionedMarkovChain {
  private versions: Map<string, MarkovChain> = new Map();

  saveVersion(version: string, chain: MarkovChain) {
    this.versions.set(version, chain.clone());
  }

  diff(from: string, to: string) {
    const v1 = this.versions.get(from);
    const v2 = this.versions.get(to);

    if (!v1 || !v2) throw new Error('Version not found');

    return v1.diff(v2);
  }

  changelog(from: string, to: string) {
    const diff = this.diff(from, to);

    return {
      version: to,
      previousVersion: from,
      date: new Date().toISOString(),
      changes: {
        added: diff.added.length,
        removed: diff.removed.length,
        modified: diff.modified.length
      },
      details: {
        newPatterns: diff.added.slice(0, 10),
        deprecatedPatterns: diff.removed.slice(0, 10),
        significantChanges: diff.modified
          .filter(m => Math.abs(m.difference) > 5)
          .slice(0, 10)
      }
    };
  }
}

// Usage
const versioned = new VersionedMarkovChain();

const model = new MarkovChain({ maxOrder: 2 });
model.addSequences(initialData);
versioned.saveVersion('1.0.0', model);

// Later, after collecting more data
model.addSequences(newData);
versioned.saveVersion('1.1.0', model);

const changelog = versioned.changelog('1.0.0', '1.1.0');
console.log(JSON.stringify(changelog, null, 2));
```

---

## Performance Optimization

### Training Optimization

```typescript
// ❌ Slow: Adding sequences one at a time
sequences.forEach(seq => chain.addSequence(seq));

// ✅ Fast: Batch addition
chain.addSequences(sequences);
```

### Memory Optimization

```typescript
// For large datasets, use lower order
const largeChain = new MarkovChain({
  maxOrder: 1,  // Reduces memory usage significantly
  sequences: largeDataset
});

// Or limit sequence storage
const limitedChain = new MarkovChain({
  maxOrder: 2,
  sequences: dataset.slice(-10000)  // Keep only recent sequences
});
```

### Generation Optimization

```typescript
// ❌ Slow: Many constraint retries
const result = chain.generate({
  constraints: { maxRetries: 1000 }  // Very slow
});

// ✅ Fast: Reasonable retry limit
const result = chain.generate({
  constraints: { maxRetries: 50 }  // Much faster
});
```

### Pattern Extraction Optimization

```typescript
// ❌ Slow: Extracting all patterns
const allPatterns = chain.extractPatterns({
  minOrder: 1,
  maxOrder: 10,
  minFrequency: 1,
  topN: 10000
});

// ✅ Fast: Focused extraction
const keyPatterns = chain.extractPatterns({
  minOrder: 3,        // Skip trivial patterns
  maxOrder: 5,        // Limit complexity
  minFrequency: 10,   // Filter rare patterns
  topN: 100           // Limit results
});
```

---

## Best Practices

### 1. Choose Appropriate Order

```typescript
// For character-level (names, words)
const charChain = new MarkovChain({ maxOrder: 2 });

// For word-level (sentences, phrases)
const wordChain = new MarkovChain({ maxOrder: 3 });

// For high-level (user journeys, workflows)
const flowChain = new MarkovChain({ maxOrder: 2 });
```

### 2. Handle Edge Cases

```typescript
// Always validate scores before using
const score = chain.score(sequence);

if (score.isValid) {
  // Use score.normalized for comparisons
  console.log(`Quality: ${score.normalized}`);
} else {
  console.log('Sequence not possible in this model');
}
```

### 3. Use Appropriate Similarity Metrics

```typescript
// For keyword matching
const keywordSimilar = chain.findSimilar(target, { metric: 'jaccard' });

// For frequency-aware matching
const freqSimilar = chain.findSimilar(target, { metric: 'cosine' });

// For fuzzy matching / typos
const fuzzySimilar = chain.findSimilar(target, { metric: 'levenshtein' });
```

### 4. Validate Constraints

```typescript
// Test constraints with known data first
const testSequence = chain.generate({
  constraints: yourConstraints
});

// Verify constraints are satisfiable
console.log('Test passed:',
  yourConstraints.validator?.(testSequence) ?? true
);
```

### 5. Version Your Models

```typescript
// Always export models with metadata
const exportedModel = {
  version: '1.0.0',
  created: new Date().toISOString(),
  metadata: chain.getStats(),
  data: chain.toJSON()
};

// Save to file
import fs from 'fs';
fs.writeFileSync(
  `model-v${exportedModel.version}.json`,
  JSON.stringify(exportedModel, null, 2)
);
```

### 6. Monitor Performance

```typescript
// Track generation quality
const generations = Array(100).fill(null).map(() =>
  chain.generate({ min: 10, max: 20 })
);

const avgQuality = generations
  .map(seq => chain.score(seq).normalized)
  .reduce((a, b) => a + b) / generations.length;

console.log(`Average quality: ${avgQuality.toFixed(2)}`);
```

---

## Next Steps

- [Visualization Guide](./visualization.md) - Export and visualize chains
- [Main Documentation](./markov.md) - Core Markov chain features
- [Distribution Guide](./distribution.md) - Probability distributions
- [Examples](../examples/) - Complete code examples

For API reference, see the [full documentation](https://abrisene.github.io/acausal/).
