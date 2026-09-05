export class AcausalError extends Error {}

export type Bytes = ArrayBuffer | ArrayBufferView;

export type DistributionSpec =
  | { type: 'uniform'; min: number; max: number }
  | { type: 'normal'; mean: number; stddev: number }
  | { type: 'clampedNormal'; mean: number; stddev: number; min: number; max: number }
  | { type: 'logNormal'; mean: number; stddev: number }
  | { type: 'exponential'; rate: number }
  | { type: 'poisson'; rate: number }
  | { type: 'binomial'; trials: number; probability: number }
  | { type: 'geometric'; probability: number }
  | { type: 'beta'; alpha: number; beta: number }
  | { type: 'gamma'; shape: number; scale: number }
  | { type: 'weibull'; shape: number; scale: number; location: number }
  | { type: 'cauchy'; location: number; scale: number }
  | { type: 'logistic'; location: number; scale: number }
  | { type: 'bernoulli'; probability: number };

export interface Limits {
  maxDomainSize: number;
  maxVariables: number;
  maxFactors: number;
  maxEliminationWidth: number;
  maxJointSupport: number;
  maxOperations: number;
}

export type SafeInteger = number | bigint;

export class Rng {
  constructor(seed: number | readonly number[]);
  static fromState(state: Bytes): Rng;
  static fromLegacy(seed: number | readonly number[], uses: SafeInteger): Rng;
  int(min: SafeInteger, max: SafeInteger): number | bigint;
  float(min: number, max: number): number;
  bool(probability?: number): boolean;
  sample(spec: DistributionSpec): number;
  uses(): number | bigint;
  snapshot(): Uint8Array;
  clone(): Rng;
  close(): void;
  [Symbol.dispose](): void;
}

export type WeightedEntries =
  | Readonly<Record<string, number>>
  | ReadonlyMap<string, number>
  | Iterable<readonly [string, number]>;

export interface DrawManyOptions {
  replacement?: boolean;
  exclude?: readonly string[];
}

export class Weighted {
  constructor(entries: WeightedEntries);
  entries(): Array<[string, number]>;
  probabilities(): Record<string, number>;
  draw(rng: Rng, exclusions?: readonly string[]): string;
  drawMany(rng: Rng, count: number, options?: DrawManyOptions): string[];
  set(key: string, weight: number): this;
  adjust(key: string, delta: number): this;
  remove(key: string): this;
  clone(): Weighted;
  close(): void;
  [Symbol.dispose](): void;
}

export type Direction = 'forward' | 'backward';
export type BlendStrategy = 'arithmetic' | 'geometric' | 'harmonic' | 'max' | 'min';

export interface GenerateOptions {
  min?: number;
  max?: number;
  maxAttempts?: number;
  order?: number;
  direction?: Direction;
  strict?: boolean;
  start?: readonly string[];
  mustContain?: readonly string[];
  mustNotContain?: readonly string[];
}

export interface MarkovScore {
  sequence: string[];
  logProb: number;
  perplexity: number;
  isValid: boolean;
  normalized: number;
}

export interface MarkovStats {
  gramCount: number | bigint;
  sequenceCount: number | bigint;
  orderMin: number;
  orderMax: number;
  avgDegreeIn: number;
  avgDegreeOut: number;
}

export class Markov {
  constructor(maxOrder: number);
  static fromState(state: Bytes): Markov;
  static blend(models: readonly (readonly [Markov, number])[], strategy?: BlendStrategy): Markov;
  learn(sequences: readonly (readonly string[])[]): this;
  addTransition(context: readonly string[], next: string | null | undefined, weight?: number): this;
  addEndTransition(context: readonly string[], weight?: number): this;
  step(context: readonly string[], rng: Rng, direction?: Direction): string | undefined;
  generate(rng: Rng, options?: GenerateOptions): string[];
  score(sequence: readonly string[]): MarkovScore;
  stats(): MarkovStats;
  snapshot(): Uint8Array;
  clone(): Markov;
  close(): void;
  [Symbol.dispose](): void;
}

export type Assignment = Readonly<Record<string, string>> | ReadonlyMap<string, string> | Iterable<readonly [string, string]>;

export interface Variable {
  id: string;
  domain: readonly string[];
}

export interface ModelRow {
  given: Assignment;
  weights: Readonly<Record<string, number>> | ReadonlyMap<string, number> | Iterable<readonly [string, number]>;
}

export interface ModelTable {
  target: string;
  parents: readonly string[];
  rows: readonly ModelRow[];
}

export type ModelConstraint =
  | { forbid: Assignment }
  | { allow: readonly Assignment[] };

export interface ModelDescription {
  variables: readonly Variable[];
  tables: readonly ModelTable[];
  constraints?: readonly ModelConstraint[];
  id?: string;
  revision?: string;
  limits?: Limits;
}

export interface Posterior {
  target: string;
  probabilities: Record<string, number>;
}

export class Model {
  constructor(description: ModelDescription, limits?: Limits);
  static fromState(state: Bytes): Model;
  posterior(target: string, evidence?: Assignment, limits?: Limits): Posterior;
  sample(rng: Rng, evidence?: Assignment, limits?: Limits): Record<string, string>;
  snapshot(): Uint8Array;
  clone(): Model;
  close(): void;
  [Symbol.dispose](): void;
}

export interface AcausalApi {
  readonly init: typeof init;
  readonly Rng: typeof Rng;
  readonly Weighted: typeof Weighted;
  readonly Markov: typeof Markov;
  readonly Model: typeof Model;
  readonly AcausalError: typeof AcausalError;
}

export function init(wasmBytes?: Bytes | WebAssembly.Module | Response): Promise<AcausalApi>;
