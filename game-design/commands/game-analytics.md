---
description: View performance metrics and analytics for deployed games
argument-hint: <game-slug> [--period <7d|30d|90d|all>] [--compare <other-game>]
---

# Game Analytics

View performance metrics, player engagement, and leaderboard statistics for deployed games.

**Arguments**: $ARGUMENTS

## Overview

Analyze game performance to:
- Track player engagement over time
- Identify top-performing games
- Compare game performance
- Monitor leaderboard health
- Inform design decisions

## Command Options

```
/game-analytics <game-slug> [options]

Arguments:
  <game-slug>              Game to analyze (or "all" for overview)

Options:
  --period <period>        Time period: 7d, 30d, 90d, all (default: 30d)
  --compare <game>         Compare with another game
  --export <format>        Export data: csv, json, md
  --leaderboard            Focus on leaderboard stats
  --engagement             Focus on engagement metrics
  --retention              Focus on retention analysis
```

## Usage Examples

### Single Game Analytics
```bash
/game-analytics emoji-match
```

### Compare Two Games
```bash
/game-analytics word-stack --compare emoji-match
```

### All Games Overview
```bash
/game-analytics all --period 7d
```

### Export Data
```bash
/game-analytics puzzle-rush --export csv
```

---

## Workflow

### Step 1: Gather Data Sources

```yaml
Data Sources:
  - Firebase Analytics (if configured)
  - Leaderboard API (scores, players)
  - GitHub Issues (bug reports)
  - Workflow history (release dates)

Fallback (if no analytics):
  - Leaderboard data only
  - Estimate metrics from available data
```

### Step 2: Query Metrics

```yaml
Leaderboard Metrics:
  - Total scores submitted
  - Unique players
  - Score distribution
  - Top scores
  - Recent activity

Engagement Metrics (if available):
  - Sessions
  - Session duration
  - Bounce rate
  - Return rate

Retention Metrics (if available):
  - Day 1 retention
  - Day 7 retention
  - Day 30 retention
```

### Step 3: Generate Report

---

## Output Format

### Single Game Report

```
## Game Analytics: Emoji Match

**Period**: Last 30 days (Feb 18 - Mar 18, 2026)
**Released**: Mar 11, 2026 (7 days ago)

---

### Summary

| Metric | Value | Trend |
|--------|-------|-------|
| Total Plays | 1,247 | +23% |
| Unique Players | 342 | +18% |
| Avg Score | 2,450 | +5% |
| High Score | 12,890 | — |
| Avg Session | 4m 32s | +12% |

---

### Leaderboard Stats

**Total Entries**: 1,247
**Unique Players**: 342
**Entries Today**: 89

#### Score Distribution
```
0-1000:     ████████████████ 32%
1001-3000:  ████████████████████████ 48%
3001-5000:  ████████ 15%
5001+:      ███ 5%
```

#### Top 10 Scores
| Rank | Player | Score | Date |
|------|--------|-------|------|
| 1 | Player_A | 12,890 | Mar 17 |
| 2 | Player_B | 11,450 | Mar 16 |
| 3 | Player_C | 10,200 | Mar 18 |
| ... | ... | ... | ... |

---

### Daily Activity

```
Mar 12: ██████████████████████ 142
Mar 13: ████████████████████████████ 178
Mar 14: █████████████████████████ 156
Mar 15: ███████████████████████████████ 198
Mar 16: ████████████████████████████████████ 234
Mar 17: █████████████████████████████ 189
Mar 18: ██████████████ 89 (partial)
```

**Peak Day**: Mar 16 (234 plays)
**Average**: 169 plays/day

---

### Engagement Insights

- **Most Active Time**: 7-9 PM local
- **Session Pattern**: 2-3 games per session average
- **Return Rate**: 34% players return within 7 days

---

### Quality Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Open Bugs | 2 | MEDIUM |
| Recent Crashes | 0 | GOOD |
| User Reports | 1 | LOW |
| Audit Score | 24/30 | GOOD |

---

### Recommendations

1. **Engagement**: Consider adding daily challenges to increase return rate
2. **Difficulty**: Score distribution suggests good difficulty curve
3. **Retention**: Day 7 retention (34%) is healthy for casual game

---

### Quick Actions

- Run full audit: `/game-audit emoji-match`
- View workflow: `/workflow-status 2026-03-11-143022`
- Compare: `/game-analytics emoji-match --compare word-stack`
```

