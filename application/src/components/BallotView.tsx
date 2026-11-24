import type { VotingPeriod } from '../domain/types';
import { ServiceBullet } from './ServiceBullet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scheduleProvider } from '../data/schedule';
import { stationProvider } from '../data/stations';
import { isComplete, validBallot } from '../domain/voting';
import { storage } from '../services/storage';
import { createTestSubmissionService, isLocalTestMode } from '../services/testSubmission';
import { createProductionSubmission, openProductionPeriods, savedReceipt, VotingError } from '../services/productionVoting';
import { useBallot } from '../state/useBallot';
import { StationMap } from './StationMap';
import { ExitEditor } from './ExitEditor';
import { IntroModal } from './IntroModal';
const testMode = isLocalTestMode(import.meta.env.DEV, window.location.href);
const testService = testMode ? createTestSubmissionService() : null;

const productionService = createProductionSubmission();
// Production requests are enabled only in the deployed Pages build.
const productionMode = import.meta.env.PROD && window.location.origin === 'https://unpixelated-ideas.github.io';
export function BallotView() {
    const { t } = useTranslation();
    const [openPeriods, setOpenPeriods] = useState<VotingPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [offline, setOffline] = useState(false);
    useEffect(() => {
        if (!productionMode) return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout>;
        let expiry: ReturnType<typeof setTimeout>;
        let controller: AbortController;
        const refresh = async () => {
            controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);
            try {
                const result = await openProductionPeriods(controller.signal);
                if (disposed) return;
                setOpenPeriods(result.periods); setOffline(false);
                clearTimeout(expiry);
                expiry = setTimeout(() => setOpenPeriods([]), result.validFor);
                timer = setTimeout(() => void refresh(), Math.max(1000, Math.min(30_000, result.validFor)));
            } catch {
                if (disposed) return;
                setOpenPeriods([]); setOffline(true);
                timer = setTimeout(() => void refresh(), 30_000);
            } finally { clearTimeout(timeout); }
        };
        void refresh();
        return () => { disposed = true; controller?.abort(); clearTimeout(timer); clearTimeout(expiry); };
    }, []);
    const opening = scheduleProvider.getActivePeriod();
    const active = openPeriods.find(p => p.id === selectedPeriod) ?? openPeriods[0];
    const period = testMode ? { ...opening, id: 'test-opening-v1' } : active ?? { ...opening, id: 'preview-135-st-v1' };
    return <>{offline && <p role="status">{t('productionVoting.unavailable')}</p>}
        {openPeriods.length > 1 && <nav aria-label={t('productionVoting.openBallots')}>
            {openPeriods.map(p => <button key={p.id} onClick={() => setSelectedPeriod(p.id)} aria-current={p.id === active?.id ? 'page' : undefined}>{p.specialEvent ? t('specialPeriod') : t('productionVoting.weekly')}</button>)}
        </nav>}
        <PeriodBallot key={period.id} period={period} unlocked={testMode || !!active} />
    </>;
}

