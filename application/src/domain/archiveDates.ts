/** Reveal dates by New York calendar days, independent of the viewer's timezone. */
export function archiveDateVisibility(date: string, now = new Date()): 'full' | 'month' | 'hidden' {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => Number(parts.find(item => item.type === type)!.value);
    const today = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    const target = new Date(`${date}T00:00:00Z`);
    if (target <= today) return 'full';
    if (date.endsWith('-04-01')) return 'hidden';
    const fortnight = new Date(today);
    fortnight.setUTCDate(fortnight.getUTCDate() + 14);
    if (target <= fortnight) return 'full';
    const month = new Date(today);
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() + 2, 0);
    month.setUTCDate(Math.min(today.getUTCDate(), month.getUTCDate()));
    return target <= month ? 'month' : 'hidden';
}
