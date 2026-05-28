export { default as solidPlugin } from 'vite-plugin-solid';
export { default as tsconfigPaths } from 'vite-tsconfig-paths';
export { AliasesPlugin } from './aliases';
export { CompliancePlugin } from './compliance';
export { HMRWrappingPlugin } from './HMRWrapping';
export { RouterPlugin } from './router';
export { EnsureScaffoldPlugin } from './scaffold';
export { staticCopyPlugin } from './staticCopy';

// Unified codegen orchestrator — replaces ExportGeneratorPlugin,
// EndpointsRegistryPlugin, and AppConfigPlugin (codegen part).
export { CapsuleRegistryPlugin, LAYER_INIT_ORDER } from './capsuleRegistry';
// Re-export sub-generators for tests and external tooling.
export {
  generateWrappersRuntime,
  generateWrappersTypes,
  generateEndpointsRuntime,
  generateEndpointsTypes,
  generateAppConfigRuntime,
  generateBootstrap,
} from './capsuleRegistry';
