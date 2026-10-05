import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Assignments, Station } from '../domain/types';

export interface StationMapProps {
    station: Station;
    assignments: Assignments;
    selectedExitId?: string;
    onSelectExit?: (id: string) => void;
    readOnly?: boolean;
}

export function StationMap({ station, assignments, selectedExitId, onSelectExit, readOnly = false }: StationMapProps) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    const container = useRef<HTMLDivElement>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const select = useRef(onSelectExit);
    const [tileError, setTileError] = useState(false);
    useEffect(() => { select.current = onSelectExit; }, [onSelectExit]);

    useEffect(() => {
        if (!container.current || !station.exits.some(e => e.coordinates)) return;
        const map = L.map(container.current, { maxZoom: 21, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxNativeZoom: 19, maxZoom: 21,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).on('tileerror', () => setTileError(true)).addTo(map);
        const points: L.LatLngTuple[] = [];
        const currentMarkers = markers.current;
        for (const entrance of station.exits) {
            if (!entrance.coordinates) continue;
            const { latitude, longitude } = entrance.coordinates;
            const point: L.LatLngTuple = [latitude, longitude];
            points.push(point);
            const marker = L.marker(point, {
                icon: L.divIcon({ className: 'entrance-marker', html: '+', iconSize: [28, 28], iconAnchor: [14, 14] }),
                keyboard: !readOnly, interactive: !readOnly, riseOnHover: true,
            }).addTo(map);
            if (!readOnly) marker.on('click', () => select.current?.(entrance.id));
            currentMarkers.set(entrance.id, marker);
        }
        const fit = () => {
            map.invalidateSize();
            map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 20 });
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(container.current);
        return () => { observer.disconnect(); currentMarkers.clear(); map.remove(); };
    }, [station, readOnly]);

    useEffect(() => {
        for (const entrance of station.exits) {
            const marker = markers.current.get(entrance.id);
            const element = marker?.getElement();
            if (!element || !marker) continue;
            const number = assignments[entrance.id];
            const selected = selectedExitId === entrance.id;
            element.textContent = number === undefined ? '+' : String(number);
            element.classList.toggle('numbered', number !== undefined);
            element.classList.toggle('is-selected', selected);
            const description = entrance.description[lang];
            const label = `${description}. ${number === undefined ? t('unassigned') : t('exit', { number })}`;
            element.setAttribute('aria-label', label);
            element.title = label;
            if (!readOnly) {
                element.setAttribute('role', 'button');
                element.setAttribute('aria-pressed', String(selected));
                element.setAttribute('aria-controls', `select-${entrance.id}`);
                element.onkeydown = event => {
                    if (event.key === ' ') { event.preventDefault(); select.current?.(entrance.id); }
                };
            }
            marker.setZIndexOffset(selected ? 1000 : 0);
            const tooltip = document.createElement('span');
            tooltip.textContent = description;
            if (marker.getTooltip()) marker.setTooltipContent(tooltip);
            else marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -14] });
            if (selected) marker.openTooltip(); else marker.closeTooltip();
        }
    }, [station, assignments, selectedExitId, lang, t, readOnly]);

    const hasCoordinates = station.exits.some(e => e.coordinates);
    return <div className="map-wrap">
        {hasCoordinates ? <div ref={container} className="station-map" role="region" aria-label={`${station.name[lang]} · ${t('mapLabel')}`} /> : <p>{t('mapUnavailable')}</p>}
        <div className="map-caption"><span>{t('mapNote')}</span>{!readOnly && <span>{t('mapHelp')}</span>}</div>
        {tileError && <p className="muted" role="status">{t('mapTileError')}</p>}
    </div>;
}
