"""Build the archive snapshot entirely from saved, reviewable sources.
Run audit-archive-services.py first when replacing the GTFS snapshot.
"""
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'reference-files/archive'
CSV = ROOT / 'reference-files/MTA_Subway_Entrances_and_Exits__2024_20260905-20261004.csv'

def load(name):
    return json.loads((SOURCE / name).read_text())

def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def sorted_ids(values):
    return sorted(set(values), key=int)

def routes(values):
    order = '1 2 3 4 5 6 7 A B C D E F G J L M N Q R W Z S SIR T'.split()
    return sorted(set(values), key=order.index)

inventory = load('mta-stations.json')
complexes = {row['complex_id']: row for row in load('mta-complexes.json')}
overrides = load('overrides.json')
services = load('service-audit.json')
additions = load('regular-service-additions.json')
by_id = defaultdict(list)
for station in inventory:
    by_id[station['station_id']].append(station)
assert len(by_id) == 493
assert len([s for s in by_id.values() if s[0]['division'] == 'SIR']) == 21
assert len({s['gtfs_stop_id'] for s in inventory}) == 496
assert set(services['stops']) == {s['gtfs_stop_id'] for s in inventory}
by_gtfs = {station['gtfs_stop_id']: station for station in inventory}

def group(complex_id):
    return overrides['mergedComplexes'].get(complex_id, complex_id)

with CSV.open(encoding='utf-8-sig', newline='') as file:
    entrance_rows = list(csv.DictReader(file))
assert len(entrance_rows) == 2120
corrections = {item['csvLine']: item for item in overrides['entranceCorrections']}
entrances = defaultdict(list)
entrance_ids = set()
audit_corrections = []
line_identifier_discrepancies = []
for line, original in enumerate(entrance_rows, 2):
    row = dict(original)
    if line in corrections:
        correction = corrections[line]
        assert all(row[key] == value for key, value in correction['expect'].items()), f'Correction guard failed on CSV line {line}'
        row.update(correction['set'])
        audit_corrections.append({'csvLine': line, 'original': original, 'corrected': row, 'reason': correction['reason']})
    assert row['Station ID'] in by_id, f'Unknown station on line {line}'
    canonical = by_id[row['Station ID']][0]
    assert canonical['complex_id'] == row['Complex ID'], f'Unreviewed complex mismatch on line {line}'
    identity = (row['Complex ID'], row['Entrance Latitude'], row['Entrance Longitude'])
    assert identity not in entrance_ids, f'Duplicate entrance requires review on line {line}'
    entrance_ids.add(identity)
    gtfs_ids = {value.strip() for value in row['GTFS Stop ID'].split(';')}
    assert all(value in by_gtfs for value in gtfs_ids), f'Unknown GTFS identifier on line {line}'
    assert all(by_gtfs[value]['complex_id'] == canonical['complex_id'] for value in gtfs_ids), f'GTFS/complex mismatch on line {line}'
    if not gtfs_ids <= {s['gtfs_stop_id'] for s in by_id[row['Station ID']]}:
        line_identifier_discrepancies.append({'csvLine': line, 'stationId': row['Station ID'], 'gtfsStopId': row['GTFS Stop ID'], 'complexId': canonical['complex_id'], 'resolution': 'Original line attribution retained; all identifiers resolve to this same complex. No count change.'})
    entrances[group(row['Complex ID'])].append(row)

members_by_group = defaultdict(list)
for station_id, platforms in by_id.items():
    station = platforms[0]
    regular = set()
    night = set()
    for platform in platforms:
        stop = platform['gtfs_stop_id']
        regular.update(platform['daytime_routes'].split())
        regular.update(additions.get(stop, {}).get('routes', []))
        patterns = services['stops'][stop]
        night.update(route for route, hours in patterns.items() if sum(hours[2:4]))
        for route in regular:
            assert route in set().union(*(set(services['stops'][p['gtfs_stop_id']]) for p in platforms)), f'Unscheduled service {station_id}: {route}'
    member = {
        'stationId': station_id,
        'complexId': station['complex_id'],
        'name': station['stop_name'],
        'lines': list(dict.fromkeys(p['line'] for p in platforms)),
        'gtfsStopIds': [p['gtfs_stop_id'] for p in platforms],
        'regularServices': routes(regular),
        'overnightServices': routes(night),
    }
    members_by_group[group(station['complex_id'])].append(member)

