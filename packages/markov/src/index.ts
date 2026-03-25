/**
 * @acausal/markov — Markov chain text and sequence generation.
 *
 * All types are public API. GramDictionary and MCDelimitersShort
 * are exported for advanced use cases (custom gram manipulation).
 */

// Classes
export { MarkovChain } from './markov-chain';
export { ImmutableMarkovChain } from './immutable-markov-chain';
export { MarkovChainBatch } from './batch';
export { MultiDimMarkovChain } from './multi-dim-chain';
export { ImmutableMultiDimMarkovChain } from './immutable-multi-dim-chain';

// Constants
export { MC_CONSTANTS } from './constants';

// Functions
export { registerStateKey, getStateKey, unregisterStateKey } from './multi-dim-chain';

// Public types
export type {
  MCDirectionOption,
  MCInsertOption,
  MarkovChainOptions,
  MarkovChainSequenceDTO,
  MarkovChainGramDTO,
  MarkovChainDTO,
  MarkovChainConstructor,
  Gram,
  MCConstraints,
  MCGeneratorOptions,
  MCGeneratorStaticOptions,
  MCAnalyzeOptions,
  MCAnalyzeStaticOptions,
  MCAnalysis,
  MarkovChainStats,
  MCSequenceScore,
  // Internal types exported for advanced use cases
  GramDictionary,
  MCDelimitersShort,
} from './types';

// Blend types
export type { BlendStrategy, ChainBlendConfig, BlendOptions } from './blend';

// Multi-dim chain types
export type { StateKeyFunction, MultiDimMarkovChainOptions, MultiDimMarkovChainDTO } from './multi-dim-chain';
