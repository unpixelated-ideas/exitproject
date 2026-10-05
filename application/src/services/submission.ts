import type { SubmissionService } from '../domain/types';
import { validBallot } from '../domain/voting';
export const submissionService: SubmissionService = { async submit(period, stations, ballot) {
        if (period.stationIds.length !== stations.length || !period.stationIds.every(id => stations.some(s => s.id === id)) || !validBallot(stations, ballot))
            throw new Error('Invalid ballot');
        await new Promise(resolve => setTimeout(resolve, 500));
        return { receipt: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
    } };
