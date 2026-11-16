import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestCooldown, retryDeadline } from '../src/cooldown.ts';
import { RateLimitError, refresh, requestData } from '../src/data.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}

test('requests wait ten seconds, preserve loading guard, and resume only when called', () => {
  let now = 100_000;
  const cooldown = new RequestCooldown(memoryStorage, () => now);
  assert.equal(cooldown.start(false), true);
  assert.equal(cooldown.seconds, 10);
  now += 9_999;
  assert.equal(cooldown.seconds, 1);
  assert.equal(cooldown.start(false), false);
  now++;
  assert.equal(cooldown.seconds, 0);
  assert.equal(cooldown.start(true), false);
  assert.equal(cooldown.start(false), true);
});

test('session deadline survives reload and expired deadlines do not block', () => {
  let now = 100_000;
  const storage = memoryStorage();
  const first = new RequestCooldown(() => storage, () => now);
  first.start(false);
  now += 3000;
  const restored = new RequestCooldown(() => storage, () => now);
  assert.equal(restored.seconds, 7);
  assert.equal(restored.start(false), false);
  now += 7000;
  assert.equal(new RequestCooldown(() => storage, () => now).start(false), true);
});

test('blocked storage getter or writes retain in-memory cooldown', () => {
  for (const storage of [
    () => { throw new Error('blocked'); },
    () => ({ getItem: () => 'invalid', setItem: () => { throw new Error('quota'); } }),
  ]) {
    const cooldown = new RequestCooldown(storage, () => 100_000);
    assert.equal(cooldown.start(false), true);
    assert.equal(cooldown.start(false), false);
    assert.equal(cooldown.seconds, 10);
  }
});

test('Retry-After accepts seconds and HTTP dates, otherwise defaults to sixty seconds', () => {
  const now = Date.parse('2026-11-16T00:00:00Z');
  assert.equal(retryDeadline('120', now), now + 120_000);
  assert.equal(retryDeadline('Mon, 16 Nov 2026 00:02:00 GMT', now), now + 120_000);
  for (const value of [null, '', 'bad', '-1', '0', '1.5', 'Infinity', '9'.repeat(400), 'Sun, 15 Nov 2026 00:00:00 GMT']) {
    assert.equal(retryDeadline(value, now), now + 60_000);
  }
});

test('failure preserves cooldown; rate limits retain old data and extend without shortening', async () => {
  const now = 100_000;
  const cooldown = new RequestCooldown(memoryStorage, () => now);
  cooldown.start(false);
  const failed = await refresh({ loading: true, error: false }, async () => { throw new Error('offline'); });
  assert.equal(failed.error, true);
  assert.equal(cooldown.start(false), false);
  const data = { updatedAt: now, range: { start: now, end: now + 1000 }, busy: [] };
  const limited = await refresh({ data, loading: true, error: false }, async () => { throw new RateLimitError(now + 60_000); });
  assert.equal(limited.data, data);
  assert.equal(limited.error, true);
  assert.equal(limited.loading, false);
  cooldown.extend(limited.retryAt!);
  assert.equal(cooldown.seconds, 60);
  cooldown.extend(now + 1000);
  assert.equal(cooldown.seconds, 60);
});

test('HTTP 429 exposes a typed retry deadline even without a readable Retry-After header', async () => {
  const original = globalThis.fetch;
  try {
    for (const seconds of [undefined, '120']) {
      globalThis.fetch = async () => new Response('', { status: 429,
        headers: seconds ? { 'Retry-After': seconds } : {} });
      const before = Date.now();
      await assert.rejects(requestData('https://example.test/availability'), (error: unknown) => {
        assert.ok(error instanceof RateLimitError);
        const delay = seconds ? 120_000 : 60_000;
        assert.ok(error.retryAt >= before + delay && error.retryAt <= Date.now() + delay);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});
