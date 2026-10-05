import { useEffect, useState } from 'react';
import type { Station } from '../domain/types';
import { assignNumber, sanitizeBallot } from '../domain/voting';
import { storage } from '../services/storage';
export function useBallot(periodId: string, stations: Station[]) {
    const [ballot, setBallot] = useState(() => sanitizeBallot(stations, storage.read(`ballot:${periodId}`)));
    useEffect(() => storage.write(`ballot:${periodId}`, ballot), [ballot, periodId]);
    return { ballot, assign: (station: Station, id: string, n?: number) => setBallot(old => ({ ...old, [station.id]: assignNumber(station, old[station.id] ?? {}, id, n) })), reset: () => setBallot({}) };
}
