# Oneiratory — API & Data Model

A target for the backend, mapped directly to the front end already built. REST, JSON over
HTTPS. Pick the stack later (Cloudflare Workers + D1, or Supabase/Postgres both fit); the
shapes below are stack-agnostic.

---

## Conventions

- Base path: `/api`. All bodies and responses are JSON.
- Auth: `Authorization: Bearer <token>` for user-scoped routes. The Commons needs no auth.
  Access levels below are one of: **public**, **user** (signed in), **owner** (owns the
  resource), **admin**.
- Errors: `{ "error": { "code": "string", "message": "string" } }` with a matching HTTP status.
- Pagination: cursor based. Requests take `?cursor=&limit=`; list responses return
  `{ "items": [...], "next_cursor": "..." | null }`.
- Timestamps are ISO-8601 UTC strings. IDs are opaque strings unless noted.

---

## The seal contract (must not drift)

The commitment is `SHA-256(canonical(payload))` where

```
payload = { content, claim: { resolution_by, domain, specificity }, nonce, created_at }
canonical(x) = deterministic JSON, keys sorted recursively, no whitespace
```

The seal page, the verifier, and the registry all reuse this exact logic. The backend stores
proofs and anchors but never needs to change the payload shape. A revealed proof returned by
the API must match the verifier's expected bundle exactly (see `GET /api/proofs/:id`).

---

## Data model

**users** — owners of private data. Anonymous Commons use creates no user.
`id, email, created_at, research_opt_in (bool, default false)`

**vault_entries** — private journal.
`id, user_id, dream_date (date), text (encrypted at rest), tags (json string[]), created_at, updated_at`

**seals** — the commit-reveal proofs.
`id, user_id, commitment_hash, ciphertext (encrypted payload), claim (json),
created_at (client clock), sealed_at (server), tsa_token, ots_proof, ots_status
(pending|complete), anchor_time (null until confirmed), status (sealed|unsealed|resolved),
revealed_payload (json, null until reveal), revealed_at, is_public (bool), handle (public
anon name, set at publish), outcome (hit|miss|pending, null until resolved)`

> Privacy model. MVP: content is encrypted at rest with a server-held key; the public only
> ever sees `commitment_hash` until reveal. Phase 2: client-side end-to-end encryption so the
> server cannot read sealed content. The anteriority proof does not depend on this choice.

**registry_votes** — community judgement on published seals.
`id, seal_id, voter_fingerprint (hashed IP+salt or session), vote (hit|miss), created_at`
Unique on `(seal_id, voter_fingerprint)`.

**commons_boards** — static list. `slug, label` (e.g. `came-true`, `recurring`, `lucid`,
`astral`, `nightmares`, `discussion`).

**commons_threads** — `no (bigint PK, from the shared post-number sequence), board, name
(nullable), poster_id, subject, body, created_at, bumped_at, reply_count, removed (bool)`

**commons_posts** — `no (bigint PK, same sequence), thread_no, name (nullable), poster_id,
body, created_at, removed (bool)`

**commons_reports** — `id, post_no, reason, created_at, resolved (bool)`

> `poster_id` is generated server side as `truncate(hash(thread_no + client_ip + daily_secret))`
> so the same person shares one id within a thread but cannot be tracked across threads. Post
> numbers (`no`) come from a single shared sequence, like a real imageboard.

---

## Auth

Keep it light. Email magic-link or passkey both work; Commons stays anonymous.

- `POST /api/auth/request` **public** — body `{ email }`, sends a magic link.
- `POST /api/auth/verify` **public** — body `{ token }`, returns `{ session_token }`.
- `POST /api/auth/logout` **user** — invalidates the session.
- `GET  /api/auth/me` **user** — returns the current user profile.

---

## Vault (private)

- `GET    /api/vault/entries` **user** — list the caller's entries, newest first.
- `POST   /api/vault/entries` **user** — body `{ dream_date, text, tags[] }` → the created entry.
- `PATCH  /api/vault/entries/:id` **owner** — edit text/tags/date.
- `DELETE /api/vault/entries/:id` **owner** — remove.

Recall stats and recurring-motif detection can stay client-side (as they are now). Optional:
`GET /api/vault/stats` **user** if you want them computed server side.

---

## Seals

- `POST /api/seals` **user**
  Body (MVP): `{ commitment_hash, ciphertext }`. The client hashes locally; the server never
  needs plaintext to prove time. On receipt the server requests an RFC-3161 token over the hash
  and submits the hash to OpenTimestamps.
  Returns `{ id, sealed_at, tsa_token, ots_status: "pending" }`.
- `GET  /api/seals/:id` **owner** — full seal state including anchor status.
- `POST /api/seals/:id/reveal` **owner**
  Body `{ revealed_payload }`. Server verifies `SHA-256(canonical(revealed_payload)) ==
  commitment_hash`, sets `status = unsealed`, stores the revealed payload.
