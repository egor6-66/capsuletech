// libConfig теперь живёт в отдельном пакете @capsuletech/shared-lib-config,
// чтобы разорвать цикл: shared-vite/src/plugins/compliance.ts импортит
// shared-compliance, а compliance в свою очередь использует libConfig.
// Если libConfig оставался бы в shared-vite — nx обнаруживал бы циклическую
// зависимость в graph через source-imports vite.config.mts во всех пакетах.
//
// Re-export сохраняет публичный runtime API `@capsuletech/shared-vite` →
// можно делать `import { libConfig } from '@capsuletech/shared-vite'` как
// раньше. Все vite.config.mts в монорепо переехали на source-path к
// `shared/lib-config/src` чтобы их граф строился без dist.
export { libConfig } from '@capsuletech/shared-lib-config';
export type { IDefineLibConfigOptions, LibRuntime } from '@capsuletech/shared-lib-config';
