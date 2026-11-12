import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getTheme } from '../data/themes';
import { storage } from '../services/storage';
import { ServiceBullet } from './ServiceBullet';
import { availableLanguages, languages } from '../data/languages';
import { boardPlatforms, destinationBorough, platformDirections, stationServices } from '../data/boardPlatforms';
import { BoardFitText } from './BoardFitText';
import { BoardServicePicker } from './BoardServicePicker';
import { BoardStationSearch } from './BoardStationSearch';
import type { Appearance } from '../state/usePreferences';
import './display-board.css';
import './board-viewer.css';
import { koreanBoardStation } from '../data/boardKoreanNames';

const modes = ['information', 'color', 'led', 'seoul'] as const;
const limits = { information: 6, color: 2, led: 4, seoul: 2 };
const api = (import.meta.env.VITE_BOARD_API_URL || '/board-api').replace(/\/$/, '');
const zone = 'America/New_York';
type Mode = typeof modes[number];
type Station = { id: string; name: string };
type Stop = Station & { arrival?: number | null; departure?: number | null };
type Arrival = {
  tripId: string; platformId: string; service: string; direction: string;
  destination: string | null; feedTimestamp: number; time: number; event: 'arrival' | 'departure';
  stops: Stop[]; excludedStops?: string[];
  inferredStop?: { stop: Stop; at: number };
  missingSince?: number;
  trainStopId: string | null; trainTimestamp: number | null; trainInTransit?: boolean;
};
type Snapshot = {
  asOf: number; arrivals: Arrival[];
  feeds: { state: 'live' | 'delayed' | 'unavailable'; timestamp: number | null }[];
};
const arrivalHold = 15;
const trainExit = 4;
const positionGrace = 35;

function arrivalKey(row: Arrival) {
  return `${row.service}:${row.tripId}:${row.platformId}`;
}

function inferStop(previous: Arrival | undefined, row: Arrival, now: number) {
  if (!previous) return undefined;
  const prior = previous.stops.filter(stop => stop.arrival != null);
  const remaining = row.stops.filter(stop => stop.arrival != null);
  const dropped = prior.length - remaining.length;
  if (row.feedTimestamp > previous.feedTimestamp && now - row.feedTimestamp <= 60 &&
    dropped === 1 && remaining.length > 0 &&
    remaining.every((stop, index) => stop.id === prior[index + 1].id)) {
    const stop = prior[0];
    if (stop.arrival != null && Math.abs(stop.arrival - now) <= 30 &&
      !row.excludedStops?.includes(stop.id)) {
      return { stop, at: now };
    }
  }
  const inferred = previous.inferredStop;
  return inferred && !row.excludedStops?.includes(inferred.stop.id) &&
    !remaining.some(stop => stop.id === inferred.stop.id) ? inferred : undefined;
}

function sharedTrack(rows: Arrival[]) {
  const [first, second] = rows;
  if (!first || !second) return first?.stops ?? [];
  const [shorter, longer] = [first.stops, second.stops].sort((a, b) => a.length - b.length);
  let index = 0;
  for (const stop of longer) {
    if (stop.id === shorter[index]?.id) index++;
  }
  if (shorter.length > 1 && index === shorter.length) return longer;

  // When approaches diverge, retain only their identical tail after the merge.
  let shared = 0;
  while (shared < shorter.length &&
    shorter[shorter.length - 1 - shared].id === longer[longer.length - 1 - shared].id) shared++;
  return shared ? longer.slice(-shared) : [];
}

function retainArrivals(previous: Snapshot | undefined, next: Snapshot): Snapshot {
  if (!previous) return next;
  const keys = new Set(next.arrivals.map(arrivalKey));
  const previousByKey = new Map(previous.arrivals.map(row => [arrivalKey(row), row]));
  const updated = next.arrivals.map(row => {
    const inferredStop = inferStop(previousByKey.get(arrivalKey(row)), row, next.asOf);
    const stops = inferredStop && row.stops.length < 4 && !row.stops.some(stop => stop.id === inferredStop.stop.id)
      ? [{ id: inferredStop.stop.id, name: inferredStop.stop.name }, ...row.stops] : row.stops;
    return { ...row, inferredStop, stops };
  });
  const retained = previous.arrivals.flatMap(row => {
    if (keys.has(arrivalKey(row))) return [];
    if (row.missingSince === undefined && next.asOf >= row.time - 15 &&
      next.asOf < row.time + arrivalHold + trainExit) {
      return [{ ...row, time: Math.min(row.time, next.asOf) }];
    }
    const missingSince = row.missingSince ?? next.asOf;
    return next.asOf < row.time && next.asOf - missingSince < positionGrace
      ? [{ ...row, missingSince }] : [];
  });
  return { ...next, arrivals: [...updated, ...retained].sort((a, b) => a.time - b.time) };
}

