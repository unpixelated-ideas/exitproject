import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionSubmission, openProductionPeriods } from '../src/services/productionVoting.ts';
import { availableVotingPeriods } from '../src/data/schedule.ts';
import { stationProvider } from '../src/data/stations.ts';
const period = { ...availableVotingPeriods['2027-01-01'], id: '2027-01-01', mock: false };
const stations = stationProvider.getStations(period.stationIds).map(s => ({...s, exits: s.exits.filter(e => e.type !== 'Elevator')}));
const ballot = Object.fromEntries(stations.map(s => [s.id, Object.fromEntries(s.exits.map((e,i) => [e.id,i+1]))]));
const receipt = 'VOTE-12345678-1234-4123-8123-123456789012';
test('real voting persists browser identity and retries, isolated from test storage', async () => {
 const saved = new Map<string, unknown>(); const requests: Record<string, unknown>[] = [];
 const persistence = {read: (k:string) => saved.get(k), write: (k:string,v:unknown) => {saved.set(k,v);}};
 let lost = true;
 const fetcher = (async (url, options) => {
  assert.equal(url, 'https://mta-exit-voting.cloaks-chimps-6e.workers.dev/votes');
  requests.push(JSON.parse(String(options?.body)));
  if (lost) {lost=false; throw Error('lost response');}
  return Response.json({environment:'production',receipt});
 }) as typeof fetch;
 await assert.rejects(createProductionSubmission(fetcher,persistence).submit(period,stations,ballot));
 await createProductionSubmission(fetcher,persistence).submit(period,stations,ballot);
 assert.deepEqual(requests[0],requests[1]);
 assert.equal(saved.get('production:receipt:2027-01-01'),receipt);
 assert.ok([...saved.keys()].every(k => k.startsWith('production:')));
 await assert.rejects(createProductionSubmission(fetcher,persistence).submit({...period,mock:true},stations,ballot));
 await assert.rejects(createProductionSubmission(fetcher,{read:()=>null,write:()=>{}}).submit(period,stations,ballot), /storage/);
 assert.equal(requests.length,2);
});
test('production errors and test receipts never appear as real success', async () => {
 for (const [body,status,code] of [[{error:'already_voted'},409,'already'],[{error:'period_closed'},403,'closed'],[{environment:'test',receipt},200,'unavailable']] as const) {
 const saved = new Map();
 const service = createProductionSubmission((async()=>Response.json(body,{status})) as typeof fetch,{read:k=>saved.get(k),write:(k,v)=>{saved.set(k,v);}});
 await assert.rejects(service.submit(period,stations,ballot),new RegExp(code));
 assert.equal(saved.has('production:receipt:2027-01-01'),false);
 }
});
test('server time controls open periods and deadline, including April overlap', async () => {
 const response = (ids:string[],serverNow:string) => ({environment:'production',serverNow,periods:ids.map(id => {const p=availableVotingPeriods[id];return {id,startsAt:p.startsAt,closesAt:new Date(Date.parse(p.endsAt)+1000).toISOString(),stationIds:p.stationIds};})});
 const fetcher = (body:unknown) => (async()=>Response.json(body)) as typeof fetch;
 const open = await openProductionPeriods(undefined,fetcher(response(['2027-01-01'],'2027-01-02T00:00:00Z')));
 assert.equal(open.periods[0].mock,false); assert.equal(open.validFor,172800000);
 const ending = await openProductionPeriods(undefined,fetcher(response(['2027-01-01'],'2027-01-03T23:59:59Z')));
 assert.equal(ending.validFor,1000);
 await assert.rejects(openProductionPeriods(undefined,fetcher(response(['2027-01-01'],'2027-01-04T00:00:00Z'))));
 await assert.rejects(openProductionPeriods(undefined,fetcher(response(['2027-01-01'],'2026-12-31T23:59:59Z'))));
 assert.equal((await openProductionPeriods(undefined,fetcher(response(['2027-03-29','2027-04-01'],'2027-04-01T12:00:00Z')))).periods.length,2);
 assert.equal((await openProductionPeriods(undefined,fetcher(response([],'2026-11-23T00:00:00Z')))).periods.length,0);
});
