import { DAY, dayStart, parseAvailability, type Availability } from './calendar.ts';

export interface State { data?: Availability; loading: boolean; error: boolean }
export async function refresh(state: State, fetcher: () => Promise<unknown>): Promise<State> {
  try { return { data: parseAvailability(await fetcher()), loading: false, error: false }; }
  catch { return { data: state.data, loading: false, error: true }; }
}
export async function requestData(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export function mockData(now: number): unknown {
  const iso = (n: number) => new Date(n).toISOString();
  const start = dayStart(now);
  return {
    updatedAt: iso(now), range: { start: iso(now), end: iso(now + 14 * DAY) },
    busy: Array.from({ length: 14 }, (_, i) => {
      const day = start + i * DAY;
      const hour = [10, 14, 9, 16, 11, 15, 18][i % 7];
      return { start: iso(day + hour * 3_600_000 + (i % 3 === 0 ? 10 * 60_000 : 0)), end: iso(day + (hour + 1.5) * 3_600_000) };
    }),
  };
}
