# Scheduled real voting

The real service is `https://mta-exit-voting.cloaks-chimps-6e.workers.dev`.
It uses the separate `mta-exit-votes` D1 database, bound as `DB`, with a
production environment marker. The test Worker and database are separate.

The manifest follows the application's 54 voting periods in UTC. January 1
opens at 00:00 UTC (December 31 at 7 PM in New York). Period ends are exclusive.
The April 1–20 special remains available alongside weekly voting. No missed
period accepts new submissions. Exact retries can recover an earlier receipt.

The API validates all station/exit IDs and complete number permutations. A
unique period/browser-hash database constraint makes competing submissions
atomic. Browser UUIDs, retry IDs, and receipts persist in localStorage; the
server stores a period-specific browser hash, ballot, request ID, receipt and
submission timestamp. It stores no raw browser UUID, IP, email or fingerprint
in the ballot table. Cloudflare provider logs are separate. This browser-only
limit is bypassable by clearing storage or using another browser; it is not
person-level identity verification.

## Build and check

Install the application's dependencies first. From the repository root:

    node --test voting-api/production/*.test.mjs
    cd application
    pnpm exec tsx ../voting-api/production/build-manifest.ts
    cd ..
    node voting-api/production/bundle.mjs

The bundle is `deploy-worker.mjs`. Deploy it only to `mta-exit-voting`, with
`DB` bound only to `mta-exit-votes`. Apply `schema.sql` only to this database.
The hostname and database marker checks reject accidental cross-environment
connections. Preview hostnames cannot accept real ballots.

`verify-deployment.mjs` checks health and pre-opening rejection. It refuses to
send a probe after the first opening date. Do not insert synthetic real votes.

`ui-check-server.mjs` serves a copy of the production build on local port 5175,
redirecting its API URLs to an in-memory Worker/database. It never contacts the
real voting API. Set `/tmp/mta-ui-clock.json` to a JSON object with `clock` as an
ISO timestamp and optional `fail: true` for outage checks. This QA service must
never be deployed. Stop it after testing.

## Verification

Automated checks cover all period boundaries, manifest membership, invalid
ballots, concurrent requests, duplicate rejection, retry recovery after closing,
wrong environment, oversized requests and database failures. Application tests
cover persistent browser/retry IDs, storage failures, real/test separation and
server-clock validation. Browser QA covered all 37 opening choices, outage
recovery, acceptance, receipt restoration after reload, locked receipt editing,
and the April weekly/special switch.

On November 24, 2026 the real database contained zero submissions. Live health
returned ready and the API rejected a pre-opening ballot with `period_closed`.
