import { useTranslation } from 'react-i18next';
import { scheduleProvider } from '../data/schedule';
import { stationProvider } from '../data/stations';
import { updates } from '../data/updates';
import { StationMap } from './StationMap';
export const pageKeys = ['about', 'faq', 'lifelong', 'updates', 'feedback', 'privacy', 'terms'] as const;
export function ContentPage({ page }: {
    page: string;
}) { const { t } = useTranslation(); const known = pageKeys.some(k => k === page); return <section className="content-panel"><h1>{t(known ? page : 'notFound')}</h1>{page === 'faq' ? <><p>{t('introBody')}</p>{(t('questions', { returnObjects: true }) as {
    q: string;
    a: string;
}[]).map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</> : page === 'updates' ? <ol className="update-log">{[...updates].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).map(update=><li key={update.id}><time dateTime={update.publishedAt}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(update.publishedAt))}</time><p>{t(update.contentKey)}</p></li>)}</ol> : known ? <p>{t(`pages.${page}`)}</p> : <a href="#/">{t('backVote')}</a>}</section>; }
export function Archive() { const { t, i18n } = useTranslation(); const lang = i18n.language === 'ko' ? 'ko' : 'en'; return <section className="content-panel archive-panel"><h1>{t('archive')}</h1><p>{t('archiveIntro')}</p>{scheduleProvider.getArchive().sort((a, b) => Date.parse(b.period.endsAt) - Date.parse(a.period.endsAt)).map(entry => <article key={entry.period.id}><h2>{entry.period.title[lang]}</h2><p className="muted">{t('dateLabel')}: {new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(entry.period.endsAt))}</p>{entry.results.map(result => { const station = stationProvider.getStations([result.stationId])[0]; return <div key={station.id} className="archive-result"><div><h3>{station.name[lang]}</h3><p>{t('ballots', { count: result.ballots })}</p><p>{t('share', { percent: result.percentage })}</p><h4>{t('winning')}</h4><ul className="result-list">{station.exits.map(e => <li key={e.id}><strong>{result.winning[e.id]}</strong> {e.description[lang]}</li>)}</ul></div><StationMap station={station} assignments={result.winning} readOnly/></div>; })}</article>)}</section>; }
