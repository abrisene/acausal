/**
 * Markov Chain Utility Functions
 *
 * These functions operate directly on GramDictionary objects (mutating in place).
 * They are exported from this file for use by batch.ts but are NOT
 * re-exported from the barrel index.ts.
 */

import { Distribution } from '@acausal/distributions';
import { CONSTANTS } from '@acausal/random';
import { MCInsertOption, MCDelimitersShort, MCDirectionOption, GramDictionary, Gram, MarkovChainDTO } from './types';

/**
 * Normalizes an MCInsertOption value, converting deprecated `true` to `'middle'`.
 * @internal
 */
export function normalizeInsertOption(insert: MCInsertOption | boolean): MCInsertOption {
  if (insert === true) {
    console.warn(
      "MCInsertOption: passing `true` is deprecated. Use 'middle' instead. " +
        '`true` will be removed in a future version.'
    );
    return 'middle';
  }
  return insert as MCInsertOption;
}

/**
 * The set of reserved delimiter characters used internally for gram ID
 * construction and sequence boundary markers. Sequence elements that contain
 * any of these characters will produce corrupted gram IDs or false boundary
 * matches, leading to silent data integrity issues.
 *
 * @internal
 */
const RESERVED_DELIMITERS: Set<string> = new Set([
  CONSTANTS.MC_START_DELIMITER,
  CONSTANTS.MC_GRAM_DELIMITER,
  CONSTANTS.MC_END_DELIMITER,
]);

/**
 * Formats a sequence for addition or insertion into a gram dictionary.
 * @param gramSequence  The sequence to be formatted.
 * @param insert        The addition / insertion type.
 * @param delimiters    The delimiters for start / middle / end states.
 */
export function formatGramSequence(
  gramSequence: string[],
  insert: MCInsertOption,
  delimiters: MCDelimitersShort
): string[] {
  let result: string[];
  switch (insert) {
    case 'start':
      result = [delimiters[0], ...gramSequence];
      break;
    case 'end':
      result = [...gramSequence, delimiters[2]];
      break;
    case 'middle':
      result = [...gramSequence];
      break;
    case false:
    default:
      result = [delimiters[0], ...gramSequence, delimiters[2]];
      break;
  }
  return result;
}

/**
 * Determines the Gram id of a sequence given a between-state delimiter.
 * @param gramSequence  The sequence to be identified.
 * @param delimiter     The between-state delimiter to use.
 */
export function getGramId(gramSequence: string[], delimiter: string) {
  return gramSequence.join(delimiter);
}

/**
 * Extracts delimiters from a Markov Chain and formats them in short format.
 * Only the first character of each delimiter is used for internal gram ID construction.
 * @param data A Markov Chain data transfer object to extract delimiters from.
 */
export function getDelimiters(data: MarkovChainDTO): MCDelimitersShort {
  const start = data.startDelimiter[0];
  const middle = data.delimiter[0];
  const end = data.endDelimiter[0];

  // Delimiters must have at least one character
  if (!start || !middle || !end) {
    throw new Error('Delimiters must have at least one character');
  }

  return [start, middle, end];
}

/**
 * Breaks down a sequence into Grams and adds them plus any edges to
 * the gram dictionary.
 *
 * **Delimiter constraint:** Sequence elements must not contain any of the
 * reserved delimiter characters (`○`, `⏐`, `◍`). Elements matching a
 * delimiter will produce a console warning and may cause corrupted gram IDs
 * or false boundary matches.
 *
 * @param grams       The Gram Dictionary.
 * @param sequence    The sequence to be added to the dictionary.
 * @param insert      Whether or not the sequence should be added or inserted.
 * @param weight      The weight of any edges created between Grams and states.
 * @param maxOrder    The maximum allowed order to generate.
 * @param delimiters  The delimiters for start / middle / end states.
 */
