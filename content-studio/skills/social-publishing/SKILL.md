---
name: social-publishing
description: Weekly Arcade's brand voice and the per-platform metadata contracts for Instagram and YouTube. Load before writing any caption, title, description, hashtag set or upload bundle.
---

# social-publishing

The channels exist and their profile copy is already written. This file is the
source of truth for that voice, so generated metadata matches the profiles
instead of drifting into a register nobody chose.

## The accounts

| | Instagram | YouTube |
| --- | --- | --- |
| Handle | `@weeklyarcade.games` | `@weeklyarcadegames` |
| Display name | Weekly Arcade · Browser Games | Weekly Arcade |
| Account type | Creator (has trending audio) | Brand Account |
| Destination | `weeklyarcade.games` in bio | `weeklyarcade.games` in About + links |

The IG display name carries "Browser Games" on purpose - Instagram indexes the
name field, so it earns discovery the bio text does not. Do not "clean it up"
to just the brand name.

Deep link for a specific game: `weeklyarcade.games/games/<slug>`.

## What the brand claims

Every line of metadata has to be consistent with these, because they are what
the profiles already say:

- A brand-new original game every week.
- Free. No downloads, no signup, no ads.
- Runs instantly in the browser, phone or laptop.
- Built from scratch. Not clones.

**Never hardcode the catalogue size.** The profile copy says "24 originals",
true when the accounts were made in August 2026, and it grows weekly. Read the
live count from `GAME_REGISTRY` in `packages/shared` when a caption needs it,
or leave the number out. A stale count in a caption is worse than no count.

## Voice

The channel's stated promise is "the runs worth watching" - big clears,
near-misses, physics that should not work but does, the occasional total
collapse. Metadata has to sound like someone who watched the clip, because the
About page promises exactly that.

1. Describe what happened in *this* clip. If a caption would fit any other
   video, it is advertising copy - rewrite it.
2. No "Like and subscribe". It costs a line and does nothing on Shorts.
3. No "Check out", no feature lists, no exclamation stacking.
4. Emoji: at most one, and only where it does work. 🕹️ is the brand's.
5. The game gets named in the caption and the title, never in the voiceover.
   See `vo-scripting` for why.
6. British-or-American spelling: match the site. The site is American.
7. Never use em dashes. Use a regular hyphen.

## Instagram caption

First 125 characters are all that show before "more", so the hook lives there
and the link never does.

```
{one line of commentary on what actually happened}

{one line of stakes or context, optional}

Play {Game Name} free, no signup - link in bio
🕹️ New game every week

#browsergames #indiegames #{genre} #{gamename}
```

Instagram does not render clickable links in captions, so never write a bare
URL as a call to action - point at the bio. Hashtags go in the caption, not a
first comment; the reach difference is a myth and a comment is one more step.

## YouTube Shorts

Title, under 100 chars, no clickbait caps. Patterns that fit the voice:

| Pattern | Example |
| --- | --- |
| The moment | `This clear should not have worked` |
| The number | `29,849 grains from one move` |
| The near-miss | `Four rows with no clears, then this` |

Append the game name only if it fits naturally; the description carries it
anyway. Never append "#shorts" to the title - it is redundant and ugly.

Description:

```
{one line of commentary about what happened in the clip}

Play {Game Name} free, no signup: weeklyarcade.games/games/{slug}
A brand-new browser game every week.

#{genre} #browsergames #indiegames #{gamename}
```

## YouTube long-form

Compilations. Title states what the collection is, not how good it is:
`Every big clear from Duneburst this month`, not `INSANE Duneburst moments!!`.

Description leads with the same one-line promise the About page opens with -
`A brand-new original browser game every week. Free, instant, no signup, no
ads.` - then a timestamped chapter list, then the site link. Chapters need
`0:00` as the first stamp or YouTube ignores all of them.

## Limits worth knowing

| Field | Limit | Practical |
| --- | --- | --- |
| IG caption | 2,200 chars | first 125 visible |
| IG hashtags | 30 max | use 4-6; 30 reads as spam |
| IG Reels via API | 90s | our clips are 12-30s |
| YT title | 100 chars | ~60 before truncation in search |
| YT description | 5,000 chars | first 2-3 lines visible |
| YT tags | 500 chars total | low ranking value, keep short |
| YT Shorts | 3 min, vertical | must be 9:16 to be treated as a Short |

## How publishing actually works

This is the part that shapes the metadata's output format, so it is not
optional context.

**YouTube: manual upload, no API.** Uploads via `videos.insert` from an
un-audited API project are locked `private` and *the owner cannot change the
visibility* - not from Studio, not at all. The only exits are passing a
compliance audit or re-uploading by hand. So the pipeline does not upload. It
writes a bundle - mp4, thumbnail, title, description, tags - and a human drags
it into Studio, where the native scheduler is better than the API's anyway.

**Instagram: API publish is immediate and irreversible.** There is no draft
endpoint and no scheduling endpoint. `POST /media` then `POST /media_publish`
goes live the moment it is called. The API also cannot attach trending audio,
which is a real reach cost on Reels, so manual posting is often the better
product here too.

The consequence for metadata: generate it as **text a human will paste**, not
as an API payload. Plain text, correct field by field, no JSON wrapper unless
something is actually going to POST it.
