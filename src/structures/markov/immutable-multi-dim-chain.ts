/**
 * ImmutableMultiDimMarkovChain
 *
 * Immutable variant of MultiDimMarkovChain where mutating methods
 * return new instances instead of modifying internal state.
 */

import { MarkovChain } from './markov-chain';
import { ImmutableMarkovChain } from './immutable-markov-chain';
import { MultiDimMarkovChain } from './multi-dim-chain';

export class ImmutableMultiDimMarkovChain<T> extends MultiDimMarkovChain<T> {
  public override addSequence(sequence: T[]): this {
    if (sequence.length === 0) return this;

    const newStore = { ...this.stateStore };
    const keys = sequence.map(state => {
      const key = this.stateKeyFn(state);
      newStore[key] = state;
      return key;
    });

    const newInternalChain = new ImmutableMarkovChain<string>({
      ...this.internalChain.serialize(),
      engine: this._engine.clone(),
    }).addSequence(keys);

    return ImmutableMultiDimMarkovChain.fromParts(
      newInternalChain as MarkovChain<string>,
      newStore,
      this.stateKeyFn,
      this.stateKeyName,
      this._engine
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
}
