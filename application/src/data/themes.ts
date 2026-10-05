// Subway colors: https://en.wikipedia.org/wiki/List_of_New_York_City_Subway_lines#Nomenclature
export const serviceThemes = [
  ...['A', 'C', 'E'].map(id => ({ id, color: '#0039A6', ink: '#FFFFFF' })),
  ...['B', 'D', 'F', 'M'].map(id => ({ id, color: '#FF6319', ink: '#FFFFFF' })),
  { id: 'G', color: '#6CBE45', ink: '#FFFFFF' },
  { id: 'L', color: '#A7A9AC', ink: '#FFFFFF' },
  ...['J', 'Z'].map(id => ({ id, color: '#996633', ink: '#FFFFFF' })),
  ...['N', 'Q', 'R', 'W'].map(id => ({ id, color: '#FCCC0A', ink: '#000000' })),
  ...['1', '2', '3'].map(id => ({ id, color: '#EE352E', ink: '#FFFFFF' })),
  ...['4', '5', '6'].map(id => ({ id, color: '#00933C', ink: '#FFFFFF' })),
  { id: '7', color: '#B933AD', ink: '#FFFFFF' },
  { id: 'T', color: '#00ADD0', ink: '#FFFFFF' },
  { id: 'S', color: '#808183', ink: '#FFFFFF' },
  // Circle fill from the SIR-Std SVG used on the supplied SIR article.
  { id: 'SIR', color: '#0078C6', ink: '#FFFFFF' },
];
export const alternateGTheme = { id: 'G-app', color: '#799534', ink: '#FFFFFF' };
export function getTheme(id: string) {
  return id === alternateGTheme.id ? alternateGTheme : serviceThemes.find(theme => theme.id === id);
}
export function themeChoices(selected: string): string[] {
  return ['default', ...(selected === 'G' || selected === alternateGTheme.id ? [alternateGTheme.id] : []), ...serviceThemes.map(theme => theme.id)];
}
export function normalizeTheme(value: unknown): string {
  return typeof value === 'string' && getTheme(value) ? value : 'default';
}
