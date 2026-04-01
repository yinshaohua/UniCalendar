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
}

export interface CalendarSource {
  id: string;                    // UUID generated on creation
  name: string;
  type: 'google' | 'caldav' | 'ics';
  color: string;                 // Hex color
  enabled: boolean;
  google?: { clientId: string; clientSecret: string; };
  caldav?: { serverUrl: string; username: string; password: string; calendarPath?: string; };
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
}

export interface EventCache {
  events: CalendarEvent[];
  lastSyncTime: number | null;
  cacheWindowStart: string;
  cacheWindowEnd: string;
}

export interface UniCalendarData {
  settings: UniCalendarSettings;
  eventCache: EventCache;
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

export const DEFAULT_SETTINGS: UniCalendarSettings = {
  sources: [],
  syncInterval: 15,
  defaultView: 'month',
  monthOverflowMode: 'expand',
};

export const DEFAULT_CACHE: EventCache = {
  events: [],
  lastSyncTime: null,
  cacheWindowStart: '',
  cacheWindowEnd: '',
};
