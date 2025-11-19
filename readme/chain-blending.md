# Chain Blending and Interpolation

**New in v3.1+**

This guide shows you how to mix and blend Markov chains together - perfect for creating hybrid characters, combining cultural styles, or evolving content over time.

## Table of Contents

- [What is Chain Blending?](#what-is-chain-blending)
- [Genetic Traits (Character Breeding)](#genetic-traits-character-breeding)
- [Cultural Mixing](#cultural-mixing)
- [Content Evolution](#content-evolution)
- [Advanced Blending Strategies](#advanced-blending-strategies)
- [Practical Examples](#practical-examples)

---

## What is Chain Blending?

Think of chain blending like mixing paint colors. If you have:
- A "red" generator (trained on red things)
- A "blue" generator (trained on blue things)

You can blend them to create a "purple" generator that combines both styles.

### Simple Example

```typescript
import { MarkovChain } from 'acausal';

// Mother's name style (soft, flowing)
const motherNames = ['aria', 'elena', 'sophia', 'luna', 'lyra'];
const motherGen = new MarkovChain({
  maxOrder: 2,
  sequences: motherNames.map(n => n.split(''))
});

// Father's name style (strong, harsh)
const fatherNames = ['thor', 'knox', 'drake', 'wolf', 'stone'];
const fatherGen = new MarkovChain({
  maxOrder: 2,
  sequences: fatherNames.map(n => n.split(''))
});

// Child's name (50% mother, 50% father)
const childGen = MarkovChain.blend([
  { chain: motherGen, weight: 0.5 },
  { chain: fatherGen, weight: 0.5 }
]);

console.log('Child name:', childGen.generate({ max: 10 }).join(''));
// "drana" - combines both styles!
```

**How it works:**
- At each step, the blended chain looks at both parents
- It averages their probabilities
- The result feels like a mix of both styles

---

## Genetic Traits (Character Breeding)

### Basic Character Breeding

Let's create a full breeding system for game characters:

```typescript
interface Character {
  name: string;
  hairColor: string;
  eyeColor: string;
  personality: string[];
}

// Parent characters
const mother: Character = {
  name: 'Elena',
  hairColor: 'blonde',
  eyeColor: 'blue',
  personality: ['kind', 'gentle', 'wise', 'calm']
};

const father: Character = {
  name: 'Drake',
  hairColor: 'black',
  eyeColor: 'brown',
  personality: ['brave', 'strong', 'fierce', 'bold']
};

// Train on each parent's traits
const motherPersonality = new MarkovChain({
  maxOrder: 1,
  sequences: [mother.personality]
});

const fatherPersonality = new MarkovChain({
  maxOrder: 1,
  sequences: [father.personality]
});

// Blend personalities (60% mother, 40% father)
const childPersonality = MarkovChain.blend([
  { chain: motherPersonality, weight: 0.6 },
  { chain: fatherPersonality, weight: 0.4 }
]);

// Generate child's personality
const childTraits = childPersonality.generate({ min: 3, max: 4, order: 1 });
console.log('Child personality:', childTraits);
// ['kind', 'brave', 'gentle', 'strong']
// Mix of both parents!
```

### Eye Color Inheritance

```typescript
import { Distribution } from 'acausal';

// Eye color is simpler - use Distribution
function blendEyeColor(parent1Color: string, parent2Color: string): string {
  // Genetics: some colors are dominant
  const genetics = {
    'brown': 3,  // Dominant
    'blue': 1,   // Recessive
    'green': 2   // In between
  };

  const combined = new Distribution({
    source: {
      [parent1Color]: genetics[parent1Color] || 1,
      [parent2Color]: genetics[parent2Color] || 1
    }
  });

  return combined.pickOne()!;
}

console.log('Child eye color:', blendEyeColor('blue', 'brown'));
// Usually 'brown' (dominant), sometimes 'blue'
```

### Complete Breeding System

```typescript
class CharacterBreeder {
  breedCharacters(mother: Character, father: Character): Character {
    // Blend names
    const motherNameGen = this.trainNameGenerator([mother.name]);
    const fatherNameGen = this.trainNameGenerator([father.name]);

    const nameGen = MarkovChain.blend([
      { chain: motherNameGen, weight: 0.5 },
      { chain: fatherNameGen, weight: 0.5 }
    ]);

    const name = nameGen.generate({ min: 4, max: 10 }).join('');

    // Blend personalities
    const motherPersonality = new MarkovChain({
      maxOrder: 1,
      sequences: [mother.personality]
    });

    const fatherPersonality = new MarkovChain({
      maxOrder: 1,
      sequences: [father.personality]
    });

    const personalityGen = MarkovChain.blend([
      { chain: motherPersonality, weight: 0.5 },
      { chain: fatherPersonality, weight: 0.5 }
    ]);

    const personality = personalityGen.generate({ min: 3, max: 5, order: 1 });

    // Simple traits (pick randomly)
    const hairColor = Math.random() < 0.5 ? mother.hairColor : father.hairColor;
    const eyeColor = blendEyeColor(mother.eyeColor, father.eyeColor);

    return {
      name,
      hairColor,
      eyeColor,
      personality
    };
  }

  private trainNameGenerator(names: string[]): MarkovChain {
    return new MarkovChain({
      maxOrder: 2,
      sequences: names.map(n => n.toLowerCase().split(''))
    });
  }
}

// Use it
const breeder = new CharacterBreeder();
const child = breeder.breedCharacters(mother, father);

console.log('New character:', child);
/*
{
  name: 'elake',
  hairColor: 'black',
  eyeColor: 'brown',
  personality: ['kind', 'brave', 'wise', 'bold']
}
*/
```

### Multiple Generations

What about grandchildren? Breed the children!

```typescript
// First generation
const child1 = breeder.breedCharacters(mother, father);

// Create another parent
const uncle: Character = {
  name: 'Orin',
  hairColor: 'red',
  eyeColor: 'green',
  personality: ['clever', 'quick', 'witty', 'sly']
};

// Second generation (child1 grows up and has kids)
const grandchild = breeder.breedCharacters(child1, uncle);
console.log('Grandchild:', grandchild);
// Traits from all three original characters!
```

---

## Cultural Mixing

### Regional Name Styles

Create names for border regions that mix two cultures:

```typescript
// Japanese-style names
const japaneseNames = [
  'akira', 'yuki', 'haru', 'sakura', 'kenji'
];

// Norse-style names
const norseNames = [
  'bjorn', 'erik', 'freya', 'ragnar', 'astrid'
];

// Train generators
const japaneseGen = new MarkovChain({
  maxOrder: 2,
  sequences: japaneseNames.map(n => n.split(''))
});

const norseGen = new MarkovChain({
  maxOrder: 2,
  sequences: norseNames.map(n => n.split(''))
});

// Border region: 70% Japanese, 30% Norse influence
const borderRegionGen = MarkovChain.blend([
  { chain: japaneseGen, weight: 0.7 },
  { chain: norseGen, weight: 0.3 }
]);

console.log('Border region names:');
for (let i = 0; i < 5; i++) {
  const name = borderRegionGen.generate({ min: 4, max: 8 }).join('');
  console.log('  -', name);
}

/* Output:
Border region names:
  - yurnar
  - harki
  - sakir
  - kenjorn
  - yufrey
*/
```

### Architecture Styles

Mix architectural elements for unique building designs:

```typescript
// Gothic architecture elements
const gothic = [
  ['tower', 'spire', 'arch', 'vault'],
  ['arch', 'column', 'buttress', 'spire'],
  ['vault', 'spire', 'tower', 'pinnacle']
];

// Japanese architecture elements
const japanese = [
  ['gate', 'garden', 'bridge', 'pagoda'],
  ['garden', 'pavilion', 'gate', 'bridge'],
  ['bridge', 'pagoda', 'garden', 'pavilion']
];

const gothicGen = new MarkovChain({ maxOrder: 1, sequences: gothic });
const japaneseGen = new MarkovChain({ maxOrder: 1, sequences: japanese });

// Blend architectural styles (50/50)
const fusionGen = MarkovChain.blend([
  { chain: gothicGen, weight: 0.5 },
  { chain: japaneseGen, weight: 0.5 }
]);

console.log('Fusion building design:');
console.log(fusionGen.generate({ min: 4, max: 6, order: 1 }));
// ['gate', 'spire', 'garden', 'vault', 'pagoda']
// Gothic spires mixed with Japanese gardens!
```

---

## Content Evolution

### Music Evolution Over Centuries

Show how music styles evolve over time:

```typescript
// 1700s: Baroque music (structured, formal)
const baroque = [
  ['prelude', 'fugue', 'canon', 'suite'],
  ['suite', 'minuet', 'prelude', 'fugue']
];

// 1800s: Romantic music (emotional, free-form)
const romantic = [
  ['sonata', 'nocturne', 'fantasy', 'rhapsody'],
  ['prelude', 'nocturne', 'fantasy', 'waltz']
];

// 1900s: Modern music (experimental, varied)
const modern = [
  ['suite', 'improvisation', 'variation', 'etude'],
  ['fantasy', 'improvisation', 'tone poem', 'suite']
];

const baroqueGen = new MarkovChain({ maxOrder: 1, sequences: baroque });
const romanticGen = new MarkovChain({ maxOrder: 1, sequences: romantic });
const modernGen = new MarkovChain({ maxOrder: 1, sequences: modern });

// 1750: Late Baroque transitioning to Classical
// (75% Baroque, 25% Romantic)
const gen1750 = MarkovChain.blend([
  { chain: baroqueGen, weight: 0.75 },
  { chain: romanticGen, weight: 0.25 }
]);

// 1850: Peak Romantic
const gen1850 = romanticGen;

// 1950: Modern with Romantic influences
// (70% Modern, 30% Romantic)
const gen1950 = MarkovChain.blend([
  { chain: modernGen, weight: 0.7 },
  { chain: romanticGen, weight: 0.3 }
]);

console.log('1750 composition:', gen1750.generate({ min: 4, max: 4, order: 1 }));
// ['fugue', 'suite', 'nocturne', 'prelude']

console.log('1850 composition:', gen1850.generate({ min: 4, max: 4, order: 1 }));
// ['sonata', 'nocturne', 'fantasy', 'waltz']

console.log('1950 composition:', gen1950.generate({ min: 4, max: 4, order: 1 }));
// ['improvisation', 'fantasy', 'variation', 'nocturne']
```

### Language Evolution

Show how dialects emerge:

```typescript
// Original language
const originalLanguage = [
  ['hello', 'friend', 'how', 'are', 'you'],
  ['good', 'day', 'to', 'you', 'friend'],
  ['well', 'met', 'traveler', 'welcome']
];

// Northern dialect (harsh, abbreviated)
const northernDialect = [
  ['hail', 'kin', 'how', 'fare', 'thee'],
  ['well', 'met', 'how', 'goes', 'it'],
  ['greet', 'thee', 'kin', 'well', 'met']
];

const originalGen = new MarkovChain({ maxOrder: 2, sequences: originalLanguage });
const northernGen = new MarkovChain({ maxOrder: 2, sequences: northernDialect });

// Border settlement (mixed speech)
const borderSpeech = MarkovChain.blend([
  { chain: originalGen, weight: 0.6 },
  { chain: northernGen, weight: 0.4 }
]);

console.log('Border greeting:');
console.log(borderSpeech.generate({ min: 4, max: 6 }).join(' '));
// "hello kin how fare friend"
```

---

## Advanced Blending Strategies

### Different Blending Modes

```typescript
// Arithmetic mean (default) - averages probabilities
const avgBlend = MarkovChain.blend([
  { chain: motherGen, weight: 0.5 },
  { chain: fatherGen, weight: 0.5 }
], { strategy: 'arithmetic-mean' });

// Geometric mean - emphasizes agreement between chains
const geoBlend = MarkovChain.blend([
  { chain: motherGen, weight: 0.5 },
  { chain: fatherGen, weight: 0.5 }
], { strategy: 'geometric-mean' });

// Max - takes the highest probability
const maxBlend = MarkovChain.blend([
  { chain: motherGen, weight: 0.5 },
  { chain: fatherGen, weight: 0.5 }
], { strategy: 'max' });

// Min - takes the lowest probability (rare states only)
const minBlend = MarkovChain.blend([
  { chain: motherGen, weight: 0.5 },
  { chain: fatherGen, weight: 0.5 }
], { strategy: 'min' });
```

**When to use each:**

- **Arithmetic mean** (default): Balanced blending, good for most cases
- **Geometric mean**: When you want states that appear in BOTH parents (more conservative)
- **Max**: When you want the most likely state from either parent (more variety)
- **Min**: When you want only uncommon states (creates unusual combos)

### Filter Low-Probability States

Remove states that are too unlikely:

```typescript
// Only keep states with at least 5% probability in the blend
const cleanBlend = MarkovChain.blend([
  { chain: chain1, weight: 0.5 },
  { chain: chain2, weight: 0.5 }
], {
  minWeight: 0.05,  // Filter out states below 5%
  normalize: true    // Re-normalize after filtering
});
```

### Three-Way Blending

Blend more than two chains:

```typescript
// Blend from three grandparents
const grandmaGen = new MarkovChain({ maxOrder: 2, sequences: grandmaTraits });
const grandpa1Gen = new MarkovChain({ maxOrder: 2, sequences: grandpa1Traits });
const grandpa2Gen = new MarkovChain({ maxOrder: 2, sequences: grandpa2Traits });

const childGen = MarkovChain.blend([
  { chain: grandmaGen, weight: 0.4 },
  { chain: grandpa1Gen, weight: 0.3 },
  { chain: grandpa2Gen, weight: 0.3 }
]);
```

### Interpolation (Smooth Transitions)

For smooth transitions between two styles:

```typescript
// Interpolate between two chains (0.0 = all chain1, 1.0 = all chain2)
const chain1 = new MarkovChain({ sequences: style1Data });
const chain2 = new MarkovChain({ sequences: style2Data });

// 70% style1, 30% style2
const mixed = chain1.interpolate(chain2, 0.3);

// Same as:
// const mixed = MarkovChain.blend([
//   { chain: chain1, weight: 0.7 },
//   { chain: chain2, weight: 0.3 }
// ]);
```

---

## Practical Examples

### Evolving Enemy Types

Create enemy variations by blending base types:

```typescript
// Base enemy types
const goblinAttacks = [
  ['scratch', 'bite', 'dodge'],
  ['bite', 'scratch', 'flee'],
  ['dodge', 'bite', 'scratch']
];

const orcAttacks = [
  ['smash', 'charge', 'roar'],
  ['charge', 'smash', 'slam'],
  ['roar', 'charge', 'smash']
];

const goblinGen = new MarkovChain({ maxOrder: 1, sequences: goblinAttacks });
const orcGen = new MarkovChain({ maxOrder: 1, sequences: orcAttacks });

// Create a "Goblin Brute" (goblin + some orc strength)
const goblinBruteGen = MarkovChain.blend([
  { chain: goblinGen, weight: 0.7 },
  { chain: orcGen, weight: 0.3 }
]);

console.log('Goblin Brute attacks:');
console.log(goblinBruteGen.generate({ min: 3, max: 3, order: 1 }));
// ['bite', 'smash', 'dodge'] - fast like goblin, strong like orc!
```

### Player Class Specializations

Create hybrid classes:

```typescript
// Base classes
const warriorSkills = [
  ['attack', 'defend', 'charge'],
  ['defend', 'attack', 'shield'],
  ['charge', 'attack', 'defend']
];

const mageSkills = [
  ['fireball', 'shield', 'teleport'],
  ['shield', 'lightning', 'fireball'],
  ['teleport', 'fireball', 'shield']
];

const warriorGen = new MarkovChain({ maxOrder: 1, sequences: warriorSkills });
const mageGen = new MarkovChain({ maxOrder: 1, sequences: mageSkills });

// Spellblade (60% warrior, 40% mage)
const spellbladeGen = MarkovChain.blend([
  { chain: warriorGen, weight: 0.6 },
  { chain: mageGen, weight: 0.4 }
]);

console.log('Spellblade skills:');
console.log(spellbladeGen.generate({ min: 4, max: 4, order: 1 }));
// ['attack', 'fireball', 'defend', 'shield']
```

### Faction Relations

Show how factions merge or split:

```typescript
// Two allied factions
const faction1 = new MarkovChain({
  maxOrder: 2,
  sequences: faction1Names.map(n => n.split(''))
});

const faction2 = new MarkovChain({
  maxOrder: 2,
  sequences: faction2Names.map(n => n.split(''))
});

// When they form an alliance, their naming styles blend
const allianceGen = MarkovChain.blend([
  { chain: faction1, weight: 0.5 },
  { chain: faction2, weight: 0.5 }
]);

// Alliance members have blended names
const allianceName = allianceGen.generate({ max: 10 }).join('');
console.log('Alliance member:', allianceName);
```

---

## Performance Tips

### Cache Blended Chains

Blending is relatively fast, but if you're doing it repeatedly:

```typescript
class CharacterBreederWithCache {
  private blendCache = new Map<string, MarkovChain>();

  getBlendedChain(parent1Id: string, parent2Id: string): MarkovChain {
    const cacheKey = [parent1Id, parent2Id].sort().join('_');

    if (!this.blendCache.has(cacheKey)) {
      const parent1Gen = this.getParentChain(parent1Id);
      const parent2Gen = this.getParentChain(parent2Id);

      const blended = MarkovChain.blend([
        { chain: parent1Gen, weight: 0.5 },
        { chain: parent2Gen, weight: 0.5 }
      ]);

      this.blendCache.set(cacheKey, blended);
    }

    return this.blendCache.get(cacheKey)!;
  }

  private getParentChain(parentId: string): MarkovChain {
    // Load parent chain...
    return new MarkovChain({ maxOrder: 2 });
  }
}
```

---

## Next Steps

- [Game Generation](./game-generation.md) - Names, quests, dialogue
- [Loot Systems](./loot-systems.md) - Drops and item generation
- [Scaled States](./scaled-states.md) - States with magnitudes

---

**Quick Reference:**

| Use Case | Blend Ratio | Strategy |
|----------|-------------|----------|
| Balanced breeding | 50/50 | arithmetic-mean |
| Cultural border | 70/30 | arithmetic-mean |
| Rare combos only | Any | geometric-mean |
| Maximum variety | Any | max |
| Uncommon traits | Any | min |

**Blending Formula:**
```typescript
MarkovChain.blend([
  { chain: style1, weight: 0.6 },
  { chain: style2, weight: 0.4 }
], {
  strategy: 'arithmetic-mean',  // or 'geometric-mean', 'max', 'min'
  minWeight: 0.01,               // Filter low probabilities
  normalize: true                // Re-normalize after filtering
});
```
