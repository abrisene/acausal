/*
 # gen-fixtures.ts
 # Regenerate the golden conformance fixtures.
 #
 #   pnpm gen:fixtures      (run `pnpm build` first — cross-package imports
 #                           resolve through each package's built dist)
 #
 # Every fixture records what the TypeScript reference implementation produces
 # RIGHT NOW for a fixed seed and a fixed operation sequence. The fixtures are
 # the contract: a refactor that changes a single output changes a fixture, and
 # a port to another language replays them to prove it is the same generator.
 #
 # Regenerate only after an INTENTIONAL semantics change, and read the diff. A
 # surprising fixture change is a regression, not a refresh.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Random } from '../packages/random/src/index';
import { RandomSampler, type DistributionParams } from '../packages/sampler/src/index';
import { Distribution, ImmutableDistribution } from '../packages/distributions/src/index';
import { MarkovChain } from '../packages/markov/src/index';

import randomPkg from '../packages/random/package.json' with { type: 'json' };

/**
 # Types
 */

type Seed = number | number[];

/** The engine state a runtime must be in after a step: `Random.serialize()`. */
interface EngineState {
  seed: Seed;
  uses: number;
}

/**
 * One recorded operation. `transcendental: true` marks an output whose value
 * passed through Math.log / Math.exp / Math.sqrt / Math.pow / Math.tan / Math.cos,
 * which are NOT specified bit-for-bit by IEEE 754. See fixtures/README.md.
 */
interface Step {
  op: string;
  args: unknown[];
  value: unknown;
  transcendental?: true;
  state: EngineState;
}

/**
 # Helpers
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, '..', 'fixtures');

const state = (r: Random): EngineState => r.serialize() as EngineState;

const writeJson = (name: string, value: unknown) => {
  writeFileSync(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

/** Total recorded operations, reported at the end so the run is auditable. */
let opCount = 0;
const counted = <T extends { steps?: unknown[]; draws?: unknown[]; ops?: unknown[] }>(cases: T[]): T[] => {
  for (const c of cases) opCount += (c.steps ?? c.draws ?? c.ops ?? []).length;
  return cases;
};

/**
 # Random
 */

/**
 * A recorded Random program. `resumeAt`, when present, is the step index at
 * which a replayer must serialize, rebuild a fresh Random from the serialized
 * state, and continue — the remaining steps must match exactly.
 */
interface RandomCase {
  name: string;
  seed: Seed;
  uses?: number;
  resumeAt?: number;
  steps: Step[];
}

/** Runs one scripted program against a fresh Random and records every step. */
function recordRandom(
  name: string,
  seed: Seed,
  uses: number | undefined,
  program: ((r: Random, push: (op: string, args: unknown[], value: unknown) => void) => void),
  resumeAt?: number
): RandomCase {
  const random = uses === undefined ? new Random({ seed }) : new Random({ seed, uses });
  const steps: Step[] = [];
  const push = (op: string, args: unknown[], value: unknown) =>
    steps.push({ op, args, value, state: state(random) });
  program(random, push);
  return uses === undefined ? { name, seed, resumeAt, steps } : { name, seed, uses, resumeAt, steps };
}

