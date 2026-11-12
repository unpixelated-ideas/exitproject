import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ServiceBullet } from './ServiceBullet';

type Station = { id: string; name: string };

function searchable(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function BoardStationSearch({ stations, selected, displayName, onSelect }: {
  stations: Station[];
  selected?: Station;
  displayName: (name: string) => string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const words = searchable(query).split(' ');
  const matches = stations.filter(station => {
    const label = searchable(`${station.name} ${displayName(station.name)}`);
    return words.every(word => label.includes(word));
  });

  function choose(station: Station) {
    onSelect(station.id);
    setOpen(false);
    setQuery('');
    setActive(-1);
  }

  function stationLabel(station: Station) {
    const label = displayName(station.name);
    const suffix = label.match(/ \(([^()]+)\)$/);
    return <>
      <span>{suffix ? label.slice(0, suffix.index) : label}</span>
      {suffix && <span className="board-picker-bullets">
        {suffix[1].split(',').map(route => <ServiceBullet key={route} id={route.trim()} />)}
      </span>}
    </>;
  }

  return <div className="board-station-search" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor="board-station">{t('board.station')}</label>
    <div className="board-station-input">
    <input id="board-station" type="text" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={open}
      aria-controls={open ? 'board-station-results' : undefined}
      aria-activedescendant={open && matches[active] ? `board-station-${matches[active].id}` : undefined}
      placeholder={t('board.search')}
      value={open ? query : selected ? displayName(selected.name) : ''}
      onFocus={() => { setQuery(''); setActive(-1); setOpen(true); }}
      onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          setQuery('');
          setActive(-1);
          setOpen(false);
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
          const next = Math.max(0, Math.min(matches.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
          setActive(next);
          if (matches[next]) document.getElementById(`board-station-${matches[next].id}`)?.scrollIntoView({ block: 'nearest' });
        }
        if (event.key === 'Enter' && open && matches[active < 0 ? 0 : active]) {
          event.preventDefault();
          choose(matches[active < 0 ? 0 : active]);
        }
      }} />
      {!open && selected && <div className="board-station-selected" aria-hidden="true">{stationLabel(selected)}</div>}
    </div>
    {open && <div className="board-search-popup">
      <ul id="board-station-results" role="listbox" aria-label={t('board.station')}>
        {matches.map((station, index) => <li key={station.id} id={`board-station-${station.id}`}
          role="option" aria-selected={index === active}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(station)}>{stationLabel(station)}</li>)}
      </ul>
      {!matches.length && <div role="status">{t(stations.length ? 'board.noStations' : 'board.loading')}</div>}
    </div>}
  </div>;
}
