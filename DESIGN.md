---
name: AUGUR
description: Prove you dreamed it first. A faded old-web instrument, with an anonymous dream board attached.
colors:
  paper: "#eeecf4"
  panel: "#f6f5fa"
  panel-alt: "#eae7f1"
  bar: "#655d84"
  bar-ink: "#efecf6"
  ink: "#2f2a44"
  ink-strong: "#26213a"
  muted: "#6f688c"
  faint: "#948dae"
  line: "#d1cbe0"
  line-soft: "#e1dcec"
  link: "#5a4b9c"
  hit: "#5c7a54"
  miss: "#9a6d7c"
  seal: "#5f5896"
  commons-mist: "#e8e4ec"
  commons-post: "#f2eef4"
  commons-name: "#5f8a80"
  commons-green: "#79895f"
  commons-link: "#6a5aa6"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.44em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
  lead:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Verdana, Geneva, Tahoma, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Courier New', Courier, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.14em"
  data:
    fontFamily: "'Courier New', Courier, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
spacing:
  xs: "6px"
  sm: "9px"
  md: "13px"
  lg: "18px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.bar}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "11px 22px"
  button-old:
    backgroundColor: "#e7e2f1"
    textColor: "{colors.link}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px 18px"
  input:
    backgroundColor: "#fbfafd"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 9px"
  cap-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.bar-ink}"
    rounded: "{rounded.none}"
    padding: "6px 13px"
---

# Design System: AUGUR

## 1. Overview

**Creative North Star: "The Small-Hours Observatory"**

AUGUR looks like a serious, faintly mystical corner of the old web: a nocturnal observatory for dreams, kept by someone rigorous. Dusk-lavender paper under a barely-there starfield, thin square-cornered panels, muted dusty-indigo header bars, and small system type. It is calm, hushed, and a little uncanny, but it never reads as fashionable or fun. It reads as an *instrument* someone has been quietly running in the small hours, keeping an honest record. The wonder is real; the presentation is disciplined.

The system runs in **two registers, split by purpose, not just mood**:

- **The Instrument** (the default) dresses everything evidentiary and serious: the homepage, the Registry, the Verifier, the Vault, and the About note. Its job is to be *taken seriously* and to never read as a psychic app. Faded phpBB-era forum idiom: Verdana body, Georgia serif for headings and the mystical asides, Courier for anything exact, dusty-indigo section bars, and mono "evidence cards" that adjudicate a sealed dream as a hit (faded sage) or an honest miss (faded mauve).
- **The Commons** dresses the community board only. Anonymous imageboard idiom: Courier throughout, faded-teal "Anonymous", dusty-sage greentext, muted-violet quote-links, and board categories (`/came-true/`, `/recurring/`, `/lucid/`, `/astral/`, `/nightmares/`, `/discussion/`). Hushed and welcoming, earnest rather than crude.

This system explicitly rejects, above all, **anything that reads as AI-generated**: gradient-filled pill buttons, `backdrop-filter` glassmorphism, pastel radial-gradient hero washes, and glossy dreamcore. That polished look is the exact thing this redesign exists to escape, because it makes a serious project look like a toy and puts people off. It also rejects **psychic and occult woo** (crystal balls, tarot, fortune-teller framing), **crypto/web3 hype** (neon, "blockchain-verified" badges), and **clinical SaaS coldness**.

**Key Characteristics:**
- Faded, nocturnal old-web: dusk-lavender paper, faint starfield, thin square borders, small system type.
- Two registers by purpose: the serious Instrument, and the anonymous Commons board.
- "Faint" lives in the chrome (borders, counts, meta); reading text and hit/miss labels stay fully legible.
- Evidence over persuasion: the homepage demonstrates the seal mechanism and shows hits beside honest misses.
- Verdana + Georgia + Courier. No gradients, no glass, no rounded pills.

## 2. Colors

Two low-contrast, dusk-toned palettes that share one green truth signal. Faintness is spent on chrome, never on reading text.

