/*
 * Import/Export & Visualization Examples
 * Demonstrates graph export, JSON serialization, and chain comparison
 */

import { MarkovChain } from '../dist/index.js';

console.log('=== Import/Export & Visualization Examples ===\n');

// ============================================================================
// Example 1: Basic Graph Export
// ============================================================================
console.log('--- Example 1: Exporting Chain as Graph ---\n');

const userFlowChain = new MarkovChain({ maxOrder: 2 });
userFlowChain.addSequences([
  ['home', 'products', 'laptop', 'cart', 'checkout'],
  ['home', 'products', 'phone', 'details', 'exit'],
  ['search', 'laptop', 'compare', 'cart', 'checkout'],
  ['home', 'products', 'laptop', 'reviews', 'cart'],
]);

const graph = userFlowChain.exportAsGraph();

console.log(`Graph structure:`);
console.log(`  - Nodes (states): ${graph.nodes.length}`);
console.log(`  - Edges (transitions): ${graph.edges.length}`);
console.log(`  - Max order: ${graph.metadata.maxOrder}`);
console.log(`  - Total sequences: ${graph.metadata.totalSequences}\n`);

console.log('Sample nodes:');
graph.nodes.slice(0, 3).forEach(node => {
  console.log(`  ${node.id} (order: ${node.order}, frequency: ${node.frequency})`);
});

console.log('\nSample edges:');
graph.edges.slice(0, 3).forEach(edge => {
  console.log(`  ${edge.from} → ${edge.to} (probability: ${(edge.probability * 100).toFixed(1)}%)`);
});
console.log();

// ============================================================================
// Example 2: JSON Export for External Analysis
// ============================================================================
console.log('--- Example 2: JSON Export ---\n');

const weatherChain = new MarkovChain({ maxOrder: 2 });
weatherChain.addSequences([
  ['sunny', 'sunny', 'cloudy', 'rainy'],
  ['sunny', 'cloudy', 'cloudy', 'rainy'],
  ['rainy', 'cloudy', 'sunny', 'sunny'],
]);

const json = weatherChain.toJSON();

console.log('Exported JSON structure:');
console.log(JSON.stringify(json, null, 2));
console.log();

// ============================================================================
// Example 3: Comparing Two Chains
// ============================================================================
console.log('--- Example 3: Comparing Two Models ---\n');

const chainV1 = new MarkovChain({ maxOrder: 2 });
chainV1.addSequences([
  ['a', 'b', 'c'],
  ['a', 'b', 'd'],
  ['x', 'y', 'z'],
]);

const chainV2 = new MarkovChain({ maxOrder: 2 });
chainV2.addSequences([
  ['a', 'b', 'c'],
  ['a', 'x', 'y'],
  ['p', 'q', 'r'],
]);

const diff = chainV1.diff(chainV2);

console.log('Chain comparison results:');
console.log(`  Added grams: ${diff.added.length}`);
if (diff.added.length > 0) {
  console.log(`    ${diff.added.join(', ')}`);
}

console.log(`  Removed grams: ${diff.removed.length}`);
if (diff.removed.length > 0) {
  console.log(`    ${diff.removed.join(', ')}`);
}

console.log(`  Common grams: ${diff.common.length}`);
if (diff.common.length > 0) {
  console.log(`    ${diff.common.slice(0, 5).join(', ')}`);
}

console.log(`  Modified frequencies: ${diff.modified.length}`);
if (diff.modified.length > 0) {
  diff.modified.forEach(m => {
    console.log(`    ${m.gram}: ${m.chain1Freq} → ${m.chain2Freq} (${m.difference > 0 ? '+' : ''}${m.difference})`);
  });
}
console.log();

// ============================================================================
// Example 4: Visualizing User Journey (Conversion Funnel)
// ============================================================================
console.log('--- Example 4: User Journey Funnel Visualization Data ---\n');

const funnelChain = new MarkovChain({ maxOrder: 2 });
funnelChain.addSequences([
  ['home', 'products', 'laptop', 'cart', 'checkout', 'success'],
  ['home', 'products', 'phone', 'details', 'exit'],
  ['search', 'laptop', 'compare', 'cart', 'checkout', 'success'],
  ['home', 'products', 'laptop', 'cart', 'exit'],
  ['home', 'products', 'tablet', 'details', 'cart', 'checkout'],
]);

const funnelGraph = funnelChain.exportAsGraph();

// Convert to D3.js force-directed graph format
const d3Data = {
  nodes: funnelGraph.nodes.map(n => ({
    id: n.id,
    label: n.states.join(' → '),
    size: n.frequency,
    group: n.order,
  })),
  links: funnelGraph.edges.map(e => ({
    source: e.from,
    target: e.to,
    value: e.weight,
    strength: e.probability,
  })),
};

