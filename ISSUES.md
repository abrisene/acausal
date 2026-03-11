# acausal v3.0.0 — Consolidated Issue Tracker

Consolidated from four independent reviews (2026-03-11):
- **Rhona Okafor** — Stochastic correctness, distributional pathology
- **Neve Laine** — API design, developer experience
- **Annika Sorrensen** — Architecture, type safety, systemic integrity
- **Declan Muir** — Operational readiness, error paths, release blockers

---

## P0 — Critical / Release Blockers

### 1. `Distribution.new()` returns a shared mutable singleton
**Files:** `src/structures/distribution.ts` (lines 387-389, 103-104)
**Found by:** Annika (C2), Declan (F1 — NaN variant)

`Distribution.new()` with no arguments returns the module-level `defaultDTO` directly, not a copy. Any caller mutating the result corrupts the library's global state for all subsequent callers in the same process. The constructor has the same issue — `this._source = defaultDTO.source` assigns the shared reference.

Additionally, `Distribution.new({ a: NaN })` silently produces NaN normals that corrupt all downstream picks (Declan F1). No error, no warning.

**Fix:** Return `{ source: {}, normal: {} }` in the no-args path. Add input validation to reject NaN, Infinity, and optionally negative values in `addSourceValues`/`addNormalValues`.

### 2. Box-Muller log(0) singularity
**Files:** `src/services/sampler.ts` (lines 268-269)
**Found by:** Rhona (F1 — Critical), Annika (M1), implied by Declan (F4)

`normal()` draws u1 from `[0, 1)` which includes 0. If u1 = 0, `Math.log(0) = -Infinity`, producing Infinity/NaN in the normal sample. Propagates downstream to `gamma`, `beta`, `logNormal`, `truncatedNormal`. Probability ~2^-53 per draw, but with seeded PRNG replay this is a deterministic time bomb.

The same `log(0)` pattern affects `logistic()` (line 446) when u = 0.

**Fix:** Use `1 - this.next()` for u1 in Box-Muller (shifts range to `(0, 1]`). Apply same fix to `logistic()`. This is the standard practice.

### 3. `pickWeighted` masking produces incorrect distributions
**Files:** `src/services/random.ts` (lines 68-92)
**Found by:** Rhona (F3), Annika (H2), Declan (F2)

Three independent findings converging on the same bug:
- **Rhona:** Masked key's probability flows to predecessor in iteration order, not proportionally to remaining keys. With `{a: 0.5, b: 0.3, c: 0.2}` and b masked, 'a' gets 0.8 probability instead of correct 5/7 (~0.714).
- **Annika:** The sequential scan means the first eligible key absorbs all masked weight.
- **Declan:** `weightedChoice({ a: 10, b: 20, c: 30 })` always picks 'a' because `pickWeighted` requires normalized input but the API says normalization isn't needed.

**Fix:** Either renormalize without masked keys before picking, or use rejection sampling. Also normalize in `weightedChoice` since it's the public-facing API.

### 4. Shallow gram clone — mutation leak in `MarkovChain.clone()`
**Files:** `src/structures/markov/markov-chain.ts` (lines 617-636)
**Found by:** Annika (C1), Rhona (F5)

`clone()` spreads `gram.last` and `gram.next` but the inner `source` and `normal` dictionaries are shared by reference. Mutating `clone.grams['a'].next.source['b']` corrupts the original. Currently latent (all code paths replace rather than mutate in place), but the invariant is violated and any future direct manipulation triggers the bug.

**Fix:** Deep-clone `source` and `normal`:
```typescript
last: { source: { ...gram.last.source }, normal: { ...gram.last.normal } },
next: { source: { ...gram.next.source }, normal: { ...gram.next.normal } },
```

---

## P1 — High

### 5. Geometric/harmonic blend weight non-renormalization
**Files:** `src/structures/markov/blend.ts` (lines 77-84)
**Found by:** Rhona (F4)

