import type { SubmissionService } from '../domain/types';
import { validBallot } from '../domain/voting';
import { storage } from './storage';

export function isLocalTestMode(dev: boolean, url: string): boolean {
    const location = new URL(url);
    return dev && ['localhost', '127.0.0.1'].includes(location.hostname)
        && location.port === '5173' && location.searchParams.get('testVoting') === '1';
}

const endpoint = 'https://mta-exit-voting-test.cloaks-chimps-6e.workers.dev/votes';
const retryKey = 'test-voting:opening:requests';
type RetryMap = Record<string, string>;
export function createTestSubmissionService(fetcher: typeof fetch = fetch, persistence = storage) {
    let requests: RetryMap = {};
    const stored = persistence.read(retryKey);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        requests = Object.fromEntries(Object.entries(stored).filter(([hash, id]) => /^[a-f0-9]{64}$/.test(hash) && typeof id === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(id))) as RetryMap;
    }
    const service: SubmissionService = {
        async submit(period, stations, ballot) {
            if (period.id !== 'test-opening-v1' || !validBallot(stations, ballot)
                || period.stationIds.length !== stations.length || !period.stationIds.every(id => stations.some(s => s.id === id))) throw new Error('Invalid test ballot');
            const clean = Object.fromEntries([...stations].sort((a, b) => a.id.localeCompare(b.id)).map(s => [s.id,
                Object.fromEntries([...s.exits].sort((a, b) => a.id.localeCompare(b.id)).map(e => [e.id, ballot[s.id][e.id]]))]));
            const encoded = new TextEncoder().encode(JSON.stringify(clean));
            const digest = await crypto.subtle.digest('SHA-256', encoded);
            const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
            const requestId = requests[hash] ??= crypto.randomUUID();
            persistence.write(retryKey, requests);
            const response = await fetcher(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'omit', signal: AbortSignal.timeout(15_000),
                body: JSON.stringify({ periodId: period.id, requestId, ballot: clean }),
            });
            if (!response.ok) throw new Error('Test submission failed');
            const result = await response.json();
            if (result.environment !== 'test' || typeof result.receipt !== 'string' || !/^TEST-[a-f0-9-]{36}$/.test(result.receipt)) throw new Error('Invalid test receipt');
            return { receipt: result.receipt };
        },
    };
    return service;
}
