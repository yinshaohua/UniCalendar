import { CalendarEvent } from '../models/types';

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function titlesOverlap(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);

  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
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
  score += normalizeTitle(event.title).length / 1000;

  return score;
}

function sameSourceMergeKey(event: CalendarEvent): string | null {
  if (event.uid) {
    return [
      'uid',
      event.sourceId,
      event.uid,
      event.start,
      event.end,
      normalizeTitle(event.title),
    ].join('||');
  }

  return [
    'time-title',
    event.sourceId,
    event.start,
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
 * Same-source duplicates without UID are also merged when the source, exact start time,
 * and normalized title match; the richer event wins.
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
  const seenTimeTitleClaims: Array<{ start: string; title: string; sourceId: string }> = [];
  const sameSourceMerged = new Map<string, CalendarEvent>();
  const sameSourceTimeTitleMerged: CalendarEvent[] = [];
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

    const sameSourceTimeTitleExisting = sameSourceTimeTitleMerged.find((existing) => (
      existing.sourceId === event.sourceId
      && existing.start === event.start
      && titlesOverlap(existing.title, event.title)
    ));
    if (sameSourceTimeTitleExisting) {
      const preferred = preferRicherEvent(sameSourceTimeTitleExisting, event);
      const existingIndex = result.findIndex((item) => item.id === sameSourceTimeTitleExisting.id);
      if (existingIndex >= 0) {
        result[existingIndex] = preferred;
      }
      const mergedIndex = sameSourceTimeTitleMerged.findIndex((item) => item.id === sameSourceTimeTitleExisting.id);
      if (mergedIndex >= 0) {
        sameSourceTimeTitleMerged[mergedIndex] = preferred;
      }
      if (mergeKey) {
        sameSourceMerged.set(mergeKey, preferred);
      }
      continue;
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
      const claim = seenTimeTitleClaims.find((item) => item.start === event.start && titlesOverlap(item.title, event.title));
      if (claim !== undefined && claim.sourceId !== event.sourceId) {
        dominated = true;
      } else if (claim === undefined) {
        seenTimeTitleClaims.push({
          start: event.start,
          title: event.title,
          sourceId: event.sourceId,
        });
      }
    }

    if (!dominated) {
      result.push(event);
      sameSourceTimeTitleMerged.push(event);
      if (mergeKey) {
        sameSourceMerged.set(mergeKey, event);
      }
    }
  }

  return result;
}
