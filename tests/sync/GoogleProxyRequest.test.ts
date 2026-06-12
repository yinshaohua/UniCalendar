import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarSource } from '../../src/models/types';
import {
  GoogleProxyConfigurationError,
  describeGoogleProxy,
  getGoogleProxySettings,
  normalizeGoogleProxySettings,
  requestGoogleUrl,
  toRequestUrlParam,
} from '../../src/sync/GoogleProxyRequest';

describe('normalizeGoogleProxySettings', () => {
  it('keeps none mode without custom proxy fields', () => {
    expect(normalizeGoogleProxySettings({ mode: 'none', host: '127.0.0.1', port: 7890 })).toEqual({ mode: 'none' });
  });

  it('keeps system mode without custom proxy fields', () => {
    expect(normalizeGoogleProxySettings({ mode: 'system', host: '127.0.0.1', port: 7890 })).toEqual({ mode: 'system' });
  });

  it('trims custom proxy host and preserves port', () => {
    expect(normalizeGoogleProxySettings({ mode: 'custom', host: ' 127.0.0.1 ', port: 7890 })).toEqual({
      mode: 'custom',
      host: '127.0.0.1',
      port: 7890,
    });
  });

  it('rejects custom proxy without host', () => {
    expect(() => normalizeGoogleProxySettings({ mode: 'custom', host: ' ', port: 7890 })).toThrow(
      GoogleProxyConfigurationError,
    );
  });

  it('rejects invalid custom proxy ports', () => {
    expect(() => normalizeGoogleProxySettings({ mode: 'custom', host: '127.0.0.1', port: 0 })).toThrow(
      GoogleProxyConfigurationError,
    );
    expect(() => normalizeGoogleProxySettings({ mode: 'custom', host: '127.0.0.1', port: 65536 })).toThrow(
      GoogleProxyConfigurationError,
    );
    expect(() => normalizeGoogleProxySettings({ mode: 'custom', host: '127.0.0.1', port: 7890.5 })).toThrow(
      GoogleProxyConfigurationError,
    );
  });
});

describe('getGoogleProxySettings', () => {
  it('defaults legacy Google sources to system proxy mode', () => {
    expect(getGoogleProxySettings({ clientId: 'cid', clientSecret: 'cs' })).toEqual({ mode: 'system' });
  });

  it('reads saved custom host and port settings', () => {
    const google: NonNullable<CalendarSource['google']> = {
      clientId: 'cid',
      clientSecret: 'cs',
      proxyMode: 'custom',
      proxyHost: '127.0.0.1',
      proxyPort: 7890,
    };

    expect(getGoogleProxySettings(google)).toEqual({ mode: 'custom', host: '127.0.0.1', port: 7890 });
  });

  it('treats legacy forwarding proxy URL as custom mode for migration visibility', () => {
    expect(getGoogleProxySettings({ clientId: 'cid', clientSecret: 'cs', proxyUrl: 'https://proxy.example.com/google' })).toEqual({
      mode: 'custom',
      host: undefined,
      port: undefined,
    });
  });
});

describe('describeGoogleProxy', () => {
  it('reports none mode as inactive', () => {
    expect(describeGoogleProxy({ mode: 'none' })).toEqual({ active: false, mode: 'none' });
  });

  it('reports system mode as active without endpoint', () => {
    expect(describeGoogleProxy({ mode: 'system' })).toEqual({ active: true, mode: 'system' });
  });

  it('reports custom mode with host and port endpoint', () => {
    expect(describeGoogleProxy({ mode: 'custom', host: '127.0.0.1', port: 7890 })).toEqual({
      active: true,
      mode: 'custom',
      endpoint: '127.0.0.1:7890',
    });
  });
});

describe('toRequestUrlParam', () => {
  it('preserves Obsidian request options', () => {
    expect(toRequestUrlParam({
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: 'body',
      contentType: 'application/json',
      throw: false,
      timeout: 15000,
    })).toEqual({
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: 'body',
      contentType: 'application/json',
      throw: false,
      timeout: 15000,
    });
  });
});

describe('requestGoogleUrl', () => {
  it('passes full target origin options through the custom CONNECT tunnel', async () => {
    const http = await import('http');
    const https = await import('https');
    const tls = await import('tls');
    const socket = new EventEmitter() as EventEmitter & { destroy: ReturnType<typeof vi.fn> };
    const tlsSocket = new EventEmitter();
    socket.destroy = vi.fn();

    vi.spyOn(tls, 'connect').mockReturnValue(tlsSocket as ReturnType<typeof tls.connect>);

    vi.spyOn(http, 'request').mockImplementation((options: unknown) => {
      expect(options).toMatchObject({
        host: '127.0.0.1',
        port: 7897,
        method: 'CONNECT',
        path: 'oauth2.googleapis.com:443',
      });

      const connectRequest = new EventEmitter() as EventEmitter & { end: () => void };
      connectRequest.end = () => connectRequest.emit('connect', { statusCode: 200 }, socket);
      return connectRequest as ReturnType<typeof http.request>;
    });

    vi.spyOn(https, 'request').mockImplementation(((options: unknown, callback?: (response: import('http').IncomingMessage) => void) => {
      expect(options).toMatchObject({
        protocol: 'https:',
        hostname: 'oauth2.googleapis.com',
        port: 443,
        servername: 'oauth2.googleapis.com',
        host: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
      });
      expect((options as { createConnection: () => unknown }).createConnection()).toBe(tlsSocket);

      const response = new EventEmitter() as import('http').IncomingMessage;
      response.headers = { 'content-type': 'application/json' };
      response.statusCode = 400;
      queueMicrotask(() => {
        callback?.(response);
        response.emit('data', Buffer.from('{"error":"invalid_request"}'));
        response.emit('end');
      });

      const request = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      request.write = vi.fn();
      request.end = vi.fn();
      request.destroy = vi.fn();
      return request as unknown as ReturnType<typeof https.request>;
    }) as typeof https.request);

    await expect(requestGoogleUrl({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token',
      timeout: 15000,
    }, { mode: 'custom', host: '127.0.0.1', port: 7897 })).resolves.toMatchObject({
      status: 400,
      json: { error: 'invalid_request' },
    });
  });
});
