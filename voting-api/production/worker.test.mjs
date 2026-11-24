import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.mjs';
import manifest from './manifest.json' with { type: 'json' };
const host = 'https://mta-exit-voting.cloaks-chimps-6e.workers.dev';
test('production accepts once per browser/period, recovers retries, rejects closed and test ballots', async context => {
 let clock = '2027-01-02T12:00:00Z';
 context.mock.timers.enable({ apis: ['Date'], now: new Date(clock) });
 const db = new DatabaseSync(':memory:');
 context.after(() => db.close());
 db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
 // Use a deterministic database clock as well as a deterministic Worker clock.
 const wrap = (sql, args = []) => ({ bind: (...values) => wrap(sql, values),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => ({ meta: { changes: Number(db.prepare(sql.replaceAll("julianday('now')", `julianday('${clock}')`)).run(...args).changes) } }),
 });
 const env = { DB: { prepare: sql => wrap(sql) } };
 const period = manifest.periods['2027-01-01'];
 const payload = { periodId: period.id, browserId: crypto.randomUUID(), requestId: crypto.randomUUID(), ballot: Object.fromEntries(Object.entries(period.stations).map(([s, exits]) => [s, Object.fromEntries(exits.map((e, i) => [e, i + 1]))])) };
 const submit = body => worker.fetch(new Request(host + '/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
 assert.equal((await submit({ ...payload, periodId: 'test-opening-v1' })).status, 400);
 const first = await submit(payload); assert.equal(first.status, 201); const receipt = (await first.json()).receipt;
 assert.equal((await (await submit(payload)).json()).receipt, receipt);
 assert.equal((await submit({ ...payload, requestId: crypto.randomUUID() })).status, 409);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 1);
 const concurrent = { ...payload, browserId: crypto.randomUUID() };
 const raced = await Promise.all([submit(concurrent), submit(concurrent)]);
 assert.deepEqual(raced.map(r => r.status).sort(), [200,201]);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 2);
 assert.equal((await submit({...payload,browserId:[payload.browserId]})).status,400);
 assert.equal((await worker.fetch(new Request(host+'/periods',{headers:{Origin:'https://example.com'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request(host+'/votes',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(32769)}),env)).status,413);
 assert.equal((await worker.fetch(new Request(host+'/periods'),{DB:{prepare(){throw Error('offline');}}})).status,503);
 clock = '2027-01-04T00:00:00Z'; context.mock.timers.setTime(new Date(clock).getTime());
 assert.equal((await submit({ ...payload, browserId: crypto.randomUUID() })).status, 403);
 assert.equal((await (await submit(payload)).json()).receipt, receipt);
 const open = await (await worker.fetch(new Request(host + '/periods'), env)).json();
 assert.deepEqual(open.periods.map(p => p.id), ['2027-01-04']);
 db.exec('DELETE FROM environment_marker');
 assert.equal((await submit(payload)).status, 503);
});
