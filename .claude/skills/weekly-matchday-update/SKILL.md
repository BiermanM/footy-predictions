---
name: weekly-matchday-update
description: Insert this week's matchday results and next matchday's predictions into a footy-predictions season file and README.md, following this repo's established commit pattern (e.g. "Added matchday 37 results + matchday 38 predictions"). Use whenever the user wants to record match results, log predictions for an upcoming matchday, or otherwise do the weekly footy-predictions data entry. Also covers starting a brand-new season file and closing out a finished season.
---

# Weekly matchday update

This repo (`footy-predictions`) gets one commit per week that does two things
at once: fills in results for the matchday that just finished, and adds
predictions + odds for the next matchday. Every commit in `git log` follows
this shape. This skill automates the file edits so you only have to supply
the raw data (results and next week's picks) — no manual markdown table
editing or by-hand percentage math.

A Node script (`scripts/weekly-update.mjs`) does the actual editing from a
JSON description you build, then `prettier --write` re-aligns the markdown
tables to match the repo's existing style exactly (verified byte-for-byte
against real past commits). Never hand-edit the tables yourself — always go
through the script.

## Step 1: Figure out what's needed

1. Find the current season file: `italian-serie-a-*.md`, pick the one with
   the highest season suffix.
2. Read it and find the **first** `## Matchday N` section whose accuracy
   line still reads `? / 10 correct predictions` **and** whose table already
   has 10 rows filled in (home/away/predicted/odds present, but no official
   result). That's the matchday to close out — call it `N`.
3. The section for `N + 1` should exist as an empty placeholder (header +
   empty table, accuracy still `?`). That's where next week's predictions
   go — unless `N` is the season's last matchday (typically 38), in which
   case there's no `N+1` and you're closing out the season instead (see
   "Season end" below).
4. If instead the *whole file* is empty placeholders (season just created,
   nothing filled at all), you're doing the very first matchday of a season
   — see "New season" below.

Read `README.md` too — its `### Upcoming prediction` section currently
shows matchday `N`'s predictions (no odds), and `### Previous Matchday
Results` still shows matchday `N-1`'s completed table. Both get replaced.

## Step 2: Gather the data

Ask the user for (or take from what they paste):

- **Results for matchday N**: for each of the 10 games, the official
  result (`1`/`X`/`2`) and the *closing* betting odds as three American
  odds (home/draw/away). The user typically pastes this from
  [OddsPortal](https://www.oddsportal.com/football/italy/serie-a/results).
  You do **not** need the predicted result from the user — read it out of
  the existing `## Matchday N` section in the season file (it was recorded
  last week) and match games by home/away team name.
- **Predictions for matchday N+1**: for each of the 10 fixtures, home
  team, away team, your predicted result, and the three American odds. Plus
  the matchday date — a single date (`5/24/26`) if all games are one day,
  or a range (`5/1/26 - 5/4/26`) if they span the weekend.

American odds are plain signed integers (e.g. `-150`, `+300`), not strings
with `%` or decimal odds. If the user gives decimal/fractional odds,
convert to American odds first.

## Step 3: Build the input JSON and run the script

Write a JSON file (e.g. to your scratch directory) matching this shape and
run:

```
node .claude/skills/weekly-matchday-update/scripts/weekly-update.mjs <input.json>
```

**Always run this from the repo root** — paths in the JSON are resolved
relative to the current directory.

### Normal weekly update

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "action": "weekly",
  "completed": {
    "number": 37,
    "games": [
      { "home": "Pisa", "away": "Napoli", "predicted": "2", "result": "2", "odds": [750, 350, -227] }
    ]
  },
  "next": {
    "number": 38,
    "date": "5/24/26",
    "games": [
      { "home": "Fiorentina", "away": "Atalanta", "predicted": "2", "odds": [179, 260, 145] }
    ]
  }
}
```

(`games` arrays need all 10 entries — truncated above for brevity.) The
script looks up each `completed` section by matchday number in the season
file, requires that section to already exist with the same home/away pairs,
fills in odds/result/correctness, computes accuracy and betting return, and
does the same lookup-and-fill for `next` (predictions only, no results
yet). It then rewrites the `### Upcoming prediction` and `### Previous
Matchday Results` sections of README.md to match.

If you only have one side ready (e.g. results but the next matchday's
fixtures/odds aren't set yet), omit `next` (or `completed`) — the script
handles either alone.

### Season end (matchday 38 has no next matchday)

Add `"action": "season-end"` and a `"seasonLabel"` (e.g. `"2025-2026"`),
and drop `next` entirely:

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "action": "season-end",
  "seasonLabel": "2025-2026",
  "completed": { "number": 38, "games": [ /* ... */ ] }
}
```

This fills in the final matchday, then rebuilds README.md: replaces
`### Upcoming prediction` / `### Previous Matchday Results` with a full
`### Previous Season (2025-2026) Results` table (per-matchday accuracy %
and betting return %, computed from every matchday section in the season
file, plus a `**Total**` row that's the simple average across all
matchdays). It also demotes whatever the current `### Previous Season (X)
Results` heading is to `### X Season Results` (older seasons drop the
"Previous" label — verified against how this repo already handles that
transition).

### New season (season file doesn't exist yet)

```json
{
  "seasonFile": "italian-serie-a-26-27.md",
  "action": "new-season",
  "newSeason": { "title": "Italian Serie A 2026/27 Season Predictions", "totalMatchdays": 38 },
  "next": { "number": 1, "date": "8/22/26 - 8/24/26", "games": [ /* ... */ ] }
}
```

This creates the season file from scratch with all `totalMatchdays` empty
`## Matchday N` placeholder sections, fills in matchday 1 with the given
fixtures/predictions/odds, and inserts a new `### Upcoming prediction`
section at the top of README.md (above whatever season-summary section is
currently there). Confirm the season file name and title with the user
first — filenames so far follow `italian-serie-a-{YY}-{YY+1}.md`.

## Step 4: Format and verify

After running the script, format both touched files with Prettier (the
script does not do this itself):

```
npx prettier --write README.md italian-serie-a-*.md
```

Then `git diff` both files and read through it: confirm accuracy counts,
the betting-return percentage, which odds got bolded (only on ✅ rows, at
the predicted/actual outcome), and that team names weren't typo'd. Show the
user a short summary (accuracy, return %, next matchday date) before
committing.

## Step 5: Commit

Follow the exact naming convention from `git log` — e.g. `Added matchday 37
results + matchday 38 predictions`, `Added matchday 38 results +
end-of-season summary`, `Added matchday 1 predictions` for a season
opener. Only commit/push if the user confirms the diff looks right, and
only push if they've asked you to.

## Notes on the scoring math (for sanity-checking, already implemented in the script)

- Accuracy: correct picks out of 10.
- Betting return: $1 wager per game across all 10 games. Losing picks pay
  $0. Winning picks pay `odds/100 + 1` for positive American odds, or
  `100/|odds| + 1` for negative. Return % = `(total payout - 10) / 10 *
  100`, rounded to 1 decimal for a single matchday, 2 decimals for a
  season-total average.
- Bolding: only the winning pick's odds get `**bold**`, and only when the
  prediction was correct — never bold the actual outcome's odds on a ❌ row.
