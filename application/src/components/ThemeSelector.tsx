import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { alternateGTheme, themeChoices } from '../data/themes';
import { useBackgroundTheme } from '../state/usePreferences';
import { ServiceBullet } from './ServiceBullet';

export function ThemeSelector() {
  const { t } = useTranslation();
  const [theme, setTheme] = useBackgroundTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const choices = themeChoices(theme);
  const showAlternateG = choices.includes(alternateGTheme.id);
  const label = (id: string) => id === alternateGTheme.id ? t('alternateGTheme') : id === 'default' ? t('themeDefault') : id === 'SIR' ? t('sirTheme') : id === 'S' ? t('shuttleTheme') : t('serviceTheme', { service: id });

  useEffect(() => {
    if (!open) return;
    options.current[choices.indexOf(theme)]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, theme]);

  function choose(id: string) {
    setTheme(id);
    setOpen(false);
    trigger.current?.focus();
  }

  return <div className="theme-control" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <span id="theme-label">{t('theme')}</span>
    <button ref={trigger} type="button" className="theme-trigger" aria-labelledby="theme-label theme-value" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? 'theme-options' : undefined} onClick={() => setOpen(value => !value)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }}>
      <span id="theme-value" className={theme === 'default' ? undefined : 'theme-value-bullet'}>{theme === 'default' ? t('themeDefault') : <><ServiceBullet id={theme} decorative/><span className="sr-only">{label(theme)}</span></>}</span>
      <span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="theme-options" className={`theme-options${showAlternateG ? ' has-alternate-g' : ''}`} role="listbox" aria-labelledby="theme-label">
      {choices.map((id, index) => <button type="button" key={id} ref={element => { options.current[index] = element; }} role="option" aria-selected={theme === id} aria-label={label(id)} title={label(id)} className={id === 'default' ? 'theme-default' : ''} tabIndex={theme === id ? 0 : -1} onClick={() => choose(id)} onKeyDown={event => {
        let next = index;
        if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % choices.length;
        else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index - 1 + choices.length) % choices.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = choices.length - 1;
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
        else return;
        event.preventDefault();
        options.current[next]?.focus();
      }}>{id === 'default' ? t('themeDefault') : <ServiceBullet id={id} decorative/>}<span className="theme-check" aria-hidden="true">{theme === id ? '✓' : ''}</span></button>)}
    </div>}
  </div>;
}