### Comparison Report

```
## Game Comparison: Word Stack vs Emoji Match

**Period**: Last 30 days

---

### Head-to-Head

| Metric | Word Stack | Emoji Match | Winner |
|--------|------------|-------------|--------|
| Total Plays | 2,156 | 1,247 | Word Stack |
| Unique Players | 567 | 342 | Word Stack |
| Avg Score | 3,200 | 2,450 | Word Stack |
| Avg Session | 6m 12s | 4m 32s | Word Stack |
| Return Rate | 42% | 34% | Word Stack |
| Bug Count | 4 | 2 | Emoji Match |

**Overall**: Word Stack outperforms on engagement metrics.

---

### Daily Comparison

```
         Word Stack    Emoji Match
Mar 12:  ████████████  ██████████
Mar 13:  ██████████████  ████████████
Mar 14:  █████████████  ██████████
Mar 15:  ████████████████  ███████████████
Mar 16:  ██████████████████  █████████████████
Mar 17:  ███████████████  ██████████████
```

---

### Insights

1. **Word Stack** has 45% higher engagement
   - Likely due to longer release time (established player base)
   - Word games have higher replay value

2. **Emoji Match** has fewer bugs
   - Newer release with improved QA process
   - Simpler mechanics = fewer edge cases

3. **Session Length** difference (6m vs 4m)
   - Word Stack's puzzle nature encourages longer play
   - Consider adding complexity to Emoji Match

---

### Recommendation

For next week's release, consider:
- Word puzzle mechanics (high engagement)
- Visual style of Emoji Match (lower bug rate)
- Target 5+ minute session length
```

### All Games Overview

```
## Games Overview

**Period**: Last 7 days
**Total Games**: 8

---

### Performance Ranking

| Rank | Game | Plays | Players | Trend |
|------|------|-------|---------|-------|
| 1 | Word Stack | 1,523 | 412 | +12% |
| 2 | Emoji Match | 1,089 | 298 | +45% |
| 3 | Puzzle Rush | 876 | 234 | -3% |
| 4 | Tetris Clone | 654 | 189 | +2% |
| 5 | Number Crunch | 543 | 156 | -8% |
| 6 | Color Match | 432 | 123 | +1% |
| 7 | Memory Cards | 321 | 98 | -12% |
| 8 | Snake Redux | 234 | 67 | -5% |

---

### Total Platform Stats

| Metric | Value |
|--------|-------|
| Total Plays | 5,672 |
| Unique Players | 1,234 |
| New Players | 156 |
| Returning Players | 1,078 |

---

### Trending

**Rising**: Emoji Match (+45% week over week)
**Falling**: Memory Cards (-12% week over week)

---

### Health Summary

| Status | Count | Games |
|--------|-------|-------|
| Healthy | 5 | Word Stack, Emoji Match, Tetris, Color Match, Snake |
| Needs Attention | 2 | Puzzle Rush, Number Crunch |
| Critical | 1 | Memory Cards |

---

### Recommendations

1. **Memory Cards** needs investigation - significant decline
2. **Emoji Match** momentum - consider social features
3. **Puzzle Rush** stable but not growing - refresh needed
```

---

## Data Export

### CSV Format (--export csv)

```csv
date,game,plays,unique_players,avg_score,high_score,avg_session_seconds
2026-03-18,emoji-match,89,45,2380,8900,272
2026-03-17,emoji-match,189,78,2420,12890,285
2026-03-16,emoji-match,234,92,2510,11450,290
```

### JSON Format (--export json)

```json
{
  "game": "emoji-match",
  "period": {
    "start": "2026-02-18",
    "end": "2026-03-18"
  },
  "summary": {
    "totalPlays": 1247,
    "uniquePlayers": 342,
    "avgScore": 2450,
    "highScore": 12890,
    "avgSessionSeconds": 272
  },
  "daily": [
    {
      "date": "2026-03-18",
      "plays": 89,
      "uniquePlayers": 45,
      "avgScore": 2380
    }
  ],
  "leaderboard": {
    "top10": [...]
  }
}
```

---

## Notes

- Analytics require leaderboard data at minimum
- Full analytics need Firebase/analytics integration
- Historical data preserved in workflow states
- Compare mode works best with similar game genres
- Export for spreadsheet analysis or reporting
