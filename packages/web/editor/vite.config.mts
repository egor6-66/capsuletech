import { libConfig } from '@capsuletech/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    manifests: 'src/manifests/index.ts',
    state: 'src/state/index.ts',
    inspector: 'src/inspector/index.ts',
  },
  name: 'CapsuleEditor',
});
