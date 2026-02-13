/**
 * Markov Chain Default Options
 */

import { CONSTANTS } from '../../constants';
import { MCDirectionOption, MarkovChainDTO } from './types';

export const defaultOptions = {
  maxOrder: 4,
  delimiter: CONSTANTS.MC_GRAM_DELIMITER,
  startDelimiter: CONSTANTS.MC_START_DELIMITER,
  endDelimiter: CONSTANTS.MC_END_DELIMITER,
};

export const defaultDTO: MarkovChainDTO = {
  ...defaultOptions,
  sequences: [],
  grams: {},
};

export const defaultGenOptions = {
  min: 1,
  max: 100,
  direction: 'next' as MCDirectionOption,
  strict: true,
  trim: true,
};

export const defaultAnalyzeOptions = {
  ...defaultGenOptions,
  samples: 1000,
  normalize: true,
};
