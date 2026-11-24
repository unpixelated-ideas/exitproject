// Shared server-side validation foundation. No database writes or launch switch.
export function isPeriodOpen(period, now = Date.now()) {
    return Number.isFinite(now) && now >= Date.parse(period.startsAt) && now < Date.parse(period.closesAt);
}
export function validateBallot(period, ballot) {
    if (!ballot || typeof ballot !== 'object' || Array.isArray(ballot)) return false;
    if (Object.keys(ballot).length !== Object.keys(period.stations).length) return false;
    return Object.entries(period.stations).every(([station, exits]) => {
        const choices = ballot[station];
        if (!choices || typeof choices !== 'object' || Array.isArray(choices) || Object.keys(choices).length !== exits.length) return false;
        const numbers = exits.map(exit => choices[exit]);
        return numbers.every(n => Number.isInteger(n) && n >= 1 && n <= exits.length) && new Set(numbers).size === exits.length;
    });
}
