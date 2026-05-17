import { libConfig } from '@capsuletech/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    'app-config': 'src/app-config.ts',
  },
  name: 'CapsuleQuery',
});
