import { Platform, requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import * as http from 'http';
import * as https from 'https';
import * as tls from 'tls';
import type { CalendarSource } from '../models/types';

export type GoogleProxyMode = 'none' | 'system' | 'custom';

export interface GoogleProxySettings {
  mode: GoogleProxyMode;
  host?: string;
  port?: number;
}

export interface GoogleProxyRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
  contentType?: string;
  throw?: boolean;
  timeout?: number;
}

export type GoogleRequestUrlParam = RequestUrlParam & {
  timeout?: number;
};

export interface GoogleProxyDescriptor {
  active: boolean;
  mode: GoogleProxyMode;
  endpoint?: string;
}

export class GoogleProxyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleProxyConfigurationError';
  }
}

export function getGoogleProxySettings(google?: CalendarSource['google']): GoogleProxySettings {
  const mode = google?.proxyMode ?? inferLegacyProxyMode(google);

  if (mode === 'custom') {
    return {
      mode,
      host: google?.proxyHost?.trim(),
      port: google?.proxyPort,
    };
  }

  return { mode };
}

export function normalizeGoogleProxySettings(settings: GoogleProxySettings): GoogleProxySettings {
  if (settings.mode !== 'custom') {
    return { mode: settings.mode };
  }

  const host = settings.host?.trim();
  if (!host) {
    throw new GoogleProxyConfigurationError('请填写 Google 代理主机地址。');
  }

  if (!settings.port || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
    throw new GoogleProxyConfigurationError('Google 代理端口必须是 1 到 65535 之间的整数。');
  }

  return {
    mode: 'custom',
    host,
    port: settings.port,
  };
}

export function describeGoogleProxy(settings: GoogleProxySettings): GoogleProxyDescriptor {
  const normalized = normalizeGoogleProxySettings(settings);
  if (normalized.mode === 'custom') {
    return {
      active: true,
      mode: 'custom',
      endpoint: `${normalized.host}:${normalized.port}`,
    };
  }

  return {
    active: normalized.mode !== 'none',
    mode: normalized.mode,
  };
}

export async function requestGoogleUrl(
  input: GoogleProxyRequestInput,
  proxySettings: GoogleProxySettings = { mode: 'system' },
): Promise<RequestUrlResponse> {
  const normalized = normalizeGoogleProxySettings(proxySettings);
  assertSupportedGoogleTargetUrl(input.url);

  if (normalized.mode === 'custom') {
    if (!Platform.isDesktopApp) {
      throw new GoogleProxyConfigurationError('自定义 Google 代理仅支持 Obsidian 桌面端。');
    }
    return requestViaHttpConnectProxy(input, normalized.host!, normalized.port!);
  }

  if (normalized.mode === 'none' && Platform.isDesktopApp) {
    return requestDirect(input);
  }

  return requestUrl(toRequestUrlParam(input));
}

export function toRequestUrlParam(input: GoogleProxyRequestInput): GoogleRequestUrlParam {
  return {
    url: input.url,
    method: input.method,
    headers: input.headers,
    body: input.body,
    contentType: input.contentType,
    throw: input.throw,
    timeout: input.timeout,
  };
}

function inferLegacyProxyMode(google?: CalendarSource['google']): GoogleProxyMode {
  if (google?.proxyUrl?.trim()) {
    return 'custom';
  }
  return 'system';
}

async function requestDirect(input: GoogleProxyRequestInput): Promise<RequestUrlResponse> {
  const targetUrl = new URL(input.url);
  const body = normalizeBody(input.body);

  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port ? Number(targetUrl.port) : 443,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: input.method ?? 'GET',
      headers: buildHeaders(input, body),
      timeout: input.timeout,
    }, response => collectNodeResponse(response, resolve, reject));

    request.on('timeout', () => request.destroy(new Error('Google request timed out.')));
    request.on('error', reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function requestViaHttpConnectProxy(
  input: GoogleProxyRequestInput,
  proxyHost: string,
  proxyPort: number,
): Promise<RequestUrlResponse> {
  const targetUrl = new URL(input.url);
  const body = normalizeBody(input.body);

  return new Promise((resolve, reject) => {
    const connectRequest = http.request({
      host: proxyHost,
      port: proxyPort,
      method: 'CONNECT',
      path: `${targetUrl.hostname}:443`,
      timeout: input.timeout,
    });

    connectRequest.on('connect', (connectResponse, socket) => {
      if (connectResponse.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Google proxy CONNECT failed with status ${connectResponse.statusCode ?? 'unknown'}.`));
        return;
      }

      const tlsSocket = tls.connect({
        socket,
        servername: targetUrl.hostname,
      });

      const request = https.request({
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port ? Number(targetUrl.port) : 443,
        createConnection: () => tlsSocket,
        servername: targetUrl.hostname,
        host: targetUrl.hostname,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: input.method ?? 'GET',
        headers: buildHeaders(input, body),
        timeout: input.timeout,
      }, response => collectNodeResponse(response, resolve, reject));

      request.on('timeout', () => request.destroy(new Error('Google request timed out.')));
      request.on('error', reject);
      tlsSocket.on('error', reject);
      if (body) {
        request.write(body);
      }
      request.end();
    });

    connectRequest.on('timeout', () => connectRequest.destroy(new Error('Google proxy CONNECT timed out.')));
    connectRequest.on('error', reject);
    connectRequest.end();
  });
}

function buildHeaders(input: GoogleProxyRequestInput, body?: Buffer): Record<string, string | number> {
  const headers: Record<string, string | number> = { ...(input.headers ?? {}) };
  if (input.contentType && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = input.contentType;
  }
  if (body && !hasHeader(headers, 'content-length')) {
    headers['Content-Length'] = body.byteLength;
  }
  return headers;
}

function hasHeader(headers: Record<string, string | number>, name: string): boolean {
  const lowerName = name.toLowerCase();
  return Object.keys(headers).some(header => header.toLowerCase() === lowerName);
}

function normalizeBody(body?: string | ArrayBuffer): Buffer | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }
  return Buffer.from(body);
}

function collectNodeResponse(
  response: http.IncomingMessage,
  resolve: (response: RequestUrlResponse) => void,
  reject: (error: unknown) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('error', reject);
  response.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const text = buffer.toString('utf8');
    const headers = Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value ?? '']),
    );

    resolve({
      status: response.statusCode ?? 0,
      headers,
      arrayBuffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      text,
      json: parseJson(text),
    } as RequestUrlResponse);
  });
}

function parseJson(text: string): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function assertSupportedGoogleTargetUrl(targetUrl: string): void {
  let parsedTargetUrl: URL;

  try {
    parsedTargetUrl = new URL(targetUrl);
  } catch {
    throw new GoogleProxyConfigurationError('Google request target URL must be valid.');
  }

  if (parsedTargetUrl.protocol !== 'https:') {
    throw new GoogleProxyConfigurationError('Google request target URL must use https.');
  }
}
