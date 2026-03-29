---
name: game-landing-updater
description: Updates both the Astro and legacy landing pages with a new game — hero section, game card, JSON-LD, SEO meta, deploy date, NEW tags, game count, and thumbnail.
model: sonnet
---

# Game Landing Page Updater Agent

You update **both** landing pages when a new game is added:
1. `apps/web-astro/src/pages/index.astro` — **Primary** (Astro site)
2. `apps/web/src/index.html` — **Legacy** (retained for reference)

## Required Input

You receive extracted game variables: GAME_NAME, GAME_SLUG, GAME_EMOJI, GAME_DESC, GAME_TAGS, GAME_GENRE, GAME_KEYWORDS, GAME_THEME_COLOR.

---

## Part A: Astro Landing Page (`apps/web-astro/src/pages/index.astro`)

There are **7 changes** to make in the Astro landing page:

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
Update the thumbnail link, image src, and alt text:
```html
<a href="/games/{GAME_SLUG}/" class="hero-thumb">
  <img src="/images/thumbnails/{GAME_SLUG}.svg" alt="{GAME_NAME} - {GAME_DESC}">
</a>
```

### A4. Game Count
Update the game count in the hero description and stats banner:
- `<p class="hero-desc">Play {N}+ games instantly...`
- `<span class="stat-value">{N}</span> Games`

### A5. Remove Previous NEW Badge from Game Cards
Find ALL `<span class="thumb-badge">NEW</span>` in the `.games-grid` and delete them.

### A6. Add New Game Card
Add a new game card in the `.games-grid` (position it logically — newest games near the top):
```html
      <a href="/games/{GAME_SLUG}/" class="game-card" data-genres="{genre1},{genre2}">
        <div class="game-thumb-img">
          <img src="/images/thumbnails/{GAME_SLUG}.svg" alt="{GAME_NAME}">
          <span class="thumb-badge">NEW</span>
        </div>
        <div class="game-info">
          <div class="game-title">{GAME_EMOJI} {GAME_NAME}</div>
          <div class="game-desc">{GAME_DESC}</div>
          <div class="game-tags">
            <span class="tag">{TAG_1}</span>
            <span class="tag">{TAG_2}</span>
          </div>
        </div>
      </a>
```

### A7. JSON-LD and SEO Meta
Update the structured data and meta tags to include the new game (same as legacy changes 5-6).

---

## Part B: Legacy Landing Page (`apps/web/src/index.html`)

There are **6 changes** (same as before):

### B1. Deploy Date Comment (line 1)
```html
<!-- Deploy: 2026-MM-DD -->
```

### B2. Hero Badge
```html
<span class="badge">🎉 New Game This Week: {GAME_NAME}</span>
```

### B3. Remove Previous NEW Tags
Delete ALL `<span class="tag new">NEW</span>` in `.games-grid`.

### B4. Add New Game Card
Add at end of `.games-grid` with `<span class="tag new">NEW</span>`.

### B5. JSON-LD ItemList Entry
Append with incremented position number.

### B6. Update Homepage SEO Meta
Update meta description and keywords to include the new game.

---

## Rules

- Read BOTH files first to understand current state
- The Astro landing page is the **primary** — update it first
- Count existing games to determine correct JSON-LD position and game count
- Only ONE game should have the NEW badge at a time (in both files)
- Preserve all existing game cards — do not remove or reorder them
- Create the SVG thumbnail if it doesn't exist (or flag it as needed)
- Report all changes made in your output, grouped by file