function predictedTrainPosition(row: Arrival, track: Stop[], now: number) {
  let previousIndex = -0.5;
  let departure: number | undefined;
  const inferred = row.inferredStop;
  if (inferred) {
    const index = track.findIndex(stop => stop.id === inferred.stop.id);
    if (index >= 0 && now <= inferred.at + arrivalHold) return index;
  }
  for (const stop of row.stops) {
    const index = track.findIndex(item => item.id === stop.id);
    const inferredArrival = inferred?.stop.id === stop.id ? inferred.at : undefined;
    const arrival = stop.id === row.platformId ? row.time : inferredArrival ?? stop.arrival;
    if (index < 0 || arrival == null) continue;
    const start = departure ?? arrival - 30;
    if (now < arrival) {
      if (now < start) return undefined;
      const progress = (now - start) / (arrival - start);
      return previousIndex + (index - previousIndex) * progress;
    }
    previousIndex = index;
    departure = inferredArrival !== undefined ? arrival + arrivalHold : Math.max(arrival, stop.departure ?? arrival);
    if (now <= departure) return index;
  }
  return undefined;
}

function trainPosition(row: Arrival, track: Stop[], now: number) {
  if (!row.trainTimestamp || now - row.trainTimestamp > 60) {
    return predictedTrainPosition(row, track, now);
  }
  const nextIndex = track.findIndex(stop => stop.id === row.trainStopId);
  if (nextIndex < 0) return undefined;
  const atBoardStation = row.trainStopId === row.platformId;
  if (!row.trainInTransit && !atBoardStation) return nextIndex;

  const tripIndex = row.stops.findIndex(stop => stop.id === row.trainStopId);
  const next = row.stops[tripIndex];
  const arrival = atBoardStation ? row.time : next?.arrival;
  const previous = row.stops[tripIndex - 1];
  const previousIndex = track.findIndex(stop => stop.id === previous?.id);
  if (nextIndex === 0) {
    const duration = Math.max(1, (arrival ?? row.trainTimestamp) - row.trainTimestamp);
    const progress = Math.max(0, Math.min(0.98, (now - row.trainTimestamp) / duration));
    return -0.5 + 0.5 * progress;
  }
  if (previousIndex < 0 || previousIndex >= nextIndex || !arrival) {
    return predictedTrainPosition(row, track, now);
  }
  const inferred = row.inferredStop;
  const scheduledStart = inferred && inferred.stop.id === previous.id
    ? inferred.at + arrivalHold : previous.departure ?? previous.arrival;
  const start = scheduledStart ?? row.trainTimestamp;
  if (arrival <= start) return predictedTrainPosition(row, track, now);
  const progress = Math.max(0, Math.min(1, (now - start) / (arrival - start)));
  return previousIndex + (nextIndex - previousIndex) * progress;
}

function bridgePosition(row: Arrival, track: Stop[], seconds: number, last?: { index: number; at: number }) {
  if (!last || seconds - last.at >= positionGrace) return undefined;
  const next = track.findIndex((stop, index) => index > last.index &&
    row.stops.some(item => item.id === stop.id && item.arrival != null && item.arrival > last.at));
  if (next < 0) return last.index;
  const arrival = row.stops.find(stop => stop.id === track[next].id)?.arrival;
  if (arrival == null) return last.index;
  const progress = Math.max(0, Math.min(0.98, (seconds - last.at) / (arrival - last.at)));
  return last.index + (next - last.index) * progress;
}

function remapTrackPosition(position: number, previous: string[], next: string[]) {
  if (previous.length === next.length && previous.every((id, index) => id === next[index])) return position;
  let left: { from: number; to: number } | undefined;
  for (const [from, id] of previous.entries()) {
    const to = next.indexOf(id);
    if (to < 0) continue;
    if (from === position) return to;
    if (from < position) {
      left = { from, to };
    } else {
      return left && left.to < to
        ? left.to + (to - left.to) * (position - left.from) / (from - left.from)
        : undefined;
    }
  }
  return undefined;
}

