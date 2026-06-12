import { describe, it, expect } from 'vitest';
import {
  SOURCE_COLORS,
  getNextColor,
  DEFAULT_SETTINGS,
  DEFAULT_CACHE,
  DEFAULT_CALDAV_CACHE,
  CalendarSource,
  GoogleSyncDiagnostic,
  FeishuSyncDiagnostic,
  formatFeishuTokenFingerprint,
} from '../../src/models/types';

function makeSource(color: string): CalendarSource {
  return {
    id: 'test',
    name: 'Test',
    type: 'ics',
    color,
    enabled: true,
  };
}

describe('SOURCE_COLORS', () => {
  it('has exactly 10 entries', () => {
    expect(SOURCE_COLORS).toHaveLength(10);
  });
});

describe('getNextColor', () => {
  it('returns first unused color', () => {
    expect(getNextColor([])).toBe(SOURCE_COLORS[0]);

    const sourcesUsing2 = [
      makeSource(SOURCE_COLORS[0]!),
      makeSource(SOURCE_COLORS[1]!),
    ];
    expect(getNextColor(sourcesUsing2)).toBe(SOURCE_COLORS[2]);
  });

  it('wraps to first color when all 10 are used', () => {
    const allUsed = SOURCE_COLORS.map(c => makeSource(c));
    expect(getNextColor(allUsed)).toBe(SOURCE_COLORS[0]);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_SETTINGS.sources).toEqual([]);
    expect(DEFAULT_SETTINGS.syncInterval).toBe(15);
    expect(DEFAULT_SETTINGS.syncWindowPastMonths).toBe(1);
    expect(DEFAULT_SETTINGS.syncWindowFutureMonths).toBe(3);
    expect(DEFAULT_SETTINGS.defaultView).toBe('month');
  });

  it('has showLunarCalendar defaulting to true', () => {
    expect(DEFAULT_SETTINGS.showLunarCalendar).toBe(true);
  });

  it('has showHolidays defaulting to true', () => {
    expect(DEFAULT_SETTINGS.showHolidays).toBe(true);
  });

  it('has eventTitleFilters defaulting to empty array', () => {
    expect(DEFAULT_SETTINGS.eventTitleFilters).toEqual([]);
  });
});

describe('DEFAULT_CACHE', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_CACHE.events).toEqual([]);
    expect(DEFAULT_CACHE.lastSyncTime).toBeNull();
    expect(DEFAULT_CACHE.cacheWindowStart).toBe('');
    expect(DEFAULT_CACHE.cacheWindowEnd).toBe('');
  });
});

describe('DEFAULT_CALDAV_CACHE', () => {
  it('starts empty', () => {
    expect(DEFAULT_CALDAV_CACHE.bySource).toEqual({});
  });
});

describe('GoogleSyncDiagnostic shape', () => {
  it('supports persisted Google error diagnostics on a source', () => {
    const diagnostic: GoogleSyncDiagnostic = {
      message: 'Google 服务暂时异常，请稍后重试。',
      kind: 'server',
      operation: 'refresh',
      timestamp: 1234567890,
      status: 503,
      apiError: 'backendError',
      apiErrorDescription: 'temporary outage',
    };

    const source: CalendarSource = {
      id: 'google-1',
      name: 'Google',
      type: 'google',
      color: '#74C0FC',
      enabled: true,
      google: {
        clientId: 'cid',
        clientSecret: 'secret',
        lastSyncError: diagnostic,
      },
    };

    expect(source.google?.lastSyncError?.operation).toBe('refresh');
    expect(source.google?.lastSyncError?.status).toBe(503);
  });
});

describe('Google source shape', () => {
  it('keeps proxy configuration optional for legacy saved sources', () => {
    const source: CalendarSource = {
      id: 'google-legacy',
      name: 'Google',
      type: 'google',
      color: '#74C0FC',
      enabled: true,
      google: {
        clientId: 'cid',
        clientSecret: 'secret',
      },
    };

    expect(source.google?.proxyUrl).toBeUndefined();
  });

  it('supports a persisted Google proxy address', () => {
    const source: CalendarSource = {
      id: 'google-proxy',
      name: 'Google via proxy',
      type: 'google',
      color: '#74C0FC',
      enabled: true,
      google: {
        clientId: 'cid',
        clientSecret: 'secret',
        proxyUrl: 'https://proxy.example.com/google',
      },
    };

    expect(source.google?.proxyUrl).toBe('https://proxy.example.com/google');
  });
});

describe('Feishu source shape', () => {
  it('supports persisted Feishu auth and calendar selection fields on a source', () => {
    const source: CalendarSource = {
      id: 'feishu-1',
      name: 'Feishu',
      type: 'feishu',
      color: '#74C0FC',
      enabled: true,
      feishu: {
        appId: 'cli_xxx',
        appSecret: 'secret',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiry: 1234567890,
        refreshTokenExpiry: 1234569999,
        refreshTokenFingerprint: 'eyJhbG…1234',
        refreshTokenSavedAt: 1234500000,
        lastRefreshAttemptAt: 1234550000,
        lastRefreshTokenFingerprintUsed: 'eyJhbG…1234',
        firstAuthorizedAt: 1234000000,
        selectedCalendars: [
          { id: 'cal_1', name: '主日历', type: 'primary', role: 'owner' },
        ],
        calendarId: 'cal_1',
        calendarName: '主日历',
      },
    };

    expect(source.feishu?.appId).toBe('cli_xxx');
    expect(source.feishu?.selectedCalendars?.[0]?.type).toBe('primary');
    expect(source.feishu?.lastRefreshTokenFingerprintUsed).toBe('eyJhbG…1234');
  });

  it('supports persisted Feishu error diagnostics on a source', () => {
    const diagnostic: FeishuSyncDiagnostic = {
      message: '飞书访问令牌已失效，请重新授权。',
      kind: 'invalid_grant',
      operation: 'refresh',
      timestamp: 1234567890,
      status: 400,
      apiCode: 20064,
      apiError: 'invalid_grant',
      apiErrorDescription: 'refresh token expired',
      calendarId: 'cal_1',
      windowStart: '2026-05-01T00:00:00.000Z',
      windowEnd: '2026-05-08T00:00:00.000Z',
      tokenFingerprint: 'eyJhbG…1234',
      tokenSavedAt: 1234500000,
      refreshTokenExpiresAt: 1239999999,
    };

    const source: CalendarSource = {
      id: 'feishu-2',
      name: 'Feishu',
      type: 'feishu',
      color: '#74C0FC',
      enabled: true,
      feishu: {
        appId: 'cli_xxx',
        appSecret: 'secret',
        lastSyncError: diagnostic,
      },
    };

    expect(source.feishu?.lastSyncError?.apiCode).toBe(20064);
    expect(source.feishu?.lastSyncError?.operation).toBe('refresh');
  });

  it('formats Feishu token fingerprint safely', () => {
    expect(formatFeishuTokenFingerprint('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe('eyJhbG…VCJ9');
    expect(formatFeishuTokenFingerprint('  abcdefghij  ')).toBe('abc…ij');
    expect(formatFeishuTokenFingerprint('')).toBeUndefined();
  });
});
