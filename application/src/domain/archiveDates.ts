/** Use UTC calendar days, matching voting periods in data/schedule.ts. */
export function archiveDateVisibility(date: string, now = new Date()): 'full' | 'month' | 'hidden' {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const target = new Date(`${date}T00:00:00Z`);
    if (target <= today) return 'full';
    if (date.endsWith('-04-01')) return 'hidden';
    const fortnight = new Date(today);
    fortnight.setUTCDate(fortnight.getUTCDate() + 14);
    if (target <= fortnight) return 'full';
    // Rolling calendar month, clamped to the last day of a shorter month.
    const month = new Date(today);
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() + 2, 0);
    month.setUTCDate(Math.min(today.getUTCDate(), month.getUTCDate()));
    return target <= month ? 'month' : 'hidden';
}
