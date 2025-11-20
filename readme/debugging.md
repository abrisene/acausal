# Debugging and Analytics

**New in v4.0+**

This guide shows you how to debug procedural generation, visualize game data, and analyze player behavior.

## Table of Contents

- [Why Debug Procedural Generation?](#why-debug-procedural-generation)
- [Inspecting Your Models](#inspecting-your-models)
- [Visualizing Generation](#visualizing-generation)
- [Testing and Validation](#testing-and-validation)
- [A/B Testing Content](#ab-testing-content)
- [Player Analytics](#player-analytics)
- [Exporting for External Tools](#exporting-for-external-tools)

---

## Why Debug Procedural Generation?

Procedural generation can create unexpected results:
- Names that don't make sense
- Impossible quest chains
- Unbalanced loot drops
- Broken level layouts

**Debugging helps you**:
- Find what went wrong
- Validate your training data
- Compare different versions
- Optimize generation quality

---

## Inspecting Your Models

### Model Statistics

Get basic info about your chain:

```typescript
import { MarkovChain } from 'acausal';

const names = ['alice', 'bob', 'charlie', 'david', 'emma'];
const nameGen = new MarkovChain({
  maxOrder: 2,
  sequences: names.map(n => n.split(''))
});

// Get statistics
const stats = nameGen.getStats();

console.log('=== Model Stats ===');
console.log(`Total grams: ${stats.gramCount}`);
console.log(`Training sequences: ${stats.sequenceCount}`);
console.log(`Order range: ${stats.orderRange[0]} - ${stats.orderRange[1]}`);
console.log(`Avg connections (out): ${stats.avgDegreeOut.toFixed(2)}`);
console.log(`Avg connections (in): ${stats.avgDegreeIn.toFixed(2)}`);

/* Output:
=== Model Stats ===
Total grams: 23
Training sequences: 5
Order range: 1 - 2
Avg connections (out): 2.35
Avg connections (in): 2.35
*/
```

**What these mean:**
- **gramCount**: Total unique patterns learned
- **sequenceCount**: How many examples you trained on
- **orderRange**: Minimum and maximum n-gram sizes
- **avgDegreeOut**: Average number of possible next states
- **avgDegreeIn**: Average number of possible previous states

### Inspecting Specific Patterns

```typescript
// Check if a specific pattern exists
if (nameGen.hasGram(['a', 'l'])) {
  console.log('Pattern "al" exists in model');
}

// Get all patterns of a specific order
const bigrams = nameGen.getGramsByOrder(2);
console.log(`\nFound ${bigrams.length} bigrams (2-letter patterns)`);

// Show some examples
console.log('\nExample bigrams:');
bigrams.slice(0, 5).forEach(gram => {
  console.log(`  Order ${gram.order}, Degree: ${gram.degreeOut}`);
});
```

### Common Patterns

```typescript
// Find the most common patterns
const patterns = nameGen.extractPatterns({
  minOrder: 2,
  minFrequency: 2,  // Appears at least twice
  topN: 10
});

console.log('\n=== Most Common Patterns ===');
patterns.forEach((pattern, i) => {
  console.log(`${i + 1}. "${pattern.pattern.join('')}" (${pattern.frequency}x)`);
});

/* Output:
=== Most Common Patterns ===
1. "li" (2x)
2. "al" (2x)
3. "ar" (2x)
4. "ce" (2x)
*/
```

---

## Visualizing Generation

### Step-by-Step Generation

See exactly how a sequence is generated:

```typescript
class GenerationDebugger {
  private model: MarkovChain;

  constructor(model: MarkovChain) {
    this.model = model;
  }

  generateWithLogging(options: any): string[] {
    console.log('=== Generation Process ===\n');

    const result: string[] = [];
    let current: string[] = [];

    for (let step = 0; step < 10; step++) {
      // Pick next element
      const next = this.model.pick(current);

      if (!next) {
        console.log(`Step ${step}: END (no more options)`);
        break;
      }

      current = [...current, next].slice(-options.order || -2);
      result.push(next);

      console.log(`Step ${step + 1}: "${next}"`);
      console.log(`  Context: [${current.slice(0, -1).join(', ')}]`);
      console.log(`  Result so far: "${result.join('')}"`);
      console.log();

      if (result.length >= (options.max || 10)) break;
    }

    console.log(`Final result: "${result.join('')}"\n`);
    return result;
  }
}

// Usage
const debugger = new GenerationDebugger(nameGen);
debugger.generateWithLogging({ max: 6, order: 2 });

/* Output:
=== Generation Process ===

Step 1: "a"
  Context: []
  Result so far: "a"

Step 2: "l"
  Context: [a]
  Result so far: "al"

Step 3: "i"
  Context: [a, l]
  Result so far: "ali"

Step 4: "c"
  Context: [l, i]
  Result so far: "alic"

Step 5: "e"
  Context: [i, c]
  Result so far: "alice"

Final result: "alice"
*/
```

### Probability Distribution

See what choices are available at each step:

```typescript
class ProbabilityInspector {
  private model: MarkovChain;

  constructor(model: MarkovChain) {
    this.model = model;
  }

  showOptions(context: string[]): void {
    // Get the gram for this context
    const gram = this.model.getGram(context);

    if (!gram) {
      console.log(`No data for context: ${context.join('')}`);
      return;
    }

    console.log(`\n=== Options after "${context.join('')}" ===`);

    // Get next options from the gram's distribution
    const nextDist = gram.next;
    const entries = Object.entries(nextDist);

    // Sort by probability
    entries.sort((a, b) => b[1] - a[1]);

    entries.forEach(([state, prob]) => {
      const percentage = (prob * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(prob * 20));
      console.log(`  ${state}: ${percentage}% ${bar}`);
    });
  }
}

const inspector = new ProbabilityInspector(nameGen);

// What comes after "al"?
inspector.showOptions(['a', 'l']);

/* Output:
=== Options after "al" ===
  i: 50.0% ██████████
  e: 30.0% ██████
  o: 20.0% ████
*/
```

---

## Testing and Validation

### Batch Testing

Generate many samples and check quality:

```typescript
class QualityTester {
  private model: MarkovChain;

  constructor(model: MarkovChain) {
    this.model = model;
  }

  testGeneration(count: number, options: any): void {
    console.log(`\n=== Testing ${count} Generations ===\n`);

    const results: string[] = [];
    const issues: string[] = [];

    for (let i = 0; i < count; i++) {
      const generated = this.model.generate(options).join('');
      results.push(generated);

      // Check for issues
      if (generated.length < 3) {
        issues.push(`Too short: "${generated}"`);
      }

      if (!/[aeiou]/.test(generated)) {
        issues.push(`No vowels: "${generated}"`);
      }

      if (/(.)\1{2,}/.test(generated)) {
        issues.push(`Repeated chars: "${generated}"`);
      }
    }

    // Statistics
    const avgLength = results.reduce((sum, r) => sum + r.length, 0) / results.length;
    const issueRate = (issues.length / count * 100).toFixed(1);

    console.log(`Generated: ${count}`);
    console.log(`Average length: ${avgLength.toFixed(1)}`);
    console.log(`Issue rate: ${issueRate}%`);
    console.log(`\nIssues found:`);

    if (issues.length === 0) {
      console.log('  None! ✓');
    } else {
      issues.slice(0, 10).forEach(issue => {
        console.log(`  - ${issue}`);
      });

      if (issues.length > 10) {
        console.log(`  ... and ${issues.length - 10} more`);
      }
    }

    console.log(`\nSample results:`);
    results.slice(0, 10).forEach(result => {
      console.log(`  "${result}"`);
    });
  }
}

const tester = new QualityTester(nameGen);
tester.testGeneration(100, { min: 4, max: 10 });

/* Output:
=== Testing 100 Generations ===

Generated: 100
Average length: 6.2
Issue rate: 8.0%

Issues found:
  - Too short: "bo"
  - No vowels: "bd"
  - Too short: "ch"
  ...

Sample results:
  "alice"
  "charlie"
  "emma"
  "david"
  "bob"
  ...
*/
```

### Training Data Validation

Check if your training data is good:

```typescript
function validateTrainingData(sequences: string[][]): void {
  console.log('=== Training Data Validation ===\n');

  const issues: string[] = [];

  // Check for duplicates
  const seen = new Set<string>();
  sequences.forEach((seq, i) => {
    const str = seq.join('');
    if (seen.has(str)) {
      issues.push(`Duplicate: "${str}"`);
    }
    seen.add(str);

    // Check for too short
    if (seq.length < 3) {
      issues.push(`Too short (#${i}): "${str}"`);
    }

    // Check for weird patterns
    if (/(.)\1{3,}/.test(str)) {
      issues.push(`Repeated chars (#${i}): "${str}"`);
    }
  });

  // Statistics
  const lengths = sequences.map(s => s.length);
  const avgLength = lengths.reduce((a, b) => a + b) / lengths.length;
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);

  console.log(`Total sequences: ${sequences.length}`);
  console.log(`Length: ${minLength} - ${maxLength} (avg: ${avgLength.toFixed(1)})`);
  console.log(`Unique: ${seen.size}/${sequences.length}`);

  console.log(`\nIssues: ${issues.length}`);
  if (issues.length > 0) {
    issues.slice(0, 10).forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('  None! ✓');
  }
}

const trainingNames = [
  ['alice'], ['bob'], ['charlie'], ['david'], ['emma'],
  ['alice'],  // Duplicate!
  ['x', 'y']  // Too short!
];

validateTrainingData(trainingNames);
```

---

## A/B Testing Content

### Comparing Two Models

Which training data produces better results?

```typescript
class ModelComparison {
  compareModels(model1: MarkovChain, model2: MarkovChain, label1: string, label2: string): void {
    console.log(`\n=== ${label1} vs ${label2} ===\n`);

    // Generate samples from each
    const samples1: string[] = [];
    const samples2: string[] = [];

    for (let i = 0; i < 50; i++) {
      samples1.push(model1.generate({ min: 4, max: 10 }).join(''));
      samples2.push(model2.generate({ min: 4, max: 10 }).join(''));
    }

    // Compare statistics
    const avg1 = samples1.reduce((sum, s) => sum + s.length, 0) / samples1.length;
    const avg2 = samples2.reduce((sum, s) => sum + s.length, 0) / samples2.length;

    console.log(`${label1}:`);
    console.log(`  Avg length: ${avg1.toFixed(1)}`);
    console.log(`  Samples: ${samples1.slice(0, 5).join(', ')}`);

    console.log(`\n${label2}:`);
    console.log(`  Avg length: ${avg2.toFixed(1)}`);
    console.log(`  Samples: ${samples2.slice(0, 5).join(', ')}`);

    // Compare model stats
    const stats1 = model1.getStats();
    const stats2 = model2.getStats();

    console.log(`\n${label1} model:`);
    console.log(`  Grams: ${stats1.gramCount}`);
    console.log(`  Avg connections: ${stats1.avgDegreeOut.toFixed(2)}`);

    console.log(`\n${label2} model:`);
    console.log(`  Grams: ${stats2.gramCount}`);
    console.log(`  Avg connections: ${stats2.avgDegreeOut.toFixed(2)}`);

    // Model diff
    const diff = model1.diff(model2);

    console.log(`\nDifferences:`);
    console.log(`  Unique to ${label1}: ${diff.onlyInFirst} grams`);
    console.log(`  Unique to ${label2}: ${diff.onlyInSecond} grams`);
    console.log(`  Shared: ${diff.shared} grams`);
    console.log(`  Similarity: ${(diff.similarity * 100).toFixed(1)}%`);
  }
}

// Example: Compare two different training sets
const fantasyNames = ['elara', 'theron', 'lyanna', 'drakon'];
const modernNames = ['alex', 'sam', 'jordan', 'taylor'];

const fantasyModel = new MarkovChain({
  sequences: fantasyNames.map(n => n.split(''))
});

const modernModel = new MarkovChain({
  sequences: modernNames.map(n => n.split(''))
});

const comparison = new ModelComparison();
comparison.compareModels(fantasyModel, modernModel, 'Fantasy', 'Modern');

/* Output:
=== Fantasy vs Modern ===

Fantasy:
  Avg length: 6.8
  Samples: elara, theron, lyara, drara, theon

Modern:
  Avg length: 5.2
  Samples: alex, sam, jordan, taylex, saylor

Fantasy model:
  Grams: 32
  Avg connections: 1.85

Modern model:
  Grams: 28
  Avg connections: 1.95

Differences:
  Unique to Fantasy: 25 grams
  Unique to Modern: 21 grams
  Shared: 7 grams
  Similarity: 21.9%
*/
```

---

## Player Analytics

### Analyzing Player Behavior

Track and visualize what players do:

```typescript
interface PlayerAction {
  player: string;
  action: string;
  timestamp: number;
}

class PlayerAnalytics {
  private actions: PlayerAction[] = [];
  private model?: MarkovChain;

  addAction(player: string, action: string): void {
    this.actions.push({
      player,
      action,
      timestamp: Date.now()
    });
  }

  analyze(): void {
    console.log('=== Player Analytics ===\n');

    // Group by player
    const byPlayer = new Map<string, string[]>();

    this.actions.forEach(({ player, action }) => {
      if (!byPlayer.has(player)) {
        byPlayer.set(player, []);
      }
      byPlayer.get(player)!.push(action);
    });

    console.log(`Total players: ${byPlayer.size}`);
    console.log(`Total actions: ${this.actions.length}`);
    console.log();

    // Build model from player actions
    const sequences = Array.from(byPlayer.values());
    this.model = new MarkovChain({
      maxOrder: 2,
      sequences
    });

    // Find common patterns
    const patterns = this.model.extractPatterns({
      minOrder: 2,
      minFrequency: 2,
      topN: 10
    });

    console.log('Common action sequences:');
    patterns.forEach((pattern, i) => {
      console.log(`${i + 1}. ${pattern.pattern.join(' → ')} (${pattern.frequency}x)`);
    });

    // Find outliers
    console.log('\nUnusual players:');

    byPlayer.forEach((actions, player) => {
      const score = this.model!.score(actions);

      if (score.normalized < -10) {
        console.log(`  ${player}: Unusual behavior (score: ${score.normalized.toFixed(2)})`);
      }
    });
  }

  predictNext(player: string): string | null {
    if (!this.model) {
      this.analyze();
    }

    const playerActions = this.actions
      .filter(a => a.player === player)
      .map(a => a.action);

    if (playerActions.length === 0) return null;

    // Use last few actions as context
    const context = playerActions.slice(-2);
    const next = this.model!.pick(context);

    return next;
  }
}

// Example usage
const analytics = new PlayerAnalytics();

// Simulate player actions
analytics.addAction('player1', 'login');
analytics.addAction('player1', 'quest');
analytics.addAction('player1', 'combat');
analytics.addAction('player1', 'loot');

analytics.addAction('player2', 'login');
analytics.addAction('player2', 'quest');
analytics.addAction('player2', 'combat');
analytics.addAction('player2', 'loot');

analytics.addAction('bot123', 'login');
analytics.addAction('bot123', 'farm');
analytics.addAction('bot123', 'farm');
analytics.addAction('bot123', 'farm');

analytics.analyze();

// Predict what player1 will do next
const prediction = analytics.predictNext('player1');
console.log(`\nPlayer1 likely to: ${prediction}`);
```

---

## Exporting for External Tools

### Export to JSON

Save your model to analyze elsewhere:

```typescript
// Export to simple JSON format
const exported = nameGen.toJSON();

console.log('Exported model:');
console.log(JSON.stringify(exported, null, 2));

/* Output:
{
  "metadata": {
    "maxOrder": 2,
    "delimiter": "⏐",
    "totalGrams": 23,
    "totalSequences": 5
  },
  "grams": [
    {
      "pattern": ["a"],
      "order": 1,
      "frequency": 5,
      "next": { "l": 0.6, "v": 0.2, "r": 0.2 }
    },
    ...
  ]
}
*/

// Save to file (Node.js)
// import fs from 'fs';
// fs.writeFileSync('name-model.json', JSON.stringify(exported, null, 2));
```

### Export as Graph

Visualize as a network graph:

```typescript
const graph = nameGen.exportAsGraph();

console.log('Graph export:');
console.log(`Nodes: ${graph.nodes.length}`);
console.log(`Edges: ${graph.edges.length}`);

// Sample nodes
console.log('\nSample nodes:');
graph.nodes.slice(0, 3).forEach(node => {
  console.log(`  ${node.id} (order: ${node.order}, frequency: ${node.frequency})`);
});

// Sample edges
console.log('\nSample edges:');
graph.edges.slice(0, 3).forEach(edge => {
  const prob = (edge.probability * 100).toFixed(1);
  console.log(`  ${edge.from} → ${edge.to} (${prob}%)`);
});

/* Output:
Graph export:
Nodes: 23
Edges: 45

Sample nodes:
  a (order: 1, frequency: 5)
  al (order: 2, frequency: 2)
  ali (order: 3, frequency: 1)

Sample edges:
  a → l (60.0%)
  a → v (20.0%)
  a → r (20.0%)
*/

// Export for visualization tools
function exportForD3(): any {
  const graph = nameGen.exportAsGraph();

  return {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      label: n.states.join(''),
      size: n.frequency
    })),
    links: graph.edges.map(e => ({
      source: e.from,
      target: e.to,
      weight: e.probability
    }))
  };
}
```

### Export to CSV

For spreadsheet analysis:

```typescript
function exportToCSV(): string {
  const graph = nameGen.exportAsGraph();

  let csv = 'from,to,probability,weight\n';

  graph.edges.forEach(edge => {
    csv += `${edge.from},${edge.to},${edge.probability},${edge.weight}\n`;
  });

  return csv;
}

