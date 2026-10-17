import { stations, january4Stations, april1Stations, remainingStations } from './stations';
import type { ScheduleProvider, VotingPeriod } from '../domain/types';
export const demoPeriod: VotingPeriod = { id: 'demo-ballot-v2', title: { en: 'Number the exits', ko: '출구 번호 정하기' }, startsAt: '2027-01-01T00:00:00Z', endsAt: '2027-01-03T23:59:59Z', stationIds: stations.map(station => station.id), mock: true };
// The opening ballot remains explicitly selected, independent of today's date.
// All nine January 1 stations are available in this opening ballot.
export const openingStationCount = demoPeriod.stationIds.length;
export const scheduleProvider: ScheduleProvider = {
    getActivePeriod: () => demoPeriod,
    getArchive: () => [{ period: { id: 'demo-archive-v1', title: { en: 'Previous voting period', ko: '이전 투표 기간' }, startsAt: '2025-12-01T00:00:00Z', endsAt: '2025-12-10T00:00:00Z', stationIds: ['mock-alder'], mock: true }, results: [{ stationId: 'mock-alder', winning: { 'alder-portal-a': 1, 'alder-portal-b': 2, 'alder-portal-c': 3, 'alder-portal-d': 4 }, ballots: 128, percentage: 62.5, alternatives: [] }] }]
};

// Every scheduled date has a complete ballot; April 1 is a separate special event.
export const votingPeriodDates = ['2027-01-01', '2027-04-01', ...Array.from({ length: 52 }, (_, week) => new Date(Date.UTC(2027, 0, 4 + week * 7)).toISOString().slice(0, 10))].sort();

export const january4Period: VotingPeriod = {
    id: 'ballot-2027-01-04-v1', title: demoPeriod.title,
    startsAt: '2027-01-04T00:00:00Z', endsAt: '2027-01-10T23:59:59Z',
    stationIds: january4Stations.map(station => station.id), mock: true,
};
export const april1Period: VotingPeriod = {
    id: 'ballot-2027-04-01-v1', title: { en: 'April 1 special · Number the exits', ko: '4월 1일 특별 투표 · 출구 번호 정하기' },
    startsAt: '2027-04-01T00:00:00Z', endsAt: '2027-04-20T23:59:59Z',
    stationIds: april1Stations.map(station => station.id), specialEvent: { kind: 'april-fools' }, mock: true,
};
export const availableVotingPeriods: Record<string, VotingPeriod> = {
    '2027-01-01': demoPeriod, '2027-01-04': january4Period, '2027-04-01': april1Period,
};

for (const date of votingPeriodDates) {
    if (availableVotingPeriods[date]) continue;
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    if (date === '2027-12-27') end.setTime(Date.UTC(2027, 11, 31));
    const stationIds = remainingStations.filter(station => station.metadata?.votingDate === date).map(station => station.id);
    if (!stationIds.length) throw new Error(`Missing ballot stations for ${date}`);
    availableVotingPeriods[date] = {
        id: `ballot-${date}-v1`, title: demoPeriod.title,
        startsAt: start.toISOString(), endsAt: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
        stationIds, mock: true,
    };
}
