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
    return <section className="exit-editor" aria-labelledby="exit-list-title">
        <h3 id="exit-list-title">{t('exitList')}</h3>
        <p className="muted">{t('listHelp')}</p>
        <div className="exit-rows">{station.exits.map(exit => {
            const active = selected === exit.id;
            const number = assignments[exit.id];
            return <div key={exit.id} className={`exit-row ${active ? 'active' : ''}`}>
                <button type="button" className="exit-row-trigger" id={`select-${exit.id}`}
                    aria-expanded={active} aria-controls={`picker-${exit.id}`}
                    onClick={() => onSelect(exit.id)}>
                    <span className={`exit-badge ${number ? 'filled' : ''}`} aria-hidden="true">{number ?? '—'}</span>
                    <span className="exit-row-description">{exit.description[lang]}<span className="exit-row-value">{number ? t('exit', { number }) : t('pick')}</span></span>
                </button>
                <div id={`picker-${exit.id}`} className="number-picker" hidden={!active}
                    role="group" aria-label={t('numberLabel', { description: exit.description[lang] })}>
                    <div className="number-buttons">{station.exits.map((_, i) => {
                        const n = i + 1;
                        const used = Object.entries(assignments).some(([id, value]) => id !== exit.id && value === n);
                        return <button type="button" key={n}
                            aria-label={t(used ? 'numberUsed' : 'exit', { number: n })}
                            aria-pressed={number === n} disabled={used}
                            onClick={() => onAssign(exit.id, n)}>{n}</button>;
                    })}<button type="button" className="clear" disabled={!number} onClick={() => onAssign(exit.id)}>{t('clear')}</button></div>
                </div>
            </div>;
        })}</div>
    </section>;
}
