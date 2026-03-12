import { useState, useMemo } from 'react';
import { MarkovChain } from 'acausal';

const DEFAULT_SEQUENCES = `sunny cloudy rainy
sunny sunny cloudy rainy
cloudy rainy sunny
rainy cloudy sunny cloudy`;

const ACCENT = 'rgba(108, 138, 236,';

interface GramData {
  id: string;
  states: string[];
  transitions: Record<string, number>;
}

function parseSequences(text: string, charMode: boolean): string[][] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => (charMode ? line.split('') : line.split(/\s+/)));
}

function buildChainData(sequences: string[][], maxOrder: number, displayOrder: number) {
  if (sequences.length === 0 || sequences.every(s => s.length === 0)) {
    return { stats: null, grams: [], uniqueStates: [], matrix: [] as number[][] };
  }

  const chain = new MarkovChain({ maxOrder, sequences });
  const stats = chain.getStats();
  const orderGrams = chain.getGramsByOrder(displayOrder);

  const gramDataList: GramData[] = orderGrams.map(gram => ({
    id: gram.id,
    states: gram.id.split('\u23F0'),
    transitions: { ...gram.next.normal },
  }));

  const targetStates = new Set<string>();
  const sourceLabels = new Set<string>();

  for (const gd of gramDataList) {
    sourceLabels.add(gd.id);
    for (const target of Object.keys(gd.transitions)) {
      targetStates.add(target);
    }
  }

  const allUniqueStates = Array.from(targetStates).sort();
  const sortedSources = gramDataList.map(g => g.id).sort();

  const matrix: number[][] = sortedSources.map(sourceId => {
    const gram = gramDataList.find(g => g.id === sourceId)!;
    return allUniqueStates.map(target => gram.transitions[target] ?? 0);
  });

  return {
    stats,
    grams: gramDataList,
    uniqueStates: allUniqueStates,
    sourceLabels: sortedSources,
    matrix,
  };
}

function formatState(state: string): string {
  if (state === '\u25CB') return '\u25CB start';
  if (state === '\u25CD') return '\u25CD end';
  return state;
}

function formatGramId(id: string): string {
  return id.split('\u23F0').map(formatState).join(' \u2192 ');
}

