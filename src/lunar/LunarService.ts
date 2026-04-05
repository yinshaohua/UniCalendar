import { getLunarDate, getSolarTerms } from 'chinese-days';

export interface LunarDayInfo {
 text: string;         // Display text: festival name OR solar term OR lunar day
 type: 'festival' | 'solarTerm' | 'lunarDay';
 lunarDayCN: string;   // e.g. "初一", "十五"
 lunarMonCN: string;   // e.g. "正月", "腊月"
}

/** Canonical traditional festivals only. Keyed by "lunarMon-lunarDay". */
const CANONICAL_FESTIVALS: Record<string, string> = {
 '1-1': '春节',
 '1-15': '元宵',
 '5-5': '端午',
 '7-7': '七夕',
 '7-15': '中元',
 '8-15': '中秋',
 '9-9': '重阳',
 '12-8': '腊八',
 // 除夕: handled dynamically below (last day of 12th month, could be 29 or 30)
};

export class LunarService {
 /** Format date for chinese-days (handles JS 0-based month -> 1-based string) */
 private formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
 }

 /** Get display info for a single date. Priority: solarTerm > festival > lunarDay */
 getLunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
  const dateStr = this.formatDate(year, month, day);
  const lunar = getLunarDate(dateStr);

  // 1. Solar terms (highest priority)
  const terms = getSolarTerms(dateStr, dateStr);
  if (terms.length > 0) {
   return {
    text: terms[0]!.name,
    type: 'solarTerm',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // 2. Canonical festivals (9 only)
  const lunarKey = `${lunar.lunarMon}-${lunar.lunarDay}`;
  const festivalName = CANONICAL_FESTIVALS[lunarKey];
  if (festivalName) {
   return {
    text: festivalName,
    type: 'festival',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // 3. Special case: 除夕 (last day of 12th lunar month, could be 29th or 30th)
  if (lunar.lunarMon === 12 && !lunar.isLeap) {
   const nextDate = new Date(year, month, day + 1);
   const nextDateStr = this.formatDate(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
   const nextLunar = getLunarDate(nextDateStr);
   if (nextLunar.lunarMon === 1 && nextLunar.lunarDay === 1) {
    return {
     text: '除夕',
     type: 'festival',
     lunarDayCN: lunar.lunarDayCN,
     lunarMonCN: lunar.lunarMonCN,
    };
   }
  }

  // 4. Default: lunar day
  return {
   text: lunar.lunarDayCN,
   type: 'lunarDay',
   lunarDayCN: lunar.lunarDayCN,
   lunarMonCN: lunar.lunarMonCN,
  };
 }

 /** Get lunar month name for toolbar title (D-03). Uses 1st day of Gregorian month. */
 getLunarMonthForTitle(year: number, month: number): string {
  const dateStr = this.formatDate(year, month, 1);
  const lunar = getLunarDate(dateStr);
  return lunar.isLeap ? `闰${lunar.lunarMonCN}` : lunar.lunarMonCN;
 }
}
