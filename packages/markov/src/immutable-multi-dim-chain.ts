/**
 * ImmutableMultiDimMarkovChain
 *
 * Immutable variant of MultiDimMarkovChain where mutating methods
 * return new instances instead of modifying internal state.
 */

import { Random } from '@acausal/random';
import { MarkovChain } from './markov-chain';
import { MultiDimMarkovChain } from './multi-dim-chain';

/**
 * Immutable variant of MultiDimMarkovChain.
 * Mutating methods return new instances instead of modifying internal state.
 *
 * Note: Forked instances share initial PRNG state (via `engine.clone()`) and
 * will produce identical random sequences until their usage patterns diverge.
 * If independent randomness is needed immediately, re-seed or advance one of
 * the engines before use.
 *
 * Note: Not designed for further subclassing. The `this` return type is a
 * convenience for method chaining, not a polymorphism guarantee.
 */
export class ImmutableMultiDimMarkovChain<T> extends MultiDimMarkovChain<T> {
  public override addSequence(sequence: T[]): this {
    if (sequence.length === 0) return this;

    const newStore = { ...this.stateStore };
    const keys = sequence.map(state => {
      const key = this.stateKeyFn(state);
      newStore[key] = state;
      return key;
    });

    // Use the static MarkovChain.addSequence directly on the serialized DTO
    // to avoid constructing a throwaway ImmutableMarkovChain instance.
    const updatedDTO = MarkovChain.addSequence(this.internalChain.serialize(), keys);
    const newInternalChain = new MarkovChain<string>({ ...updatedDTO, engine: this._engine.clone() });

    return ImmutableMultiDimMarkovChain.fromParts(
      newInternalChain,
      newStore,
      this.stateKeyFn,
      this.stateKeyName,
      this._engine.clone()
    ) as this;
  }

  public override addSequences(sequences: T[][]): this {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let result: this = this;
    for (const seq of sequences) {
      result = result.addSequence(seq);
    }
    return result;
  }

  public override clone(): MultiDimMarkovChain<T> {
    return ImmutableMultiDimMarkovChain.fromParts(
      this.internalChain.clone(),
      { ...this.stateStore },
      this.stateKeyFn,
      this.stateKeyName,
      this._engine.clone()
    );
  }

  /**
   * Returns a new mutable {@link MultiDimMarkovChain} from the current state.
   */
  public toMutable(): MultiDimMarkovChain<T> {
    return MultiDimMarkovChain.fromParts(
      this.internalChain.clone(),
      { ...this.stateStore },
      this.stateKeyFn,
      this.stateKeyName,
      this._engine.clone()
    );
  }

  /**
   * Create an immutable multi-dim chain from a mutable chain's current state.
   * Uses the chain's internal structure directly — no registry lookup needed.
   */
  public static from<T>(chain: MultiDimMarkovChain<T>): ImmutableMultiDimMarkovChain<T> {
    // Access protected fields via the subclass relationship.
    // This is safe because ImmutableMultiDimMarkovChain extends MultiDimMarkovChain.
    const src = chain as unknown as {
      internalChain: MarkovChain<string>;
      stateStore: { [key: string]: T };
      stateKeyFn: (state: T) => string;
      stateKeyName: string;
      _engine: Random;
    };
    return ImmutableMultiDimMarkovChain.fromParts(
      src.internalChain.clone(),
      { ...src.stateStore },
      src.stateKeyFn,
      src.stateKeyName,
      src._engine.clone()
    ) as ImmutableMultiDimMarkovChain<T>;
  }
}
