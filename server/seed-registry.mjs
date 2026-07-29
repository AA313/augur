// Curated starter entries for the public Registry, inserted once if it is empty.
// Each carries a real SHA-256 over the shared seal payload, so every entry verifies.
import { db, uid, nowISO, canon, sha256hex } from './db.mjs';

// content is present for resolved entries (revealed); for 'sealed' ones the content stays
// hidden (only the hash is public) until a reveal, but the hash is still real.
const DATA = [
  // resolved hits
  { handle: 'oneironaut', outcome: 'hit', domain: 'public event',
    content: 'a passenger plane in trouble over water, everyone strangely calm, and it comes down safely',
    condition: 'a passenger aircraft makes an emergency landing with no fatalities, reported in national news, within 30 days' },
  { handle: 'stillhours', outcome: 'hit', domain: 'personal',
    content: 'my sister rings before dawn, her voice bright, with news I did not expect',
    condition: 'my sister calls with unexpected good news within 14 days' },
  { handle: 'nightjar', outcome: 'hit', domain: 'weather',
    content: 'the river up over the road, the old bridge gone under',
    condition: 'the town river floods over the Mill Road bridge within 21 days' },
  { handle: 'greycoat', outcome: 'hit', domain: 'personal',
    content: 'a name I had not thought of in years lights up my phone',
    condition: 'an old friend I have not spoken to in over a year contacts me first, within 30 days' },
  { handle: 'tollgate', outcome: 'hit', domain: 'public event',
    content: 'a result no one at work expected, announced in a plain email on a grey afternoon',
    condition: 'the contract goes to the smaller bidder, announced within 30 days' },
  // resolved misses (shown honestly alongside the hits)
  { handle: 'farwaters', outcome: 'miss', domain: 'personal',
    content: 'my brother in a car that rolls twice, and he steps out unhurt',
    condition: 'my brother is in a road accident and walks away unharmed, within 14 days' },
  { handle: 'lantern', outcome: 'miss', domain: 'weather',
    content: 'snow in a month that should be far too warm for it',
    condition: 'measurable snowfall in the city within 21 days' },
  // still sealed, awaiting the event (content hidden, only the hash is public)
  { handle: 'driftwood', outcome: null, domain: 'public event',
    content: 'a bridge in the city where I grew up closes, and the traffic reroutes past my old school',
    condition: 'a major bridge in my home city closes to traffic within 60 days' },
  { handle: 'vesper', outcome: null, domain: 'news',
    content: 'someone I will not name steps down, suddenly, on a quiet weekday',
    condition: 'a named public official resigns unexpectedly within 60 days' },
];

export function seedRegistryIfEmpty() {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM seals WHERE is_public = 1`).get().c;
  if (n > 0) return { seeded: false, existing: n };

  // one owner for the seed record
  let owner = db.prepare(`SELECT * FROM users WHERE email = ?`).get('record@augur.seed');
  if (!owner) {
    const oid = uid();
    db.prepare(`INSERT INTO users (id, email, created_at) VALUES (?,?,?)`).run(oid, 'record@augur.seed', nowISO());
    owner = { id: oid };
  }

  const ins = db.prepare(`INSERT INTO seals
    (id, user_id, commitment_hash, ciphertext, claim, created_at, sealed_at, ots_status, status, revealed_payload, revealed_at, is_public, handle, outcome, anchor_time)
    VALUES (?,?,?,?,?,?,?, 'pending', ?, ?, ?, 1, ?, ?, NULL)`);

  let day = Date.now() - DATA.length * 6 * 864e5;   // spread sealing over recent weeks
  for (const d of DATA) {
    const created = new Date(day).toISOString();
    const nonce = uid().slice(0, 18);
    const claim = { resolution_by: new Date(day + 30 * 864e5).toISOString().slice(0, 10), domain: d.domain, specificity: d.condition };
    const payload = { content: d.content, claim, nonce, created_at: created };
    const hash = sha256hex(canon(payload));
    const sealed = new Date(day + 3600e3).toISOString();
    const resolved = d.outcome != null;
    const status = resolved ? 'resolved' : 'sealed';
    const revealedPayload = resolved ? JSON.stringify(payload) : null;   // sealed ones keep content hidden
    const revealedAt = resolved ? new Date(day + 20 * 864e5).toISOString() : null;
    const cipher = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');  // prototype: not yet encrypted
    ins.run(uid(), owner.id, hash, cipher, JSON.stringify(claim), created, sealed, status, revealedPayload, revealedAt, d.handle, d.outcome);
    day += 6 * 864e5;
  }
  return { seeded: true, entries: DATA.length };
}
