import type { ArchiveRow } from './archive';

export function buildVotingPlan(rows: readonly ArchiveRow[]) {
  const dates = ['2027-01-01', '2027-04-01'];
  for (let day = Date.UTC(2027, 0, 4); day <= Date.UTC(2027, 11, 27); day += 7 * 86400000) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates.sort().map(date => {
    const stations = rows.filter(row => row.votingDate === date);
    return {
      date,
      stations,
      exits: stations.reduce((total, row) => total + (row.exits ?? 0), 0),
      unknown: stations.filter(row => row.exits === null).length,
    };
  });
}