- `POST /api/seals/:id/publish` **owner**
  Body `{ handle }`. Sets `is_public = true` so the seal appears in the Registry. Requires the
  seal to be revealed. Publishing grants the research permission in terms.html.
- `PATCH /api/seals/:id/resolve` **owner** — body `{ outcome: "hit" | "miss" }`.
- `GET  /api/seals` **user** — list the caller's own seals with status.

---

## Proofs (public verification)

Lets the standalone verifier fetch a shareable proof by id. Independent verification still
happens in the browser.

- `GET /api/proofs/:id` **public** — returns the verifier bundle for a **published** seal:
  ```
  { content, claim: { resolution_by, domain, specificity },
    nonce, created_at, hash, anchor: { time, receipt, ots_proof } }
  ```
  For a sealed-but-not-revealed public seal, return only `{ hash, anchor }` so anteriority is
  provable while content stays hidden. 404 for private seals.

---

## Registry (public)

The Registry is the set of published seals. These are read-mostly.

- `GET /api/registry` **public** — filters `?outcome=hit|miss|pending&domain=&sort=recent|backed&cursor=&limit=`.
  Each item: `{ id, handle, claim, content, sealed_at, revealed_at, outcome, hash,
  votes: { hit, miss }, anchor_time }`.
- `GET /api/registry/:id` **public** — one entry (same shape, plus proof link).
- `POST /api/registry/:id/vote` **public (rate-limited)** — body `{ vote: "hit" | "miss" }`,
  keyed by voter fingerprint; re-voting updates, sending the same vote twice clears it.
- `GET /api/registry/stats` **public** — `{ sealed, hits, misses, pending, hit_rate }`
  (hit_rate over resolved only).
- `GET /api/registry/leaderboard` **public** — top handles by verified hits.

---

## Commons (anonymous)

No auth. Rate-limited and moderated.

- `GET  /api/commons/boards` **public** — board slugs and labels.
- `GET  /api/commons/threads` **public** — `?board=&cursor=&limit=`, catalog order (by
  `bumped_at`). Item: `{ no, board, subject, snippet, name, reply_count, created_at, bumped_at }`.
- `GET  /api/commons/threads/:no` **public** — the OP plus all posts, each
  `{ no, name, poster_id, body, created_at }`.
- `POST /api/commons/threads` **public (rate-limited)** — body `{ board, name?, subject, body }`
  → the created thread. Server assigns `no`, `poster_id`, timestamps.
- `POST /api/commons/threads/:no/posts` **public (rate-limited)** — body `{ name?, body }` →
  the created reply; bumps the thread.
- `POST /api/commons/posts/:no/report` **public** — body `{ reason }`.

Greentext and `>>no` quote-links are rendered client side from the raw `body`; store the raw text.

---

## Moderation (admin)

- `GET    /api/admin/reports` **admin** — open reports queue.
- `DELETE /api/admin/commons/posts/:no` **admin** — soft-remove a post (`removed = true`).
- `DELETE /api/admin/commons/threads/:no` **admin** — soft-remove a thread.
- `POST   /api/admin/commons/bans` **admin** — ban a fingerprint or subnet.

---

## Timestamp anchoring service (internal)

Not public endpoints; a worker plus a cron job.

1. **On seal:** request an RFC-3161 token over `commitment_hash` (instant), and submit the hash
   to OpenTimestamps calendar servers (returns a pending `.ots`). Store both.
2. **Cron (every ~1h):** for seals with `ots_status = pending`, attempt `ots upgrade`. Once
   Bitcoin has attested, store the completed proof and set `anchor_time` from the block time,
   `ots_status = complete`.
3. The public proof endpoint serves whichever anchor evidence exists; the standalone verifier
   confirms it against Bitcoin without trusting Oneiratory.

---

## Cross-cutting

- **Rate limiting** on all public writes (Commons posts, Registry votes, auth requests), keyed
  by IP/fingerprint.
- **Research consent** rides on publication: public Registry and Commons content is anonymised
  and usable per terms.html; private Vault entries require explicit `research_opt_in`.
- **Anonymity:** never store raw IPs in the clear beyond what rate limiting needs; derive
  `poster_id` and `voter_fingerprint` via a salted hash and rotate the salt.
- **Independence:** the verifier must keep working from a proof bundle alone, even if the API
  is down. Do not make verification depend on a server call.

---

## Suggested build order

1. Auth + Vault (private CRUD) so entries persist.
2. Seals + the anchoring worker (this is the differentiator).
3. Proofs endpoint, then point the existing verifier at it.
4. Registry (publish, list, vote, stats, leaderboard).
5. Commons (threads, posts) + moderation + rate limits.
6. Deploy.
