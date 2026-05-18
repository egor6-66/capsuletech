import { check, formatViolations, type ICheckOptions } from '@capsuletech/compliance';
import type { Plugin } from 'vite';

export interface ICompliancePluginOptions extends Omit<ICheckOptions, 'aliasKeys'> {
  /**
   * `warn` — нарушения логируются как warning, dev-server не падает.
   * `error` — нарушения валят билд / dev-сервер.
   * По умолчанию `warn` для первого rollout'а; ужесточаем когда чисто.
   */
  mode?: 'warn' | 'error';
  /**
   * Mutable-источник зарегистрированных алиасов. AppConfigPlugin записывает сюда `aliasKeys`
   * после загрузки `capsule.app.ts`; Compliance читает на каждом `transform`.
   */
  appConfigState?: { aliasKeys: Set<string> };
}

export const CompliancePlugin = (opts: ICompliancePluginOptions = {}): Plugin => {
  const mode = opts.mode ?? 'warn';

  return {
    name: 'capsule-compliance',
    enforce: 'pre',
    transform(code, id) {
      const violations = check(id, code, {
        ...opts,
        aliasKeys: opts.appConfigState?.aliasKeys,
      });
      if (violations.length === 0) return null;

      const msg = formatViolations(violations);
      if (mode === 'warn') {
        this.warn(msg);
        return null;
      }
      this.error(msg);
    },
  };
};
