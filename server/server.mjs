// AUGUR backend — zero external deps (node:http + node:sqlite). Serves the static site and
// the /api surface from one origin. Implements augur-api-spec.md (persistence foundation).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { db, nextNo, nowISO, uid, canon, sha256hex, posterId, voterFingerprint } from './db.mjs';
import { seedCommonsIfEmpty } from './seed.mjs';
import { seedRegistryIfEmpty } from './seed-registry.mjs';
import { anchorHash, inspectToken } from './anchor.mjs';
import { submitOTS, upgradeOTS, otsBlock } from './ots.mjs';
import { scanImage, addToBlocklist, blocklistSize, scannerConfigured } from './scan.mjs';
import { mailConfigured, sendMagicLink } from './mail.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');              // project root holds the .html files
const PORT = process.env.PORT || 8787;
const DEV = process.env.NODE_ENV !== 'production';

const BOARDS = [
  { slug: 'came-true', label: 'dreams that arrived early' },
  { slug: 'recurring', label: 'the ones that keep returning' },
  { slug: 'lucid', label: 'waking up inside the dream' },
  { slug: 'astral', label: 'projection, onset, the drift' },
  { slug: 'altered', label: 'a substance in the dream' },
  { slug: 'nightmares', label: 'the dark ones' },
  { slug: 'discussion', label: 'is any of this real' },
];
const BOARD_SLUGS = new Set(BOARDS.map((b) => b.slug));

// ---------- tiny helpers ----------
const json = (res, status, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};
const fail = (res, status, code, message) => json(res, status, { error: { code, message } });
const clientOf = (req) => (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

// --- simple in-memory rate limiting (per client, sliding window) ---
const rlBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (rlBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { rlBuckets.set(key, arr); return false; }
  arr.push(now); rlBuckets.set(key, arr);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, arr] of rlBuckets) { const f = arr.filter((t) => now - t < 120000); if (f.length) rlBuckets.set(k, f); else rlBuckets.delete(k); } }, 300000).unref?.();

// --- admin auth for moderation. Set AUGUR_ADMIN_TOKEN in production; do not rely on the default. ---
const ADMIN_TOKEN = process.env.AUGUR_ADMIN_TOKEN || 'augur-admin-dev';
const isAdmin = (req) => (req.headers['x-augur-admin'] || '') === ADMIN_TOKEN;

