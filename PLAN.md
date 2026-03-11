# acausal v3.0.0 — Implementation Plan

This plan addresses the 31 issues documented in `ISSUES.md`, organized into phases that can be executed sequentially. Each phase produces a testable, committable unit of work.

---

## Phase 1: Critical Correctness Fixes

**Goal:** Fix all P0 issues. These are bugs that produce silently wrong results or corrupt state.
**Estimated scope:** ~4 hours

### 1A. Fix `Distribution.new()` shared singleton (Issue #1)

**File:** `src/structures/distribution.ts`

1. Change `Distribution.new()` no-args path to return `{ source: {}, normal: {} }` instead of `defaultDTO`
2. Change constructor default to `this._source = {}; this._normal = {}` instead of referencing `defaultDTO.source`/`defaultDTO.normal`
3. Add input validation in `Distribution.addSourceValues()` and `Distribution.addNormalValues()`:
   - Iterate values, throw `RangeError` if any value is `NaN` or `Infinity`
   - Leave negative weight validation as opt-in (not default) since negative deltas are used for weight adjustment
4. Add a static `Distribution.validate(dto)` method for user validation of deserialized DTOs

**Tests to add:**
- `Distribution.new()` returns independent objects (mutate one, other unaffected)
- `Distribution.new({ a: NaN })` throws
- `Distribution.new({ a: Infinity })` throws
- Constructor without args produces independent internal state

### 1B. Fix Box-Muller log(0) and logistic log(0) (Issue #2)

**File:** `src/services/sampler.ts`

1. In `normal()`: change `const u1 = this.next()` to `const u1 = 1 - this.next()` (shifts [0,1) to (0,1])
2. In `logistic()`: change `const u = this.next()` to `const u = 1 - this.next()` (same fix)
3. Both changes are one-line, same pattern, no behavioral difference for non-zero values

**Tests to add:**
- Verify `normal()` never produces Infinity/NaN over large sample count
- Verify `logistic()` never produces Infinity/NaN over large sample count

### 1C. Fix `pickWeighted` masking (Issue #3)

**File:** `src/services/random.ts`

Two sub-issues:
1. **Masking redistribution:** Rewrite `pickWeighted` to skip masked keys entirely when accumulating weights. Pre-compute the sum of unmasked weights, draw `value` in `[0, unmaskSum)`, iterate only unmasked keys. This gives proportional redistribution.
2. **`weightedChoice` normalization:** In `src/services/sampler.ts`, normalize the weight object before passing to `pickWeighted` in `weightedChoice()`.

**Tests to add:**
- Distribution test with 3+ keys, mask middle key, verify proportional redistribution over 10,000 samples
- `weightedChoice({ a: 10, b: 20, c: 30 })` produces correct proportions (not always 'a')

### 1D. Deep-clone gram distributions in `MarkovChain.clone()` (Issue #4)

**File:** `src/structures/markov/markov-chain.ts`

Change gram clone from:
```typescript
last: { ...gram.last },
next: { ...gram.next },
```
to:
```typescript
last: { source: { ...gram.last.source }, normal: { ...gram.last.normal } },
next: { source: { ...gram.next.source }, normal: { ...gram.next.normal } },
```

**Tests to add:**
- Clone a chain, mutate `clone.grams[key].next.source[x]`, verify original is unaffected

---

## Phase 2: High-Priority Fixes

**Goal:** Fix all P1 issues. These violate contracts or produce incorrect mathematical results.
**Estimated scope:** ~3 hours

### 2A. Fix blend weight renormalization (Issues #5, #6)

**File:** `src/structures/markov/blend.ts`

