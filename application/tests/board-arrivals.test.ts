import { test } from 'node:test';
import assert from 'node:assert/strict';
import bindings from 'gtfs-realtime-bindings';
const { transit_realtime: gtfs } = bindings;
import { predictions } from '../src/services/boardArrivals';
import { weatherCondition } from '../src/services/boardWeather';

const data = { patterns: [['Terminal', ['A01N', 'A02N', 'A03N', 'A04N', 'A05N']]] as [string, string[]][], trips: { 'A:trip': 0 }, names: { A04N: 'Fourth', A05N: 'Terminal' } };
function feed() {
  return gtfs.FeedMessage.decode(gtfs.FeedMessage.encode(gtfs.FeedMessage.create({
    header: { gtfsRealtimeVersion: '2.0', timestamp: 1000 }, entity: [{ id: 'trip', tripUpdate: {
      trip: { tripId: 'trip', routeId: 'A' }, stopTimeUpdate: [
        { stopId: 'A03N', scheduleRelationship: 1 },
        { stopId: 'A04N', arrival: { time: 1060 }, departure: { time: 1075 } },
        { stopId: 'A05N', arrival: { time: 1200 } },
      ],
    } }, { id: 'vehicle', vehicle: { trip: { tripId: 'trip' }, stopId: 'A04N', timestamp: 995, currentStatus: 2 } }],
  })).finish());
}
test('browser decoding retains scheduled approach, terminal and vehicle timing', () => {
  const rows = predictions(feed(), new Set(['A04N']), 1000, data);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].destination, 'Terminal');
  assert.equal(rows[0].time, 1075);
  assert.equal(rows[0].event, 'departure');
  assert.deepEqual(rows[0].stops.map(stop => stop.id), ['A01N', 'A02N', 'A04N']);
  assert.deepEqual(rows[0].excludedStops, ['A03N']);
  assert.equal(rows[0].trainInTransit, true);
  assert.equal(rows[0].trainTimestamp, 995);
});
test('canceled trains and excluded stops do not become arrivals', () => {
  const message = feed();
  message.entity[0].tripUpdate!.trip.scheduleRelationship = 3;
  assert.deepEqual(predictions(message, new Set(['A04N']), 1000, data), []);
  assert.deepEqual(predictions(feed(), new Set(['A03N']), 1000, data), []);
});
test('a diverted trip does not inherit an incompatible scheduled pattern', () => {
  const message = feed();
  message.entity[0].tripUpdate!.stopTimeUpdate[0].scheduleRelationship = 0;
  message.entity[0].tripUpdate!.stopTimeUpdate[0].stopId = 'X01N';
  const rows = predictions(message, new Set(['A04N']), 1000, data);
  assert.deepEqual(rows[0].stops.map(stop => stop.id), ['X01N', 'A04N']);
});
test('weather categories retain freezing and thunder precedence', () => {
  assert.equal(weatherCondition('Freezing rain'), 'snow');
  assert.equal(weatherCondition('Thunderstorms and rain'), 'storm');
  assert.equal(weatherCondition('Overcast'), 'cloudy');
});
