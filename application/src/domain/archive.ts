export interface ArchiveMember {
  stationId: string;
  complexId: string;
  name: string;
  lines: string[];
  gtfsStopIds: string[];
  regularServices: string[];
  overnightServices: string[];
}

export interface ArchiveRow {
  id: string;
  name: string;
  borough: string;
  complexIds: string[];
  stationIds: string[];
  exits: number | null;
  elevators: number | null;
  votingDate: string | null;
  regularServices: string[];
  nightServices: string[];
  plannedServices: string[];
  members: ArchiveMember[];
  aliases: string[];
}

export const archiveColumns = ['name', 'exits', 'elevators', 'regularServices', 'nightServices', 'members', 'ids', 'votingDate'] as const;
export type ArchiveSortKey = typeof archiveColumns[number];
export type SortDirection = 'ascending' | 'descending';

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// Match official abbreviations and familiar spellings, e.g. "96th Street" / "96 St".
export function normalizeArchiveSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/\bstreets?\b/g, 'st').replace(/\bavenues?\b|\bavs\b/g, 'av')
    .replace(/\bboulevard\b/g, 'blvd').replace(/\bsquare\b/g, 'sq')
    .replace(/\bparkway\b/g, 'pkwy').replace(/\bheights\b/g, 'hts')
    .replace(/\bsaint\b/g, 'st').replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function matchesArchiveSearch(row: ArchiveRow, query: string): boolean {
  const tokens = normalizeArchiveSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const nameText = normalizeArchiveSearch([
    row.name, ...row.aliases,
    ...row.members.flatMap(member => [member.name, ...member.lines]),
  ].join(' '));
  const nameWords = nameText.split(' ');
  const exactTokens = new Set([
    ...row.complexIds, ...row.stationIds,
    ...row.members.flatMap(member => member.gtfsStopIds),
    ...row.regularServices, ...row.nightServices, ...row.plannedServices,
  ].map(value => value.toLowerCase()));
  // Single-letter service searches must not match every station containing that letter.
  return tokens.every((token, index) => {
    if (/^\d+$/.test(token)) {
      const next = tokens[index + 1];
      // A street address must match its name, not an unrelated station's ID.
      if (next === 'st' || next === 'av') {
        return nameWords.some((word, i) => word === token && nameWords[i + 1] === next);
      }
      return exactTokens.has(token) || nameWords.includes(token);
    }
    return token.length === 1 && /[a-z]/.test(token)
      ? exactTokens.has(token) || nameWords.includes(token)
      : exactTokens.has(token) || nameText.includes(token);
  });
}

function sortValue(row: ArchiveRow, key: ArchiveSortKey): string | number | null {
  switch (key) {
    case 'name': return row.name;
    case 'votingDate': return row.votingDate;
    case 'exits': return row.exits;
    case 'elevators': return row.elevators;
    case 'regularServices': return [...row.regularServices, ...row.plannedServices].sort(natural.compare).join(' ');
    case 'nightServices': return row.nightServices.slice().sort(natural.compare).join(' ') || null;
    case 'members': return row.members.length > 1
      ? row.members.map(member => `${member.name} ${member.lines.join(' ')}`).sort(natural.compare).join(' / ')
      : null;
    case 'ids': return [...row.complexIds, ...row.stationIds].join(' ');
  }
}

export function sortArchiveRows(rows: readonly ArchiveRow[], key: ArchiveSortKey, direction: SortDirection): ArchiveRow[] {
  return rows.slice().sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    // Missing values stay at the bottom in either direction.
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const compared = left === null || right === null ? 0
      : typeof left === 'number' && typeof right === 'number' ? left - right
      : natural.compare(String(left), String(right));
    return (direction === 'ascending' ? compared : -compared)
      || natural.compare(a.name, b.name) || natural.compare(a.id, b.id);
  });
}

// Keep each trunk-line color family together, including when bullets wrap.
export function groupArchiveServices(services: readonly string[]): string[][] {
  const families = [['1', '2', '3'], ['4', '5', '6'], ['7'], ['A', 'C', 'E'], ['B', 'D', 'F', 'M'], ['G'], ['J', 'Z'], ['L'], ['N', 'Q', 'R', 'W'], ['S'], ['SIR'], ['T']];
  const known = new Set(families.flat());
  return [...families.map(family => family.filter(route => services.includes(route))),
    ...services.filter(route => !known.has(route)).map(route => [route])].filter(group => group.length);
}