export default function ChainVisualizer() {
  const [text, setText] = useState(DEFAULT_SEQUENCES);
  const [charMode, setCharMode] = useState(false);
  const [maxOrder, setMaxOrder] = useState(2);
  const [displayOrder, setDisplayOrder] = useState(1);

  const effectiveDisplayOrder = Math.min(displayOrder, maxOrder);

  const sequences = useMemo(() => parseSequences(text, charMode), [text, charMode]);

  const { stats, grams, uniqueStates, sourceLabels, matrix } = useMemo(
    () => buildChainData(sequences, maxOrder, effectiveDisplayOrder),
    [sequences, maxOrder, effectiveDisplayOrder]
  );

  return (
    <div className="playground">
      <h3>Training Sequences</h3>
      <div className="playground-control">
        <label htmlFor="cv-sequences">One sequence per line (tokens separated by spaces)</label>
        <textarea id="cv-sequences" rows={4} value={text} onChange={e => setText(e.target.value)} />
      </div>

      <hr className="playground-separator" />

      <div className="playground-controls">
        <div className="playground-control">
          <label htmlFor="cv-char-mode">Token mode</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`playground-button sm${!charMode ? ' primary' : ''}`} onClick={() => setCharMode(false)}>
              Word
            </button>
            <button className={`playground-button sm${charMode ? ' primary' : ''}`} onClick={() => setCharMode(true)}>
              Character
            </button>
          </div>
        </div>

        <div className="playground-control">
          <label htmlFor="cv-max-order">Max order: {maxOrder}</label>
          <input
            id="cv-max-order"
            type="range"
            min={1}
            max={5}
            value={maxOrder}
            onChange={e => {
              const val = Number(e.target.value);
              setMaxOrder(val);
              if (displayOrder > val) setDisplayOrder(val);
            }}
          />
        </div>

        <div className="playground-control">
          <label htmlFor="cv-display-order">Display order: {effectiveDisplayOrder}</label>
          <input
            id="cv-display-order"
            type="range"
            min={1}
            max={maxOrder}
            value={effectiveDisplayOrder}
            onChange={e => setDisplayOrder(Number(e.target.value))}
          />
        </div>
      </div>

      {stats && (
        <>
          <hr className="playground-separator" />

          <h3>Chain Statistics</h3>
          <div className="playground-stats">
            <div className="playground-stat">
              <div className="playground-stat-value">{stats.gramCount}</div>
              <div className="playground-stat-label">Total Grams</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">{stats.sequenceCount}</div>
              <div className="playground-stat-label">Sequences</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">{stats.avgDegreeIn.toFixed(2)}</div>
              <div className="playground-stat-label">Avg Degree In</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">{stats.avgDegreeOut.toFixed(2)}</div>
              <div className="playground-stat-label">Avg Degree Out</div>
            </div>
            <div className="playground-stat">
              <div className="playground-stat-value">
                {stats.orderRange[0]}&ndash;{stats.orderRange[1]}
              </div>
              <div className="playground-stat-label">Order Range</div>
            </div>
          </div>

          <hr className="playground-separator" />

          <h3>Transition Matrix (Order {effectiveDisplayOrder})</h3>
          {sourceLabels!.length > 0 ? (
            <div className="playground-table-wrap">
              <table className="playground-table">
                <thead>
                  <tr>
                    <th>From \ To</th>
                    {uniqueStates!.map(target => (
                      <th key={target}>{formatState(target)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sourceLabels!.map((sourceId, rowIdx) => (
                    <tr key={sourceId}>
                      <td>{formatGramId(sourceId)}</td>
                      {matrix![rowIdx]!.map((prob, colIdx) => (
                        <td
                          key={colIdx}
                          style={{
                            background: prob > 0 ? `${ACCENT} ${prob * 0.85})` : undefined,
                            color:
                              prob > 0.5
                                ? 'var(--sl-color-black)'
                                : prob > 0
                                  ? 'var(--sl-color-white)'
                                  : 'var(--sl-color-gray-4)',
                            fontWeight: prob > 0.5 ? 600 : 400,
                          }}
                        >
                          {prob > 0 ? prob.toFixed(2) : '\u2014'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="playground-output">
              No grams found at order {effectiveDisplayOrder}. Try adding more training data or adjusting the order.
            </div>
          )}

          <hr className="playground-separator" />

          <h3>Gram Transitions (Order {effectiveDisplayOrder})</h3>
          {grams.length > 0 ? (
            <div className="playground-grams">
              {grams
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(gram => {
                  const entries = Object.entries(gram.transitions).sort(([, a], [, b]) => b - a);
                  if (entries.length === 0) return null;
                  return (
                    <div key={gram.id}>
                      <div className="playground-gram-label">{formatGramId(gram.id)}</div>
                      <div className="playground-bar-chart">
                        {entries.map(([target, prob]) => {
                          const pct = (prob * 100).toFixed(1);
                          return (
                            <div className="playground-bar-row" key={target}>
                              <span className="playground-bar-label">{formatState(target)}</span>
                              <div className="playground-bar-track">
                                <div className="playground-bar-fill" style={{ width: `${Math.max(prob * 100, 2)}%` }}>
                                  {prob >= 0.05 ? `${pct}%` : ''}
                                </div>
                              </div>
                              {prob < 0.05 && <span className="playground-small-value">{pct}%</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="playground-output">No grams at order {effectiveDisplayOrder}.</div>
          )}
        </>
      )}

      {!stats && (
        <div className="playground-output" style={{ marginTop: '1rem' }}>
          Enter training sequences above to visualize the Markov chain.
        </div>
      )}
    </div>
  );
}
