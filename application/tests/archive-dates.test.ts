import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createServer } from 'vite';
import en from '../src/locales/en.json';
import ko from '../src/locales/ko.json';
import { archiveDateVisibility } from '../src/domain/archiveDates.ts';

test('past, today, inclusive fortnight and rolling month boundaries', () => {
    const now = new Date('2027-01-15T17:00:00Z');
    for (const [date, expected] of [
        ['2026-12-31', 'full'], ['2027-01-15', 'full'], ['2027-01-29', 'full'],
        ['2027-01-30', 'month'], ['2027-02-15', 'month'], ['2027-02-16', 'hidden'],
    ] as const) assert.equal(archiveDateVisibility(date, now), expected, date);
});

test('rolling months clamp at month ends, including leap years and year rollover', () => {
    for (const [today, cutoff, after] of [
        ['2027-01-31', '2027-02-28', '2027-03-01'],
        ['2028-01-31', '2028-02-29', '2028-03-01'],
        ['2027-08-31', '2027-09-30', '2027-10-01'],
        ['2027-12-20', '2028-01-20', '2028-01-21'],
    ]) {
        const now = new Date(`${today}T12:00:00Z`);
        assert.equal(archiveDateVisibility(cutoff, now), 'month');
        assert.equal(archiveDateVisibility(after, now), 'hidden');
    }
    assert.equal(archiveDateVisibility('2028-01-03', new Date('2027-12-20T12:00:00Z')), 'full');
    assert.equal(archiveDateVisibility('2028-01-04', new Date('2027-12-20T12:00:00Z')), 'month');
});

test('April 1 remains hidden until UTC April 1, matching the voting calendar', () => {
    for (const now of ['2027-02-01T12:00:00Z', '2027-03-01T12:00:00Z', '2027-03-18T12:00:00Z', '2027-03-31T23:59:59.999Z']) {
        assert.equal(archiveDateVisibility('2027-04-01', new Date(now)), 'hidden');
    }
    for (const now of ['2027-04-01T00:00:00Z', '2027-04-02T12:00:00Z']) {
        assert.equal(archiveDateVisibility('2027-04-01', new Date(now)), 'full');
    }
});

test('ordinary reveals use UTC midnight regardless of viewer timezone or DST', () => {
    assert.equal(archiveDateVisibility('2027-03-29', new Date('2027-03-14T23:59:59.999Z')), 'month');
    assert.equal(archiveDateVisibility('2027-03-29', new Date('2027-03-15T00:00:00Z')), 'full');
});

for (const [language, resource, fullDate, month] of [
    ['en', en, 'January 18', 'February'], ['ko', ko, '1월 18일', '2월'],
] as const) {
    test(`archive renders full, partial and hidden dates in ${language} while preserving rows`, async context => {
        context.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-15T12:00:00Z') });
        const i18n = createInstance();
        await i18n.init({ lng: language, resources: { [language]: { translation: resource } }, interpolation: { escapeValue: false } });
        const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
        context.after(() => server.close());
        const { ArchiveTable } = await server.ssrLoadModule('/src/components/ArchiveTable.tsx');
        const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(ArchiveTable)));
        const cells = [...html.matchAll(/<tr><th scope="row">[\s\S]*?<\/tr>/g)].map(match => [...match[0].matchAll(/<td(?: [^>]*)?>([\s\S]*?)<\/td>/g)].at(-1)![1]);
        const plain = (cell: string) => cell.replace(/<[^>]*>/g, '');
        assert.equal(cells.length, 444);
        assert.ok(cells.some(cell => plain(cell) === fullDate));
        assert.ok(cells.some(cell => plain(cell).includes(month) && cell.includes('day-only')));
        assert.ok(cells.some(cell => plain(cell) === '' && cell.includes('archive-date-blackout')));
        assert.ok(cells.every(cell => !cell.includes('2027')));
        assert.ok(html.includes(`aria-label="${resource.directory.dateNotRevealed}"`));
        assert.ok(!html.includes('archive-method'));
    });
}