console.log('D3.js-compatible data structure:');
console.log(`  Nodes: ${d3Data.nodes.length}`);
console.log(`  Links: ${d3Data.links.length}\n`);

console.log('Top conversion paths (highest probability edges):');
funnelGraph.edges
  .sort((a, b) => b.probability - a.probability)
  .slice(0, 5)
  .forEach(edge => {
    console.log(`  ${edge.from} → ${edge.to} (${(edge.probability * 100).toFixed(0)}%)`);
  });
console.log();

// ============================================================================
// Example 5: A/B Test Comparison
// ============================================================================
console.log('--- Example 5: A/B Test Analysis ---\n');

// Control group (before change)
const controlChain = new MarkovChain({ maxOrder: 2 });
controlChain.addSequences([
  ['landing', 'signup', 'form', 'exit'],
  ['landing', 'signup', 'form', 'submit', 'success'],
  ['landing', 'features', 'signup', 'form', 'exit'],
  ['landing', 'signup', 'form', 'exit'],
  ['landing', 'pricing', 'signup', 'form', 'submit'],
]);

// Treatment group (after change)
const treatmentChain = new MarkovChain({ maxOrder: 2 });
treatmentChain.addSequences([
  ['landing', 'signup', 'form', 'submit', 'success'],
  ['landing', 'signup', 'form', 'submit', 'success'],
  ['landing', 'features', 'signup', 'form', 'submit', 'success'],
  ['landing', 'signup', 'form', 'exit'],
  ['landing', 'pricing', 'signup', 'form', 'submit', 'success'],
]);

const abTestDiff = controlChain.diff(treatmentChain);

console.log('A/B Test Results:\n');

console.log('Impact Analysis:');
console.log(`  New user paths: ${abTestDiff.added.length}`);
console.log(`  Removed paths: ${abTestDiff.removed.length}`);
console.log(`  Modified paths: ${abTestDiff.modified.length}\n`);

const improvements = abTestDiff.modified.filter(m => m.difference > 0);
const declines = abTestDiff.modified.filter(m => m.difference < 0);

if (improvements.length > 0) {
  console.log('Improved paths (↑ frequency):');
  improvements.forEach(m => {
    console.log(`  ${m.gram}: ${m.chain1Freq} → ${m.chain2Freq} (+${m.difference})`);
  });
  console.log();
}

if (declines.length > 0) {
  console.log('Declined paths (↓ frequency):');
  declines.forEach(m => {
    console.log(`  ${m.gram}: ${m.chain1Freq} → ${m.chain2Freq} (${m.difference})`);
  });
  console.log();
}

// ============================================================================
// Example 6: Model Version Control
// ============================================================================
console.log('--- Example 6: Tracking Model Changes Over Time ---\n');

// Version 1.0 - Initial model
const modelV1 = new MarkovChain({ maxOrder: 2 });
modelV1.addSequences([
  ['user', 'types', 'query', 'submit'],
  ['user', 'clicks', 'button', 'submit'],
]);

console.log('Model v1.0 created');
console.log(`  Grams: ${modelV1.getStats().grams}`);
console.log(`  Sequences: ${modelV1.getStats().sequences}\n`);

// Version 2.0 - After collecting more data
const modelV2 = modelV1.clone();
modelV2.addSequences([
  ['user', 'types', 'query', 'autocomplete', 'submit'],
  ['user', 'voice', 'command', 'submit'],
]);

console.log('Model v2.0 (with new data)');
console.log(`  Grams: ${modelV2.getStats().grams}`);
console.log(`  Sequences: ${modelV2.getStats().sequences}\n`);

const versionDiff = modelV1.diff(modelV2);

console.log('Changelog (v1.0 → v2.0):');
console.log(`  + New patterns: ${versionDiff.added.length}`);
versionDiff.added.forEach(gram => {
  console.log(`    - ${gram}`);
});

console.log(`  ~ Modified patterns: ${versionDiff.modified.length}`);
versionDiff.modified.forEach(m => {
  console.log(`    - ${m.gram} (freq: ${m.chain1Freq} → ${m.chain2Freq})`);
});
console.log();

// ============================================================================
// Example 7: Debugging Model Behavior
// ============================================================================
console.log('--- Example 7: Debugging with JSON Export ---\n');

const debugChain = new MarkovChain({ maxOrder: 2 });
debugChain.addSequences([
  ['start', 'common', 'common', 'end'],
  ['start', 'common', 'rare', 'end'],
  ['start', 'rare', 'end'],
]);

const debugExport = debugChain.toJSON();

console.log('Analyzing why "rare" transitions are uncommon:\n');

debugExport.grams.forEach(gram => {
  if (gram.pattern.includes('rare')) {
    console.log(`Pattern: ${gram.pattern.join(' → ')}`);
    console.log(`  Frequency: ${gram.frequency}`);
    console.log(`  Next states:`, gram.next);
    console.log();
  }
});

