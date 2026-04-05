import { getLunarDate, getSolarTerms, getLunarFestivals } from 'chinese-days';

export interface LunarDayInfo {
 text: string;         // Display text: festival name OR solar term OR lunar day
 type: 'festival' | 'solarTerm' | 'lunarDay';
 lunarDayCN: string;   // e.g. "初一", "十五"
 lunarMonCN: string;   // e.g. "正月", "腊月"
}

export class LunarService {
 /** Format date for chinese-days (handles JS 0-based month -> 1-based string) */
 private formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
 }

 /** Get display info for a single date. Priority per D-02: festival > solar term > lunar day */
 getLunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
  const dateStr = this.formatDate(year, month, day);
  const lunar = getLunarDate(dateStr);

  // Check festivals first (highest priority per D-02)
  const festivals = getLunarFestivals(dateStr, dateStr);
  if (festivals.length > 0 && festivals[0]!.name.length > 0) {
   return {
    text: festivals[0]!.name[0]!,
    type: 'festival',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // Check solar terms (second priority per D-02)
  const terms = getSolarTerms(dateStr, dateStr);
  if (terms.length > 0) {
   return {
    text: terms[0]!.name,
    type: 'solarTerm',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // Default: lunar day
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
  return lunar.lunarMonCN;
 }
}
