import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { GoogleAuthHelper, GoogleTokenError } from '../../src/sync/GoogleAuthHelper';

vi.mock('obsidian');

function makeResponse(json: unknown, status = 200, text = ''): RequestUrlResponse {
  return {
    json,
    text,
    status,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
  } as RequestUrlResponse;
}

function makeRejectedRequestError(value: unknown): unknown {
  return value;
}

describe('GoogleAuthHelper', () => {
  let helper: GoogleAuthHelper;

  beforeEach(() => {
    helper = new GoogleAuthHelper({ retryDelayMs: 0 });
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue(makeResponse({}, 200));
  });

  describe('buildAuthUrl', () => {
    it('returns URL with all required OAuth2 params', async () => {
      const result = await helper.buildAuthUrl(
        'test-client-id',
        'http://localhost:8080/callback',
        'test-verifier-long-enough-string-1234567890ab',
        'test-state',
      );

      const url = new URL(result.url);
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8080/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toContain('calendar.readonly');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('state')).toBe('test-state');
    });

    it('generates a code_verifier of 43+ characters', () => {
      const verifier = helper.generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('exchangeCode', () => {
    it('sends POST with grant_type=authorization_code and returns tokens', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }, 200));

      const result = await helper.exchangeCode(
        'auth-code',
        'client-id',
        'client-secret',
        'http://localhost:8080/callback',
        'code-verifier',
      );

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.tokenExpiry).toBeGreaterThan(Date.now());

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string; body: string; method: string };
      expect(call.url).toBe('https://oauth2.googleapis.com/token');
      expect(call.method).toBe('POST');
      expect(call.body).toContain('grant_type=authorization_code');
    });

    it('includes code_verifier in the request body', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }, 200));

      await helper.exchangeCode('code', 'cid', 'cs', 'http://localhost', 'my-verifier');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { body: string };
      expect(call.body).toContain('code_verifier=my-verifier');
    });
  });

  describe('refreshAccessToken', () => {
    it('sends POST with grant_type=refresh_token and returns new token without refreshToken', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ access_token: 'refreshed-token', expires_in: 3600 }, 200));

      const result = await helper.refreshAccessToken('rt', 'cid', 'cs');

      expect(result.accessToken).toBe('refreshed-token');
      expect(result.tokenExpiry).toBeGreaterThan(Date.now());
      expect(result).not.toHaveProperty('refreshToken');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { body: string };
      expect(call.body).toContain('grant_type=refresh_token');
    });

    it('retries once for retryable network failures', async () => {
      vi.mocked(requestUrl)
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValueOnce(makeResponse({ access_token: 'retry-token', expires_in: 3600 }, 200));

      const result = await helper.refreshAccessToken('rt', 'cid', 'cs');

      expect(result.accessToken).toBe('retry-token');
      expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
    });

    it('throws invalid_grant as reauth-required token error', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400));

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'invalid_grant',
        userMessage: 'Google 刷新令牌已失效或被撤销，请重新授权。',
      });
      expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(1);
    });

    it('parses nested OAuth error objects returned with status 400', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          error: {
            error: 'invalid_grant',
            message: 'Token has been expired or revoked',
          },
        }, 400));

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'invalid_grant',
        apiError: 'invalid_grant',
        apiErrorDescription: 'Token has been expired or revoked',
      });
    });

    it('parses token errors from response text when json payload is empty', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(
        makeResponse({}, 400, '{"error":"invalid_grant","error_description":"Token has been expired or revoked"}'),
      );

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'invalid_grant',
        apiError: 'invalid_grant',
        apiErrorDescription: 'Token has been expired or revoked',
      });
    });

    it('preserves sanitized response text for unknown 400 diagnostics', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({}, 400, '<html><body>bad request from upstream proxy</body></html>'));

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'unknown',
        status: 400,
        apiErrorDescription: '<html><body>bad request from upstream proxy</body></html>',
      });
    });

    it('preserves thrown error shape when requestUrl rejects with a non-standard 400 object', async () => {
      vi.mocked(requestUrl).mockRejectedValue({
        name: 'RequestUrlError',
        message: 'Bad Request',
        status: 400,
        code: 'ERR_BAD_REQUEST',
      });

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'unknown',
        status: 400,
        userMessage: 'Google 令牌刷新失败，请稍后重试；若持续失败再重新授权。',
      });
    });

    it('maps thrown refresh 400 without body to invalid_grant-style reauth guidance', async () => {
      vi.mocked(requestUrl).mockRejectedValue(makeRejectedRequestError({
        name: 'Error',
        message: 'Request failed, status 400',
        status: 400,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'www-authenticate': 'Bearer realm="https://accounts.google.com/"',
        },
      }));

      await expect(helper.refreshAccessToken('bad-rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'invalid_grant',
        status: 400,
        apiError: 'invalid_grant',
        userMessage: 'Google 刷新令牌已失效或被撤销，请重新授权。',
      });
    });

    it('throws network token error when requestUrl rejects without API payload', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('socket hang up'));

      await expect(helper.refreshAccessToken('rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'network',
        userMessage: '访问 Google 令牌接口失败，请检查网络或 VPN 连接后重试。',
      });
      expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
    });

    it('throws invalid_client with configuration guidance', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ error: 'invalid_client', error_description: 'Unauthorized' }, 401));

      await expect(helper.refreshAccessToken('rt', 'cid', 'cs')).rejects.toMatchObject({
        name: 'GoogleTokenError',
        kind: 'invalid_client',
        userMessage: 'Google OAuth 客户端配置无效，请检查 Client ID 和 Client Secret。',
      });
      expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureValidToken', () => {
    it('returns existing token if tokenExpiry is more than 5 minutes in the future', async () => {
      const google = {
        clientId: 'cid',
        clientSecret: 'cs',
        accessToken: 'valid-token',
        refreshToken: 'rt',
        tokenExpiry: Date.now() + 10 * 60 * 1000,
      };

      const token = await helper.ensureValidToken(google);
      expect(token).toBe('valid-token');
      expect(vi.mocked(requestUrl)).not.toHaveBeenCalled();
    });

    it('calls refresh if token expires within 5 minutes', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ access_token: 'new-token', expires_in: 3600 }, 200));

      const google = {
        clientId: 'cid',
        clientSecret: 'cs',
        accessToken: 'old-token',
        refreshToken: 'rt',
        tokenExpiry: Date.now() + 2 * 60 * 1000,
      };

      const token = await helper.ensureValidToken(google);
      expect(token).toBe('new-token');
      expect(google.accessToken).toBe('new-token');
      expect(google.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('propagates structured token errors for caller diagnostics', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ error: 'invalid_grant', error_description: 'Token revoked' }, 400));

      const google = {
        clientId: 'cid',
        clientSecret: 'cs',
        refreshToken: 'rt',
      };

      await expect(helper.ensureValidToken(google)).rejects.toBeInstanceOf(GoogleTokenError);
    });
  });
});
