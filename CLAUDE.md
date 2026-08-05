# Oneiratory

> **Naming (2026-08-04):** the project and site were renamed from the prototype name **AUGUR** to
> **Oneiratory** (chosen for uniqueness; several sites already use "Augur", incl. the Ethereum
> prediction market). The change is **user-facing only**. Internal identifiers deliberately keep the
> `augur` token so the backend does not break: the stylesheet (`augur.css`), the env vars
> (`AUGUR_ADMIN_TOKEN`, `AUGUR_SECRET`, `AUGUR_SCAN_URL`, `AUGUR_SCAN_KEY`), the localStorage keys
> (`augur_session` / `augur_admin`), and the SQLite store all stay as-is. **The page files WERE
> renamed on 2026-08-05** so the URLs read cleanly: `augur-registry.html`->`registry.html`,
> `augur-commons.html`->`commons.html`, `augur-vault.html`->`vault.html`,
> `augur-verifier.html`->`verify.html`, `augur-seal-prototype.html`->`seal.html`,
> `augur-admin.html`->`admin.html`. Contact email is `contact@oneiratory.com`. Where prose below
> still says "AUGUR", read "Oneiratory"; where it names an `AUGUR_*` env var, that is a literal
> identifier and must not change.

A registry for dreams and the rare moments they seem to arrive early. Oneiratory lets a person
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
- `vault.html` ...... private capture journal (voice-to-text, tags, motif detection)
- `seal.html` seal flow: compose -> seal -> reveal -> verify, exports a proof bundle
- `verify.html` ... standalone offline verifier (recomputes the hash locally)
- `registry.html` ... public ledger of resolved predictions + leaderboard + voting
- `commons.html` .... anonymous imageboard (boards, threads, greentext, quote-links, IDs)
- `terms.html` ........... Terms, Privacy, Copyright, and Research & scholarly use
- `support.html` ......... "Support AUGUR" donation page (linked from every public footer). Honest, no-obligation founder note; the "Donate to AUGUR" button href is a placeholder pending a real payment provider (see the TODO comment in the file).
- `admin.html` ..... moderator page (not in nav): admin-token gate, reports queue, remove/restore
- `augur.css` ............ THE shared design system (tokens, starfield body, full-width header/nav, container, buttons, panel/caption chrome, footer, epigraph). Every page links it; see DESIGN.md.
- `augur-theme.css` ...... LEGACY, no longer linked (the retired bright-blue Commons theme). Superseded by `augur.css`.
- `augur-footer.js` ...... LEGACY, no longer used (footer is now markup + `.site-footer` in `augur.css`).
- `server/server.mjs` .... zero-dep Node backend (node:http + node:sqlite); serves site + /api
- `server/db.mjs` ........ SQLite data layer + shared helpers (canon, poster ids, counters)
- `server/schema.sql` .... the data model (maps 1:1 to augur-api-spec.md)
- `data/augur.db` ........ local SQLite store (runtime state; never snapshot/deploy)
- `package.json` ......... `npm start` runs the backend on :8787

## Conventions
- Vanilla HTML/CSS/JS. No framework, no build step.
- **One shared stylesheet: `augur.css`.** Every page links it (`<link rel="stylesheet" href="augur.css">`)
  and it owns the design system: the `:root` tokens, the starfield body, the full-width sticky
  `.site-header` + `.site-nav`, the `main` container, `.btn`/`.btn-primary`/`.btn-ghost`, the generic
  `section`/`.cap`/`.in` panel chrome, `.intro`, `.epigraph`, and `.site-footer`. Page-specific styles
  layer inline in each page's own `<style>` block. Change the system in ONE place; do not fork tokens
  back into pages.
- Fonts: **Georgia** (headings, wordmark, wonder), the **system-sans stack** (body/UI, retiring the old
  Verdana), **monospace stack** (exact values, board furniture). One restrained **terracotta** accent
  (`--warm` #bb6647) for primary actions; structural colour is violet/indigo. Softly-rounded 9px panels,
  flat, no glow. Full palette + rules are in DESIGN.md ("The Small-Hours Observatory", evolved).

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
  filter `removed=0`), `POST /api/admin/reports/:id/resolve`. UI is `admin.html`.
