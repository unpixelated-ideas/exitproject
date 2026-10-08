# MTA Exit Project

See the [update log](CHANGELOG.md) for project milestones.

An independent civic project to crowdsource proposed exit numbers for the NYC Subway and Staten Island Railway throughout 2027, then present the proposal to the MTA. Not affiliated with or endorsed by the Metropolitan Transportation Authority.

## Run locally

In the parent folder, double-click **Start MTA Exit Project.command**. It opens Terminal, starts the local server, and opens the site in your default browser. Keep its Terminal window open while using the site; press Control+C to stop. Clicking the launcher again opens the existing server instead of starting another copy.

All application files are inside `application/`. The original Numbers workbook is preserved only in the local `application/reference-files/` folder and is not imported by the app or published in this repository. Run the development commands below from this `application/` folder.

Dependencies are already installed in this checkout. On this computer, the quickest launch is:

```sh
./start-local.sh
```

This script uses a normal Node installation when available, with a fallback to this computer’s bundled Codex Node runtime. For a fresh checkout, use the standard setup below.

Install Node.js 22.12+ (or a supported newer LTS) and pnpm. From this folder:

```sh
pnpm install
pnpm dev
```

Open the local URL printed in the terminal, normally http://127.0.0.1:5173/. Keep that terminal running; press Ctrl+C to stop. No account, API key, map token, database or environment file is required.

```sh
pnpm build       # TypeScript check and local production bundle in dist/
pnpm preview     # View the production bundle locally
pnpm typecheck
pnpm lint
pnpm test
```

The dependency lockfile is included. npm can also run the scripts after installing dependencies, but pnpm is the canonical package manager for this checkout. Vite's Node requirements: https://vite.dev/guide/.

## Prototype status

The interface uses neutral voting copy without prototype/test banners. The active stations use supplied real entrance coordinates; the schedule and submission service remain mock implementations. The Archive is a complete, static station directory with separate entrance/elevator counts and scheduled-service data. Browser storage uses the `mta-exit:v2` namespace so the original QA ballot and appearance choices do not seed the experience: the first visit starts in System appearance with every exit unassigned. Subsequent explicit preferences and personal drafts persist normally.

This is a functional frontend demonstration, not a public voting system. Try the introduction, number every exit at 135 St (2/3), 207 St - Inwood (A), and Tottenville (SIR), revisit stations, review, and simulate submission. These stations have six, six, and four entrances respectively. A separate one-exit fixture in tests/fixtures supports the future April Fools special without appearing on the ordinary ballot. Archive and supporting information pages are included. Only English and Korean are enabled; eleven future languages remain visibly disabled.

Active entrance types and coordinates are supplied station data. Dates and winning arrangements remain mock fixtures. The Archive directory uses the saved source inventory and entrance records documented below. Dates intentionally sit outside 2027. The active demo is explicitly selected regardless of the clock. Entrance IDs use station ID and coordinates, not array position. Temporary letter labels distinguish entrances without implying voted numbers. The new demo-ballot-v2 draft key isolates old placeholder votes. The real 2027 schedule, group sizes and cadence remain undecided. This is not a full-system dataset or a proposed actual voting schedule.

## Structure and replacement boundaries

