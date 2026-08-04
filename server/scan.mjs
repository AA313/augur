// Image safety scanning for the Commons.
//
// TWO LAYERS, and an honest boundary between them:
//
//  1. Local perceptual-hash blocklist (built in, zero-dep). When a moderator rejects an image we
//     remember its dHash; future uploads whose dHash is close (Hamming distance) are auto-blocked.
//     This ONLY blocks re-uploads of content already removed on this instance. It is NOT a CSAM
//     detector and has no access to any known-CSAM database.
//
//  2. An external scanner hook (off unless configured). Set AUGUR_SCAN_URL (and optionally
//     AUGUR_SCAN_KEY) to a real service — Microsoft PhotoDNA, Cloudflare's CSAM tool, Thorn Safer,
//     etc. Those match against NCMEC's known-CSAM hashes and, in the US, come with a legal duty to
//     report matches. AUGUR cannot and must not do that matching itself; this is only the plug.
//
// If nothing blocks an image it still goes to the pre-moderation queue (a human approves it before
// it ever shows). So every layer degrades safely.
import https from 'node:https';
import http from 'node:http';
import { db, uid, nowISO } from './db.mjs';

// Hamming distance between two equal-length hex strings (our dHash is 16 hex chars / 64 bits).
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 999;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf;
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
const MATCH_THRESHOLD = 10;   // <= this many differing bits counts as "the same image"

export function blocklistHit(phash) {
  if (!phash) return false;
  const rows = db.prepare(`SELECT phash FROM image_blocklist`).all();
  return rows.some((r) => hamming(phash, r.phash) <= MATCH_THRESHOLD);
}
export function addToBlocklist(phash, reason) {
  if (!phash) return;
  db.prepare(`INSERT INTO image_blocklist (id, phash, reason, created_at) VALUES (?,?,?,?)`)
    .run(uid(), phash, reason || 'moderator rejected', nowISO());
}
export const blocklistSize = () => db.prepare(`SELECT COUNT(*) AS c FROM image_blocklist`).get().c;

// ---- external provider hook (generic HTTP adapter) ----
const SCAN_URL = process.env.AUGUR_SCAN_URL || null;
const SCAN_KEY = process.env.AUGUR_SCAN_KEY || null;
export const scannerConfigured = () => !!SCAN_URL;

function postJSON(url, body, key, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const lib = u.protocol === 'https:' ? https : http;
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) };
    if (key) headers['authorization'] = 'Bearer ' + key;
    const req = lib.request(u, { method: 'POST', timeout: timeoutMs, headers }, (r) => {
      const c = []; r.on('data', (x) => c.push(x)); r.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// Adapter contract: POST { mime, data } -> expects { match: true|false }. Adjust to your provider.
export async function externalScan(img) {
  if (!SCAN_URL) return { configured: false, match: false };
  try {
    const res = await postJSON(SCAN_URL, JSON.stringify({ mime: img.mime, data: img.data }), SCAN_KEY, 8000);
    return { configured: true, match: !!(res && res.match) };
  } catch {
    // Scanner unreachable: allow through to human pre-moderation rather than block all uploads.
    return { configured: true, error: true, match: false };
  }
}

// The single entry point the upload path calls. Returns { action: 'allow' | 'block', reason }.
export async function scanImage(img) {
  if (blocklistHit(img.phash)) return { action: 'block', reason: 'matches a previously-removed image' };
  const ext = await externalScan(img);
  if (ext.match) return { action: 'block', reason: 'flagged by the configured content scanner' };
  return { action: 'allow' };
}
