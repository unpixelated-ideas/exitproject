import bindings from 'gtfs-realtime-bindings';
import type { transit_realtime as Gtfs } from 'gtfs-realtime-bindings';
const { transit_realtime: gtfs } = bindings;
import { boardPlatforms } from '../data/boardPlatforms';
import stations from '../data/mta-stations.json';

type Schedule = { patterns: [string, string[]][]; trips: Record<string, number | null>; names: Record<string, string> };
const root = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs';
const aliases: Record<string, string> = { SI: 'SIR', GS: 'S', FS: 'S', H: 'S', '6X': '6', '7X': '7', FX: 'F' };
const feedRoutes: Record<string, string[]> = {
  '': ['1', '2', '3', '4', '5', '6', '7', 'GS'], '-ace': ['A', 'C', 'E', 'H'],
  '-bdfm': ['B', 'D', 'F', 'M'], '-g': ['G'], '-jz': ['J', 'Z'], '-l': ['L'],
  '-nqrw': ['N', 'Q', 'R', 'W'], '-si': ['SI'],
};
const names = new Map(stations.map(station => [station.gtfs_stop_id, station.stop_name]));
let schedulePromise: Promise<Schedule> | undefined;
function schedule() {
  return schedulePromise ??= fetch(`${import.meta.env.BASE_URL}board-schedule.json`).then(response => {
    if (!response.ok) throw new Error('Station patterns unavailable');
    return response.json() as Promise<Schedule>;
  }).catch(error => { schedulePromise = undefined; throw error; });
}
const cache = new Map<string, { at: number; message: Gtfs.FeedMessage }>();
const pending = new Map<string, Promise<{ message?: Gtfs.FeedMessage; failed: boolean }>>();
async function snapshot(feed: string) {
  const previous = cache.get(feed);
  if (previous && Date.now() - previous.at < 24_000) return { message: previous.message, failed: false };
  const existing = pending.get(feed);
  if (existing) return existing;
  const request = (async () => {
    try {
      const response = await fetch(root + feed, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error('MTA feed unavailable');
      const message = gtfs.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));
      if (!message.header?.timestamp) throw new Error('Incomplete MTA feed');
      cache.set(feed, { at: Date.now(), message });
      return { message, failed: false };
    } catch { return { message: previous?.message, failed: true }; }
    finally { pending.delete(feed); }
  })();
  pending.set(feed, request);
  return request;
}

export function predictions(message: Gtfs.IFeedMessage, platforms: Set<string>, now: number, data: Schedule) {
  const label = (id: string) => data.names[id] ?? names.get(id.slice(0, -1)) ?? id;
  const vehicles = new Map((message.entity ?? []).flatMap(entity => {
    const vehicle = entity.vehicle;
    const age = now - Number(vehicle?.timestamp ?? 0);
    return !entity.isDeleted && vehicle?.trip?.tripId && vehicle.stopId && age >= 0 && age <= 60
      ? [[vehicle.trip.tripId, vehicle] as const] : [];
  }));
  return (message.entity ?? []).flatMap(entity => {
    const update = entity.tripUpdate;
    const trip = update?.trip;
    if (entity.isDeleted || !trip?.tripId || !trip.routeId || [3, 7].includes(trip.scheduleRelationship ?? 0)) return [];
    const all = update?.stopTimeUpdate ?? [];
    const stops = all.filter(stop => ![1, 2].includes(stop.scheduleRelationship ?? 0) && stop.stopId);
    if (!stops.length) return [];
    const excluded = all.filter(stop => [1, 2].includes(stop.scheduleRelationship ?? 0)).map(stop => stop.stopId!);
    const skipped = new Set(all.filter(stop => stop.scheduleRelationship === 1).map(stop => stop.stopId));
    const key = trip.routeId + ':' + trip.tripId.replace(/^[^_]*_/, '');
    const patternIndex = data.trips[trip.routeId + ':' + trip.tripId] ?? data.trips[key];
    let pattern = patternIndex != null ? data.patterns[patternIndex] : undefined;
    let cursor = -1;
    if (pattern && !stops.every(stop => { cursor = pattern![1].indexOf(stop.stopId!, cursor + 1); return cursor >= 0; })) pattern = undefined;
    const updates = new Map(stops.map(stop => [stop.stopId!, stop]));
    return stops.flatMap((stop, index) => {
      const id = stop.stopId!;
      if (!platforms.has(id)) return [];
      const arrival = Number(stop.arrival?.time ?? 0), departure = Number(stop.departure?.time ?? 0);
      const event = index === 0 && departure >= now ? 'departure' as const : arrival >= now ? 'arrival' as const : 'departure' as const;
      const time = event === 'arrival' ? arrival : departure;
      if (time < now) return [];
      const strip = pattern
        ? pattern[1].slice(0, pattern[1].indexOf(id) + 1).filter(platform => !skipped.has(platform)).slice(-4)
        : stops.slice(Math.max(0, index - 3), index + 1).map(item => item.stopId!);
      const vehicle = vehicles.get(trip.tripId!);
      return [{ tripId: trip.tripId!, routeId: trip.routeId!, service: aliases[trip.routeId!] ?? trip.routeId!,
        platformId: id, direction: id.slice(-1), destination: pattern?.[0] || label(stops.at(-1)!.stopId!),
        feedTimestamp: Number(message.header.timestamp), time, event, excludedStops: excluded,
        stops: strip.map(platform => {
          const item = updates.get(platform);
          const arrival = Number(item?.arrival?.time ?? 0), departure = Number(item?.departure?.time ?? 0);
          return { id: platform, name: label(platform), arrival: arrival || departure || null, departure: departure || arrival || null };
        }), trainStopId: vehicle?.stopId ?? null, trainTimestamp: vehicle?.timestamp ? Number(vehicle.timestamp) : null,
        trainInTransit: vehicle?.currentStatus === 2 }];
    });
  });
}

export async function loadBoardArrivals(station: string) {
  const platforms = boardPlatforms.get(station);
  if (!platforms) throw new Error('Unknown station');
  const ids = new Set(platforms.flatMap(platform => [platform.gtfs_stop_id + 'N', platform.gtfs_stop_id + 'S']));
  // Fetch every subway family to retain trains running on another route during diversions.
  const feeds = platforms.every(platform => platform.division === 'SIR' || platform.daytime_routes === 'SIR')
    ? ['-si'] : Object.keys(feedRoutes).filter(feed => feed !== '-si');
  const [data, snapshots] = await Promise.all([schedule(), Promise.all(feeds.map(snapshot))]);
  const now = Math.floor(Date.now() / 1000);
  const statuses = snapshots.map(({ message, failed }) => {
    const timestamp = message ? Number(message.header.timestamp) : null;
    const age = timestamp ? Math.max(0, now - timestamp) : Infinity;
    const state = age > 90 ? 'unavailable' as const : failed || age > 60 ? 'delayed' as const : 'live' as const;
    return { timestamp, state };
  });
  return { asOf: now, feeds: statuses, arrivals: snapshots.flatMap(({ message }, index) =>
    message && statuses[index].state !== 'unavailable' ? predictions(message, ids, now, data) : [])
    .sort((a, b) => a.time - b.time) };
}
