/* eslint-disable import/no-nodejs-modules */
import * as http from 'http';

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>授权成功</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;}
.card{background:#fff;border-radius:12px;padding:48px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.1);}
h1{color:#22c55e;margin:0 0 12px;}p{color:#666;margin:0;}</style>
</head><body><div class="card"><h1>&#10003; 授权成功</h1><p>请返回 Obsidian 继续操作。此页面可以关闭。</p></div></body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>授权失败</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;}
.card{background:#fff;border-radius:12px;padding:48px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.1);}
h1{color:#ef4444;margin:0 0 12px;}p{color:#666;margin:0;}</style>
</head><body><div class="card"><h1>&#10007; 授权失败</h1><p>缺少授权码，请重试。</p></div></body></html>`;

export interface OAuthServerResult {
  port: number;
  codePromise: Promise<string>;
  shutdown: () => void;
}

export function startOAuthServer(expectedState: string): Promise<OAuthServerResult> {
  return new Promise((resolveStart, rejectStart) => {
    let settled = false;
    let codeResolve: (code: string) => void;
    let codeReject: (err: Error) => void;

    const codePromise = new Promise<string>((res, rej) => {
      codeResolve = res;
      codeReject = rej;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (code && state === expectedState) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(SUCCESS_HTML);
        settled = true;
        codeResolve!(code);
        // Delay shutdown to ensure response is sent
        setTimeout(() => shutdown(), 500);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(ERROR_HTML);
      }
    });

    const shutdown = (): void => {
      try { server.close(); } catch { /* ignore */ }
      if (!settled) {
        settled = true;
        codeReject!(new Error('OAuth server shut down before receiving authorization code'));
      }
    };

    const timer = setTimeout(() => {
      shutdown();
    }, TIMEOUT_MS);

    server.on('error', (err) => {
      clearTimeout(timer);
      rejectStart(err);
    });

    // Listen on random port on loopback
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        clearTimeout(timer);
        rejectStart(new Error('Failed to get server address'));
        return;
      }
      resolveStart({
        port: addr.port,
        codePromise,
        shutdown: () => {
          clearTimeout(timer);
          shutdown();
        },
      });
    });
  });
}
