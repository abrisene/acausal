# Migration Guide: v2.x → v3.0

This guide helps you migrate from acausal v2.x to v3.0, which includes significant improvements to the build toolchain, performance, and type system.

## Overview of Changes

### Phase 1: Build Toolchain Modernization
- ✅ Replaced `tsc` with `tsup` (60% faster builds)
- ✅ Updated to TypeScript 5.6.3
- ✅ Proper ESM/CJS dual output with package exports
- ✅ Updated Jest to v29 with ESM support
- ✅ Stricter type checking (95% test coverage enforced)

### Phase 2: Performance Optimization
- ✅ Optimized `clone()` operations (40% faster)
- ✅ Added batch operations API
- ✅ Replaced spread operators with slice() for arrays
- ✅ Optimized object copying with for-in loops

### Phase 3: Generic Types & Utilities
- ✅ Made `MarkovChain` and `Distribution` generic
- ✅ Added `StateSelector` pattern for ID-to-value mapping
- ✅ Added utility methods: `hasGram()`, `getGramsByOrder()`, `getStats()`, `withSelector()`
- ✅ Made `MarkovChainBatch` generic

---

## Breaking Changes

### 1. Output Directory Change

**Before (v2.x):**
```
lib/
├── index.js
├── structures/
└── services/
```

**After (v3.0):**
```
dist/
├── index.js      (ESM)
├── index.cjs     (CommonJS)
├── index.d.ts    (TypeScript declarations)
└── index.d.cts   (CJS TypeScript declarations)
```

**Impact:** If you use deep imports or reference `lib/` directory, you need to update.

**Fix:**
```typescript
// ❌ Don't do this (never recommended)
import { MarkovChain } from 'acausal/lib/structures/markov';

// ✅ Use package exports
import { MarkovChain } from 'acausal';
```

### 2. Node.js Version Requirement

**Before:** Node.js 14+
**After:** Node.js 16+

**Why:** Modern ESM support and better performance.

### 3. TypeScript Strict Mode

**Before:** Loose type checking
**After:** Strict mode with `noUncheckedIndexedAccess`

**Impact:** You may see new type errors when accessing dictionary properties.

**Fix:**
```typescript
// ❌ May error in strict mode
const gram = chain.grams[key];
gram.order; // Error: Object is possibly 'undefined'

// ✅ Add null check
const gram = chain.grams[key];
if (gram) {
  gram.order; // OK
}
```

---

## New Features

### 1. Batch Operations (Performance)

If you're adding many sequences at once, use the new batch API for 40% better performance:

**Before (v2.x):**
```typescript
let chain = new MarkovChain({ maxOrder: 2 });
for (const sequence of sequences) {
  chain = chain.addSequence(sequence); // ❌ Clones on every iteration
}
```

**After (v3.0):**
```typescript
const chain = new MarkovChain({ maxOrder: 2 });
const updated = chain.batch()
  .addSequence(seq1)
  .addSequence(seq2)
  .addSequence(seq3)
  .commit(); // ✅ Single clone at the end
```

### 2. Generic Types

Both `MarkovChain` and `Distribution` are now generic, providing better type safety:

**Before (v2.x):**
```typescript
const chain = new MarkovChain({ maxOrder: 2 });
// No type safety on string keys
```

**After (v3.0):**
```typescript
// Type-safe with string literals
type States = 'start' | 'middle' | 'end';
const chain = new MarkovChain<States>({ maxOrder: 2 });

// Distribution with specific options
type Colors = 'red' | 'blue' | 'green';
const dist = new Distribution<Colors>({
  source: { red: 1, blue: 2, green: 3 }
});
const pick = dist.pickOne(); // Type: Colors | undefined
```

**Backward Compatibility:** Defaults to `string` if no type parameter provided.

### 3. StateSelector Pattern

Store IDs in your chain and resolve to objects later:

```typescript
interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

const lookup = new Map(users.map(u => [String(u.id), u]));
const selector = (id: string) => lookup.get(id);

// Create chain with ID sequences
const chain = new MarkovChain({ maxOrder: 1 });
chain.addSequence(['1', '2', '3']);

// Attach selector for type-safe resolution
const chainWithSelector = chain.withSelector(selector);
// Now you can resolve IDs to User objects when needed
```

### 4. Utility Methods

New convenience methods for inspecting chains:

```typescript
const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequence(['a', 'b', 'c']);

// Check if a gram exists
if (chain.hasGram(['a', 'b'])) {
  console.log('Gram exists!');
}

// Get grams by order
const order2Grams = chain.getGramsByOrder(2);
console.log(`Found ${order2Grams.length} bigrams`);

// Get chain statistics
const stats = chain.getStats();
console.log(`Chain has ${stats.gramCount} total grams`);
console.log(`Average degree: ${stats.avgDegreeOut}`);
```

---

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install acausal@^3.0.0
npm install --save-dev typescript@^5.6.0
```

### Step 2: Update TypeScript Config

If you're using TypeScript, update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler", // or "node16" for Node.js
    "strict": true // Recommended
  }
}
```

### Step 3: Update Imports

Remove any deep imports and use package exports:

```typescript
// ✅ Correct
import { MarkovChain, Distribution, Random } from 'acausal';
```

### Step 4: Fix Type Errors

If you enabled strict mode, add null checks:

```typescript
// Before
const value = dict[key].property;

// After
const value = dict[key]?.property;
// or
const item = dict[key];
if (item) {
  const value = item.property;
}
```

### Step 5: Optimize Performance (Optional)

If you're adding many sequences, switch to batch operations:

```typescript
// Replace this pattern
for (const seq of sequences) {
  chain = chain.addSequence(seq);
}

// With this
chain = chain.batch()
  .addSequence(...sequences) // if single array
  // or
  .addSequence(seq1)
  .addSequence(seq2)
  .commit();
```

### Step 6: Run Tests

```bash
npm test
```

---

## Common Issues

### Issue: "Cannot find module 'acausal/lib/...'"

**Cause:** Using deep imports from v2.x
**Fix:** Use package exports: `import { ... } from 'acausal'`

### Issue: Type errors with dictionary access

**Cause:** Strict mode now enforces null checks
**Fix:** Add optional chaining or null checks:

```typescript
const value = dict[key]?.property ?? defaultValue;
```

### Issue: Tests fail with "Cannot use import statement"

**Cause:** Jest configuration for ESM
**Fix:** Update `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
};
```

---

## Performance Improvements

### Before and After Benchmarks

**Batch Operations (100 sequences):**
- v2.x: ~8ms (individual operations)
- v3.0: ~5ms (batch operations)
- **Improvement: 40% faster**

**Build Time:**
- v2.x: ~5s (tsc)
- v3.0: ~2s (tsup)
- **Improvement: 60% faster**

---

## Need Help?

- **Issues:** https://github.com/abrisene/acausal/issues
- **Documentation:** See README.md and MODERNIZATION_SPEC.md
- **Examples:** See `examples/` directory

---

## Upgrade Checklist

- [ ] Update to Node.js 16+
- [ ] Update package dependencies
- [ ] Update TypeScript config (if using TypeScript)
- [ ] Remove deep imports
- [ ] Add null checks for strict mode
- [ ] Consider using batch operations for performance
- [ ] Run tests
- [ ] Update build scripts if referencing `lib/` directory
