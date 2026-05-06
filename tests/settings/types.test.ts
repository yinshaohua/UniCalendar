import { describe, it, expect } from 'vitest';
import {
  SOURCE_COLORS,
  getNextColor,
  DEFAULT_SETTINGS,
  DEFAULT_CACHE,
  CalendarSource,
  GoogleSyncDiagnostic,
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
    expect(DEFAULT_SETTINGS.defaultView).toBe('month');
  });

  it('has showLunarCalendar defaulting to true', () => {
    expect(DEFAULT_SETTINGS.showLunarCalendar).toBe(true);
  });

  it('has showHolidays defaulting to true', () => {
    expect(DEFAULT_SETTINGS.showHolidays).toBe(true);
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
