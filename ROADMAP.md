# acausal Roadmap

This document outlines planned features and enhancements for the acausal library, organized by priority and complexity.

---

## 🎯 High Priority - Core Enhancements

### 1. Multi-Dimensional Markov Chains ⭐⭐⭐
**Status:** Planned
**Complexity:** High
**Use Case:** Procedural generation with multi-attribute states, WFC-style tile generation

**Problem:**
Current implementation requires flattening multi-dimensional data into 1D sequences, losing spatial/attribute relationships.

**Solution:**
```typescript
// Current limitation - must flatten
const state = `${tile}_${x}_${y}`; // Loses structure

// New: Multi-dimensional states
interface TileState {
  tile: string;
  position: [number, number];
  neighbors: string[];
}

const mdChain = new MultiDimMarkovChain<TileState>({
  dimensions: ['tile', 'position'],
  maxOrder: 2
});

// Add sequences with full context
mdChain.addSequence([
  { tile: 'grass', position: [0, 0], neighbors: ['water', 'grass'] },
  { tile: 'water', position: [0, 1], neighbors: ['grass', 'water'] },
]);

// Generate considering all dimensions
const next = mdChain.generate({
  context: { neighbors: ['grass', 'grass'] },
  constraints: { position: [1, 1] }
});
```

**Implementation Plan:**
- [ ] `TensorMarkovChain` class for N-dimensional state spaces
- [ ] Projection/marginalization to analyze single dimensions
- [ ] Constraint propagation for WFC-like generation
- [ ] Spatial correlation tracking

---

### 2. Chain Blending & Interpolation ⭐⭐⭐
**Status:** Planned
**Complexity:** Medium
**Use Case:** Combining multiple sources, genetic algorithms, style transfer

**Problem:**
No way to combine probabilities from multiple chains or states.

**Solution:**
```typescript
// Blend multiple chains
const mother = new MarkovChain({ sequences: motherTraits });
const father = new MarkovChain({ sequences: fatherTraits });

// Weighted blend: 50% each parent
const child = MarkovChain.blend([
  { chain: mother, weight: 0.5 },
  { chain: father, weight: 0.5 }
]);

// Or smooth interpolation
const hybrid = mother.interpolate(father, 0.3); // 70% mother, 30% father

// Generate from blended probabilities
const hairColor = child.generate({ start: ['hair', 'color'] });
```

**Advanced Blending:**
```typescript
// Blend with custom strategy
const blended = MarkovChain.blend([
  { chain: chain1, weight: 0.5 },
  { chain: chain2, weight: 0.3 },
  { chain: chain3, weight: 0.2 }
], {
  strategy: 'geometric-mean',  // or 'arithmetic-mean', 'max', 'min'
  normalize: true
});

// Conditional blending
const adaptive = MarkovChain.blend([
  { chain: formalChain, weight: (ctx) => ctx.formality },
  { chain: casualChain, weight: (ctx) => 1 - ctx.formality }
]);
```

**Implementation Plan:**
- [ ] `MarkovChain.blend()` static method
- [ ] `interpolate()` instance method
- [ ] Multiple blending strategies (arithmetic, geometric, harmonic mean)
- [ ] Context-aware weight functions
- [ ] Distribution merging utilities

---

### 3. Continuous & Scaled States ⭐⭐⭐
**Status:** Planned
**Complexity:** High
**Use Case:** Market simulations, physics, continuous values with categorical states

**Problem:**
Can only handle discrete categorical states. Can't represent `positive(+50)` where magnitude matters.

**Solution:**
```typescript
interface ScaledState<T = string> {
  category: T;
  magnitude: number;
}

const marketChain = new ScaledMarkovChain<'positive' | 'negative' | 'neutral'>({
  maxOrder: 2,
  magnitudeRange: [-100, 100]
});

// Add sequences with magnitudes
marketChain.addSequence([
  { category: 'positive', magnitude: 20 },
  { category: 'positive', magnitude: 45 },  // Trending up
  { category: 'neutral', magnitude: 5 },
  { category: 'negative', magnitude: -30 }
]);

// Generate considering both category AND magnitude
const next = marketChain.generate({
  current: { category: 'positive', magnitude: 30 }
});
// Returns: { category: 'positive', magnitude: 42, confidence: 0.85 }

// Analyze magnitude distributions
const stats = marketChain.getMagnitudeStats('positive');
// { mean: 35, std: 15, range: [20, 75] }
```

