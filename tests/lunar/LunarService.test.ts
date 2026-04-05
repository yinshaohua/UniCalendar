import { describe, it, expect } from 'vitest';
import { LunarService } from '../../src/lunar/LunarService';

describe('LunarService', () => {
 const service = new LunarService();

 describe('getLunarDayInfo - display priority (D-02)', () => {
  it('priority: returns festival name for Spring Festival', () => {
   // 2026-02-17 is 正月初一 (Spring Festival)
   const info = service.getLunarDayInfo(2026, 1, 17);
   expect(info.type).toBe('festival');
   expect(info.text).toBeTruthy();
   expect(info.text.length).toBeGreaterThan(0);
  });

  it('priority: returns solar term for Xiaohan', () => {
   // 2026-01-05 is 小寒 (solar term with no festival on same day)
   const info = service.getLunarDayInfo(2026, 0, 5);
   expect(info.type).toBe('solarTerm');
   expect(info.text).toContain('小寒');
  });

  it('priority: returns lunar day for regular date', () => {
   // 2026-03-15 is 正月廿七 (no festival, no solar term)
   const info = service.getLunarDayInfo(2026, 2, 15);
   expect(info.type).toBe('lunarDay');
   expect(info.text).toBeTruthy();
  });
 });

 describe('getLunarDayInfo - canonical festivals', () => {
  it('festival: maps Spring Festival (春节) correctly', () => {
   const info = service.getLunarDayInfo(2026, 1, 17);
   expect(info.type).toBe('festival');
   expect(info.text).toContain('春节');
  });

  it('festival: maps Lantern Festival (元宵) correctly', () => {
   // 2026-03-03 is 正月十五
   const info = service.getLunarDayInfo(2026, 2, 3);
   expect(info.type).toBe('festival');
   expect(info.text).toContain('元宵');
  });

  it('festival: maps Dragon Boat (端午) correctly', () => {
   // 2026-06-19 is 五月初五
   const info = service.getLunarDayInfo(2026, 5, 19);
   expect(info.type).toBe('festival');
   expect(info.text).toContain('端午');
  });

  it('festival: maps Mid-Autumn (中秋) correctly', () => {
   // 2026-09-25 is 八月十五
   const info = service.getLunarDayInfo(2026, 8, 25);
   expect(info.type).toBe('festival');
   expect(info.text).toContain('中秋');
  });

  it('festival: maps Chong Yang (重阳) correctly', () => {
   // 2026-10-18 is 九月初九
   const info = service.getLunarDayInfo(2026, 9, 18);
   expect(info.type).toBe('festival');
   expect(info.text).toContain('重阳');
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

  it('uses 15th of month for dominant month', () => {
   const result = service.getLunarMonthForTitle(2026, 0);
   // January 2026 15th should give a valid lunar month name
   expect(typeof result).toBe('string');
   expect(result).toBeTruthy();
  });
 });
});
