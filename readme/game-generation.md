# Procedural Generation for Games

This guide shows you how to use _acausal_ for common game development tasks like generating names, quests, dialogue, and more.

## Table of Contents

- [Character Name Generation](#character-name-generation)
- [Quest Generation](#quest-generation)
- [Dialogue Generation](#dialogue-generation)
- [Dungeon Layout Generation](#dungeon-layout-generation)
- [Weather Pattern Generation](#weather-pattern-generation)
- [Performance Tips](#performance-tips)

---

## Character Name Generation

### The Basics

Let's say you're making an RPG and need to generate fantasy character names. You have a list of names you like, and want to create new ones that sound similar.

```typescript
import { MarkovChain } from 'acausal';

// Names you like from your game world
const fantasyNames = [
  'aldrin', 'elara', 'thorne', 'kaida', 'drakon',
  'seraphina', 'mordred', 'lyanna', 'raven', 'theron'
];

// Split names into letters
const nameSequences = fantasyNames.map(name => name.split(''));

// Create a name generator
const nameGenerator = new MarkovChain({
  seed: 42,        // Use same seed for consistent results
  maxOrder: 2,     // Look at pairs of letters
  sequences: nameSequences
});

// Generate 5 new names
for (let i = 0; i < 5; i++) {
  const name = nameGenerator.generate({
    min: 4,      // At least 4 letters
    max: 10,     // No more than 10 letters
    order: 2     // Use bigrams (pairs of letters)
  });

  console.log(name.join(''));
}

/* Sample output:
throne
sera
kaid
elyn
draven
*/
```

**What's happening here?**

The Markov chain learns which letters commonly follow other letters. For example:
- "th" is often followed by "o" or "e"
- "a" at the end of names is often preceded by "r" or "n"

By learning these patterns, it creates new names that *feel* like they belong in your game world.

### Making Better Names

Sometimes you'll get names that don't sound quite right. Here's how to improve them:

#### 1. Filter Out Bad Results

```typescript
// Generate names until you get a good one
function generateGoodName(generator: MarkovChain, minLength = 5): string {
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    const name = generator.generate({ min: minLength, max: 10, order: 2 });
    const nameStr = name.join('');

    // Skip names that are too short or have weird letter combos
    if (nameStr.length >= minLength && !nameStr.match(/[xqz]{2,}/)) {
      return nameStr;
    }
  }

  // Fallback to any valid name
  return generator.generate({ min: minLength, max: 10, order: 2 }).join('');
}

const goodName = generateGoodName(nameGenerator, 5);
console.log(goodName); // "serath"
```

#### 2. Use Constraints (v3.4+)

Instead of manually filtering, let the generator enforce rules:

```typescript
const constrainedName = nameGenerator.generate({
  min: 5,
  max: 10,
  order: 2,
  constraints: {
    minLength: 5,
    maxLength: 10,
    pattern: /^[a-z]+$/,              // Only lowercase letters
    mustNotContain: ['xx', 'qq'],     // No double x's or q's
    validator: (seq) => {
      const name = seq.join('');
      // Make sure name has at least one vowel
      return /[aeiou]/.test(name);
    }
  }
});

console.log(constrainedName.join('')); // Always meets your requirements!
```

### Different Cultures, Different Names

Want names for different cultures in your game? Train separate generators:

```typescript
// Elven names (flowing, lots of vowels)
const elvenNames = ['elara', 'aelwyn', 'faelorn', 'elowen', 'aerin'];
const elvenGenerator = new MarkovChain({
  maxOrder: 2,
  sequences: elvenNames.map(n => n.split(''))
});

// Dwarven names (harsh, lots of consonants)
const dwarfNames = ['thorin', 'dwalin', 'balin', 'gimli', 'durin'];
const dwarfGenerator = new MarkovChain({
  maxOrder: 2,
  sequences: dwarfNames.map(n => n.split(''))
});

console.log('Elf:', elvenGenerator.generate({ max: 10 }).join(''));   // "aerwyn"
console.log('Dwarf:', dwarfGenerator.generate({ max: 10 }).join('')); // "thori"
```

### Half-Breeds: Blending Name Generators (v3.1+)

What if you have a half-elf character? Blend the two generators:

```typescript
// Create a half-elf name generator: 60% elf, 40% dwarf
const halfElfGenerator = MarkovChain.blend([
  { chain: elvenGenerator, weight: 0.6 },
  { chain: dwarfGenerator, weight: 0.4 }
]);

console.log('Half-Elf:', halfElfGenerator.generate({ max: 10 }).join(''));
// "thaerin" - has both elven flow and dwarven strength!
```

This is perfect for:
- **Half-breeds** - Mix parent race name styles
- **Cultural mixing** - Characters from border regions
- **Evolution** - Show how cultures blend over time

---

## Quest Generation

### Simple Quest Chains

Your players need quests! Let's generate quest progressions that make sense:

```typescript
// Common quest patterns in your game
const questPatterns = [
  ['talk', 'travel', 'fight', 'return', 'reward'],
  ['talk', 'gather', 'craft', 'deliver', 'reward'],
  ['talk', 'travel', 'investigate', 'fight', 'return', 'reward'],
  ['talk', 'escort', 'defend', 'return', 'reward'],
  ['talk', 'find', 'return', 'reward']
];

const questGenerator = new MarkovChain({
  maxOrder: 2,
  sequences: questPatterns
});

// Generate a new quest chain
const newQuest = questGenerator.generate({ min: 4, max: 7, order: 2 });
console.log('Quest steps:', newQuest);
// ['talk', 'travel', 'investigate', 'return', 'reward']
```

### Making Quests Interesting

Basic quest generation is useful, but sometimes you get repetitive quests. Here's how to add variety:

#### Add Quest Details

```typescript
interface QuestStep {
  action: string;
  detail?: string;
}

// Expand quest steps with details
const questActions = ['talk', 'travel', 'fight', 'gather', 'return'];
const questGenerator = new MarkovChain<string>({
  maxOrder: 2,
  sequences: questPatterns
});

// Generate the quest structure
const questStructure = questGenerator.generate({ min: 4, max: 6, order: 2 });

// Add details to each step
const npcNames = ['Elder Marcus', 'Blacksmith Hilda', 'Guard Captain'];
const locations = ['the Dark Forest', 'the Ancient Ruins', 'the Mountain Pass'];
const enemies = ['goblins', 'bandits', 'wolves'];
const items = ['herbs', 'crystals', 'ancient scrolls'];

function addQuestDetails(structure: string[]): QuestStep[] {
  return structure.map(action => {
    switch (action) {
      case 'talk':
        return {
          action,
          detail: npcNames[Math.floor(Math.random() * npcNames.length)]
        };
      case 'travel':
        return {
          action,
          detail: locations[Math.floor(Math.random() * locations.length)]
        };
      case 'fight':
        return {
          action,
          detail: enemies[Math.floor(Math.random() * enemies.length)]
        };
      case 'gather':
        return {
          action,
          detail: items[Math.floor(Math.random() * items.length)]
        };
      default:
        return { action };
    }
  });
}

const detailedQuest = addQuestDetails(questStructure);
console.log(detailedQuest);
/* Output:
[
  { action: 'talk', detail: 'Elder Marcus' },
  { action: 'travel', detail: 'the Dark Forest' },
  { action: 'fight', detail: 'goblins' },
  { action: 'return' },
  { action: 'reward' }
]
*/
```

#### Generate Quest Dialogue

Once you have quest steps, generate dialogue that matches:

```typescript
// Example dialogue for quest givers
const questIntros = [
  "greetings traveler i need your help".split(' '),
  "ah perfect timing i have a job for you".split(' '),
  "well met friend i require assistance".split(' '),
  "thank goodness you are here we need aid".split(' ')
];

const dialogueGen = new MarkovChain({
  maxOrder: 2,
  sequences: questIntros
});

const greeting = dialogueGen.generate({ min: 5, max: 10, order: 2 });
console.log(greeting.join(' '));
// "well met traveler i need aid"
```

---

## Dialogue Generation

### NPC Personality Through Dialogue

Different NPCs should talk differently. Let's create distinct personalities:

```typescript
// Gruff warrior dialogue
const warriorDialogue = [
  "fight well and survive".split(' '),
  "strength wins battles always remember".split(' '),
  "no mercy for the weak".split(' '),
  "train hard fight harder".split(' ')
];

// Wise wizard dialogue
const wizardDialogue = [
  "knowledge is power young one".split(' '),
  "study the ancient texts carefully".split(' '),
  "magic flows through all things".split(' '),
  "wisdom comes with patience".split(' ')
];

const warriorGen = new MarkovChain({ maxOrder: 2, sequences: warriorDialogue });
const wizardGen = new MarkovChain({ maxOrder: 2, sequences: wizardDialogue });

console.log('Warrior:', warriorGen.generate({ min: 3, max: 7 }).join(' '));
// "strength wins remember"

console.log('Wizard:', wizardGen.generate({ min: 4, max: 8 }).join(' '));
// "wisdom comes with ancient knowledge"
```

### Context-Aware Dialogue

Want NPCs to react to game state? Use scoring to pick appropriate lines:

```typescript
// Train on different emotional states
const happyDialogue = [
  "what a wonderful day this is".split(' '),
  "i feel great today friend".split(' '),
  "everything is going well".split(' ')
];

const sadDialogue = [
  "these are dark times indeed".split(' '),
  "i fear for our future".split(' '),
  "nothing good comes anymore".split(' ')
];

const happyGen = new MarkovChain({ maxOrder: 2, sequences: happyDialogue });
const sadGen = new MarkovChain({ maxOrder: 2, sequences: sadDialogue });

// Generate candidates and score them
function getBestDialogue(
  generator: MarkovChain,
  mood: 'happy' | 'sad',
  count: number = 5
): string {
  const candidates: string[][] = [];

  // Generate multiple options
  for (let i = 0; i < count; i++) {
    candidates.push(generator.generate({ min: 4, max: 8, order: 2 }));
  }

  // Score them (higher score = more typical of training data)
  const scored = generator.rankByLikelihood(candidates);

  // Return the best one
  return scored[0].sequence.join(' ');
}

// NPC mood changes based on game events
const npcMood = 'happy'; // or 'sad' based on game state

if (npcMood === 'happy') {
  console.log(getBestDialogue(happyGen, 'happy'));
  // "what a wonderful day friend"
} else {
  console.log(getBestDialogue(sadGen, 'sad'));
  // "these are dark times indeed"
}
```

---

## Dungeon Layout Generation

### Room Sequences

Generate logical dungeon layouts where rooms flow naturally:

```typescript
// Common room progressions in your dungeons
const dungeonLayouts = [
  ['entrance', 'corridor', 'chamber', 'corridor', 'boss'],
  ['entrance', 'corridor', 'trap', 'chamber', 'treasure'],
  ['entrance', 'chamber', 'corridor', 'puzzle', 'treasure'],
  ['entrance', 'corridor', 'chamber', 'corridor', 'chamber', 'boss']
];

const dungeonGen = new MarkovChain({
  maxOrder: 2,
  sequences: dungeonLayouts
});

// Generate a new dungeon layout
const layout = dungeonGen.generate({ min: 5, max: 8, order: 2 });
console.log('Dungeon:', layout);
// ['entrance', 'corridor', 'chamber', 'corridor', 'boss']
```

### Multi-Dimensional Dungeons (v3.3+)

For more complex dungeons with attributes like danger level and loot:

```typescript
import { MultiDimMarkovChain } from 'acausal';

interface DungeonRoom {
  type: string;
  danger: number;
  loot: string;
}

// Example room progressions with full attributes
const complexLayouts: DungeonRoom[][] = [
  [
    { type: 'entrance', danger: 1, loot: 'none' },
    { type: 'corridor', danger: 2, loot: 'common' },
    { type: 'chamber', danger: 4, loot: 'rare' },
    { type: 'boss', danger: 8, loot: 'legendary' }
  ],
  [
    { type: 'entrance', danger: 1, loot: 'none' },
    { type: 'trap', danger: 3, loot: 'common' },
    { type: 'puzzle', danger: 2, loot: 'rare' },
    { type: 'treasure', danger: 5, loot: 'legendary' }
  ]
];

// Create a multi-dimensional chain
const complexDungeonGen = new MultiDimMarkovChain<DungeonRoom>({
  maxOrder: 2,
  // Define how to convert room objects to unique keys
  stateKey: (room) => `${room.type}_${room.danger}_${room.loot}`
});

// Add training data
complexDungeonGen.addSequences(complexLayouts);

// Generate a new dungeon that maintains attribute relationships
const newDungeon = complexDungeonGen.generate({ min: 4, max: 7, order: 2 });

newDungeon.forEach((room, i) => {
  console.log(`Room ${i + 1}: ${room.type} (Danger: ${room.danger}, Loot: ${room.loot})`);
});

/* Output:
Room 1: entrance (Danger: 1, Loot: none)
Room 2: corridor (Danger: 2, Loot: common)
Room 3: chamber (Danger: 4, Loot: rare)
Room 4: boss (Danger: 8, Loot: legendary)
*/
```

**Why is this useful?**

The multi-dimensional chain ensures that:
- Boss rooms have high danger levels
- Treasure rooms appear after dangerous encounters
- Difficulty progresses naturally
- Loot quality matches room danger

---

## Weather Pattern Generation

### Daily Weather Cycles

Create realistic weather that changes over time:

```typescript
// Week-long weather patterns
const weatherPatterns = [
  ['sunny', 'sunny', 'cloudy', 'rainy', 'cloudy', 'sunny', 'sunny'],
  ['cloudy', 'rainy', 'rainy', 'cloudy', 'sunny', 'sunny', 'cloudy'],
  ['sunny', 'cloudy', 'cloudy', 'rainy', 'stormy', 'rainy', 'cloudy'],
  ['sunny', 'sunny', 'sunny', 'cloudy', 'cloudy', 'sunny', 'sunny']
];

const weatherGen = new MarkovChain({
  maxOrder: 2,
  sequences: weatherPatterns
});

// Generate next week's weather
const forecast = weatherGen.generate({ min: 7, max: 7, order: 2 });
console.log('7-day forecast:', forecast);
// ['sunny', 'sunny', 'cloudy', 'rainy', 'cloudy', 'sunny', 'sunny']
```

### Seasonal Weather (Scaled States v3.2+)

Want weather with intensity? Use scaled states:

```typescript
import { ScaledMarkovChain } from 'acausal';

// Weather with intensity values
const weatherWithIntensity = [
  [
    { category: 'sunny', magnitude: 25 },      // 25°C
    { category: 'cloudy', magnitude: 22 },     // 22°C
    { category: 'rainy', magnitude: 18 },      // 18°C
    { category: 'sunny', magnitude: 26 }       // 26°C
  ],
  [
    { category: 'cloudy', magnitude: 20 },
    { category: 'rainy', magnitude: 16 },
    { category: 'stormy', magnitude: 15 },
    { category: 'cloudy', magnitude: 17 }
  ]
];

const scaledWeatherGen = new ScaledMarkovChain<'sunny' | 'cloudy' | 'rainy' | 'stormy'>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'  // Average the temperatures
});

// Add weather data
weatherWithIntensity.forEach(week => {
  scaledWeatherGen.addScaledSequence(week);
});

// Generate weather with temperatures
const weatherForecast = scaledWeatherGen.generateScaled({ min: 5, max: 5, order: 2 });

weatherForecast.forEach((weather, i) => {
  console.log(`Day ${i + 1}: ${weather.category}, ${Math.round(weather.magnitude)}°C`);
});

/* Output:
Day 1: sunny, 25°C
Day 2: cloudy, 21°C
Day 3: rainy, 17°C
Day 4: cloudy, 19°C
Day 5: sunny, 24°C
*/
```

**Real-world use:**
- Temperature affects NPC behavior
- Crops grow based on weather
- Player movement speed in rain
- Combat difficulty in storms

---

## Performance Tips

### Use Batch Operations for Large Datasets

If you're loading hundreds of names or quests during game startup:

```typescript
// ❌ Slow - clones the model for each add
let nameGen = new MarkovChain({ maxOrder: 2 });
for (const name of thousandsOfNames) {
  nameGen = nameGen.addSequence(name.split(''));
}

// ✅ Fast - single clone at the end (40% faster!)
const nameGen = new MarkovChain({ maxOrder: 2 });
const updated = nameGen.batch()
  .addSequences(thousandsOfNames.map(n => n.split('')))
  .commit();
```

### Pre-generate Content

Don't generate during gameplay - generate ahead of time:

```typescript
// During loading screen
const nameCache: string[] = [];
for (let i = 0; i < 100; i++) {
  nameCache.push(nameGenerator.generate({ max: 10 }).join(''));
}

// During gameplay - instant!
function getRandomName(): string {
  if (nameCache.length === 0) {
    // Refill cache
    for (let i = 0; i < 100; i++) {
      nameCache.push(nameGenerator.generate({ max: 10 }).join(''));
    }
  }
  return nameCache.pop()!;
}
```

### Serialize and Load

Save trained generators to avoid retraining:

```typescript
// Save during development/first run
const trained = new MarkovChain({
  maxOrder: 2,
  sequences: trainingData
});

const serialized = trained.serialize();
// Save to file: fs.writeFileSync('names.json', JSON.stringify(serialized));

// Load during game startup
// const loaded = JSON.parse(fs.readFileSync('names.json', 'utf8'));
const generator = new MarkovChain(loaded);

// Instant generation, no training needed!
const name = generator.generate({ max: 10 }).join('');
```

---

## Next Steps

- [Loot Systems](./loot-systems.md) - Generate loot drops, item stats, and rewards
- [Chain Blending](./chain-blending.md) - Mix generators for hybrid content
- [Advanced Features](./advanced.md) - Scoring, constraints, and pattern analysis

---

**Quick Reference:**

| Task | Method | Best Order |
|------|--------|------------|
| Names | `generate()` | 2-3 |
| Dialogue | `generate()` | 2-3 |
| Quest chains | `generate()` | 1-2 |
| Room layouts | `generate()` | 1-2 |
| Weather | `generate()` or `ScaledMarkovChain` | 1-2 |

**Rule of Thumb:**
- Order 1: Simple sequences (quests, rooms)
- Order 2: Text generation (names, dialogue)
- Order 3+: Complex patterns (rarely needed for games)
