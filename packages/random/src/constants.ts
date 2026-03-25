/*
 # constants/index.js
 # Constants Index
 */

/**
 # Module Exports
 */

export const CONSTANTS = {
  /**
   * Number of PRNG draws to discard when initializing a new Random engine.
   *
   * MT19937's initial outputs have known statistical weaknesses when seeded
   * with small or low-entropy seeds — early values can exhibit correlation
   * and poor equidistribution. Discarding the first 2000 values ("pre-warming")
   * advances the generator past this weak initialization period, ensuring
   * higher-quality randomness from the first user-visible draw.
   */
  MT_PREWARM: 2000,
  MC_MAX_ORDER_DEFAULT: 4,
  MC_START_DELIMITER: '○',
  MC_GRAM_DELIMITER: '⏐',
  MC_END_DELIMITER: '◍',
} as const;
