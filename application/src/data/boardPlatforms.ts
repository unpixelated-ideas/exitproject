import stations from './mta-stations.json';
import complexes from './mta-complexes.json';

// Station selection is static and remains available without the realtime service.
export const boardStations = complexes
  .filter(station => station.gtfs_stop_ids)
  .map(station => ({ id: station.complex_id, name: station.display_name }))
  .sort((left, right) => left.name.localeCompare(right.name));

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