console.log(exportToCSV());

/* Output:
from,to,probability,weight
a,l,0.6,3
a,v,0.2,1
a,r,0.2,1
...
*/

// Save to file (Node.js)
// fs.writeFileSync('transitions.csv', exportToCSV());
```

---

## Common Issues and Solutions

### Issue: Generation Gets Stuck

```typescript
// Problem: Always generates the same thing
const stuck = nameGen.generate({ max: 10 });
// Always returns: ['a', 'l', 'i', 'c', 'e']

// Solution 1: Use different order
const varied = nameGen.generate({ max: 10, order: 1 });  // Less strict

// Solution 2: Check if training data is too limited
console.log('Training sequences:', nameGen.model.sequences?.length);
// If < 5, add more examples!

// Solution 3: Analyze what's happening
const inspector = new ProbabilityInspector(nameGen);
inspector.showOptions(['a', 'l']);
// If one option is 100%, that's your problem!
```

### Issue: Too Much Variation

```typescript
// Problem: Generates gibberish
const random = nameGen.generate({ max: 10 });
// Returns: ['x', 'q', 'z', 'w', 'p']

// Solution 1: Increase order
const structured = nameGen.generate({ max: 10, order: 3 });  // More context

// Solution 2: Filter results
const quality = new QualityTester(nameGen);
quality.testGeneration(100, { max: 10 });
// Check issue rate - if high, add more training data

