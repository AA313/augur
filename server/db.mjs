// Database layer for AUGUR. Zero external deps: uses the built-in node:sqlite (Node 22.5+).
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, 'augur.db'));
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

// seed the shared post-number counter high, like a real imageboard, only once.
const haveCounter = db.prepare(`SELECT 1 FROM counters WHERE name = 'post_no'`).get();
if (!haveCounter) {
  db.prepare(`INSERT INTO counters (name, value) VALUES ('post_no', 4021400)`).run();
}

// allocate the next number from the shared sequence (atomic within SQLite).
const allocStmt = db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'post_no' RETURNING value`);
export function nextNo() {
  return allocStmt.get().value;
}

// small helpers shared across routes
export const nowISO = () => new Date().toISOString();
export const uid = () => randomUUID();
export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

// deterministic JSON with recursively sorted keys — identical to the front end / verifier.
export function canon(o) {
  if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
  if (o && typeof o === 'object') {
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  return JSON.stringify(o);
}

// a per-thread, non-cross-linkable poster id: hash(thread_no + client + daily secret), truncated.
const DAILY_SECRET_BASE = process.env.AUGUR_SECRET || 'augur-dev-secret-rotate-in-prod';
export function posterId(threadNo, client) {
  const day = new Date().toISOString().slice(0, 10);
  return sha256hex(`${threadNo}|${client}|${day}|${DAILY_SECRET_BASE}`).slice(0, 8);
}

// voter fingerprint for registry votes: salted hash of the client, rotated daily.
export function voterFingerprint(client) {
  const day = new Date().toISOString().slice(0, 10);
  return sha256hex(`vote|${client}|${day}|${DAILY_SECRET_BASE}`).slice(0, 16);
}
