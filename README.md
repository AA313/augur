# AUGUR

A registry for dreams and the rare moments they seem to arrive early.

Record a dream, seal it so its exact wording is cryptographically fixed to a moment in time,
and later prove the dream came first. Includes a private journal (Vault), a public ledger of
verified predictions (Registry), an anonymous discussion board (Commons), and a standalone proof
verifier.

## Run it
No build step. Open `index.html` in a browser, or serve the folder with any static server:

    python3 -m http.server 8000
    # then visit http://localhost:8000

Everything is currently in-memory and resets on reload. The cryptographic seal is real; the
timestamp anchor is simulated.

## Pages
index.html, augur-vault.html, augur-seal-prototype.html, augur-verifier.html,
augur-registry.html, augur-commons.html, terms.html

## What's next
See CLAUDE.md for architecture and the roadmap: real persistence, a live OpenTimestamps anchor,
anonymity/auth, Commons moderation, and deployment.
