import { describe, expect, it } from 'vitest';
import { filterEventsByTitleRules, matchesTitleFilterRule, normalizeFilterText } from '../../src/store/EventTitleFilter';
import { CalendarEvent, EventTitleFilterRule } from '../../src/models/types';

function makeEvent(title: string): CalendarEvent {
  return {
    id: title,
    sourceId: 'src1',
    title,
    start: '2026-05-20T12:00:00.000Z',
    end: '2026-05-20T13:00:00.000Z',
    allDay: false,
  };
}

function makeRule(overrides: Partial<EventTitleFilterRule> = {}): EventTitleFilterRule {
  return {
    id: 'rule-1',
    pattern: 'WaytoAGI',
    mode: 'contains',
    enabled: true,
    ...overrides,
  };
}

describe('EventTitleFilter', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeFilterText('  WaytoAGI   晚8点共学  ')).toBe('waytoagi 晚8点共学');
  });

  it('matches equals rule after normalization', () => {
    expect(matchesTitleFilterRule('  WAYTOAGI晚8点共学 ', makeRule({ mode: 'equals', pattern: 'waytoagi晚8点共学' }))).toBe(true);
  });

  it('matches contains rule when title contains input pattern', () => {
    expect(matchesTitleFilterRule('WaytoAGI晚8点共学 - Agent 实战专场', makeRule({ pattern: '晚8点共学' }))).toBe(true);
  });

  it('does not match disabled or blank rules', () => {
    expect(matchesTitleFilterRule('WaytoAGI晚8点共学', makeRule({ enabled: false }))).toBe(false);
    expect(matchesTitleFilterRule('WaytoAGI晚8点共学', makeRule({ pattern: '   ' }))).toBe(false);
  });

  it('filters events when any rule matches', () => {
    const rules = [
      makeRule({ mode: 'equals', pattern: '项目周会' }),
      makeRule({ id: 'rule-2', mode: 'contains', pattern: 'WaytoAGI' }),
    ];

    const result = filterEventsByTitleRules([
      makeEvent('项目周会'),
      makeEvent('WaytoAGI晚8点共学 - Agent 实战专场'),
      makeEvent('团队复盘'),
    ], rules);

    expect(result.map(event => event.title)).toEqual(['团队复盘']);
  });
});
