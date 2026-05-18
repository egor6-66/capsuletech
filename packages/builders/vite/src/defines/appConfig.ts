import { mergeConfig, type UserConfig } from 'vite';

export const appConfig = (config: UserConfig, idDev: boolean) => {
  return mergeConfig(
    {
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        reportCompressedSize: true,
        sourcemap: !idDev,
        minify: idDev ? 'esbuild' : false,
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      },
      css: {
        devSourcemap: idDev,
      },
      optimizeDeps: {
        exclude: [
          '@tailwindcss/oxide',
          '@tailwindcss/oxide-win32-x64-msvc',
          '@tailwindcss/building.ts',
        ],
      },
      server: {
        host: true,
      },
    },
    config,
  );
};
