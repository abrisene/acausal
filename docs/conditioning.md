# @acausal/conditioning

> **Status: planned — approved, not yet implemented.** Ownership ADR and full
> plan: `sigil-roadmap/specs/STOCHASTIC-CONDITIONING-SUBSTRATE-PLAN.md`
> (ownership gate closed 2026-08-01). Implementation is assigned to a clean
> dedicated worktree; this checkout carries unrelated in-flight work.

Evidence-conditioned inference and sampling over finite categorical
variables. Authors write variables, conditional weight rows, overlays,
exclusions, and admitted evidence as data; a compiler lowers them into a
bounded bipartite factor graph; exact variable elimination answers posterior
queries in any direction; deterministic ancestral sampling draws with
`@acausal/random` seeded streams; and every result carries a receipt naming
the rules, evidence, overlays, factors, algorithm, and RNG stream that
produced it.

The proof fixture is directional consistency from one model:

```text
P(soldier | male)  = 0.6
P(male   | soldier) = 6/11
```

## Boundaries

The core contains **no** character/Novelty concepts, knowledge-graph
traversal, Mirk fixture loading, Gonk authorization, game admission state,
ECS scheduling, or a dependency on the pin-derive runtime. It accepts
already-authorized evidence as plain values. Weights are relative likelihood
modifiers conforming to the cross-lane numeric-semantics contract
(`sigil-roadmap/specs/NUMERIC-SEMANTICS-CONTRACT.md`): named dimension,
range, algorithm revision, owner; posteriors are never comparable across
model revisions. "Bounded" is enforced (domain sizes, factor count,
elimination width) with refusal receipts — never a hang.

## Relationship to pin-derive

The engines are one product conceived in two algebras — pin-derive returns
exactly derived *sets*, conditioning returns exactly determined
*distributions*; neither holds uncertainty. Three composition legs, ruled
2026-08-01 (canonical write-up:
`pin-derive/docs/specs/2026-08-01-conditioning-composition.md`):

1. **Fourth chooser** — the conditioning sampler commits weighted, seeded
   choices from pin-derive decision surfaces behind its `commit`/`refine`
   API.
2. **Tuner loop** — pin-derive authors this package's weight tables at
   design time (weights as ordinary bounded cells; the loot-box-vs-target-EV
   case), exporting the solved table as the authored model.
3. **Feasibility port** — at run time, a derived feasible set may bound what
   the posterior weighs. One-way: feasibility in, probability never back.

Discipline: this package never tunes a weight or narrows feasibility;
pin-derive never samples or interprets a weight. Zero-mass means "never
drawn," not "impossible."

## Family fit

Reuses `@acausal/random` (seeded streams). Check `@acausal/scalr` before
writing new proportional-rescaling math in the tuner adapter. No overlap
with `distributions`, `markov`, or `sampler` (verified 2026-08-01: the only
"conditional" in the family is a truncated-normal doc note in the sampler).
The `acausal` meta-package does **not** re-export this package until the API
settles.
