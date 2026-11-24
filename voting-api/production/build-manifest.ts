// Generate authoritative validation data from the existing voting calendar.
// This prepares data only. It does not deploy or open voting.
import { writeFileSync } from 'node:fs';
import { availableVotingPeriods } from '../../application/src/data/schedule.ts';
import { stationProvider } from '../../application/src/data/stations.ts';
const periods = Object.fromEntries(Object.entries(availableVotingPeriods).map(([date, period]) => [date, {
    id: date,
    startsAt: period.startsAt,
    // Existing endsAt values are inclusive to the final second. Use an exclusive
    // midnight boundary so the final 999 milliseconds also remain eligible.
    closesAt: new Date(Date.parse(period.endsAt) + 1000).toISOString(),
    stations: Object.fromEntries(stationProvider.getStations(period.stationIds).map(station => [station.id,
        station.exits.filter(exit => exit.type !== 'Elevator').map(exit => exit.id)])),
}]));
writeFileSync(new URL('./manifest.json', import.meta.url), JSON.stringify({ timeZone: 'UTC', periods }, null, 2) + '\n');
