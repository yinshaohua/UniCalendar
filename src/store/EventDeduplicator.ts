import { CalendarEvent } from '../models/types';

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function hasMeetingLink(value: string | undefined): boolean {
  return !!value && /https?:\/\/meeting\./i.test(value);
}

function informationScore(event: CalendarEvent): number {
  let score = 0;

  if (event.location?.trim()) score += 2;
  if (event.description?.trim()) score += 2;
  if (hasMeetingLink(event.location)) score += 3;
  if (hasMeetingLink(event.description)) score += 3;
  if (!event.recurrenceId) score += 1;

  return score;
}

function sameSourceMergeKey(event: CalendarEvent): string | null {
  if (!event.uid) {
    return null;
  }

  return [
    event.sourceId,
    event.uid,
    event.start,
    event.end,
    normalizeTitle(event.title),
  ].join('||');
}

function preferRicherEvent(existing: CalendarEvent, incoming: CalendarEvent): CalendarEvent {
  return informationScore(incoming) > informationScore(existing) ? incoming : existing;
}

/**
 * Deduplicates events from multiple calendar sources.
 * Per D-08: pure function, runs at read time (not storage).
 * Per D-09: first source added wins (lower index in sourceOrder = higher priority).
 * Per D-10: UID exact match first, then exact start + normalized title fallback.
 * Additionally merges same-source duplicate instances when they are the same event
 * occurrence and one variant carries richer metadata (for example meeting links).
 */
export function deduplicateEvents(
  events: CalendarEvent[],
  sourceOrder: string[],
): CalendarEvent[] {
  const priorityMap = new Map(sourceOrder.map((id, idx) => [id, idx]));

  const sorted = [...events].sort((a, b) => {
    const pa = priorityMap.get(a.sourceId) ?? Infinity;
    const pb = priorityMap.get(b.sourceId) ?? Infinity;
    return pa - pb;
  });

  const seenUids = new Map<string, string>();
  const seenTimeTitleKeys = new Map<string, string>();
  const sameSourceMerged = new Map<string, CalendarEvent>();
  const result: CalendarEvent[] = [];

  for (const event of sorted) {
    const mergeKey = sameSourceMergeKey(event);
    if (mergeKey) {
      const existing = sameSourceMerged.get(mergeKey);
      if (existing) {
        const preferred = preferRicherEvent(existing, event);
        sameSourceMerged.set(mergeKey, preferred);
        const existingIndex = result.findIndex((item) => item.id === existing.id);
        if (existingIndex >= 0) {
          result[existingIndex] = preferred;
        }
        continue;
      }
    }

    let dominated = false;

    if (event.uid) {
      const claimedBy = seenUids.get(event.uid);
      if (claimedBy !== undefined && claimedBy !== event.sourceId) {
        dominated = true;
      } else if (claimedBy === undefined) {
        seenUids.set(event.uid, event.sourceId);
      }
    }

    if (!dominated) {
      const fallbackKey = `${event.start}|${normalizeTitle(event.title)}`;
      const claimedBy = seenTimeTitleKeys.get(fallbackKey);
      if (claimedBy !== undefined && claimedBy !== event.sourceId) {
        dominated = true;
      } else if (claimedBy === undefined) {
        seenTimeTitleKeys.set(fallbackKey, event.sourceId);
      }
    }

    if (!dominated) {
      result.push(event);
      if (mergeKey) {
        sameSourceMerged.set(mergeKey, event);
      }
    }
  }

  return result;
}
