// Корневой barrel — реэкспортит все три подпакета. Для tree-shaking
// предпочтительно импортировать через подпуть:
//   import { getManifest } from '@capsuletech/web-editor/manifests';
//   import { addNode }    from '@capsuletech/web-editor/state';
//   import { Inspector }  from '@capsuletech/web-editor/inspector';
// Тут — точка для тех, кому удобнее «всё в одном импорте».

export * from './inspector';
export * from './manifests';
export * from './state';
