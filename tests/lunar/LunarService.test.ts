import { describe, it, expect } from 'vitest';
import { LunarService } from '../../src/lunar/LunarService';

describe('LunarService', () => {
 const service = new LunarService();

 describe('getLunarDayInfo - display priority: solarTerm > festival > lunarDay', () => {
  it('priority: solar term takes precedence over festival and lunarDay', () => {
   // 2026-01-05 is 小寒 (solar term)
   const info = service.getLunarDayInfo(2026, 0, 5);
   expect(info.type).toBe('solarTerm');
   expect(info.text).toContain('小寒');
  });

  it('priority: festival takes precedence over lunarDay', () => {
   // 2026-02-17 is 春节 (正月初一), not a solar term day
   const info = service.getLunarDayInfo(2026, 1, 17);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('春节');
  });

  it('priority: 清明 displays as solarTerm not festival', () => {
   // 2026-04-05 is 清明 (solar term, also a traditional festival — solarTerm wins)
   const info = service.getLunarDayInfo(2026, 3, 5);
   expect(info.type).toBe('solarTerm');
   expect(info.text).toContain('清明');
  });

  it('priority: regular date shows lunarDay', () => {
   // 2026-03-15 has no solar term and no canonical festival
   const info = service.getLunarDayInfo(2026, 2, 15);
   expect(info.type).toBe('lunarDay');
   expect(info.text).toBeTruthy();
  });
 });

 describe('getLunarDayInfo - canonical festivals', () => {
  it('festival: 春节 (正月初一)', () => {
   const info = service.getLunarDayInfo(2026, 1, 17);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('春节');
  });

  it('festival: 元宵 (正月十五)', () => {
   // 2026-03-03 is 正月十五
   const info = service.getLunarDayInfo(2026, 2, 3);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('元宵');
  });

  it('festival: 端午 (五月初五)', () => {
   // 2026-06-19 is 五月初五
   const info = service.getLunarDayInfo(2026, 5, 19);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('端午');
  });

  it('festival: 中秋 (八月十五)', () => {
   // 2026-09-25 is 八月十五
   const info = service.getLunarDayInfo(2026, 8, 25);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('中秋');
  });

  it('festival: 重阳 (九月初九)', () => {
   // 2026-10-18 is 九月初九
   const info = service.getLunarDayInfo(2026, 9, 18);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('重阳');
  });

  it('festival: 除夕 (腊月最后一天)', () => {
   // 2026-02-16 is 腊月廿九 (last day of 12th month)
   const info = service.getLunarDayInfo(2026, 1, 16);
   expect(info.type).toBe('festival');
   expect(info.text).toBe('除夕');
  });
 });

 describe('getLunarDayInfo - edge cases', () => {
  it('month indexing: handles JS 0-based month correctly', () => {
   // month=0 means January
   const info = service.getLunarDayInfo(2026, 0, 1);
   expect(info).toBeDefined();
   expect(info.lunarDayCN).toBeTruthy();
   expect(info.lunarMonCN).toBeTruthy();
  });

  it('lunarDayCN and lunarMonCN always populated', () => {
   const info = service.getLunarDayInfo(2026, 5, 15);
   expect(info.lunarDayCN).toBeTruthy();
   expect(info.lunarDayCN.length).toBeGreaterThan(0);
   expect(info.lunarMonCN).toBeTruthy();
   expect(info.lunarMonCN.length).toBeGreaterThan(0);
  });
 });

 describe('getLunarMonthForTitle (D-03)', () => {
  it('returns Chinese lunar month name', () => {
   // April 2026: 15th is in 二月
   const result = service.getLunarMonthForTitle(2026, 3);
   expect(result).toBeTruthy();
   expect(result.length).toBeGreaterThan(0);
  });

  it('uses 1st of month for lookup', () => {
   const result = service.getLunarMonthForTitle(2026, 0);
   expect(typeof result).toBe('string');
   expect(result).toBeTruthy();
  });
 });
});
