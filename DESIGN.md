---
name: Oneiratory
description: Prove you dreamed it first. A faded old-web instrument, evolved into one unified dusk-lavender system, with an anonymous dream board as its looser room.
colors:
  paper: "#edecf4"
  panel: "#f8f7fc"
  panel-2: "#efedf7"
  ink: "#282440"
  ink-strong: "#1f1b30"
  muted: "#5c567c"
  faint: "#948dae"
  line: "#dad5e7"
  line-soft: "#e7e3f1"
  link: "#574896"
  accent: "#574896"
  warm: "#bb6647"
  warm-soft: "#f4e6df"
  hit: "#587552"
  miss: "#95687a"
  seal: "#5f5896"
  bar: "#544d7c"
  bar-ink: "#f1eff9"
typography:
  hero:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(32px, 7vw, 54px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.34em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(21px, 3.4vw, 27px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(16px, 1.9vw, 17.5px)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.12em"
  data:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "normal"
  scale:
    micro: "10px"
    caption: "13px"
    caption-lg: "13.5px"
    body-sm: "14px"
    stat-sm: "19px"
    title-sm: "20px"
    stat: "24px"
    opener: "23px"
    headline-sm: "26px"
    headline-md: "28px"
    display-sm: "30px"
    display-md: "42px"
    display-lg: "48px"
rounded:
  xxs: "3px"
  xs: "4px"
  sm: "6px"
  md: "9px"
spacing:
  xs: "6px"
  sm: "11px"
  md: "14px"
  lg: "18px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.warm}"
    textColor: "#ffffff"
    borderColor: "#a5583b"
    rounded: "{rounded.sm}"
    padding: "11px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-strong}"
    borderColor: "{colors.line}"
    rounded: "{rounded.sm}"
    padding: "11px 20px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
    padding: "clamp(20px, 3.2vw, 28px)"
  input:
    backgroundColor: "#fbfafd"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
  section-cap:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.accent}"
    rounded: "0px"
    padding: "10px 18px"
  site-header:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.bar-ink}"
    rounded: "0px"
    padding: "0 clamp(16px, 4vw, 28px)"
---

# Design System: Oneiratory

## 1. Overview

**Creative North Star: "The Small-Hours Observatory"**

Oneiratory looks like a serious, faintly mystical corner of the web, kept by someone rigorous: a nocturnal observatory for dreams. Dusk-lavender paper under a barely-there starfield, thin panels with softly rounded corners, a full-width dusty-indigo header, serif headings, and calm system-sans prose. It is hushed and a little uncanny, but it never reads as fashionable, toy-like, or *generated*. It reads as an *instrument* someone has been quietly running in the small hours, keeping an honest record. The wonder is real; the presentation is disciplined.

**This is one unified system.** Every page links a single shared stylesheet (`oneiratory.css`) that owns the tokens, the starfield body, the full-width header/nav, the container, the buttons, the generic panel/caption chrome, and the footer. Page-specific styles layer on top. There is one identity across the whole site; you should never be able to tell you have "left" Oneiratory by moving between pages.

Within that one system there are **two moods, split by purpose, not by palette**:

- **The Instrument** (the default) dresses everything evidentiary and serious: the homepage, the Registry, the Verifier, the Seal, the Vault, the About note, and Terms. Its job is to be *taken seriously* and to never read as a psychic app. Serif headings and mystical asides (Georgia), calm sans prose, mono for anything exact, indigo section captions, and mono "evidence cards" that adjudicate a sealed dream as a hit (sage) or an honest miss (mauve).
- **The Commons** is the *looser room in the same house*: the anonymous community board. It shares the exact same header, type, tokens, containers, and footer as everything else, but keeps its own board idioms: a `/ augur /` slash masthead, mono `/slug/` board headers, sage greentext, colour-hashed Anonymous IDs, per-board tints drawn from the shared palette, and a `>>` quote-link culture. Welcoming and earnest, never crude, and now unmistakably part of the same site.

This system explicitly rejects, above all, **anything that reads as AI-generated**: gradient-filled pill buttons, `backdrop-filter` glassmorphism, pastel radial-gradient hero washes, glossy dreamcore, and the tiny-uppercase-eyebrow-on-every-section scaffold. That polished look is the exact thing this design exists to escape. It also rejects **psychic/occult woo** (crystal balls, tarot, fortune-teller framing), **crypto/web3 hype** (neon, "blockchain-verified" badges), and **clinical SaaS coldness**.

**Key Characteristics:**
- One shared system across all pages: dusk-lavender paper, faint starfield, softly-rounded (9px) panels, a full-width sticky indigo header, calm system-sans prose.
- Two moods by purpose: the serious Instrument and the looser Commons board, sharing one palette and chrome.
- "Faint" lives in the chrome (borders, counts, meta); reading text and hit/miss labels stay fully legible.
- Evidence over persuasion: the homepage demonstrates the seal mechanism and shows hits beside honest misses, then closes with the track record near the foot.
- Georgia (headings/wonder) + system-sans (prose/UI) + monospace (exact values). One restrained terracotta accent. No gradients, no glass, no glow.

