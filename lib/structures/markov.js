"use strict";
/*
 # markov.ts
 # Markov Class
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkovChain = void 0;
/**
 # Module Dependencies
 */
const services_1 = require("../services");
/**
 # Constants
 */
const defaultOptions = {
    maxOrder: 4,
    delimiter: '⏐',
    startDelimiter: '○',
    endDelimiter: '◍',
};
const defaultDTO = {
    ...defaultOptions,
    sequences: [],
    grams: {},
};
/**
 # Class
 */
class MarkovChain {
    constructor({ engine, seed, uses, maxOrder = 4, delimiter = '⏐', startDelimiter = '○', endDelimiter = '◍', sequences = defaultDTO.sequences, grams = defaultDTO.grams, }) {
        this._engine = engine || new services_1.Random({ seed, uses });
        this._maxOrder = maxOrder;
        this._delimiter = delimiter;
        this._startDelimiter = startDelimiter;
        this._endDelimiter = endDelimiter;
        this._sequences = sequences || [];
        this._grams = grams || {};
    }
    /**
     * Regenerates the normalized distribution map.
     * Called any time that the underlying distribution changes.
     */
    regenerate() {
        // this._distributionNormal = normalizeObject(this._distribution);
        return this;
    }
    static create(data) {
        const { sequences, engine, ...props } = data;
        return MarkovChain.addSequences({ ...props, grams: {}, sequences: [] }, sequences, false);
    }
    static new(data) {
        return MarkovChain.create(data);
    }
    static getGramId(data, gramSequence) {
        return gramSequence.join(data.delimiter);
    }
    static getGram(data, gramSequence) {
        const id = MarkovChain.getGramId(data, gramSequence);
        return data.grams[id];
    }
    static addSequences(data, sequences, copy = true) {
        // Configs
        let m = copy ? MarkovChain.clone(data) : data;
        // Add the sequences.
        for (let i = 0; i < sequences.length; i += 1) {
            m = MarkovChain.addSequence(m, sequences[i], false);
        }
        return m;
    }
    static addSequence(data, sequence, copy = true) {
        // Configs
        let m = copy ? MarkovChain.clone(data) : data;
        // Delimiters
        const maxOrder = m.maxOrder || defaultOptions.maxOrder;
        const startDelimiter = m.startDelimiter || defaultOptions.startDelimiter;
        const endDelimiter = m.endDelimiter || defaultOptions.endDelimiter;
        // If we wanted to store the raw sequences, we'd do it here.
        if (m.sequences !== undefined)
            m.sequences.push(sequence);
        // Add delimiters so we can properly generate the grams.
        const seq = [startDelimiter, ...sequence, endDelimiter];
        // Iterate through each order.
        for (let order = 1; order <= maxOrder; order += 1) {
            // Iterate through each position in the array.
            for (let pos = 0; pos < seq.length; pos += 1) {
                const nextPos = pos + order;
                const lastPos = pos - 1;
                // if (nextPos > seq.length - 1) break;
                // Find the previous and next states.
                const lastState = lastPos >= 0 ? seq[lastPos] : undefined;
                const nextState = nextPos < seq.length ? seq[nextPos] : undefined;
                // Get the gram sequence and id.
                const gramSeq = seq.slice(pos, nextPos);
                const gramId = MarkovChain.getGramId(m, gramSeq);
                // Add the gram and edge.
                m = MarkovChain.addEdge(m, gramId, lastState, nextState, order, false);
                // Break if we've hit the end delimiter.
                // if (nextState === data.endDelimiter) break;
                if (nextState === undefined)
                    break;
            }
        }
        return m;
    }
    static addEdge(data, id, last, next, order, copy = true) {
        // Configs
        const m = copy ? MarkovChain.clone(data) : data;
        const { grams } = m;
        // Add the gram if it doesn't exist.
        if (grams[id] === undefined) {
            grams[id] = {
                id,
                order,
                last: {},
                lastCount: {},
                next: {},
                nextCount: {},
                degreeIn: 0,
                degreeOut: 0,
                frequency: 0,
            };
        }
        // Add the edges to the distributions.
        const gram = grams[id];
        // TODO: FIX
        if (last !== undefined) {
            // gram.last = Distribution.add(gram.last, last, 1);
            gram.degreeIn += 1;
            gram.frequency += 1;
        }
        if (next !== undefined) {
            // gram.next = Distribution.add(gram.next, next, 1);
            gram.degreeOut += 1;
            gram.frequency += 1;
        }
        return m;
    }
    static pick(engine, model, gramSequence, next = true, mask) {
        const gram = MarkovChain.getGram(model, gramSequence);
        let result;
        if (gram !== undefined) {
            const distribution = next ? gram.next : gram.last;
            if (distribution !== undefined) {
                result = engine.pickWeighted(gram.next, mask);
            }
        }
        return result;
    }
    static next(engine, model, gramSequence, mask) {
        return MarkovChain.pick(engine, model, gramSequence, true, mask);
    }
    static last(engine, model, gramSequence, mask) {
        return MarkovChain.pick(engine, model, gramSequence, false, mask);
    }
    static generate(engine, model, start = [], order, min = 4, max = 100, strict = false) {
        const startDelimiter = model.startDelimiter || defaultOptions.startDelimiter;
        const endDelimiter = model.endDelimiter || defaultOptions.endDelimiter;
        const sequence = [startDelimiter, ...start];
        const defaultOrder = order || sequence.length;
        let currentOrder = defaultOrder;
        let nextState;
        for (let i = 0; i < max; i += 1) {
            // Set the mask if applicable.
            const mask = [];
            if (i < max - 1) {
                let gram = undefined;
                if (i < min)
                    mask.push(endDelimiter);
                // Find a gram of the highest possible order.
                for (let o = currentOrder; o > 0; o -= 1) {
                    const gramSeq = sequence.slice(sequence.length - o, sequence.length);
                    gram = this.getGram(model, gramSeq);
                    // If we have a Gram and we're over our min, or we're not guaranteed to end, then break.
                    if (gram !== undefined && (i > min || gram.next[endDelimiter] < 1))
                        break;
                }
                // Add our next state to the sequence.
                if (gram !== undefined)
                    nextState = engine.pickWeighted(gram.next, mask);
                // if (gram !== undefined) console.log(gram.id);
                // if (gram !== undefined) console.log(gram.next, max);
                if (nextState !== undefined)
                    sequence.push(nextState);
                // Break if our next state is the end delimiter.
                if (nextState === endDelimiter)
                    break;
                // Adjust the order if dynamic.
                if (currentOrder < defaultOrder) {
                    currentOrder += 1;
                }
                else if (currentOrder === defaultOrder &&
                    defaultOrder > 1 &&
                    !strict) {
                    currentOrder -= 1;
                }
            }
            else {
                // Set the final state to end delimiter and break.
                nextState = endDelimiter;
                sequence.push(nextState);
                break;
            }
        }
        return sequence;
    }
    /**
     * Create a deep copy of a Markov Chain DTO.
     * @param data Markov DTO to clone.
     */
    static clone(data) {
        const { sequences, grams, ...rest } = data;
        const sequencesClone = sequences !== undefined ? sequences.map(s => [...s]) : undefined;
        const gramsClone = Object.keys(grams).reduce((l, k) => {
            const gram = grams[k];
            const gramClone = {
                ...gram,
                last: { ...gram.last },
                next: { ...gram.next },
            };
            return { ...l, [k]: gramClone };
        }, {});
        return {
            ...rest,
            sequences: sequencesClone,
            grams: gramsClone,
        };
    }
}
exports.MarkovChain = MarkovChain;
//# sourceMappingURL=markov.js.map