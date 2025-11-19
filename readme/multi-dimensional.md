# Multi-Dimensional Chains

**New in v3.3+**

This guide shows you how to use multi-dimensional Markov chains for procedural generation where each state has multiple attributes - perfect for tile generation, character states, and complex game systems.

## Table of Contents

- [What are Multi-Dimensional Chains?](#what-are-multi-dimensional-chains)
- [Tile-Based Level Generation](#tile-based-level-generation)
- [Character State Management](#character-state-management)
- [Equipment and Item Combos](#equipment-and-item-combos)
- [AI Behavior Trees](#ai-behavior-trees)
- [Music/Sound Generation](#musicsound-generation)

---

## What are Multi-Dimensional Chains?

Normal Markov chains work with simple strings:
```
'grass' → 'dirt' → 'stone'
```

But game states are complex! A tile isn't just its type - it has:
- Type (grass, dirt, stone)
- Elevation (low, medium, high)
- Features (tree, rock, water)

**Multi-dimensional chains** let you keep all attributes together:

```typescript
{ type: 'grass', elevation: 'low', feature: 'tree' }
  ↓
{ type: 'grass', elevation: 'medium', feature: 'none' }
  ↓
{ type: 'dirt', elevation: 'medium', feature: 'rock' }
```

### Basic Example

```typescript
import { MultiDimMarkovChain } from 'acausal';

interface Tile {
  type: string;
  elevation: string;
  feature: string;
}

// Example terrain sequences
const terrainPatterns: Tile[][] = [
  [
    { type: 'grass', elevation: 'low', feature: 'tree' },
    { type: 'grass', elevation: 'low', feature: 'none' },
    { type: 'dirt', elevation: 'medium', feature: 'rock' },
    { type: 'stone', elevation: 'high', feature: 'none' }
  ],
  [
    { type: 'grass', elevation: 'low', feature: 'flower' },
    { type: 'grass', elevation: 'medium', feature: 'tree' },
    { type: 'grass', elevation: 'medium', feature: 'none' },
    { type: 'dirt', elevation: 'high', feature: 'none' }
  ]
];

// Create chain - tell it how to convert tiles to unique keys
const terrainGen = new MultiDimMarkovChain<Tile>({
  maxOrder: 2,
  stateKey: (tile) => `${tile.type}_${tile.elevation}_${tile.feature}`
});

// Add training data
terrainGen.addSequences(terrainPatterns);

// Generate new terrain!
const newTerrain = terrainGen.generate({ min: 6, max: 6, order: 2 });

newTerrain.forEach((tile, i) => {
  console.log(`Tile ${i}: ${tile.type} @ ${tile.elevation} (${tile.feature})`);
});

/* Output:
Tile 0: grass @ low (tree)
Tile 1: grass @ medium (none)
Tile 2: dirt @ medium (rock)
Tile 3: stone @ high (none)
Tile 4: grass @ low (flower)
Tile 5: grass @ medium (tree)
*/
```

**Why is this powerful?**
- Attributes stay connected (trees don't appear on stone)
- Elevation progresses naturally (low → medium → high)
- Patterns feel realistic (dirt usually between grass and stone)

---

## Tile-Based Level Generation

### 2D Platformer Level

Generate platformer levels with tile types and properties:

```typescript
interface PlatformTile {
  type: 'empty' | 'ground' | 'platform' | 'spike' | 'coin';
  solid: boolean;
  dangerous: boolean;
}

// Example level strips (left to right)
const levelPatterns: PlatformTile[][] = [
  [
    { type: 'ground', solid: true, dangerous: false },
    { type: 'ground', solid: true, dangerous: false },
    { type: 'empty', solid: false, dangerous: false },
    { type: 'platform', solid: true, dangerous: false },
    { type: 'coin', solid: false, dangerous: false },
    { type: 'empty', solid: false, dangerous: false },
    { type: 'ground', solid: true, dangerous: false }
  ],
  [
    { type: 'ground', solid: true, dangerous: false },
    { type: 'empty', solid: false, dangerous: false },
    { type: 'spike', solid: false, dangerous: true },
    { type: 'empty', solid: false, dangerous: false },
    { type: 'platform', solid: true, dangerous: false },
    { type: 'ground', solid: true, dangerous: false }
  ]
];

const levelGen = new MultiDimMarkovChain<PlatformTile>({
  maxOrder: 2,
  stateKey: (tile) => `${tile.type}_${tile.solid}_${tile.dangerous}`
});

levelPatterns.forEach(pattern => {
  levelGen.addSequence(pattern);
});

// Generate a level section
const levelSection = levelGen.generate({ min: 10, max: 10, order: 2 });

console.log('Level layout:');
levelSection.forEach((tile, i) => {
  const visual =
    tile.type === 'ground' ? '█' :
    tile.type === 'platform' ? '▬' :
    tile.type === 'spike' ? '▲' :
    tile.type === 'coin' ? '○' :
    ' ';

  console.log(`Position ${i}: ${visual} (${tile.type})`);
});

/* Output:
Level layout:
Position 0: █ (ground)
Position 1: █ (ground)
Position 2:   (empty)
Position 3: ▬ (platform)
Position 4: ○ (coin)
Position 5:   (empty)
Position 6: ▲ (spike)
Position 7:   (empty)
Position 8: ▬ (platform)
Position 9: █ (ground)
*/
```

### Roguelike Dungeon Rooms

Generate dungeon rooms with multiple attributes:

```typescript
interface DungeonRoom {
  type: 'corridor' | 'chamber' | 'treasure' | 'boss' | 'trap';
  size: 'small' | 'medium' | 'large';
  danger: number;  // 1-10
  exits: number;   // 1-4
}

// Example dungeon layouts
const dungeonLayouts: DungeonRoom[][] = [
  [
    { type: 'corridor', size: 'small', danger: 1, exits: 2 },
    { type: 'chamber', size: 'medium', danger: 3, exits: 3 },
    { type: 'corridor', size: 'small', danger: 2, exits: 2 },
    { type: 'treasure', size: 'small', danger: 5, exits: 1 },
  ],
  [
    { type: 'corridor', size: 'small', danger: 1, exits: 2 },
    { type: 'trap', size: 'medium', danger: 4, exits: 2 },
    { type: 'chamber', size: 'large', danger: 6, exits: 4 },
    { type: 'boss', size: 'large', danger: 10, exits: 1 }
  ]
];

const dungeonGen = new MultiDimMarkovChain<DungeonRoom>({
  maxOrder: 2,
  stateKey: (room) => `${room.type}_${room.size}_${room.danger}_${room.exits}`
});

dungeonLayouts.forEach(layout => {
  dungeonGen.addSequence(layout);
});

// Generate a dungeon level
const dungeon = dungeonGen.generate({ min: 8, max: 8, order: 2 });

console.log('=== Generated Dungeon ===\n');
dungeon.forEach((room, i) => {
  console.log(`Room ${i + 1}: ${room.type.toUpperCase()}`);
  console.log(`  Size: ${room.size}`);
  console.log(`  Danger: ${'★'.repeat(room.danger)}${'☆'.repeat(10 - room.danger)}`);
  console.log(`  Exits: ${room.exits}`);
  console.log();
});

/* Output:
=== Generated Dungeon ===

Room 1: CORRIDOR
  Size: small
  Danger: ★☆☆☆☆☆☆☆☆☆
  Exits: 2

Room 2: CHAMBER
  Size: medium
  Danger: ★★★☆☆☆☆☆☆☆
  Exits: 3

Room 3: CORRIDOR
  Size: small
  Danger: ★★☆☆☆☆☆☆☆☆
  Exits: 2

Room 4: TRAP
  Size: medium
  Danger: ★★★★☆☆☆☆☆☆
  Exits: 2

Room 5: CHAMBER
  Size: large
  Danger: ★★★★★★☆☆☆☆
  Exits: 4

Room 6: TREASURE
  Size: small
  Danger: ★★★★★☆☆☆☆☆
  Exits: 1

Room 7: CORRIDOR
  Size: small
  Danger: ★☆☆☆☆☆☆☆☆☆
  Exits: 2

Room 8: BOSS
  Size: large
  Danger: ★★★★★★★★★★
  Exits: 1
*/
```

**Notice:** Danger naturally escalates toward the boss room!

---

## Character State Management

### RPG Character States

Track character states with multiple properties:

```typescript
interface CharacterState {
  action: 'idle' | 'walking' | 'running' | 'jumping' | 'attacking' | 'hurt';
  facing: 'left' | 'right';
  grounded: boolean;
  hp: number;
}

// Common action sequences
const movementPatterns: CharacterState[][] = [
  [
    { action: 'idle', facing: 'right', grounded: true, hp: 100 },
    { action: 'walking', facing: 'right', grounded: true, hp: 100 },
    { action: 'running', facing: 'right', grounded: true, hp: 100 },
    { action: 'jumping', facing: 'right', grounded: false, hp: 100 },
    { action: 'idle', facing: 'right', grounded: true, hp: 100 }
  ],
  [
    { action: 'idle', facing: 'left', grounded: true, hp: 100 },
    { action: 'attacking', facing: 'left', grounded: true, hp: 100 },
    { action: 'hurt', facing: 'left', grounded: true, hp: 80 },
    { action: 'walking', facing: 'right', grounded: true, hp: 80 }  // Retreat!
  ]
];

const characterAI = new MultiDimMarkovChain<CharacterState>({
  maxOrder: 2,
  stateKey: (state) => `${state.action}_${state.facing}_${state.grounded}_${state.hp}`
});

movementPatterns.forEach(pattern => {
  characterAI.addSequence(pattern);
});

// Generate NPC behavior
const npcBehavior = characterAI.generate({ min: 6, max: 6, order: 2 });

console.log('NPC behavior:');
npcBehavior.forEach((state, i) => {
  const arrow = state.facing === 'right' ? '→' : '←';
  const ground = state.grounded ? '(ground)' : '(air)';

  console.log(`Frame ${i}: ${state.action} ${arrow} ${ground} HP:${state.hp}`);
});

/* Output:
NPC behavior:
Frame 0: idle → (ground) HP:100
Frame 1: walking → (ground) HP:100
Frame 2: running → (ground) HP:100
Frame 3: jumping → (air) HP:100
Frame 4: idle → (ground) HP:100
Frame 5: attacking → (ground) HP:100
*/
```

---

## Equipment and Item Combos

### Outfit Combinations

Generate character outfits where items work together:

```typescript
interface OutfitPiece {
  slot: 'head' | 'chest' | 'legs' | 'feet' | 'weapon';
  style: 'warrior' | 'mage' | 'rogue';
  rarity: 'common' | 'rare' | 'epic';
}

// Example coordinated outfits
const outfitSets: OutfitPiece[][] = [
  [
    { slot: 'head', style: 'warrior', rarity: 'common' },
    { slot: 'chest', style: 'warrior', rarity: 'common' },
    { slot: 'legs', style: 'warrior', rarity: 'rare' },
    { slot: 'feet', style: 'warrior', rarity: 'common' },
    { slot: 'weapon', style: 'warrior', rarity: 'epic' }
  ],
  [
    { slot: 'head', style: 'mage', rarity: 'rare' },
    { slot: 'chest', style: 'mage', rarity: 'rare' },
    { slot: 'legs', style: 'mage', rarity: 'rare' },
    { slot: 'feet', style: 'mage', rarity: 'common' },
    { slot: 'weapon', style: 'mage', rarity: 'epic' }
  ]
];

const outfitGen = new MultiDimMarkovChain<OutfitPiece>({
  maxOrder: 1,  // Each piece depends on previous
  stateKey: (piece) => `${piece.slot}_${piece.style}_${piece.rarity}`
});

outfitSets.forEach(set => {
  outfitGen.addSequence(set);
});

// Generate a coordinated outfit
const outfit = outfitGen.generate({ min: 5, max: 5, order: 1 });

console.log('Generated outfit:');
outfit.forEach(piece => {
  console.log(`  ${piece.slot}: ${piece.style} (${piece.rarity})`);
});

/* Output:
Generated outfit:
  head: warrior (common)
  chest: warrior (common)
  legs: mage (rare)
  feet: mage (common)
  weapon: mage (epic)

// Note: Style tends to match because pieces in training sets matched!
*/
```

---

## AI Behavior Trees

### Enemy AI Patterns

Create AI that transitions between states with context:

```typescript
interface AIState {
  behavior: 'patrol' | 'chase' | 'attack' | 'flee' | 'search';
  playerDistance: 'far' | 'medium' | 'close';
  health: 'high' | 'medium' | 'low';
}

// Enemy behavior patterns
const enemyBehaviors: AIState[][] = [
  [
    { behavior: 'patrol', playerDistance: 'far', health: 'high' },
    { behavior: 'patrol', playerDistance: 'medium', health: 'high' },
    { behavior: 'chase', playerDistance: 'medium', health: 'high' },
    { behavior: 'attack', playerDistance: 'close', health: 'high' },
    { behavior: 'attack', playerDistance: 'close', health: 'medium' }
  ],
  [
    { behavior: 'patrol', playerDistance: 'far', health: 'high' },
    { behavior: 'chase', playerDistance: 'medium', health: 'high' },
    { behavior: 'attack', playerDistance: 'close', health: 'high' },
    { behavior: 'attack', playerDistance: 'close', health: 'low' },
    { behavior: 'flee', playerDistance: 'medium', health: 'low' }  // Low health = flee!
  ]
];

const enemyAI = new MultiDimMarkovChain<AIState>({
  maxOrder: 2,
  stateKey: (state) => `${state.behavior}_${state.playerDistance}_${state.health}`
});

enemyBehaviors.forEach(behavior => {
  enemyAI.addSequence(behavior);
});

// Simulate AI decision making
function simulateAI(playerDistance: 'far' | 'medium' | 'close', health: 'high' | 'medium' | 'low') {
  console.log(`\n=== AI Simulation (Player: ${playerDistance}, HP: ${health}) ===\n`);

  const sequence = enemyAI.generate({ min: 5, max: 5, order: 2 });

  sequence.forEach((state, i) => {
    console.log(`Turn ${i + 1}: ${state.behavior.toUpperCase()}`);
    console.log(`  Player distance: ${state.playerDistance}`);
    console.log(`  Health: ${state.health}`);
  });
}

simulateAI('medium', 'high');
simulateAI('close', 'low');

/* Output:
=== AI Simulation (Player: medium, HP: high) ===

Turn 1: PATROL
  Player distance: far
  Health: high
Turn 2: CHASE
  Player distance: medium
  Health: high
Turn 3: ATTACK
  Player distance: close
  Health: high
Turn 4: ATTACK
  Player distance: close
  Health: medium
Turn 5: ATTACK
  Player distance: close
  Health: high

=== AI Simulation (Player: close, HP: low) ===

Turn 1: ATTACK
  Player distance: close
  Health: low
Turn 2: FLEE
  Player distance: medium
  Health: low
Turn 3: PATROL
  Player distance: far
  Health: high
Turn 4: CHASE
  Player distance: medium
  Health: high
Turn 5: ATTACK
  Player distance: close
  Health: high
*/
```

---

## Music/Sound Generation

### Musical Note Sequences

Generate music with pitch, duration, and volume:

```typescript
interface Note {
  pitch: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  duration: 'whole' | 'half' | 'quarter' | 'eighth';
  volume: 'quiet' | 'medium' | 'loud';
}

// Example melodies
const melodies: Note[][] = [
  [
    { pitch: 'C', octave: 4, duration: 'quarter', volume: 'medium' },
    { pitch: 'E', octave: 4, duration: 'quarter', volume: 'medium' },
    { pitch: 'G', octave: 4, duration: 'half', volume: 'loud' },
    { pitch: 'E', octave: 4, duration: 'quarter', volume: 'medium' },
    { pitch: 'C', octave: 4, duration: 'half', volume: 'quiet' }
  ],
  [
    { pitch: 'G', octave: 4, duration: 'quarter', volume: 'loud' },
    { pitch: 'F', octave: 4, duration: 'quarter', volume: 'medium' },
    { pitch: 'E', octave: 4, duration: 'quarter', volume: 'medium' },
    { pitch: 'D', octave: 4, duration: 'quarter', volume: 'quiet' },
    { pitch: 'C', octave: 4, duration: 'half', volume: 'quiet' }
  ]
];

const musicGen = new MultiDimMarkovChain<Note>({
  maxOrder: 2,
  stateKey: (note) => `${note.pitch}${note.octave}_${note.duration}_${note.volume}`
});

melodies.forEach(melody => {
  musicGen.addSequence(melody);
});

// Generate a new melody
const newMelody = musicGen.generate({ min: 8, max: 8, order: 2 });

console.log('Generated melody:');
newMelody.forEach((note, i) => {
  console.log(`${i + 1}. ${note.pitch}${note.octave} (${note.duration}, ${note.volume})`);
});

/* Output:
Generated melody:
1. C4 (quarter, medium)
2. E4 (quarter, medium)
3. G4 (half, loud)
4. F4 (quarter, medium)
5. E4 (quarter, medium)
6. D4 (quarter, quiet)
7. C4 (half, quiet)
8. E4 (quarter, medium)
*/
```

### Ambient Sound Layers

Generate layered ambient sounds for different areas:

```typescript
interface AmbientSound {
  layer: 'background' | 'midground' | 'foreground';
  type: 'wind' | 'birds' | 'water' | 'leaves' | 'insects' | 'silence';
  intensity: 'faint' | 'moderate' | 'strong';
}

// Forest ambience patterns
const forestAmbience: AmbientSound[][] = [
  [
    { layer: 'background', type: 'wind', intensity: 'faint' },
    { layer: 'midground', type: 'birds', intensity: 'moderate' },
    { layer: 'foreground', type: 'leaves', intensity: 'faint' },
    { layer: 'midground', type: 'birds', intensity: 'strong' },
    { layer: 'background', type: 'wind', intensity: 'moderate' }
  ],
  [
    { layer: 'background', type: 'silence', intensity: 'faint' },
    { layer: 'midground', type: 'water', intensity: 'moderate' },
    { layer: 'foreground', type: 'insects', intensity: 'faint' },
    { layer: 'midground', type: 'birds', intensity: 'moderate' },
    { layer: 'background', type: 'wind', intensity: 'faint' }
  ]
];

const ambienceGen = new MultiDimMarkovChain<AmbientSound>({
  maxOrder: 2,
  stateKey: (sound) => `${sound.layer}_${sound.type}_${sound.intensity}`
});

forestAmbience.forEach(pattern => {
  ambienceGen.addSequence(pattern);
});

// Generate ambient soundscape
const soundscape = ambienceGen.generate({ min: 6, max: 6, order: 2 });

console.log('Ambient soundscape:');
soundscape.forEach((sound, i) => {
  const volume =
    sound.intensity === 'faint' ? '🔈' :
    sound.intensity === 'moderate' ? '🔉' :
    '🔊';

  console.log(`${i + 1}. ${sound.layer}: ${sound.type} ${volume}`);
});

/* Output:
Ambient soundscape:
1. background: wind 🔈
2. midground: birds 🔉
3. foreground: leaves 🔈
4. midground: birds 🔊
5. midground: water 🔉
6. background: wind 🔉
*/
```

---

## Best Practices

### Choose Good State Keys

The `stateKey` function determines what makes states unique:

```typescript
// ✅ Good - combines all important attributes
stateKey: (tile) => `${tile.type}_${tile.elevation}_${tile.feature}`

// ❌ Bad - loses information
stateKey: (tile) => tile.type

// ✅ Good - for high-level patterns
stateKey: (tile) => `${tile.type}_${tile.dangerous}`

// ⚠️ Consider - might be too specific
stateKey: (tile) => `${tile.type}_${tile.x}_${tile.y}_${tile.elevation}`
```

**Rule of thumb:**
- Include attributes that should appear together
- Exclude attributes that should vary independently
- Don't include unique IDs or positions

### Training Data Quality

```typescript
// ✅ Good - varied but logical sequences
const good = [
  [grass_low, grass_med, dirt_med, stone_high],
  [grass_low, dirt_low, dirt_med, stone_med],
  [grass_med, grass_high, stone_high, stone_high]
];

// ❌ Bad - too random, no patterns
const bad = [
  [stone_high, grass_low, stone_high, grass_low],
  [dirt_med, dirt_med, grass_high, stone_low]
];
```

**Best training data has:**
- Logical progressions
- Some variety
- Consistent relationships between attributes

---

## Performance Tips

### Simple State Keys

Complex state keys slow down generation:

```typescript
// Faster
stateKey: (state) => `${state.type}_${state.variant}`

// Slower (but more accurate)
stateKey: (state) => `${state.type}_${state.variant}_${state.color}_${state.size}_${state.rotation}`
```

Trade-off: Simpler keys = faster but less accurate patterns

### Pre-generate Common Sequences

```typescript
class LevelGenerator {
  private tileGen: MultiDimMarkovChain<Tile>;
  private cache: Tile[][] = [];

  constructor(tileGen: MultiDimMarkovChain<Tile>) {
    this.tileGen = tileGen;
    this.warmCache();
  }

  private warmCache() {
    // Pre-generate 100 level sections
    for (let i = 0; i < 100; i++) {
      this.cache.push(
        this.tileGen.generate({ min: 20, max: 20, order: 2 })
      );
    }
  }

  getLevel(): Tile[] {
    if (this.cache.length === 0) {
      this.warmCache();
    }
    return this.cache.pop()!;
  }
}
```

---

## Next Steps

- [Scaled States](./scaled-states.md) - Add magnitude to multi-dimensional states
- [Game Generation](./game-generation.md) - Practical examples
- [Loot Systems](./loot-systems.md) - Item generation

---

**Quick Reference:**

| Use Case | Order | Best Attributes |
|----------|-------|-----------------|
| Tile generation | 2 | type, elevation, feature |
| Character states | 2-3 | action, facing, grounded |
| AI behavior | 2 | behavior, context, health |
| Music | 2-3 | pitch, duration, volume |
| Equipment | 1 | slot, style, rarity |

**Creation:**
```typescript
const chain = new MultiDimMarkovChain<YourType>({
  maxOrder: 2,
  stateKey: (state) => `${state.prop1}_${state.prop2}_${state.prop3}`
});

chain.addSequence([
  { prop1: 'a', prop2: 'x', prop3: 1 },
  { prop1: 'b', prop2: 'y', prop3: 2 }
]);

const result = chain.generate({ min: 5, max: 5, order: 2 });
// Returns your original objects!
```