// Solution 3: Use constraints
const filtered = nameGen.generate({
  max: 10,
  constraints: {
    validator: (seq) => /[aeiou]/.test(seq.join(''))  // Must have vowel
  }
});
```

---

## Best Practices

### 1. Test with Multiple Seeds

```typescript
// Test with different random seeds
for (let seed = 1; seed <= 5; seed++) {
  const model = new MarkovChain({
    seed,
    sequences: trainingData
  });

  console.log(`Seed ${seed}:`, model.generate({ max: 10 }).join(''));
}
```

### 2. Log During Development

```typescript
// Keep debug mode during development
const DEBUG = true;

if (DEBUG) {
  const stats = model.getStats();
  console.log('Model stats:', stats);

  const patterns = model.extractPatterns({ minFrequency: 2, topN: 5 });
  console.log('Common patterns:', patterns);
}

const result = model.generate({ max: 10 });
```

### 3. Compare Before/After

```typescript
// Save old model before making changes
const oldExport = model.toJSON();

// Make changes...
model.addSequence(['new', 'data']);

// Compare
const diff = model.diff(MarkovChain.fromJSON(oldExport));
console.log('Changes:', diff);
```

---

## Next Steps

- [Quality Control](./quality-control.md) - Filter and score results
- [Recommendations](./recommendations.md) - Analyze patterns
- [Game Generation](./game-generation.md) - Apply debugging techniques

---

**Quick Reference:**

| Task | Method | When to Use |
|------|--------|-------------|
| Model overview | `getStats()` | Understand model size |
| Check pattern | `hasGram()` | Verify training worked |
| Common patterns | `extractPatterns()` | Find what's learned |
| Test quality | Batch generation | Validate before shipping |
| Compare models | `diff()` | A/B testing |
| Export data | `toJSON()` / `exportAsGraph()` | External analysis |

**Debugging Checklist:**
- ✓ Validate training data
- ✓ Check model stats
- ✓ Test with multiple seeds
- ✓ Inspect common patterns
- ✓ Batch test for issues
- ✓ Compare with baseline
