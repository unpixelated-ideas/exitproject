import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { availableLanguages, languages } from '../data/languages';
import type { Appearance } from '../state/usePreferences';
import { IntroPreferenceMenu } from './IntroPreferenceMenu';
import './intro-modal.css';

export type IntroAppearanceProps = {
    appearance: Appearance;
    setAppearance: (value: Appearance) => void;
};

const appearances = ['system', 'light', 'dark'] as const;
const appearanceIcons = {
    system: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-4 0h8" /></>,
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    dark: <path d="M20.9 13a9 9 0 1 1-9.9-9.9A7.4 7.4 0 0 0 20.9 13Z" />,
};
const globe = <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>;

const featureIcons = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4m8-4v4m-8 7h2m4 0h2m-8 3h2" /></>,
    numbers: <path d="M11 5h10m-10 7h10m-10 7h10M4 4l2-1v5m-2 0h4m-4 3c0-2 4-2 4 0 0 1-4 3-4 4h4m-4 2h4l-2 2c2 0 3 3-2 3" />,
    train: <><rect x="5" y="3" width="14" height="16" rx="4" /><path d="M5 12h14m-7-9v9m-3 7-2 3m8-3 2 3m-8-7h.01m6 0h.01" /></>,
};

const features = ['calendar', 'numbers', 'train'] as const;

export function IntroModal({ onClose, appearance, setAppearance }: IntroAppearanceProps & { onClose: () => void }) {
    const { t, i18n } = useTranslation();
    const languageOptions = languages.map(([code, name]) => ({
        value: code,
        label: name,
        lang: code,
        disabled: !availableLanguages.has(code),
        description: !availableLanguages.has(code) ? t('soon') : undefined,
    }));
    const ref = useRef<HTMLDialogElement>(null);
    const title = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const previous = document.activeElement;
        const dialog = ref.current;
        dialog?.showModal();
        title.current?.focus();
        return () => {
            dialog?.close();
            if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) previous.focus();
            else document.getElementById('main')?.focus();
        };
    }, []);

    function changeLanguage(code: string) {
        if (!availableLanguages.has(code)) return;
        // Preserve an explicit ballot language link across refresh if the visitor changes it.
        const [route, query] = location.hash.split('?', 2);
        const params = new URLSearchParams(query);
        if (params.has('lang')) {
            params.set('lang', code);
            history.replaceState(history.state, '', `${route}?${params}`);
        }
        void i18n.changeLanguage(code);
    }

    return (
        <dialog className="intro-modal" ref={ref} aria-labelledby="intro-title" aria-describedby="intro-description"
            onCancel={event => { event.preventDefault(); onClose(); }}>
            <div className="intro-modal-top">
                <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span>{t('brand')}</div>
                <div className="intro-modal-settings">
                    <IntroPreferenceMenu label={t('appearance')} icon={appearanceIcons[appearance]}
                        options={appearances.map(value => ({ value, label: t(value) }))}
                        value={appearance} onSelect={value => {
                            const selected = appearances.find(option => option === value);
                            if (selected) setAppearance(selected);
                        }} />
                    <IntroPreferenceMenu label={t('language')} icon={globe} options={languageOptions}
                        value={i18n.language} onSelect={changeLanguage} />
                </div>
            </div>
            <h1 id="intro-title" tabIndex={-1} ref={title}>{t('welcome.title')}</h1>
            <p id="intro-description">{t('welcome.description')}</p>
            <ul className="intro-modal-features" role="list">
                {features.map(feature => (
                    <li key={feature} className={`intro-modal-feature intro-modal-feature--${feature}`}>
                        <span className="intro-modal-feature-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">{featureIcons[feature]}</svg>
                        </span>
                        <div>
                            <h2>{t(`welcome.features.${feature}.title`)}</h2>
                            <p>{t(`welcome.features.${feature}.description`)}</p>
                        </div>
                    </li>
                ))}
            </ul>
            <button type="button" className="primary intro-modal-start" onClick={onClose}>
                <span>{t('start')}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </button>
            <p className="intro-modal-disclaimer">{t('welcome.disclaimer')}</p>
        </dialog>
    );
}
