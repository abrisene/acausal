/**
 * Markov Chain Type Definitions
 */

import { Random, RandomDTO } from '@acausal/random';
import { DistributionSourceDTO } from '@acausal/distributions';

export type MCDirectionOption = 'next' | 'last';
export type MCInsertOption = false | 'start' | 'end' | 'middle';

/** @internal */
export type MCDelimitersShort = [string, string, string];

/** @internal */
export type GramDictionary = { [key: string]: Gram };

export interface MarkovChainOptions extends RandomDTO {
  maxOrder: number;
  delimiter: string;
  startDelimiter: string;
  endDelimiter: string;
}

/** @internal */
export interface MarkovChainSequenceDTO extends MarkovChainOptions {
  sequences: string[][];
  grams: GramDictionary;
}

/** @internal */
export interface MarkovChainGramDTO extends MarkovChainOptions {
  sequences?: string[][];
  grams: GramDictionary;
}

export type MarkovChainDTO = MarkovChainSequenceDTO | MarkovChainGramDTO;

export interface MarkovChainConstructor extends RandomDTO {
  maxOrder?: number;
  delimiter?: string;
  startDelimiter?: string;
  endDelimiter?: string;
  engine?: Random;
  sequences?: string[][];
  grams?: GramDictionary;
  insert?: MCInsertOption;
}

export interface Gram {
  id: string;
  last: DistributionSourceDTO;
  next: DistributionSourceDTO;
  order: number;
  frequency: number;
  degreeIn: number;
  degreeOut: number;
}

export interface MCConstraints {
  minLength?: number;
  maxLength?: number;
  mustContain?: string[];
  mustNotContain?: string[];
  pattern?: RegExp;
  validator?: (sequence: string[]) => boolean;
  maxRetries?: number;
}

export interface MCGeneratorOptions {
  start?: string[];
  order?: number;
  min?: number;
  max?: number;
  direction?: MCDirectionOption;
  mask?: string[];
  strict?: boolean;
  trim?: boolean;
  constraints?: MCConstraints;
}

/** @internal */
export interface MCGeneratorStaticOptions extends MCGeneratorOptions {
  model: MarkovChainDTO;
  engine?: Random;
}

export interface MCAnalyzeOptions extends Omit<MCGeneratorOptions, 'constraints'> {
  samples?: number;
  normalize?: boolean;
}

/** @internal */
export interface MCAnalyzeStaticOptions extends MCAnalyzeOptions, MCGeneratorStaticOptions {}

export interface MCAnalysis {
  sequence: string[];
  sources: { [key: string]: number };
  sinks: { [key: string]: number };
}

export interface MarkovChainStats {
  gramCount: number;
  sequenceCount: number;
  orderRange: [number, number];
  avgDegreeIn: number;
  avgDegreeOut: number;
}

export interface MCSequenceScore {
  sequence: string[];
  logProb: number;
  perplexity: number;
  isValid: boolean;
  normalized: number;
}