Theme selects any of the 25 circular service bullets independently of Appearance. Default follows G green in light mode and A/C/E blue in dark mode; an explicit service color persists across modes and reloads. Colors are centralized in `src/data/themes.ts`, using the [supplied subway nomenclature table](https://en.wikipedia.org/wiki/List_of_New_York_City_Subway_lines#Nomenclature). Subway circles are rendered as text on colored circles. The SIR asset is [NYCS-bull-trans-SIR-Std.svg by Minoa](https://commons.wikimedia.org/wiki/File:NYCS-bull-trans-SIR-Std.svg), marked PD-textlogo on Commons, downloaded locally with its transparent outer margin cropped via viewBox. Its circle fill is `#0078C6`. No diamond variants are included. Source assets require no runtime network requests.

- `src/domain/types.ts`: provider-neutral station, exit, voting-period, ballot, result and service contracts. Exit IDs are permanent identities; voter numbers live only in assignments. Coordinates, accessibility and metadata are optional.
- `src/domain/voting.ts`: pure assignment, uniqueness, completeness and stored-draft validation. Independent of UI and mapping.
- `src/data/stations.ts`: real entrance coordinates, station/GTFS identifiers and a `StationProvider`, plus separate legacy archive fixtures.
- `src/data/schedule.ts`: separate `ScheduleProvider` for active period and chronologically displayable archive. Periods hold arbitrary station-ID lists and explicit timestamps, with optional sequence and special-event metadata. No fixed weekly or 52-period assumptions.
- `src/components/StationMap.tsx`: the map boundary. Takes a station, assignments, selection, callback and read-only flag. Uses Leaflet 1.9.4, OpenStreetMap tiles and custom vote markers, reusing the test page setup. Fits each station’s bounds and observes resizing. No API key is required.
- `src/state/useBallot.ts`: shared map/list voting state and period-keyed draft persistence. Drafts are sanitized when restored. The ballot screen is mounted for the configured active period; a future live schedule loader should key this screen by period ID when switching periods.
- `src/services/storage.ts`: best-effort local persistence. Language, appearance, period introduction dismissals and draft ballots are device-local. Unavailable storage does not block voting.
- `src/services/submission.ts`: asynchronous simulated submission with complete-ballot validation and a demo receipt. Replace the `SubmissionService` with an API client later. No ballot leaves the browser today.
- `src/locales/en.json`, `ko.json`, `src/i18n.ts`: i18next resources and language persistence. Add a resource and enable its selector entry to introduce another language. Components use resource keys and localized data fields. Future authoritative station names can use the same domain text abstraction or adapter fallback.
- `src/state/usePreferences.ts`, `src/styles.css`: System/Light/Dark preference with live system change handling. Reusable background tokens use G green `#6CBE45` and A/C/E blue `#0039A6`; content stays on high-contrast panels.
- `src/App.tsx`: compact shell and hash routes. Hash URLs support browser back/forward and portable static hosting without server rewrite rules. Informational content is localized.

The UI is mobile-first, with 44px minimum control heights, keyboard-operable native selectors, labeled map markers, an accessible non-map list, a native modal dialog and logical CSS properties for future RTL work. On narrow screens the map and list stack; wider layouts show them side by side. Map tiles load from OpenStreetMap; Leaflet is bundled locally. No tracking is added.

## Before public voting

Validate authoritative station/exit data and map tile usage for public deployment; finalize the actual schedule and methodology, including aggregation and tie handling; implement server-side ballot validation, durable storage, appropriate abuse protections and submission recovery/idempotency; establish privacy/terms and feedback handling; review translations with native speakers; conduct assistive-technology and real-device testing; and choose public hosting, security operations and a domain. The archive type anticipates distributions and alternative arrangements but no real aggregation is implemented.

The repository publishes the frontend demonstration to https://unpixelated-ideas.github.io/exitproject/ through GitHub Actions and GitHub Pages on each push to `main`. The workflow runs lint, tests and a production build before deployment. Real ballot collection still requires a backend. This is a conventional portable React + TypeScript + Vite application; future publication can serve its build output while adapters connect to the chosen backend.

## Archive directory

The Archive includes 493 operating stations in 444 station/complex rows, with search and seven sortable columns. Non-elevator access points and entrance elevators are separate; regular services include weekends and limited scheduled trips, with additional overnight routes shown separately. Planned T connections are labeled explicitly. Rows are not yet linked to voting results.

The directory snapshot, source provenance, guarded identifier corrections, and offline rebuild instructions are documented in [reference-files/archive/README.md](reference-files/archive/README.md). Generated data lives in `src/data/archive-directory.json`, separate from the active ballot fixtures. English/Korean interface text and existing themes are supported. The full directory loads only when the Archive is opened.

Resumable implementation checkpoints are saved in `../ARCHIVE_IMPLEMENTATION.md`.
