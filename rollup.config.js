import pluginTypescript from '@rollup/plugin-typescript';

const common = {
  input: 'src/index.ts',
  plugins: [
    pluginTypescript(),
  ],
  external: ['fs', 'path', '@actions/core', 'child_process', 'shell-escape', '@actions/github'],
};

export default [
  {
    ...common,
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
    },
  },
  {
    ...common,
    output: {
      file: 'dist/index.mjs',
      format: 'es',
    },
  },
];
