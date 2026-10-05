import changelog from '../../CHANGELOG.md?raw';

/** The public log uses the same release notes as the project changelog. */
export const updates = [...changelog.matchAll(/^## (v[\d.]+) — (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(([, version, date, body]) => ({
  id: version,
  version,
  publishedAt: new Date(`${date} 00:00:00 UTC`).toISOString().slice(0, 10),
  changes: body.split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2)),
}));
