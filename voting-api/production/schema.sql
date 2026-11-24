-- Production only: mta-exit-votes. Never apply to the test database.
CREATE TABLE IF NOT EXISTS environment_marker (
 id INTEGER PRIMARY KEY CHECK(id = 1),
 environment TEXT NOT NULL CHECK(environment = 'production')
);
INSERT OR IGNORE INTO environment_marker VALUES (1, 'production');
CREATE TABLE IF NOT EXISTS submissions (
 receipt TEXT PRIMARY KEY,
 period_id TEXT NOT NULL,
 browser_hash TEXT NOT NULL,
 request_id TEXT NOT NULL,
 ballot_json TEXT NOT NULL CHECK(json_valid(ballot_json)),
 submitted_at TEXT NOT NULL,
 UNIQUE(period_id, browser_hash)
);
