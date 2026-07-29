// Real timestamp anchoring via RFC-3161 (a public Time-Stamping Authority).
// Zero dependencies: hand-rolled DER for the request, a minimal ASN.1 reader for the reply.
// The TSA cryptographically signs "this hash existed at time T"; the token is verifiable
// independently of AUGUR with `openssl ts -verify` (or any RFC-3161 tool).
import http from 'node:http';
import https from 'node:https';

// ---- DER encoding (request) ----
function derLen(n) { if (n < 128) return Buffer.from([n]); const b = []; let x = n; while (x > 0) { b.unshift(x & 0xff); x >>= 8; } return Buffer.from([0x80 | b.length, ...b]); }
function tlv(tag, val) { return Buffer.concat([Buffer.from([tag]), derLen(val.length), val]); }
function seq(...parts) { return tlv(0x30, Buffer.concat(parts)); }
const OID_SHA256 = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const ASN_NULL = Buffer.from([0x05, 0x00]);

// TimeStampReq { version=1, messageImprint{ sha256, digest }, certReq=TRUE }
function buildTSQ(digest) {
  return seq(Buffer.from([0x02, 0x01, 0x01]), seq(seq(OID_SHA256, ASN_NULL), tlv(0x04, digest)), Buffer.from([0x01, 0x01, 0xff]));
}

// ---- minimal ASN.1 reader (reply) ----
function readTLV(buf, off) {
  const tag = buf[off]; let p = off + 1; let l = buf[p++];
  if (l & 0x80) { let n = l & 0x7f; l = 0; while (n--) l = (l << 8) | buf[p++]; }
  return { tag, len: l, start: off, cs: p, ce: p + l };
}
function kids(buf, t) { const o = []; let p = t.cs; while (p < t.ce) { const c = readTLV(buf, p); o.push(c); p = c.ce; } return o; }
function gtToISO(s) { const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null; }

// id-ct-TSTInfo, the OID that precedes the signed TSTInfo inside the token
const OID_TSTINFO = Buffer.from([0x06, 0x0b, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x01, 0x04]);

function parseResp(resp, digest) {
  const R = readTLV(resp, 0); const rc = kids(resp, R);
  const si = kids(resp, rc[0]); const status = resp[si[0].ce - 1];        // PKIStatus: 0 = granted
  if (status !== 0 || rc.length < 2) return null;
  const token = resp.slice(rc[1].start, rc[1].ce);
  const i = token.indexOf(OID_TSTINFO);
  if (i < 0) return null;
  const a0 = readTLV(token, i + OID_TSTINFO.length);   // [0] EXPLICIT
  const oct = readTLV(token, a0.cs);                    // OCTET STRING wrapping TSTInfo
  const tst = token.slice(oct.cs, oct.ce);
  const T = readTLV(tst, 0); const tc = kids(tst, T);
  const mi = kids(tst, tc[2]);                          // messageImprint
  const hashed = tst.slice(mi[1].cs, mi[1].ce);         // hashedMessage
  const genTime = gtToISO(tst.slice(tc[4].cs, tc[4].ce).toString());
  return { token, genTime, verified: hashed.equals(digest) };
}

function post(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: 'POST', timeout: timeoutMs, headers: { 'content-type': 'application/timestamp-query', 'content-length': body.length } }, (r) => {
      const c = []; r.on('data', (x) => c.push(x)); r.on('end', () => resolve(Buffer.concat(c)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

const TSAS = [
  { name: 'DigiCert', url: 'http://timestamp.digicert.com' },
  { name: 'freeTSA', url: 'https://freetsa.org/tsr' },
];

// Anchor a hex SHA-256. Returns { tsa_name, tsa_token(base64), anchor_time } or null if no TSA
// could be reached / verified. Non-fatal by contract: callers keep the seal even if this is null.
export async function anchorHash(hashHex) {
  const digest = Buffer.from(hashHex, 'hex');
  if (digest.length !== 32) return null;
  const tsq = buildTSQ(digest);
  for (const tsa of TSAS) {
    try {
      const resp = await post(tsa.url, tsq, 8000);
      const parsed = parseResp(resp, digest);
      if (parsed && parsed.verified && parsed.genTime) {
        return { tsa_name: tsa.name, tsa_token: parsed.token.toString('base64'), anchor_time: parsed.genTime };
      }
    } catch { /* try the next TSA */ }
  }
  return null;
}

// Verify a stored token really commits to the given hash, and return its genTime.
// (Confirms the messageImprint; full signature-chain verification is left to openssl / tools.)
export function inspectToken(tokenB64, hashHex) {
  try {
    const token = Buffer.from(tokenB64, 'base64');
    const digest = Buffer.from(hashHex, 'hex');
    const i = token.indexOf(OID_TSTINFO);
    if (i < 0) return null;
    const a0 = readTLV(token, i + OID_TSTINFO.length);
    const oct = readTLV(token, a0.cs);
    const tst = token.slice(oct.cs, oct.ce);
    const T = readTLV(tst, 0); const tc = kids(tst, T);
    const mi = kids(tst, tc[2]);
    const hashed = tst.slice(mi[1].cs, mi[1].ce);
    return { genTime: gtToISO(tst.slice(tc[4].cs, tc[4].ce).toString()), imprint_matches: hashed.equals(digest) };
  } catch { return null; }
}
