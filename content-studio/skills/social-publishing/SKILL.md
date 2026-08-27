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

## Platform posts and game posts are written differently

The voice rules above assume a clip of one game, because most posts are. A launch,
a milestone or anything about the site itself is the other kind, and rule 1 -
describe what happened in *this* clip - inverts: there is no single run to describe,
and a caption about one game undersells a video that is about all of them.

For a platform post the searchable subject is the product, so the title leads with
the category query (`Free browser games - no download, new game every week`), the
description's first line is the About page's promise, and the caption names the
cadence rather than a score. Do not name a single game in the hook of a platform
post; naming one tells the viewer the video is about that game.

This carries into the thumbnail, which has its own contract - `fan` layout, no
directional cue, a hand-cast set of games that look different. See "A platform
video is not a game video" in `thumbnail-design`. Metadata and thumbnail have to
agree on which kind of post this is, or the click and the video disagree.

## Every publish is three posts from two cuts

Standing rule, not a per-video choice. A render produces two files and they go to
three places:

| # | post | file | metadata |
| --- | --- | --- | --- |
| 1 | YouTube long-form | the 16:9 cut | `youtube/METADATA.txt` |
| 2 | Instagram Reel | the 9:16 cut | `instagram/CAPTION.txt` |
| 3 | YouTube Short | **the same 9:16 cut** | `shorts/METADATA.txt` |

The third post is the one that gets forgotten, and it is the cheapest reach in the
set: the file already exists, the render is already paid for, and Shorts and long-form
are separate surfaces on YouTube, so a Short does not take views from the long-form
video. Skipping it throws away a whole distribution channel to save a five-minute
upload. Build `shorts/` in the bundle every time.

**Same pixels, different metadata.** Do not paste the long-form title onto the Short.
Two videos on one channel carrying the same title read as a duplicate on the channel
page and compete for the same query, so the Short takes a different phrasing of the
same intent - the long-form leads with the category, the Short can lead first-person
or with the number. Its description is shorter, it does not carry chapters, and it carries two or three
topical hashtags in the title - mandatory, see the YouTube Shorts section.

**A 9:16 upload under three minutes becomes a Short automatically.** There is no
setting to tick and no way to make it long-form, which is also why the 16:9 cut must
stay landscape: only public long-form videos are eligible for Test & Compare, so a
channel that publishes only vertical video cannot test thumbnails at all. That is the
real reason both aspect ratios exist rather than one being a crop of the other.

**Check the vertical cut against Shorts furniture, not Instagram's.** They occlude
differently and the difference decides whether the file can ship as-is. Shorts puts a
title and channel block over the bottom sixth on the left and an action rail down the
right eighth from about half height; Instagram Stories put full-width bands over the
top and bottom eighth. An edge-composed cut usually clears the Shorts layout unchanged
while needing an inset for Stories, so the Short takes the file untouched and the story
opener does not.

**Thumbnails barely apply.** The Shorts feed plays the video and shows no thumbnail at
all; a still only appears on the channel's Shorts tab, in search and in subscriptions.
YouTube picks a frame by default and custom upload for Shorts is not dependable across
clients, so ship the Reels cover in `shorts/` as an optional file and use it if the
option appears. Do not spend thumbnail effort here that the long-form test would use
better.

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
anyway.

**Always put two or three topical hashtags in the Short's title.** Not optional and
not a stylistic choice - a hashtag in a YouTube title renders as a clickable link into
that hashtag's feed, which is a second discovery surface the description cannot reach,
and it costs nothing but characters. A Shorts title with no hashtag is leaving a free
channel on the table, so treat a bare title as a defect and fix it before upload.

```
Two saves in fourteen seconds - Neon Beats #rhythmgame #browsergames #shorts
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^
                                           clickable, and the reason this rule exists
```

Rules that make it work rather than backfire:

- **Two or three, never more.** They are part of the 100-character title, and the
  title still has to read as a sentence to a human. Three short ones fit; five turn
  the title into a tag dump and get truncated in search at ~60 chars anyway.
- **Pick the genre and the platform words, not the game name.** `#rhythmgame`
  `#browsergames` `#puzzlegame` are queries people actually browse. `#neonbeats` has
  no feed worth entering yet, so it belongs in the description set, not the title.
