import { useState, useMemo, useCallback, useRef } from 'react';
import { Distribution } from 'acausal';

interface WeightItem {
  id: number;
  name: string;
  weight: number;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

function getItemColor(name: string): string {
  return RARITY_COLORS[name.toLowerCase()] ?? 'var(--sl-color-accent)';
}

const DEFAULT_ITEMS: WeightItem[] = [
  { id: 1, name: 'common', weight: 60 },
  { id: 2, name: 'uncommon', weight: 25 },
  { id: 3, name: 'rare', weight: 10 },
  { id: 4, name: 'epic', weight: 4 },
  { id: 5, name: 'legendary', weight: 1 },
];

export default function WeightEditor() {
  const nextId = useRef(6);
  const [items, setItems] = useState<WeightItem[]>(DEFAULT_ITEMS);
  const [seed, setSeed] = useState(42);
  const [count, setCount] = useState(20);
  const [results, setResults] = useState<string[] | null>(null);

  const validItems = useMemo(() => items.filter(item => item.name.trim() !== '' && item.weight > 0), [items]);

  const sourceWeights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const item of validItems) {
      w[item.name] = (w[item.name] ?? 0) + item.weight;
    }
    return w;
  }, [validItems]);

  const dist = useMemo(() => {
    if (Object.keys(sourceWeights).length === 0) return null;
    return new Distribution({ seed, source: sourceWeights });
  }, [sourceWeights, seed]);

  const normalWeights = dist?.normal ?? {};

  const handleNameChange = useCallback((id: number, name: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, name } : item)));
    setResults(null);
  }, []);

  const handleWeightChange = useCallback((id: number, value: string) => {
    const weight = Math.max(0, Number(value) || 0);
    setItems(prev => prev.map(item => (item.id === id ? { ...item, weight } : item)));
    setResults(null);
  }, []);

  const handleRemove = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setResults(null);
  }, []);

  const handleAdd = useCallback(() => {
    setItems(prev => [...prev, { id: nextId.current++, name: '', weight: 1 }]);
    setResults(null);
  }, []);

  const handleSample = useCallback(() => {
    if (!dist) return;
    const sampleDist = new Distribution({ seed, source: sourceWeights });
    const picks = sampleDist.pick({ count });
    setResults(picks);
  }, [dist, seed, sourceWeights, count]);

  const resultCounts = useMemo(() => {
    if (!results) return null;
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
    return counts;
  }, [results]);

  const barEntries = useMemo(() => {
    return Object.entries(normalWeights).sort(([, a], [, b]) => b - a);
  }, [normalWeights]);

  return (
    <div className="playground">
      <h3>Distribution Items</h3>
      <div className="playground-items">
        {items.map(item => (
          <div key={item.id} className="playground-item-row">
            <div className="playground-color-pip" style={{ background: getItemColor(item.name) }} />
            <div className="playground-control">
              <input
                type="text"
                value={item.name}
                onChange={e => handleNameChange(item.id, e.target.value)}
                placeholder="Item name"
              />
            </div>
            <div className="playground-control">
              <input
                type="number"
                value={item.weight}
                min={0}
                onChange={e => handleWeightChange(item.id, e.target.value)}
              />
            </div>
            <button className="playground-button sm" onClick={() => handleRemove(item.id)} title="Remove item">
              Remove
            </button>
          </div>
        ))}
      </div>
      <button className="playground-button" onClick={handleAdd}>
        + Add Item
      </button>

      <hr className="playground-separator" />

      <h3>Probability Distribution</h3>
      {barEntries.length > 0 ? (
        <div className="playground-bar-chart">
          {barEntries.map(([name, prob]) => {
            const pct = (prob * 100).toFixed(1);
            const color = getItemColor(name);
            return (
              <div className="playground-bar-row" key={name}>
                <span className="playground-bar-label">{name}</span>
                <div className="playground-bar-track">
                  <div
                    className="playground-bar-fill"
                    style={{ width: `${Math.max(prob * 100, 2)}%`, background: color }}
                  >
                    {prob >= 0.03 ? `${pct}%` : ''}
                  </div>
                </div>
                {prob < 0.03 && <span className="playground-small-value">{pct}%</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="playground-output">Add items with weights to see the probability distribution.</div>
      )}

      <hr className="playground-separator" />

      <h3>Sampler</h3>
      <div className="playground-controls">
        <div className="playground-control">
          <label>Seed</label>
          <input
            type="number"
            value={seed}
            onChange={e => {
              setSeed(Number(e.target.value) || 0);
              setResults(null);
            }}
          />
        </div>
        <div className="playground-control">
          <label>Count: {count}</label>
          <input
            type="range"
            min={1}
            max={100}
            value={count}
            onChange={e => {
              setCount(Number(e.target.value));
              setResults(null);
            }}
          />
        </div>
        <button
          className="playground-button primary"
          onClick={handleSample}
          disabled={!dist}
          style={{ alignSelf: 'end' }}
        >
          Sample
        </button>
      </div>

      {results && resultCounts && (
        <>
          <h3>Results</h3>
          <div className="playground-tags">
            {results.map((name, i) => (
              <span key={i} className="playground-tag" style={{ borderLeft: `3px solid ${getItemColor(name)}` }}>
                {name}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: '0.75rem' }}>Frequency Comparison</h3>
          <div className="playground-stats">
            {barEntries.map(([name]) => {
              const actual = resultCounts[name] ?? 0;
              const expected = (normalWeights[name] ?? 0) * count;
              const color = getItemColor(name);
              return (
                <div className="playground-stat" key={name}>
                  <div className="playground-stat-value" style={{ color }}>
                    {actual}/{count}
                  </div>
                  <div className="playground-stat-label">{name}</div>
                  <div className="playground-stat-label" style={{ marginTop: '0.25rem' }}>
                    expected ~{expected.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
