# acausal Rust rewrite — API audit and proposed cuts

Date: 2026-09-04

Status: design proposal after source inspection and focused runtime probes. The Rust API sketches below are not implemented code.

## Judgment

The Rust rewrite can retain acausal's useful capabilities with substantially fewer public concepts and execution paths.

The central change is separating reusable models from random state. A model describes choices or transitions. An explicit random stream supplies each draw.

The second change is one implementation for each operation. Static DTO methods, mutable instances, immutable subclasses, and batch classes currently multiply the same work.

The existing `CLAUDE.md` mandates these variants. Its dual-API and immutable-variant rules need replacement when the rewrite begins.

The user's cleanup instruction supersedes carrying those rules into the new design.

## Scope and evidence

Three Luna agents at xhigh independently inspected Markov, random/distribution/sampler APIs, and conditioning. The main review inspected consumer calls and exercised narrow behavior probes.

Source scopes:

- `/Users/dr/Dev/platform/acausal`: branch `daemon-graph-review`, HEAD `f91ea9c5df0cb36fc3bd6d3b4bdb5e3630820849`, with existing uncommitted changes.
- `/Users/dr/Dev/platform/acausal-worktrees/conditioning`: clean branch `codex/acausal-conditioning`, HEAD `0d74519c89bb26d4f9b19d36804c1c44cd2519ff`.
- Game template callers using declared `acausal@3.0.0-alpha.3`.
- Novelty callers using declared `acausal@3.0.0-alpha.1`.

These findings describe the inspected source and callers. They are not claims about every published version or every studio consumer.

## Proposed public concepts

| Concept | Responsibility |
|---|---|
| `Rng` | Own random state, primitive draws, numeric sampling, snapshots, and explicit cloning |
| `Weighted<T>` | Store keyed values and raw weights; draw using a supplied `Rng` |
| `Markov<T>` | Learn sequences or authored transitions, generate, score, and inspect the model |
| `Model` | Compile a finite conditional model, answer posterior queries, and sample under explicit evidence |

Options, errors, and portable model descriptions support these concepts. They do not need parallel families of runtime objects.

Illustrative Rust usage:

```rust
let mut rng = Rng::seeded(42);
let rewards = Weighted::new([("potion", 8.0), ("sword", 2.0)])?;
let reward = rewards.draw(&mut rng)?;

let mut names = Markov::new(2)?;
names.learn(corpus)?;
let name = names.generate(&mut rng, options)?;

let model = Model::compile(description)?;
let odds = model.posterior("profession", &evidence, limits)?;
let person = model.sample(&mut rng, &evidence, limits)?;
```

The names and argument shapes are proposed. Define the new operation names and argument order consistently across Rust, TypeScript, and Python bindings.

Existing TypeScript names can change through an explicit migration map. Lifetime management follows each language's conventions.

## Cuts and consolidations

### 1. Collapse `Random` and `RandomSampler`

Both expose primitive random operations. `RandomSampler` wraps `Random`, then repeats primitive draws, weighted choice, state access, cloning, and serialization.

Use one random stream type. Numeric distributions are parameter values or methods backed by one implementation per distribution.

Retain convenient primitive operations such as integer and float draws. Choose one spelling instead of carrying `integer`/`int` and `real`/`float` aliases forward.

Named numeric methods and data descriptions may share an implementation. A data dispatcher is useful for authored documents, rather than a reason to duplicate algorithms.

Retain uniform, normal, clamped normal, log-normal, exponential, Poisson, binomial, geometric, beta, gamma, Weibull, Cauchy, logistic, and Bernoulli sampling.

Remove `truncatedNormal`, which currently aliases clamping. Its name promises a different distribution from the one implemented.

### 2. Remove random state from models

Weighted distributions, Markov models, and conditioning models receive an explicit random stream when they sample.

Model cloning copies model state. Stream cloning copies random state. A caller can cache a model without accidentally caching the next person's random history.

Constructors stop accepting competing `engine`, `seed`, and `uses` forms. A seeded stream and a restored stream have distinct constructors with complete required state.

Use a versioned snapshot of actual generator state for the new runtime. Current restoration replays every consumed draw from the seed.

Importing a legacy seed/use-count snapshot can perform that conversion once. It does not require a second ongoing random-state representation.

This directly simplifies consumer behavior. The game passes a sampler's engine into models, then manually catches up draw counts after name generation.

Novelty creates temporary distributions from fresh seeds and caches name chains with their own streams. An explicit stream parameter makes these choices visible.

### 3. Remove `MarkovChainBatch`

Bulk ingestion remains a capability. It becomes an ordinary operation over an iterator or collection using the same insertion logic as a single addition.

Mutation updates the owned model directly. A caller that needs a branch clones explicitly before editing.

