import type { ConditioningBounds, NumericMetric } from './types';

export const COMPILER_REVISION = 'acausal-conditioning-compiler-v1';
export const ALGORITHM_REVISION = 'variable-elimination-min-fill-v1';
export const SAMPLING_REVISION = 'ancestral-sampling-v1';
export const NUMERIC_RUNTIME_REVISION = 'js-number-logexp-canonical-v1';

export const DEFAULT_BOUNDS: ConditioningBounds = Object.freeze({
  maxDomainSize: 256,
  maxVariables: 512,
  maxFactors: 1_024,
  maxEliminationWidth: 12,
  maxJointSupport: 100_000,
  maxOperations: 1_000_000,
});

export const HARD_CAPS: ConditioningBounds = Object.freeze({
  maxDomainSize: 4_096,
  maxVariables: 4_096,
  maxFactors: 8_192,
  maxEliminationWidth: 20,
  maxJointSupport: 10_000_000,
  maxOperations: 100_000_000,
});

export const RELATIVE_WEIGHT_METRIC = Object.freeze({
  metricId: 'acausal.conditioning.relativeWeight',
  dimension: 'relative likelihood modifier over a conditional weight row',
  range: {
    lower: { kind: 'exclusive', value: 0 },
    upper: { kind: 'unbounded' },
    space: 'log',
  },
  revision: COMPILER_REVISION,
  owner: '@acausal/conditioning',
} as const satisfies NumericMetric);

export const POSTERIOR_METRIC = Object.freeze({
  metricId: 'acausal.conditioning.posterior',
  dimension: 'exact normalized posterior probability of one outcome given admitted evidence',
  range: {
    lower: { kind: 'inclusive', value: 0 },
    upper: { kind: 'inclusive', value: 1 },
    space: 'linear',
  },
  revision: `${ALGORITHM_REVISION}/${NUMERIC_RUNTIME_REVISION}`,
  owner: '@acausal/conditioning',
} as const satisfies NumericMetric);