function PeriodBallot({ period, unlocked }: { period: VotingPeriod; unlocked: boolean }) {
    // Temporarily exclude elevators from ballot rows, maps, numbering and submission.
    // Keep the source data intact so they can be restored later.
    const stations = useMemo(() => stationProvider.getStations(period.stationIds).map(station => ({
        ...station,
        exits: station.exits.filter(exit => exit.type !== 'Elevator').map(exit => ({
            ...exit,
            // Generated letters reflect inventory order, not official entrance labels.
            description: {
                en: exit.description.en.replace(/ · [A-Z]+$/, ''),
                ko: exit.description.ko.replace(/ · [A-Z]+$/, ''),
            },
        })),
    })), [period.stationIds]);
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    const { ballot, assign, reset } = useBallot(period.id, stations);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<string | undefined>(() => stations[0]?.exits[0]?.id);
    const [screen, setScreen] = useState<'vote' | 'review' | 'done'>(() => !period.mock && savedReceipt(period.id) ? 'done' : 'vote');
    const [intro, setIntro] = useState(() => storage.read(`intro:${period.id}`) !== true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState(() => !period.mock ? savedReceipt(period.id) ?? '' : '');
    
    const heading = useRef<HTMLHeadingElement>(null);
    const station = stations[index];
    const assignments = ballot[station.id] ?? {};
    const completed = stations.filter(s => isComplete(s, ballot[s.id])).length;
    function go(i: number) { if (receipt && !period.mock || !unlocked && i !== 0) return; setIndex(i); setSelected(stations[i]?.exits[0]?.id); setScreen('vote'); requestAnimationFrame(() => heading.current?.focus()); }
    function resetVoting() { reset(); setReceipt(''); setError(''); go(0); }
    function review() { if (!unlocked || receipt && !period.mock) return; setScreen('review'); requestAnimationFrame(() => heading.current?.focus()); }
    async function submit() { if (!unlocked || pending)
        return; setPending(true); setError(''); try {
        const result = await (testService ?? productionService).submit(period, stations, ballot);
        setReceipt(result.receipt);
        
        setScreen('done');
        requestAnimationFrame(() => heading.current?.focus());
    }
    catch (error) {
        setError(error instanceof VotingError ? error.code : 'unavailable');
    }
    finally {
        setPending(false);
    } }
    return <>{testMode && <section className="content-panel" role="note"><h2>{t('testVoting.title')}</h2><p>{t('testVoting.notice')}</p></section>}{intro && <IntroModal onClose={() => { storage.write(`intro:${period.id}`, true); setIntro(false); }}/>}<section className="period-panel"><div><h1>{period.title[lang]}</h1><p className="muted">{testMode && <>{t('testVoting.fixture')} <span className="separator">/</span> </>}{t('stationCount', { count: stations.length })}</p></div><div className="period-actions"><div className="period-controls"><button className="reset-button" type="button" disabled={pending || (!period.mock && !!savedReceipt(period.id))} onClick={resetVoting}>{t('reset')}</button></div><a className="text-link" href="#/faq">{t('how')} <span aria-hidden="true">↗</span></a></div></section>
 <div className="ballot-steps" aria-label={t('ballotProgress', { done: completed, total: stations.length })}>{stations.map((s, i) => <button key={s.id} className={screen === 'vote' && index === i ? 'current' : ''} aria-current={screen === 'vote' && index === i ? 'step' : undefined} disabled={!!receipt && !period.mock || (!unlocked && i !== 0) || pending || (screen !== 'review' && i > index && !stations.slice(0, i).every(prior => isComplete(prior, ballot[prior.id])))} onClick={() => go(i)}><span className="step-number">{isComplete(s, ballot[s.id]) ? '✓' : String(i + 1).padStart(2, '0')}</span><span>{s.name[lang]}</span></button>)}<button className={screen === 'review' ? 'current' : ''} disabled={!!receipt && !period.mock || !unlocked || !validBallot(stations, ballot) || pending} onClick={review}><span className="step-number">↗</span>{t('review')}</button></div>
 {screen === 'vote' ? <section className="ballot-panel"><div className="station-heading"><div><div className="eyebrow">{t('stationPosition', { current: index + 1, total: stations.length })}</div><h2 ref={heading} tabIndex={-1}>{station.name[lang]} <span className="services">{station.services.map(s => <ServiceBullet id={s} key={s}/>)}</span></h2></div><div className="progress-block"><strong aria-live="polite">{t('exitProgress', { done: Object.keys(assignments).length, total: station.exits.length })}</strong><progress value={Object.keys(assignments).length} max={station.exits.length} aria-label={t('exitProgress', { done: Object.keys(assignments).length, total: station.exits.length })}/></div></div><div className="instruction"><h3>{t('instructions')}</h3><p>{t('instructionBody')}</p></div><div className="voting-grid"><StationMap station={station} assignments={assignments} selectedExitId={selected} onSelectExit={id => { setSelected(id); requestAnimationFrame(() => document.getElementById(`select-${id}`)?.focus({ preventScroll: true })); }}/><ExitEditor station={station} assignments={assignments} selected={selected} onSelect={setSelected} onAssign={(id, n) => assign(station, id, n)}/></div><div className="ballot-actions"><button disabled={index === 0} onClick={() => go(index - 1)}>← {t('previous')}</button><div>{!isComplete(station, assignments) && <span className="muted">{t('completeHint')}</span>}<button className="primary" disabled={!unlocked || !isComplete(station, assignments)} onClick={() => index === stations.length - 1 ? review() : go(index + 1)}>{t(index === stations.length - 1 ? 'review' : 'next')} →</button></div></div></section> : screen === 'review' ? <section className="ballot-panel review-panel"><span className="eyebrow">{t('ballotProgress', { done: completed, total: stations.length })}</span><h2 ref={heading} tabIndex={-1}>{t('review')}</h2><p>{t('reviewHelp')}</p>{stations.map((s, i) => <article className="review-station" key={s.id}><div className="row-between"><h3>{s.name[lang]}</h3><button disabled={pending} onClick={() => go(i)}>{t('edit')}</button></div><ul>{s.exits.map(e => <li key={e.id}><strong className="review-number">{ballot[s.id]?.[e.id]}</strong>{e.description[lang]}</li>)}</ul></article>)}<p className="vote-privacy-note">{testMode ? t('testVoting.notice') : <a href={`#/privacy?lang=${i18n.resolvedLanguage}`}>{t('legal.voteNotice')}</a>}</p>{error && <p role="alert">{t(testMode ? 'testVoting.error' : `productionVoting.${error}`)}</p>}<button className="primary" disabled={pending || !validBallot(stations, ballot)} onClick={() => void submit()}>{t(pending ? 'submitting' : testMode ? 'testVoting.submit' : 'submit')} →</button></section> : <section className="ballot-panel confirmation"><div className="success-symbol" aria-hidden="true">✓</div><h2 ref={heading} tabIndex={-1}>{t('thanks')}</h2><p>{t(testMode ? 'testVoting.saved' : 'thanksBody')}</p>{receipt && <p>{t(testMode ? 'testVoting.receipt' : 'productionVoting.receipt', { receipt })}</p>}{testMode && <button className="primary" onClick={resetVoting}>{t('again')} →</button>}</section>}
 </>;
}
