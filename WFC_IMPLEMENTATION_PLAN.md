# Wave Function Collapse - Implementation Plan

This document outlines the detailed implementation plan for WFC v3.6, broken down into phases with specific tasks, dependencies, and success criteria.

## Overview

**Goal**: Implement Wave Function Collapse as a first-class primitive in acausal
**Target Version**: v3.6.0
**Estimated Scope**: ~15-20 development sessions
**Test Coverage Target**: 95%+

## Phase 1: Core Types & Interfaces (1-2 sessions)

### Tasks

1.1. **Create `src/structures/wfc-types.ts`**
- Define core type system
- State, Dimension, Cell, Graph interfaces
- Options and configuration types
- Result types

**Success Criteria**:
- All types compile without errors
- Types align with architecture document
- Exported from structures/index.ts

**Files**:
- `src/structures/wfc-types.ts` (new)
- `src/structures/index.ts` (modified)

**Dependencies**: None

---

1.2. **Create type tests**
- Type inference tests
- Generic type constraints
- DTO type compatibility

**Success Criteria**:
- TypeScript compilation validates type safety
- No `any` types unless explicitly needed

**Files**:
- `src/__tests__/wfc-types.spec.ts` (new)

**Dependencies**: 1.1

---

## Phase 2: Core WFC Algorithm (3-4 sessions)

### Tasks

2.1. **Create `src/structures/wfc.ts` - Class skeleton**
- WFC class with constructor
- Private properties (constraints, frequencies, engine)
- Basic initialization

**Success Criteria**:
- Class instantiates successfully
- Constructor validates inputs
- Random engine properly initialized

**Files**:
- `src/structures/wfc.ts` (new)

**Dependencies**: 1.1

**Code Outline**:
```typescript
export class WFC {
  private constraints: ConstraintRules;
  private frequencies: Distribution<State>;
  private engine: Random;
  private options: WFCOptions;

  constructor(options: WFCOptions) {
    // Validation
    // Initialize constraints
    // Create frequency distribution
    // Set up random engine
  }
}
```

---

2.2. **Implement initialization logic**
- `private initialize(graph: WFCGraph): void`
- Set all cells to all possible states
- Reset collapsed flags

**Success Criteria**:
- All cells initialized with correct state sets
- Graph structure unchanged
- Deterministic given same seed

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-init.spec.ts` (new)

**Dependencies**: 2.1

**Tests**:
- Empty graph initialization
- Graph with pre-collapsed cells
- Large graph initialization performance

---

2.3. **Implement entropy calculation**
- `private calculateEntropy(cell: WFCCell, mode: EntropyMode): number`
- Support count, shannon, weighted-shannon modes
- Add entropy noise option

**Success Criteria**:
- Correct entropy values for each mode
- Weighted mode uses frequency distribution
- Noise adds small random variation

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-entropy.spec.ts` (new)

**Dependencies**: 2.2

**Tests**:
- Count mode: entropy = possibleStates.size
- Shannon mode: correct information entropy
- Weighted-Shannon mode: frequency-aware entropy
- Noise addition: deterministic with seed

---

2.4. **Implement observation (cell collapse)**
- `private findMinEntropyCell(graph: WFCGraph): WFCCell | null`
- `private collapseCell(cell: WFCCell): void`
- Use Distribution for weighted random selection

**Success Criteria**:
- Finds cell with minimum entropy
- Returns null when all collapsed or contradiction
- Collapse uses frequency weights correctly

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-observe.spec.ts` (new)

**Dependencies**: 2.3

**Tests**:
- Find minimum entropy among multiple cells
- Handle ties with entropy noise
- Weighted state selection
- All cells collapsed case
- Empty possible states (contradiction)

---

2.5. **Implement constraint propagation**
- `private propagate(cellId: CellId, graph: WFCGraph): boolean`
- `private getAllowedStates(states: Set<State>, dimension: Dimension): Set<State>`
- Queue-based propagation with visited tracking

**Success Criteria**:
- Constraints propagate to all affected neighbors
- Returns false on contradiction (empty state set)
- Returns true on successful propagation
- No infinite loops

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-propagate.spec.ts` (new)

**Dependencies**: 2.4

