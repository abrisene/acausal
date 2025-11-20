# Loot Systems and Item Generation

This guide shows you how to create loot drop systems, rarity distributions, and procedural items for your game.

## Table of Contents

- [Basic Loot Drops](#basic-loot-drops)
- [Rarity Systems](#rarity-systems)
- [Enemy-Specific Loot Tables](#enemy-specific-loot-tables)
- [Progressive Loot (Scaling Rewards)](#progressive-loot-scaling-rewards)
- [Procedural Item Names](#procedural-item-names)
- [Stat Generation](#stat-generation)
- [Complete Loot System Example](#complete-loot-system-example)

---

## Basic Loot Drops

### Simple Treasure Chest

Let's start with a basic treasure chest that drops random items:

```typescript
import { Distribution } from 'acausal';

// Create a loot table with different drop rates
const treasureChest = new Distribution({
  seed: 42,
  source: {
    'gold': 100,        // Very common
    'health-potion': 50, // Common
    'sword': 10,         // Uncommon
    'magic-ring': 5,     // Rare
    'legendary-gem': 1   // Very rare
  }
});

// Open the chest!
const loot = treasureChest.pick(3); // Get 3 items
console.log('You found:', loot);
// ['gold', 'health-potion', 'gold']
```

**Understanding the weights:**
- `gold: 100` means gold is 100x more likely than a legendary gem
- `health-potion: 50` is half as likely as gold
- `legendary-gem: 1` is the rarest item

### Opening Multiple Chests

```typescript
// Open 10 chests, see what we get
const haul: { [item: string]: number } = {};

for (let i = 0; i < 10; i++) {
  const items = treasureChest.pick(3);
  items.forEach(item => {
    haul[item] = (haul[item] || 0) + 1;
  });
}

console.log('From 10 chests:', haul);
/* Typical result:
{
  'gold': 18,
  'health-potion': 9,
  'sword': 2,
  'magic-ring': 1,
  'legendary-gem': 0
}
*/
```

---

## Rarity Systems

### Standard Rarity Tiers

Most games use rarity tiers like Common, Uncommon, Rare, Epic, Legendary:

```typescript
// Define rarity tiers
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const rarityDist = new Distribution<Rarity>({
  source: {
    'common': 60,     // 60% chance
    'uncommon': 25,   // 25% chance
    'rare': 10,       // 10% chance
    'epic': 4,        // 4% chance
    'legendary': 1    // 1% chance
  }
});

// Roll for item rarity
const rarity = rarityDist.pickOne();
console.log('Rarity:', rarity); // probably 'common'
```

### Pity System (Guaranteed Rare After X Tries)

Ever opened 50 loot boxes without getting anything good? Let's add a pity system:

```typescript
class LootBoxWithPity {
  private rarityDist: Distribution<Rarity>;
  private normalDistribution: Distribution<Rarity>;
  private guaranteedRareDistribution: Distribution<Rarity>;
  private boxesSinceRare: number = 0;
  private pityThreshold: number = 10; // Guaranteed rare every 10 boxes

  constructor() {
    // Normal drop rates
    this.normalDistribution = new Distribution<Rarity>({
      source: {
        'common': 60,
        'uncommon': 25,
        'rare': 10,
        'epic': 4,
        'legendary': 1
      }
    });

    // Guaranteed at least rare
    this.guaranteedRareDistribution = new Distribution<Rarity>({
      source: {
        'rare': 60,      // Most likely
        'epic': 30,      // Pretty likely
        'legendary': 10  // Possible!
      }
    });

    this.rarityDist = this.normalDistribution;
  }

  open(): Rarity {
    this.boxesSinceRare++;

    // Pity system kicks in
    if (this.boxesSinceRare >= this.pityThreshold) {
      const rarity = this.guaranteedRareDistribution.pickOne()!;
      this.boxesSinceRare = 0; // Reset counter
      return rarity;
    }

    // Normal roll
    const rarity = this.normalDistribution.pickOne()!;

    // Reset counter if we got something rare
    if (['rare', 'epic', 'legendary'].includes(rarity)) {
      this.boxesSinceRare = 0;
    }

    return rarity;
  }
}

// Test the pity system
const lootBox = new LootBoxWithPity();
const results: Rarity[] = [];

for (let i = 0; i < 20; i++) {
  results.push(lootBox.open());
}

console.log('20 boxes:', results);
// You're guaranteed to get at least rare items!
```

### Dynamic Drop Rates (Increasing Rarity Over Time)

Make drop rates better as players progress:

```typescript
function getDropRates(playerLevel: number): Distribution<Rarity> {
  // Better rates at higher levels
  const commonWeight = Math.max(60 - playerLevel, 20); // Decreases with level
  const legendaryWeight = Math.min(1 + playerLevel * 0.5, 10); // Increases with level

  return new Distribution<Rarity>({
    source: {
      'common': commonWeight,
      'uncommon': 25,
      'rare': 10 + playerLevel * 0.2,
      'epic': 4 + playerLevel * 0.3,
      'legendary': legendaryWeight
    }
  });
}

// Level 1 player
const level1Drops = getDropRates(1);
console.log('Level 1 rare chance:', level1Drops.normal['rare']); // ~9.8%

// Level 50 player
const level50Drops = getDropRates(50);
console.log('Level 50 rare chance:', level50Drops.normal['rare']); // ~15.4%
```

---

## Enemy-Specific Loot Tables

### Different Enemies Drop Different Loot

Goblins shouldn't drop the same things as dragons:

```typescript
// Goblin loot (low-value items)
const goblinLoot = new Distribution({
  source: {
    'rusty-dagger': 40,
    'torn-cloth': 30,
    'copper-coins': 20,
    'old-boot': 10
  }
});

// Dragon loot (high-value items)
const dragonLoot = new Distribution({
  source: {
    'dragon-scale': 30,
    'ancient-gold': 25,
    'magic-gem': 20,
    'legendary-weapon': 15,
    'dragon-egg': 10
  }
});

// Boss loot (guaranteed good items)
const bossLoot = new Distribution({
  source: {
    'epic-armor': 40,
    'legendary-weapon': 30,
    'skill-book': 20,
    'unique-accessory': 10
  }
});

function getEnemyLoot(enemyType: string, count: number = 1): string[] {
  switch (enemyType) {
    case 'goblin':
      return goblinLoot.pick(count);
    case 'dragon':
      return dragonLoot.pick(count);
    case 'boss':
      return bossLoot.pick(count);
    default:
      return [];
  }
}

console.log('Goblin drops:', getEnemyLoot('goblin', 2));
// ['rusty-dagger', 'torn-cloth']

console.log('Dragon drops:', getEnemyLoot('dragon', 3));
// ['dragon-scale', 'ancient-gold', 'magic-gem']
```

### Conditional Loot (Quest Items)

Some items only drop when a player has a specific quest:

```typescript
function getQuestLoot(enemyType: string, hasQuest: boolean): string[] {
  const baseLoot = getEnemyLoot(enemyType, 2);

  // Add quest item if player has the quest
  if (hasQuest && enemyType === 'goblin') {
    // 50% chance to drop the quest item
    if (Math.random() < 0.5) {
      baseLoot.push('goblin-key');
    }
  }

  return baseLoot;
}

console.log('With quest:', getQuestLoot('goblin', true));
// ['rusty-dagger', 'copper-coins', 'goblin-key']

console.log('Without quest:', getQuestLoot('goblin', false));
// ['torn-cloth', 'rusty-dagger']
```

---

## Progressive Loot (Scaling Rewards)

### Level-Appropriate Loot

Make sure players get items suitable for their level:

```typescript
function getLevelAppropriateChest(playerLevel: number): Distribution {
  if (playerLevel < 10) {
    // Early game chest
    return new Distribution({
      source: {
        'iron-sword': 30,
        'leather-armor': 30,
        'health-potion': 25,
        'gold': 15
      }
    });
  } else if (playerLevel < 30) {
    // Mid game chest
    return new Distribution({
      source: {
        'steel-sword': 25,
        'chainmail-armor': 25,
        'magic-ring': 20,
        'greater-potion': 20,
        'gold': 10
      }
    });
  } else {
    // End game chest
    return new Distribution({
      source: {
        'legendary-weapon': 30,
        'epic-armor': 30,
        'rare-gem': 20,
        'ancient-artifact': 15,
        'fortune': 5
      }
    });
  }
}

const level5Chest = getLevelAppropriateChest(5);
console.log('Level 5 loot:', level5Chest.pick(2));
// ['iron-sword', 'leather-armor']

const level50Chest = getLevelAppropriateChest(50);
console.log('Level 50 loot:', level50Chest.pick(2));
// ['legendary-weapon', 'epic-armor']
```

---

## Procedural Item Names

### Generating Weapon Names

Create unique weapon names that sound cool:

```typescript
import { MarkovChain } from 'acausal';

// Cool weapon name parts
const weaponNames = [
  'flame', 'frost', 'storm', 'shadow', 'light',
  'doom', 'death', 'blood', 'soul', 'dragon'
];

const weaponTypes = [
  'sword', 'blade', 'axe', 'hammer', 'staff'
];

const weaponPrefixes = [
  'mighty', 'ancient', 'cursed', 'blessed', 'legendary'
];

// Simple combination
function generateWeaponName(): string {
  const prefix = weaponPrefixes[Math.floor(Math.random() * weaponPrefixes.length)];
  const name = weaponNames[Math.floor(Math.random() * weaponNames.length)];
  const type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

  return `${prefix} ${name} ${type}`;
}

console.log(generateWeaponName());
// "legendary frost blade"

// For more variety, use Markov chains on existing weapon names
const coolWeaponNames = [
  'excalibur', 'mjolnir', 'gungnir', 'kusanagi',
  'durandal', 'tyrfing', 'gram', 'narsil'
];

const weaponNameGen = new MarkovChain({
  maxOrder: 2,
  sequences: coolWeaponNames.map(n => n.split(''))
});

const uniqueName = weaponNameGen.generate({ min: 5, max: 10 }).join('');
console.log('The', uniqueName);
// "The mjolnarsil"
```

### Generating Item Descriptions

Create flavor text for items:

```typescript
const itemDescriptions = [
  "forged in the fires of the ancient dragon smiths".split(' '),
  "blessed by the high priests of the temple".split(' '),
  "once wielded by the legendary hero of old".split(' '),
  "found in the depths of the forgotten ruins".split(' '),
  "crafted from the scales of the elder dragon".split(' ')
];

const descriptionGen = new MarkovChain({
  maxOrder: 2,
  sequences: itemDescriptions
});

const description = descriptionGen.generate({ min: 6, max: 12 }).join(' ');
console.log(description);
// "forged in the depths of the ancient smiths"
```

---

## Stat Generation

### Random Item Stats with Rarity

Better rarity = better stats:

```typescript
interface ItemStats {
  damage?: number;
  defense?: number;
  health?: number;
  rarity: Rarity;
}

function generateItemStats(rarity: Rarity): ItemStats {
  // Base stats by rarity
  const statRanges = {
    'common': { min: 1, max: 10 },
    'uncommon': { min: 10, max: 25 },
    'rare': { min: 25, max: 50 },
    'epic': { min: 50, max: 100 },
    'legendary': { min: 100, max: 200 }
  };

  const range = statRanges[rarity];
  const randomInRange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  return {
    damage: randomInRange(range.min, range.max),
    defense: randomInRange(range.min, range.max),
    health: randomInRange(range.min * 10, range.max * 10),
    rarity
  };
}

// Generate items of different rarities
const commonSword = generateItemStats('common');
console.log('Common sword:', commonSword);
// { damage: 7, defense: 3, health: 50, rarity: 'common' }

const legendarySword = generateItemStats('legendary');
console.log('Legendary sword:', legendarySword);
// { damage: 175, defense: 142, health: 1650, rarity: 'legendary' }
```

### Stat Generation with Scaled States (v3.2+)

For more realistic stat progression, use `ScaledMarkovChain`:

```typescript
import { ScaledMarkovChain } from 'acausal';

// Historical item stats (what stats tend to appear together)
const itemStatHistory = [
  [
    { category: 'damage', magnitude: 50 },
    { category: 'speed', magnitude: 30 },
    { category: 'critical', magnitude: 20 }
  ],
  [
    { category: 'damage', magnitude: 40 },
    { category: 'health', magnitude: 100 },
    { category: 'defense', magnitude: 30 }
  ],
  [
    { category: 'speed', magnitude: 50 },
    { category: 'critical', magnitude: 40 },
    { category: 'damage', magnitude: 30 }
  ]
];

const statGen = new ScaledMarkovChain<string>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

itemStatHistory.forEach(stats => {
  statGen.addScaledSequence(stats);
});

// Generate a set of stats for an item
const itemStats = statGen.generateScaled({ min: 3, max: 3 });

console.log('Item stats:');
itemStats.forEach(stat => {
  console.log(`  ${stat.category}: ${Math.round(stat.magnitude)}`);
});

/* Output:
Item stats:
  damage: 45
  speed: 35
  critical: 25
*/
```

**Why this works:**
- Stats that appear together in training data will appear together in generation
- Magnitude values stay realistic based on historical data
- You can ensure balanced items automatically

---

## Complete Loot System Example

Let's put it all together in a complete loot system:

```typescript
import { Distribution, MarkovChain, ScaledMarkovChain } from 'acausal';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Item {
  name: string;
  type: string;
  rarity: Rarity;
  stats: {
    damage?: number;
    defense?: number;
    health?: number;
  };
  description: string;
}

class LootSystem {
  private rarityDist: Distribution<Rarity>;
  private weaponTypes = ['sword', 'axe', 'bow', 'staff', 'dagger'];
  private nameGen: MarkovChain;
  private descGen: MarkovChain;

  constructor() {
    // Rarity distribution
    this.rarityDist = new Distribution<Rarity>({
      source: {
        'common': 60,
        'uncommon': 25,
        'rare': 10,
        'epic': 4,
        'legendary': 1
      }
    });

    // Name generator
    const weaponNames = [
      'excalibur', 'mjolnir', 'stormbringer', 'frostmourne',
      'ashbringer', 'soulreaper', 'shadowblade'
    ];
    this.nameGen = new MarkovChain({
      maxOrder: 2,
      sequences: weaponNames.map(n => n.split(''))
    });

    // Description generator
    const descriptions = [
      "forged in ancient fires".split(' '),
      "blessed by the gods".split(' '),
      "wielded by legendary heroes".split(' '),
      "found in forgotten ruins".split(' ')
    ];
    this.descGen = new MarkovChain({
      maxOrder: 2,
      sequences: descriptions
    });
  }

  generateItem(): Item {
    // Roll for rarity
    const rarity = this.rarityDist.pickOne()!;

    // Pick weapon type
    const type = this.weaponTypes[
      Math.floor(Math.random() * this.weaponTypes.length)
    ];

    // Generate name
    const baseName = this.nameGen.generate({ min: 5, max: 10 }).join('');
    const name = `${baseName} ${type}`;

    // Generate stats based on rarity
    const stats = this.generateStats(rarity);

    // Generate description
    const description = this.descGen.generate({ min: 4, max: 8 }).join(' ');

    return { name, type, rarity, stats, description };
  }

  private generateStats(rarity: Rarity) {
    const ranges = {
      'common': { min: 1, max: 10 },
      'uncommon': { min: 10, max: 25 },
      'rare': { min: 25, max: 50 },
      'epic': { min: 50, max: 100 },
      'legendary': { min: 100, max: 200 }
    };

    const range = ranges[rarity];
    const rand = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    return {
      damage: rand(range.min, range.max),
      defense: rand(range.min, range.max),
      health: rand(range.min * 10, range.max * 10)
    };
  }

  dropLoot(enemyType: string, quantity: number = 1): Item[] {
    const loot: Item[] = [];

    for (let i = 0; i < quantity; i++) {
      loot.push(this.generateItem());
    }

    return loot;
  }
}

// Use the system
const lootSystem = new LootSystem();

console.log('=== Boss defeated! ===\n');
const drops = lootSystem.dropLoot('boss', 3);

drops.forEach((item, i) => {
  console.log(`Item ${i + 1}:`);
  console.log(`  Name: ${item.name}`);
  console.log(`  Rarity: ${item.rarity}`);
  console.log(`  Stats:`, item.stats);
  console.log(`  "${item.description}"`);
  console.log();
});

/* Example output:
=== Boss defeated! ===

Item 1:
  Name: excalmourne sword
  Rarity: rare
  Stats: { damage: 38, defense: 42, health: 370 }
  "forged in forgotten fires"

Item 2:
  Name: stormborn axe
  Rarity: common
  Stats: { damage: 7, defense: 5, health: 60 }
  "blessed by legendary ruins"

Item 3:
  Name: frostbringer dagger
  Rarity: epic
  Stats: { damage: 87, defense: 92, health: 850 }
  "wielded by ancient gods"
*/
```

---

## Performance Tips

### Pre-cache Generated Items

Don't generate items during combat - prepare them ahead of time:

```typescript
class LootCache {
  private cache: { [rarity: string]: Item[] } = {};
  private lootSystem: LootSystem;
  private cacheSize = 50; // Keep 50 items of each rarity

  constructor(lootSystem: LootSystem) {
    this.lootSystem = lootSystem;
    this.refillCache();
  }

  getItem(rarity: Rarity): Item {
    if (!this.cache[rarity] || this.cache[rarity].length === 0) {
      this.refillCache();
    }
    return this.cache[rarity].pop()!;
  }

  private refillCache() {
    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    rarities.forEach(rarity => {
      if (!this.cache[rarity]) {
        this.cache[rarity] = [];
      }

      while (this.cache[rarity].length < this.cacheSize) {
        let item;
        do {
          item = this.lootSystem.generateItem();
        } while (item.rarity !== rarity);

        this.cache[rarity].push(item);
      }
    });
  }
}

// During loading screen
const cache = new LootCache(lootSystem);

// During gameplay - instant!
const rareItem = cache.getItem('rare');
```

---

## Next Steps

- [Game Generation](./game-generation.md) - Names, quests, dialogue
- [Chain Blending](./chain-blending.md) - Mix loot tables for hybrid enemies
- [Scaled States](./scaled-states.md) - Advanced stat generation

---

**Quick Reference:**

| Feature | Tool | Use Case |
|---------|------|----------|
| Basic drops | `Distribution` | Simple loot tables |
| Rarity | `Distribution` | Common/Rare/Legendary |
| Item names | `MarkovChain` | Procedural names |
| Item stats | `ScaledMarkovChain` | Realistic stat combos |
| Pity system | Custom class | Guaranteed drops |