When computing geometric mean over a subset of models (only those containing a given gram), weights are used as-is from global normalization instead of being renormalized over the subset. A gram present in only one model with weight 0.6 gets `value^0.6` instead of the value itself. Blending a model with itself at 0.5/0.5 for single-model grams produces `v^0.5` (square root) instead of `v`.

Harmonic has an analogous issue: single-value with w=0.5 gives `2v` instead of `v`.

**Fix:** Renormalize weights over the subset of models containing each key before computing means.

### 6. Zero-weight blend produces `null` type violation
**Files:** `src/structures/markov/blend.ts`
**Found by:** Declan (F6)

`blendDTOs([{model, weight: 0}, {model, weight: 0}])` produces grams where `next.normal` contains `null` values from `scalr`'s `normalizeObject` dividing 0/0. The type says `number`, runtime says `null`.

**Fix:** Guard in `blendDTOs` — if total weight is 0, throw or return empty chain.

### 7. `ImmutableMultiDimMarkovChain` doesn't clone engine on `addSequence`
**Files:** `src/structures/markov/immutable-multi-dim-chain.ts` (line 33)
**Found by:** Rhona (F9)

Returns instance sharing `this._engine` with the original, violating the immutability contract. Compare with `ImmutableMarkovChain.addSequence` which correctly does `engine: this._engine.clone()`.

**Fix:** Clone the engine: `this._engine.clone()`.

### 8. `as this` type lie in immutable variants
**Files:** `src/structures/distribution.ts`, `src/structures/markov/immutable-markov-chain.ts`, `src/structures/markov/immutable-multi-dim-chain.ts`
**Found by:** Annika (H1), Neve (noted)

All three immutable classes cast `new ImmutableX() as this`. If someone extends `ImmutableDistribution`, the returned instance is actually `ImmutableDistribution`, not their subclass. Runtime error, no type error.

**Fix:** Document as constraint: "Immutable variants are not designed for further subclassing." Consider returning the concrete type instead of `this`.

### 9. `MultiDimMarkovChain.addSequence` bypasses clone-on-write
**Files:** `src/structures/markov/multi-dim-chain.ts` (line 124)
**Found by:** Annika (H4)

`this.stateStore[key] = state` mutates the state store directly instead of following the clone-on-write contract. The internal chain mutation via instance method is correct (reassignment), but the state store mutation is asymmetric.

**Fix:** Document or make consistent with clone-on-write pattern.

### 10. `blendMultipleDistributions` returns input by reference for single-element array
**Files:** `src/structures/markov/blend.ts` (lines 55-57)
**Found by:** Annika (M5)

Single-distribution case returns `distributions[0]` by reference. Caller mutations propagate to source.

**Fix:** Return a shallow copy: `{ source: { ...distributions[0]!.source }, normal: { ...distributions[0]!.normal } }`.

---

## P2 — Medium

### 11. No parameter validation on `RandomSampler` methods
**Files:** `src/services/sampler.ts`
**Found by:** Annika (M3), Declan (F4)

- `geometric(0)` → `-Infinity`
- `exponential(0)` → `Infinity`
- `beta(0, 0)` → `NaN`
- `gamma(-1)` → `0` (should be undefined)
- `poisson(-5)` → `0` (should be undefined)
- `weibull(0)` → `0` (should be undefined)
- `binomial(-5, 0.5)` → `0` (incorrect)

None throw. All silently return meaningless values.

**Fix:** Add parameter validation. `gamma(k)` requires k > 0. `exponential(lambda)` requires lambda > 0. `geometric(p)` requires 0 < p ≤ 1. `beta(a, b)` requires both > 0. `poisson(lambda)` requires lambda ≥ 0. `weibull(k)` requires k > 0. `binomial(n, p)` requires n ≥ 0, 0 ≤ p ≤ 1.

### 12. Delimiter collision in Markov chains
**Files:** `src/structures/markov/utils.ts`, `src/constants/index.ts`
**Found by:** Declan (F3), Neve (noted)

If user data contains `○`, `⏐`, or `◍`, gram IDs collide with boundary markers. Sequences terminate prematurely. Configurable delimiters exist but the risk is undocumented.