### Primary
- **Dusty Indigo** (#655d84, `--bar`): the Instrument's structural voice. Section header bars, the primary (beveled, square) button, active nav. Not an accent sprinkle; it is the frame.
- **Muted Violet Link** (#5a4b9c, `--link`): links and interactive text on the Instrument. On the Commons, links shift to **#6a5aa6** (quote-links).

### Secondary
- **Faded Teal** (#5f8a80, `--commons-name`): the Commons "Anonymous" name color, a quiet nod to old board name fields.
- **Dusty Sage** (#79895f, `--commons-green`): Commons greentext. Deliberately faded, never the harsh `#789922` of a real imageboard.

### Tertiary (truth signals)
- **Faded Sage** (#5c7a54, `--hit`): a resolved hit. Evidence-card HIT labels, resolved-hit states in the Vault and Registry. Reserved for "the proof holds".
- **Faded Mauve** (#9a6d7c, `--miss`): a resolved miss. Quiet, never alarming, because misses are honorable here.
- **Seal Indigo** (#5f5896, `--seal`): the "sealed, awaiting the event" state.

### Neutral
- **Ink** (#2f2a44) / **Ink Strong** (#26213a): body and headings. Deep dusk, high contrast on paper; never pure black.
- **Muted** (#6f688c): secondary text, descriptions. Verify it clears AA on the exact panel behind it.
- **Faint** (#948dae): chrome only, counts, meta, hairline labels. Not for anything that must be read closely.
- **Paper** (#eeecf4) / **Panel** (#f6f5fa) / **Panel-alt** (#eae7f1): the dusk-lavender page and its flat panels. Commons uses a mistier **#e8e4ec / #f2eef4**.
- **Line** (#d1cbe0) / **Line-soft** (#e1dcec): thin square hairlines. Every border is 1px.

### Named Rules
**The No-Glow Rule.** No gradients, no `backdrop-filter`, no glass, no rounded pills, no drop-shadow glows. Fills are flat, corners are square (0-2px), borders are 1px. The instant something looks glossy, it reads as AI, which is the one thing this system may never do.

**The Two-Register Rule.** A page is Instrument (serious, evidentiary) or Commons (anonymous board). Pick by purpose, load the matching palette and idiom, and never blur them: the Commons' looseness must never dilute the Instrument's credibility.

**The Truth-Signal Rule.** Faded sage (#5c7a54) means hit, faded mauve (#9a6d7c) means miss, seal indigo (#5f5896) means sealed-and-waiting. These three are never decorative.

## 3. Typography

**Display / mystical voice:** Georgia (with Times New Roman fallback) — serif, used for the wordmark, headings, and the awed italic asides.
**Body / UI voice:** Verdana (with Geneva, Tahoma) — the plain, legible old-web workhorse.
**Exact / data voice:** Courier New (with Courier) — hashes, timestamps, seal IDs, post meta, kickers, and the entire Commons.

**Character:** Deliberately of the old web. Georgia carries the wonder and the seriousness; Verdana keeps the interface plain and trustworthy; Courier is the sound of the machine and the anonymous board. The wordmark is Georgia, wide-tracked (0.44em), never lowercased into a "brand".

### Hierarchy
- **Display** (Georgia 400, ~38px, tracking 0.44em): the AUGUR wordmark and page mastheads only.
- **Headline** (Georgia 400, 20-22px): section titles inside panels.
- **Lead** (Georgia 400, 15px, italic-capable): the opening line of a section; the mystical asides and epigraphs.
- **Body** (Verdana 400, 12.5px, line-height 1.6): prose and UI. Small, like the era; cap measure at 64ch.
- **Label** (Courier 400, 11px, tracking 0.14em, uppercase): section-bar captions, kickers, form labels.
- **Data** (Courier 400, 11.5px): hashes, timestamps, seal IDs, post numbers, greentext.

### Named Rules
**The Machine-Voice Rule.** Anything literally exact (a hash, a timestamp, a seal ID, a declared condition, a post number) is Courier. Monospace is how the interface signals checkable fact.

**The Serif-For-Wonder Rule.** Georgia is reserved for the wordmark, headings, and the awed/mystical lines. It is never used for UI chrome or dense body text.

## 4. Elevation

This system is **flat**. There are no shadows, no glass, no glow. Depth is conveyed only by 1px hairlines, flat panel fills a shade off the paper, and dusty-indigo header bars. The single skeuomorphic touch is the **old-web bevel**: buttons get a 1px light top-and-left border against a darker bottom-and-right, the faint memory of a Windows-9x control. A barely-there tiled starfield (five 1px radial dots at ~0.1-0.2 alpha) sits on the page background as texture, never as a layer above content.

### Named Rules
**The Flat Rule.** If a surface needs to separate from another, it uses a 1px line and a flat fill, never a shadow. The only permitted "raised" affordance is the button bevel.

**The Starfield-Is-Background Rule.** The faint dot texture lives in the body background only. It never overlaps or dims content, and it stays under ~0.2 alpha so it reads as dusk, not decoration.

## 5. Components

### Buttons
- **Primary:** flat dusty-indigo (#655d84) fill, white text, square, with a 1px light top/left bevel. For Seal and other commits.
- **Old-web (secondary):** pale lilac (#e7e2f1) fill, violet text, square, 1px bevel. On hover the fill lightens.
- **No pills, no gradients, no glow.**

### Panels / Sections
- A 1px `--line` border, flat `--panel` fill, square corners. Each opens with a **caption bar**: a dusty-indigo strip in Courier uppercase, optionally with an italic Georgia note floated right.

### Board index & tables (Instrument)
- Real `<table>` layout, 1px hairlines, small Courier column heads, alternating `--panel-alt` rows. Forums/rows carry an icon, a description, a count, and a "last resolved / last dream" column.

### Evidence card (signature, Instrument)
- A mono panel that shows a sealed dream's anatomy: hidden text, the declared condition (Georgia italic), timestamp, and SHA-256. A status footer adjudicates it: **HIT** (faded sage), **MISS** (faded mauve), or **SEALED** (seal indigo). This is how the site proves it is an instrument, not an oracle.

### Inputs / Fields
- Flat off-white (#fbfafd) fill, 1px `--line` border, square, Courier or Verdana. Focus deepens the border to the link violet; no glow ring.

### Post (signature, Commons)
- An imageboard post: a Courier meta line (subject, faded-teal Anonymous, time, `No.`, `ID:`), then the body with dusty-sage greentext (leading `>`) and muted-violet `>>` quote-links. Replies are indented under a 1px left rule.

### Navigation
- A single 1px-bordered strip of small Courier/Verdana links separated by middots (Instrument) or `[ bracketed ]` links (Commons). Active item gets a flat `--panel-alt` fill. No sticky glass bar.

## 6. Do's and Don'ts

### Do:
- **Do** keep every surface flat: 1px hairlines, flat fills, square corners, the one permitted button bevel (The Flat Rule, The No-Glow Rule).
- **Do** pick a page's register by purpose (Instrument vs Commons) and keep the idioms separate (The Two-Register Rule).
- **Do** set every exact value in Courier (The Machine-Voice Rule) and reserve Georgia for the wordmark, headings, and awed asides (The Serif-For-Wonder Rule).
- **Do** reserve sage/mauve/seal-indigo for hit/miss/sealed only (The Truth-Signal Rule).
- **Do** spend "faint" on chrome; keep reading text at `--ink` and hit/miss labels fully legible. Target AAA where feasible, AA everywhere.
- **Do** let the homepage demonstrate the mechanism and show honest misses beside hits.

### Don't:
- **Don't** ever reintroduce the AI look: no gradient-filled pills, no `backdrop-filter`/glass, no pastel radial-gradient hero washes, no glossy dreamcore, no rounded-22px buttons. This is the single most important prohibition.
- **Don't** drift into psychic or occult woo: no crystal balls, tarot, moon-and-stars mysticism, or fortune-teller framing, despite the faded mystical mood.
- **Don't** reach for crypto/web3 hype: no neon, no "blockchain-verified" badges, despite the real seal.
- **Don't** use drop-shadows or glows to create depth; use a 1px line instead (The Flat Rule).
- **Don't** let Commons greentext go to the harsh `#789922`; keep it dusty sage. Don't let the board's looseness leak into the Instrument.
- **Don't** lowercase or restyle the wordmark; it is Georgia, wide-tracked, as-is.
- **Don't** use an em dash anywhere in user-facing copy (house rule).
