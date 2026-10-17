import directory from '../src/data/archive-directory.json';
import { january4Stations, stationProvider } from '../src/data/stations.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assignNumber, isComplete, sanitizeBallot, validBallot } from '../src/domain/voting.ts';
import { stations } from '../src/data/stations.ts';
import { oneExitStation } from './fixtures/oneExitStation.ts';
import { demoPeriod, january4Period, april1Period, availableVotingPeriods } from '../src/data/schedule.ts';
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
    assert.deepEqual(stations.slice(0, 3).map(s => [s.id, s.gtfsStopId, s.exits.length]), [['438', '224', 6], ['143', 'A02', 6], ['522', 'S09', 4]]);
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


test('opening ballot includes exactly the scheduled nine stations and their access points', () => {
    assert.equal(stations.length, 9);
    assert.deepEqual(demoPeriod.stationIds, stations.map(station => station.id));
    assert.deepEqual(stations.slice(3).map(s => [s.id, s.exits.length]), [['180', 4], ['236', 6], ['265', 5], ['320', 4], ['368', 3], ['443', 2]]);
    assert.equal(stations.reduce((sum, station) => sum + station.exits.filter(exit => exit.type !== 'Elevator').length, 0), 37);
    assert.equal(stations.reduce((sum, station) => sum + station.exits.filter(exit => exit.type === 'Elevator').length, 0), 3);
});


test('January 4 ballot matches the Archive, validates all stations, and uses a separate draft identity', async () => {
    const expected = directory.rows.filter(row => row.votingDate === '2027-01-04');
    const ballotStations = stationProvider.getStations(january4Period.stationIds);
    assert.equal(ballotStations.length, 9);
    assert.deepEqual(ballotStations, january4Stations);
    assert.notEqual(january4Period.id, demoPeriod.id);
    assert.equal(availableVotingPeriods['2027-01-04'], january4Period);
    assert.equal(january4Period.startsAt.slice(0, 10), '2027-01-04');
    assert.equal(january4Period.endsAt.slice(0, 10), '2027-01-10');
    for (const row of expected) {
        const station = ballotStations.find(station => row.stationIds.includes(station.id))!;
        assert.ok(station, row.name);
        assert.deepEqual(station.services, row.regularServices);
        assert.equal(station.exits.filter(exit => exit.type !== 'Elevator').length, row.exits);
        assert.equal(station.exits.filter(exit => exit.type === 'Elevator').length, row.elevators);
        assert.equal(new Set(station.exits.map(exit => exit.id)).size, station.exits.length);
        assert.ok(station.exits.every(exit => exit.coordinates && Number.isFinite(exit.coordinates.latitude) && Number.isFinite(exit.coordinates.longitude)));
    }
    const ballot = Object.fromEntries(ballotStations.map(station => [station.id, Object.fromEntries(station.exits.map((exit, index) => [exit.id, index + 1]))]));
    assert.ok(validBallot(ballotStations, ballot));
    assert.equal(validBallot(ballotStations, { ...ballot, [ballotStations[8].id]: {} }), false);
    assert.ok(Object.values(sanitizeBallot(stations, ballot)).every(assignments => Object.keys(assignments).length === 0));
    await assert.rejects(submissionService.submit(january4Period, ballotStations, {}));
    assert.match((await submissionService.submit(january4Period, ballotStations, ballot)).receipt, /^DEMO-/);
});


test('April 1 special includes every scheduled one-exit station and complex', async () => {
    const expected = directory.rows.filter(row => row.votingDate === '2027-04-01');
    const selected = stationProvider.getStations(april1Period.stationIds);
    assert.equal(selected.length, 30);
    assert.equal(april1Period.startsAt.slice(0, 10), '2027-04-01');
    assert.equal(april1Period.endsAt.slice(0, 10), '2027-04-20');
    assert.equal(april1Period.specialEvent?.kind, 'april-fools');
    assert.equal(availableVotingPeriods['2027-04-01'], april1Period);
    assert.equal(new Set([demoPeriod.id, january4Period.id, april1Period.id]).size, 3);
    for (const row of expected) {
        const id = row.stationIds.length === 1 ? row.stationIds[0] : row.id;
        const station = selected.find(station => station.id === id)!;
        assert.ok(station, row.name);
        assert.equal(station.exits.length, 1);
        assert.deepEqual(station.services, row.regularServices);
        assert.ok(station.exits[0].coordinates);
        assert.equal(isComplete(station, {}), false);
        assert.equal(isComplete(station, assignNumber(station, {}, station.exits[0].id, 1)), true);
    }
    assert.ok(selected.some(station => station.id === 'complex-621'));
    const ballot = Object.fromEntries(selected.map(station => [station.id, { [station.exits[0].id]: 1 }]));
    assert.ok(validBallot(selected, ballot));
    assert.equal(validBallot(selected, { ...ballot, [selected[29].id]: {} }), false);
    await assert.rejects(submissionService.submit(april1Period, selected, {}));
    assert.match((await submissionService.submit(april1Period, selected, ballot)).receipt, /^DEMO-/);
});
