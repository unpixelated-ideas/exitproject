"""Persist a compact audit of the saved MTA regular GTFS (no network required)."""
import csv
import io
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'reference-files/archive'
WEEK_START = date(2026, 10, 5)
WEEK = {WEEK_START + timedelta(days=i) for i in range(7)}
DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

def normalize_route(route):
    return {'SI': 'SIR', 'FS': 'S', 'GS': 'S', 'H': 'S', '6X': '6', '7X': '7', 'FX': 'F'}.get(route, route)

with ZipFile(SOURCE / 'gtfs_subway.zip') as archive:
    def read(name):
        return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding='utf-8-sig'))
    calendars = {}
    for row in read('calendar.txt'):
        calendars[row['service_id']] = {day for day in WEEK if row['start_date'] <= day.strftime('%Y%m%d') <= row['end_date'] and row[DAY_NAMES[day.weekday()]] == '1'}
    for row in read('calendar_dates.txt'):
        day = date.fromisoformat(f"{row['date'][:4]}-{row['date'][4:6]}-{row['date'][6:]}")
        if day in WEEK:
            days = calendars.setdefault(row['service_id'], set())
            if row['exception_type'] == '1': days.add(day)
            else: days.discard(day)
    trips = {row['trip_id']: row for row in read('trips.txt') if calendars.get(row['service_id'])}
    parents = {row['stop_id']: row.get('parent_station') or row['stop_id'] for row in read('stops.txt')}
    # Distinct trip templates, not weighted by number of weekdays. Save every hour
    # so boundary/transition patterns can be reviewed rather than guessed.
    counts = defaultdict(lambda: defaultdict(lambda: [0] * 24))
    for row in read('stop_times.txt'):
        trip = trips.get(row['trip_id'])
        if not trip: continue
        hour = int(row['departure_time'].split(':')[0]) % 24
        counts[parents[row['stop_id']]][normalize_route(trip['route_id'])][hour] += 1
    feed = list(read('feed_info.txt'))[0]

result = {'weekStart': WEEK_START.isoformat(), 'feed': feed, 'stops': dict(counts)}
(SOURCE / 'service-audit.json').write_text(json.dumps(result, indent=2) + '\n')
stations = json.loads((SOURCE / 'mta-stations.json').read_text())
for station in stations:
    patterns = counts[station['gtfs_stop_id']]
    base = set(station['daytime_routes'].split())
    day = {route for route, hours in patterns.items() if sum(hours[7:21])}
    night = {route for route, hours in patterns.items() if sum(hours[2:4])}
    if day != base or night - base:
        print(station['station_id'], station['gtfs_stop_id'], station['stop_name'], 'base', sorted(base), 'day', sorted(day), 'night additions', sorted(night-base))
print('Saved service-audit.json; active GTFS parent stops:',len(counts))
