import type { ScheduleProvider, VotingPeriod } from '../domain/types';
export const demoPeriod: VotingPeriod = { id: 'demo-ballot-v2', title: { en: 'Number the exits', ko: '출구 번호 정하기' }, startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-15T00:00:00Z', stationIds: ['438', '143', '522'], mock: true };
// Explicit demo selection, independent of today's date. This is not the 2027 schedule.
export const scheduleProvider: ScheduleProvider = {
    getActivePeriod: () => demoPeriod,
    getArchive: () => [{ period: { id: 'demo-archive-v1', title: { en: 'Previous voting period', ko: '이전 투표 기간' }, startsAt: '2025-12-01T00:00:00Z', endsAt: '2025-12-10T00:00:00Z', stationIds: ['mock-alder'], mock: true }, results: [{ stationId: 'mock-alder', winning: { 'alder-portal-a': 1, 'alder-portal-b': 2, 'alder-portal-c': 3, 'alder-portal-d': 4 }, ballots: 128, percentage: 62.5, alternatives: [] }] }]
};
