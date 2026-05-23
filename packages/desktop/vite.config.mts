import { libConfig } from '../builders/lib/src';

export default libConfig({
  entry: 'src/index.ts',
  name: 'CapsuleDesktop',
  runtime: 'node',
  // tsconfig.json excludes __tests__ so dts plugin won't emit test declaration files
});
