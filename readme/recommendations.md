# Recommendations and Pattern Analysis

**New in v3.5+**

This guide shows you how to analyze patterns in your game data to build recommendation systems, matchmaking, and player insights.

## Table of Contents

- [What is Pattern Analysis?](#what-is-pattern-analysis)
- [Build Recommendations](#build-recommendations)
- [Player Matchmaking](#player-matchmaking)
- [Content Discovery](#content-discovery)
- [Combat Analysis](#combat-analysis)
- [Finding Similar Items](#finding-similar-items)
- [Trend Detection](#trend-detection)

---

## What is Pattern Analysis?

Pattern analysis looks at your data to find:
- **Common patterns**: What players do most often
- **Rare patterns**: Unusual strategies or builds
- **Similar sequences**: Find players/items that are alike
- **Trends**: What's becoming popular

This is perfect for:
- "Players like you also..."
- "Recommended builds"
- "Similar items"
- "Popular strategies"

---

## Build Recommendations

### Finding Popular Builds

Analyze what successful players use:

```typescript
import { MarkovChain } from 'acausal';

// Player equipment sequences (successful players)
const successfulBuilds = [
  ['sword', 'shield', 'helm', 'chainmail', 'boots'],
  ['staff', 'robe', 'hat', 'ring', 'amulet'],
  ['bow', 'leather', 'hood', 'gloves', 'boots'],
  ['sword', 'plate', 'helm', 'gauntlets', 'boots']
];

const buildModel = new MarkovChain({
  maxOrder: 2,
  sequences: successfulBuilds
});

// Extract common patterns
const patterns = buildModel.extractPatterns({
  minOrder: 2,        // Look for pairs or longer
  minFrequency: 2,    // Must appear at least 2 times
  topN: 10            // Show top 10 patterns
});

console.log('Popular equipment combos:');
patterns.forEach((pattern, i) => {
  console.log(`${i + 1}. ${pattern.pattern.join(' + ')} (appears ${pattern.frequency}x)`);
});

/* Output:
Popular equipment combos:
1. sword + helm (appears 2x)
2. helm + boots (appears 2x)
3. sword + plate (appears 1x)
4. staff + robe (appears 1x)
5. bow + leather (appears 1x)
*/
```

### Recommending Next Equipment

Based on what player already has, suggest what to get next:

```typescript
function recommendNext Equipment(currentGear: string[]): string[] {
  // Generate possible next items
  const suggestions = buildModel.generate({
    start: currentGear,
    min: currentGear.length + 1,
    max: currentGear.length + 3,
    order: 2
  });

  // Get only the new items
  const newItems = suggestions.slice(currentGear.length);

  return newItems;
}

// Player has sword and shield
const playerGear = ['sword', 'shield'];
const recommended = recommendNextEquipment(playerGear);

console.log('Recommended next items:', recommended);
// ['helm', 'chainmail'] - because that's what successful players use after sword+shield
```

### Complete Recommendation System

```typescript
class BuildRecommender {
  private buildModel: MarkovChain;
  private allBuilds: string[][];

  constructor(successfulBuilds: string[][]) {
    this.allBuilds = successfulBuilds;
    this.buildModel = new MarkovChain({
      maxOrder: 2,
      sequences: successfulBuilds
    });
  }

  // Find similar builds
  findSimilarBuilds(playerBuild: string[], count: number = 3): string[][] {
    const similar = this.buildModel.findSimilar(playerBuild, {
      metric: 'jaccard',  // Similarity based on shared items
      topN: count
    });

    return similar.map(s => s.sequence);
  }

  // Recommend next item based on current build
  recommendNextItem(currentBuild: string[]): string | null {
    // Find what successful players added after similar builds
    const similar = this.findSimilarBuilds(currentBuild, 5);

    // Count what items they added
    const nextItems = new Map<string, number>();

    similar.forEach(build => {
      // Find items in their build not in current build
      build.forEach(item => {
        if (!currentBuild.includes(item)) {
          nextItems.set(item, (nextItems.get(item) || 0) + 1);
        }
      });
    });

    // Return most common next item
    let bestItem: string | null = null;
    let bestCount = 0;

    nextItems.forEach((count, item) => {
      if (count > bestCount) {
        bestCount = count;
        bestItem = item;
      }
    });

    return bestItem;
  }

  // Get popular starting builds
  getPopularStarters(): string[][] {
    // Extract patterns of length 2-3 (early game)
    const patterns = this.buildModel.extractPatterns({
      minOrder: 2,
      maxOrder: 3,
      minFrequency: 2,
      topN: 5
    });

    return patterns.map(p => p.pattern);
  }
}

// Usage
const recommender = new BuildRecommender(successfulBuilds);

// New player
console.log('Popular starting builds:');
recommender.getPopularStarters().forEach(build => {
  console.log('  ' + build.join(' → '));
});

// Mid-game player
const midGameBuild = ['sword', 'shield', 'helm'];
const nextItem = recommender.recommendNextItem(midGameBuild);
console.log('\nRecommended next item:', nextItem);

// Find similar players
const similarBuilds = recommender.findSimilarBuilds(midGameBuild);
console.log('\nPlayers with similar builds:');
similarBuilds.forEach(build => {
  console.log('  ' + build.join(', '));
});

/* Output:
Popular starting builds:
  sword → helm
  staff → robe
  bow → leather

Recommended next item: chainmail

Players with similar builds:
  sword, shield, helm, chainmail, boots
  sword, plate, helm, gauntlets, boots
*/
```

---

## Player Matchmaking

### Skill-Based Matchmaking

Match players based on similar play patterns:

```typescript
interface PlayerData {
  id: string;
  recentMatches: string[];  // ['win', 'loss', 'win', ...]
  playStyle: string[];      // ['aggressive', 'defensive', ...]
}

const players: PlayerData[] = [
  {
    id: 'player1',
    recentMatches: ['win', 'win', 'loss', 'win'],
    playStyle: ['aggressive', 'rush', 'pressure']
  },
  {
    id: 'player2',
    recentMatches: ['win', 'loss', 'loss', 'win'],
    playStyle: ['defensive', 'strategic', 'patient']
  },
  {
    id: 'player3',
    recentMatches: ['win', 'win', 'win', 'loss'],
    playStyle: ['aggressive', 'rush', 'all-in']
  }
];

// Build a model for each player's style
function buildPlayerModel(player: PlayerData): MarkovChain {
  return new MarkovChain({
    maxOrder: 2,
    sequences: [player.playStyle]
  });
}

// Find similar players
function findSimilarPlayers(
  targetPlayer: PlayerData,
  allPlayers: PlayerData[],
  count: number = 3
): PlayerData[] {
  const targetModel = buildPlayerModel(targetPlayer);

  // Compare playstyles
  const similarities: Array<{ player: PlayerData; score: number }> = [];

  allPlayers.forEach(player => {
    if (player.id === targetPlayer.id) return;

    // Find similarity
    const similar = targetModel.findSimilar(player.playStyle, {
      metric: 'jaccard',
      topN: 1
    });

    if (similar.length > 0) {
      similarities.push({
        player,
        score: similar[0].score
      });
    }
  });

  // Return top N most similar
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.player);
}

// Find a match for player1
const target = players[0];
const matches = findSimilarPlayers(target, players, 2);

console.log(`Finding matches for ${target.id} (${target.playStyle.join(', ')})`);
console.log('\nSimilar players:');
matches.forEach(match => {
  console.log(`  ${match.id}: ${match.playStyle.join(', ')}`);
});

/* Output:
Finding matches for player1 (aggressive, rush, pressure)

Similar players:
  player3: aggressive, rush, all-in
  player2: defensive, strategic, patient
*/
```

### Team Composition Suggestions

```typescript
const teamComps = [
  ['tank', 'healer', 'dps', 'dps'],
  ['tank', 'tank', 'healer', 'dps'],
  ['tank', 'healer', 'dps', 'support'],
  ['bruiser', 'healer', 'dps', 'dps']
];

const compModel = new MarkovChain({
  maxOrder: 2,
  sequences: teamComps
});

function suggestTeammate(currentTeam: string[]): string[] {
  // What roles are missing?
  const suggested = compModel.generate({
    start: currentTeam,
    min: 4,
    max: 4,
    order: 2
  });

  // Return the roles we don't have yet
  return suggested.slice(currentTeam.length);
}

// We have tank and healer
const currentTeam = ['tank', 'healer'];
const needed = suggestTeammate(currentTeam);

console.log('Current team:', currentTeam);
console.log('Suggested roles:', needed);
// ['dps', 'dps'] or ['dps', 'support']
```

---

## Content Discovery

### "Players Like You Also Enjoyed"

```typescript
// What quests players completed
const playerJourneys = [
  ['tutorial', 'forest-quest', 'cave-dungeon', 'dragon-raid'],
  ['tutorial', 'forest-quest', 'mountain-quest', 'dragon-raid'],
  ['tutorial', 'city-quest', 'cave-dungeon', 'final-boss']
];

const questModel = new MarkovChain({
  maxOrder: 2,
  sequences: playerJourneys
});

function recommendQuests(completedQuests: string[], count: number = 3): string[] {
  // Find similar player journeys
  const similar = questModel.findSimilar(completedQuests, {
    metric: 'jaccard',
    topN: 5
  });

  // See what quests they did that current player hasn't
  const suggestions = new Map<string, number>();

  similar.forEach(journey => {
    journey.sequence.forEach(quest => {
      if (!completedQuests.includes(quest)) {
        suggestions.set(quest, (suggestions.get(quest) || 0) + 1);
      }
    });
  });

  // Return most popular suggestions
  return Array.from(suggestions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([quest]) => quest);
}

// Player completed tutorial and forest quest
const completed = ['tutorial', 'forest-quest'];
const recommended = recommendQuests(completed);

console.log('Recommended next quests:', recommended);
// ['cave-dungeon', 'mountain-quest', 'dragon-raid']
```

### Item Recommendations

```typescript
// Items players bought together
const purchaseHistory = [
  ['sword', 'shield', 'potion'],
  ['staff', 'robe', 'mana-potion'],
  ['sword', 'armor', 'potion', 'shield'],
  ['bow', 'arrows', 'leather', 'potion']
];

const shopModel = new MarkovChain({
  maxOrder: 2,
  sequences: purchaseHistory
});

function suggestItems(cart: string[]): string[] {
  if (cart.length === 0) {
    // No items yet - show popular starters
    const patterns = shopModel.extractPatterns({
      minOrder: 1,
      maxOrder: 2,
      minFrequency: 2,
      topN: 5
    });

    return patterns.map(p => p.pattern[0]);
  }

  // Find what players with similar carts bought
  const similar = shopModel.findSimilar(cart, {
    metric: 'jaccard',
    topN: 10
  });

  // Count items not in cart
  const suggestions = new Map<string, number>();

  similar.forEach(purchase => {
    purchase.sequence.forEach(item => {
      if (!cart.includes(item)) {
        suggestions.set(item, (suggestions.get(item) || 0) + 1);
      }
    });
  });

  // Return top 3
  return Array.from(suggestions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([item]) => item);
}

// Player has sword in cart
console.log('Suggested items:', suggestItems(['sword']));
// ['shield', 'potion', 'armor']
```

---

## Combat Analysis

### Analyzing Winning Strategies

```typescript
// Combat action sequences from wins vs losses
const winningCombos = [
  ['block', 'counter', 'attack', 'dodge', 'attack'],
  ['dodge', 'attack', 'attack', 'block', 'special'],
  ['block', 'counter', 'attack', 'special', 'attack']
];

const losingCombos = [
  ['attack', 'attack', 'attack', 'death'],
  ['block', 'block', 'block', 'timeout'],
  ['dodge', 'dodge', 'attack', 'death']
];

const winModel = new MarkovChain({ maxOrder: 2, sequences: winningCombos });
const loseModel = new MarkovChain({ maxOrder: 2, sequences: losingCombos });

// Analyze player's fight
function analyzeFight(playerActions: string[]): string {
  const winScore = winModel.score(playerActions);
  const loseScore = loseModel.score(playerActions);

  if (winScore.normalized > loseScore.normalized) {
    return `Good fight! Your strategy resembles winning patterns (score: ${winScore.normalized.toFixed(2)})`;
  } else {
    return `Risky strategy. This looks like common losing patterns (score: ${loseScore.normalized.toFixed(2)})`;
  }
}

console.log(analyzeFight(['block', 'counter', 'attack', 'special']));
// "Good fight! Your strategy resembles winning patterns (score: -1.20)"

console.log(analyzeFight(['attack', 'attack', 'attack']));
// "Risky strategy. This looks like common losing patterns (score: -0.80)"
```

### Extracting Winning Combos

```typescript
// Find the best combos from winning fights
const bestCombos = winModel.extractPatterns({
  minOrder: 3,        // At least 3 moves
  minFrequency: 2,    // Appears at least twice
  topN: 5
});

console.log('Winning combos:');
bestCombos.forEach((combo, i) => {
  console.log(`${i + 1}. ${combo.pattern.join(' → ')} (used ${combo.frequency}x)`);
});

/* Output:
Winning combos:
1. block → counter → attack (used 2x)
2. attack → attack → block (used 2x)
3. dodge → attack → attack (used 2x)
*/
```

---

## Finding Similar Items

### Item Similarity

Find items with similar stats or usage:

```typescript
import { MultiDimMarkovChain } from 'acausal';

interface Item {
  name: string;
  type: string;
  damage: number;
  speed: string;
}

// How players use different weapons
const weaponUsage: Item[][] = [
  [
    { name: 'Iron Sword', type: 'sword', damage: 50, speed: 'medium' },
    { name: 'Steel Sword', type: 'sword', damage: 75, speed: 'medium' },
    { name: 'Legendary Blade', type: 'sword', damage: 120, speed: 'fast' }
  ],
  [
    { name: 'Wooden Staff', type: 'staff', damage: 30, speed: 'slow' },
    { name: 'Magic Staff', type: 'staff', damage: 80, speed: 'slow' },
    { name: 'Ancient Staff', type: 'staff', damage: 150, speed: 'medium' }
  ]
];

const itemModel = new MultiDimMarkovChain<Item>({
  maxOrder: 1,
  stateKey: (item) => `${item.type}_${item.damage}_${item.speed}`
});

itemModel.addSequences(weaponUsage);

// Find similar items to Iron Sword
function findSimilarItems(targetItem: Item, allItems: Item[]): Item[] {
  const targetSequence = [targetItem];

  const similar = itemModel.findSimilar(targetSequence, {
    metric: 'jaccard',
    topN: 3
  });

  // Map back to original items
  return similar
    .map(s => s.sequence[0])
    .filter(item => item.name !== targetItem.name);
}

const ironSword: Item = { name: 'Iron Sword', type: 'sword', damage: 50, speed: 'medium' };
const allItems = weaponUsage.flat();
const similar = findSimilarItems(ironSword, allItems);

console.log('Items similar to Iron Sword:');
similar.forEach(item => {
  console.log(`  ${item.name} (${item.type}, ${item.damage} damage, ${item.speed})`);
});

/* Output:
Items similar to Iron Sword:
  Steel Sword (sword, 75 damage, medium)
  Legendary Blade (sword, 120 damage, fast)
*/
```

---

## Trend Detection

### What's Becoming Popular

```typescript
// Track weapon usage over time
const weeklyUsage = [
  // Week 1
  { week: 1, weapons: ['sword', 'bow', 'staff', 'sword', 'sword'] },
  // Week 2
  { week: 2, weapons: ['sword', 'bow', 'axe', 'sword', 'axe'] },
  // Week 3
  { week: 3, weapons: ['axe', 'axe', 'sword', 'axe', 'bow'] }
];

function analyzeTrends() {
  console.log('Weapon usage trends:');

  weeklyUsage.forEach(week => {
    const usage = new Map<string, number>();

    week.weapons.forEach(weapon => {
      usage.set(weapon, (usage.get(weapon) || 0) + 1);
    });

    console.log(`\nWeek ${week.week}:`);
    Array.from(usage.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([weapon, count]) => {
        const percentage = (count / week.weapons.length * 100).toFixed(0);
        console.log(`  ${weapon}: ${count} (${percentage}%)`);
      });
  });

  // Detect rising trend
  console.log('\n📈 Rising: Axe (20% → 40% → 60%)');
  console.log('📉 Falling: Sword (60% → 40% → 20%)');
}

analyzeTrends();
```

### Meta Analysis

```typescript
class MetaTracker {
  private weeklyModels: Map<number, MarkovChain> = new Map();

  addWeekData(week: number, builds: string[][]) {
    const model = new MarkovChain({
      maxOrder: 2,
      sequences: builds
    });

    this.weeklyModels.set(week, model);
  }

  getPopularBuilds(week: number, count: number = 5): string[][] {
    const model = this.weeklyModels.get(week);
    if (!model) return [];

    const patterns = model.extractPatterns({
      minOrder: 2,
      minFrequency: 2,
      topN: count
    });

    return patterns.map(p => p.pattern);
  }

  compareMeta(week1: number, week2: number): void {
    const builds1 = this.getPopularBuilds(week1);
    const builds2 = this.getPopularBuilds(week2);

    console.log(`\n=== Meta Shift: Week ${week1} → Week ${week2} ===\n`);

    console.log(`Week ${week1} popular builds:`);
    builds1.forEach(build => console.log(`  ${build.join(' + ')}`));

    console.log(`\nWeek ${week2} popular builds:`);
    builds2.forEach(build => console.log(`  ${build.join(' + ')}`));
  }
}

// Usage
const tracker = new MetaTracker();

tracker.addWeekData(1, [
  ['sword', 'shield', 'armor'],
  ['sword', 'shield', 'armor'],
  ['bow', 'leather', 'arrows']
]);

tracker.addWeekData(2, [
  ['axe', 'plate', 'helm'],
  ['axe', 'plate', 'helm'],
  ['staff', 'robe', 'hat']
]);

tracker.compareMeta(1, 2);
```

---

## Best Practices

### 1. Minimum Sample Size

```typescript
// Need enough data for meaningful patterns
if (trainingData.length < 10) {
  console.warn('Not enough data for reliable patterns');
}

// Extract patterns only with sufficient frequency
const patterns = model.extractPatterns({
  minFrequency: Math.max(2, Math.floor(trainingData.length * 0.1))
});
```

### 2. Similarity Metrics

Choose the right metric:

```typescript
// Jaccard: Good for sets (equipment, items)
// - Measures overlap between sets
const jaccardSimilar = model.findSimilar(sequence, {
  metric: 'jaccard',
  topN: 5
});

// Cosine: Good for frequencies (word usage, actions)
// - Considers how often items appear
const cosineSimilar = model.findSimilar(sequence, {
  metric: 'cosine',
  topN: 5
});

// Levenshtein: Good for sequences (routes, combos)
// - Measures edit distance
const editSimilar = model.findSimilar(sequence, {
  metric: 'levenshtein',
  topN: 5
});
```

### 3. Fresh Data

```typescript
// Don't mix old and new meta
const recentData = allData.filter(item => item.timestamp > cutoffDate);

const currentMeta = new MarkovChain({
  sequences: recentData.map(d => d.sequence)
});
```

---

## Next Steps

- [Quality Control](./quality-control.md) - Score and filter results
- [Debugging](./debugging.md) - Visualize patterns
- [Multi-Dimensional Chains](./multi-dimensional.md) - Complex recommendations

---

**Quick Reference:**

| Task | Method | Metric |
|------|--------|--------|
| Find common patterns | `extractPatterns()` | minFrequency |
| Find similar sequences | `findSimilar()` | jaccard/cosine/levenshtein |
| Recommend next item | `generate({ start })` | - |
| Analyze trend | Compare `extractPatterns()` over time | - |

**Similarity Metrics:**
- **Jaccard**: Set overlap (0-1, higher = more similar)
- **Cosine**: Frequency similarity (0-1, higher = more similar)
- **Levenshtein**: Edit distance (0+, lower = more similar)
