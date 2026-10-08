import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
const ArchiveTable = lazy(() => import('./ArchiveTable').then(module => ({ default: module.ArchiveTable })));
import { updates } from '../data/updates';
export const pageKeys = ['about', 'faq', 'lifelong', 'updates', 'feedback', 'privacy', 'terms'] as const;
export function ContentPage({ page }: {
    page: string;
}) { const { t } = useTranslation(); const known = pageKeys.some(k => k === page); return <section className="content-panel"><h1>{t(known ? page : 'notFound')}</h1>{page === 'faq' ? <><p>{t('introBody')}</p>{(t('questions', { returnObjects: true }) as {
    q: string;
    a: string;
}[]).map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</> : page === 'updates' ? <ol className="update-log">{[...updates].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).map(update=><li key={update.id}><h2>{update.version}</h2><time dateTime={update.publishedAt}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(update.publishedAt))}</time><ul>{update.changes.map(change => <li key={change}>{change}</li>)}</ul></li>)}</ol> : known ? <p>{t(`pages.${page}`)}</p> : <a href="#/">{t('backVote')}</a>}</section>; }
export function Archive() {
    const { t } = useTranslation();
    return <Suspense fallback={<section className="content-panel" aria-busy="true"><h1>{t('archive')}</h1><p role="status">{t('directory.loading')}</p></section>}><ArchiveTable /></Suspense>;
}
