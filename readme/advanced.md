# Advanced Features: Markov Chains & Wave Function Collapse

This guide covers advanced features including:
- **v3.4-v3.5**: Markov Chain scoring, constraints, pattern analysis, and model comparison
- **v3.6**: Wave Function Collapse (WFC) for constraint-based procedural generation

**📚 Documentation Guide:**
- This is the **technical API reference** with detailed method signatures and algorithms
- For **game development examples**, see the game-focused guides:
  - [Quality Control & Filtering](./quality-control.md) - Game examples for scoring and constraints
  - [Recommendation Systems](./recommendations.md) - Game examples for pattern analysis
- For basic usage, start with the [Markov Chain Quickstart](./markov.md)

## Table of Contents

### Markov Chains (v3.4-v3.5)
- [Sequence Scoring & Ranking](#sequence-scoring--ranking)
- [Constraint-Based Generation](#constraint-based-generation)
- [Pattern Extraction](#pattern-extraction)
- [Similarity Search](#similarity-search)
- [Model Comparison & Diffing](#model-comparison--diffing)
- [Performance Optimization](#performance-optimization)
- [Best Practices](#best-practices)

### Wave Function Collapse (v3.6)
- [WFC Overview](#wave-function-collapse-wfc)
- [Quick Start](#wfc-quick-start)
- [Core API](#wfc-core-api)
- [Grid2D Adapter](#wfc-grid2d-adapter)
- [Constraint Learning](#wfc-constraint-learning)
- [Configuration Options](#wfc-configuration-options)
- [Serialization](#wfc-serialization)
- [Performance](#wfc-performance)

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

# Wave Function Collapse (WFC)

**Added in v3.6**

Wave Function Collapse is a constraint-based procedural generation algorithm that creates coherent outputs by collapsing quantum-like superpositions of states. Think of it as solving a sudoku where each cell can be multiple values until observed.

## WFC Overview

### What is WFC?

WFC generates content by:
1. Starting with all cells in a superposition (all possible states)
2. **Observing** a cell - collapsing it to a single state
3. **Propagating** constraints - reducing neighbors' possibilities
4. Repeating until all cells are collapsed or a contradiction occurs

### Key Features

- **Topology-Agnostic**: Works on 2D grids, 3D voxels, graphs, or custom structures
- **Constraint-Based**: Define rules for what can be adjacent
- **Deterministic**: Same seed produces same results
- **Composable**: Integrates with Distribution and MarkovChain
- **Learnable**: Automatically extract constraints from examples

### When to Use WFC

**Best For:**
- Tile-based level generation (dungeons, maps, puzzles)
- Texture synthesis and pattern generation
- Coherent procedural content with local rules
- Constraint satisfaction problems

**Compared to Markov Chains:**
- WFC: Spatial constraints, bidirectional rules, local coherence
- Markov: Sequential patterns, temporal dependencies, global structure

**Compared to Noise (Perlin, Simplex):**
- WFC: Discrete states, hard constraints, perfect coherence
- Noise: Continuous values, soft gradients, no guarantees

---

## WFC Quick Start

### 1. Basic 2D Grid Generation

```typescript
import { WFC, WFCGrid2D } from 'acausal';

// Define states and rules
const wfc = new WFC({
  seed: 42,
  states: ['grass', 'water', 'sand'],
  constraints: {
    grass: {
      north: ['grass', 'sand'],  // Grass can be north of these
      south: ['grass', 'sand'],
      east: ['grass', 'water'],
      west: ['grass', 'water']
    },
    water: {
      north: ['water', 'sand'],
      south: ['water', 'sand'],
      east: ['water', 'grass'],
      west: ['water', 'grass']
    },
    sand: {
      north: ['sand', 'grass', 'water'],
      south: ['sand', 'grass', 'water'],
      east: ['sand', 'grass', 'water'],
      west: ['sand', 'grass', 'water']
    }
  }
});

// Create 2D grid adapter
const grid = new WFCGrid2D({ width: 10, height: 10, wfc });

// Generate!
const terrain = grid.generate();

if (terrain) {
  console.log(terrain);
  // [
  //   ['grass', 'grass', 'sand', 'water', ...],
  //   ['grass', 'sand', 'water', 'water', ...],
  //   ...
  // ]
}
```

### 2. Learn from Examples

```typescript
import { WFCConstraintLearner } from 'acausal';

// Hand-craft a small example
const example = [
  ['W', 'W', 'W', 'W'],
  ['W', '.', '.', 'W'],
  ['W', '.', '.', 'W'],
  ['W', 'W', 'W', 'W']
];

// Learn constraint rules automatically
const constraints = WFCConstraintLearner.learn2DConstraints([example]);
const states = WFCConstraintLearner.extractStates([example]);

// Create WFC from learned rules
const wfc = new WFC({ seed: 123, states, constraints });

// Generate larger similar structures
const grid = new WFCGrid2D({ width: 20, height: 20, wfc });
const dungeon = grid.generate();
```

### 3. Weighted Generation

```typescript
// Learn with frequencies
const constraints = WFCConstraintLearner.learnWeightedConstraints([
  exampleA,  // Has lots of grass
  exampleB,  // Has lots of water
  exampleC   // Balanced
]);

const frequencies = WFCConstraintLearner.calculateFrequencies([
  exampleA, exampleB, exampleC
]);

const wfc = new WFC({
  seed: 456,
  states: ['grass', 'water', 'sand'],
  constraints,
  frequencies  // More grass/water will appear more often
});
```

---

## WFC Core API

### Creating a WFC Instance

```typescript
import { WFC } from 'acausal';

const wfc = new WFC({
  seed: 42,              // Random seed for determinism
  states: ['A', 'B'],    // All possible states
  constraints: {         // Adjacency rules
    A: {
      next: ['A', 'B']   // A can be followed by A or B
    },
    B: {
      next: ['A']        // B can only be followed by A
    }
  },

  // Optional configuration
  frequencies: {         // State occurrence weights
    A: 70,
    B: 30
  },
  entropyMode: 'shannon', // 'count' | 'shannon' | 'weighted-shannon'
  entropyNoise: 0.001     // Small noise to break ties
});
```

### Collapse on Custom Graphs

```typescript
import type { WFCGraph, WFCCell, Adjacency } from 'acausal';

// Create a custom graph structure
const graph: WFCGraph = {
  cells: new Map([
    [0, { id: 0, possibleStates: new Set(), collapsed: false }],
    [1, { id: 1, possibleStates: new Set(), collapsed: false }],
    [2, { id: 2, possibleStates: new Set(), collapsed: false }]
  ]),

  // Define topology via neighbor function
  getNeighbors: (cellId) => {
    const neighbors: Adjacency[] = [];

    if (cellId === 0) {
      neighbors.push({ neighbor: 1, dimension: 'next' });
    }
    if (cellId === 1) {
      neighbors.push({ neighbor: 2, dimension: 'next' });
      neighbors.push({ neighbor: 0, dimension: 'prev' });
    }
    if (cellId === 2) {
      neighbors.push({ neighbor: 1, dimension: 'prev' });
    }

    return neighbors;
  }
};

// Collapse the graph
const result = wfc.collapse(graph);

if (result.success) {
  console.log('Generated successfully!');
  console.log(`Steps: ${result.metadata?.steps}`);
  console.log(`Time: ${result.metadata?.timeMs}ms`);

  // Extract collapsed states
  for (const cell of result.graph.cells.values()) {
    console.log(`Cell ${cell.id}: ${cell.collapsedState}`);
  }
} else {
  console.error('Contradiction:', result.error);
}
```

### WFC Result Structure

```typescript
interface WFCResult {
  success: boolean;           // Whether collapse succeeded
  graph: WFCGraph;            // Graph with collapsed cells
  contradiction: boolean;     // Whether contradiction occurred
  error?: string;             // Error message if failed
  metadata?: {
    steps?: number;           // Number of collapse steps
    backtracks?: number;      // Backtracking attempts (if enabled)
    timeMs?: number;          // Generation time
  };
}
```

---

## WFC Grid2D Adapter

The `WFCGrid2D` class provides a convenient interface for 2D grid generation.

### Creating a Grid

```typescript
import { WFC, WFCGrid2D } from 'acausal';

const wfc = new WFC({
  seed: 42,
  states: ['0', '1'],
  constraints: {
    '0': { north: ['0', '1'], south: ['1'], east: ['1'], west: ['0'] },
    '1': { north: ['1'], south: ['0', '1'], east: ['0'], west: ['1'] }
  }
});

const grid = new WFCGrid2D({
  width: 5,
  height: 5,
  wfc
});
```

### Generate Methods

```typescript
// Simple generation (returns 2D array or null)
const result: string[][] | null = grid.generate();

// Generation with metadata
const detailed = grid.generateWithResult();

if (detailed.success) {
  console.log('Grid:', detailed.grid);
  console.log('Steps:', detailed.metadata?.steps);
  console.log('Time:', detailed.metadata?.timeMs);
} else {
  console.error('Failed:', detailed.error);
}
```

### Generation Options

```typescript
// Override entropy mode for this generation
const grid2D = grid.generate({
  entropyMode: 'weighted-shannon'
});

// Future: Progressive collapse, multi-pass, etc.
```

### Cardinal Directions

Grid2D uses standard cardinal directions:
- **north**: y - 1 (up)
- **south**: y + 1 (down)
- **east**: x + 1 (right)
- **west**: x - 1 (left)

```typescript
const constraints = {
  floor: {
    north: ['floor', 'wall'],
    south: ['floor', 'wall'],
    east: ['floor', 'wall'],
    west: ['floor', 'wall']
  },
  wall: {
    north: ['wall'],
    south: ['wall'],
    east: ['wall'],
    west: ['wall']
  }
};
```

---

## WFC Constraint Learning

The `WFCConstraintLearner` class automatically extracts constraint rules from example grids.

### Basic Learning

```typescript
import { WFCConstraintLearner } from 'acausal';

// Define one or more examples
const examples = [
  [
    ['A', 'B', 'A'],
    ['B', 'A', 'B'],
    ['A', 'B', 'A']
  ],
  [
    ['B', 'A', 'B'],
    ['A', 'B', 'A'],
    ['B', 'A', 'B']
  ]
];

// Learn constraints (unweighted - all adjacencies equally likely)
const constraints = WFCConstraintLearner.learn2DConstraints(examples);

console.log(constraints);
// {
//   A: {
//     north: ['A', 'B'],  // A was north of both A and B
//     south: ['A', 'B'],
//     east: ['B'],        // A was only east of B
//     west: ['B']
//   },
//   B: { ... }
// }
```

### Weighted Learning

```typescript
// Learn with frequency tracking
const weightedConstraints = WFCConstraintLearner.learnWeightedConstraints(
  examples,
  42  // Seed for distributions
);

// Now constraints are Distribution objects with weighted probabilities
console.log(weightedConstraints.A.north);
// Distribution { normal: { A: 0.6, B: 0.4 }, ... }
```

### Extract States and Frequencies

```typescript
// Get all unique states from examples
const states = WFCConstraintLearner.extractStates(examples);
// ['A', 'B']

// Calculate how often each state appears
const frequencies = WFCConstraintLearner.calculateFrequencies(examples);
// { A: 9, B: 9 }  (9 occurrences each in the examples)
```

### Complete Learning Workflow

```typescript
import { WFC, WFCGrid2D, WFCConstraintLearner } from 'acausal';

// 1. Provide examples
const dungeonExamples = [
  createHandCraftedDungeon(),
  createAnotherDungeon()
];

// 2. Learn everything
const states = WFCConstraintLearner.extractStates(dungeonExamples);
const constraints = WFCConstraintLearner.learnWeightedConstraints(
  dungeonExamples,
  123
);
const frequencies = WFCConstraintLearner.calculateFrequencies(
  dungeonExamples
);

// 3. Create WFC from learned data
const wfc = new WFC({
  seed: 456,
  states,
  constraints,
  frequencies
});

// 4. Generate new content
const grid = new WFCGrid2D({ width: 30, height: 30, wfc });
const newDungeon = grid.generate();
```

---

## WFC Configuration Options

### Entropy Modes

Entropy determines which cell to collapse next. Lower entropy = higher priority.

```typescript
// 1. Count (default - fastest)
// Entropy = number of possible states
const wfc1 = new WFC({
  states: ['A', 'B'],
  constraints: {...},
  entropyMode: 'count'
});

// 2. Shannon entropy
// Information-theoretic entropy (assumes uniform probabilities)
const wfc2 = new WFC({
  states: ['A', 'B'],
  constraints: {...},
  entropyMode: 'shannon'
});

// 3. Weighted Shannon entropy
// Accounts for actual state frequencies
const wfc3 = new WFC({
  states: ['grass', 'water'],
  constraints: {...},
  frequencies: { grass: 70, water: 30 },
  entropyMode: 'weighted-shannon'
});

// 4. Custom entropy function
const wfc4 = new WFC({
  states: ['A', 'B'],
  constraints: {...},
  entropyMode: (cell, frequencies) => {
    // Your custom logic
    return cell.possibleStates.size * Math.random();
  }
});
```

### Entropy Noise

Add small random noise to break entropy ties:

```typescript
const wfc = new WFC({
  states: ['A', 'B'],
  constraints: {...},
  entropyMode: 'shannon',
  entropyNoise: 0.001  // Small noise value
});

// Without noise: cells with same entropy collapse in deterministic order
// With noise: adds variety while maintaining overall coherence
```

### Frequency Weights

Control how often each state appears:

```typescript
const wfc = new WFC({
  states: ['grass', 'water', 'mountain'],
  constraints: {...},
  frequencies: {
    grass: 70,      // 70% weight
    water: 20,      // 20% weight
    mountain: 10    // 10% weight
  }
});

// Frequencies affect:
// 1. State selection during collapse
// 2. Weighted-shannon entropy calculation
```

### Constraints with Distributions

Use Distribution objects for weighted adjacency rules:

```typescript
import { Distribution } from 'acausal';

const wfc = new WFC({
  seed: 42,
  states: ['grass', 'water', 'sand'],
  constraints: {
    grass: {
      north: new Distribution({
        seed: 42,
        source: {
          grass: 80,  // Usually more grass
          sand: 15,   // Sometimes sand
          water: 5    // Rarely water
        }
      }),
      // ... other directions
    }
  }
});

// Now adjacencies are probabilistic, not just allowed/forbidden
```

---

## WFC Serialization

### Save and Load Models

```typescript
import { WFC } from 'acausal';

// Create and configure WFC
const wfc = new WFC({
  seed: 42,
  states: ['A', 'B', 'C'],
  constraints: {...},
  frequencies: { A: 50, B: 30, C: 20 },
  entropyMode: 'weighted-shannon',
  entropyNoise: 0.001
});

// Serialize to JSON
const dto = wfc.toJSON();

// Save to file
import fs from 'fs';
fs.writeFileSync('wfc-model.json', JSON.stringify(dto, null, 2));

// Later: Load from file
const loaded = JSON.parse(fs.readFileSync('wfc-model.json', 'utf8'));
const restoredWFC = WFC.fromJSON(loaded);

// Generates identically to original (same seed)
```

### DTO Structure

```typescript
interface WFCDTO {
  seed?: number;
  states: string[];
  constraints: {
    [state: string]: {
      [dimension: string]: string[] | {[state: string]: number};
    };
  };
  frequencies?: {[state: string]: number};
  entropyMode?: 'count' | 'shannon' | 'weighted-shannon';
  entropyNoise?: number;
  // boundaries, symmetry, backtrack configs (future)
}
```

### Model Versioning

```typescript
// Version your models for compatibility
const modelExport = {
  version: '1.0.0',
  created: new Date().toISOString(),
  metadata: {
    description: 'Dungeon generator',
    stateCount: wfc.getStats().stateCount,
    dimensions: wfc.getStats().dimensions
  },
  model: wfc.toJSON()
};

fs.writeFileSync(
  `dungeon-wfc-v${modelExport.version}.json`,
  JSON.stringify(modelExport, null, 2)
);
```

---

## WFC Performance

### Benchmarks

**100x100 Grid:**
- Simple constraints: ~200ms
- Complex constraints: ~1200ms
- Average: ~500-800ms

**1000x1000 Grid:**
- Target: <10 seconds
- Actual: ~8-12 seconds (depending on constraints)

### Optimization Tips

#### 1. Use Count Entropy for Speed

```typescript
// Fastest (but least sophisticated)
const wfc = new WFC({
  states: [...],
  constraints: {...},
  entropyMode: 'count'  // Default, fastest
});

// Slower but better quality
entropyMode: 'shannon'

// Slowest but most accurate
entropyMode: 'weighted-shannon'
```

#### 2. Minimize Constraint Complexity

```typescript
// Faster: Fewer allowed states per direction
grass: {
  north: ['grass'],        // Only 1 option
  south: ['grass', 'sand'] // Only 2 options
}

// Slower: Many allowed states
grass: {
  north: ['grass', 'sand', 'water', 'mountain', 'forest']
}
```

#### 3. Start with Pre-Collapsed Cells

```typescript
// Pre-collapse border or anchor cells
const graph: WFCGraph = {
  cells: new Map([
    [0, { id: 0, possibleStates: new Set(['wall']), collapsed: true, collapsedState: 'wall' }],
    [1, { id: 1, possibleStates: new Set(), collapsed: false }],
    // ...
  ]),
  getNeighbors: (id) => {...}
};

// WFC will propagate from pre-collapsed cells first
const result = wfc.collapse(graph);
```

#### 4. Monitor Performance

```typescript
const start = Date.now();
const result = grid.generateWithResult();

console.log(`Generation time: ${result.metadata?.timeMs}ms`);
console.log(`Steps: ${result.metadata?.steps}`);
console.log(`Steps/ms: ${(result.metadata?.steps! / result.metadata?.timeMs!).toFixed(2)}`);

// If too slow:
// - Reduce grid size
// - Simplify constraints
// - Use count entropy
// - Pre-collapse strategic cells
```

---

## Next Steps

### Markov Chains
- [Visualization Guide](./visualization.md) - Export and visualize chains
- [Main Documentation](./markov.md) - Core Markov chain features
- [Distribution Guide](./distribution.md) - Probability distributions

### Wave Function Collapse
- [Game Development Examples](../examples/) - Dungeon, terrain, puzzle generation
- [WFC Types Reference](../src/structures/wfc-types.ts) - Complete type definitions

### General
- [Examples](../examples/) - Complete code examples
- [Full API Documentation](https://abrisene.github.io/acausal/)