// ============================================================================
// Example 8: Cytoscape Network Visualization
// ============================================================================
console.log('--- Example 8: Social Network Export (Cytoscape format) ---\n');

const socialChain = new MarkovChain({ maxOrder: 1 });
socialChain.addSequences([
  ['alice', 'bob', 'carol', 'david'],
  ['alice', 'eve', 'frank'],
  ['bob', 'carol', 'eve'],
  ['carol', 'david', 'alice'],
]);

const socialGraph = socialChain.exportAsGraph();

// Convert to Cytoscape.js format
const cytoscapeData = {
  elements: {
    nodes: socialGraph.nodes.map(n => ({
      data: {
        id: n.id,
        label: n.states[n.states.length - 1] || n.id,
        weight: n.frequency,
        order: n.order,
      },
    })),
    edges: socialGraph.edges.map((e, i) => ({
      data: {
        id: `edge-${i}`,
        source: e.from,
        target: e.to,
        weight: e.probability,
        rawWeight: e.weight,
      },
    })),
  },
  layout: {
    name: 'cose',
    idealEdgeLength: 100,
    nodeOverlap: 20,
  },
  style: [
    {
      selector: 'node',
      style: {
        'background-color': '#666',
        label: 'data(label)',
        width: 'data(weight)',
        height: 'data(weight)',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 'data(weight)',
        'line-color': '#ccc',
        'curve-style': 'bezier',
      },
    },
  ],
};

console.log('Cytoscape.js configuration generated:');
console.log(`  Nodes: ${cytoscapeData.elements.nodes.length}`);
console.log(`  Edges: ${cytoscapeData.elements.edges.length}`);
console.log(`  Layout: ${cytoscapeData.layout.name}\n`);

console.log('Sample connections:');
socialGraph.edges.slice(0, 5).forEach(edge => {
  console.log(`  ${edge.from} → ${edge.to} (strength: ${(edge.probability * 100).toFixed(0)}%)`);
});
console.log();

// ============================================================================
// Example 9: Dataset Merge Analysis
// ============================================================================
console.log('--- Example 9: Analyzing Dataset Overlap for Merging ---\n');

const dataset1 = new MarkovChain({ maxOrder: 2 });
dataset1.addSequences([
  ['a', 'b', 'c'],
  ['a', 'b', 'd'],
  ['x', 'y', 'z'],
]);

const dataset2 = new MarkovChain({ maxOrder: 2 });
dataset2.addSequences([
  ['a', 'b', 'c'],
  ['p', 'q', 'r'],
  ['m', 'n', 'o'],
]);

const mergeAnalysis = dataset1.diff(dataset2);

console.log('Dataset comparison for merge decision:\n');

const totalPatterns =
  mergeAnalysis.common.length +
  mergeAnalysis.added.length +
  mergeAnalysis.removed.length;

const overlapRatio = mergeAnalysis.common.length / totalPatterns;

console.log(`Common patterns: ${mergeAnalysis.common.length}`);
console.log(`Unique to dataset 1: ${mergeAnalysis.removed.length}`);
console.log(`Unique to dataset 2: ${mergeAnalysis.added.length}`);
console.log(`\nOverlap ratio: ${(overlapRatio * 100).toFixed(1)}%\n`);

if (overlapRatio > 0.5) {
  console.log('✓ High overlap - datasets are compatible for merging');
  const merged = dataset1.clone();
  merged.addSequences([
    ['a', 'b', 'c'],
    ['p', 'q', 'r'],
    ['m', 'n', 'o'],
  ]);
  console.log(`Merged model has ${merged.getStats().grams} total grams`);
} else {
  console.log('⚠ Low overlap - datasets may represent different domains');
  console.log('Consider keeping them separate or analyzing further');
}
console.log();

// ============================================================================
// Example 10: Exporting for Machine Learning Pipeline
// ============================================================================
console.log('--- Example 10: Export for ML Pipeline ---\n');

const mlChain = new MarkovChain({ maxOrder: 2 });
mlChain.addSequences([
  ['feature1', 'feature2', 'label_A'],
  ['feature1', 'feature3', 'label_B'],
  ['feature2', 'feature3', 'label_A'],
]);

const mlExport = mlChain.toJSON();

// Convert to feature matrix format
console.log('Exported for ML pipeline:\n');
console.log('Metadata:', mlExport.metadata);
console.log('\nFeature transitions:');

mlExport.grams.forEach(gram => {
  const features = gram.pattern.join('_');
  const labels = Object.keys(gram.next);

  console.log(`  Features: ${features}`);
  console.log(`    Predicted labels:`, gram.next);
});

console.log('\n✓ Ready for export to Python/R/sklearn');
console.log();

console.log('=== End of Examples ===');
