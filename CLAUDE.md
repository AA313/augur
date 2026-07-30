# AUGUR

A registry for dreams and the rare moments they seem to arrive early. AUGUR lets a person
record a dream, "seal" it so its exact wording is cryptographically fixed to a point in time,
and later prove the dream was written before the event it seemed to foretell. It also has a
private journal (the Vault), a public ledger of resolved predictions (the Registry), and an
anonymous discussion board (the Commons).

## Ethos (do not drift from this)
- **An instrument, not an oracle.** AUGUR takes no position on whether dreams predict anything.
  A seal proves only *anteriority* (text existed, unchanged, before a time). Never overclaim.
- **Honesty over hype.** The Registry shows misses next to hits. Keep it that way.
- **Two speeds, kept separate.** The Registry is rigorous and verifiable; the Commons is loose
  and social. Never let the Commons' vibes dilute the Registry's credibility.
- **Trust and anonymity are the product.** Never sell or leak dream data. Research use is
  consented and anonymised only (see terms.html #research). Private Vault entries are never
  used without explicit opt-in.
- **Child safety / moderation.** The Commons is anonymous, not lawless. Any real backend needs
  moderation and the ability to remove content.
- **Copy style:** no em dashes anywhere in user-facing text.

## Current state
Front end + a real backend now exist. The cryptographic seal is REAL (Web Crypto SHA-256 +
nonce + commit-reveal).

- **Backend (new):** a zero-dependency Node service in `server/` (node:http + node:sqlite),
  implementing the persistence foundation of `augur-api-spec.md` (auth, vault, seals, proofs,
  registry, commons). It serves the static site and `/api` from one origin. Data persists in a
  local SQLite file (`data/augur.db`) across restarts. Verified end-to-end (24/24 smoke checks).
- **Front end wiring:** the Commons, Vault, Seal, and Registry pages are now wired to the API and
  persist server-side (Commons is no-signup; Vault and Seal require the dev magic-link sign-in;
  session token in localStorage, shared across pages). The homepage "record so far" strip pulls
  live Registry stats (with a static fallback). Still in-memory/static: the standalone Verifier
  (deliberately independent), About, and Terms. Full loop works: seal -> reveal -> publish ->
  resolve -> appears in the Registry -> stats update on the Registry footer and the homepage.
- **Timestamp anchor: now REAL (RFC-3161).** `server/anchor.mjs` (zero-dep: hand-rolled DER +
  a minimal ASN.1 reader) requests a signed timestamp from a public TSA (DigiCert, freeTSA
  fallback) over the commitment hash on seal, verifies the token's messageImprint, and stores
  `tsa_token` + `tsa_name` + `anchor_time`. Verified with `openssl ts -reply` (a real DigiCert
  token). Shown on the Seal proof card, Your Seals, and the Registry ("timestamp-anchored"); the
  token is included in the downloadable proof bundle. The **standalone Verifier now validates the
  anchor in-browser** (ports the same DER/ASN.1 reader): given a bundle it parses the token,
  confirms its messageImprint equals the recomputed hash, and shows the genTime + TSA, all offline
  and independent of AUGUR (full signature-chain check is left to `openssl ts -verify`).
- **Bitcoin anchor: now REAL too (OpenTimestamps), also zero-dep.** `server/ots.mjs` submits the
  hash to public OTS calendars on seal and frames their responses into a valid `.ots` proof
  (validated against the `opentimestamps` library during dev; the lib was a scratchpad-only check,
  the project still ships zero deps). Stored as `ots_proof` + `ots_status='pending'`, runs in
  parallel with RFC-3161. Bitcoin confirmation takes hours; the `.ots` is included in the
  downloadable bundle and upgraded/verified with the `ots` tool or ots.tools, independent of AUGUR.
  Shown on the Seal proof card ("bitcoin: submitted…pending"), Your Seals ("bitcoin pending"), and
  noted by the Verifier. Both anchors also backfill onto the seed Registry entries in the
  background at startup.
- **Automatic OTS upgrade: DONE.** `server/ots.mjs` now also deserialises the `.ots` proof tree,
  executes its ops to compute each calendar commitment, re-queries the calendars
  (`GET /timestamp/<commitment>`), grafts in the Bitcoin attestation, and re-serialises. Runs via
  a background job (~90s after start, then hourly) and an owner endpoint `POST /api/seals/:id/upgrade`
  ("check bitcoin" button on pending seals). Validated against the `opentimestamps` library: byte
  round-trip, commitments match exactly, and it reads real Bitcoin blocks (hello-world.txt.ots ->
  block 358391). Confirmed seals show `ots_status='complete'` + `ots_block`, surfaced as "bitcoin
  confirmed (block N)". Note: real Bitcoin confirmation still takes hours, so fresh stamps stay
  pending in-session; the complete path is proven via the library's confirmed example proofs. Disclaimers across
  the pages were updated from "simulated" to reflect the real RFC-3161 anchor.

## Running locally
`npm start` (or `node server/server.mjs`) serves site + API on http://127.0.0.1:8787. No install
step, no dependencies (needs Node >= 22.5 for `node:sqlite`). `data/` and `server/server.log`
are local state: do not snapshot or deploy them.

## File map
- `index.html` ............ landing page (front door)
- `augur-vault.html` ...... private capture journal (voice-to-text, tags, motif detection)
- `augur-seal-prototype.html` seal flow: compose -> seal -> reveal -> verify, exports a proof bundle
- `augur-verifier.html` ... standalone offline verifier (recomputes the hash locally)
- `augur-registry.html` ... public ledger of resolved predictions + leaderboard + voting
- `augur-commons.html` .... anonymous imageboard (boards, threads, greentext, quote-links, IDs)
- `terms.html` ........... Terms, Privacy, Copyright, and Research & scholarly use
- `augur-admin.html` ..... moderator page (not in nav): admin-token gate, reports queue, remove/restore
- `augur-theme.css` ...... the bright-blue theme (mirror of the inline theme in each page)
- `augur-footer.js` ...... shared site footer injector
- `server/server.mjs` .... zero-dep Node backend (node:http + node:sqlite); serves site + /api
- `server/db.mjs` ........ SQLite data layer + shared helpers (canon, poster ids, counters)
- `server/schema.sql` .... the data model (maps 1:1 to augur-api-spec.md)
- `data/augur.db` ........ local SQLite store (runtime state; never snapshot/deploy)
- `package.json` ......... `npm start` runs the backend on :8787

## Conventions
- Vanilla HTML/CSS/JS. No framework, no build step. Fonts: Cormorant Garamond (display),
  Hanken Grotesk (UI), Space Mono (data). 
- Each page currently INLINES the theme in a `<style id="augur-theme">` block and inlines the
  footer script, so single-file previews render. `augur-theme.css` / `augur-footer.js` are
  kept in sync for when the site is hosted and can switch to shared linked files.
- All colors live in the `:root` variables at the top of each page's `<style id="augur-theme">` block. The site uses two registers: **dreamcore** (bright lilac/sky pastels) for the loose half (Home, Vault, Commons, Seal) and **Gen X Soft Club** (cool frosted iMac-blue) for the evidentiary half (Registry, Verifier, Terms). Fonts: Quicksand (display), Inter (body), IBM Plex Mono (data).

## The seal mechanic (shared, must stay identical across pages)
The commitment is `SHA-256(canonical(payload))` where
`payload = { content, claim:{resolution_by,domain,specificity}, nonce, created_at }` and
`canonical()` is deterministic JSON with recursively sorted keys.
The seal page, the verifier, and the registry all reuse this exact logic, so a proof bundle
sealed on one page verifies on another. Do not change the payload shape or canonicalisation
without updating every page together.

## Moderation (roadmap item 4: DONE, MVP)
- **Rate limiting** (in-memory, per client IP, sliding window) on Commons thread/post creation
  (6/10 per min), Registry votes (30/min), reports (12/min), and auth requests (6/min) -> 429.
- **Reporting:** a "report" link on every Commons post opens an inline reason box ->
  `POST /api/commons/posts/:no/report`.
- **Admin:** token-gated (`x-augur-admin` header == `AUGUR_ADMIN_TOKEN`, default `augur-admin-dev`
  for local; SET IT IN PRODUCTION). Endpoints: `GET /api/admin/reports` (queue + reported content),
  `POST /api/admin/commons/remove|restore` (soft hide via `removed` flag; existing queries already
  filter `removed=0`), `POST /api/admin/reports/:id/resolve`. UI is `augur-admin.html`.
- Deferred: IP/subnet bans (the anonymity model deliberately does not store raw IPs, so effective
  banning needs a stored salted client hash - a privacy tradeoff to decide later).

## Roadmap (make it real)
1. **Persistence + backend.** A real datastore for Vault entries, Registry entries, and Commons
   posts. Suggested: Cloudflare Pages/Workers + D1, or Supabase (Postgres). Keep the front end
   mostly as-is; replace in-memory arrays with API calls.
2. **Real timestamp anchor.** Replace the simulated anchor with OpenTimestamps (Bitcoin) plus an
   RFC 3161 instant token, operating on the hash the front end already produces. Keep the
   standalone verifier able to check proofs offline.
3. **Anonymity + auth.** Private Vault needs per-user storage (with client-side encryption as the
   Phase 2 goal). Commons stays no-signup anonymous with per-thread IDs.
4. **Moderation** for the Commons (reporting, removal, rate limits).
5. **Deploy.** Domain + host. Keep hosting cheap; static + light backend fits generous free tiers.

## Guardrails for future work
- Never weaken the "instrument not oracle" framing.
- Never introduce ads or data sales.
- Keep the verifier independent of the main servers (it must work even if AUGUR is down).

## Design Context
Strategic and visual design context for this project lives in two root files, generated by
the impeccable design skill. Read them before UI work.
- `PRODUCT.md` .... register (brand), platform (web), users, positioning, brand personality,
  anti-references, and design principles. The strategic "who/what/why".
- `DESIGN.md` ..... the visual system as tokens + prose. North Star "The Small-Hours Observatory":
  a faded old-web instrument (dusk-lavender paper, 1px square borders, Verdana/Georgia/Courier,
  no gradients/glass) in two registers by purpose: the serious Instrument (homepage, Registry,
  Verifier, Vault, About) and the anonymous Commons board. Sidecar: `.impeccable/design.json`.

Migration note (2026-07-16): the earlier dreamcore/Soft Club theme was retired for looking
AI-generated. `index.html` and `about.html` are already on the new faded-forum system; the
functional pages (augur-seal-prototype, augur-verifier, augur-commons, augur-registry,
augur-vault) still need re-skinning to it while preserving their real crypto/board JS. The
old versions are archived in `_archive-dreamcore/`, and static look-references are the
`_dir-*.html` files.
