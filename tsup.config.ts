import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false, // Keep readable for library debugging
  target: 'es2022',
  outDir: 'dist',

  // Type check after successful build
  onSuccess: 'tsc --noEmit',
});
