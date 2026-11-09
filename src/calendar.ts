export const DAY = 86_400_000;
export const SLOT = 30 * 60_000;
const OFFSET = 8 * 3_600_000;
export interface Interval { start: number; end: number }
export interface Availability { updatedAt: number; range: Interval; busy: Interval[] }
export interface Segment extends Interval { kind: 'busy' | 'free' | 'past' | 'unknown' }

export function dayStart(time: number): number {
  return Math.floor((time + OFFSET) / DAY) * DAY - OFFSET;
}
export function weekStart(time: number): number {
  const day = dayStart(time);
  const weekday = new Date(day + OFFSET).getUTCDay();
  return day - ((weekday + 6) % 7) * DAY;
}
export function formatDate(time: number, full = false): string {
  const date = new Date(time + OFFSET);
  return `${full ? date.getUTCFullYear() + '.' : ''}${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}`;
}
export function formatTime(time: number): string {
  return new Date(time + OFFSET).toISOString().slice(11, 16);
}
function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Invalid timestamp');
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('Invalid timestamp');
  return result;
}
function interval(value: unknown): Interval {
  if (!value || typeof value !== 'object') throw new Error('Invalid interval');
  const item = value as Record<string, unknown>;
  const result = { start: timestamp(item.start), end: timestamp(item.end) };
  if (result.end <= result.start) throw new Error('Invalid range');
  return result;
}
export function parseAvailability(value: unknown): Availability {
  if (!value || typeof value !== 'object') throw new Error('Invalid response');
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.busy)) throw new Error('Missing busy array');
  return { updatedAt: timestamp(data.updatedAt), range: interval(data.range), busy: data.busy.map(interval) };
}
export function segments(day: number, now: number, data?: Availability): Segment[] {
  const start = day + 8 * 3_600_000;
  const end = day + 22 * 3_600_000;
  const result: Segment[] = [];
  // A started slot is unavailable; busy overlaps occupy the entire slot.
  // Only fully covered slots can be advertised as free.
  for (let a = start; a < end; a += SLOT) {
    const b = a + SLOT;
    const kind = a < now ? 'past' : !data || a < data.range.start || b > data.range.end ? 'unknown'
      : data.busy.some(x => x.start < b && x.end > a) ? 'busy' : 'free';
    const last = result.at(-1);
    if (last?.kind === kind) last.end = b;
    else result.push({ start: a, end: b, kind });
  }
  return result;
}
