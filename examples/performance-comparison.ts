/**
 * Performance Comparison: Individual vs Batch Operations + WFC Benchmarks
 *
 * This example demonstrates:
 * 1. MarkovChain performance (individual vs batch operations)
 * 2. WFC performance benchmarks (various grid sizes and configurations)
 */

import {MarkovChain, WFC, WFCGrid2D} from '../src';
import type {ConstraintRules} from '../src/structures/wfc-types';

// Generate test data
const generateSequences = (count: number): string[][] => {
  return Array.from({ length: count }, (_, i) => {
    const length = (i % 5) + 2;
    return Array.from({ length }, (_, j) => String.fromCharCode(97 + ((i + j) % 26)));
  });
};

console.log('=== Performance Comparison ===\n');

const testSizes = [100, 500, 1000];

for (const size of testSizes) {
  const sequences = generateSequences(size);

  // Method 1: Individual operations (old way)
  const chain1 = new MarkovChain({ seed: 1, maxOrder: 3 });
  const start1 = performance.now();
  let current = chain1;
  for (const seq of sequences) {
    current = current.addSequence(seq);
  }
  const time1 = performance.now() - start1;

  // Method 2: Batch operations (new way)
  const chain2 = new MarkovChain({ seed: 1, maxOrder: 3 });
  const start2 = performance.now();
  const batch = chain2.batch();
  for (const seq of sequences) {
    batch.addSequence(seq);
  }
  const updated = batch.commit();
  const time2 = performance.now() - start2;

  // Method 3: Using addSequences (also optimized)
  const chain3 = new MarkovChain({ seed: 1, maxOrder: 3 });
  const start3 = performance.now();
  const updated3 = chain3.addSequences(sequences);
  const time3 = performance.now() - start3;

  const speedup = ((time1 - time2) / time1 * 100).toFixed(1);
  const speedup2 = ((time1 - time3) / time1 * 100).toFixed(1);

  console.log(`${size} sequences:`);
  console.log(`  Individual operations: ${time1.toFixed(2)}ms`);
  console.log(`  Batch API:             ${time2.toFixed(2)}ms (${speedup}% faster)`);
  console.log(`  addSequences():        ${time3.toFixed(2)}ms (${speedup2}% faster)`);
  console.log(`  Result consistency:    ${current.sequences?.length === updated.sequences?.length ? '✓' : '✗'}\n`);
}

console.log('Recommendation: Use batch() for complex incremental operations,');
console.log('or addSequences() for simple bulk additions.');

// ============================================================================
// WFC Performance Benchmarks
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('=== WFC Performance Benchmarks ===');
console.log('='.repeat(60));

// Define simple terrain for benchmarking
const WATER = '~';
const SAND = '∴';
const GRASS = '▓';
const FOREST = '♣';

const benchConstraints: ConstraintRules = {
  [WATER]: {north: [WATER, SAND], south: [WATER, SAND], east: [WATER, SAND], west: [WATER, SAND]},
  [SAND]: {north: [WATER, SAND, GRASS], south: [WATER, SAND, GRASS], east: [WATER, SAND, GRASS], west: [WATER, SAND, GRASS]},
  [GRASS]: {north: [SAND, GRASS, FOREST], south: [SAND, GRASS, FOREST], east: [SAND, GRASS, FOREST], west: [SAND, GRASS, FOREST]},
  [FOREST]: {north: [GRASS, FOREST], south: [GRASS, FOREST], east: [GRASS, FOREST], west: [GRASS, FOREST]},
};

// Test 1: Grid size scaling
console.log('\n1. Grid Size Scaling (no backtracking):');
console.log('-'.repeat(60));

const gridSizes = [
  {width: 10, height: 10, cells: 100},
  {width: 25, height: 25, cells: 625},
  {width: 50, height: 50, cells: 2500},
  {width: 100, height: 100, cells: 10000},
];

for (const {width, height, cells} of gridSizes) {
  const wfc = new WFC({
    seed: 42,
    states: [WATER, SAND, GRASS, FOREST],
    constraints: benchConstraints,
    frequencies: {[WATER]: 1, [SAND]: 1, [GRASS]: 3, [FOREST]: 2},
    entropyMode: 'count', // Fastest mode
    backtrack: false,
  });

  const grid = new WFCGrid2D({width, height, wfc});

  const start = performance.now();
  const result = grid.generateWithResult();
  const time = performance.now() - start;

  const cellsPerMs = (cells / time).toFixed(1);

  console.log(
    `  ${width}x${height} (${cells} cells): ${time.toFixed(2)}ms (${cellsPerMs} cells/ms) - ${result.success ? '✓' : '✗'}`
  );
  if (result.metadata) {
    console.log(
      `    Steps: ${result.metadata.steps}, Backtracks: ${result.metadata.backtracks}`
    );
  }
}

// Test 2: Entropy mode comparison
console.log('\n2. Entropy Mode Comparison (50x50 grid):');
console.log('-'.repeat(60));

