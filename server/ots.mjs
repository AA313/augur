// Bitcoin anchoring via OpenTimestamps (zero dependency).
// On seal we submit the hash to public OTS calendar servers, which return the operations that
// commit it toward a Bitcoin transaction. We frame those into a standard, valid `.ots` proof.
// (The intricate merkle/attestation bytes come verbatim from the calendars; we only add the
// header + version + file-hash op + digest, and fork multiple calendars together.)
//
// The result is a REAL pending OpenTimestamps proof: over the next hours the calendars fold the
// commitment into a Bitcoin block, after which anyone can upgrade + verify it with the `ots` tool
// or ots.tools, entirely independent of AUGUR. Verified correct against the `opentimestamps`
// library during development.
import https from 'node:https';
import { createHash } from 'node:crypto';

const OTS_HEADER = Buffer.concat([
  Buffer.from([0x00]), Buffer.from('OpenTimestamps'), Buffer.from([0x00, 0x00]),
  Buffer.from('Proof'), Buffer.from([0x00]), Buffer.from('bf89e2e884e89294', 'hex'),
]);
const CALENDARS = ['https://a.pool.opentimestamps.org', 'https://b.pool.opentimestamps.org'];

function post(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, { method: 'POST', timeout: timeoutMs, headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/vnd.opentimestamps.v1', 'content-length': body.length } }, (r) => {
      const c = []; r.on('data', (x) => c.push(x)); r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(c) }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// Submit a hex SHA-256 to the OTS calendars and return a base64 pending `.ots`, or null on failure.
export async function submitOTS(hashHex) {
  const digest = Buffer.from(hashHex, 'hex');
  if (digest.length !== 32) return null;
  const responses = [];
  for (const cal of CALENDARS) {
    try {
      const r = await post(cal + '/digest', digest, 8000);
      if (r.status === 200 && r.body.length) responses.push(r.body);
    } catch { /* skip this calendar */ }
  }
  if (!responses.length) return null;
  // timestamp tree at the digest: fork (0xff) before every branch except the last
  let tree = Buffer.alloc(0);
  for (let i = 0; i < responses.length; i++) {
    tree = i < responses.length - 1
      ? Buffer.concat([tree, Buffer.from([0xff]), responses[i]])
      : Buffer.concat([tree, responses[i]]);
  }
  // header + version(1) + sha256 file-hash op(0x08) + digest + tree
  const ots = Buffer.concat([OTS_HEADER, Buffer.from([0x01, 0x08]), digest, tree]);
  return { ots_proof: ots.toString('base64'), ots_status: 'pending', calendars: CALENDARS.length };
}

// ===========================================================================================
// Upgrade: turn a pending .ots into a Bitcoin-attested one, once the calendars have folded the
// commitment into a block. This means parsing the proof's operation tree, computing each
// calendar's commitment by executing the ops, re-querying the calendar, and grafting in the
// upgraded branch. Full .ots (de)serialization, zero-dep, validated against the opentimestamps lib.
// ===========================================================================================
const PENDING_TAG = Buffer.from('83dfe30d2ef90c8e', 'hex');
const BITCOIN_TAG = Buffer.from('0588960d73d71901', 'hex');

// OpenTimestamps varuint: little-endian base-128, high bit = continuation.
function readVaruint(cur) {
  let value = 0, shift = 1, b;
  do { b = cur.buf[cur.i++]; value += (b & 0x7f) * shift; shift *= 128; } while (b & 0x80);
  return value;
}
function writeVaruint(n) {
  const out = [];
  do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 0x80; out.push(b); } while (n > 0);
  return Buffer.from(out);
}
function applyOp(op, operand, msg) {
  if (op === 0xf0) return Buffer.concat([msg, operand]);           // append
  if (op === 0xf1) return Buffer.concat([operand, msg]);           // prepend
  if (op === 0x08) return createHash('sha256').update(msg).digest();
  if (op === 0x02) return createHash('sha1').update(msg).digest();
  if (op === 0x03) return createHash('ripemd160').update(msg).digest();
  throw new Error('unsupported OTS op 0x' + op.toString(16));
}