- **Count the whole video, not the title.** Over **15 hashtags across title plus
  description together and YouTube ignores every hashtag on the video** - not just the
  excess. Our description set runs 7-9, so the title's share is capped at 3 in practice.
- **`#shorts` in the title is still banned.** A 9:16 upload under three minutes is
  classified as a Short automatically; the tag adds nothing, and it is the one hashtag
  that reads as filler to a human. The example above shows the failure, not the target.
- **Same words, different order, per surface.** The long-form title takes hashtags too,
  but do not paste the Short's title onto it - see "Same pixels, different metadata".

Description:

```
{one line of commentary about what happened in the clip}

Play {Game Name} free, no signup: weeklyarcade.games/games/{slug}
A brand-new browser game every week.

#{genre} #browsergames #indiegames #{gamename}
```

For a platform Short - the same vertical cut as the Reel, so a platform post by
definition - the patterns above all describe a single run and none of them apply.
Lead on the category query or the count instead, and take a different phrasing from
the long-form title of the same cut:

| Pattern | Example |
| --- | --- |
| The category | `Free browser games, no download - new one every week` |
| The count | `24 free browser games you can play right now` |
| First person | `I build a new browser game every week - all free` |

First person earns its place here and nowhere else: Shorts reward a person over a
product, and it is the one line in the set that a viewer can follow rather than
bookmark. Keep the URL in the description on its own line - Shorts descriptions are
collapsed by default, so a link buried mid-paragraph is never seen.

## YouTube long-form

Compilations. Title states what the collection is, not how good it is:
`Every big clear from Duneburst this month`, not `INSANE Duneburst moments!!`.

Description leads with the same one-line promise the About page opens with -
`A brand-new original browser game every week. Free, instant, no signup, no
ads.` - then a timestamped chapter list, then the site link. Chapters need
`0:00` as the first stamp or YouTube ignores all of them.

## Every title and description is written for search

Standing rule, not a per-video choice: **the title and description exist to be
found, then to be clicked** - in that order. A channel with no subscribers gets no
recommendations, so search and suggested are the only surfaces available, and a
clever title that nobody queries is invisible on both.

How that cashes out:

- **Lead the title with what a person types.** `Free Browser Games - No Download,
  No Signup, New Game Every Week` beats `Welcome to Weekly Arcade`. The keyword
  goes in the first 60 characters, because that is what survives truncation in
  search results, and the promise goes after it.
- **Front-load the description too.** The first two or three lines are all that
  shows above "...more" and they are weighted most; put the phrase someone would
  search in the first sentence, not in paragraph four.
- **Name the genres the catalogue actually has**, from `GAME_REGISTRY` - puzzle,
  idle, racing, arcade, tower defence, whatever is really there. Genre words are
  the queries; a generic "fun games" line matches nothing. Read the registry, do
  not guess, and do not list a genre the site does not have.
- **Tags are worth little and cost nothing** - 10-15 of them, well under the
  500-character cap, no repetition of the title verbatim.
- **Never keyword-stuff.** Repeating a phrase five times is the one SEO move that
  is actively penalised, and it reads as spam to the humans who do arrive.
- This applies to Shorts and Reels captions as well. The searchable words go
  first; the hashtags stay at 4-6 and do the work tags do on long-form.

The one exception is a hardcoded number, which is a title-writing question rather
than an SEO one - see the caution at the end of `thumbnail-design`. `24 free games`
is a strong query and a lie in three weeks; date the video or drop the number.

## Limits worth knowing

| Field | Limit | Practical |
| --- | --- | --- |
| IG caption | 2,200 chars | first 125 visible |
| IG hashtags | 30 max | use 4-6; 30 reads as spam |
| IG Reels via API | 90s | our clips are 12-30s |
| YT title | 100 chars | ~60 before truncation in search |
| YT description | 5,000 chars | first 2-3 lines visible |
| YT tags | 500 chars total | low ranking value, keep short |
| YT hashtags | 15 per video | title + description **combined**; over 15 and YouTube ignores ALL of them |
| YT title hashtags | count toward the 100 | 2-3 topical ones are mandatory on a Short |
| YT Shorts | 3 min, vertical | must be 9:16 to be treated as a Short, automatically |
| YT Shorts thumb | n/a in feed | still shows in search and the Shorts tab only |
| IG Story | 24h, then gone | the Highlight is the deliverable, not the story |