**Tests**:
- Single constraint propagation
- Chain propagation (domino effect)
- Contradiction detection
- Bidirectional constraints
- Complex constraint networks

---

2.6. **Implement main collapse loop**
- `public collapse(graph: WFCGraph, options?: WFCGenerateOptions): WFCResult`
- Observation → Propagation loop
- Success/failure detection

**Success Criteria**:
- Completes successfully for valid constraints
- Detects contradictions
- Returns proper result structure
- Deterministic with same seed

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-collapse.spec.ts` (new)

**Dependencies**: 2.5

**Tests**:
- Simple successful collapse (3x3 grid)
- Failed collapse (contradiction)
- Empty graph
- Partially pre-collapsed graph
- Large graph (100x100)

---

## Phase 3: Configuration Options (2-3 sessions)

### Tasks

3.1. **Implement entropy mode configuration**
- Support count, shannon, weighted-shannon
- Custom entropy functions
- Entropy noise

**Success Criteria**:
- All modes work correctly
- Custom functions callable
- Configuration validated

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-config-entropy.spec.ts` (new)

**Dependencies**: 2.6

---

3.2. **Implement boundary conditions**
- Wrap (toroidal)
- Open (unconstrained)
- Fixed (specific states)
- Per-dimension configuration

**Success Criteria**:
- Each boundary mode works correctly
- Per-dimension config supported
- Edge cases handled properly

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-boundaries.spec.ts` (new)

**Dependencies**: 2.6

**Tests**:
- Wrap: opposite edges connect
- Open: edges have no constraints
- Fixed: boundary cells locked to specific states
- Mixed: different boundaries per dimension

---

3.3. **Implement symmetry support (optional)**
- Rotational symmetry (4-way, 6-way, 8-way)
- Reflective symmetry (horizontal, vertical, both)
- Auto-generate symmetric constraints

**Success Criteria**:
- Constraints auto-generated correctly
- Manual constraints preserved
- Multiple symmetry types supported

**Files**:
- `src/structures/wfc-symmetry.ts` (new)
- `src/__tests__/wfc-symmetry.spec.ts` (new)

**Dependencies**: 2.6

**Priority**: Medium (can be deferred to v3.6.1)

---

3.4. **Implement backtracking (optional)**
- Track collapse history
- Restore to previous state on contradiction
- Bounded backtracking (maxDepth, maxAttempts)

**Success Criteria**:
- Backtracks on contradiction
- Deterministic with same seed
- Respects depth/attempt limits

**Files**:
- `src/structures/wfc-backtrack.ts` (new)
- `src/__tests__/wfc-backtrack.spec.ts` (new)

**Dependencies**: 2.6

**Priority**: Low (can be deferred to v3.6.2)

---

## Phase 4: Grid2D Adapter (2 sessions)

### Tasks

4.1. **Create Grid2D adapter**
- `src/structures/wfc-grid2d.ts`
- Convert 2D grid to WFCGraph
- Cardinal direction mapping (north, south, east, west)

**Success Criteria**:
- Creates valid WFCGraph from dimensions
- Neighbor calculation correct
- Integration with WFC class works

**Files**:
- `src/structures/wfc-grid2d.ts` (new)
- `src/__tests__/wfc-grid2d.spec.ts` (new)

**Dependencies**: 2.6

**Code Outline**:
```typescript
export class WFCGrid2D {
  constructor(options: { width: number; height: number; wfc: WFC }) {}

  private createGraph(): WFCGraph {
    // Create cells
    // Define getNeighbors function
    return { cells, getNeighbors };
  }

  generate(): State[][] {
    // Create graph
    // Collapse
    // Convert back to 2D array
  }
}
```

---

4.2. **Test Grid2D with known patterns**
- Simple patterns (checkerboard, stripes)
- Complex patterns (maze, dungeon)
- Edge cases (1x1, 1xN, Nx1)

**Success Criteria**:
- Generates expected patterns
- No invalid states
- Respects constraints

**Files**:
- `src/__tests__/wfc-grid2d-patterns.spec.ts` (new)

**Dependencies**: 4.1

**Tests**:
- Checkerboard pattern (alternating states)
- Horizontal stripes
- Vertical stripes
- Single cell
- Single row/column
- Large grid (100x100)

---

## Phase 5: Constraint Learning (2 sessions)

### Tasks

5.1. **Create constraint learner**
- `src/structures/wfc-learner.ts`
- Learn from 2D grid examples
- Count adjacencies, build rules

**Success Criteria**:
- Extracts valid constraint rules
- Handles multiple examples
- Weighted frequency calculation

**Files**:
- `src/structures/wfc-learner.ts` (new)
- `src/__tests__/wfc-learner.spec.ts` (new)

**Dependencies**: 4.2

**Code Outline**:
```typescript
export class WFCConstraintLearner {
  static learn2DConstraints(examples: State[][][]): ConstraintRules {
    // Iterate through examples
    // Count adjacencies
    // Build constraint rules
  }

