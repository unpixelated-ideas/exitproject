"""Prepare compact, deduplicated trip patterns for static GitHub Pages hosting."""
import csv
import io
import json
import sys
import urllib.request
from pathlib import Path
from zipfile import ZipFile

output = Path(__file__).resolve().parents[1] / 'public/board-schedule.json'
url = 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_supplemented.zip'
raw = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urllib.request.urlopen(url, timeout=90).read()
with ZipFile(io.BytesIO(raw)) as archive:
    def rows(name):
        return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding='utf-8-sig'))
    paths = {}
    for row in rows('stop_times.txt'):
        paths.setdefault(row['trip_id'], []).append((int(row['stop_sequence']), row['stop_id']))
    patterns, ids, trips = [], {}, {}
    for row in rows('trips.txt'):
        stops = tuple(stop for _, stop in sorted(paths.get(row['trip_id'], [])))
        if not stops:
            continue
        pattern = (row['trip_headsign'], stops)
        if pattern not in ids:
            ids[pattern] = len(patterns)
            patterns.append(pattern)
        key = row['route_id'] + ':' + row['trip_id'].split('_', 1)[-1]
        index = ids[pattern]
        trips[key] = index if key not in trips or trips[key] == index else None
    names = {row['stop_id']: row['stop_name'] for row in rows('stops.txt')}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'patterns': patterns, 'trips': trips, 'names': names}, separators=(',', ':')))
print(f'Prepared {len(patterns)} patterns, {len(trips)} trips ({output.stat().st_size:,} bytes)')
