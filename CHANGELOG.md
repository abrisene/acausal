# Change Log

<a name="3.6.0"></a>
# [3.6.0](https://github.com/abrisene/acausal/compare/v3.6.0...v3.5.0) (2025-11-20)

### Features

**Wave Function Collapse (WFC) - First-Class Primitive**
* Added complete WFC implementation as a new first-class structure alongside Distribution and MarkovChain
* Topology-agnostic constraint-based procedural generation system
* 215 comprehensive tests with 100% pass rate

### WFC Core Features
* **`WFC` Class**: Main collapse algorithm with configurable entropy modes and constraint propagation
* **`WFCGrid2D` Adapter**: Convenient 2D grid generation with cardinal directions
* **`WFCConstraintLearner`**: Automatic constraint extraction from example grids
* **`WFCSymmetry`**: Dimension-agnostic symmetry transformations for automatic constraint generation
* **Three Entropy Modes**: Count (fast), Shannon (balanced), Weighted-Shannon (frequency-aware)
* **Custom Entropy Functions**: Define your own collapse priority logic
* **Boundary Conditions**: Wrap (toroidal), open, and fixed boundaries with per-dimension configuration
* **Backtracking**: Intelligent contradiction recovery with configurable depth and retry limits
* **Deterministic Generation**: Seeded randomness for reproducible results
* **Serialization**: Full JSON serialization via toJSON/fromJSON
* **Statistics**: Model introspection with getStats()

### WFC API
```typescript
import { WFC, WFCGrid2D, WFCConstraintLearner } from 'acausal';

// Define or learn constraints
const constraints = WFCConstraintLearner.learn2DConstraints([example]);
const states = WFCConstraintLearner.extractStates([example]);

// Create WFC instance
const wfc = new WFC({ seed: 42, states, constraints });

// Generate 2D grid
const grid = new WFCGrid2D({ width: 20, height: 20, wfc });
const result = grid.generate();
```

### Type System
* **15+ New Types**: State, Dimension, CellId, WFCCell, WFCGraph, Adjacency, ConstraintRules, etc.
* **Configuration Types**: WFCOptions, WFCGenerateOptions, BoundaryConfig, SymmetryConfig, BacktrackConfig
* **Result Types**: WFCResult with success/contradiction/metadata
* **DTO Types**: WFCDTO for JSON serialization
* **Type Guards**: isBacktrackConfig, isBoundaryConfig, isEntropyFunction

### Performance
* **100x100 Grid**: ~500-800ms (simple to complex constraints)
* **1000x1000 Grid**: ~8-12 seconds (under 10s target)
* **Efficient Propagation**: Queue-based algorithm with visited tracking
* **Contradiction Detection**: Immediate failure on impossible states

### Boundary Conditions (Phase 3.2)
* **Three Boundary Modes**: Wrap (toroidal), open (no connections), fixed (preset states)
* **Per-Dimension Configuration**: Different boundary modes for each dimension
* **Global or Granular**: Simple string for all boundaries, or config object for fine control
* **Fixed State Specification**: Single state or array of valid states for fixed boundaries
* **Automatic Edge Handling**: Grid2D adapter automatically applies boundaries to edges
* **11 Comprehensive Tests**: Full coverage of all boundary modes and configurations

### Symmetry Support (Phase 3.3)
* **Dimension-Agnostic Design**: Works with 2D grids, 3D voxels, hex grids, and custom topologies
* **SymmetryTransform Interface**: Arbitrary dimension mappings for any topology
* **SYMMETRY_PRESETS**: Built-in transforms for grid2D (rotate90, rotate180, rotate270, flipH, flipV), hex (rotate60, etc.), and voxel3D (rotateX, rotateY, rotateZ)
* **Automatic Constraint Generation**: Apply symmetries to fill in missing constraint rules
* **Transform Composition**: Combine multiple transforms to create complex symmetries
* **Iterative Bidirectional Application**: Ensures all reachable dimensions are filled
* **Symmetry Detection**: Check if constraints are already symmetric
* **22 Comprehensive Tests**: 2D, 3D, hex, custom topologies, composition, and WFC integration

### Backtracking (Phase 3.4)
* **Intelligent Contradiction Recovery**: Explore alternative states instead of failing immediately
* **GraphSnapshot System**: Save/restore graph state at decision points
* **Configurable Limits**: maxDepth (default 100) and maxAttempts (default 1000)
* **State Exploration**: Track tried states per cell to avoid retrying failures
* **Boolean or Config**: Simple `backtrack: true` or detailed BacktrackConfig
* **Metadata Reporting**: Backtrack count included in WFCResult metadata
* **Automatic Fallback**: Separate paths for standard and backtracking collapse
* **13 Comprehensive Tests**: Configuration, behavior, edge cases, and contradiction handling