**Advanced Features:**
```typescript
// Kernel density estimation for smooth magnitude transitions
const smooth = new ScaledMarkovChain({
  magnitudeKernel: 'gaussian',
  bandwidth: 10
});

// Bin continuous values automatically
const binned = new ScaledMarkovChain({
  autoBin: true,
  bins: 10,  // Automatically discretize into 10 bins
  adaptive: true  // Use adaptive binning based on data
});
```

**Implementation Plan:**
- [ ] `ScaledMarkovChain` class
- [ ] Magnitude tracking and transitions
- [ ] Kernel density estimation for smoothing
- [ ] Adaptive binning strategies
- [ ] Magnitude-aware generation

---

## 🚀 Medium Priority - Quality of Life

### 4. Constraint-Based Generation ⭐⭐
**Status:** Planned
**Complexity:** Medium

**Use Case:** Quality control, grammar rules, domain constraints

```typescript
const chain = new MarkovChain({ sequences: names });

const validName = chain.generate({
  order: 2,
  constraints: {
    minLength: 5,
    maxLength: 10,
    mustContain: ['a'],
    mustNotContain: ['x', 'q'],
    pattern: /^[A-Z][a-z]+$/,
    validator: (seq) => !profanityList.includes(seq.join('')),
    maxRetries: 100
  }
});
```

**Implementation Plan:**
- [ ] Constraint validation framework
- [ ] Backtracking for constraint satisfaction
- [ ] Pattern matching
- [ ] Custom validator functions

---

### 5. Sequence Scoring & Ranking ⭐⭐
**Status:** Planned
**Complexity:** Medium

**Use Case:** Anomaly detection, quality filtering, autocomplete

```typescript
// Score how likely a sequence is
const score = chain.score(['j', 'o', 'h', 'n']);
// { logProb: -8.3, perplexity: 12.4, isValid: true }

// Rank multiple candidates
const candidates = ['john', 'xqz', 'alice', 'zxyw'];
const ranked = chain.rankByLikelihood(candidates);
// [
//   { sequence: 'john', score: -8.3, rank: 1 },
//   { sequence: 'alice', score: -9.1, rank: 2 },
//   { sequence: 'xqz', score: -25.4, rank: 3 },
//   { sequence: 'zxyw', score: -35.2, rank: 4 }
// ]

// Detect anomalies
const isAnomaly = chain.isAnomaly(['x', 'q', 'z'], { threshold: 0.01 });
```

**Implementation Plan:**
- [ ] Log-probability calculation
- [ ] Perplexity metrics
- [ ] Ranking utilities
- [ ] Anomaly detection thresholds

---

### 6. Pattern Extraction & Analysis ⭐⭐
**Status:** Planned
**Complexity:** Low

**Use Case:** Data exploration, similarity search, clustering

```typescript
// Extract frequent patterns
const patterns = chain.extractPatterns({
  minOrder: 2,
  minFrequency: 5,
  topN: 20
});

// Find similar sequences
const similar = chain.findSimilar(['alice'], {
  metric: 'cosine',  // or 'jaccard', 'levenshtein'
  topN: 5
});

// Cluster sequences
const clusters = chain.clusterSequences({
  method: 'kmeans',
  k: 5
});
```

**Implementation Plan:**
- [ ] Pattern frequency analysis
- [ ] Similarity metrics (cosine, Jaccard, edit distance)
- [ ] Clustering algorithms
- [ ] Visualization helpers

---

### 7. Incremental/Streaming Generation ⭐⭐
**Status:** Planned
**Complexity:** Medium

**Use Case:** Interactive generation, beam search, exploration

```typescript
// Step-by-step generation with control
const generator = chain.createGenerator({ order: 2 });

for (const step of generator) {
  console.log('Current:', step.sequence);
  console.log('Options:', step.nextOptions);

  if (shouldBacktrack(step.sequence)) {
    generator.backtrack(2);
  }

  if (step.sequence.length >= 10) break;
}

// Beam search for quality
const beamResults = chain.beamSearch({
  beamWidth: 5,
  maxLength: 20,
  scorer: (seq) => chain.score(seq).logProb
});
```

