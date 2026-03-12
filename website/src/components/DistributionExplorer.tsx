import { useState, useMemo } from 'react';
import { RandomSampler } from 'acausal';

type DistributionType =
  | 'normal'
  | 'logNormal'
  | 'exponential'
  | 'poisson'
  | 'binomial'
  | 'geometric'
  | 'beta'
  | 'gamma'
  | 'weibull'
  | 'cauchy'
  | 'logistic'
  | 'uniform';

interface ParamDef {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

const DISTRIBUTION_PARAMS: Record<DistributionType, ParamDef[]> = {
  normal: [
    { name: 'mu', label: '\u03BC (mean)', min: -10, max: 10, step: 0.1, default: 0 },
    { name: 'sigma', label: '\u03C3 (std dev)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  logNormal: [
    { name: 'mu', label: '\u03BC', min: -2, max: 4, step: 0.1, default: 0 },
    { name: 'sigma', label: '\u03C3', min: 0.1, max: 2, step: 0.1, default: 1 },
  ],
  exponential: [
    { name: 'lambda', label: '\u03BB (rate)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  poisson: [
    { name: 'lambda', label: '\u03BB (expected)', min: 0.1, max: 20, step: 0.1, default: 5 },
  ],
  binomial: [
    { name: 'n', label: 'n (trials)', min: 1, max: 50, step: 1, default: 10 },
    { name: 'p', label: 'p (probability)', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  geometric: [
    { name: 'p', label: 'p (probability)', min: 0.01, max: 1, step: 0.01, default: 0.3 },
  ],
  beta: [
    { name: 'alpha', label: '\u03B1', min: 0.1, max: 10, step: 0.1, default: 2 },
    { name: 'beta', label: '\u03B2', min: 0.1, max: 10, step: 0.1, default: 5 },
  ],
  gamma: [
    { name: 'k', label: 'k (shape)', min: 0.1, max: 10, step: 0.1, default: 2 },
    { name: 'theta', label: '\u03B8 (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  weibull: [
    { name: 'k', label: 'k (shape)', min: 0.1, max: 5, step: 0.1, default: 1.5 },
    { name: 'a', label: 'a (scale)', min: 0.1, max: 10, step: 0.1, default: 1 },
  ],
  cauchy: [
    { name: 'a', label: 'a (location)', min: -5, max: 5, step: 0.1, default: 0 },
    { name: 'b', label: 'b (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  logistic: [
    { name: 'a', label: 'a (location)', min: -5, max: 5, step: 0.1, default: 0 },
    { name: 'b', label: 'b (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  uniform: [
    { name: 'min', label: 'min', min: -10, max: 10, step: 0.1, default: 0 },
    { name: 'max', label: 'max', min: -10, max: 10, step: 0.1, default: 1 },
  ],
};

const DISTRIBUTION_LABELS: Record<DistributionType, string> = {
  normal: 'Normal (Gaussian)',
  logNormal: 'Log-Normal',
  exponential: 'Exponential',
  poisson: 'Poisson',
  binomial: 'Binomial',
  geometric: 'Geometric',
  beta: 'Beta',
  gamma: 'Gamma',
  weibull: 'Weibull',
  cauchy: 'Cauchy',
  logistic: 'Logistic',
  uniform: 'Uniform',
};

const NUM_BINS = 40;

function generateSamples(
  type: DistributionType,
  params: Record<string, number>,
  sampleCount: number,
  seed: number
): number[] {
  const sampler = new RandomSampler({ seed });
  const samples: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    let value: number;
    switch (type) {
      case 'normal':
        value = sampler.normal(params.mu, params.sigma);
        break;
      case 'logNormal':
        value = sampler.logNormal(params.mu, params.sigma);
        break;
      case 'exponential':
        value = sampler.exponential(params.lambda);
        break;
      case 'poisson':
        value = sampler.poisson(params.lambda);
        break;
      case 'binomial':
        value = sampler.binomial(Math.round(params.n), params.p);
        break;
      case 'geometric':
        value = sampler.geometric(params.p);
        break;
      case 'beta':
        value = sampler.beta(params.alpha, params.beta);
        break;
      case 'gamma':
        value = sampler.gamma(params.k, params.theta);
        break;
      case 'weibull':
        value = sampler.weibull(params.k, params.a);
        break;
      case 'cauchy':
        value = sampler.cauchy(params.a, params.b);
        break;
      case 'logistic':
        value = sampler.logistic(params.a, params.b);
        break;
      case 'uniform':
        value = sampler.uniform(params.min, params.max);
        break;
    }
    samples.push(value);
  }

  return samples;
}

function clampCauchyOutliers(samples: number[]): number[] {
  const sorted = [...samples].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  const lower = q1 - 3 * iqr;
  const upper = q3 + 3 * iqr;
  const clampLower = Math.max(lower, -100);
  const clampUpper = Math.min(upper, 100);
  return samples.map((v) => Math.max(clampLower, Math.min(clampUpper, v)));
}

function computeHistogram(samples: number[]) {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  const binWidth = range / NUM_BINS;
  const bins = new Array(NUM_BINS).fill(0) as number[];

  for (const v of samples) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= NUM_BINS) idx = NUM_BINS - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  }

  const maxCount = Math.max(...bins);
  return { bins, maxCount, min, max };
}

function computeStats(samples: number[]) {
  const n = samples.length;
  const mean = samples.reduce((s, v) => s + v, 0) / n;
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return { mean, stdDev, min, max };
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(3);
  return v.toPrecision(4);
}

export default function DistributionExplorer() {
  const [distType, setDistType] = useState<DistributionType>('normal');
  const [params, setParams] = useState<Record<DistributionType, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {};
    for (const [type, defs] of Object.entries(DISTRIBUTION_PARAMS)) {
      initial[type] = {};
      for (const def of defs) {
        initial[type]![def.name] = def.default;
      }
    }
    return initial as Record<DistributionType, Record<string, number>>;
  });
  const [sampleCount, setSampleCount] = useState(1000);
  const [seed, setSeed] = useState(42);

  const currentParams = params[distType]!;
  const paramDefs = DISTRIBUTION_PARAMS[distType];

  const { histogram, stats } = useMemo(() => {
    let samples = generateSamples(distType, currentParams, sampleCount, seed);

    // Clamp cauchy outliers to prevent extreme histogram ranges
    if (distType === 'cauchy') {
      samples = clampCauchyOutliers(samples);
    }

    const histogram = computeHistogram(samples);
    const stats = computeStats(samples);
    return { histogram, stats };
  }, [distType, currentParams, sampleCount, seed]);

  const setParam = (name: string, value: number) => {
    setParams((prev) => ({
      ...prev,
      [distType]: { ...prev[distType], [name]: value },
    }));
  };

  return (
    <div className="playground">
      <h3>Configuration</h3>

      <div className="playground-controls">
        <div className="playground-control">
          <label htmlFor="dist-type">Distribution</label>
          <select
            id="dist-type"
            value={distType}
            onChange={(e) => setDistType(e.target.value as DistributionType)}
          >
            {Object.entries(DISTRIBUTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="playground-control">
          <label htmlFor="sample-count">Samples: {sampleCount}</label>
          <input
            id="sample-count"
            type="range"
            min={100}
            max={5000}
            step={100}
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="playground-controls">
        {paramDefs.map((def) => (
          <div className="playground-control" key={def.name}>
            <label htmlFor={`param-${def.name}`}>
              {def.label}: {currentParams[def.name]?.toFixed(
                def.step < 0.1 ? 2 : def.step < 1 ? 1 : 0
              )}
            </label>
            <input
              id={`param-${def.name}`}
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={currentParams[def.name] ?? def.default}
              onChange={(e) => setParam(def.name, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <hr className="playground-separator" />

      <h3>{DISTRIBUTION_LABELS[distType]} Distribution</h3>

      <div className="playground-histogram">
        {histogram.bins.map((count, i) => {
          const percent = histogram.maxCount > 0 ? (count / histogram.maxCount) * 100 : 0;
          return (
            <div
              key={i}
              className="playground-histogram-bar"
              style={{ height: `${percent}%` }}
              title={`Bin ${i + 1}: ${count} samples`}
            />
          );
        })}
      </div>

      <div className="playground-axis-labels">
        <span>{formatNum(histogram.min)}</span>
        <span>{formatNum((histogram.min + histogram.max) / 2)}</span>
        <span>{formatNum(histogram.max)}</span>
      </div>

      <div className="playground-stats">
        <div className="playground-stat">
          <div className="playground-stat-value">{formatNum(stats.mean)}</div>
          <div className="playground-stat-label">Mean</div>
        </div>
        <div className="playground-stat">
          <div className="playground-stat-value">{formatNum(stats.stdDev)}</div>
          <div className="playground-stat-label">Std Dev</div>
        </div>
        <div className="playground-stat">
          <div className="playground-stat-value">{formatNum(stats.min)}</div>
          <div className="playground-stat-label">Min</div>
        </div>
        <div className="playground-stat">
          <div className="playground-stat-value">{formatNum(stats.max)}</div>
          <div className="playground-stat-label">Max</div>
        </div>
      </div>
    </div>
  );
}
