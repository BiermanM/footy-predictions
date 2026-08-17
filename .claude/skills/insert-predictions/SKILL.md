---
name: insert-predictions
description: Insert this week's predicted results for the next matchday into a footy-predictions season file, and update README.md's "Upcoming prediction" section. Presents the fixtures as a fill-in-the-blank form so the user only has to supply their picks. Use whenever the user wants to log predictions for an upcoming Serie A matchday. Pairs with insert-results (which records odds, results, and score once the matchday is played) and populate-season-fixtures (run once per season before this).
---

# Insert predictions

Fills in one matchday's `Predicted Result` column in the season markdown
file, and replaces README.md's `### Upcoming prediction` section to match.
No betting odds here — odds are only recorded later, alongside the result,
by `insert-results`. The only thing this skill needs from the user is
their pick for each game.

## Step 1: Figure out which matchday

Find the current season file: `italian-serie-a-*.md` (highest season
suffix). The matchday to fill in is the first `## Matchday N` section
whose `Predicted Result` column is still blank — whether or not it already
has team names (from `populate-season-fixtures`) or dates.

If that section has no team names either (never scaffolded), ask the user
for that matchday's fixtures first — you'll need home/away pairs to build
the form in step 2.

## Step 2: Present the matchday as a form

Don't ask the user to hand you JSON or a pasted table. Pull the fixtures
straight out of the season file and present them back as a numbered
fill-in-the-blank list, one line per game, so the user only has to type
their pick against each. For example:

```
Matchday 5 — reply with 1 (home win), X (draw), or 2 (away win) for each:

1. Torino vs Sassuolo:
2. Cagliari vs Udinese:
3. Lazio vs Inter:
4. Lecce vs Juventus:
5. Verona vs Como:
6. Cremonese vs Pisa:
7. Fiorentina vs Genoa:
8. Parma vs AS Roma:
9. AC Milan vs Atalanta:
10. Napoli vs Bologna:

Date(s) for this matchday:
```

Wait for their reply (a single message filling in the blanks is fine —
parse `1`/`X`/`2` per line loosely, e.g. "1" / "home" / "draw" / "away" all
map cleanly). If anything's ambiguous or missing, ask a quick follow-up
rather than guessing a pick.

## Step 3: Build the input JSON and run the script

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 38,
  "date": "5/24/26",
  "games": [
    { "home": "Fiorentina", "away": "Atalanta", "predicted": "2" }
  ]
}
```

(`games` needs all 10 entries, no `odds` field.) Run from the repo root:

```
node .claude/skills/insert-predictions/scripts/insert-predictions.mjs <input.json>
```

Then format both touched files:

```
npx prettier --write README.md italian-serie-a-*.md
```

The script replaces that matchday's section in the season file (team names
+ predictions filled in, `Betting Odds`/`Official Result`/`Correct
Prediction?` columns left blank, headers still `? / 10` / `?% return`) and
replaces or inserts README's `### Upcoming prediction` section.

## Step 4: Verify and commit

`git diff` both files, confirm the picks match what the user gave you,
then show them a short summary before committing. Commit message
convention (see `git log`): usually part of a combined weekly commit like
`Added matchday 37 results + matchday 38 predictions` if `insert-results`
just ran too for the prior matchday, or standalone `Added matchday 1
predictions` for a season opener. Only push if asked.
