import { requestUrl } from 'obsidian';

export interface HolidayCnDay {
 name: string;
 date: string;
 isOffDay: boolean;
}

// Per D-02: URL hardcoded, user never sees or configures this
// Using jsdelivr CDN for better China mainland accessibility (Research pitfall 4)
const HOLIDAY_CN_BASE_URL = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master';
const HOLIDAY_CN_FALLBACK_URL = 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master';

export class HolidayFetcher {
 /**
  * Fetch and parse holiday data for a single year from holiday-cn.
  * Tries jsdelivr CDN first, falls back to raw.githubusercontent.com.
  * Throws if both sources fail (caller should handle gracefully).
  */
 async fetchYear(year: number): Promise<Map<string, { name: string; isOffDay: boolean }>> {
  let response;
  try {
   response = await requestUrl({ url: `${HOLIDAY_CN_BASE_URL}/${year}.json` });
  } catch {
   // jsdelivr failed, try raw.githubusercontent.com fallback
   response = await requestUrl({ url: `${HOLIDAY_CN_FALLBACK_URL}/${year}.json` });
  }

  const data = response.json as { days?: HolidayCnDay[] };
  if (!data.days || !Array.isArray(data.days)) {
   throw new Error(`Invalid holiday data for year ${year}: missing days array`);
  }

  const map = new Map<string, { name: string; isOffDay: boolean }>();
  for (const day of data.days) {
   map.set(day.date, { name: day.name, isOffDay: day.isOffDay });
  }
  return map;
 }

 /**
  * Fetch holiday data for multiple years, merging results.
  * Per D-05: typically current year + next year.
  * Silently skips years that fail to fetch (e.g. future year not published yet).
  */
 async fetchYears(years: number[]): Promise<Map<string, { name: string; isOffDay: boolean }>> {
  const merged = new Map<string, { name: string; isOffDay: boolean }>();
  for (const year of years) {
   try {
    const yearMap = await this.fetchYear(year);
    for (const [k, v] of yearMap) {
     merged.set(k, v);
    }
   } catch {
    // Per Research pitfall 1: 404 for future year is expected
    console.warn(`[UniCalendar] Holiday data for ${year} not available, skipping`);
   }
  }
  return merged;
 }
}
