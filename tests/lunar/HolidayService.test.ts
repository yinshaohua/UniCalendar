import { describe, it, expect } from 'vitest';
import { HolidayService } from '../../src/lunar/HolidayService';

describe('HolidayService', () => {
 const service = new HolidayService();

 describe('getHolidayInfo - rest type (D-06)', () => {
  it('rest: returns type rest for 2026 New Year', () => {
   const info = service.getHolidayInfo('2026-01-01');
   expect(info.type).toBe('rest');
  });

  it('rest: returns type rest for 2026 Spring Festival', () => {
   const info = service.getHolidayInfo('2026-02-17');
   expect(info.type).toBe('rest');
  });

  it('name: includes holiday name for statutory holidays', () => {
   const info = service.getHolidayInfo('2026-01-01');
   expect(info.type).toBe('rest');
   expect(info.name).toBeTruthy();
   expect(info.name!.length).toBeGreaterThan(0);
  });
 });

 describe('getHolidayInfo - work type (D-07)', () => {
  it('work: returns type work for adjusted workday (bu-ban)', () => {
   // 2026-02-14 is Saturday, bu-ban for Spring Festival
   const info = service.getHolidayInfo('2026-02-14');
   expect(info.type).toBe('work');
  });

  it('work: returns type work for National Day bu-ban', () => {
   // 2026-10-10 is Saturday, bu-ban for National Day
   const info = service.getHolidayInfo('2026-10-10');
   expect(info.type).toBe('work');
  });
 });

 describe('getHolidayInfo - null type', () => {
  it('null: returns null type for regular weekday', () => {
   // 2026-03-16 is Monday, regular workday
   const info = service.getHolidayInfo('2026-03-16');
   expect(info.type).toBeNull();
  });

  it('null: returns null type for regular weekend', () => {
   // 2026-03-14 is Saturday, regular weekend
   const info = service.getHolidayInfo('2026-03-14');
   expect(info.type).toBeNull();
  });
 });

 describe('getHolidayInfo - 2026 data validation (A1)', () => {
  it('2026: has holiday data for National Day', () => {
   const info = service.getHolidayInfo('2026-10-01');
   expect(info.type).toBe('rest');
   expect(info.name).toBeTruthy();
   expect(info.name).toContain('国庆');
  });

  it('2026: has holiday data for Labour Day', () => {
   const info = service.getHolidayInfo('2026-05-01');
   expect(info.type).toBe('rest');
   expect(info.name).toBeTruthy();
  });
 });

 describe('getHolidayInfo - graceful fallback', () => {
  it('graceful: returns null for dates outside coverage range', () => {
   // 2030 may not have holiday data; should not throw
   const info = service.getHolidayInfo('2030-01-01');
   expect(info.type).toBeNull();
  });

  it('graceful: returns null for invalid date string', () => {
   const info = service.getHolidayInfo('invalid-date');
   expect(info.type).toBeNull();
  });
 });

 describe('HolidayService - dynamic data priority (D-06)', () => {
  const dynamicService = new HolidayService();
  const dynamicMap = new Map([
   ['2026-01-01', { name: '元旦', isOffDay: true }],
   ['2026-02-14', { name: '春节', isOffDay: false }],
   ['2099-07-01', { name: '测试节日', isOffDay: true }],
  ]);

  dynamicService.loadDynamicData(dynamicMap);

  it('returns dynamic data with type rest for isOffDay=true', () => {
   const info = dynamicService.getHolidayInfo('2026-01-01');
   expect(info.type).toBe('rest');
   expect(info.name).toBe('元旦');
  });

  it('returns dynamic data with type work for isOffDay=false', () => {
   const info = dynamicService.getHolidayInfo('2026-02-14');
   expect(info.type).toBe('work');
   expect(info.name).toBe('春节');
  });

  it('returns dynamic data name field matching holiday-cn name', () => {
   const info = dynamicService.getHolidayInfo('2099-07-01');
   expect(info.name).toBe('测试节日');
  });

  it('falls back to chinese-days static data when date NOT in dynamicData (D-06)', () => {
   // 2026-10-01 is National Day in chinese-days but not in our dynamic map
   const info = dynamicService.getHolidayInfo('2026-10-01');
   expect(info.type).toBe('rest');
   expect(info.name).toContain('国庆');
  });

  it('returns null type for regular weekday with no dynamic or static data', () => {
   const info = dynamicService.getHolidayInfo('2026-03-16');
   expect(info.type).toBeNull();
  });

  it('loadDynamicData replaces previous dynamic data entirely', () => {
   const freshService = new HolidayService();
   const firstMap = new Map([
    ['2099-01-01', { name: '旧数据', isOffDay: true }],
   ]);
   const secondMap = new Map([
    ['2099-06-01', { name: '新数据', isOffDay: false }],
   ]);

   freshService.loadDynamicData(firstMap);
   expect(freshService.getHolidayInfo('2099-01-01').name).toBe('旧数据');

   freshService.loadDynamicData(secondMap);
   // Old data should be gone
   expect(freshService.getHolidayInfo('2099-01-01').type).toBeNull();
   // New data should be present
   expect(freshService.getHolidayInfo('2099-06-01').name).toBe('新数据');
  });
 });
});