## How publishing actually works

This is the part that shapes the metadata's output format, so it is not
optional context.

**YouTube: the API works.** Measured on 2026-08-18 against project
`wa-publisher`, which has passed no compliance audit: `videos.insert` uploaded
6.9MB, honoured `privacyStatus: unlisted` instead of forcing private, accepted a
custom thumbnail via `thumbnails.set`, and processed clean with no
`rejectionReason`. The widely-repeated rule that an unaudited project's uploads
are locked private did not hold. Do not plan around that rule; test it.

Confirmed again on 2026-08-19 at the setting that actually matters: the launch
Short went up with `privacyStatus: public` and came back public, processed, with no
`rejectionReason`, and `thumbnails.set` took a custom image on a Short. So the
finding is not limited to `unlisted` - a public API upload works, and a Short is
fully publishable this way. `/shorts/<id>` serving 200 rather than redirecting to
`/watch` is the cheap way to confirm YouTube filed a vertical upload as a Short.

Use `lib/youtube_upload.py`, which needs a Desktop OAuth client of its own -
gcloud's application-default client is blocklisted for `youtube.upload` and ends
at "This app is blocked". Put that client in its OWN project, never the one the
site's Google login lives in: the consent screen is per project, so adding a
sensitive scope there drags the production login app into needing verification
for it, and a Production app cannot have test users.

Still write the bundle anyway. A human picks the title from the options, and
Test & Compare has no API at all, so the second and third thumbnails go in by
hand regardless.

**Instagram: the API works, and it is immediate and irreversible.** Verified
2026-08-19 - the launch Reel published to `@weeklyarcade.games` as
`media_product_type: REELS` via `lib/instagram_publish.py`, caption intact. There
is no draft endpoint, no scheduling endpoint and no un-publish: `POST /media` then
`POST /media_publish` goes live the moment it is called.

The one thing it cannot do is attach trending audio. That is a real reach cost on
a clip with no audio of its own - but it is *not* a cost on a cut that already
carries VO and a music mix, where a trending track would only fight the mix. So
the rule is: **original audio, publish by API; silent or music-only clip where
trending audio would carry it, post by hand.**

The consequence for metadata: still generate it as **text a human will paste**,
because a human picks the title and Test & Compare has no API. But ship the
Instagram caption twice - once inside the readable `CAPTION.txt` and once as a
bare `caption-payload.txt` holding nothing but the caption. `CAPTION.txt` has
COVER / AUDIO / SHARE TO FEED sections and posting it verbatim would put those
lines on the grid, so `--publish` refuses any file with bundle-style headers.

### What the audit is actually still for

Quota and token lifetime, not visibility. The daily quota is per **project**:
10,000 units, and `videos.insert` costs ~1,600, so roughly six uploads a day
however many accounts share the client. And a consent screen left in Testing
issues refresh tokens that die after **7 days** - fine for a one-off, useless
for a weekly cadence, so the screen has to reach Production before anything
depends on it. Production needs the App domain links live
(`weeklyarcade.games/privacy` and `/terms` both exist and return 200) plus the
domain verified in Search Console.

A third-party scheduler - Buffer, Metricool, Later, Publer - remains the
alternative if you would rather not maintain any of that. But its Instagram
publishing goes through the same Graph API we would have used, so it **still
cannot attach trending audio**.

### The Instagram API route, if you take it

`lib/instagram_publish.py` does the whole flow, but the setup has three separate
gates and each one fails in a way that looks like a different problem. Measured
2026-08-18 against the app `Weekly Arcade Post Publisher` (`1046697814761249`).

**1. A numeric IG user id, not the handle.** The lookup is `me/accounts` ->
`instagram_business_account`, and the scope that matters is not the one the docs
lead with. Measured across three tokens on 2026-08-18/19, same Facebook user,
same app:

| Token scopes | `me/accounts` returned |
| --- | --- |
| `instagram_basic`, `instagram_content_publish` | `{"data": []}` |
| `+ pages_show_list` | one unrelated Page, `@codecheflpu` |
| `+ business_management`, `+ pages_read_engagement` | `"Weekly Arcade Browser Games"` -> `@weeklyarcade.games` |