export function addSequence(
  grams: GramDictionary,
  sequence: string[],
  insert: MCInsertOption | boolean,
  weight: number,
  maxOrder: number,
  delimiters: MCDelimitersShort
) {
  // Warn if any sequence element matches a reserved delimiter character.
  for (const element of sequence) {
    if (RESERVED_DELIMITERS.has(element)) {
      console.warn(
        `addSequence: element "${element}" matches a reserved delimiter character (○, ⏐, or ◍). ` +
          'This may corrupt gram IDs or cause false boundary matches.'
      );
    }
  }

  // Normalize the insert option (handles deprecated `true` → 'middle').
  const normalizedInsert = normalizeInsertOption(insert);

  // Format the sequence for addition or insertion.
  const seq = formatGramSequence(sequence, normalizedInsert, delimiters);

  // Iterate through each order.
  for (let order = 1; order <= maxOrder; order += 1) {
    // Iterate through each position in the array.
    for (let pos = 0; pos < seq.length; pos += 1) {
      const nextPos = pos + order;
      const lastPos = pos - 1;

      // Find the previous and next states.
      const lastState = lastPos >= 0 ? seq[lastPos] : undefined;
      const nextState = nextPos < seq.length ? seq[nextPos] : undefined;

      // Get the gram sequence and id.
      const gramSeq = seq.slice(pos, nextPos);
      const delimiter = delimiters[1]?.[0];
      if (!delimiter) {
        throw new Error('Invalid delimiter configuration');
      }
      const gramId = getGramId(gramSeq, delimiter);

      // Add the gram and the edges.
      addEdge(grams, gramId, lastState, nextState, order, weight);

      // Break if we've hit the end.
      if (nextState === undefined) break;
    }
  }

  return grams;
}

/**
 * Adds a Gram and related edges to a dictionary.
 * @param grams   The Gram Dictionary.
 * @param gramId  The id of the Gram to add.
 * @param lastId  The id of the last State in the sequence.
 * @param nextId  The id of the next State in the sequence.
 * @param order   The order of the Gram we're adding.
 * @param weight  The weight to add to the edge.
 */
export function addEdge(
  grams: GramDictionary,
  gramId: string,
  lastId: string | undefined,
  nextId: string | undefined,
  order: number,
  weight: number
) {
  // Add the gram to the dictionary if it doesn't exist.
  if (grams[gramId] === undefined) addGram(grams, gramId, order);

  // Add the edges to the distributions.
  const gram = grams[gramId];
  if (!gram) {
    throw new Error(`Failed to create or retrieve gram: ${gramId}`);
  }

  // Increment frequency each time this gram is encountered.
  gram.frequency += 1;

  // Add edge weights, and if this is a new state, update degree.
  if (lastId !== undefined) {
    if (!gram.last.normal[lastId]) gram.degreeIn += 1;
    addEdgeWeight(gram, lastId, weight, 'last');
  }

  if (nextId !== undefined) {
    if (!gram.next.normal[nextId]) gram.degreeOut += 1;
    addEdgeWeight(gram, nextId, weight, 'next');
  }
}

/**
 * Adds weight to a directed edge between a Gram and a State.
 * @param source    The Gram to use as the source.
 * @param targetId  The id of the State to use as the target.
 * @param weight    The weight to add to the edge.
 * @param direction The direction of the edge in the chain.
 */
function addEdgeWeight(source: Gram, targetId: string, weight: number, direction: MCDirectionOption) {
  source[direction] = Distribution.addSourceValue(source[direction], targetId, weight);
}

/**
 * Adds a Gram to a Gram dictionary.
 * @param grams   A dictionary of Grams.
 * @param gramId  The id of the Gram to be added to the dictionary.
 * @param order   The order of the Gram.
 */
export function addGram(grams: GramDictionary, gramId: string, order: number) {
  const result = (grams[gramId] = {
    id: gramId,
    order,
    last: Distribution.new(),
    next: Distribution.new(),
    degreeIn: 0,
    degreeOut: 0,
    frequency: 0,
  });
  return result;
}
