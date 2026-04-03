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

There are **7 changes** to make:

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
Update the game count in:
- Hero description: `<p class="hero-desc">Play {N}+ games instantly...`
- Stats banner: `<span class="stat-value">{N}</span> Games`
- Meta description: `Play {N}+ free browser games instantly`
- OG description: `Play {N}+ free browser games instantly`
- Twitter description: `Play {N}+ free browser games instantly`

### A5. Remove Previous NEW Badge from Game Cards
Find ALL `<span class="thumb-badge">NEW</span>` in the `.games-grid` and delete them.

### A6. Add New Game Card
Add a new game card in the `.games-grid` (position it logically — newest games near the top):
```html
      <a href="/games/{GAME_SLUG}/" class="game-card" data-genres="{genre1},{genre2}">
        <div class="game-thumb">
          <span class="thumb-badge">NEW</span>
          <img src="/images/thumbnails/{GAME_SLUG}.svg" alt="{GAME_NAME} - {short alt text}" loading="lazy">
        </div>
        <div class="game-info">
          <div class="game-title">{GAME_NAME}</div>
          <div class="game-desc">{GAME_DESC}</div>
          <div class="game-tags">
            <span class="tag">{TAG_1}</span>
            <span class="tag">{TAG_2}</span>
          </div>
        </div>
      </a>
```

### A7. JSON-LD and SEO Meta
Update the FAQPage schema answer for "How often are new games added?" if the wording references a specific count. Update the Organization schema if needed.

---

## Part 2: Games Index Page (`apps/web-astro/src/pages/games/index.astro`)

There are **4 changes** to make:

### B1. Add New Game Card
Add a game card in the `.games-grid` (newest games near the top). Use the same card HTML pattern as the homepage but without `data-genres` filtering (the /games/ page has its own filter system):
```html
      <!-- {GAME_NAME} -->
      <a href="/games/{GAME_SLUG}/" class="game-card" data-genres="{genre1},{genre2}">
        <div class="game-thumb">
          <span class="thumb-badge">NEW</span>
          <img src="/images/thumbnails/{GAME_SLUG}.svg" alt="{alt text}" loading="lazy">
        </div>
        <div class="game-info">
          <div class="game-title">{GAME_NAME}</div>
          <div class="game-desc">{GAME_DESC}</div>
          <div class="game-tags">
            <span class="tag">{TAG_1}</span>
            <span class="tag">{TAG_2}</span>
          </div>
        </div>
      </a>
```

### B2. Remove Previous NEW Badges
Remove `<span class="thumb-badge">NEW</span>` from all previous game cards in the grid.

### B3. Update ItemList JSON-LD
Add the new game to the `itemListElement` array and update `numberOfItems`:
```json
{ "@type": "ListItem", "position": {N}, "name": "{GAME_NAME}", "url": "https://weeklyarcade.games/games/{GAME_SLUG}/" }
```

### B4. Update Game Count
Update the section header game count:
```html
<span class="game-count" id="gameCount">{N} games</span>
```
Also update the meta description, OG description, and page intro text game count.

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
{ slug: '{GAME_SLUG}', title: '{GAME_NAME}', description: '{GAME_DESC}', thumbnail: '{GAME_SLUG}.svg', alt: '{alt text}', tags: [{ label: '{TAG_1}' }, { label: '{TAG_2}' }], isNew: true },
```

### C2. Remove Previous isNew Flags
Set `isNew: false` (or remove the property) from all other games in the array.

**Note:** The category pages use the `CategoryPage.astro` shared component. The `games` array drives everything — game cards, ItemList schema, game count. No other changes needed per category page.

**Note:** If a genre has no matching category page (e.g., `sports`, `simulation`), skip it. Do NOT create new category pages — flag it in the output for the user to decide.

---

## Rules

- Read each file first to understand current state
- Count existing games to determine correct JSON-LD position and game count
- Only ONE game should have the NEW badge at a time (across all pages)
- Preserve all existing game cards — do not remove or reorder them
- Create the SVG thumbnail if it doesn't exist (or flag it as needed)
- Report all changes made across all files in your output
