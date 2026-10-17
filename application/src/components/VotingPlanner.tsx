import directory from '../data/archive-directory.json';
import { buildVotingPlan } from '../domain/planner';

const plan = buildVotingPlan(directory.rows);
const allowedDates = new Set(plan.map(day => day.date));
const outside = directory.rows.filter(row => row.votingDate && !allowedDates.has(row.votingDate));
const format = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' });

export default function VotingPlanner() {
  return <section className="content-panel voting-planner" aria-labelledby="planner-heading">
    <h1 id="planner-heading">2027 Voting Planner</h1>
    {outside.length > 0 && <p role="status">Dates outside this plan: {outside.map(row => `${row.name} (${row.votingDate})`).join('; ')}. These entries are excluded from the totals below.</p>}
    <table className="planner-table">
      <thead><tr><th scope="col">Voting date</th><th scope="col">Exits, stations</th></tr></thead>
      <tbody>{plan.map(day => <tr key={day.date} className={day.date === '2027-04-01' ? 'planner-special' : undefined}>
        <th scope="row"><time dateTime={day.date}>{format.format(new Date(`${day.date}T12:00:00Z`))}</time>{day.date === '2027-04-01' && <small>April 1 special</small>}{day.date === '2027-01-01' && <small>Opening day</small>}</th>
        <td>{day.stations.length ? <details><summary>{day.exits} {day.exits === 1 ? 'exit' : 'exits'}, {day.stations.length} {day.stations.length === 1 ? 'station' : 'stations'}{day.unknown > 0 && <small>+ {day.unknown} unknown exit counts</small>}</summary><ul>{day.stations.map(row => <li key={row.id}>{row.name} · {row.borough} <span>({row.exits ?? 'unknown'} exits)</span></li>)}</ul></details> : <span className="planner-empty">0 exits, 0 stations</span>}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
