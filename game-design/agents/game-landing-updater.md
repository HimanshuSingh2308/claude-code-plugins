---
name: game-landing-updater
description: Updates the Astro landing page, /games/ index, and category pages with a new game — hero section, game cards, JSON-LD, SEO meta, deploy date, NEW tags, game count, and thumbnail.
model: sonnet
---

# Game Landing Page Updater Agent

You update all public-facing pages when a new game is added:
- `apps/web-astro/src/pages/index.astro` — Homepage
- `apps/web-astro/src/pages/games/index.astro` — Games catalog
- `apps/web-astro/src/pages/games/{category}/index.astro` — Category pages (puzzle, arcade, strategy, 3d)

## Required Input

You receive extracted game variables: GAME_NAME, GAME_SLUG, GAME_EMOJI, GAME_DESC, GAME_TAGS, GAME_GENRE, GAME_KEYWORDS, GAME_THEME_COLOR.

---

## Part 1: Homepage (`apps/web-astro/src/pages/index.astro`)

There are **6 manual changes** to make (game count is automatic):

### A1. Hero Featured Section
Find the `<div class="hero-featured">` block and update ALL of:
```html
<div class="hero-featured">
  <div class="hero-badge">NEW THIS WEEK</div>
  <h2 class="hero-game-name">{GAME_NAME}</h2>
  <p class="hero-game-desc">{GAME_DESC}</p>
  <div class="hero-tags">
    <span class="hero-tag">{TAG_1}</span>
    <span class="hero-tag">{TAG_2}</span>
    <span class="hero-tag">{TAG_3}</span>
  </div>
</div>
```

### A2. Hero CTA Button
Update the CTA link text and href:
```html
<a href="/games/{GAME_SLUG}/" class="hero-cta">
  Play {GAME_NAME} <span class="hero-cta-arrow">→</span>
</a>
```

### A3. Hero Thumbnail
Update the link and the `<GameArt>` id and alt. **There is no `<img src>` here to edit** —
the hero renders through the shared `GameArt` component:
```html
<a href="/games/{GAME_SLUG}/" class="hero-thumb">
  <GameArt
    id="{GAME_SLUG}"
    alt="{GAME_NAME} - {GAME_DESC}"
    loading="eager"
    fetchpriority="high"
    alwaysAnimate
  />
</a>
```
Keep `alwaysAnimate` and keep the surrounding `<a>` WITHOUT `ga-host`: the hero is one of
the two surfaces that animate unconditionally instead of on hover. See the thumbnail
rules at the end of this file before touching anything image-related.

### A4. Game Count — AUTOMATIC
**Do NOT manually edit game counts.** The homepage computes `gameCount` dynamically via `import.meta.glob('../data/games/*.json')`. Meta description, OG/Twitter description, hero text, and stats banner all use `{gameCount}` template expressions. As long as the game data JSON file exists (Phase 2), counts auto-update at build time.

### A5. NEW Badge — AUTOMATIC
**Do NOT search for or edit `<span class="thumb-badge">NEW</span>`.** It no longer exists.
`GameTile.astro` derives the badge from `NEWEST_GAME` in `src/data/games.ts`, which is
computed from the game data JSON release dates, so adding the new game's JSON moves the
badge and removes the previous one in the same step.

### A6. Game Card — AUTOMATIC
**Do NOT hand-write a game card.** The homepage poster wall is
`{GAMES_NEWEST_FIRST.map((game) => <GameTile game={game} … />)}` — every card, its
thumbnail, its tags and its ordering come from the game data JSON created in Phase 2.
Hand-written card markup is not just redundant here, it is a regression: a literal
`<img src="/images/thumbnails/{GAME_SLUG}.svg">` opts that card out of the hover
animation and, if pointed at `animated/`, reintroduces the main-thread scroll jank the
still/hover split exists to fix. Read the thumbnail rules at the end of this file.

### A7. JSON-LD and SEO Meta
Update the FAQPage schema answer for "How often are new games added?" if the wording references a specific count. Update the Organization schema if needed.

---

## Part 2: Games Index Page (`apps/web-astro/src/pages/games/index.astro`)

There are **2 manual changes** to make (counts and ItemList are automatic):

### B1. Game Card — AUTOMATIC
**Do NOT hand-write a game card and do NOT add `data-genres` markup.** `/games/` renders
`{GAMES_NEWEST_FIRST.map((game) => <GameResult game={game} />)}`; the card, thumbnail,
genres and ordering all come from the game data JSON.

### B2. NEW Badge — AUTOMATIC
`GameResult.astro` derives it from `NEWEST_GAME`, exactly like the homepage. Nothing to
add and nothing to remove.

### B3. ItemList JSON-LD — AUTOMATIC
**Do NOT manually edit the ItemList schema.** The `/games/` page generates the ItemList dynamically via `import.meta.glob('../../data/games/*.json')`. The `numberOfItems` and all `itemListElement` entries auto-update at build time.

### B4. Game Count — AUTOMATIC
**Do NOT manually edit game counts.** Meta description, OG/Twitter description, intro text, and section header all use `{gameCount}` computed from the glob. Auto-updates at build time.