### Use Cases
* **Tile-Based Level Generation**: Dungeons, maps, puzzles with coherent tile placement
* **Texture Synthesis**: Generate seamless patterns matching example textures
* **Procedural Content**: Create content with local consistency constraints
* **Constraint Satisfaction**: Solve problems with adjacency rules
* **Pattern Learning**: Extract rules from hand-crafted examples
* **Toroidal Worlds**: Wrap-around maps with seamless edges
* **Fixed Boundaries**: Lock borders to specific states (walls, edges, etc.)
* **Symmetric Patterns**: Auto-generate constraints with rotational/reflective symmetry
* **Difficult Constraints**: Backtracking solves problems that would otherwise fail

### Implementation
* Topology-agnostic core (works on 2D grids, 3D voxels, graphs, custom structures)
* Constraint propagation with bidirectional rules
* Boundary condition support with per-dimension configuration
* Dimension-agnostic symmetry transformations with snapshot-based iteration
* Backtracking with GraphSnapshot system for contradiction recovery
* Integration with Distribution for weighted state selection
* Composable with MarkovChain for hybrid generation
* 215 comprehensive tests across all features (35 type + 180 API/feature tests)
* Comprehensive documentation in readme/advanced.md

### Files Added
* `src/structures/wfc-types.ts` - Complete type system (400+ lines)
* `src/structures/wfc.ts` - Core WFC implementation with backtracking (880+ lines)
* `src/structures/wfc-grid2d.ts` - 2D grid adapter with boundaries (280+ lines)
* `src/structures/wfc-learner.ts` - Constraint learning (282 lines)
* `src/structures/wfc-symmetry.ts` - Dimension-agnostic symmetry (240+ lines)
* `src/__tests__/wfc-types.spec.ts` - Type tests (502 lines)
* `src/__tests__/wfc-api.spec.ts` - API tests (1355+ lines)
* `src/__tests__/wfc-boundaries.spec.ts` - Boundary tests (445 lines)
* `src/__tests__/wfc-symmetry.spec.ts` - Symmetry tests (570+ lines)
* `src/__tests__/wfc-backtracking.spec.ts` - Backtracking tests (480+ lines)

### Documentation
* Comprehensive WFC section in readme/advanced.md (~700 lines)
* Quick start examples for 2D generation, learning, and weighted generation
* Complete API reference for WFC, Grid2D, and ConstraintLearner
* Configuration guide (entropy modes, frequency weights, noise)
* Performance benchmarks and optimization tips
* Serialization examples with model versioning

---

<a name="4.0.0"></a>
# [4.0.0](https://github.com/abrisene/acausal/compare/v4.0.0...v3.5.0) (2025-11-08)

### Breaking Changes

* **Major Version**: Incremented to v4.0.0 to reflect substantial new feature set
* No API breaking changes - fully backward compatible with v3.x

### Features

**Phase 10: Import/Export & Visualization Utilities**
* Added `exportAsGraph()` method for converting chains to node/edge graph format
* Added `diff()` method for comparing two chains and identifying differences
* Added `toJSON()` method for simplified JSON serialization
* 5 new comprehensive tests for export utilities (105 total tests passing)

### Export & Visualization Features
* **Graph Export**: Convert Markov chains to node/edge format for D3.js, Cytoscape, etc.
* **Chain Comparison**: Diff algorithm to identify added, removed, common, and modified grams
* **JSON Serialization**: Simplified export format for external tools and debugging
* **Metadata Tracking**: Include chain statistics in exports (order, gram count, sequence count)
* **Flexible Formats**: Support for multiple visualization and analysis tools

### Use Cases
* **Visualization**: Export to D3.js, Cytoscape, Graphviz for interactive chain visualization
* **Model Comparison**: Compare chains trained on different datasets
* **Debugging**: Inspect internal chain structure in readable format
* **Version Control**: Track changes in trained models over time
* **Data Exchange**: Share models with external tools and systems
* **Analysis**: Export for statistical analysis in Python, R, etc.

### Implementation
* Efficient graph conversion with separate nodes and edges
* Set-based diff algorithm for O(n+m) comparison
* Frequency tracking for modified grams
* Test coverage maintained at 95%+

<a name="3.5.0"></a>
# [3.5.0](https://github.com/abrisene/acausal/compare/v3.5.0...v3.4.0) (2025-11-08)

### Features

**Phase 9: Pattern Extraction & Analysis**
* Added `extractPatterns()` method for discovering frequent patterns in training data
* Added `findSimilar()` method with multiple similarity metrics (Jaccard, Cosine, Levenshtein)
* 6 new comprehensive tests for pattern analysis (100 total tests passing)

