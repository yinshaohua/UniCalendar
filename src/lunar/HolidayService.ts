import { getDayDetail } from 'chinese-days';

export type HolidayType = 'rest' | 'work' | null;

export interface HolidayInfo {
 type: HolidayType;
 name?: string;
}

/**
 * Day-of-week names returned by chinese-days for regular (non-holiday) days.
 * Used to distinguish holiday-group days from regular weekdays/weekends.
 */
const DAY_OF_WEEK_NAMES = new Set([
 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]);

export class HolidayService {
 private dynamicData: Map<string, { name: string; isOffDay: boolean }> = new Map();

 /**
  * Load dynamic holiday data from holiday-cn cache.
  * Called after HolidayFetcher retrieves data or on plugin startup from cache.
  * Replaces any previously loaded dynamic data entirely.
  */
 loadDynamicData(data: Map<string, { name: string; isOffDay: boolean }>): void {
  this.dynamicData = data;
 }

 /**
  * Get holiday info for a date string (YYYY-MM-DD).
  *
  * Per D-06: Dynamic data (from holiday-cn) takes priority over static
  * chinese-days data. Falls back to chinese-days when date not in dynamic set.
  *
  * Detection logic:
  * - Dynamic data: isOffDay=true -> 'rest', isOffDay=false -> 'work'
  * - Static fallback uses chinese-days getDayDetail()
  * - Regular days (no holiday data) -> null
  *
  * Interface remains synchronous -- no CalendarView changes needed.
  */
 getHolidayInfo(dateStr: string): HolidayInfo {
  // Per D-06: Dynamic data takes priority over static chinese-days data
  const dynamic = this.dynamicData.get(dateStr);
  if (dynamic) {
   return {
    type: dynamic.isOffDay ? 'rest' : 'work',
    name: dynamic.name,
   };
  }

  // Fallback to chinese-days static data (per D-06)
  return this.getStaticHolidayInfo(dateStr);
 }

 /**
  * Look up holiday info from chinese-days static data.
  * Covers 2004-2026 range with built-in data.
  */
 private getStaticHolidayInfo(dateStr: string): HolidayInfo {
  try {
   const detail = getDayDetail(dateStr);
   if (!detail) return { type: null };

   // Regular days have day-of-week names; holiday-group days have holiday names
   if (DAY_OF_WEEK_NAMES.has(detail.name)) {
    return { type: null };
   }

   // Extract Chinese holiday name from composite string (e.g. "Spring Festival,春节,4")
   const nameParts = detail.name.split(',');
   const displayName = nameParts.length >= 2 ? nameParts[1] : detail.name;

   if (!detail.work) {
    return { type: 'rest', name: displayName };
   }
   return { type: 'work', name: displayName };
  } catch {
   // Graceful fallback: chinese-days may throw for invalid input
   // or dates outside its data range. Return null so calendar
   // renders without holiday indicators rather than crashing.
   return { type: null };
  }
 }
}