**Fix:** Document the constraint prominently. Add validation warning in `addSequence` if elements match delimiters.

### 13. Global mutable `stateKeyRegistry` singleton
**Files:** `src/structures/markov/multi-dim-chain.ts`
**Found by:** Annika (M4), Declan (F5), Neve (noted)

Module-level `Map` with no collision detection, no cleanup, no namespacing. Silent overwrite on name collision.

**Fix:** Add collision detection (throw if name already registered with different function). Add `unregisterStateKey()`. Consider accepting a registry as constructor option for isolation.

### 14. No constructor/input validation on `Distribution` or `MarkovChain`
**Files:** `src/structures/distribution.ts`, `src/structures/markov/markov-chain.ts`
**Found by:** Annika (M6, D2), Declan (F1, F8, F9)

- `WeightedDistribution` admits NaN, Infinity, negative weights with no validation
- `MarkovChain` with `maxOrder: 0` silently produces empty grams from non-empty sequences
- Delimiter validation only triggers on `addSequence`, not at construction
- `generate({ min: 10, max: 5 })` silently produces length-5 sequences
- Empty-string sequence elements produce corrupt gram IDs

**Fix:** Validate at construction boundaries. Throw on NaN/Infinity in weights. Throw if min > max in generate. Reject empty strings in sequences.

### 15. Poisson normal approximation — draw count divergence
**Files:** `src/services/sampler.ts` (line 388)
**Found by:** Rhona (F2)

At the lambda=30 boundary, Knuth algorithm (variable draws) switches to normal approximation (exactly 2 draws). Two samplers with the same seed calling `poisson(29)` then `poisson(31)` vs `poisson(31)` then `poisson(29)` will diverge in PRNG state. This is a reproducibility hazard.

Also, `Math.round` has a bias (rounds 0.5 up).

**Fix:** Document the draw-count divergence. Consider using `Math.floor(x + 0.5)` for unbiased rounding.

### 16. `truncatedNormal` is actually a censored normal
**Files:** `src/services/sampler.ts` (lines 282-284)
**Found by:** Rhona (F6)

Clamping creates point masses at boundaries (~2.3% at each bound for N(0,1) clamped to [-2, 2]). Not a truncated normal. The comment is honest ("Uses clamping for deterministic draw count") but the method name is misleading.

**Fix:** Rename to `clampedNormal` or `censoredNormal`, or add a true `truncatedNormal` (rejection sampling) alongside. At minimum, document the distinction.

### 17. `ImmutableMultiDimMarkovChain.addSequence` creates throwaway instances
**Files:** `src/structures/markov/immutable-multi-dim-chain.ts` (lines 23-26)
**Found by:** Annika (H3)

Creates a throwaway `ImmutableMarkovChain` per call just to get a DTO: serialize → construct → clone → construct = 4 allocation-heavy operations per call. Compounds to 4N for `addSequences` with N sequences.

**Fix:** Use the static `MarkovChain.addSequence` directly on the DTO instead of constructing/discarding instance wrappers.

---

## P3 — Low / API Design

### 18. Weibull `b` parameter defined in type but unused
**Files:** `src/services/sampler.ts`
**Found by:** Rhona (F8)

`WeibullParams` defines optional `b` field. `sampleDistribution` ignores it. The `weibull()` method has no `b` parameter. Dead field suggesting an unfinished three-parameter Weibull.

**Fix:** Either implement three-parameter Weibull `W(k, a, b) = a * (-ln(1-U))^(1/k) + b`, or remove `b` from `WeibullParams`.

### 19. MT prewarm of 2000 draws is unnecessary
**Files:** `src/constants/index.ts`
**Found by:** Rhona (F11)

MT19937 seeding already initializes all 624 state words. The 2000-draw prewarm is cargo-culted and wastes cycles, especially when creating many engines.

**Fix:** Consider reducing or removing. If kept for adjacent-seed decorrelation, document why.

