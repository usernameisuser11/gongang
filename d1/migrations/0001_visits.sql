CREATE TABLE visits (
  visit_id TEXT PRIMARY KEY NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
