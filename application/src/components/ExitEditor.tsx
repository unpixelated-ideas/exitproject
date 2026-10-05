import { useTranslation } from 'react-i18next';
import type { Assignments, Station } from '../domain/types';
export function ExitEditor({ station, assignments, selected, onSelect, onAssign }: {
    station: Station;
    assignments: Assignments;
    selected: string | undefined;
    onSelect: (id: string) => void;
    onAssign: (id: string, n?: number) => void;
}) {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    return <section className="exit-editor" aria-labelledby="exit-list-title"><h3 id="exit-list-title">{t('exitList')}</h3><p className="muted">{t('listHelp')}</p><div className="exit-rows">{station.exits.map(e => <div key={e.id} className={`exit-row ${selected === e.id ? 'active' : ''}`}><span className={`exit-badge ${assignments[e.id] ? 'filled' : ''}`} aria-hidden="true">{assignments[e.id] ?? '—'}</span><label htmlFor={`select-${e.id}`}>{e.description[lang]}<select id={`select-${e.id}`} aria-label={t('numberLabel', { description: e.description[lang] })} value={assignments[e.id] ?? ''} onFocus={() => onSelect(e.id)} onChange={event => onAssign(e.id, event.target.value ? Number(event.target.value) : undefined)}><option value="">{t('pick')}</option>{station.exits.map((_, i) => { const n = i + 1; const used = Object.entries(assignments).some(([id, v]) => id !== e.id && v === n); return <option key={n} value={n} disabled={used}>{used ? t('numberUsed', { number: n }) : t('exit', { number: n })}</option>; })}</select></label></div>)}</div>
 {selected && <div className="number-picker"><strong>{station.exits.find(e => e.id === selected)?.description[lang]}</strong><div className="number-buttons">{station.exits.map((_, i) => <button key={i} aria-label={t('exit', { number: i + 1 })} aria-pressed={assignments[selected] === i + 1} disabled={Object.entries(assignments).some(([id, n]) => id !== selected && n === i + 1)} onClick={() => onAssign(selected, i + 1)}>{i + 1}</button>)}<button className="clear" disabled={!assignments[selected]} onClick={() => onAssign(selected)}>{t('clear')}</button></div></div>}
 </section>;
}