## 2. Colors

One low-contrast, dusk-toned palette carries the whole site. Warmth is carried by a single accent and by typography, never by tinting the paper warm. Faintness is spent on chrome, never on reading text.

### Structure
- **Header Indigo** (#544d7c, `--bar`): the full-width sticky header and the board caption bars in the Registry/Commons. The structural frame, not an accent sprinkle.
- **Structural Violet** (#574896, `--accent` / `--link`): section captions, links, interactive text, focus borders, active nav. The one recurring structural colour.

### Accent
- **Terracotta** (#bb6647, `--warm`, border #a5583b, hover #a95a3d): the single warm accent, reserved for **primary actions** (Seal a dream, Seal & post, Sign in) and for small leading marks (step numbers, list bullets). It is what "commit" looks like. Never used as a fill for large areas.

### Truth signals
- **Sage** (#587552, `--hit`): a resolved hit, and the Commons greentext. Reserved for "the proof holds".
- **Mauve** (#95687a, `--miss`): a resolved miss. Quiet, never alarming, because misses are honourable here.
- **Seal Indigo** (#5f5896, `--seal`): the "sealed, awaiting the event" state.

### Neutral
- **Ink** (#282440) / **Ink Strong** (#1f1b30): body and headings. Deep dusk, high contrast on paper; never pure black. (Body ink clears ~12:1 on the panels.)
- **Muted** (#5c567c): secondary text, descriptions. Clears AA on the panels.
- **Faint** (#948dae): chrome only, counts, meta, hairline labels. Not for anything read closely.
- **Paper** (#edecf4) / **Panel** (#f8f7fc) / **Panel-2** (#efedf7): the dusk-lavender page and its two flat panel tints.
- **Line** (#dad5e7) / **Line-soft** (#e7e3f1): thin hairlines. Every border is 1px.

### Named Rules
**The No-Glow Rule.** No gradients, no `backdrop-filter`, no glass, no pill buttons, no drop-shadow glows. Fills are flat, corners are softly rounded (6-9px, never fully round), borders are 1px. The instant something looks glossy, it reads as AI, which is the one thing this system may never do.

**The One-Accent Rule.** Terracotta (`--warm`) is the only warm colour and appears only on primary actions and small leading marks. Structure is violet/indigo; warmth is the accent. Do not introduce a second accent hue.

**The Truth-Signal Rule.** Sage (#587552) means hit, mauve (#95687a) means miss, seal indigo (#5f5896) means sealed-and-waiting. These three are never decorative (sage doubles only as Commons greentext, which is itself a "this is plain talk" signal).

## 3. Typography

**Wonder / heading voice:** Georgia (Times New Roman fallback) — serif, used for the wordmark, the hero, section headings, leads, and the awed italic asides.
**Prose / UI voice:** the system-sans stack (`system-ui, -apple-system, 'Segoe UI', Roboto, ...`) — a calm, modern, legible workhorse. This retires the old Verdana body; Verdana was one of the "2010 web" tells the evolution set out to remove.
**Exact / data voice:** the monospace stack (`ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Consolas, ...`) — hashes, timestamps, seal IDs, captions, post meta, and the Commons board furniture.

**Character:** Georgia carries the wonder and the seriousness; the system sans keeps the interface calm, current, and trustworthy; monospace is the sound of the machine and the anonymous board. The pairing is on a real contrast axis (serif + humanist sans + mono), never two similar sans. The wordmark is Georgia, wide-tracked (0.34em), never lowercased into a "brand".

### Hierarchy
- **Hero** (Georgia 400, clamp 32-54px, tracking -0.01em, `text-wrap:balance`): the homepage headline only.
- **Wordmark** (Georgia 400, 21px, tracking 0.34em): the Oneiratory brand in the header.
- **Headline** (Georgia 400, clamp 21-27px): section titles inside panels.
- **Lead** (Georgia 400, clamp 16-17.5px): the opening line of a section; mystical asides and epigraphs.
- **Body** (system-sans 400, 15px, line-height 1.65): prose and UI. Cap prose measure at ~66ch.
- **Label** (mono 400, 11px, tracking 0.12em, uppercase): section-cap captions and form labels.
- **Data** (mono 400, 12px): hashes, timestamps, seal IDs, post numbers, greentext, stat figures.

### Named Rules
**The Machine-Voice Rule.** Anything literally exact (a hash, a timestamp, a seal ID, a declared condition, a post number, a stat) is monospace. It is how the interface signals checkable fact.

**The Serif-For-Wonder Rule.** Georgia is reserved for the wordmark, the hero, headings, leads, and the awed/mystical lines. It is never used for UI chrome or dense body text.

## 4. Elevation

This system is **flat**. There are no shadows, no glass, no glow. Depth is conveyed only by 1px hairlines, flat panel fills a shade off the paper, softly-rounded corners, and the full-width indigo header. A barely-there tiled starfield (five 1px radial dots at ~0.1-0.2 alpha, `background-attachment:fixed`) sits on the page background as texture, never as a layer above content. The old Windows-9x button bevel has been retired along with Verdana; the evolved primary button is a flat terracotta fill.

### Named Rules
**The Flat Rule.** If a surface needs to separate from another, it uses a 1px line and a flat fill, never a shadow. Corners are softly rounded (6-9px), not sharp and not fully round.

**The Starfield-Is-Background Rule.** The faint dot texture lives in the fixed body background only. It never overlaps or dims content, and it stays under ~0.2 alpha so it reads as dusk, not decoration.

## 5. Components

### Site header (shared)
- A full-width sticky bar in header-indigo (`--bar`), inner content capped at 1060px. The Georgia wordmark sits left; the nav sits right as small sans links that highlight on hover and mark the active page with a translucent white fill. On narrow screens the nav scrolls horizontally rather than wrapping or breaking the bar. There is exactly one of these, defined once in `oneiratory.css`.

### Buttons
- **Primary:** flat terracotta (`--warm`) fill, white text, 6px radius, 1px darker terracotta border. For Seal and other commits.
- **Ghost (secondary):** transparent fill, `--line` border, ink text; on hover the border and text go to accent violet on white.
- **No pills, no gradients, no glow, no bevel.**

### Panels / Sections
- A 1px `--line` border, flat `--panel` fill, 9px corners. Each opens with a **caption bar** (`.cap`): a light `--panel-2` strip in mono uppercase violet, optionally with an italic Georgia note (`.rt`) at the right via flex.

### Board tables (Registry)
- Real `<table>` layout inside an `overflow-x:auto` wrapper so it scrolls on mobile instead of breaking the page. Indigo board header, mono column heads, alternating `--panel-2` rows, mono hashes and dates.

### Evidence card (signature, Instrument)
- A mono panel showing a sealed dream's anatomy: hidden text, the declared condition (Georgia italic), timestamp, and SHA-256. A status footer adjudicates it: **HIT** (sage), **MISS** (mauve), or **SEALED** (seal indigo). This is how the site proves it is an instrument, not an oracle.

### Inputs / Fields
- Flat off-white (#fbfafd) fill, 1px `--line` border, 6px radius. Focus deepens the border to accent violet; no glow ring.

### Post (signature, Commons)
- An imageboard post: a mono meta line (subject, teal-sage Anonymous, time, `No.`, colour-hashed `ID:`), then the body with sage greentext (leading `>`) and violet `>>` quote-links. Replies are marked by a return-arrow (↳) and a `--panel-2` tint, **not** a coloured side-stripe.

### Footer (shared)
- A full-width `--panel-2` band with a mono note line (the real-anchor disclaimer) and small centred links. Defined once in `oneiratory.css`.

## 6. Do's and Don'ts

### Do:
- **Do** keep everything on the one shared system: link `oneiratory.css`, use the `.site-header`, `.cap`/`.in` panels, `.btn`/`.btn-primary`/`.btn-ghost`, and `.site-footer`. Put only page-specific rules inline.
- **Do** keep every surface flat: 1px hairlines, flat fills, 6-9px corners (The Flat Rule, The No-Glow Rule).
- **Do** reserve terracotta for primary actions and small leading marks only (The One-Accent Rule).
- **Do** set every exact value in monospace (The Machine-Voice Rule) and reserve Georgia for the wordmark, hero, headings, leads, and awed asides (The Serif-For-Wonder Rule).
- **Do** reserve sage/mauve/seal-indigo for hit/miss/sealed (The Truth-Signal Rule).
- **Do** spend "faint" on chrome; keep reading text at `--ink` and hit/miss labels fully legible. Target AA everywhere, AAA where feasible.
- **Do** let the Commons keep its board character (slash masthead, `/slug/` heads, greentext, colour-hashed IDs) while sharing the site's header, type, tokens, and footer.

### Don't:
- **Don't** ever reintroduce the AI look: no gradient-filled pills, no `backdrop-filter`/glass, no pastel radial-gradient washes, no glossy dreamcore, no uppercase eyebrow on every section. This is the single most important prohibition.
- **Don't** give a page its own palette or its own header/footer. If it looks like a different site, it is wrong.
- **Don't** use a coloured side-stripe (`border-left`/`border-right` > 1px as an accent) on cards, replies, or callouts. Distinguish with a tint, a full border, a label, or a leading mark instead.
- **Don't** bring back Verdana or the Windows-9x button bevel; those were the "2010 web" tells the evolution removed.
- **Don't** drift into psychic/occult woo or crypto/web3 hype, despite the faded mystical mood and the real seal.
- **Don't** use drop-shadows or glows for depth; use a 1px line (The Flat Rule).
- **Don't** lowercase or restyle the wordmark; it is Georgia, wide-tracked, as-is.
- **Don't** use an em dash anywhere in user-facing copy (house rule).
