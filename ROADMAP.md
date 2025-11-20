# Acausal Roadmap

This document outlines the development roadmap for acausal, including completed features and planned additions.

## Design Philosophy

All features should adhere to the core design principles:
- **Immutable**: Pure functions that don't mutate state
- **Portable**: Easily serializable/deserializable
- **Composable**: Solid primitives that can be combined
- **Minimal Dependencies**: Lean and focused
- **Deterministic**: Seeded randomness for reproducibility

## Completed Versions

### v2.0.0 - TypeScript Rewrite (2021)
- Full conversion to TypeScript
- Rewrote MarkovChain class
- Rewrote Distribution class
- Random service wrapping random-js
- Comprehensive test coverage (>99%)
- Documentation and quickstart guides

### v3.0.0 - Modernization (Planned)
- Updated to TypeScript 5.6.3
- Modern build system (tsup)
- ESM/CJS dual output
- Updated dependencies
- Jest 29.7.0 for testing

### v3.1.0 - Chain Blending (Planned)
- Interpolate between multiple Markov chains
- Weight-based blending
- Use cases: character breeding, cultural mixing, evolution

### v3.2.0 - Scaled States (Planned)
- States with magnitude/intensity values
- Smooth transitions between states
- Use cases: combat damage, market prices, morale systems

### v3.3.0 - Multi-Dimensional Chains (Planned)
- Support for multi-dimensional state spaces
- Beyond sequential patterns
- Use cases: tile generation, AI behavior trees, equipment combos

### v3.4.0 - Sequence Scoring & Constraints (Planned)
- Score sequences with log probability and perplexity
- Constraint-based generation
- Quality filtering and anomaly detection
- Use cases: filtering bad names, content validation

### v3.5.0 - Pattern Analysis (Planned)
- Extract common patterns from trained models
- Similarity search between sequences
- Multiple distance metrics (Jaccard, cosine, Levenshtein)
- Use cases: recommendations, matchmaking, content discovery

### v4.0.0 - Graph Export & Visualization (Planned)
- Export models to JSON, graph formats, CSV
- Model comparison and analysis
- Statistical introspection
- Use cases: debugging, A/B testing, analytics

## Future Versions

### v5.0.0 - Wave Function Collapse
**Goal**: Add WFC as a first-class primitive alongside Distribution and MarkovChain

#### Core Features
- **Graph-based constraints**: Not opinionated towards grids
- **Multi-dimensional support**: Works in 2D, 3D, and beyond
- **Irregular topologies**: Support for Voronoi, hex grids, custom graphs
- **Composable primitives**: Core collapse algorithm separate from topology
- **Rule learning**: Extract constraint rules from example data
- **Serializable models**: Store and transfer trained WFC models

#### API Design
```typescript
// Low-level: Define your own topology
const wfc = new WFC({
  seed: 42,
  states: ['grass', 'water', 'sand'],
  constraints: {
    // Adjacency rules per dimension/direction
    grass: { north: ['grass', 'sand'], south: ['grass', 'water'] },
    water: { north: ['sand', 'water'], south: ['water'] },
    sand: { north: ['grass', 'sand'], south: ['water', 'sand'] }
  }
});

// Collapse over your own graph structure
const result = wfc.collapse({
  nodes: customNodeArray,
  getNeighbors: (node) => node.neighbors,
  getDimension: (node, neighbor) => calculateDimension(node, neighbor)
});

// High-level: Built-in topologies
const grid = new WFCGrid2D({ width: 50, height: 50, wfc });
const hex = new WFCHexGrid({ radius: 20, wfc });
const voronoi = new WFCVoronoi({ points: seeds, wfc });
```

#### Integration with Existing Primitives
- Use Distribution for weighted tile selection
- Use MarkovChain to learn sequential patterns in tile placement
- Combine with multi-dimensional chains for complex state spaces

#### Use Cases
- Tile-based dungeon/map generation
- 3D voxel world generation
- Irregular city layouts (Townscaper-style)
- Puzzle generation with hard constraints
- Building interiors with architectural rules

### v5.1.0 - L-Systems
**Goal**: Add L-Systems for recursive/branching generation

#### Core Features
- **Rule-based expansion**: Context-free and context-sensitive grammars
- **Parameterized rules**: Rules with variables and conditions
- **Stochastic variation**: Weighted rule selection using Distribution
- **Turtle interpretation**: Built-in 2D/3D turtle graphics
- **Composable with MarkovChain**: Vary rule applications statistically

