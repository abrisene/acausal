/**
 * MarkovChainBatch - Efficient Batch Operations
 *
 * Rewritten to clone the model ONCE, then call module-level
 * addSequence/addEdge directly on the mutable clone.
 * This reduces N+1 clones to exactly 1 clone.
 */

import { MarkovChain } from './markov-chain';
import { MCInsertOption } from './types';
import { addSequence, addEdge, getGramId, getDelimiters } from './utils';

export class MarkovChainBatch<T extends string = string> {
  private _chain: MarkovChain<T>;
  private _clone: ReturnType<typeof MarkovChain.clone>;
  private _delimiters: [string, string, string];
  private _opCount: number;

  constructor(chain: MarkovChain<T>) {
    this._chain = chain;
    // Clone model ONCE upfront
    this._clone = MarkovChain.clone(chain.model);
    this._delimiters = getDelimiters(this._clone);
    this._opCount = 0;
  }

  /**
   * Add a single sequence to the chain.
   * Mutates the clone directly - no additional cloning.
   */
  public addSequence(sequence: string[], insert: MCInsertOption = false): this {
    if (this._clone.sequences !== undefined) this._clone.sequences.push(sequence);
    addSequence(this._clone.grams, sequence, insert, 1, this._clone.maxOrder, this._delimiters);
    this._opCount++;
    return this;
  }

  /**
   * Add multiple sequences to the chain.
   */
  public addSequences(sequences: string[][], insert: MCInsertOption = false): this {
    for (const seq of sequences) {
      this.addSequence(seq, insert);
    }
    return this;
  }

  /**
   * Add an edge between states in the chain.
   * Mutates the clone directly - no additional cloning.
   */
  public addEdge(
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined,
    order: number,
    weight = 1
  ): this {
    const delimiter = this._clone.delimiter[0];
    if (!delimiter) {
      throw new Error('Invalid delimiter configuration');
    }
    const id = Array.isArray(gram) ? getGramId(gram, delimiter) : gram;
    addEdge(this._clone.grams, id, lastId, nextId, order, weight);
    this._opCount++;
    return this;
  }

  /**
   * Commit all operations and return a new MarkovChain instance.
   * No additional clone needed - the model was already cloned in the constructor.
   */
  public commit(): MarkovChain<T> {
    return new MarkovChain({
      ...this._clone,
      seed: this._chain.seed,
      uses: this._chain.uses,
    });
  }

  /**
   * Get the number of pending operations.
   */
  public get pending(): number {
    return this._opCount;
  }

  /**
   * Clear all pending operations without committing.
   * Resets by re-cloning the original model.
   */
  public clear(): this {
    this._clone = MarkovChain.clone(this._chain.model);
    this._delimiters = getDelimiters(this._clone);
    this._opCount = 0;
    return this;
  }
}
