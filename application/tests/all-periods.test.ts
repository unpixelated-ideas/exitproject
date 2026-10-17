import test from 'node:test';
import assert from 'node:assert/strict';
import directory from '../src/data/archive-directory.json';
import { availableVotingPeriods, votingPeriodDates } from '../src/data/schedule.ts';
import { allScheduledStations, stationProvider } from '../src/data/stations.ts';
import { assignNumber, isComplete, validBallot } from '../src/domain/voting.ts';
import { submissionService } from '../src/services/submission.ts';
const identity = (row: typeof directory.rows[number]) => row.stationIds.length === 1 ? row.stationIds[0] : row.id;

test('all 54 ballots match the Archive and cover every station and entrance once', () => {
    assert.equal(votingPeriodDates.length, 54);
    assert.deepEqual(Object.keys(availableVotingPeriods).sort(), votingPeriodDates);
    assert.equal(new Set(Object.values(availableVotingPeriods).map(period => period.id)).size, 54);
    const seen: string[] = [];
    for (const date of votingPeriodDates) {
        const period = availableVotingPeriods[date];
        const expected = directory.rows.filter(row => row.votingDate === date);
        assert.deepEqual([...period.stationIds].sort(), expected.map(identity).sort(), date);
        const selected = stationProvider.getStations(period.stationIds);
        for (const row of expected) {
            const station = selected.find(station => station.id === identity(row))!;
            seen.push(station.id);
            assert.deepEqual(station.services, row.regularServices, row.name);
            assert.equal(station.exits.filter(exit => exit.type !== 'Elevator').length, row.exits, row.name);
            assert.equal(station.exits.filter(exit => exit.type === 'Elevator').length, row.elevators, row.name);
            for (const exit of station.exits) {
                assert.ok(exit.coordinates && exit.coordinates.latitude > 40 && exit.coordinates.latitude < 42);
                assert.ok(exit.coordinates.longitude > -75 && exit.coordinates.longitude < -73);
                assert.ok(exit.description.en.length && exit.description.ko.length);
            }
        }
        const complete = Object.fromEntries(selected.map(station => [station.id, Object.fromEntries(station.exits.map((exit, index) => [exit.id, index + 1]))]));
        assert.ok(validBallot(selected, complete), date);
        assert.equal(validBallot(selected, { ...complete, [selected.at(-1)!.id]: {} }), false, date);
    }
    assert.equal(seen.length, 444);
    assert.equal(new Set(seen).size, 444);
    assert.equal(allScheduledStations.length, 444);
    const exits = allScheduledStations.flatMap(station => station.exits);
    assert.equal(exits.length, 2120);
    assert.equal(new Set(exits.map(exit => exit.id)).size, 2120);
    assert.equal(exits.filter(exit => exit.type !== 'Elevator').length, 2018);
    assert.equal(exits.filter(exit => exit.type === 'Elevator').length, 102);
});

test('period ranges preserve the extended April special and year-end cutoff', () => {
    for (const date of votingPeriodDates) {
        const period = availableVotingPeriods[date];
        assert.equal(period.startsAt.slice(0, 10), date);
        const duration = new Date(period.endsAt).getTime() - new Date(period.startsAt).getTime() + 1000;
        assert.equal(duration, (date === '2027-01-01' ? 3 : date === '2027-04-01' ? 20 : date === '2027-12-27' ? 5 : 7) * 86400000, date);
    }
    assert.equal(availableVotingPeriods['2027-12-27'].endsAt.slice(0, 10), '2027-12-31');
});

test('largest complex supports labels beyond Z, every number, and simulated submission', async () => {
    const period = availableVotingPeriods['2027-12-27'];
    const selected = stationProvider.getStations(period.stationIds);
    assert.equal(selected.length, 1);
    const station = selected[0];
    assert.equal(station.id, 'complex-611');
    assert.ok(station.exits.length >= 40);
    assert.match(station.exits[26].description.en, / · AA$/);
    assert.match(station.exits[39].description.en, / · AN$/);
    let assigned = {};
    for (let index = 0; index < station.exits.length; index++) assigned = assignNumber(station, assigned, station.exits[index].id, index + 1);
    assert.ok(isComplete(station, assigned));
    const ballot = { [station.id]: assigned };
    assert.ok(validBallot(selected, ballot));
    assert.match((await submissionService.submit(period, selected, ballot)).receipt, /^DEMO-/);
});
