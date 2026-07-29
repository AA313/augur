# Deploying AUGUR for feedback

AUGUR is now a small Node app (a zero-dependency backend that serves the site and an API).
Static hosts like tiiny.site or Netlify Drop can no longer run it, because the Commons, Vault,
Seal, and Registry pages talk to the backend. You need a host that runs Node.

Everything is prepared: a `Dockerfile` pins **Node 24** (required by the built-in `node:sqlite`),
`.gitignore` / `.dockerignore` keep runtime state and dev snapshots out, and the repo has an
initial commit. Pick one of the two paths below.

---

## Option A — Render (recommended: free, no credit card)

You will need a **GitHub account** and a **Render account** (sign up at render.com with GitHub).

### 1. Put the code on GitHub
Create an empty repo at https://github.com/new (name it `augur`, public or private, do **not**
add a README). Then, in this folder:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/augur.git
git push -u origin main
```

(The first push opens a browser to sign in to GitHub, via Git Credential Manager.)

### 2. Deploy on Render
1. Render dashboard → **New +** → **Web Service**.
2. Connect your GitHub and pick the `augur` repo.
3. Render detects the `Dockerfile` → **Runtime: Docker** (leave build/start commands blank).
4. **Instance Type: Free**.
5. **Create Web Service.**

Render builds the image and gives you a URL like `https://augur-xxxx.onrender.com`. That is the
link to share.

**Free-tier notes (fine for feedback):**
- The service sleeps after ~15 minutes of no traffic; the first visit after that takes ~30–60s to
  wake. Warn people, or just open it yourself first before sharing.
- The database is ephemeral: it resets on each restart/deploy and **re-seeds** the Commons and
  Registry automatically, so it always looks populated. Visitor posts/seals persist only until the
  next restart. That is normal and fine for a demo.

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

## Good to know either way

- **No environment variables are required.** The host sets `PORT` automatically; the app reads it.
- **Sign-in is a prototype.** There is no email provider, so the Seal and Vault pages let anyone
  sign in with any email (the login token is returned directly). This is disclosed on the pages.
  Fine for a demo; a real launch would send an emailed magic link.
- **The timestamp anchors are real.** On seal, the server calls a public RFC-3161 authority
  (DigiCert) and the OpenTimestamps calendars from wherever it is hosted, so the anchors work in
  production too. Bitcoin confirmation still takes a few hours (unchanged).
- **To update the live site later:** commit your changes and `git push` (Render redeploys
  automatically) or `fly deploy` again.
