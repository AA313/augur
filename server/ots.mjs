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
