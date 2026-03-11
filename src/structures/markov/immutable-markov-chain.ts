/**
 * ImmutableMarkovChain
 *
 * Immutable variant of MarkovChain where mutating methods
 * return new instances instead of modifying internal state.
 */

import { MarkovChain } from './markov-chain';
import { MCInsertOption } from './types';
import type { BlendOptions } from './blend';

/**
 * Immutable variant of MarkovChain.
 * Mutating methods return new instances instead of modifying internal state.
 *
 * Note: Not designed for further subclassing. The `this` return type is a
 * convenience for method chaining, not a polymorphism guarantee.
 */
export class ImmutableMarkovChain<T extends string = string> extends MarkovChain<T> {
  public override addSequences(sequences: string[][], insert: MCInsertOption = false): this {
    const data = MarkovChain.addSequences(this._model, sequences, insert);
    return new ImmutableMarkovChain<T>({ ...data, engine: this._engine.clone() }) as this;
  }

  public override addSequence(sequence: string[], insert: MCInsertOption = false): this {
    const data = MarkovChain.addSequence(this._model, sequence, insert);
    return new ImmutableMarkovChain<T>({ ...data, engine: this._engine.clone() }) as this;
  }

  public override addEdge(
    gram: string | string[],
    lastId: string | undefined,
    nextId: string | undefined,
    order: number
  ): this {
    const data = MarkovChain.addEdge(this._model, gram, lastId, nextId, order);
    return new ImmutableMarkovChain<T>({ ...data, engine: this._engine.clone() }) as this;
  }

  public override interpolate(otherChain: MarkovChain<T>, alpha: number, options?: BlendOptions): this {
    const data = MarkovChain.blendDTOs(
      [
        { model: this._model, weight: 1 - alpha },
        { model: otherChain.model, weight: alpha },
      ],
      options
    );
    return new ImmutableMarkovChain<T>({ ...data, engine: this._engine.clone() }) as this;
  }

  public override clone(stripSequences = false) {
    return new ImmutableMarkovChain<T>(this.serialize(stripSequences));
  }
}