  static learnWeightedConstraints(examples: State[][][]): ConstraintRules {
    // Count adjacencies with frequencies
    // Create Distribution objects
  }
}
```

---

5.2. **Test learned constraints**
- Learn from simple patterns
- Generate with learned rules
- Verify generated matches input style

**Success Criteria**:
- Learned rules produce similar outputs
- Multiple examples merge correctly
- Weighted constraints work properly

**Files**:
- `src/__tests__/wfc-learner-integration.spec.ts` (new)

**Dependencies**: 5.1

**Tests**:
- Learn from checkerboard, generate checkerboard
- Learn from multiple patterns, generate hybrid
- Weighted learning with frequency preservation

---

## Phase 6: Serialization (1 session)

### Tasks

6.1. **Implement toJSON/fromJSON**
- `public toJSON(): WFCDTO`
- `public static fromJSON(dto: WFCDTO): WFC`
- Serialize all configuration
- Include Distribution serialization

**Success Criteria**:
- Round-trip preserves all data
- Deterministic reconstruction
- Compatible with existing DTO pattern

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-serialization.spec.ts` (new)

**Dependencies**: 2.6, 3.x

**Tests**:
- Serialize and deserialize WFC instance
- Generate before and after serialization (same result)
- Large constraint set serialization

---

## Phase 7: Documentation & Examples (2 sessions)

### Tasks

7.1. **Create technical documentation**
- Update `readme/advanced.md` with WFC API reference
- Document all methods and options
- Type signatures and examples

**Success Criteria**:
- Complete API documentation
- Code examples compile
- Cross-references to game guides

**Files**:
- `readme/advanced.md` (modified)
- `readme/visualization.md` (modified, if exporting WFC graphs)

**Dependencies**: All implementation complete

---

7.2. **Create game development examples**
- Dungeon generation example
- Tile-based level generation
- Integration with MarkovChain

**Success Criteria**:
- Examples are practical and relatable
- Copy-paste ready code
- Performance tips included

**Files**:
- `examples/wfc-dungeon.ts` (new)
- `examples/wfc-terrain.ts` (new)
- `examples/wfc-markov-hybrid.ts` (new)

**Dependencies**: 7.1

---

7.3. **Update main documentation**
- Update README with WFC mention
- Update CHANGELOG with v3.6 features
- Update ROADMAP to mark v3.6 as complete

**Success Criteria**:
- Consistent version references
- Clear feature descriptions
- Migration notes if needed

**Files**:
- `readme.md` (modified)
- `CHANGELOG.md` (modified)
- `ROADMAP.md` (modified)

**Dependencies**: 7.2

---

## Phase 8: Performance & Polish (1-2 sessions)

### Tasks

8.1. **Performance benchmarks**
- Benchmark collapse speed on various grid sizes
- Profile entropy calculation performance
- Optimize hot paths

**Success Criteria**:
- 1000x1000 grid collapses in <10 seconds
- No memory leaks
- Efficient propagation

**Files**:
- `examples/performance-comparison.ts` (modified)
- `src/structures/wfc.ts` (modified, if optimizations needed)

**Dependencies**: All implementation complete

---

8.2. **Error handling & validation**
- Input validation
- Clear error messages
- Helpful debugging information

**Success Criteria**:
- Invalid inputs throw helpful errors
- Contradictions provide context
- Type guards where appropriate

**Files**:
- `src/structures/wfc.ts` (modified)
- `src/__tests__/wfc-errors.spec.ts` (new)

**Dependencies**: All implementation complete

---

## Testing Strategy

### Unit Tests (Target: 60+ tests)

