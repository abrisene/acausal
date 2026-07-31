

# acausal

[![npm version](https://badge.fury.io/js/acausal.svg)](https://badge.fury.io/js/acausal) [![GitHub version](https://badge.fury.io/gh/abrisene%2Facausal.svg)](https://badge.fury.io/gh/abrisene%2Facausal) [![Build Status](https://app.travis-ci.com/abrisene/acausal.svg?branch=master)](https://app.travis-ci.com/abrisene/acausal) [![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)](https://github.com/emersion/stability-badges#stable) [![Coverage Status](https://coveralls.io/repos/github/abrisene/acausal/badge.svg?branch=master)](https://coveralls.io/github/abrisene/acausal?branch=master)

*acausal* es un módulo de TypeScript que facilita la creación, edición y generación de datos pseudoaleatorios a partir de **Distribuciones Aleatorias Ponderadas** y **Cadenas de Markov**.


**Filosofía de Diseño**
- **Inmutable:** todas las clases se construyen sobre funciones puras que no mutan el estado, garantizando que los modelos mantengan su integridad y facilitando su uso con Redux.
- **Portable:** todas las clases se pueden serializar y deserializar fácilmente en objetos de transferencia de datos, lo que facilita su almacenamiento, transferencia y reconstrucción, independientemente de si se ejecutan en el cliente o en el servidor.
- **Fácil de usar:** todas las APIs están diseñadas para priorizar la usabilidad del desarrollador, facilitando la prototipación rápida e implementación de nuevos modelos.
- **Dependencias mínimas**: _acausal_ solo depende de [random-js](https://www.npmjs.com/package/random-js) y [scalr](https://www.npmjs.com/package/scalr) (que anteriormente formaban parte de _acausal_, pero se separaron para la versión 2.0.0).


**Ejemplos básicos:**
```typescript
import { MarkovChain, Distribution, Random } from 'acausal';

// Random Rarity Distribution
const dist = new Distribution({ seed: 1 });
dist.add('Green', 10);    // Common
dist.add('Blue', 5);      // Uncommon
dist.add('Purple', 1);    // Rare

dist.pick(10);

/* Results in:
[
  'Green',  'Green',  'Green',  'Blue',  'Green',
  'Blue',  'Purple', 'Green',  'Green',  'Green'
]
*/

// Markov Chain Name Generator
const mc = new MarkovChain({ seed: 1 });
mc.addSequence('alice'.split(''));
mc.addSequence('bob'.split(''));
mc.addSequence('erwin'.split(''));

console.log(mc.generate({ order: 1 }));

/* Results in:

[ 'a', 'l', 'i', 'n' ]

*/

// Random Numbers
const rand = new Random({ seed: 1 });

rand.integer(1, 6); // Roll 1d6

// Results in: 6

```

## Enlaces rápidos

- [Inicio de _acausal_](https://github.com/abrisene/acausal/#readme)
- [Inicio rápido de Distribución Aleatoria](https://github.com/abrisene/acausal/blob/master/readme/distribution.md#acausal-)
- [Inicio rápido de Cadena de Markov](https://github.com/abrisene/acausal/blob/master/readme/markov.md#acausal-)

## Instalación

Ejecuta:

```bash
npm install -s acausal
```

### Gocausal

*acausal* también está implementado en Golang. Puedes encontrar el módulo aquí:
* [Gocausal](https://github.com/abrisene/gocausal)

## Distribuciones Aleatorias
Una **Distribución Aleatoria** es un modelo simple que puede simular extracciones de una distribución ponderada de elementos.

Las distribuciones se pueden usar para modelar extracciones aleatorias de una colección discreta de elementos, donde cada elemento tiene una probabilidad diferente de aparecer.

**Casos de uso de ejemplo:**

- Simular la repartición de una mano desde una baraja estándar (ver abajo).
- Simular el resultado de un juego de ruleta (o casi cualquier juego de casino).
- Generar color de ojos o cabello para una persona ficticia.
- Generar la clase espectral de estrellas ficticias.
- Modelar cuántas comidas de McDonald's necesitarías comprar para ganar Monopoly.
- Modelar cualquier sistema pseudoaleatorio a través de la observación.

**Ejemplo de inicio rápido de Distribución - Baraja de cartas:**
```typescript
import { Distribution } from 'acausal';

// Create a Deck of Cards
const suits = ['♣️', '♦️', '♥️', '♠️'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Combine the Suits and Ranks
const cards = suits.reduce((last, suit) => {
  return [...last, ...ranks.map(rank => `${rank}${suit}`)];
}, []);

/* Should result in:
[
  'A♣️',  '2♣️',  '3♣️',  '4♣️', '5♣️', '6♣️', '7♣️',
  '8♣️',  '9♣️',  '10♣️', 'J♣️', 'Q♣️', 'K♣️', 'A♦️',
  '2♦️',  '3♦️',  '4♦️',  '5♦️', '6♦️', '7♦️', '8♦️',
  '9♦️',  '10♦️', 'J♦️',  'Q♦️', 'K♦️', 'A♥️', '2♥️',
  '3♥️',  '4♥️',  '5♥️',  '6♥️', '7♥️', '8♥️', '9♥️',
  '10♥️', 'J♥️',  'Q♥️',  'K♥️', 'A♠️', '2♠️', '3♠️',
  '4♠️',  '5♠️',  '6♠️',  '7♠️', '8♠️', '9♠️', '10♠️',
  'J♠️',  'Q♠️',  'K♠️'
]
*/

// Create weighted source data for the Distribution
const src = cards.reduce((last, card) => ({ ...last, [card]: 1 }), {});

/* Should result in:
{
  'A♣️': 1,
  '2♣️': 1,
  '3♣️': 1,
  ...
  'J♠️': 1,
  'Q♠️': 1,
  'K♠️': 1,
}
*/

// Create the Distribution from the deck.
const deck = new Distribution({
  seed: 23,       // Random Seed - if this is empty it will be generated.
  source: src,    // The weighted source to generate the normalized Distribution from.
});

// Add in 2 Jokers
deck.add('🃏', 2);

// Generate 4 picks from the deck without replacement.
const picks = deck.pick(4, undefined, true);
console.log(picks);

/* Should print:

[ 'J♣️', '10♠️', '3♦️', '9♣️' ]

*/
```

Puedes aprender más sobre cómo usar Distribuciones Aleatorias con _acausal_ en el [Inicio rápido de Distribución Aleatoria](https://github.com/abrisene/acausal/blob/master/readme/distribution.md#acausal-).

## Cadenas de Markov

Una **Cadena de Markov** es un modelo matemático de un sistema en el que el estado futuro del sistema depende únicamente de su estado presente.

Las Cadenas de Markov suelen generarse construyendo un modelo estadístico a partir de datos de muestra, como una lista de nombres, que luego se puede utilizar para generar secuencias que se asemejen a los datos de muestra. Una propiedad útil de este proceso es que los datos de muestra se pueden "mezclar" entre sí como la pintura para lograr un resultado deseado.

Por ejemplo, si quisieras generar nombres que sonaran como una mezcla de irlandés y japonés, podrías generar una Cadena de Markov a partir de una muestra de nombres irlandeses y japoneses, y el modelo resultante podría generar nombres que combinaran ambos.

**Ejemplo de inicio rápido de Cadena de Markov - Generador de nombres:**
```typescript
import { MarkovChain } from 'acausal';

// Sample Data
const jpNames = ['honoka', 'akari', 'himari', 'mei', 'ema'];
const ieNames = ['grace', 'fiadh', 'emily', 'sophie', 'ava'];
const names = [...jpNames, ...ieNames];

// Prepare Data Source - the class expects an array of arrays.
const src = names.map(name => name.split(''));

/* Should result in:
[
  [ 'h', 'o', 'n', 'o', 'k', 'a' ],
  [ 'a', 'k', 'a', 'r', 'i' ],
  [ 'h', 'i', 'm', 'a', 'r', 'i' ],
  [ 'm', 'e', 'i' ],
  [ 'e', 'm', 'a' ],
  [ 'g', 'r', 'a', 'c', 'e' ],
  [ 'f', 'i', 'a', 'd', 'h' ],
  [ 'e', 'm', 'i', 'l', 'y' ],
  [ 's', 'o', 'p', 'h', 'i', 'e' ],
  [ 'a', 'v', 'a' ]
]
*/

// Create the Markov Chain from the source data.
const chain = new MarkovChain({
  seed: 33,       // Random Seed - if this is empty it will be generated.
  maxOrder: 2,    // Maximum Order - Chain will generate orders up to this value.
  sequences: src, // Source data, expects an array of arrays.
});

// Generate 5 picks.
for (let i = 0; i < 3; i += 1) {
  const pick = chain.generate({
    min: 4,       // Min Picks - This will force the model to pick at least 4 times.
    max: 10,      // Max Picks - Stops generation after 10 picks if no end has been reached.
    order: 2,     // Order - The largest gram size used to calculate the next pick.
    strict: false // Strict Order - Dynamically adjusts order up or down each pick if false.
  });
  console.log(pick.join(''));
}

/* Should print:

    sophimari
    emari
    hie

*/
```

Puedes aprender más sobre cómo usar Cadenas de Markov con _acausal_ en el [Inicio rápido de Cadena de Markov](https://github.com/abrisene/acausal/blob/master/readme/markov.md#acausal-)


## Documentación extendida de la API

Para la documentación de las clases y funciones subyacentes, consulta la [documentación de la API](https://abrisene.github.io/acausal/modules.html).
