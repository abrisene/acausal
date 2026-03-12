import { useState, useMemo, useCallback } from 'react';
import { MarkovChain } from 'acausal';

const DEFAULT_NAMES = [
  'honoka', 'akari', 'himari', 'mei', 'yui', 'sakura', 'koharu', 'aoi',
  'grace', 'fiadh', 'emily', 'sophie', 'aisling', 'caoimhe', 'niamh', 'saoirse',
].join('\n');

function parseNames(text: string): string[][] {
  return text
    .split(/[,\n]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0)
    .map(s => s.split(''));
}

export default function NameGenerator() {
  const [trainingText, setTrainingText] = useState(DEFAULT_NAMES);
  const [maxOrder, setMaxOrder] = useState(2);
  const [minLength, setMinLength] = useState(3);
  const [maxLength, setMaxLength] = useState(8);
  const [seed, setSeed] = useState(42);
  const [count, setCount] = useState(10);
  const [strict, setStrict] = useState(false);
  const [rerollCounter, setRerollCounter] = useState(0);

  const results = useMemo(() => {
    const sequences = parseNames(trainingText);
    if (sequences.length === 0) {
      return { names: [], stats: null };
    }

    try {
      const chain = new MarkovChain({
        seed: seed + rerollCounter,
        maxOrder,
        sequences,
      });

      const generated: string[] = [];
      const seen = new Set<string>();

      // Generate more than needed to account for duplicates
      const maxAttempts = count * 3;
      for (let i = 0; i < maxAttempts && generated.length < count; i++) {
        try {
          const result = chain.generate({
            order: maxOrder,
            min: minLength,
            max: maxLength,
            strict,
          });

          // Trim delimiters and join
          const name = result
            .filter(c => c !== '\u25CB' && c !== '\u25CD')
            .join('');

          if (name.length > 0 && !seen.has(name)) {
            seen.add(name);
            generated.push(name);
          }
        } catch {
          // Skip failed generation attempts
        }
      }

      const stats = chain.getStats();
      return { names: generated, stats };
    } catch {
      return { names: [], stats: null };
    }
  }, [trainingText, maxOrder, minLength, maxLength, seed, count, strict, rerollCounter]);

  const handleReroll = useCallback(() => {
    setRerollCounter(c => c + 1);
  }, []);

  return (
    <div className="playground">
      <h3>Training Data</h3>
      <div className="playground-control">
        <label htmlFor="ng-training">Names (comma or newline separated)</label>
        <textarea
          id="ng-training"
          rows={4}
          value={trainingText}
          onChange={e => setTrainingText(e.target.value)}
        />
      </div>

      <hr className="playground-separator" />

      <h3>Parameters</h3>
      <div className="playground-controls">
        <div className="playground-control">
          <label htmlFor="ng-order">Max Order: {maxOrder}</label>
          <input
            id="ng-order"
            type="range"
            min={1}
            max={5}
            value={maxOrder}
            onChange={e => setMaxOrder(Number(e.target.value))}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="ng-min">Min Length: {minLength}</label>
          <input
            id="ng-min"
            type="range"
            min={2}
            max={15}
            value={minLength}
            onChange={e => {
              const val = Number(e.target.value);
              setMinLength(val);
              if (val > maxLength) setMaxLength(val);
            }}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="ng-max">Max Length: {maxLength}</label>
          <input
            id="ng-max"
            type="range"
            min={2}
            max={15}
            value={maxLength}
            onChange={e => {
              const val = Number(e.target.value);
              setMaxLength(val);
              if (val < minLength) setMinLength(val);
            }}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="ng-seed">Seed</label>
          <input
            id="ng-seed"
            type="number"
            value={seed}
            onChange={e => setSeed(Number(e.target.value))}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="ng-count">Count</label>
          <input
            id="ng-count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="ng-strict">
            <input
              id="ng-strict"
              type="checkbox"
              checked={strict}
              onChange={e => setStrict(e.target.checked)}
            />{' '}
            Strict Mode
          </label>
        </div>
      </div>

      <button className="playground-button primary" onClick={handleReroll}>
        Re-roll ↻
      </button>

      <hr className="playground-separator" />

      <h3>Generated Names</h3>
      {results.names.length > 0 ? (
        <div className="playground-tags">
          {results.names.map((name, i) => (
            <span key={`${name}-${i}`} className="playground-tag">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <div className="playground-output">
          No names generated. Try adjusting parameters or adding more training data.
        </div>
      )}

      {results.stats && (
        <>
          <hr className="playground-separator" />
          <h3>Chain Stats</h3>
          <div className="playground-stats">
            <div className="playground-stat">
              <div className="playground-stat-value">{results.stats.gramCount}</div>
              <div className="playground-stat-label">Gram Count</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">
                {results.stats.avgDegreeOut.toFixed(2)}
              </div>
              <div className="playground-stat-label">Avg Degree Out</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">
                {results.stats.avgDegreeIn.toFixed(2)}
              </div>
              <div className="playground-stat-label">Avg Degree In</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">{results.stats.sequenceCount}</div>
              <div className="playground-stat-label">Sequences</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
