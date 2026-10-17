"""Build scheduled ballot stations (use --date all for all remaining periods) from the reviewed entrance inventory."""
import csv
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--date', choices=['2027-01-01', '2027-01-04', '2027-04-01', 'all'], default='2027-01-01')
voting_date = parser.parse_args().date

root = Path(__file__).resolve().parents[1]
archive = json.loads((root / 'src/data/archive-directory.json').read_text())['rows']
overrides = json.loads((root / 'reference-files/archive/overrides.json').read_text())
corrections = {item['csvLine']: item for item in overrides['entranceCorrections']}
with (root / 'reference-files/MTA_Subway_Entrances_and_Exits__2024_20260905-20261004.csv').open(encoding='utf-8-sig', newline='') as file:
    entrances = list(csv.DictReader(file))
for line, row in enumerate(entrances, 2):
    if line in corrections:
        correction = corrections[line]
        assert all(row[key] == value for key, value in correction['expect'].items())
        row.update(correction['set'])
names_ko = {'180': '킹스턴–스룹 애비뉴', '236': '버겐 스트리트', '265': '그랜드 애비뉴–뉴타운', '320': '23번가', '368': '모리슨 애비뉴–사운드뷰', '443': '베이체스터 애비뉴'}
names_ko.update({'55': '브라이턴 비치', '62': '55번가', '71': '8번 애비뉴', '278': '자메이카 센터–파슨스/아처', '327': '체임버스 스트리트', '383': '183번가', '392': '125번가', '409': '스프링 스트리트', '471': '34번가–허드슨 야즈'})
result = []
for row in archive:
    if voting_date == 'all':
        if row['votingDate'] in ['2027-01-01', '2027-01-04', '2027-04-01']:
            continue
        assert row['votingDate'], row['name']
    elif row['votingDate'] != voting_date or (voting_date == '2027-01-01' and row['stationIds'][0] in ['438', '143', '522']):
        continue
    station_id = row['stationIds'][0] if len(row['stationIds']) == 1 else row['id']
    source = [entry for entry in entrances if entry['Station ID'] in row['stationIds']]
    exits = []
    for index, entry in enumerate(source):
        kind = entry['Entrance Type']
        assert kind in ['Stair', 'Ramp', 'Elevator', 'Station House', 'Stair/Escalator', 'Escalator', 'Easement - Street', 'Easement - Passage', 'Underpass', 'Walkway', 'Overpass', 'Stair/Ramp', 'Stair/Ramp/Walkway']
        type_ko = {'Stair': '계단', 'Ramp': '경사로', 'Elevator': '엘리베이터', 'Station House': '역 출입구', 'Stair/Escalator': '계단/에스컬레이터', 'Escalator': '에스컬레이터', 'Easement - Street': '도로 연결 통로'}.get(kind, kind)
        label = ''
        ordinal = index + 1
        while ordinal:
            ordinal, digit = divmod(ordinal - 1, 26)
            label = chr(65 + digit) + label
        exits.append({'id': f"{station_id}-{float(entry['Entrance Latitude']):.6f}-{float(entry['Entrance Longitude']):.6f}", 'type': kind, 'description': {'en': f'{kind} · {label}', 'ko': f"{type_ko} · {label}"}, 'coordinates': {'latitude': float(entry['Entrance Latitude']), 'longitude': float(entry['Entrance Longitude'])}})
    assert len(exits) == row['exits'] + row['elevators']
    assert len({exit['id'] for exit in exits}) == len(exits)
    result.append({'id': station_id, 'stationId': station_id, 'gtfsStopId': row['members'][0]['gtfsStopIds'][0], 'name': {'en': row['name'], 'ko': names_ko.get(station_id, row['name'])}, 'services': row['regularServices'], 'exits': exits})
    if voting_date == 'all':
        result[-1]['metadata'] = {'votingDate': row['votingDate'], 'archiveId': row['id'], 'stationIds': row['stationIds'], 'complexIds': row['complexIds'], 'gtfsStopIds': [stop for member in row['members'] for stop in member['gtfsStopIds']]}
        if len(row['stationIds']) > 1:
            del result[-1]['stationId']
            del result[-1]['gtfsStopId']
if voting_date == 'all':
    expected = [row for row in archive if row['votingDate'] not in ['2027-01-01', '2027-01-04', '2027-04-01']]
    assert len(result) == len(expected) == 396
else:
    assert len(result) == {'2027-01-01': 6, '2027-01-04': 9, '2027-04-01': 30}[voting_date]
filename = {'2027-01-01': 'opening-ballot-additions.json', '2027-01-04': 'january4-ballot.json', '2027-04-01': 'april1-ballot.json', 'all': 'remaining-ballots.json'}[voting_date]
(root / 'src/data' / filename).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'Built {len(result)} additional stations with {sum(len(station["exits"]) for station in result)} access points')
