import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import directory from '../data/archive-directory.json';
import { archiveColumns, groupArchiveServices, matchesArchiveSearch, sortArchiveRows, type ArchiveRow, type ArchiveSortKey, type SortDirection } from '../domain/archive';
import { ServiceBullet } from './ServiceBullet';

const rows: ArchiveRow[] = directory.rows;
const undatedCount = rows.filter(row => !row.votingDate).length;
// Neighborhood labels supplied by the user, keyed by original MTA station ID.
const neighborhoods: Record<string, string[]> = {
  '144': ['Fort George'], '145': ['Fort George', 'Hudson Heights'],
  '146': ['Fort George', 'Hudson Heights'], '299': ['Fort George'],
  '300': ['Fort George'], '301': ['Fort George'],
};

function Services({ services }: { services: string[] }) {
  return <span className="archive-services">{groupArchiveServices(services).map(group => <span className="archive-service-group" key={group.join('')}>{group.map(service => <ServiceBullet key={service} id={service} />)}</span>)}</span>;
}

export function ArchiveTable() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<ArchiveSortKey>('exits');
  const [direction, setDirection] = useState<SortDirection>('ascending');
  const visibleRows = useMemo(() => sortArchiveRows(rows.filter(row => matchesArchiveSearch(row, query)), sortKey, direction), [query, sortKey, direction]);

  function changeSort(key: ArchiveSortKey) {
    setDirection(key === sortKey && direction === 'ascending' ? 'descending' : 'ascending');
    setSortKey(key);
  }

  return <section className="content-panel archive-directory" aria-labelledby="archive-heading">
    <h1 id="archive-heading">{t('archive')}</h1>
    <div className="archive-toolbar">
      <label className="archive-search" htmlFor="archive-search"><span>{t('directory.searchLabel')}</span>
        <input type="search" id="archive-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('directory.searchPlaceholder')} autoComplete="off" />
      </label>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {t('directory.results', { count: visibleRows.length, total: rows.length })}
        <span>{t('directory.sorted', { column: t(`directory.columns.${sortKey}`), direction: t(`directory.${direction}`) })}</span>
      </div>
    </div>
    <p className="visually-hidden" id="archive-table-help">{t('directory.tableHelp')}</p>
    <div className="archive-table-scroll" role="region" aria-label={t('directory.tableLabel')} aria-describedby="archive-table-help" tabIndex={0}>
      <table className="archive-table">
        <caption className="visually-hidden">{t('directory.tableLabel')}</caption>
        <colgroup><col className="archive-col-name"/><col className="archive-col-count"/><col className="archive-col-count"/><col className="archive-col-services"/><col className="archive-col-night"/><col className="archive-col-members"/><col className="archive-col-ids"/><col className="archive-col-date"/></colgroup>
        <thead><tr>{archiveColumns.map(key => <th key={key} scope="col" aria-sort={sortKey === key ? direction : 'none'}>
          <button type="button" onClick={() => changeSort(key)} aria-label={t('directory.sortAction', { column: t(`directory.columns.${key}`), direction: t(`directory.${key === sortKey && direction === 'ascending' ? 'descending' : 'ascending'}`) })}>
            <span>{t(`directory.columns.${key}`)}{key === 'votingDate' && <> <strong className="archive-undated-count">{undatedCount}</strong></>}</span><span aria-hidden="true" className="archive-sort-icon">{sortKey === key ? direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
          </button>
        </th>)}</tr></thead>
        <tbody>{visibleRows.length ? visibleRows.map(row => <tr key={row.id}>
          <th scope="row"><span className="archive-station-name">{row.name}</span><span className="archive-station-context">{t(`directory.boroughs.${row.borough}`)}{row.members.length === 1 && row.borough !== 'SI' ? ` · ${row.members[0].lines.join(' / ')}` : ''}</span>{row.stationIds.some(id => neighborhoods[id]) && <span className="archive-neighborhood">{row.stationIds.flatMap(id => neighborhoods[id] ?? []).join(' · ')}</span>}</th>
          <td className="archive-count">{row.exits ?? t('directory.unknown')}</td>
          <td className="archive-count">{row.elevators === 0 ? null : row.elevators ?? t('directory.unknown')}</td>
          <td><Services services={row.regularServices}/>{row.plannedServices.length > 0 && <span className="archive-planned"><Services services={row.plannedServices}/><span>{t('directory.planned')}</span></span>}</td>
          <td aria-label={row.nightServices.length ? undefined : t('directory.noNightAdditions')}>{row.nightServices.length ? <Services services={row.nightServices}/> : null}</td>
          <td aria-label={row.members.length > 1 ? undefined : t('directory.standalone')}>{row.members.length > 1 ? <ul className="archive-members">{row.members.map(member => <li key={member.stationId}><span>{member.name}</span><small>{member.lines.join(' / ')}</small></li>)}</ul> : null}</td>
          <td className="archive-ids"><span>{t(row.complexIds.length === 1 ? 'directory.complexId' : 'directory.complexIds')} <b>{row.complexIds.join(', ')}</b></span><span>{t(row.stationIds.length === 1 ? 'directory.stationId' : 'directory.stationIds')} <b>{row.stationIds.join(', ')}</b></span></td>
          <td>{row.votingDate ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.votingDate}T12:00:00Z`)) : null}</td>
        </tr>) : <tr><td colSpan={archiveColumns.length} className="archive-empty"><strong>{t('directory.noResults')}</strong><p>{t('directory.trySearch')}</p><button type="button" onClick={() => setQuery('')}>{t('directory.clearSearch')}</button></td></tr>}</tbody>
      </table>
    </div>
    <details className="archive-method"><summary>{t('directory.methodTitle')}</summary>
      <p>{t('directory.countDefinition')}</p><p>{t('directory.serviceDefinition')}</p><p>{t('directory.plannedDefinition')}</p><p>{t('directory.sourceDefinition')}</p>
      <ul>{directory.metadata.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>
    </details>
  </section>;
}