#### API Design
```typescript
const lsystem = new LSystem({
  seed: 42,
  axiom: 'F',
  rules: {
    'F': [
      { successor: 'F[+F]F[-F]F', weight: 3 },
      { successor: 'F[++F][--F]F', weight: 1 }
    ]
  }
});

const result = lsystem.generate({ iterations: 5 });
const geometry = lsystem.interpret(result, { angle: 25, distance: 10 });
```

#### Use Cases
- Tree and plant generation
- River networks and cave systems
- Lightning bolts and cracks
- Procedural architecture
- Fractal patterns

### v5.2.0 - Grammar-Based Generation
**Goal**: Add context-free grammars for structured content

#### Core Features
- **Production rules**: Define grammar with terminal/non-terminal symbols
- **Weighted rules**: Use Distribution for rule selection
- **Template support**: Embed variables and expressions
- **Recursive expansion**: Safe recursion with depth limits
- **Integration with MarkovChain**: Learn rule variations from examples

#### API Design
```typescript
const grammar = new Grammar({
  seed: 42,
  start: 'quest',
  rules: {
    quest: [
      { template: 'Retrieve the [item] from [location]', weight: 3 },
      { template: 'Defeat [enemy] at [location]', weight: 2 }
    ],
    item: ['Ancient Sword', 'Magic Crystal', 'Lost Scroll'],
    location: ['Dark Forest', 'Abandoned Castle', 'Mountain Peak'],
    enemy: ['Dragon', 'Lich', 'Giant']
  }
});

const quest = grammar.generate('quest');
```

#### Use Cases
- Quest and dialogue generation
- Procedural story generation
- Code generation
- Structured data generation
- Template-based content

### v6.0.0 - Gen-AI Integration
**Goal**: Integrate with LLM APIs for context generation and parameter tuning

#### Core Features
- **Context generation**: Use LLMs to generate training data
- **Parameter optimization**: AI-assisted parameter tuning
- **Constraint refinement**: Generate WFC rules from descriptions
- **Quality validation**: Use LLMs to validate generated content
- **Hybrid workflows**: Combine statistical and neural generation

#### Integration Patterns
```typescript
// Generate training data from AI
const aiGenerator = new AIContextGenerator({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet'
});

// Generate example names for training
const examples = await aiGenerator.generate({
  prompt: 'Generate 100 fantasy character names with Celtic influence',
  format: 'list'
});

// Train Markov chain on AI-generated examples
const chain = new MarkovChain({ sequences: examples.map(n => n.split('')) });

// Use AI to validate generated content
const validator = new AIValidator({
  prompt: 'Is this a good fantasy name? Consider pronounceability and style.'
});

const names = chain.generate({ samples: 100 });
const validated = await validator.filter(names);

// AI-assisted parameter tuning
const optimizer = new AIOptimizer({
  prompt: 'Tune these WFC parameters to generate more varied dungeons'
});

const params = await optimizer.optimize(wfc, {
  objective: 'maximize variety while maintaining playability'
});
```

#### Use Cases
- Bootstrap training data from natural language descriptions
- Validate generated content for quality/appropriateness
- Tune generation parameters based on desired outcomes
- Combine statistical patterns with semantic understanding
- Generate constraint rules from high-level descriptions

## Research & Exploration

### Potential Future Features

#### Cellular Automata
- Framework for CA-based generation
- Cave carving, erosion simulation
- Game of Life variants
- Needs clear scope to avoid being too broad

#### Noise Function Integration
- While external libraries exist, could add game-focused presets
- Seamless tiling utilities
- Octave/lacunarity presets for common use cases
- Integration with Distribution for biome selection

#### Constraint Satisfaction Problems (CSP)
- General CSP solver as a primitive
- Arc consistency algorithms
- Backtracking with heuristics
- Could unify WFC with other constraint-based generation

#### Genetic Algorithms
- Population-based optimization
- Use chain blending for crossover
- Use MarkovChain to evolve patterns
- Fitness evaluation frameworks

## Contributing

We welcome contributions aligned with this roadmap! Please:
1. Open an issue to discuss major features before implementing
2. Follow the design philosophy (immutable, portable, composable)
3. Include comprehensive tests (maintain >95% coverage)
4. Write documentation with game development examples
5. Keep dependencies minimal

## Versioning

We follow semantic versioning:
- **Major** versions: Breaking API changes
- **Minor** versions: New features, backwards compatible
- **Patch** versions: Bug fixes, documentation updates

Current development focuses on completing v3.x-v4.x features before starting v5.x work.