rows = []
for group_id, members in members_by_group.items():
    members.sort(key=lambda member: int(member['stationId']))
    source_ids = sorted_ids(member['complexId'] for member in members)
    source_entrances = entrances.get(group_id, [])
    regular = set().union(*(set(member['regularServices']) for member in members))
    night = set().union(*(set(member['overnightServices']) for member in members))
    name = overrides['complexNames'].get(group_id, complexes[group_id]['stop_name'])
    aliases = set()
    for member in members:
        aliases.update([member['name'], *member['lines']])
    aliases.update(row['Stop Name'] for row in source_entrances)
    aliases.update(row['Constituent Station Name'] for row in source_entrances)
    # Keep historical station names searchable following official renamings.
    if group_id == '603': aliases.add('149th Street–Grand Concourse')
    if any(member['stationId'] == '323' for member in members): aliases.add('Christopher Street–Sheridan Square')
    if any(member['stationId'] == '405' for member in members): aliases.add('23rd Street')
    rows.append({
        'id': f'complex-{group_id}',
        'name': name,
        'borough': by_id[members[0]['stationId']][0]['borough'],
        'complexIds': source_ids,
        'stationIds': sorted_ids(member['stationId'] for member in members),
        'exits': sum(row['Entrance Type'] != 'Elevator' for row in source_entrances) if source_entrances else None,
        'elevators': sum(row['Entrance Type'] == 'Elevator' for row in source_entrances) if source_entrances else None,
        'regularServices': routes(regular),
        'votingDate': '2027-01-01' if group_id in {'143', '438', '522'} else '2027-04-01' if source_entrances and sum(row['Entrance Type'] != 'Elevator' for row in source_entrances) == 1 else None,
        'nightServices': routes(night - regular),
        'plannedServices': ['T'] if any(member['stationId'] in overrides['plannedTStationIds'] for member in members) else [],
        'members': members,
        'aliases': sorted(aliases),
    })
rows.sort(key=lambda row: int(row['id'].split('-')[1]))
assert len(rows) == 444
assert sum(row['exits'] or 0 for row in rows) == 2018
assert sum(row['elevators'] or 0 for row in rows) == 102
assert len(next(row for row in rows if row['id'] == 'complex-611')['members']) == 7
ninety_six = next(row for row in rows if row['id'] == 'complex-157')
assert ninety_six['regularServices'] == ['B', 'C'] and ninety_six['nightServices'] == ['A']

metadata = {
    'asOf': '2026-10-07',
    'serviceWeek': services['weekStart'],
    'feedVersion': services['feed']['feed_version'],
    'feedValidThrough': '2026-10-31',
    'stationCount': len(by_id), 'subwayStationCount': 472, 'sirStationCount': 21,
    'rowCount': len(rows), 'exitCount': 2018, 'elevatorCount': 102,
    'sources': [
        {'label': 'MTA stations', 'url': 'https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f'},
        {'label': 'MTA complexes', 'url': 'https://data.ny.gov/Transportation/MTA-Subway-Stations-and-Complexes/5f5g-n3cz'},
        {'label': 'MTA regular schedules', 'url': 'https://www.mta.info/developers'},
        {'label': 'NYC Subway stations (Wikipedia)', 'url': 'https://en.wikipedia.org/wiki/List_of_New_York_City_Subway_stations'},
        {'label': 'SIR stations (Wikipedia)', 'url': 'https://en.wikipedia.org/wiki/List_of_Staten_Island_Railway_stations'},
        {'label': 'Planned T service (Wikipedia)', 'url': 'https://en.wikipedia.org/wiki/T_(New_York_City_Subway_service)'},
    ],
}
save(ROOT / 'src/data/archive-directory.json', {'metadata': metadata, 'rows': rows})
covered_station_ids = {row['Station ID'] for group_rows in entrances.values() for row in group_rows}
audit = {
    **metadata,
    'sourceHashes': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in [CSV, SOURCE/'mta-stations.json', SOURCE/'mta-complexes.json', SOURCE/'gtfs_subway.zip', SOURCE/'overrides.json', SOURCE/'regular-service-additions.json']},
    'entranceCorrections': audit_corrections,
    'withinComplexLineDiscrepancies': line_identifier_discrepancies,
    'stationsWithoutOwnEntranceRecords': [{'stationId': key, 'name': value[0]['stop_name'], 'complexId': value[0]['complex_id'], 'resolution': 'Retain constituent; count shared entrances at complex level.'} for key, value in by_id.items() if key not in covered_station_ids],
    'unknownCountRows': [row['id'] for row in rows if row['exits'] is None],
    'entryOnlyNonElevatorsIncluded': sum(row['Exit Allowed'] == 'NO' and row['Entrance Type'] != 'Elevator' for row in entrance_rows),
    'duplicateEntranceRecords': 0,
}
save(SOURCE/'reconciliation.json', audit)
print(f"Built {len(rows)} complexes: 493 stations, 2018 access points, 102 entrance elevators. {len(audit_corrections)} documented record corrections.")