const randomCases: RandomCase[] = counted([
  recordRandom('int-d6-x16', 42, undefined, (r, push) => {
    for (let i = 0; i < 16; i++) push('int', [1, 6], r.int(1, 6));
  }),
  recordRandom('int-wide-ranges', 42, undefined, (r, push) => {
    push('int', [0, 0], r.int(0, 0));
    push('int', [-5, 5], r.int(-5, 5));
    push('int', [0, 255], r.int(0, 255));
    push('int', [0, 65535], r.int(0, 65535));
    push('int', [0, 0x7fffffff], r.int(0, 0x7fffffff));
    push('int', [1000000, 2000000], r.int(1000000, 2000000));
  }),
  recordRandom('real-half-open-and-inclusive', 7, undefined, (r, push) => {
    for (let i = 0; i < 6; i++) push('real', [0, 1, false], r.float(0, 1));
    for (let i = 0; i < 6; i++) push('real', [0, 1, true], r.float(0, 1, true));
    for (let i = 0; i < 4; i++) push('real', [-10, 10, false], r.float(-10, 10));
  }),
  recordRandom('float-alias-matches-real', 7, undefined, (r, push) => {
    for (let i = 0; i < 6; i++) push('float', [0, 1, false], r.float(0, 1));
  }),
  recordRandom('bool-thresholds', 99, undefined, (r, push) => {
    for (let i = 0; i < 8; i++) push('bool', [0.5], r.bool());
    for (let i = 0; i < 8; i++) push('bool', [0.9], r.bool(0.9));
    for (let i = 0; i < 4; i++) push('bool', [0], r.bool(0));
    for (let i = 0; i < 4; i++) push('bool', [1], r.bool(1));
  }),
  recordRandom('pick-array-and-slice', 250, undefined, (r, push) => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (let i = 0; i < 8; i++) push('pick', [source], r.pick(source));
    for (let i = 0; i < 6; i++) push('pick', [source, 2, 5], r.pick(source, 2, 5));
    for (let i = 0; i < 4; i++) push('pick', [source, 3, 4], r.pick(source, 3, 4));
  }),
  recordRandom('pick-weighted-with-and-without-mask', 250, undefined, (r, push) => {
    const weights = { red: 55, auburn: 25, strawberry: 20 };
    for (let i = 0; i < 10; i++) push('pickWeighted', [weights], r.pickWeighted(weights) ?? null);
    for (let i = 0; i < 6; i++) push('pickWeighted', [weights, ['red']], r.pickWeighted(weights, ['red']) ?? null);
    // Every key masked: no positive unmasked weight remains, so the reference
    // returns undefined AND consumes no draw. The recorded state proves it.
    push('pickWeighted', [weights, ['red', 'auburn', 'strawberry']],
      r.pickWeighted(weights, ['red', 'auburn', 'strawberry']) ?? null);
    // Non-positive weights are skipped, not treated as zero-probability keys.
    const withZero = { a: 1, b: 0, c: -3, d: 2 };
    for (let i = 0; i < 6; i++) push('pickWeighted', [withZero], r.pickWeighted(withZero) ?? null);
  }),
  recordRandom('explicit-uses-skips-prewarm', 250, 100, (r, push) => {
    for (let i = 0; i < 10; i++) push('int', [0, 1000], r.int(0, 1000));
  }),
  recordRandom('explicit-uses-deep', 250, 5000, (r, push) => {
    for (let i = 0; i < 10; i++) push('int', [0, 1000], r.int(0, 1000));
  }),
  recordRandom('array-seed', [1, 2, 3, 4], undefined, (r, push) => {
    for (let i = 0; i < 8; i++) push('int', [0, 999], r.int(0, 999));
    for (let i = 0; i < 4; i++) push('real', [0, 1, false], r.float(0, 1));
  }),
  // The resume case: at step 6 a replayer must serialize, rebuild, and continue.
  recordRandom(
    'mixed-stream-resume-at-6',
    31337,
    undefined,
    (r, push) => {
      push('int', [1, 20], r.int(1, 20));
      push('real', [0, 1, false], r.float(0, 1));
      push('bool', [0.5], r.bool());
      push('pick', [['x', 'y', 'z']], r.pick(['x', 'y', 'z']));
      push('pickWeighted', [{ a: 3, b: 1 }], r.pickWeighted({ a: 3, b: 1 }) ?? null);
      push('int', [0, 100], r.int(0, 100));
      push('real', [-1, 1, false], r.float(-1, 1));
      push('int', [1, 6], r.int(1, 6));
      push('bool', [0.25], r.bool(0.25));
      push('pick', [['x', 'y', 'z']], r.pick(['x', 'y', 'z']));
      push('real', [0, 1, true], r.float(0, 1, true));
      push('int', [1, 20], r.int(1, 20));
    },
    6
  ),
]);

