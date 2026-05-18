export { defineConfig, mergeConfig } from 'vite';
export * from './actions';
export * as defines from './defines';
export type { ICapsuleConfig } from './defines/capsuleConfig';
export type { IDefineLibConfigOptions } from './defines/libConfig';
export { libConfig } from './defines/libConfig';
export * as plugins from './plugins';
