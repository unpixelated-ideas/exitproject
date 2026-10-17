import test from 'node:test';
import assert from 'node:assert/strict';
import directory from '../src/data/archive-directory.json';
import { buildVotingPlan } from '../src/domain/planner.ts';

test('plan has all 52 Mondays plus opening day and a separate April special', () => {
  const plan = buildVotingPlan([]);
  assert.equal(plan.length, 54);
  assert.equal(new Set(plan.map(day => day.date)).size, 54);
  assert.equal(plan[0].date, '2027-01-01');
  assert.equal(plan.at(-1)!.date, '2027-12-27');
  assert.equal(plan.filter(day => new Date(day.date).getUTCDay() === 1).length, 52);
  assert.ok(plan.some(day => day.date === '2027-04-01'));
  assert.ok(plan.every(day => day.exits === 0));
});

test('totals follow archive dates and count complexes once without elevators', () => {
  const base = directory.rows[0];
  const plan = buildVotingPlan([
    { ...base, exits: 12, elevators: 3, votingDate: '2027-01-04' },
    { ...base, exits: 6, votingDate: '2027-01-04' },
    { ...base, exits: null, votingDate: '2027-01-04' },
    { ...base, exits: 1, votingDate: '2027-04-01' },
    { ...base, exits: 30, votingDate: null },
  ]);
  assert.equal(plan.find(day => day.date === '2027-01-04')!.exits, 18);
  assert.equal(plan.find(day => day.date === '2027-01-04')!.unknown, 1);
  assert.equal(plan.find(day => day.date === '2027-04-01')!.exits, 1);
  assert.equal(plan.reduce((sum, day) => sum + day.exits, 0), 19);
});