1. In `blendMultipleDistributions()`, for each key: collect the subset of models containing that key, compute the sum of their weights, renormalize weights over the subset before computing geometric/harmonic means
2. Guard against total weight = 0: if all weights for a key are 0, either skip the key or use arithmetic fallback
3. Fix single-distribution early return to clone instead of returning by reference (Issue #10)

**Tests to add:**
- Blend a model with itself at 0.5/0.5 — verify identity for all strategies
- Blend two models with non-overlapping grams — verify single-model gram values preserved exactly
- Blend with zero total weight — verify no null/NaN in output

### 2B. Fix `ImmutableMultiDimMarkovChain` engine sharing (Issue #7)

**File:** `src/structures/markov/immutable-multi-dim-chain.ts`

Change `this._engine` to `this._engine.clone()` in `addSequence` and `addSequences`.

**Tests to add:**
- Create immutable multi-dim chain, call addSequence, verify original's engine state unchanged after generation on the new instance

### 2C. Document `as this` limitation (Issue #8)

**Files:** `src/structures/distribution.ts`, `src/structures/markov/immutable-markov-chain.ts`, `src/structures/markov/immutable-multi-dim-chain.ts`

Add JSDoc comment on each class:
```typescript
/**
 * Note: Immutable variants are not designed for further subclassing.
 * The `this` return type is for method chaining convenience, not a
 * polymorphism guarantee.
 */
```

### 2D. Document `MultiDimMarkovChain.addSequence` state store mutation (Issue #9)

**File:** `src/structures/markov/multi-dim-chain.ts`

Add comment explaining the direct mutation of `this.stateStore` is intentional for the mutable variant. The immutable variant's override handles cloning.

---

## Phase 3: Input Validation

**Goal:** Fix all P2 validation issues. A library that silently returns NaN is worse than one that throws.
**Estimated scope:** ~3 hours

### 3A. Add sampler parameter validation (Issue #11)

**File:** `src/services/sampler.ts`

Add validation at the top of each method:
- `normal(mu, sigma)`: sigma ≥ 0 (sigma = 0 returns mu)
- `exponential(lambda)`: lambda > 0
- `poisson(lambda)`: lambda ≥ 0
- `binomial(n, p)`: n ≥ 0 integer, 0 ≤ p ≤ 1
- `geometric(p)`: 0 < p ≤ 1
- `beta(alpha, beta)`: both > 0
- `gamma(k, theta)`: k > 0, theta > 0
- `weibull(k, a)`: k > 0, a > 0
- `cauchy(a, b)`: b > 0
- `logistic(a, b)`: b > 0
- `logNormal(mu, sigma)`: sigma ≥ 0
- `truncatedNormal(mu, sigma, min, max)`: min ≤ max, sigma ≥ 0

Pattern: `if (!(condition)) throw new RangeError('methodName: description')` — one-liner per param.

**Tests to add:**
- Each degenerate case throws RangeError with descriptive message

### 3B. Add `generate()` min/max validation and empty-string rejection (Issues #14)

**File:** `src/structures/markov/markov-chain.ts`

1. In `generate()`: throw if `min > max`, throw if `min < 0` or `max < 0`
2. In `addSequence()` (static): throw if any element is empty string
3. In constructor: validate `maxOrder > 0`

**Tests to add:**
- `generate({ min: 10, max: 5 })` throws
- `addSequence(['', 'a'])` throws
- Constructor with `maxOrder: 0` throws

### 3C. Add delimiter collision warning (Issue #12)

**File:** `src/structures/markov/utils.ts`

In `addEdge` (or `getDelimiters`): if any sequence element matches a delimiter character, log a warning via `console.warn`. Don't throw — it's a design constraint, not an error. Document in CLAUDE.md and README.

### 3D. Add `stateKeyRegistry` collision detection (Issue #13)

**File:** `src/structures/markov/multi-dim-chain.ts`

1. In `registerStateKey`: if name exists and function reference differs, throw `Error('State key "name" is already registered with a different function')`
2. Add `unregisterStateKey(name: string)` export
3. Document singleton nature in JSDoc

---

## Phase 4: Immutable Variant Polish

**Goal:** Fix performance issues and contract completeness in immutable variants.
**Estimated scope:** ~2 hours

### 4A. Optimize `ImmutableMultiDimMarkovChain.addSequence` (Issue #17)

**File:** `src/structures/markov/immutable-multi-dim-chain.ts`

Replace the serialize → construct → addSequence → discard pattern with direct static delegation:
```typescript
const newModel = MarkovChain.addSequence(this.internalChain.serialize(), keys, ...);
// Use newModel directly to construct the new ImmutableMultiDimMarkovChain
```

### 4B. Add `.freeze()` and `.toMutable()` bridges (Issue #29)

**Files:** `src/structures/distribution.ts`, `src/structures/markov/markov-chain.ts`, `src/structures/markov/multi-dim-chain.ts`

Add to mutable classes:
```typescript
freeze(): ImmutableX<T> {
  return new ImmutableX<T>(this.serialize());
}
```

Add to immutable classes:
```typescript
toMutable(): X<T> {
  return new X<T>(this.serialize());
}
```

### 4C. Document PRNG correlation on fork (Issue #22)

Add JSDoc note on immutable variants explaining that forked instances share initial PRNG state and will produce identical sequences until their usage patterns diverge.

---

## Phase 5: API Surface Improvements

**Goal:** Address the DX issues from Neve's review. These are non-breaking improvements that make the library easier to learn and use.
**Estimated scope:** ~4 hours

### 5A. Fix Weibull three-parameter support (Issue #18)

**File:** `src/services/sampler.ts`

Implement location parameter: `weibull(k, a = 1, b = 0)` → `return a * Math.pow(-Math.log(1 - this.next()), 1 / k) + b`. Update `sampleDistribution` to pass `params.b`.

### 5B. Rename `last()` to `backward()` (Issue #27)

**Files:** `src/structures/markov/markov-chain.ts`, tests, types

Add `backward()` as the primary method. Keep `last()` as a deprecated alias:
```typescript
/** @deprecated Use backward() instead */
last(opts): T[] { return this.backward(opts); }
```

### 5C. Convert static factories to options objects (Issue #26)

**Files:** `src/structures/distribution.ts`, `src/structures/markov/markov-chain.ts`

For multi-param statics, add options-object overloads:
- `Distribution.pick(model, options: { count?, mask?, exclusive?, engine? })`
- `MarkovChain.new(options: { sequences?, maxOrder?, insert?, stripSequences? })`

Keep positional overloads as deprecated for backwards compat.

### 5D. Rename `truncatedNormal` (Issue #16)

**File:** `src/services/sampler.ts`

Add `clampedNormal()` as the primary method (honest name). Keep `truncatedNormal()` as deprecated alias. Add a true `truncatedNormal()` using rejection sampling:
```typescript
truncatedNormal(mu, sigma, min, max): number {
  let sample;
  do { sample = this.normal(mu, sigma); } while (sample < min || sample > max);
  return sample;
}
```

Note: this has non-deterministic draw count. Document the tradeoff.

### 5E. Update CHANGELOG and README (Issue #31)

Fix stale references: Jest → Vitest, random-js → internal MT19937.

---

## Phase 6: Test Coverage

**Goal:** Add statistical validation tests that Rhona identified as missing (Issue from Rhona F12).
**Estimated scope:** ~3 hours

### 6A. Statistical distribution shape tests

**File:** `src/__tests__/sampler.spec.ts`

Add for each distribution:
- Mean within expected tolerance over 10,000 samples
- Variance within expected tolerance
- Range validation (Poisson returns integers, geometric returns ≥ 1, etc.)
- KS test or chi-squared test for distribution shape validation

### 6B. Blend strategy validation

**File:** `src/__tests__/markov.spec.ts`

- 10,000 samples through each blend strategy
- Verify output distribution proportions match theoretical blend
- Test harmonic/geometric fallback produces correct arithmetic values for zero inputs

### 6C. Masking distribution test

**File:** `src/__tests__/random.spec.ts` or `distribution.spec.ts`

- 50,000-sample distribution test WITH masking
- Verify proportional redistribution after Phase 1C fix

---

## Execution Order

```
Phase 1 (P0 fixes)     → commit → run tests
Phase 2 (P1 fixes)     → commit → run tests
Phase 3 (validation)   → commit → run tests
Phase 4 (immutable)    → commit → run tests
Phase 5 (API surface)  → commit → run tests → version bump
Phase 6 (test coverage) → commit → full CI
```

Phases 1-3 are required before dropping the alpha tag.
Phase 4 is required for immutable variant correctness.
Phase 5 can be split — 5A-5B for v3.0.0, 5C-5D for v3.1.0 if time-constrained.
Phase 6 validates everything.

**Total estimated scope:** ~19 hours of focused work across 6 phases.