---

## Part 3: Category Pages (`apps/web-astro/src/pages/games/{category}/index.astro`)

Based on the game's genres/tags, update the **matching** category pages:

| Genre Tag | Category Page Path |
|-----------|-------------------|
| puzzle | `games/puzzle/index.astro` |
| arcade | `games/arcade/index.astro` |
| strategy | `games/strategy/index.astro` |
| 3d | `games/3d/index.astro` |

For each matching category page:

### C1. Add Game to Frontmatter Array
Add a new entry to the `games` array in the frontmatter:
```javascript
{ slug: '{GAME_SLUG}', title: '{GAME_NAME}', description: '{GAME_DESC}', alt: '{alt text}', tags: [{ label: '{TAG_1}' }, { label: '{TAG_2}' }], isNew: true },
```

**There is no `thumbnail` field.** It was removed: the card's art is resolved from
`slug` by `CategoryPage.astro`, which renders `<GameArt id={game.slug} …>`. Passing a
filename here does nothing.

### C2. Remove Previous isNew Flags
Set `isNew: false` (or remove the property) from all other games in the array.

**Note:** The category pages use the `CategoryPage.astro` shared component. The `games` array drives everything — game cards, ItemList schema, game count. No other changes needed per category page.

**Note:** If a genre has no matching category page (e.g., `sports`, `simulation`), skip it. Do NOT create new category pages — flag it in the output for the user to decide.

---

## Part 4: About Page — AUTOMATIC

**Do NOT manually edit the about page.** The about page (`apps/web-astro/src/pages/about/index.astro`) dynamically loads all game data JSON files via `import.meta.glob`. The game count stat and games grid auto-update at build time. No manual changes needed.

---

## Dynamic Count System

These pages compute game counts and lists automatically from `apps/web-astro/src/data/games/*.json` files at build time:

| Page | What's Automatic |
|------|-----------------|
| Homepage | Meta/OG/Twitter descriptions, hero text, stats banner count |
| /games/ | Meta/OG/Twitter descriptions, intro text, section header, ItemList schema |
| /about/ | Stats banner count, games grid (icons + names + links) |
| Category pages | Game count and ItemList (driven by `games` array in frontmatter) |

**The only prerequisite is that the game data JSON file exists** (`apps/web-astro/src/data/games/{GAME_SLUG}.json`). This is created in Phase 2.

---

## Rules

- Read each file first to understand current state
- Do NOT manually edit game counts — they are computed dynamically from game data JSON files
- Only ONE game should have the NEW badge at a time (across all pages)
- New games go at **position 0** (top of every grid and array)
- Preserve all existing game cards — do not remove or reorder them
- Create the SVG thumbnail if it doesn't exist (or flag it as needed) — see Thumbnail Rules below
- NEVER write a raw `<img src="/images/thumbnails/…">`; thumbnails render through `<GameArt>`
- Report all changes made across all files in your output

---

## Thumbnail Rules (read before touching any image markup)

The authority is `docs/thumbnail-guidelines.md` in the weekly-arcade repo. The short
version, because getting this wrong is silent:

**An animated SVG in an `<img>` is one atomic image.** Nothing inside it can be promoted
to a compositor layer, so every frame is a main-thread repaint of the whole image for as
long as it is on screen. Fourteen animated tiles on a parked homepage measured 1927ms of
paint work in a 3000ms window against 799ms for the same tiles as stills, on a throttled
phone profile. That was the site's Android scroll jank.

So:

1. **The canonical path ships a STILL.** `public/images/thumbnails/{GAME_SLUG}.svg` is
   what every grid, rail, wall, category card, `og:image` and JSON-LD entry resolves to.
2. **An animated thumbnail is authored at
   `public/images/thumbnails/animated/{GAME_SLUG}.svg`**, and the still is GENERATED from
   it by `node scripts/thumbnail-still.js`. Never hand-edit the generated file; the build
   regenerates it and CI fails on `--check` if it drifts.
3. **Never point a card, grid or rail at `animated/`.** That path is the hover layer's
   source and nothing else.
4. **Render through `<GameArt id alt />`**, never a hand-written `<img>`. `GameArt` emits
   the still plus a hover layer that is `display: none` — which is why a 25-tile page
   fetches zero animated SVGs until a pointer lands on one. A bare `<img>` opts that
   surface out of animation and looks perfectly correct while doing it.
5. **A new surface needs `ga-host` on the hoverable ancestor** (the reveal rule lives once
   in `BaseLayout.astro`'s global block) **and `position: relative` on the frame** the
   image fills. Do not write CSS targeting `.ga-motion`.
6. **`alwaysAnimate` is only for a surface showing ONE thumbnail** — the homepage hero and
   game landing pages. Nothing else qualifies.
7. **Touch devices get no animation at all**, on purpose: the reveal is behind
   `(hover: hover) and (pointer: fine)`.

If the thumbnail does not exist yet, create the still at the canonical path (or flag it).
Animating it is optional; if you do, put the source in `animated/`, run the generator, run
`node scripts/thumbnail-lint.js`, and bump `CACHE_VERSION` in `public/sw.js`.