/**
 # Sampler
 */

/** Methods whose result passes through a transcendental libm call. */
const TRANSCENDENTAL = new Set([
  'normal',
  'clampedNormal',
  'logNormal',
  'exponential',
  'poisson',
  'geometric',
  'beta',
  'gamma',
  'weibull',
  'cauchy',
  'logistic',
]);

interface SamplerCase {
  name: string;
  seed: Seed;
  method: string;
  args: unknown[];
  transcendental?: true;
  resumeAt?: number;
  draws: Step[];
}

function recordSampler(
  name: string,
  seed: Seed,
  method: string,
  args: unknown[],
  count: number,
  resumeAt?: number
): SamplerCase {
  const sampler = new RandomSampler({ seed });
  const call = (sampler as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
  const draws: Step[] = [];
  const transcendental = TRANSCENDENTAL.has(method) ? (true as const) : undefined;
  for (let i = 0; i < count; i++) {
    const value = call.apply(sampler, args);
    draws.push({
      op: method,
      args,
      value,
      ...(transcendental ? { transcendental } : {}),
      state: state(sampler.engine),
    });
  }
  return { name, seed, method, args, transcendental, resumeAt, draws };
}

/** `sampleDistribution` takes a single params object rather than positionals. */
function recordSampleDistribution(name: string, seed: Seed, params: DistributionParams, count: number): SamplerCase {
  const sampler = new RandomSampler({ seed });
  const draws: Step[] = [];
  const transcendental = TRANSCENDENTAL.has(params.type) ? (true as const) : undefined;
  for (let i = 0; i < count; i++) {
    const value = sampler.sampleDistribution(params);
    draws.push({
      op: 'sampleDistribution',
      args: [params],
      value,
      ...(transcendental ? { transcendental } : {}),
      state: state(sampler.engine),
    });
  }
  return { name, seed, method: 'sampleDistribution', args: [params], transcendental, draws };
}

const samplerCases: SamplerCase[] = counted([
  // --- continuous -----------------------------------------------------------
  recordSampler('normal-standard', 42, 'normal', [], 12),
  recordSampler('normal-mu170-sigma7', 42, 'normal', [170, 7], 12),
  recordSampler('normal-sigma-zero-consumes-nothing', 42, 'normal', [5, 0], 4),
  recordSampler('clampedNormal-tight-window', 42, 'clampedNormal', [0, 1, -0.5, 0.5], 12),
  recordSampler('clampedNormal-wide-window', 7, 'clampedNormal', [170, 7, 150, 190], 10),
  recordSampler('logNormal-standard', 42, 'logNormal', [], 10),
  recordSampler('logNormal-mu1-sigma05', 7, 'logNormal', [1, 0.5], 10),
  recordSampler('exponential-lambda1', 42, 'exponential', [], 12),
  recordSampler('exponential-lambda025', 7, 'exponential', [0.25], 10),
  recordSampler('uniform-default', 42, 'uniform', [], 8),
  recordSampler('uniform-range', 7, 'uniform', [-3, 11], 8),
  recordSampler('beta-2-5', 42, 'beta', [2, 5], 10),
  recordSampler('beta-05-05-subunit-shapes', 7, 'beta', [0.5, 0.5], 10),
  recordSampler('gamma-shape-ge-1', 42, 'gamma', [2.5], 10),
  recordSampler('gamma-shape-lt-1-recursive-branch', 7, 'gamma', [0.3], 10),
  recordSampler('gamma-with-scale', 99, 'gamma', [3, 2], 10),
  recordSampler('weibull-k15', 42, 'weibull', [1.5], 10),
  recordSampler('weibull-scaled-and-located', 7, 'weibull', [2, 3, 10], 10),
  recordSampler('cauchy-standard', 42, 'cauchy', [], 10),
  recordSampler('cauchy-located', 7, 'cauchy', [5, 2], 10),
  recordSampler('logistic-standard', 42, 'logistic', [], 10),
  recordSampler('logistic-scaled', 7, 'logistic', [1, 3], 10),
  // --- discrete -------------------------------------------------------------
  recordSampler('poisson-lambda3-knuth', 42, 'poisson', [3], 12),
  recordSampler('poisson-lambda-zero', 7, 'poisson', [0], 4),
  recordSampler('poisson-lambda40-normal-approximation', 7, 'poisson', [40], 10),
  recordSampler('binomial-10-05', 42, 'binomial', [10, 0.5], 10),
  recordSampler('binomial-n-zero', 7, 'binomial', [0, 0.5], 4),
  recordSampler('binomial-100-01', 99, 'binomial', [100, 0.1], 6),
  recordSampler('geometric-p025', 42, 'geometric', [0.25], 12),
  recordSampler('geometric-p1-always-first-trial', 7, 'geometric', [1], 6),
  recordSampler('bernoulli-p03', 42, 'bool', [0.3], 12),
  // --- data-driven ----------------------------------------------------------
  recordSampleDistribution('sampleDistribution-uniform', 42, { type: 'uniform', min: 1, max: 10 }, 6),
  recordSampleDistribution('sampleDistribution-normal', 42, { type: 'normal', mu: 170, sigma: 7 }, 6),
  recordSampleDistribution('sampleDistribution-logNormal', 42, { type: 'logNormal', mu: 0, sigma: 1 }, 6),
  recordSampleDistribution('sampleDistribution-exponential', 42, { type: 'exponential', lambda: 2 }, 6),
  recordSampleDistribution('sampleDistribution-poisson', 42, { type: 'poisson', lambda: 4 }, 6),
  recordSampleDistribution('sampleDistribution-binomial', 42, { type: 'binomial', n: 12, p: 0.4 }, 6),
  recordSampleDistribution('sampleDistribution-geometric', 42, { type: 'geometric', p: 0.3 }, 6),
  recordSampleDistribution('sampleDistribution-beta', 42, { type: 'beta', alpha: 2, beta: 3 }, 6),
  recordSampleDistribution('sampleDistribution-gamma', 42, { type: 'gamma', k: 2, theta: 1.5 }, 6),
  recordSampleDistribution('sampleDistribution-bernoulli', 42, { type: 'bernoulli', p: 0.7 }, 6),
  recordSampleDistribution('sampleDistribution-weibull', 42, { type: 'weibull', k: 1.5, a: 2, b: 1 }, 6),
  recordSampleDistribution('sampleDistribution-cauchy', 42, { type: 'cauchy', a: 0, b: 1 }, 6),
  recordSampleDistribution('sampleDistribution-logistic', 42, { type: 'logistic', a: 0, b: 2 }, 6),
  // The sampler's own resume case: serialize after draw 4, rebuild, continue.
  recordSampler('normal-resume-at-4', 31337, 'normal', [10, 2], 10, 4),
]);

/**
 # Distributions
 */

type DistOp =
  | { op: 'pickOne'; mask?: string[]; value: string | null; state: EngineState }
  | { op: 'pick'; options: { count?: number; mask?: string[]; exclusive?: boolean }; value: string[]; state: EngineState };

interface DistributionCase {
  name: string;
  seed: Seed;
  immutable: boolean;
  /** Exactly one of `source` / `normal` is the constructor input. */
  source?: Record<string, number>;
  normal?: Record<string, number>;
  /** The normalized table the picks are actually drawn against. */
  normalized: Record<string, number>;
  ops: DistOp[];
}

function recordDistribution(
  name: string,
  seed: Seed,
  input: { source?: Record<string, number>; normal?: Record<string, number> },
  immutable: boolean,
  program: (d: Distribution, push: (op: DistOp) => void) => void
): DistributionCase {
  const dist = immutable
    ? new ImmutableDistribution({ seed, ...input })
    : new Distribution({ seed, ...input });
  const ops: DistOp[] = [];
  program(dist, o => ops.push(o));
  return { name, seed, immutable, ...input, normalized: dist.normal, ops };
}

const LOOT = { common: 60, uncommon: 25, rare: 12, legendary: 3 };
const EVEN = { n: 1, e: 1, s: 1, w: 1 };

const distributionCases: DistributionCase[] = counted([
  recordDistribution('pickOne-unmasked', 42, { source: LOOT }, false, (d, push) => {
    for (let i = 0; i < 16; i++) {
      const value = d.pickOne() ?? null;
      push({ op: 'pickOne', value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('pickOne-masked', 42, { source: LOOT }, false, (d, push) => {
    for (let i = 0; i < 12; i++) {
      const mask = ['common'];
      const value = d.pickOne(mask) ?? null;
      push({ op: 'pickOne', mask, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('pickOne-fully-masked-returns-null', 42, { source: LOOT }, false, (d, push) => {
    const mask = ['common', 'uncommon', 'rare', 'legendary'];
    for (let i = 0; i < 3; i++) {
      const value = d.pickOne(mask) ?? null;
      push({ op: 'pickOne', mask, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('pick-count-non-exclusive', 7, { source: LOOT }, false, (d, push) => {
    for (let i = 0; i < 6; i++) {
      const options = { count: 4 };
      const value = d.pick(options);
      push({ op: 'pick', options, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('pick-exclusive-drains-the-table', 7, { source: EVEN }, false, (d, push) => {
    for (let i = 0; i < 4; i++) {
      const options = { count: 4, exclusive: true };
      const value = d.pick(options);
      push({ op: 'pick', options, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('pick-masked-and-exclusive', 7, { source: LOOT }, false, (d, push) => {
    for (let i = 0; i < 4; i++) {
      const options = { count: 3, mask: ['common'], exclusive: true };
      const value = d.pick(options);
      push({ op: 'pick', options, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('normal-only-input', 99, { normal: { a: 0.5, b: 0.3, c: 0.2 } }, false, (d, push) => {
    for (let i = 0; i < 12; i++) {
      const value = d.pickOne() ?? null;
      push({ op: 'pickOne', value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  // Same seed and same program as `pickOne-unmasked`, through the immutable
  // subclass. The two cases must record identical values.
  recordDistribution('immutable-pickOne-unmasked', 42, { source: LOOT }, true, (d, push) => {
    for (let i = 0; i < 16; i++) {
      const value = d.pickOne() ?? null;
      push({ op: 'pickOne', value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
  recordDistribution('immutable-pick-exclusive', 7, { source: EVEN }, true, (d, push) => {
    for (let i = 0; i < 4; i++) {
      const options = { count: 4, exclusive: true };
      const value = d.pick(options);
      push({ op: 'pick', options, value, state: { seed: d.seed, uses: d.uses } });
    }
  }),
]);

/**
 # Markov
 */

type MarkovOp =
  | { op: 'addSequence'; sequence: string[]; gramCount: number }
  | { op: 'next'; gram?: string[]; mask?: string[]; value: string | null; state: EngineState }
  | { op: 'backward'; gram?: string[]; mask?: string[]; value: string | null; state: EngineState }
  | { op: 'generate'; options: Record<string, unknown>; value: string[]; state: EngineState };

interface MarkovCase {
  name: string;
  seed: Seed;
  maxOrder: number;
  sequences: string[][];
  ops: MarkovOp[];
}

const CORPUS: string[][] = [
  ['the', 'cat', 'sat', 'on', 'the', 'mat'],
  ['the', 'cat', 'ate', 'the', 'fish'],
  ['a', 'dog', 'sat', 'on', 'the', 'log'],
  ['a', 'dog', 'ate', 'the', 'bone'],
];

function recordMarkov(
  name: string,
  seed: Seed,
  maxOrder: number,
  sequences: string[][],
  program: (c: MarkovChain, push: (o: MarkovOp) => void) => void
): MarkovCase {
  const chain = new MarkovChain({ seed, maxOrder, sequences });
  const ops: MarkovOp[] = [];
  program(chain, o => ops.push(o));
  return { name, seed, maxOrder, sequences, ops };
}

const markovCases: MarkovCase[] = counted([
  recordMarkov('next-from-start-order2', 42, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 12; i++) {
      const value = c.next() ?? null;
      push({ op: 'next', value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('next-from-gram', 42, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 12; i++) {
      const gram = ['the'];
      const value = c.next(gram) ?? null;
      push({ op: 'next', gram, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('next-with-mask', 42, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 10; i++) {
      const gram = ['the'];
      const mask = ['cat'];
      const value = c.next(gram, mask) ?? null;
      push({ op: 'next', gram, mask, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('backward-from-end', 42, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 10; i++) {
      const value = c.backward() ?? null;
      push({ op: 'backward', value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('generate-default-trimmed', 7, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 10; i++) {
      const options = { min: 2, max: 12 };
      const value = c.generate(options);
      push({ op: 'generate', options, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('generate-untrimmed-keeps-delimiters', 7, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 6; i++) {
      const options = { min: 2, max: 12, trim: false };
      const value = c.generate(options);
      push({ op: 'generate', options, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('generate-backward', 7, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 6; i++) {
      const options = { min: 2, max: 12, direction: 'last' as const };
      const value = c.generate(options);
      push({ op: 'generate', options, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  recordMarkov('generate-order1', 7, 1, CORPUS, (c, push) => {
    for (let i = 0; i < 8; i++) {
      const options = { min: 2, max: 12 };
      const value = c.generate(options);
      push({ op: 'generate', options, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
  // A corpus that GROWS mid-stream: the added sequence must change what the
  // chain can produce, and the gram count after the add is part of the contract.
  recordMarkov('addSequence-mid-stream', 99, 2, CORPUS, (c, push) => {
    for (let i = 0; i < 4; i++) {
      const value = c.next() ?? null;
      push({ op: 'next', value, state: { seed: c.seed, uses: c.uses } });
    }
    const sequence = ['a', 'bird', 'flew', 'over', 'the', 'mat'];
    c.addSequence(sequence);
    push({ op: 'addSequence', sequence, gramCount: Object.keys(c.grams).length });
    for (let i = 0; i < 8; i++) {
      const gram = ['a'];
      const value = c.next(gram) ?? null;
      push({ op: 'next', gram, value, state: { seed: c.seed, uses: c.uses } });
    }
    for (let i = 0; i < 4; i++) {
      const options = { min: 2, max: 12 };
      const value = c.generate(options);
      push({ op: 'generate', options, value, state: { seed: c.seed, uses: c.uses } });
    }
  }),
]);

/**
 # README
 */

const README = `# Acausal conformance fixtures

Generated by \`scripts/gen-fixtures.ts\`. Do not edit by hand.

Each file records what the TypeScript reference implementation produces for a
fixed seed and a fixed sequence of operations. The replay tests in
\`packages/*/src/fixtures.spec.ts\` load these files and assert exact equality.
A refactor that changes one output changes one fixture, and the drift check
(\`pnpm fixtures:current\`) fails when the committed fixtures no longer match
what the code produces.

## Files

| File | Locks |
| --- | --- |
| \`meta.json\` | Provenance: which acausal version and which Node build recorded the run. |
| \`random.json\` | \`Random\`: \`int\`, \`real\`/\`float\`, \`bool\`, \`pick\`, \`pickWeighted\`, and the serialized engine state after every step. |
| \`sampler.json\` | \`RandomSampler\`: every distribution method and \`sampleDistribution\`, over several parameter sets. |
| \`distributions.json\` | \`Distribution\` and \`ImmutableDistribution\`: \`pick\` and \`pickOne\`, masked and exclusive. |
| \`markov.json\` | \`MarkovChain\`: \`addSequence\`, \`next\`, \`backward\`, \`generate\` on a fixed corpus. |

## The engine state is part of the contract

Every recorded step carries \`state\`, the result of \`Random.serialize()\` at
that point: the seed, and the number of PRNG draws consumed so far. This is
what makes the fixtures a *replay* contract rather than a list of outputs. Two
implementations can agree on every returned value and still disagree on how
many draws each call consumed, which desynchronises them on the next call.
\`poisson\`, \`gamma\`, \`binomial\` and \`Distribution.pick\` all consume a
data-dependent number of draws, so this column is where a port breaks first.

## Resume cases

A case with \`resumeAt: k\` is replayed twice over. The replayer runs to step
\`k\`, serializes, builds a fresh instance from the serialized state, and
continues. The remaining steps must match the recorded values exactly. This is
the property that makes a saved game or a paused simulation resumable.

## The open question a Rust port must answer

Steps marked \`transcendental: true\` passed through \`Math.log\`,
\`Math.exp\`, \`Math.sqrt\`, \`Math.pow\`, \`Math.tan\` or \`Math.cos\`.

IEEE 754 specifies the four basic arithmetic operations and \`sqrt\` to be
correctly rounded. It does NOT specify \`log\`, \`exp\`, \`pow\`, \`tan\` or
\`cos\`. Different libm implementations, and different versions of the same
libm, may return results that differ in the last bit. V8 uses its own fdlibm
port, so these values are stable across platforms for a given V8 — but a Rust
port calling Rust's \`f64::ln\` is not obliged to agree.

So the split is:

- **Not transcendental** — \`int\`, \`pick\`, \`pickWeighted\`, \`bool\`,
  \`real\`/\`float\`, \`uniform\`, \`binomial\`, \`bernoulli\`, every engine
  state, and every Markov and Distribution pick. These are integer and basic
  floating-point arithmetic over MT19937 output. **A port must match these bit
  for bit.** There is no tolerance argument to make.
- **Transcendental** — \`normal\`, \`clampedNormal\`, \`logNormal\`,
  \`exponential\`, \`poisson\`, \`geometric\`, \`beta\`, \`gamma\`,
  \`weibull\`, \`cauchy\`, \`logistic\`. A port must decide, explicitly:
  reproduce V8's fdlibm bit for bit (vendor the same routines), or accept a
  documented tolerance and give up exact cross-runtime replay for these
  methods.

**This decision is not yet made.** It is recorded here so the port makes it
deliberately instead of discovering it as a test failure. Note the second-order
consequence: \`poisson\` and \`gamma\` branch on transcendental values, so a
last-bit disagreement there changes the *number of draws consumed*, and every
subsequent value diverges. For those two, a tolerance on the value is not
enough — the draw counts have to agree too.

Within this repository, on a single Node build, every fixture is asserted with
exact equality (\`toBe\`), transcendental or not.
`;

/**
 # Main
 */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

writeJson('meta.json', {
  acausalVersion: randomPkg.version,
  node: process.version,
  v8: process.versions.v8,
  note: 'Provenance for the recorded run. Not part of the replay contract — see README.md.',
});
writeJson('random.json', { schema: 1, cases: randomCases });
writeJson('sampler.json', { schema: 1, cases: samplerCases });
writeJson('distributions.json', { schema: 1, cases: distributionCases });
writeJson('markov.json', { schema: 1, cases: markovCases });
writeFileSync(join(OUT, 'README.md'), README, 'utf8');

const summary = [
  `random        ${randomCases.length} cases`,
  `sampler       ${samplerCases.length} cases`,
  `distributions ${distributionCases.length} cases`,
  `markov        ${markovCases.length} cases`,
].join('\n  ');
process.stdout.write(`fixtures written to fixtures/\n  ${summary}\n  ${opCount} recorded operations\n`);
