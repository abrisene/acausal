/**
 * ImmutableMarkovChain
 *
 * Immutable variant of MarkovChain where mutating methods
 * return new instances instead of modifying internal state.
 */

import { Random } from '@acausal/random';
import { MarkovChain } from './markov-chain';
import { MCInsertOption } from './types';
import type { BlendOptions } from './blend';

/**
 * Immutable variant of MarkovChain.
 * Mutating methods return new instances instead of modifying internal state.
 *
 * Note: Forked instances (returned by mutating methods) share initial PRNG
 * state with the original via `engine.clone()`. They will produce identical
 * random sequences until their usage patterns (number of draws) diverge.
 * If independent randomness is needed immediately after forking, re-seed or
 * advance one of the engines before use.
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
    return new ImmutableMarkovChain<T>({
      ...MarkovChain.clone(this._model, stripSequences),
      engine: this._engine.clone(),
    });
  }

  /**
   * Returns a new mutable {@link MarkovChain} from the current state.
   */
  public toMutable(): MarkovChain<T> {
    return new MarkovChain<T>({
      ...MarkovChain.clone(this._model),
      engine: this._engine.clone(),
    });
  }

  /**
   * Create an immutable chain from a mutable chain's current state.
   */
  public static from<T extends string = string>(chain: MarkovChain<T>): ImmutableMarkovChain<T> {
    const src = chain as MarkovChain<T> & {
      _model: ReturnType<typeof MarkovChain.clone>;
      _engine: Random;
    };

    return new ImmutableMarkovChain<T>({
      ...MarkovChain.clone(src._model),
      engine: src._engine.clone(),
    });
  }
}
