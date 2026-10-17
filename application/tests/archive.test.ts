import test from 'node:test';
import assert from 'node:assert/strict';
import directory from '../src/data/archive-directory.json';
import schedule from '../src/data/voting-schedule.json';
import { buildVotingPlan } from '../src/domain/planner.ts';
import inventory from './fixtures/archive/mta-stations.json';
import reconciliation from './fixtures/archive/reconciliation.json';
import { archiveColumns, groupArchiveServices, matchesArchiveSearch, sortArchiveRows, type ArchiveRow } from '../src/domain/archive.ts';

const rows: ArchiveRow[] = directory.rows;
const find = (id: string) => rows.find(row => row.id === `complex-${id}`)!;

test('every official station and platform appears exactly once, including all operating SIR stations', () => {
  const expected = [...new Set(inventory.map(station => station.station_id))].sort();
  const actual = rows.flatMap(row => row.stationIds);
  assert.equal(actual.length, 493);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(actual.sort(), expected);
  assert.equal(rows.filter(row => row.borough === 'SI').length, 21);
  assert.deepEqual(rows.flatMap(row => row.members.flatMap(member => member.gtfsStopIds)).sort(), inventory.map(station => station.gtfs_stop_id).sort());
  assert.equal(rows.length, 444);
});

test('Times Square combines all seven constituents and preserves both source complex IDs', () => {
  const row = find('611');
  assert.deepEqual(row.complexIds, ['609', '611']);
  assert.deepEqual(row.stationIds, ['11', '163', '226', '317', '466', '467', '468']);
  assert.equal(row.members.length, 7);
  assert.equal(rows.some(row => row.id === 'complex-609'), false);
  assert.ok(row.regularServices.includes('7') && row.regularServices.includes('S'));
  assert.notEqual(find('613').id, find('223').id);
});

test('entrance totals include entry-only access and exclude elevators from exits', () => {
  assert.equal(rows.reduce((total, row) => total + (row.exits ?? 0), 0), 2018);
  assert.equal(rows.reduce((total, row) => total + (row.elevators ?? 0), 0), 102);
  assert.equal(reconciliation.entryOnlyNonElevatorsIncluded, 7);
  assert.equal(reconciliation.entranceCorrections.length, 12);
  assert.equal(reconciliation.duplicateEntranceRecords, 0);
  assert.ok(rows.every(row => row.exits !== null && row.exits >= 0 && row.elevators !== null && row.elevators >= 0));
});

test('night additions are computed after grouping, excluding regular weekends and planned service', () => {
  assert.deepEqual(find('157').regularServices, ['B', 'C']);
  assert.deepEqual(find('157').nightServices, ['A']);
  assert.deepEqual(find('157').plannedServices, []);
  assert.ok(find('13').regularServices.includes('N'));
  assert.deepEqual(find('13').nightServices, ['Q']);
  assert.ok(find('221').regularServices.includes('F'));
  assert.equal(find('221').nightServices.includes('F'), false);
  assert.deepEqual(find('475').plannedServices, ['T']);
  assert.deepEqual(find('610').plannedServices, ['T']);
  assert.ok(rows.every(row => row.nightServices.every(service => !row.regularServices.includes(service) && service !== 'T')));
  assert.ok(rows.every(row => !row.regularServices.includes('T')));
});

test('search finds constituents, natural street spellings, IDs and route labels', () => {
  assert.equal(matchesArchiveSearch(find('611'), 'Bryant Park'), true);
  assert.equal(matchesArchiveSearch(find('611'), 'Fifth Avenue'), true);
  assert.equal(matchesArchiveSearch(find('611'), '467'), true);
  assert.equal(matchesArchiveSearch(find('611'), '725'), true);
  assert.equal(matchesArchiveSearch(find('157'), '96th Street'), true);
  assert.equal(matchesArchiveSearch(find('96'), '96th Street'), false);
  assert.equal(matchesArchiveSearch(find('96'), '96'), true);
  assert.equal(matchesArchiveSearch(find('157'), 'A'), true);
  assert.equal(matchesArchiveSearch(find('157'), 'T'), false);
  assert.equal(matchesArchiveSearch(find('475'), 'T'), true);
  assert.equal(matchesArchiveSearch(find('517'), 'Princes Bay'), true);
  assert.equal(matchesArchiveSearch(find('611'), 'not-a-real-station'), false);
  assert.equal(matchesArchiveSearch(find('611'), '   '), true);
});

