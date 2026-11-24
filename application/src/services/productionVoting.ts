import { availableVotingPeriods } from '../data/schedule';
import { validBallot } from '../domain/voting';
import type { SubmissionService, VotingPeriod } from '../domain/types';
import { storage } from './storage';
export const productionApi = 'https://mta-exit-voting.cloaks-chimps-6e.workers.dev';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class VotingError extends Error {
    constructor(public code: string) { super(code); }
}
export function savedReceipt(periodId: string): string | null {
    const receipt = storage.read(`production:receipt:${periodId}`);
    return typeof receipt === 'string' && /^VOTE-[a-f0-9-]{36}$/.test(receipt) ? receipt : null;
}
export async function openProductionPeriods(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ periods: VotingPeriod[]; validFor: number }> {
    const response = await fetcher(`${productionApi}/periods`, { credentials: 'omit', cache: 'no-store', signal });
    if (!response.ok) throw new VotingError('unavailable');
    const data = await response.json();
    if (data.environment !== 'production' || !Array.isArray(data.periods) || !Number.isFinite(Date.parse(data.serverNow))) throw new VotingError('unavailable');
    const periods: VotingPeriod[] = data.periods.map((item: { id: string; startsAt: string; closesAt: string; stationIds: string[] }) => {
        const expected = item && Object.hasOwn(availableVotingPeriods, item.id) ? availableVotingPeriods[item.id] : undefined;
        if (!expected || Date.parse(item.startsAt) > Date.parse(data.serverNow) || Date.parse(item.closesAt) <= Date.parse(data.serverNow) || item.startsAt !== expected.startsAt || Date.parse(item.closesAt) !== Date.parse(expected.endsAt) + 1000
            || !Array.isArray(item.stationIds) || [...item.stationIds].sort().join('|') !== [...expected.stationIds].sort().join('|')) throw new VotingError('unavailable');
        return { ...expected, id: item.id, mock: false };
    });
    const validFor = Math.min(2_147_000_000, ...data.periods.map((p: { closesAt: string }) => Date.parse(p.closesAt) - Date.parse(data.serverNow)));
    return { periods, validFor: Math.max(0, validFor) };
}
export function createProductionSubmission(fetcher: typeof fetch = fetch, persistence = storage): SubmissionService {
    return { async submit(period, stations, ballot) {
        if (period.mock || !availableVotingPeriods[period.id] || !validBallot(stations, ballot)
            || period.stationIds.length !== stations.length || !period.stationIds.every(id => stations.some(s => s.id === id))) throw new VotingError('invalid');
        let browserId = persistence.read('production:browserId');
        if (typeof browserId !== 'string' || !uuid.test(browserId)) {
            browserId = crypto.randomUUID(); persistence.write('production:browserId', browserId);
        }
        if (persistence.read('production:browserId') !== browserId) throw new VotingError('storage');
        const canonical = Object.fromEntries([...stations].sort((a,b) => a.id.localeCompare(b.id)).map(s => [s.id,
            Object.fromEntries([...s.exits].sort((a,b) => a.id.localeCompare(b.id)).map(e => [e.id, ballot[s.id][e.id]]))]));
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
        const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('');
        const key = `production:request:${period.id}:${hash}`;
        let requestId = persistence.read(key);
        if (typeof requestId !== 'string' || !uuid.test(requestId)) { requestId = crypto.randomUUID(); persistence.write(key, requestId); }
        if (persistence.read(key) !== requestId) throw new VotingError('storage');
        const response = await fetcher(`${productionApi}/votes`, { method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(15_000),
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodId: period.id, browserId, requestId, ballot: canonical }) });
        const result = await response.json();
        if (!response.ok) throw new VotingError(result.error === 'already_voted' ? 'already' : result.error === 'period_closed' ? 'closed' : 'unavailable');
        if (result.environment !== 'production' || typeof result.receipt !== 'string' || !/^VOTE-[a-f0-9-]{36}$/.test(result.receipt)) throw new VotingError('unavailable');
        persistence.write(`production:receipt:${period.id}`, result.receipt);
        return { receipt: result.receipt };
    } };
}
