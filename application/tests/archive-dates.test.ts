import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveDateVisibility } from '../src/domain/archiveDates.ts';

test('archive dates reveal at two weeks and one calendar month', () => {
 const now = new Date('2027-01-15T17:00:00Z');
 assert.equal(archiveDateVisibility('2027-01-01', now), 'full');
 assert.equal(archiveDateVisibility('2027-01-29', now), 'full');
 assert.equal(archiveDateVisibility('2027-01-30', now), 'month');
 assert.equal(archiveDateVisibility('2027-02-15', now), 'month');
 assert.equal(archiveDateVisibility('2027-02-16', now), 'hidden');
 assert.equal(archiveDateVisibility('2027-02-28', new Date('2027-01-31T17:00:00Z')), 'month');
});
test('April 1 stays hidden until New York reaches April 1', () => {
 assert.equal(archiveDateVisibility('2027-04-01', new Date('2027-04-01T03:59:00Z')), 'hidden');
 assert.equal(archiveDateVisibility('2027-04-01', new Date('2027-04-01T04:00:00Z')), 'full');
 assert.equal(archiveDateVisibility('2027-04-01', new Date('2027-04-02T12:00:00Z')), 'full');
});