test('numeric sorting keeps unknowns last in both directions and breaks count ties by name', () => {
  const base = find('157');
  const fixture: ArchiveRow[] = [
    { ...base, id: 'a', name: '10 St', exits: 10, elevators: 10 },
    { ...base, id: 'b', name: '2 St', exits: 2, elevators: 2 },
    { ...base, id: 'c', name: '3 St', exits: 2, elevators: 2 },
    { ...base, id: 'd', name: 'Unknown', exits: null, elevators: null },
    { ...base, id: 'e', name: 'Zero', exits: 0, elevators: 0 },
  ];
  for (const key of ['exits', 'elevators'] as const) {
    assert.deepEqual(sortArchiveRows(fixture, key, 'ascending').map(row => row.id), ['e', 'b', 'c', 'a', 'd']);
    assert.deepEqual(sortArchiveRows(fixture, key, 'descending').map(row => row.id), ['a', 'b', 'c', 'e', 'd']);
  }
  assert.deepEqual(sortArchiveRows(fixture, 'name', 'ascending').slice(0, 3).map(row => row.name), ['2 St', '3 St', '10 St']);
  assert.deepEqual(fixture.map(row => row.id), ['a', 'b', 'c', 'd', 'e']);
});

test('all sortable columns preserve all rows and ID sorting is numeric', () => {
  for (const column of archiveColumns) {
    for (const direction of ['ascending', 'descending'] as const) {
      const result = sortArchiveRows(rows, column, direction);
      assert.equal(result.length, rows.length);
      assert.equal(new Set(result.map(row => row.id)).size, rows.length);
    }
  }
  const small = [find('13'), find('2'), find('100')];
  assert.deepEqual(sortArchiveRows(small, 'ids', 'ascending').map(row => row.complexIds[0]), ['2', '13', '100']);
  assert.deepEqual(sortArchiveRows(small, 'ids', 'descending').map(row => row.complexIds[0]), ['100', '13', '2']);
  assert.equal(sortArchiveRows(rows, 'nightServices', 'descending').at(-1)!.nightServices.length, 0);
});

// These expected counts exercise corrected station attribution independently of totals.
test('reviewed identifier corrections put entrances on the right stations', () => {
  for (const [id, exits, elevators] of [['283', 5, 1], ['515', 4, 0], ['517', 3, 0], ['456', 7, 2], ['602', 12, 0], ['607', 15, 1]] as const) {
    assert.deepEqual([find(id).exits, find(id).elevators], [exits, elevators]);
  }
  assert.deepEqual(find('515').members[0].gtfsStopIds, ['S17']);
  assert.deepEqual(reconciliation.withinComplexLineDiscrepancies.map(row => row.csvLine), [888, 889]);
});

test('service bullets retain color families regardless of input order', () => {
  assert.deepEqual(groupArchiveServices(['A', 'B', 'C', 'D', 'E', 'F', 'M', 'N', 'Q', 'R', 'W', 'S', '1', '2', '3', '7']),
    [['1', '2', '3'], ['7'], ['A', 'C', 'E'], ['B', 'D', 'F', 'M'], ['N', 'Q', 'R', 'W'], ['S']]);

});

