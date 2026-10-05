export type LocalizedText = {
    en: string;
    ko: string;
};
export interface Exit {
    type?: "Stair" | "Elevator" | "Ramp";
    id: string;
    description: LocalizedText;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    accessibility?: {
        stepFree?: boolean;
        notes?: string;
    };
    metadata?: Record<string, unknown>;
}
export interface Station {
    stationId?: string;
    gtfsStopId?: string;
    id: string;
    name: LocalizedText;
    services: string[];
    exits: Exit[];
    metadata?: Record<string, unknown>;
}
export interface VotingPeriod {
    id: string;
    title: LocalizedText;
    sequence?: number;
    startsAt: string;
    endsAt: string;
    stationIds: string[];
    specialEvent?: {
        kind: string;
    };
    mock: boolean;
}
export type Assignments = Record<string, number>;
export type Ballot = Record<string, Assignments>;
export interface StationResult {
    stationId: string;
    winning: Assignments;
    ballots: number;
    percentage?: number;
    distributions?: Record<string, Record<number, number>>;
    alternatives?: {
        assignments: Assignments;
        percentage: number;
    }[];
}
export interface ArchivePeriod {
    period: VotingPeriod;
    results: StationResult[];
}
export interface StationProvider {
    getStations(ids: string[]): Station[];
}
export interface ScheduleProvider {
    getActivePeriod(): VotingPeriod;
    getArchive(): ArchivePeriod[];
}
export interface SubmissionService {
    submit(period: VotingPeriod, stations: Station[], ballot: Ballot): Promise<{
        receipt: string;
    }>;
}
