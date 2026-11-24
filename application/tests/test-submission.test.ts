import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestSubmissionService, isLocalTestMode } from '../src/services/testSubmission.ts';
import { demoPeriod } from '../src/data/schedule.ts';
import { stations as source } from '../src/data/stations.ts';
const stations = source.map(s => ({ ...s, exits: s.exits.filter(e => e.type !== 'Elevator') }));
const period = { ...demoPeriod, id: 'test-opening-v1' };
const ballot = Object.fromEntries(stations.map(s => [s.id, Object.fromEntries(s.exits.map((e, i) => [e.id, i + 1]))]));
test('test mode requires explicit localhost development opt-in', () => {
 assert.equal(isLocalTestMode(true, 'http://127.0.0.1:5173/?testVoting=1#/'), true);
 for (const [dev, url] of [[false,'http://localhost:5173/?testVoting=1'],[true,'http://localhost:5173/'],[true,'https://unpixelated-ideas.github.io/?testVoting=1'],[true,'http://localhost:5174/?testVoting=1']] as const) assert.equal(isLocalTestMode(dev, url), false);
});
test('lost responses and reloads reuse IDs; changed ballots use new IDs', async () => {
 const saved = new Map(); const requests: Record<string, unknown>[] = [];
 const persistence = { read: (key: string) => saved.get(key), write: (key: string, value: unknown) => { saved.set(key, structuredClone(value)); } };
 let fail = true;
 const fetcher = (async (url, options) => {
  assert.equal(url, 'https://mta-exit-voting-test.cloaks-chimps-6e.workers.dev/votes');
  requests.push(JSON.parse(String(options?.body)));
  if (fail) { fail = false; throw new Error('Lost response'); }
  return Response.json({ environment: 'test', receipt: 'TEST-12345678-1234-1234-1234-123456789012' });
 }) as typeof fetch;
 await assert.rejects(createTestSubmissionService(fetcher, persistence).submit(period, stations, ballot));
 const service = createTestSubmissionService(fetcher, persistence);
 await service.submit(period, stations, ballot);
 assert.equal(requests[0].requestId, requests[1].requestId);
 const changed = structuredClone(ballot); const id = stations[0].id; const [a,b] = stations[0].exits;
 [changed[id][a.id], changed[id][b.id]] = [2,1];
 await service.submit(period, stations, changed);
 assert.notEqual(requests[1].requestId, requests[2].requestId);
 await assert.rejects(service.submit(demoPeriod, stations, ballot));
 await assert.rejects(service.submit(period, stations, {}));
 assert.equal(requests.length, 3);
});
test('HTTP errors and non-test responses never produce success', async () => {
 for (const response of [new Response('', { status: 503 }), Response.json({ environment: 'production', receipt: 'TEST-12345678-1234-1234-1234-123456789012' }), Response.json({ environment: 'test', receipt: 'bad' })]) {
  await assert.rejects(createTestSubmissionService((async () => response) as typeof fetch, { read: () => null, write: () => {} }).submit(period, stations, ballot));
 }
});