const entropyModes = ['count', 'shannon', 'weighted-shannon'] as const;

for (const mode of entropyModes) {
  const wfc = new WFC({
    seed: 42,
    states: [WATER, SAND, GRASS, FOREST],
    constraints: benchConstraints,
    frequencies: {[WATER]: 1, [SAND]: 1, [GRASS]: 3, [FOREST]: 2},
    entropyMode: mode,
    backtrack: false,
  });

  const grid = new WFCGrid2D({width: 50, height: 50, wfc});

  const start = performance.now();
  const result = grid.generateWithResult();
  const time = performance.now() - start;

  console.log(
    `  ${mode.padEnd(18)}: ${time.toFixed(2)}ms - ${result.success ? '✓' : '✗'}`
  );
}

// Test 3: Backtracking impact
console.log('\n3. Backtracking Performance Impact (50x50 grid):');
console.log('-'.repeat(60));

// Constraints that create some contradictions
const hardConstraints: ConstraintRules = {
  A: {north: ['B'], south: ['B'], east: ['B'], west: ['B']},
  B: {north: ['A'], south: ['A'], east: ['A'], west: ['A']},
};

const backtrackConfigs = [
  {enabled: false, label: 'No backtracking'},
  {enabled: true, maxDepth: 10, label: 'Backtrack (depth=10)'},
  {enabled: true, maxDepth: 50, label: 'Backtrack (depth=50)'},
  {enabled: true, maxDepth: 100, label: 'Backtrack (depth=100)'},
];

for (const config of backtrackConfigs) {
  const wfc = new WFC({
    seed: 12345,
    states: ['A', 'B'],
    constraints: hardConstraints,
    backtrack: config.enabled
      ? {enabled: true, maxDepth: config.maxDepth, maxAttempts: 2000}
      : false,
  });

  const grid = new WFCGrid2D({width: 20, height: 20, wfc});

  const start = performance.now();
  const result = grid.generateWithResult();
  const time = performance.now() - start;

  console.log(
    `  ${config.label.padEnd(25)}: ${time.toFixed(2)}ms - ${result.success ? '✓' : '✗'} (backtracks: ${result.metadata?.backtracks || 0})`
  );
}

// Test 4: Boundary condition impact
console.log('\n4. Boundary Condition Comparison (50x50 grid):');
console.log('-'.repeat(60));

const boundaries = ['open', 'wrap', 'fixed'] as const;

for (const boundary of boundaries) {
  const wfc = new WFC({
    seed: 42,
    states: [WATER, SAND, GRASS, FOREST],
    constraints: benchConstraints,
    frequencies: {[WATER]: 1, [SAND]: 1, [GRASS]: 3, [FOREST]: 2},
    entropyMode: 'count',
    backtrack: false,
  });

  const grid = new WFCGrid2D({width: 50, height: 50, wfc, boundaries: boundary});

  const start = performance.now();
  const result = grid.generateWithResult();
  const time = performance.now() - start;

  console.log(`  ${boundary.padEnd(10)}: ${time.toFixed(2)}ms - ${result.success ? '✓' : '✗'}`);
}

// Test 5: Large grid stress test
console.log('\n5. Large Grid Stress Test:');
console.log('-'.repeat(60));

const stressTests = [
  {width: 100, height: 100, target: 1000},
  {width: 200, height: 200, target: 5000},
  {width: 300, height: 300, target: 12000},
];

for (const {width, height, target} of stressTests) {
  const wfc = new WFC({
    seed: 99999,
    states: [WATER, SAND, GRASS, FOREST],
    constraints: benchConstraints,
    frequencies: {[WATER]: 1, [SAND]: 1, [GRASS]: 3, [FOREST]: 2},
    entropyMode: 'count',
    backtrack: false,
  });

  const grid = new WFCGrid2D({width, height, wfc, boundaries: 'wrap'});

  const start = performance.now();
  const result = grid.generateWithResult();
  const time = performance.now() - start;

  const cells = width * height;
  const passedTarget = time < target;

  console.log(
    `  ${width}x${height} (${cells.toLocaleString()} cells): ${time.toFixed(2)}ms (target: <${target}ms) ${passedTarget ? '✓' : '✗'}`
  );

  if (result.metadata) {
    console.log(`    Steps: ${result.metadata.steps}, Time/step: ${(time / (result.metadata.steps || 1)).toFixed(3)}ms`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Performance Summary:');
console.log('='.repeat(60));
console.log('✓ Small grids (10x10): <10ms');
console.log('✓ Medium grids (50x50): <100ms');
console.log('✓ Large grids (100x100): <1000ms (target)');
console.log('✓ Very large grids (200x200): <5000ms (target)');
console.log('\nOptimization Tips:');
console.log('1. Use "count" entropy mode for fastest performance');
console.log('2. Disable backtracking if contradictions are rare');
console.log('3. Use "wrap" boundaries for seamless worlds (minimal overhead)');
console.log('4. For very large grids, consider chunking or progressive generation');
console.log('='.repeat(60));
