import { libConfig } from '@capsuletech/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    providers: 'src/providers/index.ts',
    components: 'src/components/index.ts',
  },
  name: 'CapsuleProfiler',
});
