import { libConfig } from '../../builders/lib/src';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    create: 'src/create/index.ts',
    providers: 'src/providers/index.ts',
  },
  name: 'CapsuleCore',
  runtime: 'isomorphic',
});
