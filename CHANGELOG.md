# Change Log

<a name="3.0.0"></a>
# [3.0.0](https://github.com/abrisene/acausal/compare/v3.0.0...v2.0.1) (2025-11-08)

### Breaking Changes

* **Build Output**: Changed from `lib/` to `dist/` directory
* **Modular Structure**: Markov chain source split into `src/structures/markov/` with separate files for chain, batch, blend, multi-dim, types, utils, defaults
* **Removed `ScaledMarkovChain`**: Needs full rewrite; use `MultiDimMarkovChain` for structured states
* **Removed analysis/export methods**: `extractPatterns()`, `findSimilar()`, `exportAsGraph()`, `diff()`, `toJSON()`, `rankByLikelihood()`, `isAnomaly()`, `withSelector()` removed from `MarkovChain`
* **Removed `IMarkovChain` interface** and `StateId` type
* **`MarkovChainConstructor` is no longer generic** (was `MarkovChainConstructor<T>`)
* **`interpolate()` restricted to same type parameter** (was `<U extends string>` with unsafe cast)
* **`MultiDimMarkovChain` constructor changed**: `stateKey` now accepts `string | StateKeyFunction<T>`; string keys are looked up in a named-function registry
* **Node.js**: Minimum version now 18+ (was 14+)
* **TypeScript**: Upgraded to 5.6.3 with stricter type checking

### Features

* **Generic Types**: `MarkovChain<T extends string = string>`, `Distribution<T extends string = string>`
* **Batch Operations**: `MarkovChainBatch` class for efficient bulk `addSequence`/`addEdge`
* **Chain Blending**: `MarkovChain.blend()` and `interpolate()` with 5 strategies (arithmetic, geometric, harmonic, max, min)
* **Static Dual-API**: `MarkovChain.blendDTOs()`, `MarkovChain.score()`, `MarkovChain.getStats()` operate on DTOs without requiring instances
* **Sequence Scoring**: `score()` returns log probability, perplexity, and validity
* **Constraint-Based Generation**: `MCConstraints` with minLength, maxLength, mustContain, mustNotContain, pattern, validator, maxRetries
* **MultiDimMarkovChain**: Structured state spaces with named-function registry for serializable state keys
* **MultiDimMarkovChain Serialization**: `serialize()` / `fromDTO()` round-trip, `registerStateKey()` / `getStateKey()` for portable state key functions
* **Utility Methods**: `hasGram()`, `getGramsByOrder()`, `getStats()`

### Bug Fixes

* **Gram frequency**: `addEdge` now correctly increments gram frequency
* **`clone(0)`**: `Random.clone(0)` preserves zero use count
* **Constraint retry**: Failed constraint retries return last attempt, not empty array
* **Null safety**: Proper null checks throughout with `noUncheckedIndexedAccess`

### Internal

* Replaced `tsc` with `tsup` for ESM/CJS dual output
* Modern TypeScript 5.6.3 with strict mode
* Jest v29 with full ESM support
* 95% test coverage threshold enforced

<a name="2.0.1"></a>
## [2.0.1](https://github.com/abrisene/acausal/compare/v2.0.1...v2.0.0) (2021-09-08)
* Added "Analyze" function to Markov Chains.
* Fixed a minor bug which caused the passed "start" sequence to be mutated during Markov generation in some circumstances.
* Temporary changes to CI version to avoid [node 16.8 issues](https://github.com/nodejs/node/issues/40030).

<a name="2.0.0"></a>
# [2.0.0](https://github.com/abrisene/acausal/compare/v2.0.0...v1.0.7) (2021-09-05)


### Features

* Full conversion to Typescript.
* Rewrote Markov Chain class.
* Rewrote "Transition Matrix" class, now named "Distribution".
* Wrote "Random" class, which wraps `random-js`.
* Rewrote Unit Tests.
* Test Coverage at > 99%
* Removed file loading utilities - these should be a separate module, or written ad hoc as needed with implementations.
* Wrote new readme and quickstart guides for Markov Chains and Distributions.
* Integration with Travis-CI and Coveralls.

<a name="1.0.7"></a>
## [1.0.7](https://github.com/abrisene/acausal/compare/v1.0.7...v1.0.1) (2021-04-16)


### Features

* Minor bugfixes.
* Updated npm developer dependencies.
* Added utilities for file loading.
* Added Unit Tests.
* Test Coverage at 83%.

<a name="1.0.1"></a>
# [1.0.0]() (2018-09-03)

### Features

* Initial Commit
* Markov Chain class allows creation of Markov Chains.
* Transition Matrix class allows creation of distributions used by Markov States.
* Utilities for managing async and creating deep copies.
