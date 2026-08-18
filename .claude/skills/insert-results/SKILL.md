---
name: insert-results
description: Insert official results and closing betting odds for a footy-predictions matchday, computing accuracy and betting return, and update README.md (or, for the season's final matchday, rebuild README's season-summary section once it's fully resolved). Supports skipping postponed games and defaults to the latest predicted matchday. Use whenever the user wants to record how a Serie A matchday actually turned out. Pairs with insert-predictions (for the matchday that was already predicted).
---

# Insert results

Fills in a matchday's `Betting Odds` / `Official Result` / `Correct
Prediction?` columns, computes accuracy and betting return, bolds the
winning odds (only on correct picks), and updates README.md. This is the
**only** place odds get recorded — `insert-predictions` deliberately
doesn't ask for them. This only works on a matchday that already has
predictions filled in (via `insert-predictions`) — it looks up the
existing predicted pick by matching each game's home/away team name, so
you never re-type the prediction, only the outcome and odds.

## Games can be skipped (postponed matches)

`games` doesn't need to cover every fixture in the matchday — leave out
any game that hasn't been played yet (postponed, rescheduled, whatever)
and it's left untouched in the season file, still just predicted with no
result. The accuracy/betting-return headers stay `? / N correct
predictions` / `?% return` until *every* fixture in that matchday has a
result — this matches how this repo's own history already handles it
(see `git log --oneline | grep -i remaining`, e.g. "Added remaining
matchday 16 results", filed weeks after the rest of that matchday). To
fill in the leftover game(s) later, just run this skill again with the
same matchday number and only those games.

## Step 1: Figure out which matchday

Defaults to the **latest matchday with predictions recorded** — i.e. the
current week, not necessarily the oldest unresolved one (a postponed game
can leave an older matchday sitting incomplete for weeks while later ones
proceed normally). To confirm what "latest" resolves to, or to backfill an
older still-incomplete matchday, read the season file yourself and pass
`matchday` explicitly in the input JSON (see Step 3).

## Step 2: Get the data

Ask the user (or take from what they paste — typically copied from
[OddsPortal](https://www.oddsportal.com/football/italy/serie-a/results))
for each game that's actually been played: the official result
(`1`/`X`/`2`) and the closing betting odds (home/draw/away, American odds
as plain signed integers). Skip any game that hasn't been played.

You do not need the user's predicted pick — it's read from the existing
row in the season file.

## Step 3: Build the input JSON and run the script

Normal case — `matchday` omitted, defaults to latest:

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "games": [
    { "home": "Pisa", "away": "Napoli", "result": "2", "odds": [750, 350, -227] }
  ]
}
```

(`games` can be fewer than all of that matchday's fixtures — see above.)
Backfilling an older, explicitly-numbered matchday:

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 16,
  "games": [
    { "home": "Napoli", "away": "Parma", "result": "X", "odds": [-323, 412, 925] }
  ]
}
```

Season's final matchday — add `seasonEnd` and `seasonLabel` (the rebuild
only happens once every game in that matchday has a result; if some are
still pending it just does the normal partial fill and defers):

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 38,
  "seasonEnd": true,
  "seasonLabel": "2025-2026",
  "games": [ /* ... */ ]
}
```

Run from the repo root:

```
node .claude/skills/insert-results/scripts/insert-results.mjs <input.json>
```

Then format both touched files:

```
npx prettier --write README.md italian-serie-a-*.md
```

- Fills the matchday section: results, bolded winning odds, and — only
  once every fixture in it has a result — the accuracy/betting-return
  headers.
- Updates README's `### Previous Matchday Results` table, but only if
  this matchday is still the one README currently treats as current
  (`### Upcoming prediction`'s matchday number minus 1). Backfilling an
  older matchday that's since scrolled out of README only touches the
  season file — same as this repo's own history.
- Season-end case (once fully complete): rebuilds README instead —
  removes `### Upcoming prediction` and `### Previous Matchday Results`,
  builds a full `### Previous Season ({seasonLabel}) Results` table from
  every matchday's recorded accuracy/return (with a `**Total**` row = the
  simple average across all matchdays), and demotes whatever the current
  `### Previous Season (X) Results` heading is to `### X Season Results`
  (older seasons drop the "Previous" label, matching how this repo already
  handles that transition).

## Step 4: Verify and commit

`git diff` both files: check accuracy count, the return percentage, and
that bolding only appears on ✅ rows at the predicted/actual outcome.
Show the user a short summary before committing. Commit message
convention: usually part of a combined weekly commit (`Added matchday 37
results + matchday 38 predictions`) if `insert-predictions` ran right
after for the next matchday, `Added remaining matchday 16 results` for a
backfill, or `Added matchday 38 results + end-of-season summary` for a
season-end update. Only push if asked.

## Scoring math (for sanity-checking; already implemented in the script)

- Accuracy: correct picks out of however many games are in that matchday
  (10 for a full Serie A round).
- Betting return: $1 wager per game across the matchday. Losing picks pay
  $0. Winning picks pay `odds/100 + 1` for positive American odds, or
  `100/|odds| + 1` for negative. Return % = `(total payout - N) / N *
  100`, rounded to 1 decimal for a single matchday, 2 decimals for the
  season-total average.

## Automating results/odds ingestion (not yet built)

Step 2 above is still manual paste. Investigated automating it — findings:

- **api-sports.io / API-Football** is the strongest candidate: one free
  API key (100 req/day, no card required) reportedly covers fixtures,
  results, *and* pre-match odds in a single provider — the only one found
  that could realistically replace step 2 entirely. Unverified: whether
  the free tier's odds coverage/season access has quiet restrictions
  beyond the daily quota (sources conflicted). Needs a real signup +
  request to confirm before wiring anything in.
- **the-odds-api.com** is odds-only and reputable, but Serie A + American
  odds format needs a paid tier (~$29/mo) — sources disagreed on whether
  the free tier includes soccer at all.
- **football-data.org** has a solid free tier for fixtures/results but
  carries no odds data, so it can't cover the odds half on its own.
- This research couldn't be verified against live responses: this repo's
  usual execution environment blocks essentially all outbound HTTP
  (confirmed against several unrelated domains, not just odds/gambling
  sites), so no API call here could be tested end-to-end. Before writing
  an integration, get a free api-sports.io key, confirm what a real
  odds+fixtures response looks like (ideally from an environment with
  working network access), and only then add the fetch/parse step to this
  script.
