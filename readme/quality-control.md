# Quality Control and Content Filtering

**New in v3.4+**

This guide shows you how to score generated content, filter out bad results, and ensure quality in your procedural generation.

## Table of Contents

- [Why Quality Control Matters](#why-quality-control-matters)
- [Filtering Bad Names](#filtering-bad-names)
- [Profanity and Content Filtering](#profanity-and-content-filtering)
- [Player Behavior Detection](#player-behavior-detection)
- [Autocomplete and Suggestions](#autocomplete-and-suggestions)
- [Ranking Generated Content](#ranking-generated-content)
- [Advanced: Custom Scoring](#advanced-custom-scoring)

---

## Why Quality Control Matters

Markov chains generate content based on patterns, but not all generated content is good. You might get:
- Names that are unpronounceable ("Xqzwth")
- Dialogue that doesn't make sense
- Quest chains that are impossible
- Offensive combinations by accident

**Quality control** helps you keep the good, filter the bad, and rank everything in between.

---

## Filtering Bad Names

### The Problem

Let's say you're generating character names:

```typescript
import { MarkovChain } from 'acausal';

const names = ['alice', 'bob', 'charlie', 'david', 'emma'];
const nameGen = new MarkovChain({
  maxOrder: 2,
  sequences: names.map(n => n.split(''))
});

// Generate 10 names
for (let i = 0; i < 10; i++) {
  const name = nameGen.generate({ min: 3, max: 10 }).join('');
  console.log(name);
}

/* Output might include:
alice
bob
ch
xq        // Too short!
boba      // Weird
emma
dav
charli
alicee    // Double letter
bd        // Too short!
*/
```

Some of these are bad! Let's add quality control.

### Solution 1: Basic Filtering

```typescript
function isGoodName(name: string): boolean {
  // Too short or too long
  if (name.length < 4 || name.length > 10) return false;

  // No vowels (unpronounceable)
  if (!/[aeiou]/i.test(name)) return false;

  // Too many consonants in a row
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(name)) return false;

  // Weird double letters
  if (/(.)\1{2,}/.test(name)) return false;

  return true;
}

// Generate until we get a good one
function generateGoodName(generator: MarkovChain, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    const name = generator.generate({ min: 4, max: 10 }).join('');

    if (isGoodName(name)) {
      return name;
    }
  }

  // Fallback
  return 'hero';
}

console.log('Good names:');
for (let i = 0; i < 5; i++) {
  console.log('  ' + generateGoodName(nameGen));
}

/* Output:
Good names:
  alice
  charlie
  emma
  david
  alice
*/
```

### Solution 2: Score-Based Filtering

Instead of yes/no, score each name:

```typescript
const nameScore = nameGen.score(['a', 'l', 'i', 'c', 'e']);

console.log(nameScore);
/*
{
  sequence: ['a', 'l', 'i', 'c', 'e'],
  logProb: -2.5,        // Higher = more likely based on training
  perplexity: 1.8,      // Lower = better fit
  isValid: true,        // Can this sequence be generated?
  normalized: -0.5      // Per-letter score
}
*/
```

**What do these mean?**

- **logProb**: How likely this sequence is. Higher is better (less negative).
  - Training data: ~0 to -2
  - Plausible: -2 to -5
  - Weird: -5 to -10
  - Gibberish: < -10

- **perplexity**: How "surprised" the model is. Lower is better.
  - Good: < 3
  - Okay: 3-10
  - Bad: > 10

- **normalized**: Average score per element. Best for comparing different lengths.

### Solution 3: Smart Generation

```typescript
class QualityNameGenerator {
  private nameGen: MarkovChain;
  private minScore: number = -5;  // Minimum acceptable score

  constructor(nameGen: MarkovChain) {
    this.nameGen = nameGen;
  }

  generate(count: number = 1): string[] {
    const results: string[] = [];
    const maxAttempts = count * 10;  // Try up to 10x

    for (let attempt = 0; attempt < maxAttempts && results.length < count; attempt++) {
      const name = this.nameGen.generate({ min: 4, max: 10 }).join('');

      // Skip if doesn't pass basic checks
      if (!isGoodName(name)) continue;

      // Score it
      const score = this.nameGen.score(name.split(''));

      // Keep if score is good enough
      if (score.normalized > this.minScore && score.perplexity < 5) {
        results.push(name);
      }
    }

    return results;
  }

  // Generate and rank by quality
  generateBest(count: number = 1, candidates: number = 50): string[] {
    const allNames: Array<{ name: string; score: number }> = [];

    for (let i = 0; i < candidates; i++) {
      const name = this.nameGen.generate({ min: 4, max: 10 }).join('');

      if (isGoodName(name)) {
        const score = this.nameGen.score(name.split(''));
        allNames.push({ name, score: score.normalized });
      }
    }

    // Sort by score (best first) and return top N
    return allNames
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(x => x.name);
  }
}

// Usage
const qualityGen = new QualityNameGenerator(nameGen);

console.log('Quality names:', qualityGen.generate(5));
// ['alice', 'charlie', 'emma', 'david', 'bob']

console.log('Best names:', qualityGen.generateBest(3, 100));
// ['alice', 'emma', 'charlie'] - highest scoring
```

---

## Profanity and Content Filtering

### Blacklist Filtering

Prevent accidentally generating offensive content:

```typescript
const profanityList = ['bad', 'word', 'list']; // Your actual list

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return profanityList.some(word => lower.includes(word));
}

function generateSafeName(generator: MarkovChain): string {
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    const name = generator.generate({ min: 4, max: 10 }).join('');

    // Check profanity
    if (!containsProfanity(name)) {
      return name;
    }
  }

  return 'hero'; // Safe fallback
}
```

### Using Constraints (v3.4+)

Built-in constraint system is cleaner:

```typescript
const safeName = nameGen.generate({
  min: 4,
  max: 10,
  constraints: {
    minLength: 4,
    maxLength: 10,
    pattern: /^[a-z]+$/i,                    // Only letters
    mustNotContain: ['xx', 'qq'],            // Weird combos
    validator: (seq) => {
      const name = seq.join('');
      // Custom validation
      return !containsProfanity(name) && isGoodName(name);
    },
    maxRetries: 100  // Try up to 100 times
  }
});

console.log('Safe name:', safeName.join(''));
```

**Constraints available:**
- `minLength` / `maxLength` - Enforce length
- `mustContain` - Required elements (e.g., `['a']` for names with 'a')
- `mustNotContain` - Forbidden elements
- `pattern` - Regex pattern
- `validator` - Custom function
- `maxRetries` - How many attempts before giving up

---

## Player Behavior Detection

### Detecting Bots and Cheaters

Analyze player action sequences to detect unusual behavior:

```typescript
// Normal player actions
const normalPlayers = [
  ['login', 'tutorial', 'quest', 'combat', 'loot', 'logout'],
  ['login', 'quest', 'combat', 'death', 'respawn', 'combat', 'logout'],
  ['login', 'shop', 'quest', 'combat', 'loot', 'shop', 'logout']
];

const playerBehavior = new MarkovChain({ maxOrder: 2 });
playerBehavior.addSequences(normalPlayers);

// Check if a player is acting suspiciously
function isSuspicious(actions: string[]): boolean {
  const score = playerBehavior.score(actions);

  // Very low score = unusual behavior
  if (score.normalized < -10) {
    console.log(`⚠️ Suspicious: score ${score.normalized.toFixed(2)}`);
    return true;
  }

  return false;
}

// Normal player
const normalActions = ['login', 'quest', 'combat', 'loot', 'logout'];
console.log('Normal:', isSuspicious(normalActions)); // false

// Bot-like behavior (repetitive, no variation)
const botActions = ['login', 'farm', 'farm', 'farm', 'farm', 'farm', 'logout'];
console.log('Bot:', isSuspicious(botActions)); // true

// Cheater (impossible sequence)
const cheaterActions = ['login', 'admin', 'spawn-items', 'logout'];
console.log('Cheater:', isSuspicious(cheaterActions)); // true
```

### Anomaly Detection Threshold

Find the right threshold automatically:

```typescript
// Calculate baseline from normal players
const normalScores = normalPlayers.map(actions =>
  playerBehavior.score(actions).normalized
);

const average = normalScores.reduce((a, b) => a + b) / normalScores.length;
const variance = normalScores.reduce((sum, score) =>
  sum + Math.pow(score - average, 2), 0
) / normalScores.length;
const stdDev = Math.sqrt(variance);

// Flag anything 2 standard deviations below normal
const threshold = average - (2 * stdDev);

console.log(`Anomaly threshold: ${threshold.toFixed(2)}`);
console.log(`Average normal score: ${average.toFixed(2)}`);

// Use built-in anomaly detection
function flagSuspicious(actions: string[]): void {
  const isAnomaly = playerBehavior.isAnomaly(actions, threshold);

  if (isAnomaly) {
    console.log('🚨 FLAGGED FOR REVIEW:', actions.join(' → '));
  } else {
    console.log('✓ Normal behavior:', actions.join(' → '));
  }
}

flagSuspicious(['login', 'quest', 'combat', 'logout']);  // Normal
flagSuspicious(['login', 'exploit', 'exploit', 'logout']); // Flagged!
```

### Real-Time Monitoring

```typescript
class PlayerMonitor {
  private behaviorModel: MarkovChain;
  private threshold: number;
  private recentActions = new Map<string, string[]>();

  constructor(behaviorModel: MarkovChain, threshold: number) {
    this.behaviorModel = behaviorModel;
    this.threshold = threshold;
  }

  recordAction(playerId: string, action: string): void {
    if (!this.recentActions.has(playerId)) {
      this.recentActions.set(playerId, []);
    }

    const actions = this.recentActions.get(playerId)!;
    actions.push(action);

    // Keep last 10 actions
    if (actions.length > 10) {
      actions.shift();
    }

    // Check if suspicious
    if (actions.length >= 5) {
      const score = this.behaviorModel.score(actions.slice(-5));

      if (score.normalized < this.threshold) {
        console.log(`⚠️ Player ${playerId} flagged: ${actions.join(' → ')}`);
        // Alert moderators, add to review queue, etc.
      }
    }
  }
}

// Usage
const monitor = new PlayerMonitor(playerBehavior, threshold);

// Simulate player actions
monitor.recordAction('player123', 'login');
monitor.recordAction('player123', 'quest');
monitor.recordAction('player123', 'combat');
monitor.recordAction('player123', 'loot');
monitor.recordAction('player123', 'logout');  // Normal

// Suspicious player
monitor.recordAction('bot456', 'login');
monitor.recordAction('bot456', 'farm');
monitor.recordAction('bot456', 'farm');
monitor.recordAction('bot456', 'farm');
monitor.recordAction('bot456', 'farm');  // Flagged!
```

---

## Autocomplete and Suggestions

### Text Autocomplete

Suggest completions based on what user has typed:

```typescript
// Train on common phrases
const phrases = [
  'the quick brown fox jumps',
  'the lazy dog sleeps',
  'a quick brown rabbit',
  'the swift cat runs'
];

const textModel = new MarkovChain({
  maxOrder: 2,
  sequences: phrases.map(p => p.split(' '))
});

function getSuggestions(userInput: string[], count: number = 3): string[][] {
  const candidates: string[][] = [];

  // Generate multiple completions
  for (let i = 0; i < count * 10; i++) {
    const completion = textModel.generate({
      start: userInput,
      max: userInput.length + 5,
      order: 2
    });

    // Only keep if it extends user input
    if (completion.length > userInput.length) {
      candidates.push(completion);
    }
  }

  // Rank by likelihood
  const ranked = textModel.rankByLikelihood(candidates);

  // Return top N unique suggestions
  const unique = new Set<string>();
  const results: string[][] = [];

  for (const item of ranked) {
    const text = item.sequence.join(' ');
    if (!unique.has(text) && item.isValid) {
      unique.add(text);
      results.push(item.sequence);
      if (results.length >= count) break;
    }
  }

  return results;
}

// User types "the quick"
const suggestions = getSuggestions(['the', 'quick']);

console.log('Suggestions:');
suggestions.forEach((suggestion, i) => {
  console.log(`${i + 1}. ${suggestion.join(' ')}`);
});

/* Output:
Suggestions:
1. the quick brown fox jumps
2. the quick brown rabbit
3. the quick brown fox
*/
```

### Search Query Suggestions

```typescript
// Train on popular searches
const searches = [
  ['best', 'sword', 'for', 'warrior'],
  ['best', 'armor', 'for', 'mage'],
  ['how', 'to', 'craft', 'sword'],
  ['where', 'to', 'find', 'diamonds']
];

const searchModel = new MarkovChain({
  maxOrder: 2,
  sequences: searches
});

function suggestSearches(partialQuery: string[]): string[][] {
  if (partialQuery.length === 0) return [];

  const suggestions = getSuggestions(partialQuery, 5);

  return suggestions;
}

// User types "best"
console.log('Search suggestions for "best":');
suggestSearches(['best']).forEach(s => {
  console.log(`  "${s.join(' ')}"`);
});

/* Output:
Search suggestions for "best":
  "best sword for warrior"
  "best armor for mage"
*/
```

---

## Ranking Generated Content

### Dialogue Quality Ranking

Generate multiple dialogue options and pick the best:

```typescript
const dialogueLines = [
  'greetings traveler how can i help you today'.split(' '),
  'well met friend what brings you here'.split(' '),
  'hello there what do you need'.split(' '),
  'welcome to my shop please look around'.split(' ')
];

const dialogueModel = new MarkovChain({
  maxOrder: 2,
  sequences: dialogueLines
});

// Generate candidates
const candidates: string[][] = [];
for (let i = 0; i < 20; i++) {
  candidates.push(dialogueModel.generate({ min: 5, max: 10, order: 2 }));
}

// Rank them
const ranked = dialogueModel.rankByLikelihood(candidates);

console.log('Top 3 dialogue options:');
ranked.slice(0, 3).forEach((item, i) => {
  console.log(`${i + 1}. "${item.sequence.join(' ')}"`);
  console.log(`   Score: ${item.normalized.toFixed(2)}, Perplexity: ${item.perplexity.toFixed(2)}\n`);
});

/* Output:
Top 3 dialogue options:
1. "greetings traveler what brings you here"
   Score: -1.20, Perplexity: 1.8

2. "well met friend how can i help"
   Score: -1.45, Perplexity: 2.1

3. "hello there please look around today"
   Score: -2.10, Perplexity: 2.8
*/
```

### Quest Quality Ranking

```typescript
const questTemplates = [
  ['talk', 'travel', 'fight', 'return', 'reward'],
  ['talk', 'gather', 'craft', 'deliver', 'reward'],
  ['talk', 'find', 'solve', 'return', 'reward']
];

const questModel = new MarkovChain({
  maxOrder: 2,
  sequences: questTemplates
});

// Generate quest variations
function generateQuestBatch(count: number): string[][] {
  const quests: string[][] = [];

  for (let i = 0; i < count; i++) {
    quests.push(questModel.generate({ min: 4, max: 7, order: 2 }));
  }

  return quests;
}

// Pick best quests
function selectBestQuests(count: number): string[][] {
  const candidates = generateQuestBatch(count * 5);  // Generate 5x
  const ranked = questModel.rankByLikelihood(candidates);

  // Return top N
  return ranked
    .slice(0, count)
    .map(r => r.sequence);
}

console.log('Best 3 quests:');
selectBestQuests(3).forEach((quest, i) => {
  console.log(`Quest ${i + 1}: ${quest.join(' → ')}`);
});

/* Output:
Best 3 quests:
Quest 1: talk → travel → fight → return → reward
Quest 2: talk → gather → craft → deliver → reward
Quest 3: talk → find → solve → return → reward
*/
```

---

## Advanced: Custom Scoring

### Weighted Scoring

Combine multiple factors:

```typescript
interface ScoringWeights {
  likelihood: number;   // How well it fits training data
  length: number;       // Prefer certain lengths
  uniqueness: number;   // Penalize common results
}

class CustomScorer {
  private model: MarkovChain;
  private weights: ScoringWeights;
  private seenResults = new Set<string>();

  constructor(model: MarkovChain, weights: ScoringWeights) {
    this.model = model;
    this.weights = weights;
  }

  score(sequence: string[]): number {
    let totalScore = 0;

    // Likelihood score (from model)
    const modelScore = this.model.score(sequence);
    totalScore += modelScore.normalized * this.weights.likelihood;

    // Length score (prefer 5-8 characters)
    const idealLength = 6;
    const lengthDiff = Math.abs(sequence.length - idealLength);
    const lengthScore = Math.max(0, 5 - lengthDiff);
    totalScore += lengthScore * this.weights.length;

    // Uniqueness score (penalize if we've seen it)
    const text = sequence.join('');
    const uniquenessScore = this.seenResults.has(text) ? -5 : 2;
    totalScore += uniquenessScore * this.weights.uniqueness;

    return totalScore;
  }

  generateBest(count: number, candidates: number = 50): string[] {
    const scored: Array<{ text: string; score: number }> = [];

    for (let i = 0; i < candidates; i++) {
      const seq = this.model.generate({ min: 4, max: 10 });
      const score = this.score(seq);
      const text = seq.join('');

      scored.push({ text, score });
    }

    // Sort and return top N
    const best = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(x => x.text);

    // Remember results
    best.forEach(text => this.seenResults.add(text));

    return best;
  }
}

// Usage
const scorer = new CustomScorer(nameGen, {
  likelihood: 1.0,    // Most important
  length: 0.5,        // Somewhat important
  uniqueness: 0.3     // Less important
});

console.log('Best names (custom scoring):');
scorer.generateBest(5).forEach(name => console.log('  ' + name));
```

---

## Best Practices

### 1. Set Reasonable Thresholds

```typescript
// Too strict - might never generate anything
const tooStrict = { minScore: -1, maxRetries: 10 };

// Too loose - might generate garbage
const tooLoose = { minScore: -100, maxRetries: 1000 };

// Good balance
const balanced = { minScore: -5, maxRetries: 100 };
```

### 2. Cache Scores

```typescript
class CachedScorer {
  private model: MarkovChain;
  private cache = new Map<string, number>();

  score(sequence: string[]): number {
    const key = sequence.join('_');

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const score = this.model.score(sequence).normalized;
    this.cache.set(key, score);
    return score;
  }
}
```

### 3. Combine Multiple Filters

```typescript
function isValidContent(sequence: string[]): boolean {
  const text = sequence.join('');

  // Multiple checks
  return (
    isGoodName(text) &&
    !containsProfanity(text) &&
    text.length >= 4 &&
    text.length <= 10
  );
}

const content = nameGen.generate({
  constraints: {
    validator: isValidContent,
    maxRetries: 100
  }
});
```

---

## Performance Tips

### Pre-filter Training Data

Remove bad examples before training:

```typescript
const trainingData = allNames
  .filter(name => isGoodName(name))
  .filter(name => !containsProfanity(name));

const cleanModel = new MarkovChain({
  sequences: trainingData.map(n => n.split(''))
});
```

### Batch Scoring

```typescript
// Slow
candidates.forEach(seq => {
  const score = model.score(seq);
  // ...
});

// Faster - use rankByLikelihood
const ranked = model.rankByLikelihood(candidates);
ranked.forEach(item => {
  // All scored at once!
});
```

---

## Next Steps

- [Pattern Analysis](./pattern-analysis.md) - Find patterns, build recommendations
- [Debugging & Analytics](./debugging.md) - Visualize and debug your generators
- [Game Generation](./game-generation.md) - Apply quality control to game content

---

**Quick Reference:**

| Task | Method | When to Use |
|------|--------|-------------|
| Score single sequence | `score()` | Check quality of one result |
| Rank multiple | `rankByLikelihood()` | Pick best from many |
| Detect anomalies | `isAnomaly()` | Find unusual patterns |
| Enforce rules | `generate({ constraints })` | Force valid output |
| Custom validation | `validator` function | Complex requirements |

**Scoring Metrics:**
- **normalized**: Best for general comparison
- **perplexity**: Good for different lengths
- **logProb**: Raw likelihood score
