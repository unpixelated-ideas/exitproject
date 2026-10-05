import { ServiceBullet } from './ServiceBullet';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scheduleProvider } from '../data/schedule';
import { stationProvider } from '../data/stations';
import { isComplete, validBallot } from '../domain/voting';
import { storage } from '../services/storage';
import { submissionService } from '../services/submission';
import { useBallot } from '../state/useBallot';
import { StationMap } from './StationMap';
import { ExitEditor } from './ExitEditor';
import { IntroModal } from './IntroModal';
const period = scheduleProvider.getActivePeriod();
const stations = stationProvider.getStations(period.stationIds);
export function BallotView() {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    const { ballot, assign, reset } = useBallot(period.id, stations);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<string>();
    const [screen, setScreen] = useState<'vote' | 'review' | 'done'>('vote');
    const [intro, setIntro] = useState(() => storage.read(`intro:${period.id}`) !== true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(false);
    
    const heading = useRef<HTMLHeadingElement>(null);
    const station = stations[index];
    const assignments = ballot[station.id] ?? {};
    const completed = stations.filter(s => isComplete(s, ballot[s.id])).length;
    function go(i: number) { setIndex(i); setSelected(undefined); setScreen('vote'); requestAnimationFrame(() => heading.current?.focus()); }
    function resetVoting() { reset(); setError(false); go(0); }
    function review() { setScreen('review'); requestAnimationFrame(() => heading.current?.focus()); }
    async function submit() { if (pending)
        return; setPending(true); setError(false); try {
        await submissionService.submit(period, stations, ballot);
        
        setScreen('done');
        requestAnimationFrame(() => heading.current?.focus());
    }
    catch {
        setError(true);
    }
    finally {
        setPending(false);
    } }
    const date = (value: string) => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
    return <>{intro && <IntroModal onClose={() => { storage.write(`intro:${period.id}`, true); setIntro(false); }}/>}<section className="period-panel"><div><span className="eyebrow">{t('period')}</span><h1>{period.title[lang]}</h1><p className="muted">{t('dateLabel')}: {date(period.startsAt)} – {date(period.endsAt)} <span className="separator">/</span> {t('stationCount', { count: stations.length })}</p></div><div className="period-actions"><button className="reset-button" type="button" disabled={pending} onClick={resetVoting}>{t('reset')}</button><a className="text-link" href="#/faq">{t('how')} <span aria-hidden="true">↗</span></a></div></section>
 <div className="ballot-steps" aria-label={t('ballotProgress', { done: completed, total: stations.length })}>{stations.map((s, i) => <button key={s.id} className={screen === 'vote' && index === i ? 'current' : ''} aria-current={screen === 'vote' && index === i ? 'step' : undefined} disabled={pending || (screen !== 'review' && i > index && !stations.slice(0, i).every(prior => isComplete(prior, ballot[prior.id])))} onClick={() => go(i)}><span className="step-number">{isComplete(s, ballot[s.id]) ? '✓' : String(i + 1).padStart(2, '0')}</span><span>{s.name[lang]}</span></button>)}<button className={screen === 'review' ? 'current' : ''} disabled={!validBallot(stations, ballot) || pending} onClick={review}><span className="step-number">↗</span>{t('review')}</button></div>
 {screen === 'vote' ? <section className="ballot-panel"><div className="station-heading"><div><div className="eyebrow">{t('stationPosition', { current: index + 1, total: stations.length })}</div><h2 ref={heading} tabIndex={-1}>{station.name[lang]} <span className="services">{station.services.map(s => <ServiceBullet id={s} key={s}/>)}</span></h2></div><div className="progress-block"><strong aria-live="polite">{t('exitProgress', { done: Object.keys(assignments).length, total: station.exits.length })}</strong><progress value={Object.keys(assignments).length} max={station.exits.length} aria-label={t('exitProgress', { done: Object.keys(assignments).length, total: station.exits.length })}/></div></div><div className="instruction"><h3>{t('instructions')}</h3><p>{t('instructionBody')}</p></div><div className="voting-grid"><StationMap station={station} assignments={assignments} selectedExitId={selected} onSelectExit={id => { setSelected(id); requestAnimationFrame(() => document.getElementById(`select-${id}`)?.focus({ preventScroll: true })); }}/><ExitEditor station={station} assignments={assignments} selected={selected} onSelect={setSelected} onAssign={(id, n) => assign(station, id, n)}/></div><div className="ballot-actions"><button disabled={index === 0} onClick={() => go(index - 1)}>← {t('previous')}</button><div>{!isComplete(station, assignments) && <span className="muted">{t('completeHint')}</span>}<button className="primary" disabled={!isComplete(station, assignments)} onClick={() => index === stations.length - 1 ? review() : go(index + 1)}>{t(index === stations.length - 1 ? 'review' : 'next')} →</button></div></div></section> : screen === 'review' ? <section className="ballot-panel review-panel"><span className="eyebrow">{t('ballotProgress', { done: completed, total: stations.length })}</span><h2 ref={heading} tabIndex={-1}>{t('review')}</h2><p>{t('reviewHelp')}</p>{stations.map((s, i) => <article className="review-station" key={s.id}><div className="row-between"><h3>{s.name[lang]}</h3><button disabled={pending} onClick={() => go(i)}>{t('edit')}</button></div><ul>{s.exits.map(e => <li key={e.id}><strong className="review-number">{ballot[s.id]?.[e.id]}</strong>{e.description[lang]}</li>)}</ul></article>)}{error && <p role="alert">{t('submitError')}</p>}<button className="primary" disabled={pending || !validBallot(stations, ballot)} onClick={() => void submit()}>{t(pending ? 'submitting' : 'submit')} →</button></section> : <section className="ballot-panel confirmation"><div className="success-symbol" aria-hidden="true">✓</div><h2 ref={heading} tabIndex={-1}>{t('thanks')}</h2><p>{t('thanksBody')}</p><button className="primary" onClick={resetVoting}>{t('again')} →</button></section>}
 <p className="save-note">{t('saved')}</p></>;
}
