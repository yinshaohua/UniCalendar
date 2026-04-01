import { CalendarEvent } from '../models/types';

/**
 * Deduplicates events from multiple calendar sources.
 * Per D-08: pure function, runs at read time (not storage).
 * Per D-09: first source added wins (lower index in sourceOrder = higher priority).
 * Per D-10: UID exact match first, then exact start + normalized title fallback.
 *           Same-source events never deduplicate against each other.
 */
export function deduplicateEvents(
  events: CalendarEvent[],
  sourceOrder: string[],
): CalendarEvent[] {
  // Build priority map: sourceId -> priority index (lower = higher priority)
  const priorityMap = new Map(sourceOrder.map((id, idx) => [id, idx]));

  // Sort by source priority (first-added source = lower index = processed first)
  const sorted = [...events].sort((a, b) => {
    const pa = priorityMap.get(a.sourceId) ?? Infinity;
    const pb = priorityMap.get(b.sourceId) ?? Infinity;
    return pa - pb;
  });

  const seenUids = new Map<string, string>();         // uid -> sourceId that claimed it
  const seenTimeTitleKeys = new Map<string, string>(); // "start|normalizedTitle" -> sourceId
  const result: CalendarEvent[] = [];

  for (const event of sorted) {
    let dominated = false;

    // UID-first match: exact string match, but only across different sources
    if (event.uid) {
      const claimedBy = seenUids.get(event.uid);
      if (claimedBy !== undefined && claimedBy !== event.sourceId) {
        dominated = true;
      } else if (claimedBy === undefined) {
        seenUids.set(event.uid, event.sourceId);
      }
    }

    // Time+title fallback: exact start + trimmed lowercase title
    if (!dominated) {
      const fallbackKey = `${event.start}|${event.title.trim().toLowerCase()}`;
      const claimedBy = seenTimeTitleKeys.get(fallbackKey);
      if (claimedBy !== undefined && claimedBy !== event.sourceId) {
        dominated = true;
      } else if (claimedBy === undefined) {
        seenTimeTitleKeys.set(fallbackKey, event.sourceId);
      }
    }

    if (!dominated) {
      result.push(event);
    }
  }

  return result;
}
