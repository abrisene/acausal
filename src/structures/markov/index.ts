/**
 * Markov Chain Module - Controlled Barrel Export
 *
 * Only public API types and classes are exported from here.
 * Internal types (GramDictionary, MCDelimitersShort) and utility
 * functions are NOT re-exported.
 */

// Classes
export { MarkovChain } from './markov-chain';
export { ImmutableMarkovChain } from './immutable-markov-chain';
export { MarkovChainBatch } from './batch';
export { MultiDimMarkovChain } from './multi-dim-chain';
export { ImmutableMultiDimMarkovChain } from './immutable-multi-dim-chain';

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
