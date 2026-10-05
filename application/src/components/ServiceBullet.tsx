import { alternateGTheme, getTheme } from '../data/themes';

/** Shared by the theme picker and station cards; the theme catalog owns the colors. */
export function ServiceBullet({ id, decorative = false }: { id: string; decorative?: boolean }) {
  const theme = getTheme(id);
  if (!theme) return <span>{id}</span>;
  return id === 'SIR'
    ? <img className="theme-bullet" src={`${import.meta.env.BASE_URL}bullets/SIR.svg`} alt={decorative ? '' : 'SIR'} />
    : <span className="theme-bullet" style={{ background: theme.color, color: theme.ink }} aria-hidden={decorative || undefined}>{id === alternateGTheme.id ? 'G' : id}</span>;
}
