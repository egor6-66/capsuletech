// libConfig живёт в отдельном пакете @capsuletech/lib-builder
// (packages/builders/lib), чтобы разорвать цикл: vite-builder/src/plugins/
// compliance.ts импортит @capsuletech/compliance, а compliance в своём
// vite.config.mts использует libConfig. Если бы libConfig оставался в
// vite-builder — nx обнаруживал бы циклическую зависимость.
//
// Re-export сохраняет публичный runtime API `@capsuletech/vite-builder` →
// можно делать `import { libConfig } from '@capsuletech/vite-builder'` как
// раньше.

export type { IDefineLibConfigOptions, LibRuntime } from '@capsuletech/lib-builder';
export { libConfig } from '@capsuletech/lib-builder';
