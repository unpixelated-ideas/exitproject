import type { Assignments, Ballot, Station } from './types';
export function assignNumber(station: Station, current: Assignments, exitId: string, number?: number): Assignments {
    if (!station.exits.some(e => e.id === exitId))
        return current;
    const next = { ...current };
    if (number === undefined) {
        delete next[exitId];
        return next;
    }
    if (!Number.isInteger(number) || number < 1 || number > station.exits.length || Object.entries(current).some(([id, n]) => id !== exitId && n === number))
        return current;
    return { ...current, [exitId]: number };
}
export function isComplete(station: Station, assignments: Assignments = {}): boolean {
    const values = station.exits.map(e => assignments[e.id]);
    return station.exits.length > 0 && Object.keys(assignments).length === values.length && values.every(n => Number.isInteger(n) && n >= 1 && n <= values.length) && new Set(values).size === values.length;
}
export function validBallot(stations: Station[], ballot: Ballot): boolean { return stations.length > 0 && stations.every(s => isComplete(s, ballot[s.id])); }
export function sanitizeBallot(stations: Station[], value: unknown): Ballot {
    const result: Ballot = {};
    if (!value || typeof value !== 'object')
        return result;
    for (const s of stations) {
        let a: Assignments = {};
        const source = (value as Record<string, unknown>)[s.id];
        if (source && typeof source === 'object')
            for (const e of s.exits) {
                const n = (source as Record<string, unknown>)[e.id];
                if (typeof n === 'number')
                    a = assignNumber(s, a, e.id, n);
            }
        result[s.id] = a;
    }
    return result;
}
