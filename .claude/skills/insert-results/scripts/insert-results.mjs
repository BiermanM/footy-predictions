#!/usr/bin/env node
// Fills in official results + closing odds for a matchday. Any fixture not
// included in `games` is left untouched (still just predicted, no result)
// — e.g. a postponed game — so a matchday can be filled in incrementally
// across multiple calls. Accuracy/betting-return headers only get computed
// once every fixture in the matchday has a result; until then the headers
// stay "?". Updates README.md's "Previous Matchday Results" section only
// if this is the numerically-latest matchday with predictions (an old
// matchday being backfilled long after the fact, matching this repo's own
// history, only touches the season file). If this is the season's final
// matchday and it just became fully complete, rebuilds README's
// season-summary section instead.
// Usage: node insert-results.mjs <input.json>   (run from repo root)
// See ../SKILL.md for the JSON schema.

import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  readInput,
  loadSeasonFile,
  writeSeasonFile,
  findSection,
  findLatestMatchdayWithPredictions,
  lookupExisting,
  buildChunk,
  formatCompletedRow,
  parseFormattedRow,
  computeCompletedGames,
  rawTable,
  FULL_HEADERS,
  upsertReadmeSection,
  removeReadmeSection,
  extractAllMatchdaySummaries,
  formatPercent,
  formatPercent2,
} from "../../footy-shared/lib.mjs";

function main() {
  const input = readInput();
  const seasonPath = path.join(REPO_ROOT, input.seasonFile);

  const { preamble, sections } = loadSeasonFile(seasonPath);
  const matchdayNum = input.matchday ?? findLatestMatchdayWithPredictions(sections);
  const idx = findSection(sections, matchdayNum);
  const existingRows = sections[idx].rows;

  if (existingRows.length === 0) {
    throw new Error(`Matchday ${matchdayNum} has no predictions recorded yet.`);
  }

  // Validate every supplied game actually matches an existing fixture
  // (catches typos early, with a clear error).
  for (const g of input.games) {
    lookupExisting(existingRows, g.home, g.away);
  }

  const keyOf = (home, away) => `${home.toLowerCase()}|${away.toLowerCase()}`;
  const inputByKey = new Map(input.games.map((g) => [keyOf(g.home, g.away), g]));

  const mergedRows = existingRows.map((row) => {
    const g = inputByKey.get(keyOf(row[0], row[1]));
    if (!g) return row; // not played yet — leave untouched
    const { row: newRow } = formatCompletedRow({
      home: row[0],
      away: row[1],
      predicted: row[2],
      result: g.result,
      odds: g.odds,
    });
    return newRow;
  });

  const allComplete = mergedRows.every((r) => r[4]);
  let accuracyText, bettingText, finalRows;

  if (allComplete) {
    const games = mergedRows.map(parseFormattedRow);
    const aggregate = computeCompletedGames(games);
    accuracyText = aggregate.accuracyText;
    bettingText = aggregate.bettingText;
    finalRows = aggregate.rows;
  } else {
    accuracyText = `? / ${mergedRows.length} correct predictions`;
    bettingText = "?% return";
    finalRows = mergedRows;
  }

  sections[idx].text = buildChunk(matchdayNum, accuracyText, bettingText, finalRows);
  writeSeasonFile(seasonPath, preamble, sections);

  const pendingCount = mergedRows.filter((r) => !r[4]).length;
  console.log(
    allComplete
      ? `Matchday ${matchdayNum}: all games resolved (${accuracyText}, ${bettingText}).`
      : `Matchday ${matchdayNum}: recorded ${input.games.length} result(s); ${pendingCount} still pending.`
  );

  const readmePath = path.join(REPO_ROOT, "README.md");
  let content = fs.readFileSync(readmePath, "utf8");
  // README's "Previous Matchday Results" should only ever show the most
  // recent week, never an old matchday being backfilled — so only update
  // it when we're resolving the numerically-latest matchday that has
  // predictions at all (an old backfill is, by definition, not that).
  const isCurrentReadmeMatchday = matchdayNum === findLatestMatchdayWithPredictions(sections);

  if (input.seasonEnd) {
    if (!allComplete) {
      console.log(
        `Matchday ${matchdayNum} still has ${pendingCount} unresolved game(s) — season-end summary deferred until complete.`
      );
      return;
    }
    if (!input.seasonLabel) {
      throw new Error('seasonEnd requires a "seasonLabel", e.g. "2026-2027"');
    }
    content = content.replace(/### Previous Season \(([^)]+)\) Results/, "### $1 Season Results");
    content = removeReadmeSection(content, "Upcoming prediction");
    content = removeReadmeSection(content, "Previous Matchday Results");

    const summaries = extractAllMatchdaySummaries(seasonPath);
    const summaryRows = summaries.map((m) => [String(m.number), `${m.accuracyPct}%`, formatPercent(m.returnPct)]);
    const avgAcc = summaries.reduce((s, m) => s + m.accuracyPct, 0) / summaries.length;
    const avgRet = summaries.reduce((s, m) => s + m.returnPct, 0) / summaries.length;
    summaryRows.push(["**Total**", `**${formatPercent2(avgAcc, false)}**`, `**${formatPercent2(avgRet)}**`]);
    const table = rawTable(["Matchday", "Accuracy", "Betting Return"], summaryRows);
    const block = `### Previous Season (${input.seasonLabel}) Results\n\n${table}\n\n`;
    content = content.replace(/^# Footy Predictions\n\n/, `# Footy Predictions\n\n${block}`);
    fs.writeFileSync(readmePath, content);
    console.log(`Rebuilt README.md's season-summary section (${input.seasonLabel}).`);
  } else if (isCurrentReadmeMatchday) {
    const table = rawTable(FULL_HEADERS, finalRows);
    const block = `### Previous Matchday Results\n\n${table}\n\n`;
    content = upsertReadmeSection(content, "Previous Matchday Results", block, "Upcoming prediction");
    fs.writeFileSync(readmePath, content);
  } else {
    console.log(
      `Matchday ${matchdayNum} is no longer README's current matchday — README left untouched.`
    );
  }
}

main();
