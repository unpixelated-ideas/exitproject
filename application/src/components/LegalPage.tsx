import { useTranslation } from 'react-i18next';

export type LegalSection = { id: string; heading: string; paragraphs: string[] };
const providerLinks = [
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
  'https://osmfoundation.org/wiki/Privacy_Policy',
  'https://www.mta.info/privacy-policy',
  'https://www.weather.gov/privacy',
  'https://unpkg.com/',
  'https://www.cloudflare.com/privacypolicy/',
  'https://www.openstreetmap.org/copyright',
  'https://operations.osmfoundation.org/policies/tiles/',
  'https://osmfoundation.org/wiki/Terms_of_Use',
  'https://www.mta.info/terms-and-conditions',
  'https://www.weather.gov/disclaimer',
];
export function LegalLinks() {
  const { t, i18n } = useTranslation();
  return <nav className="legal-navigation" aria-label={t('legal.navigation')}>
    {['privacy', 'terms'].map(page => <a key={page} href={`#/${page}?lang=${i18n.resolvedLanguage}`}>{t(page)}</a>)}
    <a href="#/">{t('backToProject')}</a>
  </nav>;
}
export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const { t, i18n } = useTranslation();
  const sections = t(`legal.${page}.sections`, { returnObjects: true }) as LegalSection[];
  const labels = t('legal.links', { returnObjects: true }) as string[];
  return <article className="content-panel legal-page">
    <h1>{t(page)}</h1>
    <p className="muted">{t('legal.updated')}: <time dateTime="2026-11-23">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date('2026-11-23T12:00:00Z'))}</time></p>
    <LegalLinks />
    <nav aria-label={t('legal.contents')} className="legal-contents"><ul>{sections.map(section => <li key={section.id}><a href={`#/${page}?lang=${i18n.resolvedLanguage}`} onClick={event => { event.preventDefault(); const heading = document.getElementById(`legal-${section.id}`); heading?.scrollIntoView(); heading?.focus({ preventScroll: true }); }}>{section.heading}</a></li>)}</ul></nav>
    {sections.map(section => <section key={section.id} aria-labelledby={`legal-${section.id}`}><h2 id={`legal-${section.id}`} tabIndex={-1}>{section.heading}</h2>{section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</section>)}
    <section aria-labelledby="legal-provider-links"><h2 id="legal-provider-links">{t('legal.providers')}</h2><ul>{providerLinks.map((href, index) => <li key={href}><a href={href}>{labels[index]}</a></li>)}</ul></section>
    <LegalLinks />
  </article>;
}
