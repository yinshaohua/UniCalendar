import { requestUrl } from 'obsidian';
import { CalendarSource } from '../models/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export class GoogleAuthHelper {

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

    const response = await requestUrl({
      url: TOKEN_ENDPOINT,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = response.json;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenExpiry: Date.now() + json.expires_in * 1000,
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

    let response;
    try {
      response = await requestUrl({
        url: TOKEN_ENDPOINT,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new Error('令牌刷新失败，请重新授权');
    }

    const json = response.json;
    return {
      accessToken: json.access_token,
      tokenExpiry: Date.now() + json.expires_in * 1000,
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

    const result = await this.refreshAccessToken(
      google.refreshToken,
      google.clientId,
      google.clientSecret,
    );
    google.accessToken = result.accessToken;
    google.tokenExpiry = result.tokenExpiry;
    return result.accessToken;
  }
}