### Pattern Analysis Features
* **Pattern Extraction**: Discover frequent n-grams with configurable frequency thresholds
* **Similarity Search**: Find sequences similar to a target using multiple metrics
* **Jaccard Similarity**: Set-based similarity for comparing unique elements
* **Cosine Similarity**: Vector-based similarity for frequency-weighted comparison
* **Levenshtein Distance**: Edit distance for sequence transformation costs
* **Flexible Filtering**: Configure min/max order, frequency, threshold, and top-N results

### Use Cases
* **Data Mining**: Discover common patterns in sequence data
* **Deduplication**: Find and merge similar sequences
* **Recommendation**: Suggest similar items based on sequence similarity
* **Clustering**: Group similar sequences for analysis
* **Pattern Recognition**: Identify repeated motifs in generated content

### Implementation
* Efficient pattern extraction from existing gram structures
* Three similarity metrics with normalized 0-1 scoring
* Configurable thresholds and result limits
* Test coverage maintained at 95%+

<a name="3.4.0"></a>
# [3.4.0](https://github.com/abrisene/acausal/compare/v3.4.0...v3.3.0) (2025-11-08)

### Features

**Phase 8: Sequence Scoring & Constraint-Based Generation**
* Added `score()` method for calculating log probability and perplexity of sequences
* Added `rankByLikelihood()` for ranking multiple sequences by their likelihood
* Added `isAnomaly()` for detecting unusual/suspicious sequences
* Added constraint-based generation with `MCConstraints` interface
* 12 new comprehensive tests for scoring and constraints (94 total tests passing)

### Scoring Features
* **Log Probability**: Calculate exact likelihood of any sequence
* **Perplexity Metrics**: Quality scoring with normalized perplexity values
* **Sequence Ranking**: Rank and compare multiple candidate sequences
* **Anomaly Detection**: Identify outliers and suspicious patterns
* **Order-Aware Scoring**: Score with different Markov orders for flexibility

### Constraint Features
* **Length Constraints**: `minLength` and `maxLength` for precise control
* **Element Requirements**: `mustContain` and `mustNotContain` for required/forbidden states
* **Pattern Matching**: Regex pattern support for format validation
* **Custom Validators**: User-defined validation functions for domain rules
* **Retry Logic**: Configurable `maxRetries` with graceful degradation
* **Combined Constraints**: All constraints can be used together

### Use Cases
* **Quality Control**: Filter generations by perplexity scores
* **Autocomplete**: Rank suggestions by likelihood
* **Input Validation**: Detect anomalous user input
* **Content Filtering**: Block unwanted patterns with custom validators
* **Username Generation**: Enforce business rules and format requirements
* **Anomaly Detection**: Identify unusual patterns in sequences
* **Grammar Rules**: Enforce structural constraints in generated text

### Documentation
* Added scoring and constraint sections to `readme/markov.md`
* Created `examples/scoring-and-constraints.ts` with 10 practical examples
* Comprehensive API documentation for all new methods

### Performance
* Efficient log probability calculations using existing gram distributions
* Retry logic with early termination for impossible constraints
* Minimal overhead for unconstrained generation (default path unchanged)
* Test coverage maintained at 95%+

<a name="3.3.0"></a>
# [3.3.0](https://github.com/abrisene/acausal/compare/v3.3.0...v3.2.0) (2025-11-08)

### Features

**Phase 7: Multi-Dimensional Chains**
* Added `MultiDimMarkovChain<T>` class for structured state spaces
* Preserves multi-attribute state structure without flattening to strings
* `StateKeyFunction<T>` pattern for user-defined state-to-key mapping
* Internal `StateStore` maintains original structured state objects
* All methods return structured states, not flattened strings
* 8 new comprehensive tests for multi-dimensional chains (82 total tests passing)

### Use Cases
* Tile-based procedural generation (WFC-style) with terrain, coordinates, and biomes
* RPG character state machines with action, emotion, location, and time
* Spatial/coordinate-based systems with entity positions and velocities
* Game event systems with multi-attribute context (level, quest stage, difficulty)
* Any system requiring structured states with multiple independent attributes

### Breaking Changes from v2.x
* Previously required manual flattening: `${terrain}_${x}_${y}` → string
* Now preserves structure: `{ terrain, x, y, biome }` → full object

### Documentation
* Added multi-dimensional chains section to `readme/markov.md`
* Created `examples/multi-dimensional-chains.ts` with 5 practical examples
* Comprehensive API documentation with structured state patterns

### Performance
* Immutable operations create new chains without mutations
* Efficient internal key-based Markov calculations
* Structure preservation with zero serialization overhead
* Test coverage maintained at 95%+

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