function TrainMarker({ row, track, seconds, label }: {
  row: Arrival; track: Stop[]; seconds: number; label: string;
}) {
  const elapsed = seconds - row.time;
  const measured = elapsed >= 0 ? track.length - 1 : trainPosition(row, track, seconds);
  const offscreen = elapsed < 0 && row.trainTimestamp && seconds - row.trainTimestamp <= 60 &&
    !track.some(stop => stop.id === row.trainStopId);
  const [last, setLast] = useState<{ index: number; at: number; rendered: number; trackIds: string[] }>();
  const trackIds = track.map(stop => stop.id);
  const trackSignature = trackIds.join(',');
  const mappedIndex = last && remapTrackPosition(last.index, last.trackIds, trackIds);
  const mappedRendered = last && remapTrackPosition(last.rendered, last.trackIds, trackIds);
  const mapped = last && mappedIndex !== undefined && mappedRendered !== undefined
    ? { index: mappedIndex, at: last.at, rendered: mappedRendered } : undefined;
  const estimate = measured ?? bridgePosition(row, track, seconds, mapped);
  // A revised ETA can put a train back on approach after it reached the marker.
  const remembered = elapsed < 0 && mapped?.rendered === track.length - 1
    ? undefined : mapped?.rendered;
  const position = offscreen || estimate === undefined ? undefined
    : Math.max(estimate, remembered ?? estimate);

  useEffect(() => {
    if (offscreen) setLast(undefined);
    else if (position !== undefined) {
      const ids = trackSignature.split(',');
      setLast(previous => {
        if (measured !== undefined) return { index: position, at: seconds, rendered: position, trackIds: ids };
        if (previous && mappedIndex !== undefined) {
          return { ...previous, index: mappedIndex, rendered: position, trackIds: ids };
        }
        return previous;
      });
    }
  }, [measured, offscreen, position, seconds, mappedIndex, trackSignature]);

  if (position === undefined) return null;
  const at = (position + 0.5) / track.length * 100;
  const offset = Math.max(0, Math.min(1, (elapsed - arrivalHold) / (trainExit - 1)));
  return <TrainIcon service={row.service} label={label} at={at} offset={offset} entering={position <= 0} />;
}

function TrainIcon({ service, label, at, offset, entering }: {
  service: string; label: string; at: number; offset: number; entering: boolean;
}) {
  // Keep the entrance animation active even if the train begins its next segment.
  const [entry] = useState(() => entering ? at : undefined);
  return <span className={entry !== undefined ? 'board-train entering' : 'board-train'}
    style={{
      insetInlineStart: `calc(${at + (100 - at) * offset}% + ${offset} * var(--board-train-width))`,
      color: getTheme(service)?.color,
      '--board-train-entry': entry === undefined ? undefined : `${entry}cqw`,
    } as CSSProperties}
    title={label} aria-hidden="true">
    <svg viewBox="0 0 42 24">
      <rect x="2" y="1" width="38" height="19" rx="7" fill="#fff" />
      <path d="M2 8a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v5H2Z" fill="currentColor" />
      <path d="M7 5h10v5H7zm18 0h10v5H25z" fill="#f1f4fa" />
      <circle cx="11" cy="20" r="3" fill="#fff" />
      <circle cx="31" cy="20" r="3" fill="#fff" />
    </svg>
    <span className="board-train-bullet"><ServiceBullet id={service} decorative /></span>
  </span>;
}

const weatherSymbols = {
  clear: '☀', cloudy: '☁', rain: '☂', snow: '❄', storm: 'ϟ', fog: '≋', unknown: '◌',
};
type Weather = { celsius: number; condition: keyof typeof weatherSymbols; observedAt: number };

const koreanNames: Record<string, string> = {
  'Tottenville': '토튼빌', 'St George': '세인트조지',
  'Times Sq-42 St/Port Authority Bus Terminal': '타임스 스퀘어–42번가 / 포트 오소리티 버스 터미널',
  '59 St-Columbus Circle': '59번가–컬럼버스 서클', '135 St': '135번가', 'Inwood-207 St': '인우드–207번가',
};

function BilingualBoardStation({ english, korean }: { english: string; korean: string }) {
  return <span className="board-bilingual-station">
    <BoardFitText text={korean} />
    <small lang="en"><BoardFitText text={english} /></small>
  </span>;
}

function saved(key: string, fallback: string) {
  const value = storage.read(`board:${key}`);
  return typeof value === 'string' ? value : fallback;
}

