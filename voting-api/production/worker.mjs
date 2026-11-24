import manifest from './manifest.json' with { type: 'json' };
import { isPeriodOpen, validateBallot } from './validation.mjs';
const HOST = 'mta-exit-voting.cloaks-chimps-6e.workers.dev';
const ORIGIN = 'https://unpixelated-ideas.github.io';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(status, body) {
 return new Response(JSON.stringify({ environment: 'production', ...body }), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': ORIGIN, 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff',
 } });
}
async function readJSON(request) {
 if (!request.body) throw new Error('body');
 const reader = request.body.getReader(); const chunks = []; let length = 0;
 while (true) {
  const { done, value } = await reader.read(); if (done) break;
  length += value.length;
  if (length > 32768) { await reader.cancel(); throw new Error('size'); }
  chunks.push(value);
 }
 const bytes = new Uint8Array(length); let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== HOST) return reply(503, { error: 'production_host_required' });
  if (request.headers.has('Origin') && request.headers.get('Origin') !== ORIGIN) return reply(403, { error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
   'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin',
  } });
  try {
   const marker = await env.DB.prepare('SELECT environment FROM environment_marker WHERE id=1').first();
   if (marker?.environment !== 'production') return reply(503, { error: 'production_database_required' });
   const now = Date.now();
   if (url.pathname === '/periods' && request.method === 'GET') return reply(200, {
    timeZone: manifest.timeZone, serverNow: new Date(now).toISOString(),
    periods: Object.values(manifest.periods).filter(p => isPeriodOpen(p, now)).map(({ id, startsAt, closesAt, stations }) => ({ id, startsAt, closesAt, stationIds: Object.keys(stations) })),
   });
   if (url.pathname === '/health' && request.method === 'GET') {
    await env.DB.prepare('SELECT receipt FROM submissions LIMIT 1').first();
    return reply(200, { status: 'ready' });
   }
   if (url.pathname !== '/votes') return reply(404, { error: 'not_found' });
   if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
   if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return reply(415, { error: 'json_required' });
   let payload;
   try { payload = await readJSON(request); } catch (error) { return reply(error.message === 'size' ? 413 : 400, { error: 'invalid_body' }); }
   if (!payload || typeof payload.browserId !== 'string' || typeof payload.requestId !== 'string' || typeof payload.periodId !== 'string' || !uuid.test(payload.browserId ?? '') || !uuid.test(payload.requestId ?? '') || !Object.hasOwn(manifest.periods, payload.periodId ?? '')) return reply(400, { error: 'invalid_request' });
   const period = manifest.periods[payload.periodId];
   if (!validateBallot(period, payload.ballot)) return reply(400, { error: 'invalid_ballot' });
   const canonical = JSON.stringify(Object.fromEntries(Object.entries(period.stations).map(([station, exits]) => [station, Object.fromEntries(exits.map(exit => [exit, payload.ballot[station][exit]]))])));
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${period.id}:${payload.browserId}`));
   const browserHash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
   const lookup = () => env.DB.prepare('SELECT receipt, request_id, ballot_json FROM submissions WHERE period_id=? AND browser_hash=?').bind(period.id, browserHash).first();
   const existing = await lookup();
   const respondExisting = saved => saved.request_id === payload.requestId && saved.ballot_json === canonical
    ? reply(200, { receipt: saved.receipt, replayed: true }) : reply(409, { error: 'already_voted' });
   // An identical retry may recover an accepted receipt after closing, but never writes.
   if (existing) return respondExisting(existing);
   if (!isPeriodOpen(period, Date.now())) return reply(403, { error: 'period_closed' });
   const receipt = `VOTE-${crypto.randomUUID()}`;
   // Enforce uniqueness and the time window atomically at insertion, including races.
   const result = await env.DB.prepare("INSERT INTO submissions (receipt,period_id,browser_hash,request_id,ballot_json,submitted_at) SELECT ?,?,?,?,?,? WHERE julianday('now') >= julianday(?) AND julianday('now') < julianday(?) ON CONFLICT(period_id,browser_hash) DO NOTHING")
    .bind(receipt, period.id, browserHash, payload.requestId, canonical, new Date().toISOString(), period.startsAt, period.closesAt).run();
   const saved = await lookup();
   if (!saved) return reply(403, { error: 'period_closed' });
   return result.meta.changes ? reply(201, { receipt: saved.receipt, replayed: false }) : respondExisting(saved);
  } catch { return reply(503, { error: 'database_unavailable' }); }
 },
};
