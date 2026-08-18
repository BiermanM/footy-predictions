---
name: populate-season-fixtures
description: Create a brand-new footy-predictions season markdown file (e.g. italian-serie-a-26-27.md) scaffolded with all 38 matchdays' fixtures (home/away teams only — no predictions, odds, or results). Use once, at the start of a new season, before any predictions are made. Not for weekly updates — see insert-predictions and insert-results for those.
---

# Populate season fixtures

Runs once per season, before matchday 1. Takes the full season's fixture
list (which team plays which, grouped by matchday) and creates the season
markdown file with every matchday pre-scaffolded — team names filled in,
everything else (`Predicted Result`, `Betting Odds`, `Official Result`,
`Correct Prediction?`) left blank and headers reading `?`.

This means weekly updates later (`insert-predictions`, `insert-results`)
never have to type team names — they look them up from what's already in
the file.

## Step 1: Get the full fixture list

You need all ~380 fixtures (38 matchdays x 10 games for a 20-team league),
grouped by matchday, in chronological order. Ask the user how they'd like
to supply it — realistic options, roughly in order of least effort for
them:

- They paste a fixture list they already have (from the league's official
  site, Wikipedia's season article, ESPN, etc.).
- You fetch it yourself if a suitable source is reachable from this
  session (try, but don't fight network/anti-bot blocks — report and fall
  back to asking the user to paste instead).

Only some matchdays may be confirmed this early (leagues sometimes release
rounds in batches) — that's fine, `matchdays` can be a partial list and you
can re-run later to backfill the rest (see "Filling in remaining
matchdays" below).

## Step 2: Build the input JSON and run the script

```json
{
  "seasonFile": "italian-serie-a-26-27.md",
  "title": "Italian Serie A 2026/27 Season Predictions",
  "totalMatchdays": 38,
  "matchdays": [
    {
      "number": 1,
      "games": [
        { "home": "Genoa", "away": "Lecce" },
        { "home": "Sassuolo", "away": "Napoli" }
      ]
    }
  ]
}
```

Run from the repo root:

```
node .claude/skills/populate-season-fixtures/scripts/populate-fixtures.mjs <input.json>
```

Then format: `npx prettier --write italian-serie-a-26-27.md`

The script **refuses to run if the season file already exists** — it only
creates new files, never overwrites. If you need to redo it, remove the
file first and confirm with the user before doing so (it's destructive to
anything already recorded).

## Filling in remaining matchdays later

If a fixture list only had some rounds confirmed, the unlisted matchdays
are left as fully empty placeholder sections (header + empty table — same
shape as the repo's own historical season files use before that round's
data exists). There's no separate "add more fixtures" script; when the
rest of the schedule is confirmed, either:

- Have the user paste them and hand-edit those specific `## Matchday N`
  sections' team-name columns directly (the shape is simple: two columns
  filled, four left blank), or
- Ask before re-running this script, since by default it won't touch an
  existing file at all.

## Step 3: Hand off to the weekly skills

Once fixtures exist, `insert-predictions` and `insert-results` (sibling
skills) handle everything week to week — they never need this skill again
until next season.

## README.md

This skill does **not** touch README.md. The "Upcoming prediction" section
only gets added once predictions exist for a matchday — that happens in
`insert-predictions`.

## Automating the fixture list (not yet built)

Step 1 above is still manual paste (or a best-effort fetch attempt).
Investigated automating it — **football-data.org** looks like the best
free option: a well-established free tier (10 req/min, no card required)
that explicitly includes Serie A among its 12 covered competitions, with
fixtures/results endpoints. It doesn't carry odds data, so it wouldn't
help `insert-results`, but for this skill's narrower need (team names +
matchday grouping only) it looks sufficient. As with the odds research in
`insert-results/SKILL.md`, this hasn't been verified against a live
response — this repo's usual execution environment blocks essentially all
outbound HTTP, so confirm the response shape from an environment with
working network access before wiring in a fetch step here.
