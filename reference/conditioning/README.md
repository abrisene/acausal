# @acausal/conditioning

A small, deterministic Bayesian-network engine for finite categorical data.

Most weighted-random libraries choose one value from one list. If you use them
to generate several related fields independently, you get combinations that
ignore what has already been chosen.

`@acausal/conditioning` lets you declare those relationships once. You can then:

- generate a record whose fields agree with one another;
- provide facts that are already known and update the remaining odds;
- ask questions in either direction;
- exclude impossible combinations;
- reproduce a result from the same seed.

## Do I need this?

Use [`@acausal/distributions`](https://github.com/abrisene/acausal/tree/main/packages/distributions)
if you need one weighted choice:

```text
mouse: 9
touch: 1
```

Use `@acausal/conditioning` if the right weights depend on another variable:

```text
device
  desktop: 1
  mobile:  1

input given desktop
  mouse: 9
  touch: 1

input given mobile
  mouse: 1
  touch: 9
```

From that one model, the package can:

```text
P(input = touch | device = mobile) = 0.9
P(device = desktop | input = mouse) = 0.9
```

It can also generate a complete `{ device, input }` record without maintaining
separate forward tables, reverse tables, and nested conditionals.

Use this package for small discrete models where exact answers, deterministic
generation, hard limits, and provenance matter. It is not intended for
continuous variables, large statistical models, or learned machine-learning
models.

## Install

```bash
npm install @acausal/conditioning
```

## Usage

```typescript
import { compileConditioningModel, inferPosterior, sampleForward } from '@acausal/conditioning';
import { sessionModel } from './session-model';

const compilation = compileConditioningModel(sessionModel);
if (!compilation.ok) throw new Error(compilation.error.kind);

const compiled = compilation.value;

// Ask in the authored direction.
const forward = inferPosterior(compiled, {
  targetId: 'input',
  evidence: [{ variableId: 'device', value: 'mobile' }],
  mode: 'posterior',
});

if (forward.ok) {
  forward.value.posterior.touch; // 0.9
}

// Ask in the reverse direction using the same model.
const reverse = inferPosterior(compiled, {
  targetId: 'device',
  evidence: [{ variableId: 'input', value: 'mouse' }],
  mode: 'posterior',
});

if (reverse.ok) {
  reverse.value.posterior.desktop; // 0.9
}

// Generate a reproducible complete record.
const generated = sampleForward(
  compiled,
  { targetId: 'input', evidence: [], mode: 'forward' },
  { seed: 42, streamName: 'test-session' }
);

if (generated.ok) {
  generated.value.assignment; // { device: 'mobile', input: 'touch' }, for example
}
```

<details>
<summary>Complete model used above</summary>

```typescript
import type { ConditioningModel } from '@acausal/conditioning';

export const sessionModel = {
  id: 'device-and-input',
  revision: '1',
  sourceSnapshotId: 'example:session:1',
  variables: [
    {
      id: 'device',
      kind: 'categorical',
      domain: ['desktop', 'mobile'],
      sourceRefs: ['example'],
    },
    {
      id: 'input',
      kind: 'categorical',
      domain: ['mouse', 'touch'],
      sourceRefs: ['example'],
    },
  ],
  tables: [
    {
      id: 'device-prior',
      targetId: 'device',
      parentScope: [],
      rows: [
        {
          id: 'device-root',
          targetId: 'device',
          parentScope: [],
          parentAssignment: {},
          outcomeWeights: [
            { outcome: 'desktop', baseWeight: 1 },
            { outcome: 'mobile', baseWeight: 1 },
          ],
          modifiers: [],
          sourceRefs: ['example'],
        },
      ],
    },
    {
      id: 'input-by-device',
      targetId: 'input',
      parentScope: ['device'],
      rows: [
        {
          id: 'input-desktop',
          targetId: 'input',
          parentScope: ['device'],
          parentAssignment: { device: 'desktop' },
          outcomeWeights: [
            { outcome: 'mouse', baseWeight: 9 },
            { outcome: 'touch', baseWeight: 1 },
          ],
          modifiers: [],
          sourceRefs: ['example'],
        },
        {
          id: 'input-mobile',
          targetId: 'input',
          parentScope: ['device'],
          parentAssignment: { device: 'mobile' },
          outcomeWeights: [
            { outcome: 'mouse', baseWeight: 1 },
            { outcome: 'touch', baseWeight: 9 },
          ],
          modifiers: [],
          sourceRefs: ['example'],
        },
      ],
    },
  ],
} satisfies ConditioningModel;
```

</details>

## What the package adds

- **Exact inference in either direction.** Author conditional tables in the
  natural direction, then query any variable from any admitted evidence.
- **Deterministic sampling.** The model revision, evidence, seed, and stream name
  identify a reproducible random stream.
- **Hard constraints.** Eligibility and feasibility rules remove impossible
  assignments instead of disguising them as low-probability outcomes.
- **Composable overlays.** More specific data can replace or modify base rules
  without copying the full model.
- **Bounded execution.** Domain size, factor count, elimination width, support,
  and operation limits refuse excessive work instead of silently approximating.
- **Receipts.** Compilation, inference, sampling, and refusals record the model,
  evidence, rules, factors, bounds, and algorithm revision used.

The package owns probability semantics only. Data retrieval, authorization,
constraint solving, persistence, and domain-specific concepts remain in the
applications that prepare or consume its data.

Part of the [acausal](https://github.com/abrisene/acausal) probabilistic and procedural generation toolkit.
