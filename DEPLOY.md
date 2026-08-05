# Deploying Oneiratory

Oneiratory is a small Node app (a zero-dependency backend that serves the site and an API).
Static hosts like tiiny.site or Netlify Drop can no longer run it, because the Commons, Vault,
Seal, and Registry pages talk to the backend. You need a host that runs Node.

Everything is prepared: a `Dockerfile` pins **Node 24** (required by the built-in `node:sqlite`),
`.gitignore` / `.dockerignore` keep runtime state and dev snapshots out, and the repo has an
initial commit. Pick one of the two paths below.

---

## Option A — Render (recommended: free, no credit card)

The code is already on GitHub at **`AA313/augur`**, and `render.yaml` is a Render **Blueprint**, so
Render configures the service for you (no build/start commands to fill in, secrets generated).

1. Sign in at https://render.com (sign up free with GitHub if you do not have an account).
2. **New +** → **Blueprint**.
3. Connect GitHub and pick the **`AA313/augur`** repo. Render reads `render.yaml` and shows a web
   service named **oneiratory** (Runtime: Docker, Plan: Free).
4. Click **Apply**.

Render builds the `Dockerfile` (Node 24, required by `node:sqlite`) and, after a few minutes, gives
you a URL like `https://oneiratory.onrender.com`. That is the link to share.

The blueprint auto-generates `AUGUR_ADMIN_TOKEN` and `AUGUR_SECRET` as strong random values (never
the dev defaults). To sign in to the moderator page `/admin.html`, read `AUGUR_ADMIN_TOKEN`
from the service's **Environment** tab. To update the live site later, just `git push` — Render
redeploys automatically (`autoDeploy: true`).

**Free-tier notes (fine for a preview):**
- The service sleeps after ~15 minutes of no traffic; the first visit after that takes ~30–60s to
  wake. Open it yourself first before sharing.
- The database is ephemeral: it resets on each restart/deploy and **re-seeds** the labelled example
  Commons and Registry entries automatically, so it always looks populated. Visitor posts/seals
  persist only until the next restart. To keep real data, upgrade off Free and uncomment the
  `disk:` block in `render.yaml` (it mounts persistent storage at `/app/data`).
- **Auth is still a prototype:** anyone can sign in as any email, so treat this deploy as a
  staging/preview and do not invite people to store real private dreams yet.

---

## Option B — Fly.io (no GitHub needed; asks for a card, but a small app stays in the free allowance)

1. Install flyctl: https://fly.io/docs/hab/install/ then `fly auth signup`.
2. In this folder:
   ```bash
   fly launch --no-deploy
   ```
   Accept the detected `Dockerfile`. When asked, set the internal port to **8080**.
3. Deploy:
   ```bash
   fly deploy
   ```
   You get a URL like `https://augur.fly.dev`.

---

## Image safety (read before enabling a public board with uploads)

The Commons accepts image attachments, and they are protected in layers:

1. **Metadata is stripped** in the browser (canvas re-encode) before upload, so no EXIF/GPS leaks.
2. **Pre-moderation:** every image is held and shown only after a moderator approves it in
   `/admin.html` (set `AUGUR_ADMIN_TOKEN`).
3. **Perceptual-hash blocklist:** when a moderator rejects an image, its dHash is remembered and
   near-duplicate re-uploads are auto-blocked. This only blocks content already removed here.
4. **External scanner hook (you must configure it for real CSAM detection):** set
   `AUGUR_SCAN_URL` (and optionally `AUGUR_SCAN_KEY`) to a real service. AUGUR POSTs
   `{ mime, data }` and blocks the upload if the service returns `{ "match": true }`.

**AUGUR cannot detect CSAM by itself.** Real detection needs an approved service that matches
against NCMEC's known-CSAM hash database, and in the US it comes with a legal duty to report
matches to the NCMEC CyberTipline. Options: **Microsoft PhotoDNA Cloud Service** (free, apply for
access), **Cloudflare CSAM Scanning Tool** (free if the site is proxied through Cloudflare), or
**Thorn Safer** (paid, also catches novel content). Point `AUGUR_SCAN_URL` at your adapter for one
of these before you open uploads to the public. Until then, keep uploads pre-moderated (default).

## Good to know either way

- **Env vars:** the host sets `PORT` automatically; the app reads it. The Render blueprint also
  generates `AUGUR_ADMIN_TOKEN` and `AUGUR_SECRET` (never the dev defaults); on other hosts set
  those two yourself.
- **Sign-in uses emailed magic links (via Resend).** Set `RESEND_API_KEY`, `MAIL_FROM`, and
  `PUBLIC_BASE_URL` (all in the Render blueprint) to turn it on: `/api/auth/request` then emails a
  one-time link to `auth.html`, and never returns the token to the browser. Until those are set, a
  production server **fails secure** (refuses sign-in with a 503); only local dev returns the link
  directly for convenience. Get a key at resend.com; for `MAIL_FROM`, verify your domain, or use
  `onboarding@resend.dev` for testing before you own `oneiratory.com`.
- **The timestamp anchors are real.** On seal, the server calls a public RFC-3161 authority
  (DigiCert) and the OpenTimestamps calendars from wherever it is hosted, so the anchors work in
  production too. Bitcoin confirmation still takes a few hours (unchanged).
- **To update the live site later:** commit your changes and `git push` (Render redeploys
  automatically) or `fly deploy` again.
