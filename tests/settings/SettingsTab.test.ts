import { describe, it, expect, vi } from 'vitest';
import {
  buildSavedGoogleConfig,
  formatGoogleSelectionSummary,
  formatGoogleErrorPhase,
  formatGoogleErrorSummary,
  formatGoogleErrorTime,
  formatGoogleDiagnosticLines,
  formatGoogleDiagnosticText,
  formatFeishuSelectionSummary,
  formatFeishuErrorPhase,
  formatFeishuErrorSummary,
  formatFeishuDiagnosticLines,
  formatFeishuDiagnosticText,
} from '../../src/settings/SettingsTab';
import type { CalendarSource } from '../../src/models/types';
import { formatGoogleTokenFingerprint } from '../../src/models/types';

function makeGoogleSource(overrides: Partial<NonNullable<CalendarSource['google']>> = {}): CalendarSource {
  return {
    id: 'g1',
    name: 'Google',
    type: 'google',
    color: '#74C0FC',
    enabled: true,
    google: {
      clientId: 'cid',
      clientSecret: 'secret',
      ...overrides,
    },
  };
}

describe('buildSavedGoogleConfig', () => {
  it('persists Google custom proxy settings while preserving existing token fields', () => {
    const source = makeGoogleSource({
      accessToken: 'at',
      refreshToken: 'rt',
      tokenExpiry: 123,
      calendarId: 'primary',
    });

    const google = buildSavedGoogleConfig(
      source,
      ' cid ',
      ' secret ',
      { mode: 'custom', host: ' 127.0.0.1 ', port: 7890 },
    );

    expect(google).toMatchObject({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'at',
      refreshToken: 'rt',
      tokenExpiry: 123,
      calendarId: 'primary',
      proxyMode: 'custom',
      proxyHost: '127.0.0.1',
      proxyPort: 7890,
      proxyUrl: undefined,
    });
  });

  it('saves none mode without custom proxy fields', () => {
    const google = buildSavedGoogleConfig(
      makeGoogleSource({ proxyMode: 'custom', proxyHost: '127.0.0.1', proxyPort: 7890 }),
      'cid',
      'secret',
      { mode: 'none' },
    );

    expect(google.proxyMode).toBe('none');
    expect(google.proxyHost).toBeUndefined();
    expect(google.proxyPort).toBeUndefined();
    expect(google.proxyUrl).toBeUndefined();
  });

  it('rejects invalid custom Google proxy ports before saving', () => {
    expect(() => buildSavedGoogleConfig(makeGoogleSource(), 'cid', 'secret', { mode: 'custom', host: '127.0.0.1', port: 0 })).toThrow(
      'Google 代理端口必须是 1 到 65535 之间的整数。',
    );
  });
});

function makeFeishuSource(overrides: Partial<NonNullable<CalendarSource['feishu']>> = {}): CalendarSource {
  return {
    id: 'f1',
    name: 'Feishu',
    type: 'feishu',
    color: '#74C0FC',
    enabled: true,
    feishu: {
      appId: 'cli_xxx',
      appSecret: 'secret',
      ...overrides,
    },
  };
}

