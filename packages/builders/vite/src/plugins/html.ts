import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export function HtmlPlugin(htmlPath: string, entryPath: string): Plugin {
  return {
    name: 'capsule-html-plugin',
    // 1. Позволяем Vite найти index.html, даже если его нет в apps/sandbox
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.endsWith('.html') || req.url === '/') {
            try {
              // Читаем HTML из пакета core
              let html = readFileSync(htmlPath, 'utf-8');

              // Преобразуем HTML через Vite (для работы HMR и плагинов)
              html = await server.transformIndexHtml(req.url, html);

              // Подставляем путь к main.tsx приложения
              // entryPath должен быть относительным от корня (apps/sandbox)

              html = html.replace('%APP_ENTRY%', entryPath);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            } catch (e) {
              next(e);
            }
          } else {
            next();
          }
        });
      };
    },
  };
}
