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
 /**
  * Get holiday info for a date string (YYYY-MM-DD).
  *
  * Uses chinese-days built-in static data (covers 2004-2026).
  * Per user decision, Phase 6 uses static data ONLY -- online fetching
  * and automatic updates are deferred to a future phase.
  *
  * Detection logic:
  * - getDayDetail().name is a day-of-week string for regular days,
  *   and a holiday name (e.g. "Spring Festival,春节,4") for holiday-group days.
  * - Holiday-group day with work=false -> 'rest' (statutory holiday / compensatory rest)
  * - Holiday-group day with work=true -> 'work' (adjusted workday / 补班)
  * - Regular day (name is day-of-week) -> null
  *
  * The try-catch provides graceful fallback for invalid dates or dates
  * outside the chinese-days coverage range.
  */
 getHolidayInfo(dateStr: string): HolidayInfo {
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
