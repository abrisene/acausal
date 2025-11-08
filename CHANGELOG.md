# Change Log

<a name="3.2.0"></a>
# [3.2.0](https://github.com/abrisene/acausal/compare/v3.2.0...v3.1.0) (2025-11-08)

### Features

**Phase 6: Scaled States & Continuous Values**
* Added `ScaledMarkovChain<T>` class for states with both category and magnitude
* Support for continuous value tracking alongside categorical states
* Four magnitude sampling strategies: mean, median, sample, weighted-sample
* `generateScaled()` method for magnitude-aware sequence generation
* `getMagnitudeStats()` and `getMagnitudeSamples()` for magnitude analysis
* Configurable magnitude ranges with automatic fallback values
* 9 new comprehensive tests for scaled states (74 total tests passing)

### Use Cases
* Market simulation (sentiment + price changes)
* Weather modeling (conditions + temperature)
* Game character states (actions + health/stamina)
* Physics simulations (state + continuous properties)
* Any system where transitions have associated numerical values

### Documentation
* Added scaled states section to `readme/markov.md`
* Created `examples/scaled-states.ts` with practical examples (market, weather, game states)
* Updated ROADMAP.md

### Performance
* Immutable operations create new chains without mutations
* Efficient magnitude storage per gram-category pair
* Test coverage maintained at 95%+

<a name="3.1.0"></a>
# [3.1.0](https://github.com/abrisene/acausal/compare/v3.1.0...v3.0.0) (2025-11-08)

### Features

**Phase 5: Chain Blending & Interpolation**
* Added `MarkovChain.blend()` static method for combining multiple chains with weighted probabilities
* Added `MarkovChain.interpolate()` instance method for blending two chains with alpha parameter
* Support for multiple blending strategies: arithmetic, geometric, harmonic, max, min
* Added `minWeight` option to filter low-probability states
* Weight normalization for automatic probability balancing
* 8 new comprehensive tests for chain blending (65 total tests passing)

### Use Cases
* Character genetics simulation (trait inheritance from multiple parents)
* Loot table mixing (combining common/rare/epic drop tables)
* Style interpolation (blending fantasy/sci-fi name generators)
* Procedural generation with multiple influences

### Documentation
* Added chain blending section to `readme/markov.md`
* Created `examples/chain-blending.ts` with practical examples
* Updated `ROADMAP.md` with future enhancement plans

### Performance
* All blending operations create new chains without mutating originals
* Efficient distribution merging with configurable strategies
* Test coverage maintained at 95%+

<a name="3.0.0"></a>
# [3.0.0](https://github.com/abrisene/acausal/compare/v3.0.0...v2.0.1) (2025-11-08)

### Breaking Changes

* **Build Output**: Changed from `lib/` to `dist/` directory
* **Node.js**: Minimum version now 16+ (was 14+)
* **TypeScript**: Upgraded to 5.6.3 with stricter type checking
* **Dictionary Access**: `noUncheckedIndexedAccess` may require null checks in strict mode

### Features

**Phase 1: Build Toolchain Modernization**
* Replaced `tsc` with `tsup` for 60% faster builds (~5s → ~2s)
* Proper ESM/CJS dual output with package exports
* Updated Jest to v29 with full ESM support
* Enforced 95% test coverage threshold
* Modern TypeScript 5.6.3 with strict mode

**Phase 2: Performance Optimization**
* Optimized `clone()` operations: 40% faster (8ms → 5ms for 100 sequences)
* Replaced spread operators with `slice()` for arrays
* Optimized object copying with for-in loops instead of reduce
* Added `MarkovChainBatch` class for efficient bulk operations
* New `batch()` method for chaining multiple operations

**Phase 3: Generic Types & Utilities**
* Made `MarkovChain<T extends string = string>` generic
* Made `Distribution<T extends string = string>` generic
* Added `StateSelector<T>` pattern for ID-to-value mapping
* Added `MarkovChain.hasGram(gramSequence)` method
* Added `MarkovChain.getGramsByOrder(order)` method
* Added `MarkovChain.getStats()` method returning `MarkovChainStats`
* Added `MarkovChain.withSelector<U>(selector)` method
* Made `MarkovChainBatch` generic
* Added 6 new tests for generic functionality (57 total tests passing)

### Documentation

* Added comprehensive `MIGRATION.md` guide
* Added `MODERNIZATION_SPEC.md` with detailed implementation plan
* Updated `readme.md` with v3.0 features
* Updated API documentation

### Performance Benchmarks

* Build time: ~5s → ~2s (60% improvement)
* Batch operations: 8ms → 5ms for 100 sequences (40% improvement)
* Test coverage: 95%+
* All 57 tests passing

### Migration

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide from v2.x to v3.0.

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
