/**
 * Chain Blending Utilities
 *
 * Functions and types for blending/interpolating multiple Markov chains.
 */

import { normalizeObject } from 'scalr';
import { DistributionSourceDTO } from '@acausal/distributions';
import type { MarkovChain } from './markov-chain';

/**
 * Blending strategy for combining probability distributions
 */
export type BlendStrategy = 'arithmetic' | 'geometric' | 'harmonic' | 'max' | 'min';

/**
 * Configuration for blending a single chain
 */
export interface ChainBlendConfig<T extends string = string> {
  chain: MarkovChain<T>;
  weight: number;
}

/**
 * Options for chain blending.
 *
 * @property strategy - The blending strategy (default: 'arithmetic').
 * @property normalize - Whether to normalize input weights to sum to 1 (default: true).
 * @property minWeight - Minimum blended source weight to keep a state.
 *   Filters on the blended source weights (not probabilities).
 *   States with a blended source weight below this threshold are removed.
 */
export interface BlendOptions {
  strategy?: BlendStrategy;
  normalize?: boolean;
  minWeight?: number;
}

function arithmeticMean(vals: { value: number; weight: number }[]): number {
  return vals.reduce((sum, { value, weight }) => sum + value * weight, 0);
}

/**
 * Blend multiple distributions using the specified strategy.
 *
 * Note: geometric and harmonic strategies fall back to arithmetic mean
 * when any value is zero. This is mathematically correct — geometric
 * mean of zero is zero, and harmonic mean is undefined for zero values.
 */
export function blendMultipleDistributions(
  distributions: DistributionSourceDTO[],
  weights: number[],
  strategy: BlendStrategy = 'arithmetic'
): DistributionSourceDTO {
  if (distributions.length === 0) {
    return { source: {}, normal: {} };
  }

  if (distributions.length === 1) {
    const d = distributions[0]!;
    return { source: { ...d.source }, normal: { ...d.normal } };
  }

  // Collect all unique keys
  const allKeys = new Set<string>();
  for (const dist of distributions) {
    Object.keys(dist.source).forEach(key => allKeys.add(key));
  }

  const blended: { [key: string]: number } = {};

  for (const key of allKeys) {
    // Collect values from all models (zero for missing)
    const allValues = distributions.map((d, i) => ({
      value: d.source[key] || 0,
      weight: weights[i] || 0,
      hasKey: (d.source[key] || 0) > 0,
    }));

    // For arithmetic, max, min: use all values as-is
    // For geometric, harmonic: renormalize weights over subset that has the key
    let values = allValues;
    if (strategy === 'geometric' || strategy === 'harmonic') {
      const present = allValues.filter(v => v.hasKey);
      if (present.length > 0) {
        const subsetWeightSum = present.reduce((s, v) => s + v.weight, 0);
        values = present.map(v => ({
          ...v,
          weight: subsetWeightSum > 0 ? v.weight / subsetWeightSum : 0,
        }));
      }
    }

    switch (strategy) {
      case 'arithmetic':
        blended[key] = arithmeticMean(values);
        break;
      case 'geometric':
        // After pre-filter (L83-91), values only contains entries with value > 0
        blended[key] = values.reduce((prod, { value, weight }) => prod * Math.pow(value, weight), 1);
        break;
      case 'harmonic': {
        // After pre-filter (L83-91), values only contains entries with value > 0
        const sum = values.reduce((s, { value, weight }) => s + weight / value, 0);
        blended[key] = 1 / sum;
        break;
      }
      case 'max':
        blended[key] = Math.max(...values.map(v => v.value));
        break;
      case 'min': {
        const nonZeroValues = values.filter(v => v.value > 0).map(v => v.value);
        blended[key] = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
        break;
      }
    }
  }

  const blendedSource = blended;
  const blendedSum = Object.values(blendedSource).reduce((s, v) => s + v, 0);
  return {
    source: blendedSource,
    normal: blendedSum > 0 ? normalizeObject(blendedSource) : {},
  };
}
