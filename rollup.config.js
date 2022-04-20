import pluginTypescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.mjs',
    format: 'es',
  },
  plugins: [
    pluginTypescript(),
  ],
  external: ['fs', 'path', '@actions/core', 'child_process', 'shell-escape', '@actions/github'],
};
