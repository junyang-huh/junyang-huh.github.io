const STORAGE_KEY = 'availability:cooldown-until';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

export class RequestCooldown {
  private until = 0;
  private storage: StorageAccess;
  private now: () => number;

  constructor(storage: StorageAccess = () => sessionStorage, now = Date.now) {
    this.storage = storage;
    this.now = now;
    try {
      const saved = Number(storage().getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved > now()) this.until = saved;
    } catch { /* Storage may be blocked; retain in-memory protection. */ }
  }

  get seconds(): number { return Math.max(0, Math.ceil((this.until - this.now()) / 1000)); }

  start(loading: boolean): boolean {
    if (loading || this.seconds > 0) return false;
    this.extend(this.now() + 10_000);
    return true;
  }

  extend(until: number): void {
    if (!Number.isFinite(until)) return;
    this.until = Math.max(this.until, until);
    try { this.storage().setItem(STORAGE_KEY, String(this.until)); }
    catch { /* The current page still enforces its in-memory deadline. */ }
  }
}

export function retryDeadline(value: string | null, now = Date.now()): number {
  const text = value?.trim() ?? '';
  const until = /^\d+$/.test(text) ? now + Number(text) * 1000
    : /[a-z]/i.test(text) ? Date.parse(text) : NaN;
  return Number.isFinite(until) && until > now ? until : now + 60_000;
}
