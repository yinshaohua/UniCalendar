import { requestUrl } from 'obsidian';
import { CalendarSource, formatGoogleTokenFingerprint } from '../models/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
const TOKEN_RETRY_DELAY_MS = 1200;

export interface GoogleAuthHelperOptions {
  retryDelayMs?: number;
}

type GoogleTokenErrorKind =
  | 'network'
  | 'invalid_grant'
  | 'invalid_client'
  | 'temporarily_unavailable'
  | 'rate_limited'
  | 'server'
  | 'unexpected_response'
  | 'unknown';

interface GoogleTokenErrorOptions {
  operation: 'exchange' | 'refresh';
  kind: GoogleTokenErrorKind;
  userMessage: string;
  logMessage: string;
  status?: number;
  apiError?: string;
  apiErrorDescription?: string;
  cause?: unknown;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenDiagnosticPayload {
  responseText?: string;
  responseContentType?: string;
  thrownSummary?: string;
  headerSummary?: string;
}

export class GoogleTokenError extends Error {
  readonly operation: 'exchange' | 'refresh';
  readonly kind: GoogleTokenErrorKind;
  readonly userMessage: string;
  readonly logMessage: string;
  readonly status?: number;
  readonly apiError?: string;
  readonly apiErrorDescription?: string;
  readonly cause?: unknown;

  constructor(options: GoogleTokenErrorOptions) {
    super(options.userMessage);
    this.name = 'GoogleTokenError';
    this.operation = options.operation;
    this.kind = options.kind;
    this.userMessage = options.userMessage;
    this.logMessage = options.logMessage;
    this.status = options.status;
    this.apiError = options.apiError;
    this.apiErrorDescription = options.apiErrorDescription;
    this.cause = options.cause;
  }

  isRetryable(): boolean {
    return this.kind === 'network'
      || this.kind === 'temporarily_unavailable'
      || this.kind === 'rate_limited'
      || this.kind === 'server';
  }

  toLogObject(): Record<string, unknown> {
    return {
      operation: this.operation,
      kind: this.kind,
      status: this.status,
      apiError: this.apiError,
      apiErrorDescription: this.apiErrorDescription,
      userMessage: this.userMessage,
      logMessage: this.logMessage,
      retryable: this.isRetryable(),
      cause: this.cause,
    };
  }
}

export class GoogleAuthHelper {
  private readonly retryDelayMs: number;

  constructor(options: GoogleAuthHelperOptions = {}) {
    this.retryDelayMs = options.retryDelayMs ?? TOKEN_RETRY_DELAY_MS;
  }

  generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]!);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async buildAuthUrl(
    clientId: string,
    redirectUri: string,
    codeVerifier: string,
    state: string,
  ): Promise<{ url: string; codeVerifier: string }> {
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      // Keep prompt=consent so Google reliably issues a refresh token on desktop re-authorization.
      // Removing it may reduce friction, but can also lead to missing refresh tokens and a worse long-term sync experience.
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
    });

    return {
      url: `${AUTH_ENDPOINT}?${params.toString()}`,
      codeVerifier,
    };
  }

  async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<{ accessToken: string; refreshToken: string; tokenExpiry: number }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString();

    const response = await this.performTokenRequest('exchange', body);
    if (!response.access_token || !response.refresh_token || typeof response.expires_in !== 'number') {
      throw this.createUnexpectedResponseError(
        'exchange',
        'Google 授权响应不完整，请重新授权后重试。',
        response,
      );
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiry: Date.now() + response.expires_in * 1000,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; tokenExpiry: number }> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const response = await this.performTokenRequest('refresh', body, { retryOnce: true });
    if (!response.access_token || typeof response.expires_in !== 'number') {
      throw this.createUnexpectedResponseError(
        'refresh',
        'Google 刷新令牌响应不完整，请稍后重试。',
        response,
      );
    }

    return {
      accessToken: response.access_token,
      tokenExpiry: Date.now() + response.expires_in * 1000,
    };
  }

  async ensureValidToken(google: CalendarSource['google']): Promise<string> {
    if (!google) {
      throw new Error('日历源缺少Google配置');
    }
    if (!google.refreshToken) {
      throw new Error('缺少刷新令牌，请重新授权');
    }

    const now = Date.now();
    if (google.accessToken && google.tokenExpiry && (google.tokenExpiry - now) > TOKEN_REFRESH_BUFFER_MS) {
      return google.accessToken;
    }

    google.lastRefreshAttemptAt = now;
    google.lastRefreshTokenFingerprintUsed = formatGoogleTokenFingerprint(google.refreshToken);

    const result = await this.refreshAccessToken(
      google.refreshToken,
      google.clientId,
      google.clientSecret,
    );
    google.accessToken = result.accessToken;
    google.tokenExpiry = result.tokenExpiry;
    return result.accessToken;
  }

  private async performTokenRequest(
    operation: 'exchange' | 'refresh',
    body: string,
    options?: { retryOnce?: boolean },
  ): Promise<GoogleTokenResponse> {
    try {
      return await this.performTokenRequestOnce(operation, body);
    } catch (error) {
      if (options?.retryOnce && error instanceof GoogleTokenError && error.isRetryable()) {
        console.warn('[UniCalendar] Retrying Google token request after retryable failure', error.toLogObject());
        await this.delay(this.retryDelayMs);
        return this.performTokenRequestOnce(operation, body);
      }
      throw error;
    }
  }

  private async performTokenRequestOnce(operation: 'exchange' | 'refresh', body: string): Promise<GoogleTokenResponse> {
    let response;
    try {
      response = await requestUrl({
        url: TOKEN_ENDPOINT,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (cause) {
      throw this.mapThrownTokenError(operation, cause);
    }

    const status = typeof response.status === 'number' ? response.status : undefined;
    const payload = this.extractTokenPayload(response.json, response.text, this.extractHeader(response, 'content-type'));

    if (status !== undefined && status >= 400) {
      throw this.mapApiTokenError(operation, status, payload.response, undefined, payload.diagnostic);
    }

    if (payload.response.error) {
      throw this.mapApiTokenError(operation, status, payload.response, undefined, payload.diagnostic);
    }

    return payload.response;
  }

  private toTokenResponse(value: unknown): GoogleTokenResponse {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as GoogleTokenResponse;
  }

  private extractTokenPayload(
    json: unknown,
    text: string | undefined,
    contentType: string | undefined,
  ): { response: GoogleTokenResponse; diagnostic: GoogleTokenDiagnosticPayload } {
    const parsed = this.normalizeTokenPayload(json);
    if (parsed.error) {
      return {
        response: parsed,
        diagnostic: {
          responseText: this.sanitizeResponseText(text),
          responseContentType: contentType,
        },
      };
    }

    const textResponse = this.parseTokenErrorFromText(text);
    return {
      response: Object.keys(textResponse).length > 0 ? textResponse : parsed,
      diagnostic: {
        responseText: this.sanitizeResponseText(text),
        responseContentType: contentType,
      },
    };
  }

  private normalizeTokenPayload(value: unknown): GoogleTokenResponse {
    const direct = this.toTokenResponse(value);
    if (typeof direct.error === 'string' || direct.access_token || direct.refresh_token || typeof direct.expires_in === 'number') {
      return direct;
    }

    if (value && typeof value === 'object') {
      const nestedError = Reflect.get(value, 'error');
      if (nestedError && typeof nestedError === 'object') {
        const nestedObj = nestedError as Record<string, unknown>;
        const nestedCode = nestedObj.error;
        const nestedDescription = nestedObj.error_description ?? nestedObj.message ?? nestedObj.error_message;
        if (typeof nestedCode === 'string' || typeof nestedDescription === 'string') {
          return {
            error: typeof nestedCode === 'string' ? nestedCode : undefined,
            error_description: typeof nestedDescription === 'string' ? nestedDescription : undefined,
          };
        }
      }
    }

    return direct;
  }

  private parseTokenErrorFromText(text: string | undefined): GoogleTokenResponse {
    if (!text?.trim()) {
      return {};
    }

    try {
      return this.normalizeTokenPayload(JSON.parse(text));
    } catch {
      const invalidGrant = /invalid[_ -]grant/i.test(text);
      const invalidClient = /invalid[_ -]client/i.test(text);
      const temporarilyUnavailable = /temporarily[_ -]unavailable/i.test(text);

      if (invalidGrant) {
        return { error: 'invalid_grant', error_description: text.trim() };
      }
      if (invalidClient) {
        return { error: 'invalid_client', error_description: text.trim() };
      }
      if (temporarilyUnavailable) {
        return { error: 'temporarily_unavailable', error_description: text.trim() };
      }

      return {};
    }
  }

  private sanitizeResponseText(text: string | undefined): string | undefined {
    if (!text?.trim()) {
      return undefined;
    }

    const trimmed = text.trim().replace(/\s+/g, ' ');
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
  }

  private extractHeader(response: unknown, headerName: string): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const headers = Reflect.get(response, 'headers');
    if (!headers || typeof headers !== 'object') {
      return undefined;
    }

    const exact = Reflect.get(headers, headerName);
    if (typeof exact === 'string') {
      return exact;
    }

    const lowerName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      if (key.toLowerCase() === lowerName && typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }

  private mapThrownTokenError(operation: 'exchange' | 'refresh', cause: unknown): GoogleTokenError {
    const status = this.extractStatus(cause);
    const payload = this.extractThrownTokenPayload(cause);
    if (status !== undefined || payload.response.error) {
      return this.mapApiTokenError(operation, status, payload.response, cause, payload.diagnostic);
    }

    const action = operation === 'refresh' ? '刷新访问令牌' : '交换授权码';
    return new GoogleTokenError({
      operation,
      kind: 'network',
      userMessage: '访问 Google 令牌接口失败，请检查网络或 VPN 连接后重试。',
      logMessage: `${action}时无法访问 Google 令牌接口`,
      cause,
    });
  }

  private mapApiTokenError(
    operation: 'exchange' | 'refresh',
    status: number | undefined,
    response: GoogleTokenResponse,
    cause?: unknown,
    diagnostic?: GoogleTokenDiagnosticPayload,
  ): GoogleTokenError {
    const apiError = response.error;
    const apiErrorDescription = response.error_description;
    const action = operation === 'refresh' ? '刷新访问令牌' : '交换授权码';

    if (apiError === 'invalid_grant') {
      return new GoogleTokenError({
        operation,
        kind: 'invalid_grant',
        status,
        apiError,
        apiErrorDescription,
        cause,
        userMessage: operation === 'refresh'
          ? 'Google 刷新令牌已失效或被撤销，请重新授权。'
          : 'Google 授权码已失效，请重新发起授权。',
        logMessage: `${action}失败：Google 返回 invalid_grant`,
      });
    }

    if (apiError === 'invalid_client') {
      return new GoogleTokenError({
        operation,
        kind: 'invalid_client',
        status,
        apiError,
        apiErrorDescription,
        cause,
        userMessage: 'Google OAuth 客户端配置无效，请检查 Client ID 和 Client Secret。',
        logMessage: `${action}失败：Google 返回 invalid_client`,
      });
    }

    if (apiError === 'temporarily_unavailable') {
      return new GoogleTokenError({
        operation,
        kind: 'temporarily_unavailable',
        status,
        apiError,
        apiErrorDescription,
        cause,
        userMessage: 'Google 令牌服务暂时不可用，请稍后重试。',
        logMessage: `${action}失败：Google 令牌服务暂时不可用`,
      });
    }

    if (status === 429) {
      return new GoogleTokenError({
        operation,
        kind: 'rate_limited',
        status,
        apiError,
        apiErrorDescription,
        cause,
        userMessage: 'Google 令牌接口请求过于频繁，请稍后重试。',
        logMessage: `${action}失败：Google 令牌接口触发限流`,
      });
    }

    if (status !== undefined && status >= 500) {
      return new GoogleTokenError({
        operation,
        kind: 'server',
        status,
        apiError,
        apiErrorDescription,
        cause,
        userMessage: 'Google 服务暂时异常，请稍后重试。',
        logMessage: `${action}失败：Google 服务器返回 ${status}`,
      });
    }

    if (
      operation === 'refresh'
      && status === 400
      && !apiError
      && !apiErrorDescription
      && diagnostic?.thrownSummary?.includes('message=Request failed, status 400')
    ) {
      return new GoogleTokenError({
        operation,
        kind: 'invalid_grant',
        status,
        apiError: apiError ?? 'invalid_grant',
        apiErrorDescription: diagnostic?.headerSummary ?? diagnostic?.thrownSummary,
        cause,
        userMessage: 'Google 刷新令牌已失效或被撤销，请重新授权。',
        logMessage: `${action}失败：HTTP 400 且未返回可解析错误体，按 invalid_grant 处理`,
      });
    }

    return new GoogleTokenError({
      operation,
      kind: 'unknown',
      status,
      apiError,
      apiErrorDescription: apiErrorDescription ?? diagnostic?.responseText ?? diagnostic?.headerSummary ?? diagnostic?.thrownSummary,
      cause,
      userMessage: operation === 'refresh'
        ? 'Google 令牌刷新失败，请稍后重试；若持续失败再重新授权。'
        : 'Google 授权失败，请稍后重试。',
      logMessage: `${action}失败：Google 返回未知错误${diagnostic?.responseContentType ? `（content-type: ${diagnostic.responseContentType}）` : ''}`,
    });
  }

  private createUnexpectedResponseError(
    operation: 'exchange' | 'refresh',
    userMessage: string,
    response: GoogleTokenResponse,
  ): GoogleTokenError {
    return new GoogleTokenError({
      operation,
      kind: 'unexpected_response',
      apiError: response.error,
      apiErrorDescription: response.error_description,
      userMessage,
      logMessage: operation === 'refresh'
        ? 'Google 刷新令牌响应缺少必要字段'
        : 'Google 授权响应缺少必要字段',
    });
  }

  private extractThrownTokenPayload(cause: unknown): { response: GoogleTokenResponse; diagnostic: GoogleTokenDiagnosticPayload } {
    if (!cause || typeof cause !== 'object') {
      return {
        response: {},
        diagnostic: {
          thrownSummary: this.summarizeThrownCause(cause),
        },
      };
    }
    const json = Reflect.get(cause, 'json');
    const text = Reflect.get(cause, 'text');
    const headers = Reflect.get(cause, 'headers');
    const payload = this.extractTokenPayload(
      json,
      typeof text === 'string' ? text : undefined,
      this.extractHeader({ headers }, 'content-type'),
    );
    return {
      response: payload.response,
      diagnostic: {
        ...payload.diagnostic,
        thrownSummary: this.summarizeThrownCause(cause),
        headerSummary: this.summarizeHeaders(headers),
      },
    };
  }

  private summarizeHeaders(headers: unknown): string | undefined {
    if (!headers || typeof headers !== 'object') {
      return undefined;
    }

    const allowList = [
      'content-type',
      'www-authenticate',
      'server',
      'via',
      'x-guploader-uploadid',
      'x-frame-options',
      'x-content-type-options',
      'alt-svc',
      'date',
    ];

    const entries: string[] = [];
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (!allowList.includes(lowerKey)) {
        continue;
      }
      if (typeof value === 'string' && value.trim()) {
        entries.push(`${lowerKey}=${this.truncateForDiagnostic(value)}`);
      }
    }

    if (entries.length === 0) {
      const keys = Object.keys(headers as Record<string, unknown>).sort().slice(0, 12);
      return keys.length > 0 ? `keys=${keys.join(',')}` : undefined;
    }

    return entries.join('; ');
  }

  private summarizeThrownCause(cause: unknown): string | undefined {
    if (!cause || typeof cause !== 'object') {
      return typeof cause === 'string' ? cause : undefined;
    }

    const obj = cause as Record<string, unknown>;
    const keys = Object.keys(obj).sort().slice(0, 12);
    const parts: string[] = [];

    if (typeof obj.name === 'string') {
      parts.push(`name=${obj.name}`);
    }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      parts.push(`message=${this.truncateForDiagnostic(obj.message)}`);
    }
    if (typeof obj.status === 'number') {
      parts.push(`status=${obj.status}`);
    }
    if (typeof obj.code === 'string' || typeof obj.code === 'number') {
      parts.push(`code=${String(obj.code)}`);
    }
    if (typeof obj.type === 'string') {
      parts.push(`type=${obj.type}`);
    }
    if (typeof obj.text === 'string' && obj.text.trim()) {
      parts.push(`text=${this.truncateForDiagnostic(obj.text)}`);
    }

    const jsonSummary = this.summarizeJsonValue(Reflect.get(obj, 'json'));
    if (jsonSummary) {
      parts.push(`json=${jsonSummary}`);
    }

    if (keys.length > 0) {
      parts.push(`keys=${keys.join(',')}`);
    }

    const summary = parts.join('; ');
    return summary || undefined;
  }

  private summarizeJsonValue(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    try {
      const serialized = JSON.stringify(value);
      if (!serialized) {
        return undefined;
      }
      return this.truncateForDiagnostic(serialized);
    } catch {
      return '[unserializable-json]';
    }
  }

  private truncateForDiagnostic(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length > 200 ? `${normalized.slice(0, 200)}…` : normalized;
  }

  private extractStatus(cause: unknown): number | undefined {
    if (!cause || typeof cause !== 'object') {
      return undefined;
    }
    const value = Reflect.get(cause, 'status');
    return typeof value === 'number' ? value : undefined;
  }

  private extractJson(cause: unknown): GoogleTokenResponse {
    if (!cause || typeof cause !== 'object') {
      return {};
    }
    const value = Reflect.get(cause, 'json');
    return this.toTokenResponse(value);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => globalThis.setTimeout(resolve, ms));
  }
}
