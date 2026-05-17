import * as path from 'node:path';
import { libConfig } from '../shared/lib-config/src';
// Деep-import minуя @capsuletech/shared-vite/dist — иначе nx graph хочет
// собранный shared-vite ещё до запуска build target'ов.
import { staticCopyPlugin } from '../shared/vite/src/plugins/staticCopy';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    'bin/capsule': 'bin/capsule.mjs',
  },
  name: 'CapsuleCli',
  runtime: 'node',
  external: [
    'react',
    /^react\//,
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-reconciler',
    /^react-reconciler\//,
    'scheduler',
    /^scheduler\//,
    'yoga-layout',
    /^yoga-layout\//,
    'ink',
    /^ink\//,
    'ink-select-input',
    'ink-text-input',
    'string-width',
  ],
  plugins: [
    staticCopyPlugin([
      {
        src: path.resolve(__dirname, 'src/templates'),
        dest: path.resolve(__dirname, 'dist/templates'),
      },
    ]),
  ],
});
