import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';
import { GoogleAuthHelper } from '../../src/sync/GoogleAuthHelper';

vi.mock('obsidian');

describe('GoogleAuthHelper', () => {
  let helper: GoogleAuthHelper;

  beforeEach(() => {
    helper = new GoogleAuthHelper();
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue({ json: {}, text: '', status: 200 });
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
      // base64url: only alphanumeric, -, _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('exchangeCode', () => {
    it('sends POST with grant_type=authorization_code and returns tokens', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce({
        json: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
        text: '',
        status: 200,
      });

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
      vi.mocked(requestUrl).mockResolvedValueOnce({
        json: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
        text: '',
        status: 200,
      });

      await helper.exchangeCode('code', 'cid', 'cs', 'http://localhost', 'my-verifier');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { body: string };
      expect(call.body).toContain('code_verifier=my-verifier');
    });
  });

  describe('refreshAccessToken', () => {
    it('sends POST with grant_type=refresh_token and returns new token without refreshToken', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce({
        json: { access_token: 'refreshed-token', expires_in: 3600 },
        text: '',
        status: 200,
      });

      const result = await helper.refreshAccessToken('rt', 'cid', 'cs');

      expect(result.accessToken).toBe('refreshed-token');
      expect(result.tokenExpiry).toBeGreaterThan(Date.now());
      // Should NOT have refreshToken property
      expect(result).not.toHaveProperty('refreshToken');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { body: string };
      expect(call.body).toContain('grant_type=refresh_token');
    });

    it('throws error with "重新授权" when response status >= 400', async () => {
      vi.mocked(requestUrl).mockRejectedValueOnce({ status: 401 });

      await expect(
        helper.refreshAccessToken('bad-rt', 'cid', 'cs'),
      ).rejects.toThrow(/重新授权/);
    });
  });

  describe('ensureValidToken', () => {
    it('returns existing token if tokenExpiry is more than 5 minutes in the future', async () => {
      const google = {
        clientId: 'cid',
        clientSecret: 'cs',
        accessToken: 'valid-token',
        refreshToken: 'rt',
        tokenExpiry: Date.now() + 10 * 60 * 1000, // 10 min from now
      };

      const token = await helper.ensureValidToken(google);
      expect(token).toBe('valid-token');
      expect(vi.mocked(requestUrl)).not.toHaveBeenCalled();
    });

    it('calls refresh if token expires within 5 minutes', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce({
        json: { access_token: 'new-token', expires_in: 3600 },
        text: '',
        status: 200,
      });

      const google = {
        clientId: 'cid',
        clientSecret: 'cs',
        accessToken: 'old-token',
        refreshToken: 'rt',
        tokenExpiry: Date.now() + 2 * 60 * 1000, // 2 min from now (within buffer)
      };

      const token = await helper.ensureValidToken(google);
      expect(token).toBe('new-token');
      expect(google.accessToken).toBe('new-token');
      expect(google.tokenExpiry).toBeGreaterThan(Date.now());
    });
  });
});
