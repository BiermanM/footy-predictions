---
name: insert-predictions
description: Insert this week's predicted results and betting odds for the next matchday into a footy-predictions season file, and update README.md's "Upcoming prediction" section. Use whenever the user wants to log their predictions for an upcoming Serie A matchday. Pairs with insert-results (for the matchday that just finished) and populate-season-fixtures (run once per season before this).
---

# Insert predictions

Fills in one matchday's `Predicted Result` and `Betting Odds` columns in
the season markdown file, and replaces README.md's `### Upcoming
prediction` section to match. This is the one step in the weekly cycle
that's inherently manual — the prediction itself is the user's judgment
call. Everything else (team names, formatting, math) should require no
typing from them beyond that.

## Step 1: Figure out which matchday

Find the current season file: `italian-serie-a-*.md` (highest season
suffix). The matchday to fill in is the first `## Matchday N` section
whose accuracy line still reads `? / 10 correct predictions` **and** whose
table has no `Predicted Result` filled in yet (it may have team names
already, from `populate-season-fixtures`, or be fully empty if that skill
was never run for this matchday — either is fine).

## Step 2: Get the data

Ask the user for their predictions and odds for that matchday's 10 games:
home team, away team (if not already scaffolded — reuse the exact spelling
from the file if it is, to keep `insert-results` able to match rows
later), predicted result (`1`/`X`/`2`), and the three American odds
(home/draw/away) as plain signed integers (e.g. `-150`, `+300`). If the
user gives decimal or fractional odds, convert to American odds first.

Also get the matchday's date: a single date (`5/24/26`) if all games are
one day, or a range (`5/1/26 - 5/4/26`) if they span the weekend.

## Step 3: Build the input JSON and run the script

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 38,
  "date": "5/24/26",
  "games": [
    { "home": "Fiorentina", "away": "Atalanta", "predicted": "2", "odds": [179, 260, 145] }
  ]
}
```

(`games` needs all 10 entries.) Run from the repo root:

```
node .claude/skills/insert-predictions/scripts/insert-predictions.mjs <input.json>
```

Then format both touched files:

```
npx prettier --write README.md italian-serie-a-*.md
```

The script replaces that matchday's section in the season file (keeping
its `? / 10` / `?% return` headers — no results yet) and replaces or
inserts README's `### Upcoming prediction` section.

## Step 4: Verify and commit

`git diff` both files, sanity-check team names/picks/odds against what the
user gave you, then show them a short summary before committing. Commit
message convention (see `git log`): usually part of a combined weekly
commit like `Added matchday 37 results + matchday 38 predictions` if
`insert-results` just ran too, or standalone `Added matchday 1
predictions` for a season opener. Only push if asked.
