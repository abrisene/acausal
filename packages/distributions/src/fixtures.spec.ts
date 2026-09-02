/*
 # fixtures.spec.ts
 # Golden conformance replay for @acausal/distributions.
 #
 # Replays fixtures/distributions.json and asserts EXACT equality. Weighted
 # picks are integer and basic floating-point arithmetic over MT19937 output —
 # nothing here is transcendental, so a port must match every value and every
 # engine state bit for bit. Regenerate with `pnpm gen:fixtures`.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { Distribution, ImmutableDistribution } from './distribution';

interface EngineState {
  seed: number | number[];
  uses: number;
}

type DistOp =
  | { op: 'pickOne'; mask?: string[]; value: string | null; state: EngineState }
  | {
      op: 'pick';
      options: { count?: number; mask?: string[]; exclusive?: boolean };
      value: string[];
      state: EngineState;
    };

interface DistributionCase {
  name: string;
  seed: number | number[];
  immutable: boolean;
  source?: Record<string, number>;
  normal?: Record<string, number>;
  normalized: Record<string, number>;
  ops: DistOp[];
}

const fixtures = JSON.parse(
  readFileSync(new URL('../../../fixtures/distributions.json', import.meta.url), 'utf8')
) as { schema: number; cases: DistributionCase[] };

const build = (c: DistributionCase): Distribution => {
  const config = { seed: c.seed, source: c.source, normal: c.normal };
  return c.immutable ? new ImmutableDistribution(config) : new Distribution(config);
};

describe('conformance fixtures', () => {
  it('loads a non-empty fixture file', () => {
    expect(fixtures.schema).toBe(1);
    expect(fixtures.cases.length).toBeGreaterThan(0);
    for (const c of fixtures.cases) expect(c.ops.length).toBeGreaterThan(0);
  });

  it('exercises both the mutable and the immutable class', () => {
    expect(fixtures.cases.some(c => c.immutable)).toBe(true);
    expect(fixtures.cases.some(c => !c.immutable)).toBe(true);
  });

  describe.each(fixtures.cases)('$name', testCase => {
    it('normalizes the input table to the recorded probabilities', () => {
      // The normalized table is upstream of every pick: if normalization drifts,
      // the picks drift with it, and this assertion names the real cause.
      expect(build(testCase).normal).toEqual(testCase.normalized);
    });

    it('replays every pick exactly', () => {
      const dist = build(testCase);
      for (const [index, op] of testCase.ops.entries()) {
        if (op.op === 'pickOne') {
          expect(dist.pickOne(op.mask) ?? null, `op ${index} (pickOne) value`).toBe(op.value);
        } else {
          expect(dist.pick(op.options), `op ${index} (pick) value`).toEqual(op.value);
        }
        expect({ seed: dist.seed, uses: dist.uses }, `op ${index} engine state`).toEqual(op.state);
      }
    });
  });
});