The separate batch class currently compensates for repeated DTO cloning. Rust ownership makes that compensation unnecessary as a public product concept.

Even today, `addSequences()` already performs the clone-once bulk sequence operation. The batch class is a second interface to that capability.

Retain both corpus learning and authored transition updates. The game uses the latter for gacha graphs, so sequence training alone is insufficient.

The ordinary instance `addEdge()` omits its static counterpart's weight argument. The game uses the batch path to obtain weighted insertion.

Expose that weight on the single transition operation. Removing the batch class then removes a workaround rather than a capability.

A bulk binding call may reduce boundary overhead. It still executes the same model operation rather than introducing a second transaction-like API.

### 4. Remove mutable/immutable class pairs and static DTO operation mirrors

Use one runtime model type with explicit mutation and cloning. Rust borrowing supplies read-only access without a second public class hierarchy.

Documents import into that model and export from it. Documents do not also need a complete static manipulation API.

The inspected game and Novelty source imports the ordinary model classes. Searches found no direct imports of the immutable or multidimensional variants in those callers.

That is a scoped consumer observation, rather than proof that no other caller uses them. Removed APIs still need a migration map.

### 5. Store weights once

Keep raw weights authoritative. Compute normalized probabilities on demand, or cache them internally with explicit invalidation.

Remove public source-only versus normalized-only model modes and separate mutation methods for each representation.

Keep probability inspection. It is useful behavior even though the normalized representation does not need independent ownership.

The weighted API can return a stable item identifier or value directly. Callers should not need stringified array indices to sample structured rows.

Sampling distinct items remains supported. Requesting more items than available needs an explicit result rather than silently returning fewer under a success-shaped API.

Provide a single-draw operation and a collection operation using the same selection implementation. Collection options explicitly choose with or without replacement.

Per-call exclusions leave the stored weights unchanged. Draw probabilities remain proportional to the unmasked positive weights.

Reject nonfinite and negative resulting weights. Signed weight adjustments are valid when the resulting entries remain nonnegative.

A zero-total table has explicit empty support, rather than NaN probabilities or an implicit uniform fallback. Empty-support draws fail without advancing the stream.

Check an impossible distinct-count request before drawing. The result reports the shortfall without consuming random state.

### 6. Fold multidimensional Markov state into ordinary state identity

The current multidimensional class turns structured states into string keys and delegates to an ordinary chain.

Use stable token identities in the core. Native callers can associate typed values with those identities; bindings can retain serializable payloads alongside them.

Application-specific key functions remain caller code. A global named-function registry is unnecessary for portable model data.

This preserves structured state sequences. It does not turn a Markov chain into a conditional model over the fields inside each state.

### 7. Give conditioning two clear operations

The public questions are `posterior(target, evidence)` and `sample(evidence, rng)`. The method already specifies the operation.

Remove redundant query modes. Sampling a complete assignment does not need a dummy target variable.

Both operations use one evidence-validation and restriction path. Already-fixed targets produce a point distribution after the evidence has passed consistency checks.

Sampling under arbitrary evidence is the behavioral target. Choosing ancestral sampling or posterior-driven sampling is an internal algorithm decision with explicit limits and distribution semantics.

This is more than a rename. The existing sampler refuses evidence on non-root variables, so the rewrite must implement the missing sampling behavior deliberately.

### 8. Keep compiled internals and application provenance out of the basic API

Applications author variables, conditional weights, and exclusions. Compiled factors and assignment encodings remain internal.

Stable authored identifiers remain available for explanations. Optional diagnostic output can include factors, operation counts, and elimination order.

The basic model need not require ontology ancestry, source snapshots, or admission vocabulary to describe two related variables.

Overlay resolution and application evidence provenance can live in preprocessing or adapter code. Portable metadata preserves their useful context.

Public exports should describe consumer capabilities. The brute-force inference oracle, hash encoders, receipt builders, and normalization helpers can remain internal or test-only.

Several accepted fields currently promise behavior they do not supply. Overlay applicability fields are ignored, ontology edges affect receipts rather than inference, and derived predicates receive an empty context.

Remove these inactive promises from the probability core. Preserve an actual consumer transformation as preprocessing when it has defined behavior.

Conditional rows also repeat the enclosing table's target and parent scope. Declare those once on the table and let rows contain assignments and weights.

Feasibility input can be a resolved exclusion set with adapter-owned provenance. A remaining candidate is not thereby certified feasible, and unknown stays an explicit adapter outcome.

### 9. Keep the scalr utility collection out of the Rust public surface

Acausal's core imports only normalization, proportional rescaling, and sum helpers from scalr. Its public exports also include general arithmetic, statistics, merges, and array/object variants.

Use a small internal weight implementation for the operations acausal needs. Generic iterators replace the array/object duplication.

