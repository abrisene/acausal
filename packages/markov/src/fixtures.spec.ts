/*
 # fixtures.spec.ts
 # Golden conformance replay for @acausal/markov.
 #
 # Replays fixtures/markov.json and asserts EXACT equality. Chain traversal is
 # weighted picking over MT19937 output — nothing here is transcendental, so a
 # port must match every generated sequence and every engine state bit for bit.
 # Regenerate with `pnpm gen:fixtures`.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { MarkovChain } from './markov-chain';
import type { MCDirectionOption } from './types';

interface EngineState {
  seed: number | number[];
  uses: number;
}

type MarkovOp =
  | { op: 'addSequence'; sequence: string[]; gramCount: number }
  | { op: 'next'; gram?: string[]; mask?: string[]; value: string | null; state: EngineState }
  | { op: 'backward'; gram?: string[]; mask?: string[]; value: string | null; state: EngineState }
  | {
      op: 'generate';
      options: { min?: number; max?: number; direction?: MCDirectionOption; trim?: boolean };
      value: string[];
      state: EngineState;
    };

interface MarkovCase {
  name: string;
  seed: number | number[];
  maxOrder: number;
  sequences: string[][];
  ops: MarkovOp[];
}

const fixtures = JSON.parse(
  readFileSync(new URL('../../../fixtures/markov.json', import.meta.url), 'utf8')
) as { schema: number; cases: MarkovCase[] };

describe('conformance fixtures', () => {
  it('loads a non-empty fixture file', () => {
    expect(fixtures.schema).toBe(1);
    expect(fixtures.cases.length).toBeGreaterThan(0);
    for (const c of fixtures.cases) expect(c.ops.length).toBeGreaterThan(0);
  });

  it('exercises addSequence, traversal, and generation', () => {
    const ops = new Set(fixtures.cases.flatMap(c => c.ops.map(o => o.op)));
    expect(ops).toContain('addSequence');
    expect(ops).toContain('next');
    expect(ops).toContain('backward');
    expect(ops).toContain('generate');
  });

  describe.each(fixtures.cases)('$name', testCase => {
    it('replays every operation exactly', () => {
      const chain = new MarkovChain({
        seed: testCase.seed,
        maxOrder: testCase.maxOrder,
        sequences: testCase.sequences,
      });

      for (const [index, op] of testCase.ops.entries()) {
        switch (op.op) {
          case 'addSequence': {
            chain.addSequence(op.sequence);
            // The gram count proves the corpus actually grew the model, not
            // just the sequence list.
            expect(Object.keys(chain.grams).length, `op ${index} (addSequence) gram count`).toBe(op.gramCount);
            continue;
          }
          case 'next': {
            expect(chain.next(op.gram, op.mask) ?? null, `op ${index} (next) value`).toBe(op.value);
            break;
          }
          case 'backward': {
            expect(chain.backward(op.gram, op.mask) ?? null, `op ${index} (backward) value`).toBe(op.value);
            break;
          }
          case 'generate': {
            expect(chain.generate(op.options), `op ${index} (generate) value`).toEqual(op.value);
            break;
          }
        }
        expect({ seed: chain.seed, uses: chain.uses }, `op ${index} engine state`).toEqual(op.state);
      }
    });
  });
});
