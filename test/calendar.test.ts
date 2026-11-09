import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, dayStart, weekStart, formatDate, formatTime, parseAvailability, segments } from '../src/calendar.ts';
import { refresh, requestData } from '../src/data.ts';
const t = Date.parse;
const payload = { updatedAt:'2026-11-09T00:00:00Z',range:{ start:'2026-11-09T00:00:00Z',end:'2026-11-23T00:00:00Z' },busy:[] };
test('Shanghai day and Monday boundaries, including year/month rollover', () => {
  assert.equal(formatDate(dayStart(t('2026-11-08T16:01:00Z')), true), '2026.11.09');
  assert.equal(formatDate(weekStart(t('2026-11-08T15:59:00Z'))), '11.02');
  assert.equal(formatDate(weekStart(t('2026-11-08T16:00:00Z'))), '11.09');
  assert.equal(formatDate(weekStart(t('2027-01-01T00:00:00Z')),true),'2026.12.28');
  assert.equal(formatTime(t('2026-11-09T01:10:00Z')), '09:10');
});
test('empty busy is free only within range and after now', () => {
  const day = dayStart(t(payload.updatedAt));
  const data = parseAvailability(payload);
  const result = segments(day, day + 10 * 3600000, data);
  assert.deepEqual(result.map(x => x.kind), ['past','free']);
  assert.deepEqual(segments(day + 20 * DAY, day, data).map(x => x.kind), ['unknown']);
  assert.deepEqual(segments(day, day).map(x => x.kind), ['unknown']);
});
test('busy clipping, overlap, cross-midnight and outward half-hour rounding', () => {
  const day = dayStart(t(payload.updatedAt));
  const data = parseAvailability({...payload,busy:[
    {start:'2026-11-08T23:00:00Z',end:'2026-11-09T01:10:00Z'},
    {start:'2026-11-09T01:00:00Z',end:'2026-11-09T01:50:00Z'},
    {start:'2026-11-09T13:30:00Z',end:'2026-11-10T01:00:00Z'},
  ]});
  const busy = segments(day,day,data).filter(x=>x.kind==='busy');
  assert.deepEqual(busy.map(x=>[formatTime(x.start),formatTime(x.end)]),[['08:00','10:00'],['21:30','22:00']]);
  assert.equal(formatTime(segments(day+DAY,day,data)[0].end),'09:00');
});
test('current partial slot is past; exact boundaries do not consume next slot', () => {
  const day = dayStart(t(payload.updatedAt));
  const data = parseAvailability(payload);
  assert.equal(formatTime(segments(day,day+9*3600000+1,data)[0].end),'09:30');
  assert.equal(formatTime(segments(day,day+9*3600000,data)[0].end),'09:00');
});
test('short events occupy a full slot and incomplete coverage stays unknown', () => {
  const day = dayStart(t(payload.updatedAt));
  const data = parseAvailability({...payload,range:{start:'2026-11-09T00:10:00Z',end:'2026-11-09T13:50:00Z'},busy:[{start:'2026-11-09T01:10:00Z',end:'2026-11-09T01:11:00Z'}]});
  const result = segments(day,day,data);
  assert.equal(formatTime(result[0].end),'08:30');
  const busy = result.find(x=>x.kind==='busy')!;
  assert.deepEqual([formatTime(busy.start),formatTime(busy.end)],['09:00','09:30']);
  assert.equal(formatTime(result.at(-1)!.start),'21:30');
});
test('partial range remains unknown, past wins over busy', () => {
  const day = dayStart(t(payload.updatedAt));
  const data = parseAvailability({...payload,range:{ start:'2026-11-09T02:00:00Z',end:'2026-11-09T04:00:00Z' }});
  assert.deepEqual(segments(day,day+9*3600000,data).map(x=>x.kind),['past','unknown','free','unknown']);
});
test('malformed payloads cannot become free time', () => {
  for (const bad of [null, {}, {...payload,busy:null}, {...payload,updatedAt:'bad'}, {...payload,range:{start:'2026-11-09',end:'2026-11-10'}}, {...payload,busy:[{start:payload.range.end,end:payload.range.start}]}]) {
    assert.throws(()=>parseAvailability(bad));
  }
});
test('failed refresh keeps previous data; initial failure has no data', async () => {
  const data = parseAvailability(payload);
  const failed = await refresh({data,loading:true,error:false},async()=>{throw new Error('offline')});
  assert.equal(failed.data,data); assert.equal(failed.error,true); assert.equal(failed.loading,false);
  const invalid = await refresh({loading:true,error:false},async()=>({}));
  assert.equal(invalid.data,undefined); assert.equal(invalid.error,true);
  assert.equal((await refresh(failed,async()=>payload)).error,false);
});
test('HTTP failure is rejected even when body looks valid', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async()=>new Response(JSON.stringify(payload),{status:503});
  try { await assert.rejects(requestData('https://example.test/availability'), /HTTP 503/); }
  finally { globalThis.fetch=original; }
});
