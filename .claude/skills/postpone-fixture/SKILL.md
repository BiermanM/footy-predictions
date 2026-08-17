---
name: postpone-fixture
description: Move a single postponed or rescheduled fixture from one matchday section to another within a footy-predictions season file. Use when a Serie A game gets pushed to a different round after the fixture list (or a prediction) was already recorded. Not for the normal weekly cycle — see insert-predictions and insert-results for that.
---

# Postpone fixture

Handles the case where a game originally scheduled for matchday N gets
moved to a different round — relocates that one fixture row from its
current `## Matchday N` section to the destination section, carrying over
a prediction if one was already made (odds are never carried, since odds
are only ever recorded at result time — see `insert-results`).

## When to use this

Only when a fixture's matchday assignment changes *before* it's been
played and results recorded. If the game has already been given an
official result, this skill refuses to move it — untangling that requires
a manual look at both matchdays' numbers, since removing a completed game
from a matchday changes its accuracy fraction and betting return.

## Step 1: Get the details

Ask the user (or confirm from what they tell you): which fixture (home
team, away team), which matchday it's currently filed under, and which
matchday it's moving to. Use the exact team-name spelling already in the
season file — check it if unsure, since matching is by name.

## Step 2: Build the input JSON and run the script

```json
{
  "seasonFile": "italian-serie-a-26-27.md",
  "home": "Napoli",
  "away": "Inter",
  "fromMatchday": 12,
  "toMatchday": 15
}
```

Run from the repo root:

```
node .claude/skills/postpone-fixture/scripts/postpone-fixture.mjs <input.json>
```

Then format: `npx prettier --write italian-serie-a-*.md`

## Step 3: Check README.md

This skill only edits the season file. If either the source or
destination matchday is the one currently shown in README's `###
Upcoming prediction` or `### Previous Matchday Results` section, that
table is now stale — re-run `insert-predictions` or `insert-results` for
that matchday (whichever applies) to refresh it, rather than hand-editing
README.

## Step 4: Verify and commit

`git diff` the season file: confirm the fixture (and its prediction, if
any) landed in the right destination section and was cleanly removed from
the source. Commit message: something like `Moved Napoli vs Inter from
matchday 12 to matchday 15 (postponed)`. Only push if asked.
