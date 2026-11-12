"""Serve station predictions from cached MTA GTFS Realtime feeds."""

import csv
import io
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen
from zipfile import ZipFile

from google.protobuf.message import DecodeError
from google.transit import gtfs_realtime_pb2 as gtfs

if __package__:
    from .weather import station_weather
else:
    from weather import station_weather

FEED_ROOT = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
SUBWAY_FEEDS = ("", "-ace", "-bdfm", "-g", "-jz", "-l", "-nqrw")
CATALOG = {
    row["complex_id"]: row
    for row in json.loads(
        (Path(__file__).resolve().parents[1] / "src/data/mta-complexes.json")
        .read_text()
    )
    if row["gtfs_stop_ids"]
}


def catalog_stop_names():
    names = {}
    for station in CATALOG.values():
        stops = station["gtfs_stop_ids"].split("; ")
        constituent_names = station["constituent_station_names"].split("; ")
        if len(stops) == len(constituent_names):
            names.update(zip(stops, constituent_names))
        else:
            names.update(dict.fromkeys(stops, station["stop_name"]))
    return names


STOP_NAMES = catalog_stop_names()
ROUTE_ALIASES = {"SI": "SIR", "GS": "S", "FS": "S", "H": "S",
                 "6X": "6", "7X": "7", "FX": "F"}
CACHE = {}
LOCKS = {feed: Lock() for feed in (*SUBWAY_FEEDS, "-si")}


def station_summary(station):
    return {"id": station["complex_id"], "name": station["display_name"]}


def stop_label(platform):
    return STOP_NAMES.get(platform[:-1], platform)


def read_schedule(path):
    """Index scheduled destinations and ordered platform stops by realtime trip ID."""
    if not path:
        return {}
    with ZipFile(path) as archive:
        with archive.open("stops.txt") as stops:
            STOP_NAMES.update({
                row["stop_id"]: row["stop_name"]
                for row in csv.DictReader(io.TextIOWrapper(stops, encoding="utf-8-sig"))
                if row["location_type"] == "1"
            })
        paths = {}
        with archive.open("stop_times.txt") as stop_times:
            for row in csv.DictReader(io.TextIOWrapper(stop_times, encoding="utf-8-sig")):
                paths.setdefault(row["trip_id"], []).append((int(row["stop_sequence"]), row["stop_id"]))
        schedule = {}
        with archive.open("trips.txt") as trips:
            for row in csv.DictReader(io.TextIOWrapper(trips, encoding="utf-8-sig")):
                trip_id = row["trip_id"]
                platforms = tuple(stop for _, stop in sorted(paths.get(trip_id, ())))
                if not platforms:
                    continue
                # Published schedule IDs prefix the trip IDs used by realtime.
                key = (row["route_id"], trip_id.split("_", 1)[-1])
                entry = (row["trip_headsign"], platforms)
                if key not in schedule:
                    schedule[key] = entry
                elif schedule[key] != entry:
                    schedule[key] = None
        return schedule


SCHEDULE = read_schedule(os.environ.get("BOARD_GTFS_ZIP"))


def snapshot(feed):
    with LOCKS[feed]:
        previous = CACHE.get(feed)
        now = time.monotonic()
        if previous and now - previous[0] < 25:
            return previous[1:]
        raw = previous[1] if previous else None
        failed = False
        try:
            with urlopen(FEED_ROOT + feed, timeout=8) as response:
                candidate = response.read()
            parsed = gtfs.FeedMessage.FromString(candidate)
            if not parsed.IsInitialized() or not parsed.header.timestamp:
                raise ValueError("Incomplete feed")
            raw = candidate
        except (OSError, URLError, DecodeError, ValueError):
            failed = True
        CACHE[feed] = (now, raw, failed)
        return raw, failed


def strip_stop(platform, update):
    arrival = update.arrival.time if update else 0
    departure = update.departure.time if update else 0
    return {"id": platform, "name": stop_label(platform),
            "arrival": arrival or departure or None,
            "departure": departure or arrival or None}


def trip_pattern(trip, stops):
    match = SCHEDULE.get((trip.trip.route_id, trip.trip.trip_id))
    if not match:
        match = SCHEDULE.get((trip.trip.route_id, trip.trip.trip_id.split("_", 1)[-1]))
    if not match:
        return None
    _, platforms = match
    remaining = iter(platforms)
    if all(stop.stop_id in remaining for stop in stops):
        return match
    return None


