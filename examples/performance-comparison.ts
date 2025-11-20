/**
 * Performance Comparison: Individual vs Batch Operations
 *
 * This example demonstrates the performance difference between
 * adding sequences one-at-a-time vs using the batch API.
 */

import { MarkovChain } from '../src';

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