The target Page existed the whole time. It is **owned by a Business portfolio**,
and a business-owned Page does not appear on `me/accounts` for
`pages_show_list` alone - so the middle row looks exactly like "Weekly Arcade has
no Page", while listing somebody else's personally-administered Page to make the
illusion convincing. Ask for all four scopes at once. (Two were added together
here, so which of `business_management` and `pages_read_engagement` unlocked it is
unproven - not worth another token to find out.)

There is a second edge, `me/businesses` -> `owned_instagram_accounts`, for
Instagram accounts attached to a portfolio with no Page at all. `--discover` tries
it too and prints why it failed. On this account it answers `Object with ID ... does
not exist, cannot be loaded due to missing permissions, or does not support this
operation` even with `business_management`, so do not count on it; the Page route
is the one that works here.

The lesson that generalises: **an empty or wrong `me/accounts` tells you nothing
about the account.** It is consistent with a missing scope, an unlinked account, a
business-owned Page, or the wrong edge entirely. Read the granted scopes and try
the other edge before concluding anything - and never conclude it from one token.

**Discovery can hand you a working account that is the wrong one.** Measured
2026-08-19: the first token carrying `pages_show_list` resolved to Page "CodeChef
LPU Chapter" -> `@codecheflpu`, a real, publishable, entirely unrelated account,
and the tool saved it without complaint. `media_publish` has no un-publish, so
that is one `--confirm` away from a launch Reel on a stranger's grid. The tool now
treats `instagram.handle` in credentials.json as **configuration, not a discovery
result**: it is the intended target, discovery is checked against it and never
overwrites it, and `--publish` re-resolves the stored id and aborts on a mismatch
rather than trusting what is on disk. Override only via `--force-account`, and
only after changing `handle` on purpose.

**2. Public HTTPS URLs.** There is no file upload on this API. `video_url` and
`cover_url` are fetched by Instagram's own servers, so a local path or a
localhost tunnel cannot work. Cloud Storage is the obvious host and is **not
available**: the `weekly-arcade` GCP project has no billing account, so
`buckets.create` answers `403 billing account ... disabled in state absent`.
The tool therefore stages onto a **Firebase Hosting preview channel**
(`ig-stage`, `--expires 1d`), which costs nothing on the free plan, returns a
real `*.web.app` HTTPS URL, and expires by itself. Verified 2026-08-18: the
channel served the 6.0MB mp4 as `video/mp4` and the cover as `image/jpeg` at
exact byte counts.

A channel, never a path on the live site. The live site is the product, and a
launch video parked in its public directory would ship with every later deploy of
anything else. The channel carries these two files and nothing else, and is torn
down in a `finally` block so a crash mid-publish still cleans up.

**3. A token that outlives the job.** Graph API Explorer issues ~1-2 hour user
tokens and container transcoding takes minutes, so a token minted before lunch
can expire mid-poll. `--exchange APP_ID APP_SECRET` swaps it for 60 days.
`--status` prints the hours remaining and says outright when it is too short.

Publishing is two calls - `POST /media` builds a container, `POST /media_publish`
puts it on the grid - and the second one is irreversible, so `--publish` prints
the account, the caption and the file sizes and then refuses to proceed without
`--confirm`. Poll the container for `FINISHED` rather than sleeping; a container
stays valid 24h, so a poll that times out is resumable from its `creation_id`
instead of being a lost upload. The posting cap is 50 in 24h, readable from
`content_publishing_limit`.

None of this buys trending audio, which is still the reason to consider posting
by hand.

### Stories, and why they are a profile job rather than a reach job

A story reaches followers. On an account that does not have followers yet, that is
close to nobody, so the reason to make stories is the profile: post a short set once,
save it as a Highlight, and anyone arriving from a Reel or from search sees what the
place is without scrolling the grid. The Highlight is the artefact that keeps
working, which is why the cards are written undated - no launch date, no game count.

**A story collects taps, not impressions, so every slide asks for one.** This is the
part that is easy to get wrong: a set of well-made cards stating the product's claims
is a set of posters, and a poster gets tapped through. Stories have interactive
stickers and nothing else on the surface can measure interest, so the design question
is not "what should this card say" but "what is this card asking the viewer to do".

