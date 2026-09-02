/*
 # fixtures.spec.ts
 # Golden conformance replay for @acausal/sampler.
 #
 # Replays fixtures/sampler.json and asserts EXACT equality — `toBe`, never
 # `toBeCloseTo`. Within this repository, on one Node build, that holds for
 # every distribution. Steps marked `transcendental: true` pass through
 # Math.log / exp / sqrt / pow / tan / cos, which IEEE 754 does not specify;
 # fixtures/README.md records what a cross-runtime port has to decide about
 # those. Regenerate with `pnpm gen:fixtures` and read the diff.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { RandomSampler, type DistributionParams } from './sampler';

interface EngineState {
  seed: number | number[];
  uses: number;
}

interface Draw {
  op: string;
  args: unknown[];
  value: number | boolean;
  transcendental?: true;
  state: EngineState;
}

interface SamplerCase {
  name: string;
  seed: number | number[];
  method: string;
  args: unknown[];
  transcendental?: true;
  resumeAt?: number;
  draws: Draw[];
}

const fixtures = JSON.parse(
  readFileSync(new URL('../../../fixtures/sampler.json', import.meta.url), 'utf8')
) as { schema: number; cases: SamplerCase[] };

/** Invokes one recorded sampler method. */
function call(sampler: RandomSampler, method: string, args: unknown[]): number | boolean {
  if (method === 'sampleDistribution') {
    return sampler.sampleDistribution(args[0] as DistributionParams);
  }
  const fn = (sampler as unknown as Record<string, (...a: unknown[]) => number | boolean>)[method];
  if (typeof fn !== 'function') throw new Error(`fixtures/sampler.json: unknown method "${method}"`);
  return fn.apply(sampler, args);
}

describe('conformance fixtures', () => {
  it('loads a non-empty fixture file', () => {
    expect(fixtures.schema).toBe(1);
    expect(fixtures.cases.length).toBeGreaterThan(0);
    for (const c of fixtures.cases) expect(c.draws.length).toBeGreaterThan(0);
  });

  it('covers every distribution method the sampler exposes', () => {
    const covered = new Set(fixtures.cases.map(c => c.method));
    const declared = new Set(
      fixtures.cases.flatMap(c =>
        c.method === 'sampleDistribution' ? [(c.args[0] as DistributionParams).type] : []
      )
    );
    for (const method of [
      'normal',
      'clampedNormal',
      'logNormal',
      'exponential',
      'uniform',
      'gamma',
      'beta',
      'poisson',
      'binomial',
      'geometric',
      'weibull',
      'cauchy',
      'logistic',
      'sampleDistribution',
    ]) {
      expect(covered, `no fixture case exercises ${method}`).toContain(method);
    }
    // `bernoulli` is only reachable as a sampleDistribution type.
    expect(declared).toContain('bernoulli');
  });

  describe.each(fixtures.cases)('$name', testCase => {
    it('replays every draw exactly', () => {
      const sampler = new RandomSampler({ seed: testCase.seed });
      for (const [index, draw] of testCase.draws.entries()) {
        const produced = call(sampler, testCase.method, testCase.args);
        expect(produced, `draw ${index} (${testCase.method}) value`).toBe(draw.value);
        // The draw COUNT is as load-bearing as the value: poisson, gamma and
        // binomial consume a data-dependent number of draws, so an engine that
        // agrees on values but not on uses desynchronises on the next call.
        expect(sampler.serialize(), `draw ${index} engine state`).toEqual(draw.state);
      }
    });

    if (testCase.resumeAt !== undefined) {
      it(`restores mid-stream at draw ${testCase.resumeAt} and continues identically`, () => {
        const sampler = new RandomSampler({ seed: testCase.seed });
        const k = testCase.resumeAt!;
        for (let i = 0; i < k; i++) call(sampler, testCase.method, testCase.args);

        const restored = new RandomSampler(sampler.serialize());
        expect(restored.serialize()).toEqual(sampler.serialize());

        for (const [offset, draw] of testCase.draws.slice(k).entries()) {
          expect(call(restored, testCase.method, testCase.args), `resumed draw ${k + offset}`).toBe(draw.value);
          expect(restored.serialize(), `resumed draw ${k + offset} state`).toEqual(draw.state);
        }
      });
    }
  });
});
