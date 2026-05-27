// IAppConfig живёт в @capsuletech/web-core/app-config (отдельный subpath).
// web-query расширяет его через module augmentation (api?-поле) — см.
// packages/web/query/src/app-config-augment.ts. Это разрывает обратный nx-cycle
// (web-query → web-core → web-query), который существовал, пока в web-query
// был deprecated re-export.
export * from './wrappers/interfaces';
