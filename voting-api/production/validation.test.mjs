import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPeriodOpen, validateBallot } from './validation.mjs';
const { periods } = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
test('all 54 periods include the first and final millisecond, reject missed/future windows', () => {
    assert.equal(Object.keys(periods).length, 54);
    for (const period of Object.values(periods)) {
        const start = Date.parse(period.startsAt), close = Date.parse(period.closesAt);
        assert.equal(isPeriodOpen(period, start - 1), false);
        assert.equal(isPeriodOpen(period, start), true);
        assert.equal(isPeriodOpen(period, close - 1), true);
        assert.equal(isPeriodOpen(period, close), false);
        assert.equal(isPeriodOpen(period, NaN), false);
    }
    assert.equal(periods['2027-04-01'].closesAt, '2027-04-21T00:00:00.000Z');
    assert.equal(periods['2027-12-27'].closesAt, '2028-01-01T00:00:00.000Z');
});
test('manifest covers 444 entries and 2018 non-elevator exits with strict ballot checks', () => {
    const entries = Object.values(periods).flatMap(p => Object.keys(p.stations));
    assert.equal(entries.length, 444);
    assert.equal(new Set(entries).size, 444);
    assert.equal(Object.values(periods).flatMap(p => Object.values(p.stations)).flat().length, 2018);
    for (const period of Object.values(periods)) {
        const ballot = Object.fromEntries(Object.entries(period.stations).map(([id, exits]) => [id, Object.fromEntries(exits.map((exit, i) => [exit, i + 1]))]));
        assert.equal(validateBallot(period, ballot), true);
        assert.equal(validateBallot(period, { ...ballot, extra: {} }), false);
        const station = Object.keys(ballot)[0], exit = Object.keys(ballot[station])[0];
        ballot[station][exit] = 0;
        assert.equal(validateBallot(period, ballot), false);
        delete ballot[station][exit];
        assert.equal(validateBallot(period, ballot), false);
    }
});
