import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';

const mockRequestUrl = vi.mocked(requestUrl);

// Import after mock setup (obsidian is aliased to mock in vitest.config.ts)
import { HolidayFetcher } from '../../src/lunar/HolidayFetcher';

const MOCK_2026_DATA = {
 year: 2026,
 days: [
  { name: '元旦', date: '2026-01-01', isOffDay: true },
  { name: '元旦', date: '2026-01-02', isOffDay: true },
  { name: '元旦', date: '2026-01-03', isOffDay: true },
  { name: '春节', date: '2026-02-17', isOffDay: true },
  { name: '春节', date: '2026-02-14', isOffDay: false },
 ],
};

const MOCK_2027_DATA = {
 year: 2027,
 days: [
  { name: '元旦', date: '2027-01-01', isOffDay: true },
  { name: '元旦', date: '2027-01-02', isOffDay: true },
 ],
};

describe('HolidayFetcher', () => {
 let fetcher: HolidayFetcher;

 beforeEach(() => {
  fetcher = new HolidayFetcher();
  mockRequestUrl.mockReset();
 });

 describe('fetchYear', () => {
  it('parses mock JSON response into Map with correct date keys and values', async () => {
   mockRequestUrl.mockResolvedValueOnce({ json: MOCK_2026_DATA, text: '', status: 200 } as never);

   const result = await fetcher.fetchYear(2026);

   expect(result).toBeInstanceOf(Map);
   expect(result.size).toBe(5);
   expect(result.get('2026-01-01')).toEqual({ name: '元旦', isOffDay: true });
   expect(result.get('2026-02-17')).toEqual({ name: '春节', isOffDay: true });
  });

  it('correctly maps isOffDay values for rest and work entries', async () => {
   mockRequestUrl.mockResolvedValueOnce({ json: MOCK_2026_DATA, text: '', status: 200 } as never);

   const result = await fetcher.fetchYear(2026);

   // isOffDay=true entries
   expect(result.get('2026-01-01')!.isOffDay).toBe(true);
   // isOffDay=false entries (adjusted workday)
   expect(result.get('2026-02-14')!.isOffDay).toBe(false);
  });

  it('throws on 404 when year not available from both CDN and fallback', async () => {
   mockRequestUrl.mockRejectedValue(new Error('Request failed, status 404'));

   await expect(fetcher.fetchYear(9999)).rejects.toThrow();
  });

  it('validates response structure - rejects if days array missing', async () => {
   mockRequestUrl.mockResolvedValueOnce({ json: { year: 2026 }, text: '', status: 200 } as never);

   await expect(fetcher.fetchYear(2026)).rejects.toThrow('missing days array');
  });
 });

 describe('fetchYears', () => {
  it('fetches both years and merges into single Map', async () => {
   // First call for 2026 (jsdelivr), second would be 2027 (jsdelivr)
   mockRequestUrl
    .mockResolvedValueOnce({ json: MOCK_2026_DATA, text: '', status: 200 } as never)
    .mockResolvedValueOnce({ json: MOCK_2027_DATA, text: '', status: 200 } as never);

   const result = await fetcher.fetchYears([2026, 2027]);

   expect(result.size).toBe(7); // 5 from 2026 + 2 from 2027
   expect(result.get('2026-01-01')).toEqual({ name: '元旦', isOffDay: true });
   expect(result.get('2027-01-01')).toEqual({ name: '元旦', isOffDay: true });
  });

  it('returns partial data when one year 404s', async () => {
   mockRequestUrl
    .mockResolvedValueOnce({ json: MOCK_2026_DATA, text: '', status: 200 } as never)
    // 2027 fails on both CDN and fallback
    .mockRejectedValueOnce(new Error('404'))
    .mockRejectedValueOnce(new Error('404'));

   const result = await fetcher.fetchYears([2026, 2027]);

   expect(result.size).toBe(5); // Only 2026 data
   expect(result.get('2026-01-01')).toBeDefined();
   expect(result.get('2027-01-01')).toBeUndefined();
  });

  it('returns empty Map when both years 404', async () => {
   mockRequestUrl.mockRejectedValue(new Error('404'));

   const result = await fetcher.fetchYears([2026, 2027]);

   expect(result).toBeInstanceOf(Map);
   expect(result.size).toBe(0);
  });
 });

 describe('URL configuration', () => {
  it('uses jsdelivr CDN URL (D-02)', async () => {
   mockRequestUrl.mockResolvedValueOnce({ json: MOCK_2026_DATA, text: '', status: 200 } as never);

   await fetcher.fetchYear(2026);

   const calledUrl = mockRequestUrl.mock.calls[0]?.[0];
   const url = typeof calledUrl === 'string' ? calledUrl : (calledUrl as { url: string }).url;
   expect(url).toContain('cdn.jsdelivr.net');
   expect(url).toContain('holiday-cn');
   expect(url).toContain('2026.json');
  });
 });
});
