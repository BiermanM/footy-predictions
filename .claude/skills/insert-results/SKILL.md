---
name: insert-results
description: Insert official results and closing betting odds for a finished footy-predictions matchday, computing accuracy and betting return, and update README.md (or, for the season's final matchday, rebuild README's season-summary section). Use whenever the user wants to record how a Serie A matchday actually turned out. Pairs with insert-predictions (for the matchday that was already predicted).
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

## Step 1: Figure out which matchday

Find the current season file: `italian-serie-a-*.md` (highest season
suffix). The matchday to close out is the first `## Matchday N` section
that has predictions filled in but still reads `? / 10 correct
predictions`.

Check whether `N` is the season's last matchday (its `## Matchday N+1`
section doesn't exist in the file) — if so this is a **season-end**
update; see below.

## Step 2: Get the data

Ask the user (or take from what they paste — typically copied from
[OddsPortal](https://www.oddsportal.com/football/italy/serie-a/results))
for each of the 10 games: the official result (`1`/`X`/`2`) and the
closing betting odds (home/draw/away, American odds as plain signed
integers).

You do not need the user's predicted pick — it's read from the existing
row in the season file.

## Step 3: Build the input JSON and run the script

Normal (mid-season) matchday:

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 37,
  "games": [
    { "home": "Pisa", "away": "Napoli", "result": "2", "odds": [750, 350, -227] }
  ]
}
```

Season's final matchday — add `seasonEnd` and `seasonLabel`:

```json
{
  "seasonFile": "italian-serie-a-25-26.md",
  "matchday": 38,
  "seasonEnd": true,
  "seasonLabel": "2025-2026",
  "games": [ /* ... */ ]
}
```

(`games` needs all 10 entries.) Run from the repo root:

```
node .claude/skills/insert-results/scripts/insert-results.mjs <input.json>
```

Then format both touched files:

```
npx prettier --write README.md italian-serie-a-*.md
```

- Normal case: fills the matchday section (results, bolded winning odds,
  accuracy, betting return) and replaces README's `### Previous Matchday
  Results` table (inserting it fresh, right after `### Upcoming
  prediction`, if it doesn't exist yet).
- Season-end case: same section fill, but then rebuilds README instead —
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
after for the next matchday, or `Added matchday 38 results +
end-of-season summary` for a season-end update. Only push if asked.

## Scoring math (for sanity-checking; already implemented in the script)

- Accuracy: correct picks out of 10.
- Betting return: $1 wager per game across all 10. Losing picks pay $0.
  Winning picks pay `odds/100 + 1` for positive American odds, or
  `100/|odds| + 1` for negative. Return % = `(total payout - 10) / 10 *
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