- **Image attachments (pre-moderated):** posts/replies can carry one image. The browser re-encodes
  it through a `<canvas>` first (strips ALL EXIF/GPS metadata, caps to 1200px, JPEG q0.82), so no
  location leaks and no huge files. Stored `pending` in `commons_attachments`; **never shown on the
  board until a moderator approves it** (`GET /api/admin/attachments` queue + approve/reject in
  `admin.html`). `GET /api/commons/attachments/:id` serves bytes only when approved; pending
  posts show an "awaiting review" placeholder.
- **Image safety scanning (`server/scan.mjs`):** two layers before pre-moderation. (1) A local
  perceptual-hash blocklist: the client computes a 64-bit dHash; when a moderator REJECTS an image
  its dHash is remembered (`image_blocklist`), and future uploads within Hamming distance 10 are
  auto-blocked (blocks re-uploads of removed content only - NOT a CSAM database). (2) A pluggable
  external scanner hook: if `AUGUR_SCAN_URL` (+ optional `AUGUR_SCAN_KEY`) is set, each upload is
  POSTed `{mime,data}` and blocked on `{match:true}` - this is where you wire a REAL CSAM service
  (Microsoft PhotoDNA / Cloudflare CSAM tool / Thorn Safer), which matches NCMEC's known-CSAM DB
  and carries a legal duty to report. AUGUR cannot detect CSAM itself; the hook is the integration
  point. Off by default (no-op). Admin page shows blocklist size + scanner on/off. See DEPLOY.md.
- Deferred: IP/subnet bans (the anonymity model deliberately does not store raw IPs, so effective
  banning needs a stored salted client hash - a privacy tradeoff to decide later); an actual
  contracted CSAM provider behind the hook (needs your account + their vetting).

## Roadmap (make it real)
1. **Persistence + backend.** A real datastore for Vault entries, Registry entries, and Commons
   posts. Suggested: Cloudflare Pages/Workers + D1, or Supabase (Postgres). Keep the front end
   mostly as-is; replace in-memory arrays with API calls.
2. **Real timestamp anchor.** Replace the simulated anchor with OpenTimestamps (Bitcoin) plus an
   RFC 3161 instant token, operating on the hash the front end already produces. Keep the
   standalone verifier able to check proofs offline.
3. **Anonymity + auth.** DONE for the Vault: per-user storage + **end-to-end encryption**. The
   Vault now derives an AES-GCM key from a passphrase via PBKDF2 (200k iters) in the browser;
   the server stores only ciphertext (`vault_versions.ciphertext`) + a per-user `kdf_salt` and a
   `kdf_check` (to verify the passphrase on unlock). The SHA-256 is still over the plaintext, so
   anteriority holds. Set-once passphrase; forgetting it = unrecoverable (by design). Commons stays
   no-signup anonymous. Still prototype: the email sign-in returns the token directly (no real
   email); real emailed magic links are the remaining auth piece.
4. **Moderation** for the Commons: DONE (MVP) - see the Moderation section above.
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

Migration note (2026-08-02): the faded "Small-Hours Observatory" look was **evolved into one
unified system** to shed the last "2010 web" tells (retired Verdana + the boxed centered nav +
the Windows-9x bevel; added a full-width sticky indigo header, softly-rounded panels, a terracotta
primary accent, and a fluid type ramp), and **extracted into the shared `augur.css`**. ALL pages
now link it and share one identity: index, about, terms, augur-registry, augur-verifier,
augur-seal-prototype, augur-vault, augur-commons, and augur-admin. The Commons was brought into the
same system (shared header/type/tokens/containers/footer) while keeping its board character
(slash masthead, `/slug/` heads, sage greentext, colour-hashed anon IDs, per-board tints). Two
impeccable "absolute ban" side-stripes were removed in the process (the About pull-quote and the
Commons/Vault version markers). All real crypto/board/E2E JS was preserved verbatim and re-verified
end-to-end after the reskin. Earlier history: the pre-evolution faded pages, and before them the
retired dreamcore/Soft Club theme (archived in `_archive-dreamcore/`, static refs `_dir-*.html`).
