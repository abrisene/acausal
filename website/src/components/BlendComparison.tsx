import { useState, useMemo } from 'react';
import { MarkovChain, Random } from 'acausal';
import type { BlendStrategy } from 'acausal';

const DEFAULT_CHAIN_A = `honoka, akari, himari, sakura, mei`;
const DEFAULT_CHAIN_B = `grace, fiadh, emily, sophie, aoife`;

const STRATEGIES: BlendStrategy[] = [
  'arithmetic',
  'geometric',
  'harmonic',
  'max',
  'min',
];

function parseNames(text: string): string[][] {
  return text
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => name.split(''));
}

function generateNames(
  chain: MarkovChain,
  count: number,
  seed: number,
  maxOrder: number
): string[] {
  const engine = new Random({ seed });
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const seq = MarkovChain.generate({
      model: chain.dto,
      order: maxOrder,
      min: 3,
      max: 8,
      strict: false,
      trim: true,
      engine,
    });
    results.push(seq.join(''));
  }
  return results;
}

export default function BlendComparison() {
  const [textA, setTextA] = useState(DEFAULT_CHAIN_A);
  const [textB, setTextB] = useState(DEFAULT_CHAIN_B);
  const [strategy, setStrategy] = useState<BlendStrategy>('arithmetic');
  const [weight, setWeight] = useState(0.5);
  const [seed, setSeed] = useState(42);
  const [count, setCount] = useState(10);
  const [maxOrder, setMaxOrder] = useState(2);

  const { namesA, namesB, namesBlended } = useMemo(() => {
    try {
      const seqA = parseNames(textA);
      const seqB = parseNames(textB);

      if (seqA.length === 0 || seqB.length === 0) {
        return { namesA: [], namesB: [], namesBlended: [] };
      }

      const chainA = new MarkovChain({ maxOrder, sequences: seqA });
      const chainB = new MarkovChain({ maxOrder, sequences: seqB });

      const blended = MarkovChain.blend(
        [
          { chain: chainA, weight: 1 - weight },
          { chain: chainB, weight: weight },
        ],
        { strategy }
      );

      const namesA = generateNames(chainA, count, seed, maxOrder);
      const namesB = generateNames(chainB, count, seed, maxOrder);
      const namesBlended = generateNames(blended, count, seed, maxOrder);

      return { namesA, namesB, namesBlended };
    } catch {
      return { namesA: [], namesB: [], namesBlended: [] };
    }
  }, [textA, textB, strategy, weight, seed, count, maxOrder]);

  return (
    <div className="playground">
      <h3>Training Data</h3>

      <div className="playground-row">
        <div className="playground-control">
          <label htmlFor="blend-chain-a">Chain A names</label>
          <textarea
            id="blend-chain-a"
            rows={3}
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
          />
        </div>
        <div className="playground-control">
          <label htmlFor="blend-chain-b">Chain B names</label>
          <textarea
            id="blend-chain-b"
            rows={3}
            value={textB}
            onChange={(e) => setTextB(e.target.value)}
          />
        </div>
      </div>

      <hr className="playground-separator" />
      <h3>Blend Controls</h3>

      <div className="playground-controls">
        <div className="playground-control" style={{ minWidth: 160 }}>
          <label htmlFor="blend-strategy">Strategy</label>
          <select
            id="blend-strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as BlendStrategy)}
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="playground-control" style={{ minWidth: 200 }}>
          <label htmlFor="blend-weight">
            Chain B weight: {weight.toFixed(2)}
          </label>
          <input
            id="blend-weight"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </div>

        <div className="playground-control" style={{ minWidth: 120 }}>
          <label htmlFor="blend-maxorder">Max order: {maxOrder}</label>
          <input
            id="blend-maxorder"
            type="range"
            min={1}
            max={5}
            step={1}
            value={maxOrder}
            onChange={(e) => setMaxOrder(Number(e.target.value))}
          />
        </div>

        <div className="playground-control" style={{ minWidth: 80 }}>
          <label htmlFor="blend-seed">Seed</label>
          <input
            id="blend-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </div>

        <div className="playground-control" style={{ minWidth: 80 }}>
          <label htmlFor="blend-count">Count</label>
          <input
            id="blend-count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(50, Number(e.target.value))))
            }
          />
        </div>
      </div>

      <hr className="playground-separator" />
      <h3>Generated Names</h3>

      <div className="playground-row">
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--sl-color-gray-2, #8b949e)',
              marginBottom: '0.5rem',
            }}
          >
            Chain A only
          </div>
          <div className="playground-tags">
            {namesA.map((name, i) => (
              <span key={i} className="playground-tag">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--sl-color-gray-2, #8b949e)',
              marginBottom: '0.5rem',
            }}
          >
            Chain B only
          </div>
          <div className="playground-tags">
            {namesB.map((name, i) => (
              <span key={i} className="playground-tag">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--sl-color-accent, #6c8aec)',
              marginBottom: '0.5rem',
            }}
          >
            Blended ({strategy})
          </div>
          <div className="playground-tags">
            {namesBlended.map((name, i) => (
              <span
                key={i}
                className="playground-tag"
                style={{
                  borderLeft: '2px solid var(--sl-color-accent, #6c8aec)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
