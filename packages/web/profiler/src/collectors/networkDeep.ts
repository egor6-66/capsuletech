import { isBrowser } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

type FetchFn = typeof fetch;

interface IPatched {
  fetch?: { orig: FetchFn };
  xhrOpen?: { orig: XMLHttpRequest['open'] };
  xhrSend?: { orig: XMLHttpRequest['send'] };
  ws?: { orig: typeof WebSocket };
}

export interface INetworkDeepOpts {
  patchFetch?: boolean;
  patchXHR?: boolean;
  patchWebSocket?: boolean;
}

export function networkDeepCollector(opts: INetworkDeepOpts = {}): ICollector {
  const patchFetch = opts.patchFetch ?? true;
  const patchXHR = opts.patchXHR ?? true;
  const patchWebSocket = opts.patchWebSocket ?? true;

  return {
    name: 'networkDeep',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;

      const patched: IPatched = {};
      let inflight = 0;
      let total = 0;
      let failed = 0;

      const onStart = () => {
        inflight++;
        total++;
        bus.write('network.inflight', inflight);
        bus.write('network.requests', total);
      };
      const onEnd = (ok: boolean) => {
        inflight--;
        if (!ok) {
          failed++;
          bus.write('network.failed', failed);
        }
        bus.write('network.inflight', inflight);
      };

      if (patchFetch && typeof window.fetch === 'function') {
        const orig = window.fetch.bind(window);
        patched.fetch = { orig };
        window.fetch = async (...args: Parameters<FetchFn>) => {
          onStart();
          try {
            const res = await orig(...args);
            onEnd(res.ok);
            return res;
          } catch (err) {
            onEnd(false);
            throw err;
          }
        };
      }

      if (patchXHR && typeof XMLHttpRequest !== 'undefined') {
        const origSend = XMLHttpRequest.prototype.send;
        patched.xhrSend = { orig: origSend };
        XMLHttpRequest.prototype.send = function (
          this: XMLHttpRequest,
          body?: Document | XMLHttpRequestBodyInit | null,
        ) {
          onStart();
          let settled = false;
          const settle = (ok: boolean) => {
            if (settled) return;
            settled = true;
            onEnd(ok);
          };
          this.addEventListener('load', () => settle(this.status < 400));
          this.addEventListener('error', () => settle(false));
          this.addEventListener('abort', () => settle(false));
          this.addEventListener('timeout', () => settle(false));
          return origSend.call(this, body as XMLHttpRequestBodyInit | null);
        };
      }

      if (patchWebSocket && typeof WebSocket !== 'undefined') {
        const OrigWS = WebSocket;
        patched.ws = { orig: OrigWS };
        const PatchedWS = function (
          this: WebSocket,
          url: string | URL,
          protocols?: string | string[],
        ) {
          onStart();
          const ws = new OrigWS(url, protocols);
          let settled = false;
          const settle = (ok: boolean) => {
            if (settled) return;
            settled = true;
            onEnd(ok);
          };
          ws.addEventListener('open', () => settle(true));
          ws.addEventListener('error', () => settle(false));
          ws.addEventListener('close', () => settle(true));
          return ws;
        } as unknown as typeof WebSocket;
        PatchedWS.prototype = OrigWS.prototype;
        Object.assign(PatchedWS, OrigWS);
        (window as { WebSocket: typeof WebSocket }).WebSocket = PatchedWS;
      }

      return () => {
        if (patched.fetch) window.fetch = patched.fetch.orig;
        if (patched.xhrSend) XMLHttpRequest.prototype.send = patched.xhrSend.orig;
        if (patched.ws) (window as { WebSocket: typeof WebSocket }).WebSocket = patched.ws.orig;
      };
    },
  };
}
