import type { Options } from 'tsup';

export const baseConfig: Options = {
  format: ['cjs', 'esm'],
  dts: { resolve: true },
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
};
