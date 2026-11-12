import stations from './mta-stations.json';

export const boardPlatforms = new Map<string, typeof stations>();
export const platformDirections = new Map<string, string>();
const destinationBoroughs = new Map<string, Set<string>>();
for (const station of stations) {
  const group = boardPlatforms.get(station.complex_id) ?? [];
  group.push(station);
  boardPlatforms.set(station.complex_id, group);
  platformDirections.set(station.gtfs_stop_id + 'N', station.north_direction_label);
  platformDirections.set(station.gtfs_stop_id + 'S', station.south_direction_label);
  const boroughs = destinationBoroughs.get(station.stop_name) ?? new Set<string>();
  boroughs.add(station.borough);
  destinationBoroughs.set(station.stop_name, boroughs);
}

export function stationServices(routes: string) {
  return routes.split(/\s+/).filter(Boolean).map(route => route === 'SI' ? 'SIR' : route);
}

export function destinationBorough(destination: string) {
  const boroughs = destinationBoroughs.get(destination);
  return boroughs?.size === 1 ? boroughs.values().next().value : undefined;
}
