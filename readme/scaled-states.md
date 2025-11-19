# Scaled States (States with Magnitude)

**New in v3.2+**

This guide shows you how to work with states that have both a category AND a magnitude - perfect for combat systems, market prices, weather with temperature, and more.

## Table of Contents

- [What are Scaled States?](#what-are-scaled-states)
- [Combat Damage Prediction](#combat-damage-prediction)
- [Market Price Simulation](#market-price-simulation)
- [Player Mood/Morale Systems](#player-moodmorale-systems)
- [Health/Resource Fluctuation](#healthresource-fluctuation)
- [Advanced Techniques](#advanced-techniques)

---

## What are Scaled States?

Normal Markov chains only track categories:
```
'happy' → 'sad' → 'angry'
```

But what if you need more detail?
```
happy(+50) → sad(-30) → angry(-80)
```

**Scaled states** let you track both:
- **Category**: What state (happy, sad, angry)
- **Magnitude**: How much (50, -30, -80)

### Basic Example

```typescript
import { ScaledMarkovChain } from 'acausal';

// Weather with temperatures
const weatherData = [
  [
    { category: 'sunny', magnitude: 25 },   // 25°C
    { category: 'cloudy', magnitude: 22 },  // 22°C
    { category: 'rainy', magnitude: 18 },   // 18°C
    { category: 'sunny', magnitude: 26 }    // 26°C
  ],
  [
    { category: 'sunny', magnitude: 27 },
    { category: 'sunny', magnitude: 28 },
    { category: 'cloudy', magnitude: 23 },
    { category: 'rainy', magnitude: 17 }
  ]
];

const weatherChain = new ScaledMarkovChain<'sunny' | 'cloudy' | 'rainy'>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'  // Average the temperatures
});

// Add training data
weatherData.forEach(week => {
  weatherChain.addScaledSequence(week);
});

// Generate forecast
const forecast = weatherChain.generateScaled({ min: 5, max: 5 });

forecast.forEach((day, i) => {
  console.log(`Day ${i + 1}: ${day.category}, ${Math.round(day.magnitude)}°C`);
});

/* Output:
Day 1: sunny, 26°C
Day 2: sunny, 27°C
Day 3: cloudy, 23°C
Day 4: rainy, 18°C
Day 5: cloudy, 21°C
*/
```

**Why is this useful?**
- The chain learns that "sunny after sunny" tends to be slightly warmer
- "Rainy" days are consistently cooler
- Transitions feel realistic because magnitude changes smoothly

---

## Combat Damage Prediction

### Enemy Attack Patterns with Damage

Track not just WHAT attack comes next, but HOW HARD they'll hit:

```typescript
type AttackType = 'slash' | 'stab' | 'smash' | 'charge';

// Training data from boss fights
const bossAttackPatterns = [
  [
    { category: 'slash', magnitude: 50 },    // Light slash
    { category: 'slash', magnitude: 55 },    // Medium slash
    { category: 'smash', magnitude: 120 },   // Heavy smash!
    { category: 'stab', magnitude: 40 }      // Light stab
  ],
  [
    { category: 'charge', magnitude: 80 },   // Charge attack
    { category: 'smash', magnitude: 100 },   // Heavy smash
    { category: 'slash', magnitude: 60 },    // Follow-up slash
    { category: 'stab', magnitude: 45 }
  ],
  [
    { category: 'stab', magnitude: 40 },
    { category: 'stab', magnitude: 42 },
    { category: 'slash', magnitude: 70 },    // Bigger slash after stabs
    { category: 'smash', magnitude: 130 }    // VERY heavy smash!
  ]
];

const bossAI = new ScaledMarkovChain<AttackType>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'  // Average damage values
});

bossAttackPatterns.forEach(pattern => {
  bossAI.addScaledSequence(pattern);
});

// Predict next attack pattern
const nextAttacks = bossAI.generateScaled({ min: 4, max: 4, order: 2 });

console.log('Boss attack sequence:');
nextAttacks.forEach((attack, i) => {
  console.log(`Turn ${i + 1}: ${attack.category} (${Math.round(attack.magnitude)} damage)`);
});

/* Output:
Boss attack sequence:
Turn 1: slash (55 damage)
Turn 2: smash (115 damage)
Turn 3: stab (42 damage)
Turn 4: slash (65 damage)
*/
```

**Practical use:**
- AI displays "wind-up" animation length based on damage magnitude
- Player sees damage number prediction in UI
- Difficulty scales naturally (higher magnitudes later in fight)

### Combo System

Track attack combos with escalating damage:

```typescript
// Fighter combo patterns
const comboData = [
  [
    { category: 'punch', magnitude: 10 },
    { category: 'punch', magnitude: 12 },    // Combo +2
    { category: 'punch', magnitude: 15 },    // Combo +5
    { category: 'kick', magnitude: 30 }      // Finisher!
  ],
  [
    { category: 'punch', magnitude: 10 },
    { category: 'kick', magnitude: 20 },     // Early kick
    { category: 'punch', magnitude: 11 }     // Resets combo
  ]
];

const comboChain = new ScaledMarkovChain<'punch' | 'kick'>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

comboData.forEach(combo => {
  comboChain.addScaledSequence(combo);
});

// Generate a combo
const playerCombo = comboChain.generateScaled({ min: 4, max: 4 });

let totalDamage = 0;
playerCombo.forEach((move, i) => {
  console.log(`${move.category}: ${Math.round(move.magnitude)} damage`);
  totalDamage += move.magnitude;
});

console.log(`Total combo damage: ${Math.round(totalDamage)}`);

/* Output:
punch: 10 damage
punch: 12 damage
punch: 15 damage
kick: 30 damage
Total combo damage: 67
*/
```

---

## Market Price Simulation

### Supply and Demand

Simulate realistic market prices that rise and fall:

```typescript
type MarketTrend = 'rising' | 'stable' | 'falling' | 'crash' | 'boom';

// Historical market data (price trends with actual values)
const marketHistory = [
  [
    { category: 'stable', magnitude: 100 },
    { category: 'rising', magnitude: 105 },
    { category: 'rising', magnitude: 112 },
    { category: 'stable', magnitude: 110 },
    { category: 'falling', magnitude: 105 }
  ],
  [
    { category: 'stable', magnitude: 100 },
    { category: 'falling', magnitude: 95 },
    { category: 'crash', magnitude: 70 },    // Big drop!
    { category: 'rising', magnitude: 75 },   // Recovery
    { category: 'stable', magnitude: 90 }
  ],
  [
    { category: 'rising', magnitude: 100 },
    { category: 'boom', magnitude: 150 },    // Bubble!
    { category: 'crash', magnitude: 90 },    // Pop!
    { category: 'falling', magnitude: 85 },
    { category: 'stable', magnitude: 88 }
  ]
];

const marketSim = new ScaledMarkovChain<MarketTrend>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

marketHistory.forEach(trend => {
  marketSim.addScaledSequence(trend);
});

// Simulate next week of prices
const basePrice = 100;
const nextWeek = marketSim.generateScaled({ min: 7, max: 7, order: 2 });

console.log('Next week\'s prices:');
nextWeek.forEach((day, i) => {
  const price = Math.round(day.magnitude);
  const change = price - basePrice;
  const arrow = change >= 0 ? '↑' : '↓';

  console.log(`Day ${i + 1}: $${price} (${arrow} ${Math.abs(change)}%) [${day.category}]`);
});

/* Output:
Next week's prices:
Day 1: $100 (↑ 0%) [stable]
Day 2: $108 (↑ 8%) [rising]
Day 3: $110 (↑ 10%) [rising]
Day 4: $106 (↑ 6%) [stable]
Day 5: $95 (↓ 5%) [falling]
Day 6: $73 (↓ 27%) [crash]
Day 7: $78 (↓ 22%) [rising]
*/
```

### Buy/Sell Recommendations

Help players decide when to trade:

```typescript
function shouldBuyOrSell(currentPrice: number, market: ScaledMarkovChain<MarketTrend>): string {
  // Generate short-term forecast
  const forecast = market.generateScaled({ min: 3, max: 3 });

  // Average next 3 days
  const avgFuture = forecast.reduce((sum, day) => sum + day.magnitude, 0) / forecast.length;

  if (avgFuture > currentPrice * 1.1) {
    return `BUY! Price expected to rise to ~$${Math.round(avgFuture)}`;
  } else if (avgFuture < currentPrice * 0.9) {
    return `SELL! Price expected to fall to ~$${Math.round(avgFuture)}`;
  } else {
    return `HOLD. Price expected to stay around $${Math.round(avgFuture)}`;
  }
}

console.log(shouldBuyOrSell(100, marketSim));
// "BUY! Price expected to rise to ~$108"
```

### Seasonal Price Variations

Model seasonal effects on item prices:

```typescript
// Summer prices (high demand for cold drinks)
const summerPrices = [
  [
    { category: 'normal', magnitude: 10 },
    { category: 'high', magnitude: 15 },
    { category: 'high', magnitude: 18 },
    { category: 'normal', magnitude: 12 }
  ]
];

// Winter prices (low demand)
const winterPrices = [
  [
    { category: 'low', magnitude: 5 },
    { category: 'normal', magnitude: 8 },
    { category: 'low', magnitude: 6 },
    { category: 'low', magnitude: 5 }
  ]
];

const summerMarket = new ScaledMarkovChain<'low' | 'normal' | 'high'>({
  maxOrder: 1,
  magnitudeStrategy: 'mean'
});

const winterMarket = new ScaledMarkovChain<'low' | 'normal' | 'high'>({
  maxOrder: 1,
  magnitudeStrategy: 'mean'
});

summerPrices.forEach(p => summerMarket.addScaledSequence(p));
winterPrices.forEach(p => winterMarket.addScaledSequence(p));

// Get price based on season
function getSeasonalPrice(season: 'summer' | 'winter'): number {
  const market = season === 'summer' ? summerMarket : winterMarket;
  const price = market.pickScaled('normal'); // Start from normal price

  return Math.round(price?.magnitude || 10);
}

console.log('Cold drink price in summer:', getSeasonalPrice('summer'), 'gold');
// "Cold drink price in summer: 14 gold"

console.log('Cold drink price in winter:', getSeasonalPrice('winter'), 'gold');
// "Cold drink price in winter: 6 gold"
```

---

## Player Mood/Morale Systems

### Crew Morale

Track your crew's morale in a pirate/ship game:

```typescript
type Morale = 'mutinous' | 'unhappy' | 'neutral' | 'content' | 'loyal';

// Historical morale changes during voyages
const voyageLog = [
  [
    { category: 'content', magnitude: 70 },
    { category: 'content', magnitude: 72 },
    { category: 'neutral', magnitude: 60 },  // Ran out of rum
    { category: 'unhappy', magnitude: 40 },  // Storm damage
    { category: 'neutral', magnitude: 55 }   // Found treasure!
  ],
  [
    { category: 'neutral', magnitude: 60 },
    { category: 'unhappy', magnitude: 45 },
    { category: 'mutinous', magnitude: 20 }, // Very bad!
    { category: 'unhappy', magnitude: 35 },
    { category: 'neutral', magnitude: 50 }   // Intervention needed
  ]
];

const moraleChain = new ScaledMarkovChain<Morale>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

voyageLog.forEach(log => {
  moraleChain.addScaledSequence(log);
});

// Predict morale for next week
const moraleForec cast = moraleChain.generateScaled({ min: 7, max: 7 });

console.log('Crew morale forecast:');
moraleForecast.forEach((day, i) => {
  const level = Math.round(day.magnitude);
  const emoji = level > 70 ? '😊' : level > 50 ? '😐' : level > 30 ? '😞' : '😡';

  console.log(`Day ${i + 1}: ${day.category} (${level}%) ${emoji}`);

  // Warn about mutiny
  if (level < 30) {
    console.log('  ⚠️  WARNING: Mutiny risk!');
  }
});

/* Output:
Crew morale forecast:
Day 1: content (71%) 😊
Day 2: neutral (62%) 😐
Day 3: neutral (58%) 😐
Day 4: unhappy (42%) 😞
Day 5: unhappy (38%) 😞
Day 6: neutral (52%) 😐
Day 7: content (65%) 😐
*/
```

### Player Emotion System

Track player emotional state based on game events:

```typescript
type Emotion = 'excited' | 'happy' | 'calm' | 'stressed' | 'frustrated';

// Game events affect emotion
const emotionPatterns = [
  [
    { category: 'calm', magnitude: 50 },
    { category: 'excited', magnitude: 80 },  // Found loot!
    { category: 'happy', magnitude: 70 },
    { category: 'calm', magnitude: 55 }
  ],
  [
    { category: 'calm', magnitude: 50 },
    { category: 'stressed', magnitude: 30 }, // Died to boss
    { category: 'frustrated', magnitude: 20 }, // Died again
    { category: 'stressed', magnitude: 25 },
    { category: 'calm', magnitude: 40 }      // Took a break
  ]
];

const emotionChain = new ScaledMarkovChain<Emotion>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

emotionPatterns.forEach(pattern => {
  emotionChain.addScaledSequence(pattern);
});

// Predict emotional progression
function simulateGameSession(events: string[]): void {
  const emotions = emotionChain.generateScaled({ min: events.length, max: events.length });

  events.forEach((event, i) => {
    const emotion = emotions[i];
    console.log(`${event}: ${emotion.category} (${Math.round(emotion.magnitude)}%)`);

    // Adapt game difficulty
    if (emotion.magnitude < 30) {
      console.log('  💡 Suggestion: Reduce difficulty or offer help');
    }
  });
}

simulateGameSession([
  'Started level',
  'Defeated enemies',
  'Found treasure',
  'Boss fight',
  'Died to boss'
]);

/* Output:
Started level: calm (50%)
Defeated enemies: excited (78%)
Found treasure: happy (68%)
Boss fight: stressed (32%)
Died to boss: frustrated (22%)
  💡 Suggestion: Reduce difficulty or offer help
*/
```

---

## Health/Resource Fluctuation

### Regenerating Health

Model health regeneration that isn't linear:

```typescript
type HealthState = 'critical' | 'low' | 'medium' | 'high' | 'full';

// How health regenerates over time
const regenPatterns = [
  [
    { category: 'low', magnitude: 25 },
    { category: 'low', magnitude: 28 },      // Slow regen when low
    { category: 'medium', magnitude: 35 },
    { category: 'medium', magnitude: 42 },   // Faster in medium
    { category: 'high', magnitude: 70 },
    { category: 'full', magnitude: 100 }
  ],
  [
    { category: 'critical', magnitude: 10 },
    { category: 'critical', magnitude: 12 }, // Very slow regen when critical
    { category: 'low', magnitude: 20 },
    { category: 'low', magnitude: 26 },
    { category: 'medium', magnitude: 40 }
  ]
];

const healthRegen = new ScaledMarkovChain<HealthState>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

regenPatterns.forEach(pattern => {
  healthRegen.addScaledSequence(pattern);
});

// Simulate health regeneration
function simulateRegen(startHealth: number, turns: number): void {
  const startState: HealthState =
    startHealth < 20 ? 'critical' :
    startHealth < 40 ? 'low' :
    startHealth < 60 ? 'medium' :
    startHealth < 90 ? 'high' : 'full';

  console.log(`Starting health: ${startHealth}% (${startState})\n`);

  const regenSequence = healthRegen.generateScaled({
    min: turns,
    max: turns,
    order: 2
  });

  regenSequence.forEach((state, i) => {
    console.log(`Turn ${i + 1}: ${Math.round(state.magnitude)}% (${state.category})`);
  });
}

simulateRegen(15, 8);

/* Output:
Starting health: 15% (critical)

Turn 1: 12% (critical)
Turn 2: 21% (low)
Turn 3: 27% (low)
Turn 4: 38% (medium)
Turn 5: 45% (medium)
Turn 6: 68% (high)
Turn 7: 95% (full)
Turn 8: 100% (full)
*/
```

### Resource Depletion

Model how resources (mana, stamina, etc.) drain and recover:

```typescript
type StaminaState = 'exhausted' | 'tired' | 'normal' | 'rested';

// Stamina consumption during combat
const staminaPatterns = [
  [
    { category: 'normal', magnitude: 80 },
    { category: 'normal', magnitude: 75 },   // Light attack
    { category: 'tired', magnitude: 50 },    // Heavy attack
    { category: 'tired', magnitude: 45 },    // Another attack
    { category: 'exhausted', magnitude: 20 } // Too many attacks!
  ],
  [
    { category: 'rested', magnitude: 100 },
    { category: 'normal', magnitude: 85 },
    { category: 'normal', magnitude: 80 },
    { category: 'tired', magnitude: 55 },
    { category: 'normal', magnitude: 70 }    // Recovered a bit
  ]
];

const staminaChain = new ScaledMarkovChain<StaminaState>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

staminaPatterns.forEach(pattern => {
  staminaChain.addScaledSequence(pattern);
});

// Simulate combat stamina
const combatStamina = staminaChain.generateScaled({ min: 6, max: 6 });

console.log('Combat stamina:');
combatStamina.forEach((state, i) => {
  const stamina = Math.round(state.magnitude);
  const canHeavyAttack = stamina > 40;

  console.log(`Turn ${i + 1}: ${stamina}% (${state.category})`);
  if (!canHeavyAttack) {
    console.log('  ⚠️  Too tired for heavy attacks!');
  }
});
```

---

## Advanced Techniques

### Magnitude Sampling Strategies

Choose how to pick magnitude values:

```typescript
const chain = new ScaledMarkovChain<string>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'  // Default: average all seen magnitudes
});

// Other strategies:
// 'median' - pick the middle value (good for outlier-heavy data)
// 'sample' - randomly sample from historical values (most variety)
// 'weighted-sample' - sample based on frequency (balanced)
```

**When to use each:**
- **Mean** (default): Smooth, predictable values
- **Median**: When you have extreme outliers you want to ignore
- **Sample**: Maximum variety, but can be unpredictable
- **Weighted-sample**: Balanced variety with common values appearing more

### Get Statistics

Analyze magnitude distributions:

```typescript
// Get stats for a specific state
const stats = chain.getMagnitudeStats('rising');

console.log('Rising state magnitude stats:');
console.log('  Mean:', stats.mean);
console.log('  Median:', stats.median);
console.log('  Min:', stats.min);
console.log('  Max:', stats.max);
console.log('  Std Dev:', stats.stdDev);

/* Output:
Rising state magnitude stats:
  Mean: 108.5
  Median: 107
  Min: 105
  Max: 115
  Std Dev: 3.2
*/

// Get all historical magnitudes
const samples = chain.getMagnitudeSamples('rising');
console.log('All rising magnitudes:', samples);
// [105, 107, 112, 108, 110, 115]
```

### Get the Underlying Category Chain

Extract just the category transitions (ignoring magnitudes):

```typescript
const categoryChain = chain.getCategoryChain();

// Now you can use it like a normal MarkovChain
const categories = categoryChain.generate({ min: 5, max: 5 });
console.log('Categories only:', categories);
// ['rising', 'rising', 'stable', 'falling', 'stable']
```

---

## Performance Tips

### Pre-sample Magnitudes

If generating many values, pre-sample for better performance:

```typescript
class CachedScaledChain<T extends string> {
  private chain: ScaledMarkovChain<T>;
  private cache: Map<T, number[]> = new Map();

  constructor(chain: ScaledMarkovChain<T>) {
    this.chain = chain;
    this.warmCache();
  }

  private warmCache() {
    // Pre-sample 100 values for each category
    const categories = this.chain.getStates();

    categories.forEach(category => {
      const samples: number[] = [];
      for (let i = 0; i < 100; i++) {
        const sample = this.chain.getMagnitudeSamples(category);
        if (sample.length > 0) {
          samples.push(sample[Math.floor(Math.random() * sample.length)]);
        }
      }
      this.cache.set(category, samples);
    });
  }

  getScaledState(category: T): { category: T; magnitude: number } {
    const magnitudes = this.cache.get(category) || [];
    const magnitude = magnitudes[Math.floor(Math.random() * magnitudes.length)] || 0;

    return { category, magnitude };
  }
}
```

---

## Next Steps

- [Multi-Dimensional Chains](./multi-dimensional.md) - Multiple attributes at once
- [Chain Blending](./chain-blending.md) - Mix scaled chains
- [Game Generation](./game-generation.md) - Practical game examples

---

**Quick Reference:**

| Magnitude Strategy | Best For | Characteristic |
|-------------------|----------|----------------|
| `mean` | Smooth values | Averages all seen values |
| `median` | Data with outliers | Middle value, ignores extremes |
| `sample` | Maximum variety | Random historical value |
| `weighted-sample` | Balanced variety | Frequent values appear more |

**Creation:**
```typescript
const chain = new ScaledMarkovChain<CategoryType>({
  maxOrder: 2,
  magnitudeStrategy: 'mean'
});

chain.addScaledSequence([
  { category: 'state1', magnitude: 100 },
  { category: 'state2', magnitude: 150 }
]);

const result = chain.generateScaled({ min: 5, max: 5 });
// Returns: { category: string, magnitude: number }[]
```
