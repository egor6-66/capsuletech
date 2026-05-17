// IAppConfig переехал в @capsuletech/web-query/app-config: он тянул ApiConfig +
// MwToolbox из web-query, создавая инверсию зависимости (тонкий core зависел от
// тяжёлого query ради одного интерфейса). Здесь остаётся только реэкспорт
// wrapper-интерфейсов для удобства.
export * from './wrappers/interfaces';
