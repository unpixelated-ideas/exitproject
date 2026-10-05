import test from 'node:test';
import assert from 'node:assert/strict';
import { assignNumber, isComplete, sanitizeBallot, validBallot } from '../src/domain/voting.ts';
import { stations } from '../src/data/stations.ts';
import { oneExitStation } from './fixtures/oneExitStation.ts';
import { demoPeriod } from '../src/data/schedule.ts';
import { submissionService } from '../src/services/submission.ts';
import en from '../src/locales/en.json';
import ko from '../src/locales/ko.json';
test('duplicate and out-of-range numbers cannot be assigned; clearing frees a number', () => { const s = stations[0]; const [a, b] = s.exits; const first = assignNumber(s, {}, a.id, 2); assert.deepEqual(assignNumber(s, first, b.id, 2), first); for (const n of [0, s.exits.length + 1, 1.5, NaN])
    assert.deepEqual(assignNumber(s, first, b.id, n), first); const cleared = assignNumber(s, first, a.id); assert.deepEqual(assignNumber(s, cleared, b.id, 2), { [b.id]: 2 }); });
test('completion requires exactly one unique valid number per physical exit', () => { const s = stations[0]; const a = Object.fromEntries(s.exits.map((e, i) => [e.id, i + 1])); assert.equal(isComplete(s, a), true); assert.equal(isComplete(s, { ...a, unknown: 1 }), false); assert.equal(isComplete(s, { ...a, [s.exits[0].id]: 2 }), false); assert.equal(isComplete(s, {}), false); });
test('one-exit station follows normal rules', () => { const s = oneExitStation; assert.equal(isComplete(s, {}), false); assert.equal(isComplete(s, assignNumber(s, {}, s.exits[0].id, 1)), true); assert.deepEqual(assignNumber(s, {}, s.exits[0].id, 2), {}); });
test('corrupt stored drafts are safely normalized', () => { assert.deepEqual(sanitizeBallot(stations, null), {}); const s = stations[0]; const clean = sanitizeBallot(stations, { [s.id]: { [s.exits[0].id]: 1, [s.exits[1].id]: 1, unknown: 8 } }); assert.deepEqual(clean[s.id], { [s.exits[0].id]: 1 }); });
test('mock submission validates all stations before returning a receipt', async () => { await assert.rejects(submissionService.submit(demoPeriod, stations, {})); const ballot = Object.fromEntries(stations.map(s => [s.id, Object.fromEntries(s.exits.map((e, i) => [e.id, i + 1]))])); assert.ok(validBallot(stations, ballot)); assert.match((await submissionService.submit(demoPeriod, stations, ballot)).receipt, /^DEMO-/); });
test('English and Korean contain matching translation keys', () => { function keys(o: unknown, p = ''): string[] { return o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p]; } assert.deepEqual(keys(en).sort(), keys(ko).sort()); });
test('real stations expose complete coordinate data and dynamic ballot sizes', () => {
    assert.deepEqual(stations.map(s => [s.id, s.gtfsStopId, s.exits.length]), [['438', '224', 6], ['143', 'A02', 6], ['522', 'S09', 4]]);
    for (const station of stations) {
        assert.equal(new Set(station.exits.map(e => e.id)).size, station.exits.length);
        assert.ok(station.exits.every(e => e.coordinates && Number.isFinite(e.coordinates.latitude) && Number.isFinite(e.coordinates.longitude)));
        const complete = Object.fromEntries(station.exits.map((e, i) => [e.id, i + 1]));
        assert.equal(isComplete(station, complete), true);
        const reversed = { ...station, exits: [...station.exits].reverse() };
        assert.deepEqual(sanitizeBallot([reversed], { [station.id]: complete })[station.id], complete);
        assert.equal(isComplete(station, assignNumber(station, complete, station.exits[0].id)), false);
    }
});