// --- image attachments (held pending until a moderator approves; metadata stripped client-side) ---
const ALLOWED_IMG = new Set(['image/jpeg', 'image/png', 'image/webp']);
function validImage(img) {
  if (!img || typeof img !== 'object' || !ALLOWED_IMG.has(img.mime)) return null;
  const data = String(img.data || '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length < 32 || data.length > 3.2e6) return null;   // up to ~2.4MB
  return { mime: img.mime, data };
}
async function attachImage(no, board, img, now) {
  const im = validImage(img); if (!im) return;
  const phash = (typeof img.phash === 'string' && /^[0-9a-f]{16}$/.test(img.phash)) ? img.phash : null;
  const scan = await scanImage({ mime: im.mime, data: im.data, phash });
  if (scan.action === 'block') return;   // dropped before it ever reaches the queue; pre-moderation covers the rest
  db.prepare(`INSERT INTO commons_attachments (id, post_no, board, mime, data, phash, status, created_at) VALUES (?,?,?,?,?,?, 'pending', ?)`)
    .run(uid(), no, board, im.mime, im.data, phash, now);
}
function attachmentOf(no) {
  const a = db.prepare(`SELECT id, status FROM commons_attachments WHERE post_no = ? AND status != 'rejected' ORDER BY created_at DESC LIMIT 1`).get(no);
  if (!a) return null;
  return { id: a.status === 'approved' ? a.id : null, status: a.status };   // id withheld until approved
}

function userFrom(req) {
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const s = db.prepare(`SELECT user_id, expires_at FROM sessions WHERE token = ?`).get(m[1]);
  if (!s || s.expires_at < nowISO()) return null;
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(s.user_id) || null;
}

// ---------- route table ----------
const routes = [];
const add = (method, path, handler) => {
  const keys = [];
  const rx = new RegExp('^' + path.replace(/:[^/]+/g, (k) => { keys.push(k.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, handler });
};

// ===== health =====
add('GET', '/api/health', async (ctx) => json(ctx.res, 200, { ok: true, time: nowISO(), mail: mailConfigured() }));

// Absolute base URL for building the magic link. Prefer PUBLIC_BASE_URL in production
// (so the link can never be pointed elsewhere by a spoofed Host header); fall back to
// the request's forwarded proto + host for local dev.
function baseUrlFromReq(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = req.headers['host'] || ('127.0.0.1:' + PORT);
  return proto + '://' + host;
}

// ===== auth =====
add('POST', '/api/auth/request', async ({ res, req, body }) => {
  if (!rateLimit('auth:' + clientOf(req), 6, 60000)) return fail(res, 429, 'rate_limited', 'Too many sign-in attempts. Please wait a minute.');
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return fail(res, 400, 'bad_email', 'A valid email is required.');
  const token = uid();
  const created = nowISO();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO login_tokens (token, email, created_at, expires_at, used) VALUES (?,?,?,?,0)`).run(token, email, created, expires);
  const base = (process.env.PUBLIC_BASE_URL || baseUrlFromReq(req)).replace(/\/+$/, '');
  const next = (typeof body.next === 'string' && /^[\w.-]+\.html$/.test(body.next)) ? body.next : 'vault.html';
  const link = `${base}/auth.html?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  if (mailConfigured()) {
    // Real sign-in: email the one-time magic link, and NEVER return the token to the browser.
    try { await sendMagicLink(email, link); }
    catch (e) { console.error('[auth] mail send failed:', e.message); return fail(res, 502, 'mail_failed', 'Could not send the sign-in email. Please try again in a moment.'); }
    return json(res, 200, { ok: true, sent: true });
  }
  if (DEV) {
    // Local dev only: no mail provider, so return the link/token directly so dev can sign in.
    console.log('[auth] mail not configured (dev); sign-in link for ' + email + ':\n  ' + link);
    return json(res, 200, { ok: true, sent: false, dev_login_token: token, dev_link: link, note: 'Mail not configured (dev): link returned directly.' });
  }
  // Production without a mail provider: fail secure. Never hand the token to the browser.
  console.error('[auth] mail not configured in production. Set RESEND_API_KEY + MAIL_FROM (+ PUBLIC_BASE_URL).');
  return fail(res, 503, 'mail_unconfigured', 'Email sign-in is not set up on this server yet. Please try again later.');
});

add('POST', '/api/auth/verify', async ({ res, body }) => {
  const token = (body.token || '').trim();
  const lt = db.prepare(`SELECT * FROM login_tokens WHERE token = ?`).get(token);
  if (!lt || lt.used || lt.expires_at < nowISO()) return fail(res, 401, 'bad_token', 'Login link is invalid or expired.');
  db.prepare(`UPDATE login_tokens SET used = 1 WHERE token = ?`).run(token);
  let user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(lt.email);
  if (!user) {
    const id = uid();
    db.prepare(`INSERT INTO users (id, email, created_at, research_opt_in) VALUES (?,?,?,0)`).run(id, lt.email, nowISO());
    user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  }
  const session = uid();
  const expires = new Date(Date.now() + 30 * 864e5).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)`).run(session, user.id, nowISO(), expires);
  json(res, 200, { session_token: session, user: publicUser(user) });
});

add('POST', '/api/auth/logout', async ({ res, req, user }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  json(res, 200, { ok: true });
});

add('GET', '/api/auth/me', async ({ res, user }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  json(res, 200, { user: publicUser(user) });
});

const publicUser = (u) => ({ id: u.id, email: u.email, created_at: u.created_at, research_opt_in: !!u.research_opt_in,
  kdf_salt: u.kdf_salt || null, kdf_check: u.kdf_check || null, vault_ready: !!u.kdf_salt });

// ===== vault (private, capture-then-seal) =====
// Verify a bundle against the shared seal contract (identical to the verifier / seal page).
function verifyBundle(b) {
  if (!b || typeof b !== 'object') return null;
  const claim = b.claim && typeof b.claim === 'object' ? b.claim : { resolution_by: '', domain: '', specificity: '' };
  const payload = { content: String(b.content ?? ''), claim, nonce: String(b.nonce ?? ''), created_at: String(b.created_at ?? '') };
  if (!payload.content.trim() || !payload.nonce || !payload.created_at) return null;
  const h = sha256hex(canon(payload));
  if (h !== String(b.sha256 || '').toLowerCase()) return null;
  return { ...payload, hash: h };
}
const versionsOf = (entryId) => db.prepare(`SELECT * FROM vault_versions WHERE entry_id = ? ORDER BY seq ASC`).all(entryId);
// End-to-end encrypted: we hand back only ciphertext + the non-secret sealed fields. The client
// decrypts with the user's passphrase-derived key, then it can rebuild and verify the bundle itself.
const versionOut = (v) => ({ id: v.id, seq: v.seq, kind: v.kind, ciphertext: v.ciphertext, nonce: v.nonce, hash: v.hash, created_at: v.created_at });
const entryOut = (e) => ({ id: e.id, title: e.title, dream_date: e.dream_date, tags: JSON.parse(e.tags), created_at: e.created_at, updated_at: e.updated_at, versions: versionsOf(e.id).map(versionOut) });

add('GET', '/api/vault/entries', async ({ res, user }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const rows = db.prepare(`SELECT * FROM vault_entries WHERE user_id = ? ORDER BY created_at DESC`).all(user.id);
  json(res, 200, { items: rows.map(entryOut), next_cursor: null });
});

function validVersion(v) { return v && v.ciphertext && v.hash && v.nonce && v.created_at; }

add('POST', '/api/vault/entries', async ({ res, user, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const v = body.version;
  if (!validVersion(v)) return fail(res, 400, 'bad_version', 'A version needs ciphertext, hash, nonce and created_at.');
  const id = uid(), now = nowISO();
  const tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  db.prepare(`INSERT INTO vault_entries (id, user_id, title, dream_date, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`)
    .run(id, user.id, (body.title || '').slice(0, 120) || null, body.dream_date || null, tags, now, now);
  db.prepare(`INSERT INTO vault_versions (id, entry_id, user_id, seq, kind, ciphertext, nonce, hash, created_at) VALUES (?,?,?,?, 'raw', ?,?,?,?)`)
    .run(uid(), id, user.id, 1, v.ciphertext, v.nonce, v.hash, v.created_at);
  json(res, 201, entryOut(db.prepare(`SELECT * FROM vault_entries WHERE id = ?`).get(id)));
});

// append a later pass. Versions are append-only and immutable (no edit/delete of a version).
add('POST', '/api/vault/entries/:id/versions', async ({ res, user, params, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const e = db.prepare(`SELECT * FROM vault_entries WHERE id = ?`).get(params.id);
  if (!e || e.user_id !== user.id) return fail(res, 404, 'not_found', 'Entry not found.');
  const v = body.version;
  if (!validVersion(v)) return fail(res, 400, 'bad_version', 'A version needs ciphertext, hash, nonce and created_at.');
  const seq = (db.prepare(`SELECT MAX(seq) AS m FROM vault_versions WHERE entry_id = ?`).get(params.id).m || 0) + 1;
  db.prepare(`INSERT INTO vault_versions (id, entry_id, user_id, seq, kind, ciphertext, nonce, hash, created_at) VALUES (?,?,?,?, 'pass', ?,?,?,?)`)
    .run(uid(), params.id, user.id, seq, v.ciphertext, v.nonce, v.hash, v.created_at);
  db.prepare(`UPDATE vault_entries SET updated_at = ? WHERE id = ?`).run(nowISO(), params.id);
  json(res, 201, entryOut(db.prepare(`SELECT * FROM vault_entries WHERE id = ?`).get(params.id)));
});

// Store the per-user KDF salt + passphrase check on first setup. Both are non-secret; the
// passphrase itself and the derived key never reach the server.
add('POST', '/api/vault/setup', async ({ res, user, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT kdf_salt FROM users WHERE id = ?`).get(user.id);
  if (row.kdf_salt) return fail(res, 409, 'already_set', 'A Vault passphrase is already set for this account.');
  if (!body.kdf_salt || !body.kdf_check) return fail(res, 400, 'bad_setup', 'kdf_salt and kdf_check are required.');
  db.prepare(`UPDATE users SET kdf_salt = ?, kdf_check = ? WHERE id = ?`).run(String(body.kdf_salt).slice(0, 200), String(body.kdf_check).slice(0, 400), user.id);
  json(res, 200, { ok: true });
});

add('DELETE', '/api/vault/entries/:id', async ({ res, user, params }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM vault_entries WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Entry not found.');
  db.prepare(`DELETE FROM vault_versions WHERE entry_id = ?`).run(params.id);
  db.prepare(`DELETE FROM vault_entries WHERE id = ?`).run(params.id);
  json(res, 200, { ok: true });
});

// ===== seals =====
add('POST', '/api/seals', async ({ res, user, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const hash = (body.commitment_hash || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return fail(res, 400, 'bad_hash', 'commitment_hash must be a 64-char SHA-256 hex string.');
  const id = uid(), sealed = nowISO();
  const claim = JSON.stringify(body.claim || {});
  db.prepare(`INSERT INTO seals (id, user_id, commitment_hash, ciphertext, claim, created_at, sealed_at, ots_status, status)
              VALUES (?,?,?,?,?,?,?, 'pending', 'sealed')`)
    .run(id, user.id, hash, body.ciphertext || null, claim, body.created_at || sealed, sealed);
  // Two real anchors, in parallel and both non-fatal: an RFC-3161 TSA token (instant) and an
  // OpenTimestamps submission (Bitcoin, confirms over hours). If neither is reachable the seal
  // still stands and can be anchored later.
  let anchor = null, ots = null;
  try { [anchor, ots] = await Promise.all([anchorHash(hash).catch(() => null), submitOTS(hash).catch(() => null)]); } catch { /* leave unanchored */ }
  if (anchor) db.prepare(`UPDATE seals SET tsa_token = ?, tsa_name = ?, anchor_time = ? WHERE id = ?`).run(anchor.tsa_token, anchor.tsa_name, anchor.anchor_time, id);
  if (ots) db.prepare(`UPDATE seals SET ots_proof = ?, ots_status = 'pending' WHERE id = ?`).run(ots.ots_proof, id);
  json(res, 201, { id, sealed_at: sealed, anchor: {
    time: anchor ? anchor.anchor_time : null, tsa: anchor ? anchor.tsa_name : null, receipt: anchor ? anchor.tsa_token : null,
    ots_proof: ots ? ots.ots_proof : null, ots_status: ots ? 'pending' : 'none',
  } });
});

add('GET', '/api/seals', async ({ res, user }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const rows = db.prepare(`SELECT * FROM seals WHERE user_id = ? ORDER BY sealed_at DESC`).all(user.id);
  json(res, 200, { items: rows.map((r) => sealOut(r, true)), next_cursor: null });
});

add('GET', '/api/seals/:id', async ({ res, user, params }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Seal not found.');
  json(res, 200, sealOut(row, true));
});

add('POST', '/api/seals/:id/reveal', async ({ res, user, params, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Seal not found.');
  const payload = body.revealed_payload;
  if (!payload || typeof payload !== 'object') return fail(res, 400, 'bad_payload', 'revealed_payload is required.');
  const recomputed = sha256hex(canon(payload));
  if (recomputed !== row.commitment_hash) return fail(res, 422, 'mismatch', 'Revealed payload does not match the sealed commitment.');
  db.prepare(`UPDATE seals SET status = 'unsealed', revealed_payload = ?, revealed_at = ? WHERE id = ?`)
    .run(JSON.stringify(payload), nowISO(), params.id);
  json(res, 200, sealOut(db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id), true));
});

add('POST', '/api/seals/:id/publish', async ({ res, user, params, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Seal not found.');
  // Publishing is allowed while still sealed (a public commitment whose content stays hidden
  // until reveal, proving anteriority) or after reveal.
  const handle = (body.handle || 'anonymous').toString().slice(0, 40) || 'anonymous';
  db.prepare(`UPDATE seals SET is_public = 1, handle = ? WHERE id = ?`).run(handle, params.id);
  json(res, 200, sealOut(db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id), true));
});

add('PATCH', '/api/seals/:id/resolve', async ({ res, user, params, body }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Seal not found.');
  const outcome = body.outcome;
  if (outcome !== 'hit' && outcome !== 'miss') return fail(res, 400, 'bad_outcome', 'outcome must be "hit" or "miss".');
  db.prepare(`UPDATE seals SET outcome = ?, status = 'resolved' WHERE id = ?`).run(outcome, params.id);
  json(res, 200, sealOut(db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id), true));
});

// Try to fold a seal's pending OpenTimestamps proof into Bitcoin (works once the calendars have
// confirmed, which takes hours). Owner-only. The periodic job below does this automatically too.
add('POST', '/api/seals/:id/upgrade', async ({ res, user, params }) => {
  if (!user) return fail(res, 401, 'unauth', 'Sign in required.');
  const row = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!row || row.user_id !== user.id) return fail(res, 404, 'not_found', 'Seal not found.');
  if (!row.ots_proof) return json(res, 200, { ots_status: 'none', block: null, changed: false });
  const up = await upgradeOTS(row.ots_proof);
  if (up.changed || up.ots_status !== row.ots_status) {
    db.prepare(`UPDATE seals SET ots_proof = ?, ots_status = ? WHERE id = ?`).run(up.ots_proof, up.ots_status, params.id);
  }
  json(res, 200, { ots_status: up.ots_status, block: up.block, changed: up.changed });
});

function sealOut(r, full = false) {
  const o = {
    id: r.id, commitment_hash: r.commitment_hash, claim: JSON.parse(r.claim),
    created_at: r.created_at, sealed_at: r.sealed_at, ots_status: r.ots_status,
    anchor_time: r.anchor_time, tsa_name: r.tsa_name, status: r.status, is_public: !!r.is_public,
    handle: r.handle, outcome: r.outcome, revealed_at: r.revealed_at,
    ots_block: r.ots_status === 'complete' && r.ots_proof ? otsBlock(r.ots_proof) : null,
  };
  if (full) {
    if (r.revealed_payload) o.revealed_payload = JSON.parse(r.revealed_payload);
    if (r.ciphertext) o.ciphertext = r.ciphertext;   // owner-only; lets the client reveal after a reload
    if (r.tsa_token) o.tsa_token = r.tsa_token;       // owner-only; goes into the downloadable proof
    if (r.ots_proof) o.ots_proof = r.ots_proof;       // owner-only; the OpenTimestamps .ots (base64)
  }
  return o;
}

// ===== proofs (public verification) =====
add('GET', '/api/proofs/:id', async ({ res, params }) => {
  const r = db.prepare(`SELECT * FROM seals WHERE id = ?`).get(params.id);
  if (!r || !r.is_public) return fail(res, 404, 'not_found', 'No public proof with that id.');
  const anchor = { time: r.anchor_time, tsa: r.tsa_name, receipt: r.tsa_token, ots_proof: r.ots_proof, ots_status: r.ots_status };
  if (r.revealed_payload) {
    const p = JSON.parse(r.revealed_payload);
    // shape matches the standalone verifier's bundle (sha256 field), plus the anchor.
    return json(res, 200, { content: p.content, claim: p.claim, nonce: p.nonce, created_at: p.created_at, sha256: r.commitment_hash, anchor });
  }
  // public but not revealed: anteriority provable, content withheld.
  json(res, 200, { sha256: r.commitment_hash, anchor });
});

// ===== registry (public) =====
add('GET', '/api/registry', async ({ res, query }) => {
  const clauses = ['is_public = 1'];
  const args = [];
  if (query.outcome) { clauses.push('outcome = ?'); args.push(query.outcome); }
  const rows = db.prepare(`SELECT * FROM seals WHERE ${clauses.join(' AND ')} ORDER BY sealed_at DESC LIMIT 200`).all(...args);
  json(res, 200, { items: rows.map(registryOut), next_cursor: null });
});

add('GET', '/api/registry/stats', async ({ res }) => {
  const s = db.prepare(`SELECT
      COUNT(*) AS sealed,
      SUM(CASE WHEN outcome='hit' THEN 1 ELSE 0 END) AS hits,
      SUM(CASE WHEN outcome='miss' THEN 1 ELSE 0 END) AS misses,
      SUM(CASE WHEN outcome IS NULL OR outcome='pending' THEN 1 ELSE 0 END) AS pending
    FROM seals WHERE is_public = 1`).get();
  const hits = s.hits || 0, misses = s.misses || 0;
  const resolved = hits + misses;
  json(res, 200, { sealed: s.sealed || 0, hits, misses, pending: s.pending || 0, hit_rate: resolved ? Math.round((hits / resolved) * 100) : null });
});

add('GET', '/api/registry/leaderboard', async ({ res }) => {
  const rows = db.prepare(`SELECT handle, COUNT(*) AS hits FROM seals WHERE is_public = 1 AND outcome = 'hit' GROUP BY handle ORDER BY hits DESC LIMIT 20`).all();
  json(res, 200, { items: rows });
});

add('GET', '/api/registry/:id', async ({ res, params }) => {
  const r = db.prepare(`SELECT * FROM seals WHERE id = ? AND is_public = 1`).get(params.id);
  if (!r) return fail(res, 404, 'not_found', 'No public registry entry with that id.');
  json(res, 200, registryOut(r));
});

add('POST', '/api/registry/:id/vote', async ({ res, req, params, body }) => {
  if (!rateLimit('vote:' + clientOf(req), 30, 60000)) return fail(res, 429, 'rate_limited', 'Too many votes too fast. Please wait a moment.');
  const r = db.prepare(`SELECT * FROM seals WHERE id = ? AND is_public = 1`).get(params.id);
  if (!r) return fail(res, 404, 'not_found', 'No public registry entry with that id.');
  const vote = body.vote;
  if (vote !== 'hit' && vote !== 'miss') return fail(res, 400, 'bad_vote', 'vote must be "hit" or "miss".');
  const fp = voterFingerprint(clientOf(req));
  const existing = db.prepare(`SELECT * FROM registry_votes WHERE seal_id = ? AND voter_fingerprint = ?`).get(params.id, fp);
  if (existing && existing.vote === vote) {
    db.prepare(`DELETE FROM registry_votes WHERE id = ?`).run(existing.id);   // same vote twice clears it
  } else if (existing) {
    db.prepare(`UPDATE registry_votes SET vote = ?, created_at = ? WHERE id = ?`).run(vote, nowISO(), existing.id);
  } else {
    db.prepare(`INSERT INTO registry_votes (id, seal_id, voter_fingerprint, vote, created_at) VALUES (?,?,?,?,?)`).run(uid(), params.id, fp, vote, nowISO());
  }
  json(res, 200, { votes: voteCounts(params.id) });
});

const voteCounts = (sealId) => {
  const v = db.prepare(`SELECT SUM(vote='hit') AS hit, SUM(vote='miss') AS miss FROM registry_votes WHERE seal_id = ?`).get(sealId);
  return { hit: v.hit || 0, miss: v.miss || 0 };
};
function registryOut(r) {
  const p = r.revealed_payload ? JSON.parse(r.revealed_payload) : {};
  return { id: r.id, handle: r.handle, claim: JSON.parse(r.claim), content: p.content ?? null,
    status: r.status, sealed_at: r.sealed_at, revealed_at: r.revealed_at, outcome: r.outcome || 'pending',
    hash: r.commitment_hash, votes: voteCounts(r.id), anchor_time: r.anchor_time, tsa_name: r.tsa_name,
    ots_status: r.ots_status, ots_block: r.ots_status === 'complete' && r.ots_proof ? otsBlock(r.ots_proof) : null };
}

// ===== commons (anonymous) =====
add('GET', '/api/commons/boards', async ({ res }) => json(res, 200, { items: BOARDS }));

add('GET', '/api/commons/stats', async ({ res }) => {
  const threads = db.prepare(`SELECT COUNT(*) AS c FROM commons_threads WHERE removed = 0`).get().c;
  const posts = db.prepare(`SELECT COUNT(*) AS c FROM commons_posts WHERE removed = 0`).get().c;
  const posters = db.prepare(`SELECT COUNT(*) AS c FROM (SELECT poster_id FROM commons_threads WHERE removed = 0 UNION SELECT poster_id FROM commons_posts WHERE removed = 0)`).get().c;
  const newest = db.prepare(`SELECT MAX(no) AS n FROM (SELECT no FROM commons_threads UNION SELECT no FROM commons_posts)`).get().n;
  json(res, 200, { threads, posts, total: threads + posts, posters, boards: BOARDS.length, newest_no: newest });
});

add('GET', '/api/commons/threads', async ({ res, query }) => {
  const board = query.board;
  let rows;
  if (board && board !== 'all') {
    rows = db.prepare(`SELECT * FROM commons_threads WHERE removed = 0 AND board = ? ORDER BY bumped_at DESC LIMIT 100`).all(board);
  } else {
    rows = db.prepare(`SELECT * FROM commons_threads WHERE removed = 0 ORDER BY bumped_at DESC LIMIT 100`).all();
  }
  json(res, 200, { items: rows.map(threadCatalogOut), next_cursor: null });
});

add('GET', '/api/commons/threads/:no', async ({ res, params }) => {
  const t = db.prepare(`SELECT * FROM commons_threads WHERE no = ? AND removed = 0`).get(Number(params.no));
  if (!t) return fail(res, 404, 'not_found', 'Thread not found.');
  const posts = db.prepare(`SELECT * FROM commons_posts WHERE thread_no = ? AND removed = 0 ORDER BY no ASC`).all(t.no);
  json(res, 200, { op: threadOut(t), posts: posts.map(postOut) });
});

add('POST', '/api/commons/threads', async ({ res, req, body }) => {
  if (!rateLimit('post:' + clientOf(req), 6, 60000)) return fail(res, 429, 'rate_limited', 'You are posting too fast. Please wait a moment.');
  const board = body.board;
  if (!BOARD_SLUGS.has(board)) return fail(res, 400, 'bad_board', 'Unknown board.');
  const bodyText = (body.body || '').trim();
  if (!bodyText) return fail(res, 400, 'empty', 'A post needs some text.');
  const no = nextNo(), now = nowISO();
  const pid = posterId(no, clientOf(req));
  db.prepare(`INSERT INTO commons_threads (no, board, name, poster_id, subject, body, created_at, bumped_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(no, board, cleanName(body.name), pid, (body.subject || '').trim() || null, bodyText, now, now);
  if (body.image) await attachImage(no, board, body.image, now);   // scanned, then held pending for a moderator
  json(res, 201, threadOut(db.prepare(`SELECT * FROM commons_threads WHERE no = ?`).get(no)));
});

add('POST', '/api/commons/threads/:no/posts', async ({ res, req, params, body }) => {
  if (!rateLimit('post:' + clientOf(req), 10, 60000)) return fail(res, 429, 'rate_limited', 'You are posting too fast. Please wait a moment.');
  const t = db.prepare(`SELECT * FROM commons_threads WHERE no = ? AND removed = 0`).get(Number(params.no));
  if (!t) return fail(res, 404, 'not_found', 'Thread not found.');
  const bodyText = (body.body || '').trim();
  if (!bodyText) return fail(res, 400, 'empty', 'A reply needs some text.');
  const no = nextNo(), now = nowISO();
  const pid = posterId(t.no, clientOf(req));   // stable within the thread
  db.prepare(`INSERT INTO commons_posts (no, thread_no, name, poster_id, body, created_at) VALUES (?,?,?,?,?,?)`)
    .run(no, t.no, cleanName(body.name), pid, bodyText, now);
  if (body.image) await attachImage(no, t.board, body.image, now);   // scanned, then held pending for a moderator
  db.prepare(`UPDATE commons_threads SET bumped_at = ?, reply_count = reply_count + 1 WHERE no = ?`).run(now, t.no);
  json(res, 201, postOut(db.prepare(`SELECT * FROM commons_posts WHERE no = ?`).get(no)));
});

add('POST', '/api/commons/posts/:no/report', async ({ res, req, params, body }) => {
  if (!rateLimit('report:' + clientOf(req), 12, 60000)) return fail(res, 429, 'rate_limited', 'Too many reports too fast. Please wait a moment.');
  const no = Number(params.no);
  // ignore reports for content that does not exist
  const exists = db.prepare(`SELECT 1 FROM commons_threads WHERE no = ? UNION SELECT 1 FROM commons_posts WHERE no = ?`).get(no, no);
  if (!exists) return fail(res, 404, 'not_found', 'No such post.');
  db.prepare(`INSERT INTO commons_reports (id, post_no, reason, created_at) VALUES (?,?,?,?)`)
    .run(uid(), no, (body.reason || '').slice(0, 300), nowISO());
  json(res, 200, { ok: true });
});

// serve an attachment's bytes only once a moderator has approved it
add('GET', '/api/commons/attachments/:id', async ({ res, params }) => {
  const a = db.prepare(`SELECT mime, data, status FROM commons_attachments WHERE id = ?`).get(params.id);
  if (!a || a.status !== 'approved') return fail(res, 404, 'not_found', 'No such image.');
  const buf = Buffer.from(a.data, 'base64');
  res.writeHead(200, { 'content-type': a.mime, 'content-length': buf.length, 'cache-control': 'public, max-age=86400' });
  res.end(buf);
});

// ===== moderation (admin) =====
add('GET', '/api/admin/reports', async ({ res, req }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  const reports = db.prepare(`SELECT * FROM commons_reports WHERE resolved = 0 ORDER BY created_at DESC LIMIT 300`).all();
  const items = reports.map((r) => {
    const thread = db.prepare(`SELECT no, board, subject, body, removed FROM commons_threads WHERE no = ?`).get(r.post_no);
    const post = thread ? null : db.prepare(`SELECT no, thread_no, board FROM commons_posts p JOIN commons_threads t ON t.no = p.thread_no WHERE p.no = ?`).get(r.post_no);
    const postRow = thread ? null : db.prepare(`SELECT no, thread_no, body, removed FROM commons_posts WHERE no = ?`).get(r.post_no);
    const target = thread
      ? { kind: 'thread', board: thread.board, subject: thread.subject, body: thread.body, removed: !!thread.removed }
      : postRow
        ? { kind: 'post', thread_no: postRow.thread_no, board: post ? post.board : null, body: postRow.body, removed: !!postRow.removed }
        : { kind: 'gone' };
    return { id: r.id, post_no: r.post_no, reason: r.reason || null, created_at: r.created_at, target };
  });
  const openCount = db.prepare(`SELECT COUNT(*) AS c FROM commons_reports WHERE resolved = 0`).get().c;
  json(res, 200, { items, open: openCount });
});

add('POST', '/api/admin/commons/remove', async ({ res, req, body }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  const no = Number(body.no);
  const t = db.prepare(`UPDATE commons_threads SET removed = 1 WHERE no = ?`).run(no);
  const p = db.prepare(`UPDATE commons_posts SET removed = 1 WHERE no = ?`).run(no);
  db.prepare(`UPDATE commons_reports SET resolved = 1 WHERE post_no = ?`).run(no);
  json(res, 200, { ok: true, removed: t.changes + p.changes });
});

add('POST', '/api/admin/commons/restore', async ({ res, req, body }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  const no = Number(body.no);
  db.prepare(`UPDATE commons_threads SET removed = 0 WHERE no = ?`).run(no);
  db.prepare(`UPDATE commons_posts SET removed = 0 WHERE no = ?`).run(no);
  json(res, 200, { ok: true });
});

add('POST', '/api/admin/reports/:id/resolve', async ({ res, req, params }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  db.prepare(`UPDATE commons_reports SET resolved = 1 WHERE id = ?`).run(params.id);
  json(res, 200, { ok: true });
});

// image attachments awaiting review (returns the image data itself so a moderator can look)
add('GET', '/api/admin/attachments', async ({ res, req }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  const rows = db.prepare(`SELECT * FROM commons_attachments WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`).all();
  const items = rows.map((a) => {
    const t = db.prepare(`SELECT subject, body FROM commons_threads WHERE no = ?`).get(a.post_no);
    const p = t ? null : db.prepare(`SELECT body, thread_no FROM commons_posts WHERE no = ?`).get(a.post_no);
    const context = t ? { kind: 'thread', subject: t.subject, body: t.body } : p ? { kind: 'post', body: p.body, thread_no: p.thread_no } : { kind: 'gone' };
    return { id: a.id, post_no: a.post_no, board: a.board, mime: a.mime, data: a.data, created_at: a.created_at, context };
  });
  json(res, 200, { items, pending: items.length, blocklist: blocklistSize(), external_scanner: scannerConfigured() });
});

add('POST', '/api/admin/attachments/:id/approve', async ({ res, req, params }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  db.prepare(`UPDATE commons_attachments SET status = 'approved' WHERE id = ?`).run(params.id);
  json(res, 200, { ok: true });
});

add('POST', '/api/admin/attachments/:id/reject', async ({ res, req, params }) => {
  if (!isAdmin(req)) return fail(res, 401, 'unauth', 'Admin token required.');
  const a = db.prepare(`SELECT phash FROM commons_attachments WHERE id = ?`).get(params.id);
  if (a && a.phash) addToBlocklist(a.phash, 'moderator rejected');   // auto-block re-uploads of this image
  db.prepare(`UPDATE commons_attachments SET status = 'rejected', data = '' WHERE id = ?`).run(params.id);  // drop the bytes on reject
  json(res, 200, { ok: true });
});

const cleanName = (n) => { n = (n || '').trim(); return (!n || n.toLowerCase() === 'anonymous') ? null : n.slice(0, 40); };
const snippet = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 140);
const threadCatalogOut = (t) => ({ no: t.no, board: t.board, subject: t.subject, snippet: snippet(t.body), name: t.name, reply_count: t.reply_count, created_at: t.created_at, bumped_at: t.bumped_at });
const threadOut = (t) => ({ no: t.no, board: t.board, subject: t.subject, name: t.name, poster_id: t.poster_id, body: t.body, created_at: t.created_at, bumped_at: t.bumped_at, reply_count: t.reply_count, attachment: attachmentOf(t.no) });
const postOut = (p) => ({ no: p.no, thread_no: p.thread_no, name: p.name, poster_id: p.poster_id, body: p.body, created_at: p.created_at, attachment: attachmentOf(p.no) });

// ---------- static file serving ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) return fail(res, 403, 'forbidden', 'Nope.');    // no traversal
  try {
    const s = await stat(full);
    if (s.isDirectory()) return serveStatic(req, res, join(rel, 'index.html'));
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] || 'application/octet-stream', 'content-length': data.length });
    res.end(data);
  } catch {
    fail(res, 404, 'not_found', 'File not found.');
  }
}

// ---------- request pipeline ----------
async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 4e6) throw new Error('body too large'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  const match = routes.find((r) => r.method === req.method && r.rx.test(pathname));
  if (!match) return fail(res, 404, 'no_route', `No route for ${req.method} ${pathname}.`);

  try {
    const m = pathname.match(match.rx);
    const params = {};
    match.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const query = Object.fromEntries(url.searchParams);
    const body = await readBody(req);
    const user = userFrom(req);
    await match.handler({ req, res, params, query, body, user });
  } catch (e) {
    if (!res.headersSent) fail(res, 500, 'server_error', DEV ? String(e && e.message || e) : 'Something went wrong.');
  }
});

// Seed example content only in development. Production launches with an empty Commons and
// Registry so real visitors are not shown fabricated threads. Set AUGUR_SEED=1 to force-seed
// a production instance (e.g. for a demo build).
const wantSeed = DEV || process.env.AUGUR_SEED === '1';
const seeded = wantSeed ? seedCommonsIfEmpty() : { seeded: false, threads: 0 };
const seededReg = wantSeed ? seedRegistryIfEmpty() : { seeded: false, entries: 0 };
server.listen(PORT, () => {
  console.log(`Oneiratory backend + site listening on port ${PORT}  (${DEV ? 'dev' : 'production'})`);
  if (seeded.seeded) console.log(`seeded Commons with ${seeded.threads} starter threads`);
  if (seededReg.seeded) console.log(`seeded Registry with ${seededReg.entries} published seals`);
});

// Quietly give any public seal that lacks anchors both an RFC-3161 timestamp and an
// OpenTimestamps submission (e.g. the seeds). Background so startup stays fast and works offline.
setTimeout(async () => {
  const pend = db.prepare(`SELECT id, commitment_hash, tsa_token, ots_proof FROM seals WHERE is_public = 1 AND (tsa_token IS NULL OR ots_proof IS NULL)`).all();
  let rfc = 0, btc = 0;
  for (const s of pend) {
    if (!s.tsa_token) { try { const a = await anchorHash(s.commitment_hash); if (a) { db.prepare(`UPDATE seals SET tsa_token=?, tsa_name=?, anchor_time=? WHERE id=?`).run(a.tsa_token, a.tsa_name, a.anchor_time, s.id); rfc++; } } catch {} }
    if (!s.ots_proof) { try { const o = await submitOTS(s.commitment_hash); if (o) { db.prepare(`UPDATE seals SET ots_proof=?, ots_status='pending' WHERE id=?`).run(o.ots_proof, s.id); btc++; } } catch {} }
  }
  if (rfc || btc) console.log(`anchored public seals: ${rfc} via RFC-3161, ${btc} via OpenTimestamps`);
}, 600);

// Periodically fold pending OpenTimestamps proofs into Bitcoin. The calendars confirm over hours,
// so this quietly upgrades pending seals until each one carries a Bitcoin block attestation.
async function runOtsUpgrades() {
  const pend = db.prepare(`SELECT id, ots_proof FROM seals WHERE ots_status = 'pending' AND ots_proof IS NOT NULL`).all();
  let confirmed = 0;
  for (const s of pend) {
    try {
      const up = await upgradeOTS(s.ots_proof);
      if (up.changed || up.ots_status !== 'pending') {
        db.prepare(`UPDATE seals SET ots_proof = ?, ots_status = ? WHERE id = ?`).run(up.ots_proof, up.ots_status, s.id);
        if (up.ots_status === 'complete') confirmed++;
      }
    } catch { /* leave pending for the next pass */ }
  }
  if (confirmed) console.log(`OpenTimestamps: ${confirmed} seal(s) now confirmed on Bitcoin`);
}
setTimeout(runOtsUpgrades, 90 * 1000);            // catch up shortly after a restart
setInterval(runOtsUpgrades, 60 * 60 * 1000);      // then hourly (Bitcoin confirmation takes hours)