def predictions(message, platforms, now):
    vehicles = {
        entity.vehicle.trip.trip_id: entity.vehicle
        for entity in message.entity
        if not entity.is_deleted and entity.HasField("vehicle")
        and entity.vehicle.stop_id
        and entity.vehicle.timestamp and 0 <= now - entity.vehicle.timestamp <= 60
    }
    for entity in message.entity:
        if entity.is_deleted or not entity.HasField("trip_update"):
            continue
        trip = entity.trip_update
        if trip.trip.schedule_relationship in (gtfs.TripDescriptor.CANCELED,
                                               gtfs.TripDescriptor.DELETED):
            continue
        stops = [
            stop for stop in trip.stop_time_update
            if stop.schedule_relationship not in (gtfs.TripUpdate.StopTimeUpdate.SKIPPED,
                                                  gtfs.TripUpdate.StopTimeUpdate.NO_DATA)
        ]
        pattern = trip_pattern(trip, stops)
        updates = {stop.stop_id: stop for stop in stops}
        skipped = {stop.stop_id for stop in trip.stop_time_update
                   if stop.schedule_relationship == gtfs.TripUpdate.StopTimeUpdate.SKIPPED}
        excluded = skipped | {stop.stop_id for stop in trip.stop_time_update
                              if stop.schedule_relationship == gtfs.TripUpdate.StopTimeUpdate.NO_DATA}
        for index, stop in enumerate(stops):
            if stop.stop_id not in platforms:
                continue
            if index == 0 and stop.departure.time >= now:
                timestamp, event = stop.departure.time, "departure"
            elif stop.arrival.time >= now:
                timestamp, event = stop.arrival.time, "arrival"
            elif stop.departure.time >= now:
                timestamp, event = stop.departure.time, "departure"
            else:
                continue
            vehicle = vehicles.get(trip.trip.trip_id)
            destination = STOP_NAMES.get(stops[-1].stop_id[:-1])
            strip = [item.stop_id for item in stops[max(0, index - 3):index + 1]]
            if pattern:
                headsign, scheduled = pattern
                destination = headsign or destination
                approach = [platform for platform in scheduled[:scheduled.index(stop.stop_id) + 1]
                            if platform not in skipped]
                strip = approach[-4:]
            yield {
                "tripId": trip.trip.trip_id,
                "routeId": trip.trip.route_id,
                "service": ROUTE_ALIASES.get(trip.trip.route_id, trip.trip.route_id),
                "platformId": stop.stop_id,
                "direction": stop.stop_id[-1],
                "destination": destination,
                "stops": [strip_stop(platform, updates.get(platform)) for platform in strip],
                "excludedStops": sorted(excluded),
                "trainStopId": vehicle.stop_id if vehicle else None,
                "trainTimestamp": vehicle.timestamp if vehicle else None,
                "trainInTransit": bool(vehicle and vehicle.current_status == gtfs.VehiclePosition.IN_TRANSIT_TO),
                "time": timestamp,
                "event": event,
            }


def station_arrivals(station_id):
    station = CATALOG[station_id]
    platforms = {stop + direction for stop in station["gtfs_stop_ids"].split("; ")
                 for direction in ("N", "S")}
    feeds = ("-si",) if station["daytime_routes"] == "SIR" else SUBWAY_FEEDS
    with ThreadPoolExecutor(max_workers=len(feeds)) as executor:
        snapshots = list(executor.map(snapshot, feeds))
    now = int(time.time())
    arrivals = {}
    statuses = []
    for feed, (raw, failed) in zip(feeds, snapshots):
        message = gtfs.FeedMessage.FromString(raw) if raw else None
        timestamp = message.header.timestamp if message else None
        age = max(0, now - timestamp) if timestamp else None
        state = "unavailable" if age is None or age > 90 else (
            "delayed" if failed or age > 60 else "live"
        )
        statuses.append({"feed": feed or "base", "timestamp": timestamp, "state": state})
        if state != "unavailable":
            for row in predictions(message, platforms, now):
                arrivals[(row["tripId"], row["routeId"], row["platformId"])] = {**row, "feedTimestamp": timestamp}
    return {
        "station": {"id": station_id, "name": station["stop_name"]},
        "asOf": now,
        "feeds": statuses,
        "arrivals": sorted(arrivals.values(), key=lambda row: row["time"]),
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        station_id = parse_qs(url.query).get("station", [""])[0]
        if url.path == "/stations":
            status, data = 200, sorted(map(station_summary, CATALOG.values()),
                                       key=lambda station: station["name"])
        elif url.path == "/weather" and station_id in CATALOG:
            station = CATALOG[station_id]
            try:
                data = station_weather(station["latitude"], station["longitude"])
            except (OSError, KeyError, TypeError, ValueError):
                data = None
            status = 200 if data else 503
        elif url.path != "/arrivals" or station_id not in CATALOG:
            status, data = 404, {"error": "Unknown endpoint or station"}
        else:
            data = station_arrivals(station_id)
            status = 503 if all(feed["state"] == "unavailable" for feed in data["feeds"]) else 200
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        origin = os.environ.get("BOARD_WEB_ORIGIN")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 8787), Handler) as server:
        print("Arrivals service at http://127.0.0.1:8787", flush=True)
        server.serve_forever()
