import { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { normalizeTheme, getTheme } from '../data/themes';
export type Appearance = 'system' | 'light' | 'dark';
export function useBackgroundTheme() {
    const [theme, setTheme] = useState(() => normalizeTheme(storage.read('background-theme')));
    useEffect(() => {
        const color = getTheme(theme)?.color;
        if (color) document.documentElement.style.setProperty('--page', color);
        else document.documentElement.style.removeProperty('--page');
        storage.write('background-theme', theme);
    }, [theme]);
    return [theme, setTheme] as const;
}
export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>(() => { const v = storage.read('appearance'); return v === 'light' || v === 'dark' ? v : 'system'; });
    useEffect(() => { const query = matchMedia('(prefers-color-scheme: dark)'); const update = () => { document.documentElement.dataset.theme = appearance === 'system' ? (query.matches ? 'dark' : 'light') : appearance; }; update(); storage.write('appearance', appearance); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, [appearance]);
    return [appearance, setAppearance] as const;
}
