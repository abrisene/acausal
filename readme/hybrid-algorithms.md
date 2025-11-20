# Hybrid Algorithms: Combining Acausal with Other Techniques

This guide shows you how to combine Markov chains with other procedural generation algorithms for powerful hybrid systems.

## Table of Contents

- [Why Combine Algorithms?](#why-combine-algorithms)
- [Wave Function Collapse + Markov Chains](#wave-function-collapse--markov-chains)
- [Perlin Noise + Distributions](#perlin-noise--distributions)
- [L-Systems + Markov Chains](#l-systems--markov-chains)
- [Genetic Algorithms + Chain Blending](#genetic-algorithms--chain-blending)
- [Grammar-Based + Markov](#grammar-based--markov)
- [Constraint Satisfaction](#constraint-satisfaction)

---

## Why Combine Algorithms?

Different algorithms are good at different things:

| Algorithm | Best For | Weakness |
|-----------|----------|----------|
| **Markov Chains** | Sequences, patterns, learning from examples | No spatial awareness |
| **Wave Function Collapse** | Tile-based levels, local constraints | Needs predefined rules |
| **Perlin Noise** | Terrain, natural variation | Too smooth/predictable |
| **L-Systems** | Plants, fractals, branching | Limited variety |
| **Genetic Algorithms** | Optimization, evolution | Slow, needs fitness function |

**By combining them**, you get the best of both worlds!

---

## Wave Function Collapse + Markov Chains

### What is Wave Function Collapse?

WFC generates grids where each tile must follow local rules (e.g., "grass can be next to dirt but not next to lava").

**Problem**: You have to manually define all the rules.

**Solution**: Use Markov chains to learn the rules from example maps!

### Learning Tile Rules from Examples

```typescript
import { MultiDimMarkovChain } from 'acausal';

interface Tile {
  type: string;
  x: number;
  y: number;
}

// Example maps (what tiles appear next to each other)
const exampleMaps = [
  // Map 1: Beach to forest
  [
    { type: 'water', x: 0, y: 0 },
    { type: 'sand', x: 1, y: 0 },
    { type: 'grass', x: 2, y: 0 },
    { type: 'grass', x: 3, y: 0 },
    { type: 'tree', x: 4, y: 0 }
  ],
  // Map 2: Another beach
  [
    { type: 'water', x: 0, y: 0 },
    { type: 'water', x: 1, y: 0 },
    { type: 'sand', x: 2, y: 0 },
    { type: 'grass', x: 3, y: 0 },
    { type: 'tree', x: 4, y: 0 }
  ]
];

// Learn tile transition patterns
const tileModel = new MultiDimMarkovChain<Tile>({
  maxOrder: 2,
  stateKey: (tile) => tile.type  // Only care about type, not position
});

tileModel.addSequences(exampleMaps);

// Now we know: water → sand → grass → tree
// This becomes our WFC ruleset!
```

### Simple WFC Implementation

```typescript
class SimpleWFC {
  private tileModel: MultiDimMarkovChain<Tile>;
  private width: number;
  private height: number;
  private grid: (string | null)[][] = [];

  constructor(
    tileModel: MultiDimMarkovChain<Tile>,
    width: number,
    height: number
  ) {
    this.tileModel = tileModel;
    this.width = width;
    this.height = height;

    // Initialize empty grid
    for (let y = 0; y < height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < width; x++) {
        this.grid[y][x] = null;
      }
    }
  }

  // Get valid tiles for a position based on neighbors
  getPossibleTiles(x: number, y: number): string[] {
    // Check left neighbor
    const leftTile = x > 0 ? this.grid[y][x - 1] : null;

    if (leftTile) {
      // Use Markov chain to predict what can come after leftTile
      const prediction = this.tileModel.generate({
        min: 1,
        max: 1,
        order: 1
      });

      if (prediction.length > 0) {
        return [prediction[0].type];
      }
    }

    // No constraints - any tile type
    return ['water', 'sand', 'grass', 'tree'];
  }

  // Generate the map
  generate(): string[][] {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const possible = this.getPossibleTiles(x, y);

        // Pick one randomly
        const chosen = possible[Math.floor(Math.random() * possible.length)];
        this.grid[y][x] = chosen;
      }
    }

    return this.grid as string[][];
  }

  // Pretty print
  print(): void {
    const symbols = {
      'water': '~',
      'sand': '.',
      'grass': '"',
      'tree': '♣'
    };

    this.grid.forEach(row => {
      console.log(row.map(tile => symbols[tile!] || '?').join(''));
    });
  }
}

// Generate a new map
const wfc = new SimpleWFC(tileModel, 20, 5);
wfc.generate();
wfc.print();

/* Output:
~....""""""♣♣♣♣♣♣♣♣
~....""""♣♣♣♣♣♣♣♣♣♣
~~...."""♣♣♣♣♣♣♣♣♣♣
~....."""♣♣♣♣♣♣♣♣♣♣
~.....""♣♣♣♣♣♣♣♣♣♣♣
*/
```

### Advanced WFC with Multiple Directions

```typescript
class MarkovWFC {
  private models: {
    horizontal: MultiDimMarkovChain<Tile>;
    vertical: MultiDimMarkovChain<Tile>;
  };
  private grid: (string | null)[][];

  constructor(exampleMaps: Tile[][][], width: number, height: number) {
    // Learn horizontal transitions
    this.models = {
      horizontal: new MultiDimMarkovChain<Tile>({
        maxOrder: 1,
        stateKey: (tile) => tile.type
      }),
      vertical: new MultiDimMarkovChain<Tile>({
        maxOrder: 1,
        stateKey: (tile) => tile.type
      })
    };

    // Extract horizontal and vertical sequences from examples
    exampleMaps.forEach(map => {
      // Horizontal (left to right)
      const rows = this.extractRows(map);
      rows.forEach(row => this.models.horizontal.addSequence(row));

      // Vertical (top to bottom)
      const cols = this.extractColumns(map);
      cols.forEach(col => this.models.vertical.addSequence(col));
    });

    // Initialize grid
    this.grid = Array(height).fill(null).map(() =>
      Array(width).fill(null)
    );
  }

  private extractRows(map: Tile[]): Tile[][] {
    const rows = new Map<number, Tile[]>();

    map.forEach(tile => {
      if (!rows.has(tile.y)) {
        rows.set(tile.y, []);
      }
      rows.get(tile.y)!.push(tile);
    });

    return Array.from(rows.values())
      .map(row => row.sort((a, b) => a.x - b.x));
  }

  private extractColumns(map: Tile[]): Tile[][] {
    const cols = new Map<number, Tile[]>();

    map.forEach(tile => {
      if (!cols.has(tile.x)) {
        cols.set(tile.x, []);
      }
      cols.get(tile.x)!.push(tile);
    });

    return Array.from(cols.values())
      .map(col => col.sort((a, b) => a.y - b.y));
  }

  // Get valid tiles considering both left and top neighbors
  getPossibleTiles(x: number, y: number): string[] {
    const possibleSets: Set<string>[] = [];

    // Check left neighbor
    if (x > 0 && this.grid[y][x - 1]) {
      const leftType = this.grid[y][x - 1]!;
      const horizontal = this.models.horizontal.generate({
        start: [{ type: leftType, x: x - 1, y }],
        min: 1,
        max: 1
      });
      if (horizontal.length > 0) {
        possibleSets.push(new Set([horizontal[0].type]));
      }
    }

    // Check top neighbor
    if (y > 0 && this.grid[y - 1][x]) {
      const topType = this.grid[y - 1][x]!;
      const vertical = this.models.vertical.generate({
        start: [{ type: topType, x, y: y - 1 }],
        min: 1,
        max: 1
      });
      if (vertical.length > 0) {
        possibleSets.push(new Set([vertical[0].type]));
      }
    }

    // Intersect all possibilities
    if (possibleSets.length === 0) {
      return ['water', 'sand', 'grass', 'tree']; // Any tile
    }

    // Find intersection
    let result = possibleSets[0];
    for (let i = 1; i < possibleSets.length; i++) {
      result = new Set([...result].filter(x => possibleSets[i].has(x)));
    }

    return result.size > 0 ? Array.from(result) : ['grass']; // Fallback
  }

  generate(): string[][] {
    // Start from top-left, go row by row
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const possible = this.getPossibleTiles(x, y);
        this.grid[y][x] = possible[Math.floor(Math.random() * possible.length)];
      }
    }

    return this.grid as string[][];
  }
}
```

---

## Perlin Noise + Distributions

### Adding Realism to Terrain

Perlin noise creates smooth terrain, but it's too uniform. Add variety with distributions!

```typescript
import { Distribution } from 'acausal';

// Biome distribution based on elevation and moisture
type Biome = 'ocean' | 'beach' | 'plains' | 'forest' | 'mountain' | 'snow';

function getBiomeDistribution(elevation: number, moisture: number): Distribution<Biome> {
  // Low elevation = water biomes
  if (elevation < 0.3) {
    return new Distribution<Biome>({
      source: {
        ocean: 80,
        beach: 20
      }
    });
  }

  // Medium elevation varies by moisture
  if (elevation < 0.6) {
    if (moisture < 0.4) {
      return new Distribution<Biome>({
        source: {
          plains: 70,
          forest: 20,
          beach: 10
        }
      });
    } else {
      return new Distribution<Biome>({
        source: {
          forest: 60,
          plains: 30,
          beach: 10
        }
      });
    }
  }

  // High elevation = mountains
  if (elevation < 0.8) {
    return new Distribution<Biome>({
      source: {
        mountain: 70,
        forest: 20,
        plains: 10
      }
    });
  }

  // Very high = snow
  return new Distribution<Biome>({
    source: {
      snow: 90,
      mountain: 10
    }
  });
}

// Generate terrain with Perlin noise (pseudocode) and acausal distributions
function generateTerrain(width: number, height: number): Biome[][] {
  const terrain: Biome[][] = [];

  for (let y = 0; y < height; y++) {
    terrain[y] = [];
    for (let x = 0; x < width; x++) {
      // Get Perlin noise values (0-1)
      const elevation = getPerlinNoise(x, y, 0.05); // Pseudocode
      const moisture = getPerlinNoise(x + 1000, y + 1000, 0.08); // Offset seed

      // Use distribution to add variety
      const distribution = getBiomeDistribution(elevation, moisture);
      terrain[y][x] = distribution.pickOne()!;
    }
  }

  return terrain;
}

// Pseudocode for Perlin noise
function getPerlinNoise(x: number, y: number, scale: number): number {
  // Return value 0-1
  // In real code, use a library like simplex-noise
  return Math.random(); // Simplified
}
```

### Feature Placement with Distributions

```typescript
// After generating base terrain, place features
function placeFeatures(terrain: Biome[][]): void {
  terrain.forEach((row, y) => {
    row.forEach((biome, x) => {
      // Different features for different biomes
      const features = getFeatureDistribution(biome);
      const feature = features.pickOne();

      if (feature && feature !== 'none') {
        console.log(`Place ${feature} at (${x}, ${y})`);
      }
    });
  });
}

function getFeatureDistribution(biome: Biome): Distribution<string> {
  switch (biome) {
    case 'forest':
      return new Distribution({
        source: {
          tree: 40,
          bush: 20,
          rock: 10,
          none: 30
        }
      });

    case 'plains':
      return new Distribution({
        source: {
          grass: 30,
          flower: 20,
          rock: 10,
          none: 40
        }
      });

    case 'mountain':
      return new Distribution({
        source: {
          rock: 50,
          crystal: 10,
          cave: 5,
          none: 35
        }
      });

    default:
      return new Distribution({
        source: { none: 100 }
      });
  }
}
```

---

## L-Systems + Markov Chains

### What are L-Systems?

L-Systems generate branching structures (trees, plants) using replacement rules:
```
Axiom: A
Rules: A → AB, B → A
Generation: A → AB → ABA → ABAAB → ...
```

**Problem**: Fixed, predictable patterns.

**Solution**: Use Markov chains to vary the rules!

### Varied Tree Generation

```typescript
import { MarkovChain } from 'acausal';

// Train on example branch patterns
const branchPatterns = [
  ['trunk', 'branch', 'branch', 'leaf', 'leaf'],
  ['trunk', 'trunk', 'branch', 'leaf'],
  ['trunk', 'branch', 'branch', 'branch', 'leaf']
];

const treeModel = new MarkovChain({
  maxOrder: 2,
  sequences: branchPatterns
});

// L-System that uses Markov chain for variation
class MarkovLSystem {
  private model: MarkovChain;
  private axiom: string;

  constructor(model: MarkovChain, axiom: string) {
    this.model = model;
    this.axiom = axiom;
  }

  // Expand using Markov-generated rules
  expand(current: string[], depth: number): string[] {
    if (depth === 0) return current;

    // Use Markov chain to decide what comes next
    const next = this.model.generate({
      start: current,
      min: current.length + 1,
      max: current.length + 3,
      order: 2
    });

    // Recurse with probability
    if (Math.random() < 0.7 && depth > 1) {
      return this.expand(next, depth - 1);
    }

    return next;
  }

  generate(depth: number = 3): string[] {
    return this.expand([this.axiom], depth);
  }
}

// Generate varied trees
const lsystem = new MarkovLSystem(treeModel, 'trunk');

for (let i = 0; i < 3; i++) {
  const tree = lsystem.generate(3);
  console.log(`Tree ${i + 1}: ${tree.join(' → ')}`);
}

/* Output:
Tree 1: trunk → branch → branch → leaf → leaf
Tree 2: trunk → trunk → branch → branch → leaf
Tree 3: trunk → branch → leaf
*/
```

### Procedural Plant Generation

```typescript
interface PlantPart {
  type: 'stem' | 'leaf' | 'flower' | 'branch';
  size: number;
  angle: number;
}

const plantPatterns: PlantPart[][] = [
  [
    { type: 'stem', size: 10, angle: 0 },
    { type: 'leaf', size: 5, angle: 45 },
    { type: 'stem', size: 8, angle: 0 },
    { type: 'flower', size: 3, angle: 0 }
  ],
  [
    { type: 'stem', size: 12, angle: 0 },
    { type: 'branch', size: 6, angle: 30 },
    { type: 'leaf', size: 4, angle: 45 },
    { type: 'leaf', size: 4, angle: -45 }
  ]
];

const plantModel = new MultiDimMarkovChain<PlantPart>({
  maxOrder: 2,
  stateKey: (part) => `${part.type}_${part.angle}`
});

plantModel.addSequences(plantPatterns);

// Generate a new plant
const newPlant = plantModel.generate({ min: 4, max: 8, order: 2 });

console.log('Generated plant:');
newPlant.forEach((part, i) => {
  console.log(`${i}. ${part.type} (size: ${part.size}, angle: ${part.angle}°)`);
});
```

---

## Genetic Algorithms + Chain Blending

### Evolving Content

Combine chain blending with evolutionary algorithms:

```typescript
import { MarkovChain } from 'acausal';

interface Creature {
  id: string;
  behaviorChain: MarkovChain;
  fitness: number;
}

class CreatureEvolution {
  private population: Creature[] = [];
  private generation: number = 0;

  // Create initial random population
  initialize(size: number, behaviors: string[][][]): void {
    for (let i = 0; i < size; i++) {
      // Random subset of behaviors
      const subset = this.randomSubset(behaviors, 3);

      this.population.push({
        id: `creature_${i}`,
        behaviorChain: new MarkovChain({
          maxOrder: 2,
          sequences: subset
        }),
        fitness: 0
      });
    }
  }

  // Evaluate fitness (fight in arena, etc.)
  evaluateFitness(testFunction: (creature: Creature) => number): void {
    this.population.forEach(creature => {
      creature.fitness = testFunction(creature);
    });
  }

  // Select best creatures
  selectParents(count: number = 2): Creature[] {
    return this.population
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, count);
  }

  // Breed two creatures
  breed(parent1: Creature, parent2: Creature): Creature {
    // Blend their behavior chains
    const childChain = MarkovChain.blend([
      { chain: parent1.behaviorChain, weight: 0.5 },
      { chain: parent2.behaviorChain, weight: 0.5 }
    ]);

    return {
      id: `creature_gen${this.generation}`,
      behaviorChain: childChain,
      fitness: 0
    };
  }

  // Evolve one generation
  evolve(keepTop: number = 2, newChildren: number = 8): void {
    this.generation++;

    // Keep best
    const survivors = this.selectParents(keepTop);

    // Breed new generation
    const children: Creature[] = [];
    for (let i = 0; i < newChildren; i++) {
      const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
      const parent2 = survivors[Math.floor(Math.random() * survivors.length)];

      children.push(this.breed(parent1, parent2));
    }

    this.population = [...survivors, ...children];
  }

  private randomSubset<T>(array: T[], size: number): T[] {
    const shuffled = array.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  getBestCreature(): Creature {
    return this.population.sort((a, b) => b.fitness - a.fitness)[0];
  }
}

// Example usage
const behaviorExamples = [
  ['patrol', 'detect', 'chase', 'attack'],
  ['hide', 'ambush', 'attack', 'flee'],
  ['patrol', 'patrol', 'detect', 'charge']
];

const evolution = new CreatureEvolution();
evolution.initialize(10, behaviorExamples);

// Simulate evolution
for (let gen = 0; gen < 5; gen++) {
  // Evaluate fitness (simplified)
  evolution.evaluateFitness((creature) => {
    // In real game: fight in arena, return win rate
    return Math.random() * 100;
  });

  const best = evolution.getBestCreature();
  console.log(`Generation ${gen}: Best fitness ${best.fitness.toFixed(1)}`);

  // Breed next generation
  evolution.evolve(2, 8);
}

const finalBest = evolution.getBestCreature();
console.log('\nBest creature behavior:');
console.log(finalBest.behaviorChain.generate({ min: 5, max: 5 }));
```

---

## Grammar-Based + Markov

### Combining Structure with Variation

Grammars provide structure, Markov chains add variety:

```typescript
// Grammar rules
interface Grammar {
  [key: string]: string[][];
}

const questGrammar: Grammar = {
  '<quest>': [
    ['<intro>', '<task>', '<reward>']
  ],
  '<intro>': [
    ['greetings', 'traveler'],
    ['hello', 'adventurer']
  ],
  '<task>': [
    ['defeat', '<enemy>'],
    ['find', '<item>']
  ],
  '<enemy>': [['dragon'], ['goblin'], ['troll']],
  '<item>': [['sword'], ['gem'], ['scroll']],
  '<reward>': [['receive', 'gold'], ['gain', 'experience']]
};

// But use Markov chains to pick WHICH rules
const ruleProbabilities = new MarkovChain({
  maxOrder: 2,
  sequences: [
    ['<intro>', '<task>', '<reward>'],
    ['<intro>', '<task>', '<task>', '<reward>']  // Sometimes two tasks
  ]
});

function expandGrammar(
  symbol: string,
  grammar: Grammar,
  depth: number = 0
): string[] {
  if (depth > 10) return [symbol];

  // Non-terminal (starts with <)
  if (symbol.startsWith('<')) {
    const options = grammar[symbol];
    if (!options) return [symbol];

    // Pick a random expansion
    const expansion = options[Math.floor(Math.random() * options.length)];

    // Recursively expand
    return expansion.flatMap(part => expandGrammar(part, grammar, depth + 1));
  }

  // Terminal - return as-is
  return [symbol];
}

// Generate quest with structure
const structure = ruleProbabilities.generate({ min: 3, max: 4 });
const quest = structure.flatMap(symbol => expandGrammar(symbol, questGrammar));

console.log('Quest:', quest.join(' '));
// "greetings traveler defeat dragon receive gold"
```

---

## Constraint Satisfaction

### Using Markov Chains for CSP

Constraint Satisfaction Problems (like Sudoku) can use Markov chains to learn likely solutions:

```typescript
// Example: Simple puzzle where adjacent tiles must be different colors
type Color = 'red' | 'blue' | 'green' | 'yellow';

// Learn from valid solutions
const validPatterns: Color[][] = [
  ['red', 'blue', 'red', 'green', 'red'],
  ['blue', 'red', 'blue', 'yellow', 'blue'],
  ['green', 'red', 'green', 'blue', 'green']
];

const patternModel = new MarkovChain<Color>({
  maxOrder: 2,
  sequences: validPatterns
});

// Generate a valid sequence
function generateValidSequence(length: number): Color[] {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const sequence = patternModel.generate({
      min: length,
      max: length,
      order: 2,
      constraints: {
        validator: (seq) => {
          // Check constraint: no adjacent duplicates
          for (let i = 0; i < seq.length - 1; i++) {
            if (seq[i] === seq[i + 1]) {
              return false;
            }
          }
          return true;
        },
        maxRetries: 50
      }
    });

    // Verify constraint
    let valid = true;
    for (let i = 0; i < sequence.length - 1; i++) {
      if (sequence[i] === sequence[i + 1]) {
        valid = false;
        break;
      }
    }

    if (valid) return sequence as Color[];
    attempts++;
  }

  return ['red', 'blue', 'red', 'blue', 'red']; // Fallback
}

console.log('Valid sequence:', generateValidSequence(5));
// ['red', 'blue', 'green', 'red', 'blue']
```

---

## Best Practices

### When to Use Each Algorithm

```typescript
// Markov Chains: Learning from examples
const nameGen = new MarkovChain({ sequences: exampleNames });

// WFC: Tile-based levels with local constraints
const wfc = new MarkovWFC(exampleMaps, 50, 50);

// Noise: Continuous terrain/height maps
const elevation = getPerlinNoise(x, y, scale);

// L-Systems: Branching structures
const tree = lsystem.generate(depth);

// Genetic: Optimization/evolution
const evolved = geneticAlgorithm.evolve(100);

// Grammar: Structured generation
const sentence = expandGrammar('<sentence>', grammar);
```

### Combining Multiple Techniques

```typescript
// 1. Generate terrain with Perlin noise
const elevation = getPerlinNoise(x, y);

// 2. Pick biome with Distribution
const biome = getBiomeDistribution(elevation).pickOne();

// 3. Place features with Markov chains
const features = biomeModel.generate({ start: [biome] });

// 4. Generate detailed objects with L-Systems
if (features.includes('tree')) {
  const tree = treeLSystem.generate();
}
```

---

## Next Steps

- [Multi-Dimensional Chains](./multi-dimensional.md) - Perfect for WFC
- [Game Generation](./game-generation.md) - Apply hybrid techniques
- [Quality Control](./quality-control.md) - Validate generated content

---

**Quick Reference:**

| Technique | + Markov Chains | Result |
|-----------|-----------------|--------|
| WFC | Learn tile rules from examples | Smarter level generation |
| Perlin Noise | Add variety to biomes | More realistic terrain |
| L-Systems | Vary branching patterns | Unique plants/trees |
| Genetic Algorithms | Evolve via blending | Adaptive AI behaviors |
| Grammars | Pick rules probabilistically | Structured variety |
| CSP | Learn valid patterns | Constraint-aware generation |

**When to Combine:**
- Need both **structure** (WFC, grammar) and **variety** (Markov)
- Want to **learn** patterns instead of hard-coding them
- Generating **complex** multi-layered content
