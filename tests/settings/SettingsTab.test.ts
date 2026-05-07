import { describe, it, expect, vi } from 'vitest';
import {
  formatGoogleSelectionSummary,
  formatGoogleErrorPhase,
  formatGoogleErrorSummary,
  formatGoogleErrorTime,
  formatGoogleDiagnosticLines,
  formatGoogleDiagnosticText,
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