export default function DisplayBoard({ query, appearance, setAppearance }: {
  query?: string;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}) {
  const { t, i18n } = useTranslation();
  const [shared] = useState(() => new URLSearchParams(query));
  const [station, setStation] = useState(() => {
    const id = shared.get('station') ?? saved('station', '611');
    return boardPlatforms.has(id) ? id : '611';
  });
  const [mode, setMode] = useState<Mode>(() =>
    modes.find(item => item === (shared.get('style') ?? saved('mode', ''))) ?? 'information');
  const [service, setService] = useState(() => {
    const value = shared.get('service') ?? (query ? 'all' : saved('service', 'all'));
    return value === 'all' || getTheme(value) || boardPlatforms.get(station)?.some(
      platform => value === `platform:${platform.gtfs_stop_id}`
    ) ? value : 'all';
  });
  const [direction, setDirection] = useState(() => {
    const value = shared.get('direction') ?? (query ? 'all' : saved('platform-direction', 'all'));
    return boardPlatforms.get(station)?.some(platform =>
      platform.north_direction_label === value || platform.south_direction_label === value
    ) ? value : 'all';
  });
  const [approach, setApproach] = useState(() => shared.get('approach') ?? (query ? '' : saved('seoul-approach', '')));
  const [clockFormat, setClockFormat] = useState(() =>
    shared.get('clock') ?? (query ? 'default' : saved('clock-format', 'default')));
  const [showDirectionDetail, setShowDirectionDetail] = useState(() =>
    (shared.get('detail') ?? (query ? 'on' : saved('color-detail', 'on'))) !== 'off');
  const [darkBoard, setDarkBoard] = useState(() =>
    (shared.get('colorTheme') ?? (query ? 'light' : saved('color-theme', 'light'))) === 'dark');
  const [weatherEnabled, setWeatherEnabled] = useState(() =>
    (shared.get('weather') ?? (query ? 'on' : saved('weather', 'on'))) !== 'off');
  const [weatherUnit, setWeatherUnit] = useState(() =>
    (shared.get('units') ?? (query ? 'f' : saved('weather-unit', 'f'))) === 'c' ? 'c' : 'f');
  const [weather, setWeather] = useState<{ station: string; observation: Weather }>();
  const [copyStatus, setCopyStatus] = useState<'copied' | 'manual'>();
  const [manualLink, setManualLink] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [presenting, setPresenting] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number>();
  const panel = useRef<HTMLElement>(null);
  const screen = useRef<HTMLElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const language = i18n.resolvedLanguage === 'ko' ? 'ko' : 'en';
  const name = (label: string) => {
    const base = label.replace(/ \([^()]+\)$/, '');
    return language === 'ko' && koreanNames[base] ? label.replace(base, koreanNames[base]) : label;
  };

  useEffect(() => {
    const requested = shared.get('lang');
    if (requested && availableLanguages.has(requested)) void i18n.changeLanguage(requested);
  }, [i18n, shared]);

  useEffect(() => {
    storage.write('board:clock-format', clockFormat);
    storage.write('board:color-detail', showDirectionDetail ? 'on' : 'off');
    storage.write('board:color-theme', darkBoard ? 'dark' : 'light');
    storage.write('board:weather', weatherEnabled ? 'on' : 'off');
    storage.write('board:weather-unit', weatherUnit);
  }, [clockFormat, showDirectionDetail, darkBoard, weatherEnabled, weatherUnit]);

  useEffect(() => {
    if (mode !== 'color' || !weatherEnabled) return;
    const controller = new AbortController();
    let timer: number;
    async function loadWeather() {
      let delay = 600_000;
      try {
        const response = await fetch(`${api}/weather?station=${encodeURIComponent(station)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const observation: Weather = await response.json();
        if (!controller.signal.aborted) setWeather({ station, observation });
      } catch {
        delay = 60_000;
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(loadWeather, delay);
      }
    }
    void loadWeather();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [station, mode, weatherEnabled]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    async function loadStations() {
      try {
        const response = await fetch(`${api}/stations`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const list: Station[] = await response.json();
        if (!controller.signal.aborted) setStations(list);
      } catch {
        if (!controller.signal.aborted) timer = window.setTimeout(loadStations, 15000);
      }
    }
    void loadStations();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    async function refresh() {
      try {
        const response = await fetch(`${api}/arrivals?station=${encodeURIComponent(station)}`, { signal: controller.signal });
        if (!response.ok && response.status !== 503) throw new Error();
        const result: Snapshot = await response.json();
        if (!controller.signal.aborted) {
          setSnapshot(previous => retainArrivals(previous, result));
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(refresh, 25000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [station]);
  useEffect(() => {
    const onFullscreen = () => { if (!document.fullscreenElement) setPresenting(false); };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);
  useEffect(() => {
    if (!presenting) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('keydown', exit);
    return () => document.removeEventListener('keydown', exit);
  }, [presenting]);
  useEffect(() => {
    storage.write('board:station', station);
    storage.write('board:mode', mode);
    storage.write('board:service', service);
    storage.write('board:platform-direction', direction);
    storage.write('board:seoul-approach', approach);
  }, [station, mode, service, direction, approach]);

  async function toggleFullscreen() {
    if (presenting) {
      if (document.fullscreenElement === screen.current) await document.exitFullscreen();
      setPresenting(false);
    } else {
      const board = panel.current;
      if (!board) return;
      setPreviewWidth(board.clientWidth);
      setPresenting(true);
      await screen.current?.requestFullscreen?.().catch(() => {});
    }
  }

  const platforms = boardPlatforms.get(station) ?? [];
  const groups = platforms.filter(platform => stationServices(platform.daytime_routes).length > 1);
  const stationRoutes = new Set(platforms.flatMap(platform => stationServices(platform.daytime_routes)));
  for (const row of snapshot?.arrivals ?? []) stationRoutes.add(row.service);
  const group = groups.find(platform => service === `platform:${platform.gtfs_stop_id}`);
  const activePlatforms = group ? [group] : platforms.filter(platform =>
    service === 'all' || stationServices(platform.daytime_routes).includes(service) ||
    snapshot?.arrivals.some(row => row.service === service && row.platformId.slice(0, -1) === platform.gtfs_stop_id));
  const directions = [...new Set(activePlatforms.flatMap(platform =>
    [platform.north_direction_label, platform.south_direction_label]).filter(Boolean))];
  const directionName = (label: string) => t(`board.directions.${label}`, { defaultValue: name(label) });
  const approaches = activePlatforms.flatMap(platform => ['N', 'S'].map(side => platform.gtfs_stop_id + side));
  const needsApproach = mode === 'seoul' && !approaches.includes(approach);
  const seconds = now / 1000;
  const feedStates = snapshot?.feeds.map(feed => {
    if (!feed.timestamp || seconds - feed.timestamp > 90) return 'unavailable';
    return seconds - feed.timestamp > 60 ? 'delayed' : feed.state;
  });
  const unavailable = feedStates?.every(state => state === 'unavailable') || (failed && !snapshot);
  const delayed = !unavailable && (failed || feedStates?.some(state => state !== 'live'));
  const candidates = unavailable || needsApproach ? [] : (snapshot?.arrivals ?? []).filter(row =>
    seconds - row.feedTimestamp <= 90 &&
    (row.missingSince === undefined || (mode === 'seoul' && seconds - row.missingSince < positionGrace && seconds < row.time)) &&
    seconds < row.time + arrivalHold + (mode === 'seoul' ? trainExit : 0) && (service === 'all' || (group ? row.platformId.slice(0, -1) === group.gtfs_stop_id : row.service === service)) &&
    (mode === 'seoul' ? row.platformId === approach
      : direction === 'all' || platformDirections.get(row.platformId) === direction));
  const arrivals = candidates.filter(row => seconds < row.time + arrivalHold).slice(0, limits[mode]);
  const exiting = mode === 'seoul' ? candidates.filter(row => seconds >= row.time + arrivalHold) : [];
  const first = arrivals[0] ?? exiting[0];
  const trackStops = sharedTrack(arrivals.length ? arrivals : exiting);
  const singleStop = mode === 'seoul' && !needsApproach && !!first && trackStops.length < 2;
  const blocked = needsApproach || singleStop;
  useLayoutEffect(() => {
    const viewport = screen.current;
    const board = panel.current;
    if (!presenting || blocked || !viewport || !board) return;

    function fitBoard() {
      if (!viewport || !board || !board.offsetWidth || !board.offsetHeight) return;
      const scale = Math.min(viewport.clientWidth / board.offsetWidth, viewport.clientHeight / board.offsetHeight);
      board.style.setProperty('--board-fullscreen-scale', String(scale));
    }

    fitBoard();
    const observer = new ResizeObserver(fitBoard);
    observer.observe(viewport);
    observer.observe(board);
    return () => observer.disconnect();
  }, [presenting, blocked]);

  const selected = stations.find(item => item.id === station);
  const stationTitle = selected ? name(selected.name) : t('board.title');
  const showDestinationDetail = mode === 'information' || mode === 'color';
  const showHeaderBullets = showDestinationDetail || mode === 'seoul' || mode === 'led';
  const stationServicesSuffix = showHeaderBullets ? stationTitle.match(/ \(([^()]+)\)$/) : null;
  const headerServices = stationServicesSuffix?.[1].split(',').map(route => route.trim()) ?? [];
  const clockOptions = ['12', '24', ...(language === 'ko' ? ['ko', 'ko12'] : [])];
  const effectiveClockFormat = clockOptions.includes(clockFormat) ? clockFormat : mode === 'seoul' ? '24' : '12';
  const koreanClock = effectiveClockFormat === 'ko' || effectiveClockFormat === 'ko12';
  const is24Hour = effectiveClockFormat === '24' || effectiveClockFormat === 'ko';
  const clockParts = mode === 'led' ? [] : new Intl.DateTimeFormat(language, {
    timeZone: zone,
    hour: is24Hour && !koreanClock ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...(mode === 'information' && !koreanClock ? { second: '2-digit' } : {}),
    hourCycle: is24Hour ? 'h23' : 'h12',
  }).formatToParts(now);
  const clock = koreanClock && mode !== 'led' ? t(is24Hour ? 'board.koreanClockTime' : 'board.koreanClockTime12', {
    period: clockParts.find(part => part.type === 'dayPeriod')?.value,
    hour: Number(clockParts.find(part => part.type === 'hour')?.value),
    minute: Number(clockParts.find(part => part.type === 'minute')?.value),
  }) : clockParts.map(part => part.value).join('').trim();
  const status = unavailable ? 'unavailable' : delayed ? 'delayed' : !snapshot ? 'loading' : !arrivals.length ? 'empty' : '';

  const currentWeather = weatherEnabled && weather?.station === station &&
    seconds - weather.observation.observedAt < 7200 ? weather.observation : undefined;
  const temperature = currentWeather && Math.round(weatherUnit === 'c'
    ? currentWeather.celsius : currentWeather.celsius * 9 / 5 + 32);

  async function copyLink() {
    const params = new URLSearchParams({ station, style: mode, service, direction, lang: language });
    params.set('clock', effectiveClockFormat);
    params.set('detail', showDirectionDetail ? 'on' : 'off');
    params.set('colorTheme', darkBoard ? 'dark' : 'light');
    params.set('weather', weatherEnabled ? 'on' : 'off');
    params.set('units', weatherUnit);
    if (approaches.includes(approach)) params.set('approach', approach);
    const url = new URL(window.location.href);
    url.hash = `/display-board?${params}`;
    try {
      await navigator.clipboard.writeText(url.href);
      setCopyStatus('copied');
    } catch {
      setManualLink(url.href);
      setCopyStatus('manual');
    }
  }

  function chooseMode(next: Mode) {
    if (next === 'seoul' && !approaches.includes(approach) && direction !== 'all') {
      const matching = approaches.filter(id => platformDirections.get(id) === direction);
      if (matching.length === 1) setApproach(matching[0]);
    }
    setMode(next);
  }

  return <main id="main" tabIndex={-1} className="display-board" data-mode={mode} data-presenting={presenting} ref={screen}>
    {!presenting && <>
      <div className="board-viewer-heading">
        <div><a className="board-home-link" href="#/">← {t('backToProject')}</a><h1>{t('board.viewerTitle')}</h1></div>
        <button className="board-viewer-action" onClick={() => settings.current?.showModal()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6" />
          </svg>
          {t('board.viewerSettings')}
        </button>
      </div>
      <div className="board-controls">
      <BoardStationSearch stations={stations} selected={selected} displayName={name} onSelect={id => {
        if (id === station) return;
        setSnapshot(undefined); setFailed(false); setStation(id);
        setService('all'); setDirection('all'); setApproach('');
      }} />
      <fieldset className="board-styles">
        <legend>{t('board.mode')}</legend>
        <div className="board-style-grid">
          {modes.map(item => <label key={item} className="board-style-card">
            <input className="sr-only" type="radio" name="board-style" value={item}
              checked={mode === item} onChange={() => chooseMode(item)} />
            <span className="board-style-card-content">
              <span className="board-style-art" aria-hidden="true">
                <span className="board-style-mini" data-style={item}>
                  <i /><i /><i /><i /><i /><i />
                </span>
              </span>
              <span>{t(`board.${item}`)}{item === 'seoul' && <span className="board-style-beta">{t('board.beta')}</span>}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <div className="board-filters">
      <BoardServicePicker value={service} routes={[...stationRoutes]}
        groups={platforms.length > 1 ? groups.map(platform => ({
          value: `platform:${platform.gtfs_stop_id}`,
          routes: stationServices(platform.daytime_routes),
        })) : []}
        onSelect={value => {
          if (value === service) return;
          setService(value); setDirection('all'); setApproach('');
        }} />
      {mode === 'seoul' ? <label>{t('board.approach')}<select value={needsApproach ? '' : approach}
        onChange={event => setApproach(event.target.value)}>
        <option value="" disabled>{t('board.chooseApproach')}</option>
        {approaches.map(id => {
          const platform = activePlatforms.find(item => item.gtfs_stop_id === id.slice(0, -1));
          const label = platformDirections.get(id);
          return <option key={id} value={id}>
            {label ? directionName(label) : id}{platform && activePlatforms.length > 1
              ? ` · ${stationServices(platform.daytime_routes).join(' / ')}` : ''}
          </option>;
        })}
      </select></label> : <label>{t('board.direction')}<select value={direction} onChange={event => setDirection(event.target.value)}>
        <option value="all">{t('board.allDirections')}</option>
        {directions.map(label => <option key={label} value={label}>{directionName(label)}</option>)}
      </select></label>}
      <label>{t('language')}<select value={language} onChange={event => void i18n.changeLanguage(event.target.value)}>
        {languages.map(([code, label]) => <option key={code} value={code} disabled={!availableLanguages.has(code)}>
          {label}{availableLanguages.has(code) ? '' : ` · ${t('soon')}`}
        </option>)}
      </select></label>
      </div>
      </div>
      <dialog className="board-viewer-settings" ref={settings} aria-labelledby="board-settings-title">
        <form method="dialog" className="board-settings-heading">
          <h2 id="board-settings-title">{t('board.viewerSettings')}</h2>
          <button className="board-viewer-action">{t('board.closeSettings')}</button>
        </form>
        <fieldset className="board-website-appearance">
          <legend>{t('board.websiteAppearance')}</legend>
          <div className="board-appearance-options">
            {(['system', 'light', 'dark'] as const).map(value => <label key={value}>
              <input className="sr-only" type="radio" name="board-website-theme" value={value}
                checked={appearance === value} onChange={() => setAppearance(value)} />
              <span>{t(value)}</span>
            </label>)}
          </div>
        </fieldset>
        <div className="board-upcoming">
          <h3>{t('board.moreSettings')}</h3>
          {mode !== 'led' && <div className="board-weather-settings">
            <label>{t('board.clockFormat')}<select
              value={effectiveClockFormat}
              onChange={event => setClockFormat(event.target.value)}>
              <option value="12">{t('board.clock12')}</option>
              <option value="24">{t('board.clock24')}</option>
              {language === 'ko' && <>
                <option value="ko12">{t('board.koreanClock12')}</option>
                <option value="ko">{t('board.koreanClock')}</option>
              </>}
            </select></label>
          </div>}
          {mode === 'color' && <div className="board-weather-settings">
            <label><input type="checkbox" checked={showDirectionDetail}
              onChange={event => setShowDirectionDetail(event.target.checked)} />{t('board.showDirectionDetail')}</label>
            <label><input type="checkbox" checked={darkBoard}
              onChange={event => setDarkBoard(event.target.checked)} />{t('board.darkBoard')}</label>
            <label><input type="checkbox" checked={weatherEnabled}
              onChange={event => setWeatherEnabled(event.target.checked)} />{t('board.showWeather')}</label>
            <label>{t('board.units')}<select value={weatherUnit} disabled={!weatherEnabled}
              onChange={event => setWeatherUnit(event.target.value === 'c' ? 'c' : 'f')}>
              <option value="f">{t('board.fahrenheit')}</option>
              <option value="c">{t('board.celsius')}</option>
            </select></label>
          </div>}
          {mode === 'led' && <p>{t('board.noLedCustomization')}</p>}
        </div>
      </dialog>
    </>}
    <div className="board-preview">
      <div className="board-preview-toolbar">
        {!presenting && <h2>{t('board.preview')}</h2>}
        <div className="board-preview-actions">
        {!presenting && <button className="board-viewer-action" onClick={() => void copyLink()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M10 13l4-4m-6 6-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 8a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1" />
          </svg>
          {t('board.copyLink')}
        </button>}
        <button className="board-viewer-action board-fullscreen" disabled={blocked && !presenting} onClick={() => void toggleFullscreen()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d={presenting ? 'M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6' : 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6'} />
          </svg>
          {t(presenting ? 'board.exit' : 'board.fullscreen')}
        </button>
        </div>
      </div>
    {!presenting && copyStatus === 'copied' && <p className="board-share-status" role="status">{t('board.linkCopied')}</p>}
    {!presenting && copyStatus === 'manual' && <label className="board-share-status">{t('board.copyLinkManual')}
      <input value={manualLink} readOnly onFocus={event => event.currentTarget.select()} />
    </label>}
    {blocked ? <section className="board-preview-empty" aria-labelledby="board-empty-title">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 7h14m-4-4 4 4-4 4M19 17H5m4-4-4 4 4 4" />
      </svg>
      <h3 id="board-empty-title">{t(singleStop ? 'board.singleStopTitle' : 'board.chooseApproach')}</h3>
      <p>{singleStop ? t('board.singleStopHelp') : selected ? t('board.chooseApproachForStation', {
        station: stationTitle.replace(/ \([^()]+\)$/, ''),
      }) : t('board.chooseApproachHelp')}</p>
    </section> : <section className="board-panel" ref={panel}
      style={presenting ? { width: previewWidth } : undefined} data-color-theme={mode === 'color' && darkBoard ? 'dark' : undefined}
      aria-label={t('board.title')}>
      <div className="board-heading">
        <h1>{showHeaderBullets ? <>
          <BoardFitText text={stationServicesSuffix ? stationTitle.slice(0, stationServicesSuffix.index) : stationTitle} />
          {headerServices.length > 0 && <span className="board-heading-bullets">
            {headerServices.map(route => <ServiceBullet key={route} id={route} />)}
          </span>}
        </> : stationTitle}</h1>
        {mode !== 'color' && clock && <time>{clock}</time>}
        {mode === 'seoul' && <span>{new Intl.DateTimeFormat(language, { timeZone: zone, dateStyle: 'full' }).format(now)}</span>}
      </div>
      <ol className="board-arrivals">
        {arrivals.map((row, index) => {
          const label = platformDirections.get(row.platformId);
          const destination = row.destination ? name(row.destination) : label ? directionName(label) : t('board.train');
          const koreanDestination = language === 'ko' && row.destination
            ? koreanBoardStation(row.destination) : undefined;
          const bilingual = koreanDestination && row.destination
            ? <BilingualBoardStation english={row.destination} korean={koreanDestination} /> : null;
          const forestHills = row.destination === 'Forest Hills-71 Av';
          const borough = row.destination ? destinationBorough(row.destination) : undefined;
          const terminusDetail = forestHills ? name('71 Av') : borough
            ? t(`directory.boroughs.${borough}`) : undefined;
          const minutes = Math.max(0, Math.ceil((row.time - seconds) / 60));
          return <li key={`${row.service}:${row.tripId}:${row.platformId}`} data-due={minutes === 0}>
            {mode === 'color' && <span className="board-rank" aria-hidden="true">{index + 1}.</span>}
            <ServiceBullet id={row.service} />
            <div className="board-destination">
              {mode !== 'seoul' && bilingual ? <strong>{bilingual}</strong> : showDestinationDetail ? <>
                <strong><BoardFitText text={forestHills ? name('Forest Hills') : destination} /></strong>
                {terminusDetail && (mode !== 'color' || showDirectionDetail) && <small><BoardFitText text={terminusDetail} /></small>}
              </> : <strong>{mode === 'seoul' ? <BoardFitText text={label ? directionName(label) : '–'} /> : destination}</strong>}
            </div>
            {mode === 'seoul' && <span className="board-terminus">{bilingual ?? <BoardFitText text={row.destination ? name(row.destination) : '–'} />}</span>}
            <span className="board-minutes">
              <span>{minutes}</span><small>{t('board.minuteUnit')}</small>
            </span>
          </li>;
        })}
      </ol>
      {mode === 'seoul' && first && <div className="board-track-wrap">
        {[...exiting, ...arrivals].map(row => <TrainMarker
          key={arrivalKey(row)}
          row={row} track={trackStops} seconds={seconds}
          label={`${row.service} · ${t('board.estimatedTrainPosition')}`} />)}
        <ol className="board-track" style={{ borderColor: getTheme(first?.service ?? '')?.color }}>
          {trackStops.map(stop => {
            const korean = language === 'ko' ? koreanBoardStation(stop.name) : undefined;
            return <li key={stop.id}>{korean
              ? <BilingualBoardStation english={stop.name} korean={korean} />
              : name(stop.name)}</li>;
          })}
        </ol>
      </div>}
      {(status || mode === 'color') && <div className="board-footer">
        {mode === 'color' && <div className="board-clock-weather">
          <time>{clock}</time>
          {currentWeather && <span className="board-weather"
            title={t(`board.conditions.${currentWeather.condition}`)}>
            <span aria-hidden="true">{weatherSymbols[currentWeather.condition] ?? weatherSymbols.unknown}</span>
            <span className="sr-only">{t(`board.conditions.${currentWeather.condition}`)}</span>
            {temperature}°{weatherUnit.toUpperCase()}
          </span>}
        </div>}
        {status && <span role="status">{t(`board.${status}`)}</span>}
      </div>}
    </section>}
    </div>
  </main>;
}