**Per-Phase Test Counts**:
- Phase 1 (Types): 5 tests
- Phase 2 (Core): 25 tests
- Phase 3 (Config): 15 tests
- Phase 4 (Grid2D): 12 tests
- Phase 5 (Learning): 8 tests
- Phase 6 (Serialization): 5 tests
- Phase 8 (Errors): 5 tests

**Test Categories**:
1. **Happy Path**: Normal operations succeed
2. **Edge Cases**: Empty inputs, single elements, large inputs
3. **Error Cases**: Invalid inputs, contradictions
4. **Determinism**: Same seed produces same results
5. **Performance**: Large inputs complete in reasonable time

### Integration Tests

1. **End-to-End**: Create WFC → Configure → Generate → Verify
2. **Learned Constraints**: Learn → Generate → Compare to examples
3. **Serialization**: Create → Serialize → Deserialize → Generate
4. **Hybrid with MarkovChain**: Train chain → Use for WFC rules

---

## Success Criteria (Overall)

### Functional
- ✅ Core WFC algorithm works on abstract graphs
- ✅ Grid2D adapter generates valid outputs
- ✅ Constraint learning from examples works
- ✅ Serialization preserves all state
- ✅ Configuration options all functional

### Quality
- ✅ 95%+ test coverage
- ✅ All tests passing
- ✅ No TypeScript errors
- ✅ Lint passes (gts)
- ✅ Documentation complete

### Performance
- ✅ 100x100 grid: <1 second
- ✅ 1000x1000 grid: <10 seconds
- ✅ No memory leaks
- ✅ Deterministic with seeds

### Documentation
- ✅ Technical API reference
- ✅ Game development examples
- ✅ Architecture documented
- ✅ Migration guide if needed

---

## Risk Assessment

### High Risk
1. **Contradiction Handling**: Need robust detection and useful error messages
   - *Mitigation*: Extensive testing, clear error context

2. **Performance**: Large grids could be slow
   - *Mitigation*: Profile early, optimize hot paths, consider backtracking carefully

### Medium Risk
3. **Constraint Complexity**: Multi-level constraints may be complex
   - *Mitigation*: Start with first-order, add higher orders later

4. **Boundary Conditions**: Edge cases in topology
   - *Mitigation*: Comprehensive boundary tests

### Low Risk
5. **Serialization**: DTO complexity
   - *Mitigation*: Follow existing Distribution/MarkovChain patterns

---

## Deferred Features (Post v3.6.0)

These can be added in patch releases (v3.6.1, v3.6.2):

1. **Advanced Backtracking** (v3.6.1)
   - Full history tracking
   - Smart backtrack strategies
   - Performance optimization

2. **Symmetry Auto-generation** (v3.6.1)
   - Rotational symmetry (4-way, 6-way, 8-way)
   - Reflective symmetry
   - Combined symmetries

3. **Multi-Pass Generation** (v3.6.2)
   - Progressive collapse
   - Dynamic entropy adjustment
   - Constraint level adaptation

4. **Additional Adapters** (v3.7.0)
   - Grid3D (voxels)
   - HexGrid (hexagonal tiling)
   - Voronoi (irregular tessellation)

5. **Visualization Support** (v3.7.0)
   - Export WFC state to graph format
   - Step-by-step collapse visualization
   - Debugging utilities

---

## Timeline Estimate

**Fast Track** (focused implementation):
- Week 1: Phases 1-2 (types + core algorithm)
- Week 2: Phases 3-4 (config + Grid2D)
- Week 3: Phases 5-6 (learning + serialization)
- Week 4: Phases 7-8 (docs + polish)

**Total**: ~4 weeks for v3.6.0 core release

**Extended** (with deferred features):
- v3.6.1 (backtracking + symmetry): +1 week
- v3.6.2 (multi-pass): +1 week
- v3.7.0 (additional adapters): +2 weeks

---

## Next Steps

1. **Review this plan** - Adjust scope, priorities, timeline
2. **Write API tests first** - Define the interface through tests
3. **Implement in phases** - Follow plan sequentially
4. **Iterate based on feedback** - Adjust as implementation reveals issues

This plan provides a roadmap from initial types through to a polished v3.6.0 release with WFC as a first-class primitive in acausal.