describe('SettingsTab Google formatters', () => {
  it('formats selected Google calendars summary', () => {
    const source = makeGoogleSource({
      selectedCalendars: [
        { id: 'primary', name: '主日历' },
        { id: 'work', name: '工作' },
      ],
    });

    expect(formatGoogleSelectionSummary(source)).toBe('已选日历（2）: 主日历, 工作');
  });

  it('falls back to legacy single calendar summary', () => {
    const source = makeGoogleSource({
      calendarId: 'primary',
      calendarName: '我的日历',
    });

    expect(formatGoogleSelectionSummary(source)).toBe('已选日历: 我的日历');
  });

  it('formats Google error phase labels in Chinese', () => {
    expect(formatGoogleErrorPhase('exchange')).toBe('授权换取令牌');
    expect(formatGoogleErrorPhase('refresh')).toBe('刷新访问令牌');
    expect(formatGoogleErrorPhase('calendar-api')).toBe('拉取 Google 日历');
  });

  it('formats Google error time with zh-CN locale', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('2026/05/06 18:30:00');

    expect(formatGoogleErrorTime(1234567890)).toBe('2026/05/06 18:30:00');
    expect(spy).toHaveBeenCalledWith('zh-CN', { hour12: false });

    spy.mockRestore();
  });

  it('formats Google error summary with phase and time', () => {
    const source = makeGoogleSource({
      lastSyncError: {
        message: '访问 Google 令牌接口失败，请检查网络或 VPN 连接后重试。',
        kind: 'network',
        operation: 'refresh',
        timestamp: 1234567890,
      },
    });

    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('2026/05/06 18:30:00');

    expect(formatGoogleErrorSummary(source)).toBe(
      '上次失败: 访问 Google 令牌接口失败，请检查网络或 VPN 连接后重试。（阶段：刷新访问令牌；时间：2026/05/06 18:30:00）',
    );

    timeSpy.mockRestore();
  });

  it('formats token fingerprint safely', () => {
    expect(formatGoogleTokenFingerprint('1//0gExampleRefreshToken1234')).toBe('1//0gE…1234');
    expect(formatGoogleTokenFingerprint('  abcdefghij  ')).toBe('abc…ij');
    expect(formatGoogleTokenFingerprint('')).toBeUndefined();
  });

  it('formats diagnostic lines for copy/paste support', () => {
    const source = makeGoogleSource({
      refreshTokenFingerprint: '1//0gE…1234',
      lastSyncError: {
        message: 'Google 授权已失效，请重新授权此日历源。',
        kind: 'invalid_grant',
        operation: 'refresh',
        timestamp: 1234567890,
        status: 400,
        apiError: 'invalid_grant',
        apiErrorDescription: 'Token has been expired or revoked',
        tokenFingerprint: '1//0gE…1234',
        tokenSavedAt: 1234500000,
        tokenLastRefreshedAt: 1234560000,
      },
    });

    const formatTimeSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (this: Date) {
      const timestamp = this.getTime();
      if (timestamp === 1234500000) return '2026/05/06 18:20:00';
      if (timestamp === 1234560000) return '2026/05/06 18:26:00';
      if (timestamp === 1234567890) return '2026/05/06 18:30:00';
      return 'unknown-time';
    });

    expect(formatGoogleDiagnosticLines(source)).toEqual([
      'UniCalendar Google 诊断',
      '- source: Google',
      '- operation: refresh',
      '- phase: 刷新访问令牌',
      '- kind: invalid_grant',
      '- status: 400',
      '- apiError: invalid_grant',
      '- apiErrorDescription: Token has been expired or revoked',
      '- tokenFingerprint: 1//0gE…1234',
      '- tokenSavedAt: 2026/05/06 18:20:00',
      '- tokenLastRefreshedAt: 2026/05/06 18:26:00',
      '- message: Google 授权已失效，请重新授权此日历源。',
      '- timestamp: 2026/05/06 18:30:00',
    ]);

    expect(formatGoogleDiagnosticText(source)).toBe([
      'UniCalendar Google 诊断',
      '- source: Google',
      '- operation: refresh',
      '- phase: 刷新访问令牌',
      '- kind: invalid_grant',
      '- status: 400',
      '- apiError: invalid_grant',
      '- apiErrorDescription: Token has been expired or revoked',
      '- tokenFingerprint: 1//0gE…1234',
      '- tokenSavedAt: 2026/05/06 18:20:00',
      '- tokenLastRefreshedAt: 2026/05/06 18:26:00',
      '- message: Google 授权已失效，请重新授权此日历源。',
      '- timestamp: 2026/05/06 18:30:00',
    ].join('\n'));

    formatTimeSpy.mockRestore();
  });
});

