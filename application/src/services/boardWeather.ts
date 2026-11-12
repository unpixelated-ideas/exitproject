import { boardPlatforms } from '../data/boardPlatforms';

export function weatherCondition(description: string) {
  const text = description.toLowerCase();
  const categories = {
    storm: ['thunder'], snow: ['snow', 'sleet', 'ice', 'freezing'], rain: ['rain', 'drizzle', 'shower'],
    fog: ['fog', 'mist', 'haze', 'smoke'], cloudy: ['cloud', 'overcast'], clear: ['clear', 'fair', 'sunny'],
  } as const;
  for (const [category, words] of Object.entries(categories)) {
    if (words.some(word => text.includes(word))) return category as keyof typeof categories;
  }
  return 'unknown' as const;
}
async function nws(url: string, signal: AbortSignal) {
  if (new URL(url).origin !== 'https://api.weather.gov') throw new Error('Unexpected weather URL');
  // Browsers supply their own User-Agent; NWS permits cross-origin requests.
  const response = await fetch(url, { signal, headers: { Accept: 'application/geo+json' } });
  if (!response.ok) throw new Error('Weather unavailable');
  return response.json();
}
const nearby = new Map<string, string[]>();
export async function loadBoardWeather(station: string, signal: AbortSignal) {
  const platform = boardPlatforms.get(station)?.[0];
  if (!platform) throw new Error('Unknown station');
  const point = `${Number(platform.gtfs_latitude).toFixed(2)},${Number(platform.gtfs_longitude).toFixed(2)}`;
  let identifiers = nearby.get(point);
  if (!identifiers) {
    const location = await nws(`https://api.weather.gov/points/${point}`, signal);
    const stations = await nws(location.properties.observationStations, signal);
    identifiers = stations.features.slice(0, 3).map((item: { properties: { stationIdentifier: string } }) => item.properties.stationIdentifier) as string[];
    nearby.set(point, identifiers);
  }
  for (const identifier of identifiers) {
    try {
      const { properties } = await nws(`https://api.weather.gov/stations/${encodeURIComponent(identifier)}/observations/latest`, signal);
      const celsius = properties.temperature.value;
      const observedAt = Date.parse(properties.timestamp) / 1000;
      if (typeof celsius === 'number' && Number.isFinite(celsius) && Number.isFinite(observedAt) && Date.now() / 1000 - observedAt < 7200) {
        return { celsius, condition: weatherCondition(properties.textDescription ?? ''), observedAt };
      }
    } catch (error) { if (signal.aborted) throw error; }
  }
  throw new Error('No recent weather observation');
}