// A Timestamp node: { msg, attestations:[{tag,payload}], ops:[{op,operand,child}] }
function deserializeTs(cur, msg) {
  const node = { msg, attestations: [], ops: [] };
  let tag = cur.buf[cur.i++];
  while (tag === 0xff) { step(cur, node, cur.buf[cur.i++]); tag = cur.buf[cur.i++]; }
  step(cur, node, tag);
  return node;
}
function step(cur, node, tag) {
  if (tag === 0x00) {                                              // attestation
    const atag = cur.buf.subarray(cur.i, cur.i + 8); cur.i += 8;
    const len = readVaruint(cur);
    const payload = cur.buf.subarray(cur.i, cur.i + len); cur.i += len;
    node.attestations.push({ tag: Buffer.from(atag), payload: Buffer.from(payload) });
  } else {                                                         // operation
    let operand = null;
    if (tag === 0xf0 || tag === 0xf1) { const len = readVaruint(cur); operand = Buffer.from(cur.buf.subarray(cur.i, cur.i + len)); cur.i += len; }
    const result = applyOp(tag, operand, node.msg);
    const child = deserializeTs(cur, result);
    node.ops.push({ op: tag, operand, child });
  }
}
function serializeTs(node) {
  const parts = [];
  const total = node.attestations.length + node.ops.length;
  let idx = 0;
  for (const att of node.attestations) {
    if (++idx < total) parts.push(Buffer.from([0xff]));
    parts.push(Buffer.from([0x00]), att.tag, writeVaruint(att.payload.length), att.payload);
  }
  for (const e of node.ops) {
    if (++idx < total) parts.push(Buffer.from([0xff]));
    parts.push(Buffer.from([e.op]));
    if (e.op === 0xf0 || e.op === 0xf1) parts.push(writeVaruint(e.operand.length), e.operand);
    parts.push(serializeTs(e.child));
  }
  return Buffer.concat(parts);
}
function deserializeOTS(bytes) {
  const cur = { buf: bytes, i: OTS_HEADER.length };
  readVaruint(cur);                                               // major version (1)
  const fileOp = cur.buf[cur.i++];                                // 0x08 sha256
  const dlen = fileOp === 0x03 ? 20 : 32;
  const digest = Buffer.from(cur.buf.subarray(cur.i, cur.i + dlen)); cur.i += dlen;
  return { digest, fileOp, root: deserializeTs(cur, digest) };
}
function serializeOTS(digest, fileOp, root) {
  return Buffer.concat([OTS_HEADER, Buffer.from([0x01, fileOp]), digest, serializeTs(root)]);
}
function findAttestations(node, tag, out) {
  for (const att of node.attestations) if (att.tag.equals(tag)) out.push({ node, payload: att.payload });
  for (const e of node.ops) findAttestations(e.child, tag, out);
  return out;
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, { method: 'GET', timeout: timeoutMs, headers: { accept: 'application/vnd.opentimestamps.v1' } }, (r) => {
      const c = []; r.on('data', (x) => c.push(x)); r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(c) }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// Try to upgrade a pending base64 .ots. Returns { ots_proof, ots_status, block, changed }.
// Non-fatal: on any failure it returns the input unchanged, still pending.
export async function upgradeOTS(otsB64) {
  let parsed;
  try { parsed = deserializeOTS(Buffer.from(otsB64, 'base64')); } catch { return { ots_proof: otsB64, ots_status: 'pending', block: null, changed: false }; }
  const { digest, fileOp, root } = parsed;

  const pend = findAttestations(root, PENDING_TAG, []);
  let changed = false;
  for (const p of pend) {
    try {
      const c = { buf: p.payload, i: 0 };
      const ulen = readVaruint(c);
      const uri = p.payload.subarray(c.i, c.i + ulen).toString('utf8');
      const commitment = p.node.msg.toString('hex');
      const r = await httpGet(uri.replace(/\/$/, '') + '/timestamp/' + commitment, 8000);
      if (r.status === 200 && r.body.length) {
        const up = deserializeTs({ buf: r.body, i: 0 }, p.node.msg);  // continues from the same commitment
        p.node.attestations = up.attestations;                        // replace the pending with the upgraded path
        p.node.ops = up.ops;
        changed = true;
      }
      // 404 = the calendar has not folded it into Bitcoin yet; leave pending
    } catch { /* try the next pending attestation */ }
  }

  const btc = findAttestations(root, BITCOIN_TAG, []);
  const block = btc.length ? readVaruint({ buf: btc[0].payload, i: 0 }) : null;
  return {
    ots_proof: changed ? serializeOTS(digest, fileOp, root).toString('base64') : otsB64,
    ots_status: block != null ? 'complete' : 'pending',
    block, changed,
  };
}

// The Bitcoin block height a proof is confirmed in, or null if still pending / unparseable.
export function otsBlock(otsB64) {
  try {
    const { root } = deserializeOTS(Buffer.from(otsB64, 'base64'));
    const btc = findAttestations(root, BITCOIN_TAG, []);
    return btc.length ? readVaruint({ buf: btc[0].payload, i: 0 }) : null;
  } catch { return null; }
}

// exported for the validation harness
export const _internals = { deserializeOTS, serializeOTS, findAttestations, PENDING_TAG, BITCOIN_TAG, readVaruint };
