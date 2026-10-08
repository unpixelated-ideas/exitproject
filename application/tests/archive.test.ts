import test from 'node:test';
import assert from 'node:assert/strict';
import directory from '../src/data/archive-directory.json';
import inventory from '../reference-files/archive/mta-stations.json';
import reconciliation from '../reference-files/archive/reconciliation.json';
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

test('voting dates preserve January selections and April one-exit schedule', () => {
  assert.ok(rows.some(row => row.exits === 1));
  for (const row of rows) assert.equal(row.votingDate, ['complex-143', 'complex-438', 'complex-522'].includes(row.id) ? '2027-01-01' : row.exits === 1 ? '2027-04-01' : null);
  for (const direction of ['ascending', 'descending'] as const) {
    const sorted = sortArchiveRows(rows, 'votingDate', direction);
    const firstUndated = sorted.findIndex(row => row.votingDate === null);
    assert.ok(sorted.slice(0, firstUndated).every(row => row.votingDate !== null));
    assert.ok(sorted.slice(firstUndated).every(row => row.votingDate === null));
  }
});
