import { CalendarEvent, EventTitleFilterRule } from '../models/types';

export function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchesTitleFilterRule(eventTitle: string, rule: EventTitleFilterRule): boolean {
  if (!rule.enabled) {
    return false;
  }

  const normalizedPattern = normalizeFilterText(rule.pattern);
  if (!normalizedPattern) {
    return false;
  }

  const normalizedTitle = normalizeFilterText(eventTitle);
  if (!normalizedTitle) {
    return false;
  }

  if (rule.mode === 'equals') {
    return normalizedTitle === normalizedPattern;
  }

  return normalizedTitle.includes(normalizedPattern);
}

export function filterEventsByTitleRules(
  events: CalendarEvent[],
  rules: EventTitleFilterRule[],
): CalendarEvent[] {
  const activeRules = rules.filter(rule => rule.enabled && normalizeFilterText(rule.pattern).length > 0);
  if (activeRules.length === 0) {
    return events;
  }

  return events.filter(event => !activeRules.some(rule => matchesTitleFilterRule(event.title, rule)));
}
