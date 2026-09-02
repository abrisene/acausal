/*
 # fixtures.spec.ts
 # Golden conformance replay for @acausal/random.
 #
 # Replays fixtures/random.json and asserts EXACT equality — `toBe`, never
 # `toBeCloseTo`. Every value here is integer or basic floating-point
 # arithmetic over MT19937 output, so there is no tolerance argument to make.
 # Regenerate with `pnpm gen:fixtures` and read the diff.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { Random } from './random';

interface EngineState {
  seed: number | number[];
  uses: number;
}

interface Step {
  op: string;
  args: unknown[];
  value: unknown;
  state: EngineState;
}

interface RandomCase {
  name: string;
  seed: number | number[];
  uses?: number;
  resumeAt?: number;
  steps: Step[];
}

const fixtures = JSON.parse(
  readFileSync(new URL('../../../fixtures/random.json', import.meta.url), 'utf8')
) as { schema: number; cases: RandomCase[] };

/** Applies one recorded operation and returns what the engine produced. */
function apply(random: Random, step: Step): unknown {
  switch (step.op) {
    case 'int': {
      const [min, max] = step.args as [number, number];
      return random.int(min, max);
    }
    case 'real':
    case 'float': {
      const [min, max, inclusive] = step.args as [number, number, boolean];
      return random.float(min, max, inclusive);
    }
    case 'bool': {
      const [percentage] = step.args as [number];
      return random.bool(percentage);
    }
    case 'pick': {
      const [source, begin, end] = step.args as [string[], number | undefined, number | undefined];
      return random.pick(source, begin, end);
    }
    case 'pickWeighted': {
      const [weights, mask] = step.args as [Record<string, number>, string[] | undefined];
      return random.pickWeighted(weights, mask) ?? null;
    }
    default:
      throw new Error(`fixtures/random.json: unknown op "${step.op}"`);
  }
}

const build = (c: { seed: number | number[]; uses?: number }) =>
  c.uses === undefined ? new Random({ seed: c.seed }) : new Random({ seed: c.seed, uses: c.uses });

describe('conformance fixtures', () => {
  it('loads a non-empty fixture file', () => {
    expect(fixtures.schema).toBe(1);
    expect(fixtures.cases.length).toBeGreaterThan(0);
    for (const c of fixtures.cases) expect(c.steps.length).toBeGreaterThan(0);
  });

  describe.each(fixtures.cases)('$name', testCase => {
    it('replays every step exactly', () => {
      const random = build(testCase);
      for (const [index, step] of testCase.steps.entries()) {
        const produced = apply(random, step);
        expect(produced, `step ${index} (${step.op}) value`).toStrictEqual(step.value);
        expect(random.serialize(), `step ${index} (${step.op}) engine state`).toEqual(step.state);
      }
    });

    if (testCase.resumeAt !== undefined) {
      it(`restores mid-stream at step ${testCase.resumeAt} and continues identically`, () => {
        const random = build(testCase);
        const k = testCase.resumeAt!;

        for (const step of testCase.steps.slice(0, k)) apply(random, step);

        // The whole point: a fresh engine built from nothing but the serialized
        // state must continue the stream, not restart it.
        const restored = new Random(random.serialize());
        expect(restored.serialize()).toEqual(random.serialize());

        for (const [offset, step] of testCase.steps.slice(k).entries()) {
          const index = k + offset;
          expect(apply(restored, step), `resumed step ${index} (${step.op})`).toStrictEqual(step.value);
          expect(restored.serialize(), `resumed step ${index} state`).toEqual(step.state);
        }
      });
    }
  });
});