**Order the set by ascending effort.** The first slide is motion with no sticker, to
stop the tap-through. Then the cheapest tap available, then a slightly costlier one,
and the link last, because a link is the most expensive ask in the set and asking for
it first spends attention you have not earned yet.

| slide | sticker | why it is here |
| --- | --- | --- |
| 1 | none, video | motion so slide 1 is not tapped past |
| 2 | poll, 2 options | zero-effort first tap: pick one of two games |
| 3 | quiz, 4 options | teaches a number by making them guess it |
| 4 | question | turns a viewer into a contributor, and yields next week's shortlist |
| 5 | link | the conversion, last |

**Claims are better delivered as interactions than as statements.** The set this
replaced said "free", "24 games" and "every week" on three cards. The quiz now makes
the viewer guess the catalogue size, which is remembered because being wrong is
memorable, and the question sticker asks what to build next, which states the weekly
cadence by assuming it. A card that answers its own question wastes the tap.

**One link sticker, on the last slide only.** It is the only tappable link Instagram
gives outside the bio, and it must be added by hand in the app after uploading. A link
on the poll and quiz slides competes with them: taps spent leaving are taps not spent
answering.

**Not every sticker survives into the Highlight, and that changes what each slide is
worth.** Polls, quizzes and question stickers keep displaying their results but stop
accepting input once the 24 hours are up, so slides 2 to 4 become static images in the
Highlight. A link sticker stays live. So the interactive slides earn during the first
day and the link slide earns indefinitely, which is a reason to re-post the question
slide periodically rather than treat the Highlight as covering it.

**Stories are the second case for posting by hand**, and for a stronger version of the
trending-audio reason. The API will publish `media_type=STORIES` perfectly well, but it
cannot attach any sticker at all. Since the stickers are the entire point of the set,
there is nothing here worth automating. The rule generalises: when the one thing that
makes a post work is something only the app can add, the post goes up by hand, and the
tool's job is to get the files and the instructions right rather than to press publish.
`POSTING.txt` therefore carries each sticker's exact question and option text, marks
which quiz answer is correct, and says where each one goes.

**Judge them with Instagram's interface drawn on top.** The bundle ships a
`stories-with-ui.png` sheet showing the progress bar, profile row, reply bar and a mock
of each slide's actual sticker over the card, because that furniture covers the top and
bottom eighth of every story. A card that looks balanced as a flat file can still have
its last line under the reply bar - and it was exactly this sheet, not the flat files,
that caught three separate renderer defects.

**A vertical cut is not automatically a story.** A Reels cut is composed edge to edge,
and a story hides the top and bottom 13%, so reusing the cut as an opener means its
first-second hook and its end card end up behind Instagram's chrome. Inset it inside a
blurred, darkened copy of itself scaled to the safe band instead of cropping it:
nothing is lost, it still reads full-bleed, and the beats land where they can be seen.

### The bundle layout

```
upload/
  README.txt              why it is manual, and the date the count was true
  youtube/    <16x9>.mp4  3 thumbnails, METADATA.txt
  instagram/  <9x16>.mp4  1-2 covers, CAPTION.txt, caption-payload.txt
  shorts/     <9x16>.mp4  the same vertical cut, METADATA.txt, optional cover
  stories/                1 opener video, 4 sticker cards, stories-with-ui.png,
                          POSTING.txt
```

Four directories, three uploads and one manual story sitting. `shorts/` carries its
own copy of the vertical file rather than pointing at `instagram/`: whoever posts is
working through the folders in order on a phone or in a browser, and a bundle that
asks them to remember which other directory held the file is a bundle that ships two
posts instead of three.

`METADATA.txt` carries titles as a numbered pick-one list, the description
ready to paste with no edits, the tag line, which thumbnail leads and which two
go into Test & Compare, and the visibility/audience settings. `CAPTION.txt`
carries the caption exactly as it should be pasted plus the cover choice and the
trending-audio step; `caption-payload.txt` carries the same caption and nothing
else, so it can be fed to `--publish` without publishing the notes around it. Anything that needs a decision goes in these files as a
choice, never as a blank to fill in.
