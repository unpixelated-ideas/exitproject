# Display board: GitHub Pages MVP

The board now runs entirely in the browser. No Python server, hosting account,
API key, or `VITE_BOARD_API_URL` variable is required. The hidden route remains
`#/display-board`.

Run `pnpm dev` from `application` for local development. `pnpm build` produces
the self-contained Pages site, including `public/board-schedule.json`.

The Pages workflow automatically runs `python3 scripts/prepare-board-schedule.py`
before building. It downloads MTA's supplemented schedule and creates compact,
deduplicated trip patterns, destinations and stop names. The generated snapshot
is also included locally so ordinary builds need no schedule download. To refresh
it manually, run that same command (or pass a local GTFS zip path). A failed
schedule preparation fails deployment and leaves the previously published site
intact. New deployments refresh the schedule; no visitor downloads the GTFS zip.

The browser fetches MTA's public subway/SIR protobuf feeds directly, decodes them
with MobilityData's GTFS bindings, caches snapshots across station changes, and
refreshes every 25 seconds. Feeds older than 90 seconds are withheld. Partial
feed failures do not suppress healthy feed families. All subway feeds are checked
to retain trains during diversions. SIR uses its own feed.

Full-color weather uses NWS directly, with nearby station discovery and recent
observations. The browser supplies its User-Agent; no custom identification header
or private credential is used. Weather failure does not block arrivals.

This depends on MTA/NWS continuing to permit browser access. Schedule matches
are validated against live stop order; unmatched or diverted trips use the last
reported live stop as the destination estimate. Seoul movement is an estimate
from predictions, not GPS tracking.

The Python service files and root Render blueprint are legacy tooling, unused by
the MVP. They can be retained for comparison or a future centralized service.
