import { libConfig } from '@capsuletech/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    providers: 'src/providers/index.ts',
    components: 'src/components/index.ts',
    core: 'src/core/index.ts',
    collectors: 'src/collectors/index.ts',
    reporters: 'src/reporters/index.ts',
    api: 'src/api/index.ts',
  },
  name: 'CapsuleProfiler',
});
