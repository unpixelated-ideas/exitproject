import type { Station, StationProvider } from '../domain/types';
const descriptions = [
    { en: 'NW corner · Alder Avenue & Example Street', ko: '북서쪽 모퉁이 · 앨더 애비뉴와 예시 스트리트' },
    { en: 'NE corner · Alder Avenue & Example Street', ko: '북동쪽 모퉁이 · 앨더 애비뉴와 예시 스트리트' },
    { en: 'SW corner · Alder Avenue & Example Street', ko: '남서쪽 모퉁이 · 앨더 애비뉴와 예시 스트리트' },
    { en: 'SE corner · Alder Avenue & Example Street', ko: '남동쪽 모퉁이 · 앨더 애비뉴와 예시 스트리트' },
];
export const archivedStations: Station[] = [
    { id: 'mock-alder', name: { en: 'Alder Square', ko: '앨더 스퀘어' }, services: ['G'], exits: descriptions.map((description, i) => ({ id: `alder-portal-${String.fromCharCode(97 + i)}`, description })) },
    { id: 'mock-canal', name: { en: '207 St - Inwood', ko: '207번가 - 인우드' }, services: ['A'], exits: [{ id: 'paper-west', description: { en: 'West side · Paper Lane', ko: '서쪽 · 페이퍼 레인' } }, { id: 'paper-east', description: { en: 'East side · Paper Lane', ko: '동쪽 · 페이퍼 레인' } }, { id: 'paper-plaza', description: { en: 'South plaza · Model Avenue', ko: '남쪽 광장 · 모델 애비뉴' } }] },
    { id: 'mock-pocket', name: { en: 'Tottenville', ko: '토튼빌' }, services: ['SIR'], exits: [
        { id: 'pocket-gate', description: { en: 'Park entrance · Fiction Lane', ko: '공원 입구 · 픽션 레인' } },
        { id: 'pocket-east', description: { en: 'East side · Fiction Lane', ko: '동쪽 · 픽션 레인' } },
        { id: 'pocket-plaza', description: { en: 'South plaza · Pocket Avenue', ko: '남쪽 광장 · 포켓 애비뉴' } }
    ] }
];

// Coordinate-based entrance IDs remain stable when display order changes.
export const stations: Station[] = [
  {
    "id": "438",
    "stationId": "438",
    "gtfsStopId": "224",
    "name": {
      "en": "135 St",
      "ko": "135번가"
    },
    "services": [
      "2",
      "3"
    ],
    "exits": [
      {
        "id": "438-40.814032--73.941120",
        "type": "Stair",
        "description": {
          "en": "Stair · A",
          "ko": "계단 · A"
        },
        "coordinates": {
          "latitude": 40.814032,
          "longitude": -73.94112
        }
      },
      {
        "id": "438-40.814316--73.940910",
        "type": "Stair",
        "description": {
          "en": "Stair · B",
          "ko": "계단 · B"
        },
        "coordinates": {
          "latitude": 40.814316,
          "longitude": -73.94091
        }
      },
      {
        "id": "438-40.813913--73.940829",
        "type": "Stair",
        "description": {
          "en": "Stair · C",
          "ko": "계단 · C"
        },
        "coordinates": {
          "latitude": 40.813913,
          "longitude": -73.940829
        }
      },
      {
        "id": "438-40.814286--73.940560",
        "type": "Stair",
        "description": {
          "en": "Stair · D",
          "ko": "계단 · D"
        },
        "coordinates": {
          "latitude": 40.814286,
          "longitude": -73.94056
        }
      },
      {
        "id": "438-40.813994--73.941159",
        "type": "Elevator",
        "description": {
          "en": "Elevator · E",
          "ko": "엘리베이터 · E"
        },
        "coordinates": {
          "latitude": 40.813994,
          "longitude": -73.941159
        }
      },
      {
        "id": "438-40.814168--73.940640",
        "type": "Elevator",
        "description": {
          "en": "Elevator · F",
          "ko": "엘리베이터 · F"
        },
        "coordinates": {
          "latitude": 40.814168,
          "longitude": -73.94064
        }
      }
    ]
  },
  {
    "id": "143",
    "stationId": "143",
    "gtfsStopId": "A02",
    "name": {
      "en": "207 St - Inwood",
      "ko": "207번가 - 인우드"
    },
    "services": [
      "A"
    ],
    "exits": [
      {
        "id": "143-40.867835--73.921445",
        "type": "Stair",
        "description": {
          "en": "Stair · A",
          "ko": "계단 · A"
        },
        "coordinates": {
          "latitude": 40.867835,
          "longitude": -73.921445
        }
      },
      {
        "id": "143-40.867515--73.921348",
        "type": "Stair",
        "description": {
          "en": "Stair · B",
          "ko": "계단 · B"
        },
        "coordinates": {
          "latitude": 40.867515,
          "longitude": -73.921348
        }
      },
      {
        "id": "143-40.867892--73.921234",
        "type": "Elevator",
        "description": {
          "en": "Elevator · C",
          "ko": "엘리베이터 · C"
        },
        "coordinates": {
          "latitude": 40.867892,
          "longitude": -73.921234
        }
      },
      {
        "id": "143-40.867661--73.920939",
        "type": "Stair",
        "description": {
          "en": "Stair · D",
          "ko": "계단 · D"
        },
        "coordinates": {
          "latitude": 40.867661,
          "longitude": -73.920939
        }
      },
      {
        "id": "143-40.868294--73.919615",
        "type": "Stair",
        "description": {
          "en": "Stair · E",
          "ko": "계단 · E"
        },
        "coordinates": {
          "latitude": 40.868294,
          "longitude": -73.919615
        }
      },
      {
        "id": "143-40.868044--73.919291",
        "type": "Stair",
        "description": {
          "en": "Stair · F",
          "ko": "계단 · F"
        },
        "coordinates": {
          "latitude": 40.868044,
          "longitude": -73.919291
        }
      }
    ]
  },
  {
    "id": "522",
    "stationId": "522",
    "gtfsStopId": "S09",
    "name": {
      "en": "Tottenville",
      "ko": "토튼빌"
    },
    "services": [
      "SIR"
    ],
    "exits": [
      {
        "id": "522-40.513235--74.250972",
        "type": "Stair",
        "description": {
          "en": "Stair · A",
          "ko": "계단 · A"
        },
        "coordinates": {
          "latitude": 40.513235,
          "longitude": -74.250972
        }
      },
      {
        "id": "522-40.513400--74.251159",
        "type": "Stair",
        "description": {
          "en": "Stair · B",
          "ko": "계단 · B"
        },
        "coordinates": {
          "latitude": 40.5134,
          "longitude": -74.251159
        }
      },
      {
        "id": "522-40.512160--74.252936",
        "type": "Ramp",
        "description": {
          "en": "Ramp · C",
          "ko": "경사로 · C"
        },
        "coordinates": {
          "latitude": 40.51216,
          "longitude": -74.252936
        }
      },
      {
        "id": "522-40.512206--74.252832",
        "type": "Stair",
        "description": {
          "en": "Stair · D",
          "ko": "계단 · D"
        },
        "coordinates": {
          "latitude": 40.512206,
          "longitude": -74.252832
        }
      }
    ]
  }
];
export const stationProvider: StationProvider = { getStations: ids => ids.map(id => { const station = [...stations, ...archivedStations].find(s => s.id === id); if (!station) throw new Error(`Unknown station ${id}`); return station; }) };
