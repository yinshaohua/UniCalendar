export interface CalendarEvent {
  id: string;                    // Format: `${sourceId}::${eventUid}`
  sourceId: string;
  title: string;
  start: string;                 // ISO 8601 datetime
  end: string;                   // ISO 8601 datetime
  allDay: boolean;
  location?: string;
  description?: string;
  recurrenceId?: string;
  uid?: string;  // iCalendar UID or Google event ID for cross-source dedup
}

export interface CalendarSource {
  id: string;                    // UUID generated on creation
  name: string;
  type: 'google' | 'caldav' | 'ics';
  color: string;                 // Hex color
  enabled: boolean;
  google?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;       // Unix timestamp in ms
    calendarId?: string;        // Selected calendar ID from discovery (legacy single-select)
    calendarName?: string;      // Display name of selected calendar (legacy single-select)
    selectedCalendars?: Array<{ id: string; name: string }>;
};
  caldav?: { serverUrl: string; username: string; password: string; calendarPath?: string; calendarDisplayName?: string; selectedCalendars?: Array<{ path: string; displayName: string }>; };
  ics?: { feedUrl: string; };
}

export type SyncState =
  | { status: 'idle'; lastSyncTime: number | null }
  | { status: 'syncing'; startedAt: number }
  | { status: 'error'; message: string; lastSyncTime: number | null };

export interface UniCalendarSettings {
  sources: CalendarSource[];
  syncInterval: number;          // minutes
  defaultView: 'month' | 'week' | 'day';
  monthOverflowMode: 'expand' | 'collapse';
  showLunarCalendar: boolean;    // D-12: show lunar dates, festivals, solar terms in month view
  showHolidays: boolean;         // D-12: show holiday/workday backgrounds and badges
}

export interface EventCache {
  events: CalendarEvent[];
  lastSyncTime: number | null;
  cacheWindowStart: string;
  cacheWindowEnd: string;
}

export interface HolidayCacheEntry {
  name: string;
  date: string;
  isOffDay: boolean;
}

export interface HolidayCache {
  lastFetchTime: number | null;   // Unix timestamp ms, for 24h interval check per D-03
  years: Record<string, HolidayCacheEntry[]>;  // Key is year string e.g. "2026"
}

export interface UniCalendarData {
  settings: UniCalendarSettings;
  eventCache: EventCache;
  holidayCache: HolidayCache;  // Per D-04: cached in plugin data storage
}

export const SOURCE_COLORS: string[] = [
  '#FF6961', '#77DD77', '#84B6F4', '#FDFD96', '#FFB347',
  '#CB99C9', '#B39EB5', '#87CEEB', '#FFD1DC', '#C1E1C1',
];

export function getNextColor(existingSources: CalendarSource[]): string {
  const usedColors = new Set(existingSources.map(s => s.color));
  // SOURCE_COLORS is guaranteed non-empty, so fallback is always valid
  return SOURCE_COLORS.find(c => !usedColors.has(c)) ?? SOURCE_COLORS[0]!;
}

export const RECOMMENDED_PALETTE: Array<{ name: string; hex: string }> = [
  { name: '番茄红', hex: '#FF6B6B' },
  { name: '橘橙', hex: '#FFA06B' },
  { name: '向日葵', hex: '#FFD93D' },
  { name: '薄荷绿', hex: '#6BCB77' },
  { name: '天空蓝', hex: '#74C0FC' },
  { name: '海洋蓝', hex: '#4D96FF' },
  { name: '薰衣紫', hex: '#9B59B6' },
  { name: '樱花粉', hex: '#FF6B9D' },
];

export const DEFAULT_SETTINGS: UniCalendarSettings = {
  sources: [],
  syncInterval: 15,
  defaultView: 'month',
  monthOverflowMode: 'expand',
  showLunarCalendar: true,
  showHolidays: true,
};

export const DEFAULT_CACHE: EventCache = {
  events: [],
  lastSyncTime: null,
  cacheWindowStart: '',
  cacheWindowEnd: '',
};

export const DEFAULT_HOLIDAY_CACHE: HolidayCache = {
  lastFetchTime: null,
  years: {},
};