This does not retire the existing scalr package for other consumers. It prevents the acausal rewrite from inheriting an unrelated public utility collection.

## Behavior to preserve, and behavior to correct

Preserve reproducible streams, weighted draws, distinct draws, numeric distributions, sequence learning, authored transitions, generation, scoring, blending, and conditional inference.

Preserve serialization of meaningful models and random state. Keep exact continuation distinct from reconstructing a model with a fresh stream.

The rewrite can intentionally change API shape without treating every historical behavior as correct.

Focused conditioning probes established:

- An ordinary reverse query succeeds.
- Querying `profession` with known-valid evidence `profession = soldier` incorrectly returns `NoSupport`.
- ASCII assignment encoding round-trips, while `café` and `王` fail decoding.

The encoding failure comes from combining UTF-8 byte lengths with JavaScript string slicing. Structured internal assignments remove the need for this parser in the solve path.

The pinned-target failure requires shared evidence semantics and a direct point-distribution case. It must not become a compatibility fixture for the Rust implementation.

Two independently repeated Markov probes also established:

- A batch commit detaches the supplied random stream. The returned chain advances from 2000 to 2002 uses while the caller's stream stays at 2000.
- Scoring `["a", "z"]` against training sequence `["a", "b"]` incorrectly reports `isValid: true` and perplexity one.

The first problem disappears structurally with explicit stream parameters. Scoring must account for every transition, including unsupported transitions.

The game name helper's catch-up loop is redundant when its chain retains the supplied engine. It nevertheless demonstrates the caller's uncertainty about stream ownership.

Generation exhaustion, empty weighted choices, malformed numeric parameters, and incomplete inference need distinct errors or outcomes. A fallback policy belongs to the caller that selects it.

## Actual consumer migrations

| Current caller pattern | Proposed replacement |
|---|---|
| `RandomSampler`, then access `.engine` | One explicit `Rng` passed to the operation |
| Construct a `Distribution` for one weighted draw | Draw from a weighted view or reusable `Weighted<T>` |
| Convert items to string indices, draw, then parse the index | Draw an item identifier or typed value directly |
| `network.batch().addEdge(...).commit()` | Update authored transitions through one owned-model path |
| Advance a sampler until its use count catches a generated chain | Generation advances the supplied stream directly |
| Cache a chain with its own seed | Cache model data and supply the current stream for generation |
| Repeat static DTO manipulation beside instance methods | Import once, operate on the model, export when needed |

## Rewrite sequence

1. Record the narrowed API and replace the old dual-API mandate in the rewrite's project instructions.
2. Preserve the main worktree's uncommitted source and the conditioning branch as separately identified inputs.
3. Implement one Rust random stream and weighted-selection path, then exercise actual game and Novelty call shapes.
4. Implement Markov learning and transitions through one mutation path. Exercise names and the game's gacha traversal with a shared stream.
5. Implement conditioning with one evidence path and structured internal assignments. Exercise fixed-target queries and non-ASCII values.
6. Add bindings and explicit old-to-new migrations. Keep bulk transport convenient without recreating batch model classes.

The audit does not select a merge base or discard uncommitted improvements. That baseline decision needs the source comparison before implementation.

Tests preserve useful numerical and replay contracts after the real path works. Historical bugs become regression cases that the new behavior must correct.

Performance targets guide measurement. The immediate improvement is fewer concepts, explicit state ownership, and fewer independent implementations to keep consistent.

## Source pointers

- [Current dual-API mandate](/Users/dr/Dev/platform/acausal/CLAUDE.md)
- [Random API](/Users/dr/Dev/platform/acausal/packages/random/src/random.ts)
- [Sampler wrapper and distributions](/Users/dr/Dev/platform/acausal/packages/sampler/src/sampler.ts)
- [Weighted distribution variants](/Users/dr/Dev/platform/acausal/packages/distributions/src/distribution.ts)
- [Markov implementation](/Users/dr/Dev/platform/acausal/packages/markov/src/markov-chain.ts)
- [Batch implementation](/Users/dr/Dev/platform/acausal/packages/markov/src/batch.ts)
- [Conditioning exports](/Users/dr/Dev/platform/acausal-worktrees/conditioning/packages/conditioning/src/index.ts)
- [Conditioning assignment encoding](/Users/dr/Dev/platform/acausal-worktrees/conditioning/packages/conditioning/src/canonical.ts)
- [Game gacha traversal](/Users/dr/Dev/templates/game/packages/engine/src/gacha.ts)
- [Game name generation](/Users/dr/Dev/templates/game/packages/engine/src/names.ts)
- [Novelty name generation](/Users/dr/Dev/ai/novelty/packages/engine/src/names.ts)
- [Novelty weighted object sampling](/Users/dr/Dev/ai/novelty/packages/engine/src/appearance.ts:865)