### 20. `analyze()` shares engine across forward/backward generation
**Files:** `src/structures/markov/markov-chain.ts` (lines 537-600)
**Found by:** Rhona (F13)

Forward and backward samples are correlated through shared engine state, reducing effective sample independence.

**Fix:** Document or use separate engines for forward/backward passes.

### 21. Constraint retry returns last failing attempt silently
**Files:** `src/structures/markov/markov-chain.ts` (line 534)
**Found by:** Annika (D3), Neve (noted)

If all retries fail, returns `lastAttempt ?? []` with no indication constraints weren't satisfied. Caller can't distinguish success from exhaustion.

**Fix:** Return `{ sequence: string[], constraintsSatisfied: boolean }` or add `onConstraintFailure` callback.

### 22. Engine cloning in immutable variants produces correlated PRNG streams
**Files:** `src/structures/markov/immutable-markov-chain.ts`, `src/structures/distribution.ts`
**Found by:** Annika (D1)

Forked immutable instances share the same seed + use count, producing identical PRNG sequences until paths diverge. Arguably correct for value semantics, but surprising.

**Fix:** Document. Or advance the clone's use count by 1 to decorrelate.

### 23. Internal MT helpers exported from barrel
**Files:** `src/services/mersenne-twister.ts`
**Found by:** Annika (D4)

`integer`, `real`, `bool`, `pick`, `createEntropy` are exported but `MersenneTwister19937` is not. The helpers can't be used without a type they can't construct.

**Fix:** Either export the engine type or don't export the helpers.

---

## P4 — API / DX Improvements (from Neve's review)

### 24. Dual API doubles learning surface
Static + instance for everything. The static API is the real API; the instance wraps it. Three static `add*` methods where one auto-detecting method covers the 80% case.

**Action:** Keep dual API but reduce exported static surface. Make `addSourceValues`/`addNormalValues` internal.

### 25. DTO type proliferation
Four distribution types (`DistributionSourceDTO`, `DistributionNormalDTO`, `DistributionDTO`, `DistributionConstructor`) for one conceptual shape. Five Markov chain types. Implementation distinctions leaked into the type surface.

**Action:** Consolidate to fewer user-facing types. Keep internal distinctions internal.

### 26. Static methods use positional parameters
`Distribution.pick(model, 5, undefined, true)` — unreadable. `MarkovChain.new(sequences, maxOrder, insert, stripSequences)` — four positional params.

**Action:** Convert static factories and multi-param statics to options objects.

### 27. `last()` means "backward direction"
Reads as "most recent." Every new user will misread this.

**Action:** Rename to `backward()` or `prev()`.

### 28. `MCInsertOption` is `boolean | 'start' | 'end' | 'middle'`
Boolean and string literals in one type. `true` means same as `'middle'`.

**Action:** Replace with `{ position: 'full' | 'start' | 'middle' | 'end' }`.

### 29. No `.freeze()` / `.toImmutable()` bridge
No runtime conversion between mutable and immutable variants. Common pattern (build mutably, then freeze) requires manual serialize-reconstruct.

**Action:** Add `.freeze()` on mutable variants, `.toMutable()` on immutable variants.

### 30. `RandomSampler` vs `Random` naming inconsistency
`float` vs `real`, `int` vs `integer` — two vocabularies for the same operations.

**Action:** Pick one naming convention. Since `RandomSampler` is the user-facing API, standardize on its names.

### 31. Stale CHANGELOG and README
CHANGELOG says "Jest v29" (migrated to Vitest). README mentions `random-js` dependency (replaced by internal MT19937).

**Action:** Update both before release.

---

## Summary by Priority

| Priority | Count | Scope |
|----------|-------|-------|
| P0 — Critical | 4 | Must fix before any release |
| P1 — High | 6 | Must fix before dropping alpha |
| P2 — Medium | 7 | Should fix for v3.0.0 |
| P3 — Low | 6 | Fix or document for v3.0.0 |
| P4 — DX | 8 | Polish pass, some for v3.0.0, some for v3.1.0 |
| **Total** | **31** | |