test('voting dates preserve opening day, April special, and assigned complexes', () => {
  const assigned: Record<string, string> = {"complex-328": "2027-09-13", "complex-107": "2027-10-25", "complex-162": "2027-11-08", "complex-403": "2027-11-22", "complex-333": "2027-12-06", "complex-464": "2027-12-20", "complex-405": "2027-04-19", "complex-165": "2027-05-03", "complex-413": "2027-06-07", "complex-618": "2027-06-28", "complex-22": "2027-07-12", "complex-629": "2027-07-26", "complex-176": "2027-08-09", "complex-616": "2027-08-30", "complex-606": "2027-09-27", "complex-622": "2027-10-11", "complex-623": "2027-11-01", "complex-613": "2027-05-17", "complex-619": "2027-03-01", "complex-602": "2027-03-22", "complex-620": "2027-05-24", "complex-225": "2027-10-04", "complex-254": "2027-05-10", "complex-604": "2027-06-14", "complex-607": "2027-08-16", "complex-447": "2027-02-15", "complex-74": "2027-01-11", "complex-455": "2027-01-11", "complex-6": "2027-02-01", "complex-85": "2027-02-01", "complex-84": "2027-03-08", "complex-395": "2027-03-08", "complex-81": "2027-04-12", "complex-301": "2027-04-12", "complex-145": "2027-09-13", "complex-300": "2027-09-13", "complex-41": "2027-01-18", "complex-268": "2027-01-18", "complex-37": "2027-02-08", "complex-191": "2027-02-08", "complex-441": "2027-03-15", "complex-385": "2027-03-15", "complex-418": "2027-04-26", "complex-91": "2027-04-26", "complex-357": "2027-06-21", "complex-114": "2027-06-21", "complex-334": "2027-07-19", "complex-137": "2027-07-19", "complex-627": "2027-08-23", "complex-508": "2027-08-23", "complex-352": "2027-09-20", "complex-518": "2027-09-20", "complex-503": "2027-10-18", "complex-364": "2027-10-18", "complex-461": "2027-11-15", "complex-42": "2027-11-15", "complex-475": "2027-12-13", "complex-449": "2027-12-13", "complex-71": "2027-01-04", "complex-471": "2027-01-04", "complex-611": "2027-12-27", "complex-624": "2027-11-29", "complex-628": "2027-07-05", "complex-610": "2027-03-29", "complex-612": "2027-02-22", "complex-601": "2027-08-02", "complex-636": "2027-05-31", "complex-614": "2027-04-05", "complex-164": "2027-09-06", "complex-318": "2027-01-25"};
  for (const [id, date] of Object.entries(assigned)) assert.equal(rows.find(row => row.id === id)!.votingDate, date);
  assert.ok(rows.some(row => row.exits === 1));
  for (const row of rows) assert.equal(row.votingDate, assigned[row.id] ?? (['complex-143', 'complex-438', 'complex-522'].includes(row.id) ? '2027-01-01' : row.exits === 1 ? '2027-04-01' : schedule.generatedAssignments[row.id as keyof typeof schedule.generatedAssignments]));
  for (const direction of ['ascending', 'descending'] as const) {
    const sorted = sortArchiveRows([...rows, { ...rows[0], id: 'undated-fixture', votingDate: null }], 'votingDate', direction);
    const firstUndated = sorted.findIndex(row => row.votingDate === null);
    assert.ok(sorted.slice(0, firstUndated).every(row => row.votingDate !== null));
    assert.ok(sorted.slice(firstUndated).every(row => row.votingDate === null));
  }
});


test('completed plan preserves fixed assignments and balances every regular date', () => {
  for (const [id, date] of Object.entries(schedule.manualAssignments)) {
    assert.equal(rows.find(row => row.id === id)!.votingDate, date);
    assert.equal(id in schedule.generatedAssignments, false);
  }
  assert.equal(Object.keys(schedule.manualAssignments).length, 103);
  assert.equal(Object.keys(schedule.generatedAssignments).length, 341);
  const plan = buildVotingPlan(rows);
  assert.equal(plan.reduce((sum, day) => sum + day.stations.length, 0), rows.length);
  assert.equal(plan.reduce((sum, day) => sum + day.exits, 0), 2018);
  for (const day of plan) {
    const exceptions: Record<string, number> = { '2027-04-01': 30, '2027-12-27': 40 };
    if (day.date in exceptions) assert.equal(day.exits, exceptions[day.date], day.date);
    else assert.ok(day.exits === 37 || day.exits === 38, day.date);
    if (day.date !== '2027-12-27') assert.ok(day.exits < 40, day.date);
    if (day.date === '2027-11-29') assert.ok(day.exits <= 39);
    if (day.date !== '2027-04-01' && day.date !== '2027-12-27') {
      assert.ok(new Set(day.stations.map(row => row.borough)).size >= 3, day.date);
    }
  }
  assert.equal(plan.filter(day => day.exits === 37).length, 28);
  assert.equal(plan.filter(day => day.exits === 38).length, 24);
  assert.equal(plan.find(day => day.date === '2027-04-01')!.stations.length, 30);
  for (const date of ['2027-12-27']) {
    assert.equal(plan.find(day => day.date === date)!.stations.length, 1);
  }
});