describe('SettingsTab Feishu formatters', () => {
  it('summarizes selected calendars', () => {
    const source = makeFeishuSource({
      selectedCalendars: [
        { id: 'cal_1', name: '主日历', type: 'primary', role: 'owner' },
        { id: 'cal_2', name: '团队日历', type: 'shared', role: 'writer' },
      ],
    });

    expect(formatFeishuSelectionSummary(source)).toBe('已选日历（2）: 主日历, 团队日历');
  });

  it('falls back to single calendar name when selectedCalendars is absent', () => {
    const source = makeFeishuSource({
      calendarId: 'cal_1',
      calendarName: '主日历',
    });

    expect(formatFeishuSelectionSummary(source)).toBe('已选日历: 主日历');
  });

  it('formats operation phase labels', () => {
    expect(formatFeishuErrorPhase('exchange')).toBe('授权换取令牌');
    expect(formatFeishuErrorPhase('refresh')).toBe('刷新访问令牌');
    expect(formatFeishuErrorPhase('calendar-list')).toBe('拉取飞书日历列表');
    expect(formatFeishuErrorPhase('instance-view')).toBe('拉取飞书日程实例');
  });

  it('formats last sync error summary', () => {
    const source = makeFeishuSource({
      lastSyncError: {
        message: '飞书访问令牌已失效，请重新授权。',
        kind: 'invalid_grant',
        operation: 'refresh',
        timestamp: Date.UTC(2026, 4, 20, 8, 30, 0),
      },
    });

    expect(formatFeishuErrorSummary(source)).toContain('上次失败: 飞书访问令牌已失效，请重新授权。');
    expect(formatFeishuErrorSummary(source)).toContain('阶段：刷新访问令牌');
  });

  it('formats diagnostic lines with structured fields', () => {
    const source = makeFeishuSource({
      refreshTokenFingerprint: 'eyJhbG…1234',
      lastSyncError: {
        message: '飞书接口限流。',
        kind: 'rate_limited',
        operation: 'instance-view',
        timestamp: Date.UTC(2026, 4, 20, 8, 30, 0),
        status: 429,
        apiCode: 99991663,
        apiError: 'rate_limited',
        apiErrorDescription: 'too many requests',
        calendarId: 'cal_1',
        windowStart: '2026-05-20T00:00:00.000Z',
        windowEnd: '2026-05-27T00:00:00.000Z',
        tokenSavedAt: Date.UTC(2026, 4, 19, 10, 0, 0),
        refreshTokenExpiresAt: Date.UTC(2026, 5, 19, 10, 0, 0),
      },
    });

    const lines = formatFeishuDiagnosticLines(source);

    expect(lines[0]).toBe('UniCalendar Feishu 诊断');
    expect(lines).toContain('- source: Feishu');
    expect(lines).toContain('- phase: 拉取飞书日程实例');
    expect(lines).toContain('- status: 429');
    expect(lines).toContain('- apiCode: 99991663');
    expect(lines).toContain('- apiError: rate_limited');
    expect(lines).toContain('- calendarId: cal_1');
    expect(lines).toContain('- windowStart: 2026-05-20T00:00:00.000Z');
    expect(lines).toContain('- tokenFingerprint: eyJhbG…1234');
  });

  it('formats diagnostic text for clipboard/export scenarios', () => {
    const source = makeFeishuSource({
      lastSyncError: {
        message: '没有权限访问该飞书日历。',
        kind: 'no_permission',
        operation: 'calendar-list',
        timestamp: Date.UTC(2026, 4, 20, 8, 30, 0),
      },
    });

    const text = formatFeishuDiagnosticText(source);
    expect(text).toContain('UniCalendar Feishu 诊断');
    expect(text).toContain('- operation: calendar-list');
    expect(text).toContain('- message: 没有权限访问该飞书日历。');
  });
});