**Implementation Plan:**
- [ ] Generator/iterator interface
- [ ] Backtracking support
- [ ] Beam search implementation
- [ ] Step-by-step control

---

## 🔧 Low Priority - Utilities

### 8. Conditional/Tagged Chains ⭐
**Status:** Planned
**Complexity:** Medium

**Use Case:** Controlled generation, multi-domain models

```typescript
interface Message {
  text: string[];
  sentiment: 'positive' | 'negative';
  author: string;
}

const conditional = new ConditionalMarkovChain<string, { sentiment: string }>({
  maxOrder: 2
});

// Add with conditions
messages.forEach(msg => {
  conditional.addSequence(msg.text, {
    conditions: { sentiment: msg.sentiment }
  });
});

// Generate with specific conditions
const positive = conditional.generate({
  conditions: { sentiment: 'positive' }
});
```

**Implementation Plan:**
- [ ] Condition tracking in gram storage
- [ ] Filtered generation by conditions
- [ ] Condition-aware statistics

---

### 9. Import/Export Utilities ⭐
**Status:** Planned
**Complexity:** Low

**Use Case:** Data integration, visualization

```typescript
// Import from various formats
const chain = MarkovChain.fromCSV('data.csv', {
  sequenceColumn: 'text',
  delimiter: ' '
});

// Export for visualization
chain.exportToD3();
chain.exportToCytoscape();

// Diff between chains
const diff = chain1.diff(chain2);
```

**Implementation Plan:**
- [ ] CSV/JSON importers
- [ ] Visualization format exporters
- [ ] Chain comparison/diff utilities

---

### 10. Multi-Chain Composition ⭐
**Status:** Planned
**Complexity:** High

**Use Case:** Hierarchical generation

```typescript
const wordChain = new MarkovChain({ sequences: wordSequences });
const charChain = new MarkovChain({ sequences: charSequences });

const composed = new CompositeChain({
  levels: [
    { chain: wordChain, name: 'word' },
    { chain: charChain, name: 'char' }
  ]
});

const result = composed.generate({
  word: { min: 3, max: 5 },
  char: { min: 4, max: 8 }
});
```

**Implementation Plan:**
- [ ] Hierarchical chain composition
- [ ] Level-specific generation parameters
- [ ] Cross-level dependencies

---

## 📊 Implementation Priority

Based on user needs and impact:

1. **Phase 5 (v3.1):** Chain Blending & Interpolation
2. **Phase 6 (v3.2):** Continuous & Scaled States
3. **Phase 7 (v3.3):** Multi-Dimensional Chains
4. **Phase 8 (v3.4):** Constraint-Based Generation + Scoring
5. **Phase 9 (v3.5):** Pattern Analysis + Incremental Generation
6. **Phase 10 (v4.0):** Conditional Chains + Composition

---

## 🤝 Addressing Your Specific Use Cases

### Use Case 1: Multi-Dimensional State Spaces
**Your need:** "Markov chains for tile generation, but everything needs to be collapsed to 1D"

**Solution:** Multi-Dimensional Markov Chains (Phase 7)
- Store full state tuples: `{tile, x, y, neighbors}`
- WFC-style constraint propagation
- Spatial correlation tracking

### Use Case 2: Blending Parent Probabilities
**Your need:** "Two characters have a baby, blend hair color probabilities"

**Solution:** Chain Blending (Phase 5) - **IMPLEMENTING NOW**
- `MarkovChain.blend([mother, father], [0.5, 0.5])`
- Interpolate probability distributions
- Genetic algorithm support

### Use Case 3: Continuous Magnitudes
**Your need:** "A(0.4) => B(x) where x is magnitude determined by A"

**Solution:** Scaled States (Phase 6)
- `ScaledMarkovChain` with category + magnitude
- Track magnitude transitions
- Kernel density estimation for smoothing

---

## 📝 Notes

- All features maintain immutability and functional design
- Backward compatibility preserved
- Performance optimizations from v3.0 carry forward
- Generic types support throughout

---

**Last Updated:** 2025-11-08
**Current Version:** v3.0.0
**Target for Next Release:** v3.1.0 (Chain Blending)
