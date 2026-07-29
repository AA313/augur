-- AUGUR data model (SQLite). Maps 1:1 to augur-api-spec.md.
-- Portable to Cloudflare D1 (SQLite) or Postgres with minor type tweaks.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- a single shared number space for Commons thread/post numbers (like a real imageboard),
-- and any other monotonic counters. Allocated with UPDATE ... RETURNING.
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

-- owners of private data. Anonymous Commons use creates no user.
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  created_at      TEXT NOT NULL,
  research_opt_in INTEGER NOT NULL DEFAULT 0
);

-- short-lived login tokens (magic link). In dev the token is returned directly.
CREATE TABLE IF NOT EXISTS login_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

-- bearer session tokens.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- private journal. An entry groups one or more sealed versions (capture-then-seal).
CREATE TABLE IF NOT EXISTS vault_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  title      TEXT,
  dream_date TEXT,
  text       TEXT,                   -- legacy single-text field (unused by capture entries)
  tags       TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vault_user ON vault_entries(user_id, created_at);

-- append-only sealed versions of an entry: the raw first capture, then later passes.
-- Each is immutable and carries a real SHA-256 over the shared seal payload.
CREATE TABLE IF NOT EXISTS vault_versions (
  id         TEXT PRIMARY KEY,
  entry_id   TEXT NOT NULL REFERENCES vault_entries(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  seq        INTEGER NOT NULL,
  kind       TEXT NOT NULL,          -- raw | pass
  content    TEXT NOT NULL,
  claim      TEXT NOT NULL DEFAULT '{}',
  nonce      TEXT NOT NULL,
  hash       TEXT NOT NULL,          -- sha256(canon({content,claim,nonce,created_at}))
  created_at TEXT NOT NULL           -- client seal time
);
CREATE INDEX IF NOT EXISTS idx_vv_entry ON vault_versions(entry_id, seq);

-- commit-reveal proofs.
CREATE TABLE IF NOT EXISTS seals (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  commitment_hash  TEXT NOT NULL,
  ciphertext       TEXT,                 -- opaque; server never needs plaintext to prove time
  claim            TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,        -- client clock
  sealed_at        TEXT NOT NULL,        -- server clock
  tsa_token        TEXT,                 -- RFC-3161 token over the hash (base64)
  tsa_name         TEXT,                 -- which Time-Stamping Authority signed it
  ots_proof        TEXT,                 -- OpenTimestamps receipt (base64)
  ots_status       TEXT NOT NULL DEFAULT 'pending',   -- pending | complete
  anchor_time      TEXT,                 -- null until Bitcoin attests
  status           TEXT NOT NULL DEFAULT 'sealed',    -- sealed | unsealed | resolved
  revealed_payload TEXT,                 -- json, null until reveal
  revealed_at      TEXT,
  is_public        INTEGER NOT NULL DEFAULT 0,
  handle           TEXT,                 -- public anon name, set at publish
  outcome          TEXT                  -- hit | miss | pending, null until resolved
);
CREATE INDEX IF NOT EXISTS idx_seals_user ON seals(user_id, sealed_at);
CREATE INDEX IF NOT EXISTS idx_seals_public ON seals(is_public, revealed_at);

-- community judgement on published seals.
CREATE TABLE IF NOT EXISTS registry_votes (
  id                TEXT PRIMARY KEY,
  seal_id           TEXT NOT NULL REFERENCES seals(id),
  voter_fingerprint TEXT NOT NULL,
  vote              TEXT NOT NULL,       -- hit | miss
  created_at        TEXT NOT NULL,
  UNIQUE(seal_id, voter_fingerprint)
);

-- anonymous board.
CREATE TABLE IF NOT EXISTS commons_threads (
  no          INTEGER PRIMARY KEY,       -- from the shared counter
  board       TEXT NOT NULL,
  name        TEXT,
  poster_id   TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  bumped_at   TEXT NOT NULL,
  reply_count INTEGER NOT NULL DEFAULT 0,
  removed     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_threads_board ON commons_threads(board, bumped_at);

CREATE TABLE IF NOT EXISTS commons_posts (
  no         INTEGER PRIMARY KEY,        -- same shared counter
  thread_no  INTEGER NOT NULL REFERENCES commons_threads(no),
  name       TEXT,
  poster_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  removed    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON commons_posts(thread_no, no);

CREATE TABLE IF NOT EXISTS commons_reports (
  id         TEXT PRIMARY KEY,
  post_no    INTEGER NOT NULL,
  reason     TEXT,
  created_at TEXT NOT NULL,
  resolved   INTEGER NOT NULL DEFAULT 0
);
