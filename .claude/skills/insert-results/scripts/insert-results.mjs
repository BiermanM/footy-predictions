#!/usr/bin/env node
// Fills in official results + closing odds for one already-predicted
// matchday, computes accuracy/betting-return, and updates README.md's
// "Previous Matchday Results" section (or, if this is the season's final
// matchday, rebuilds README's season-summary section instead).
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
  lookupExisting,
  buildChunk,
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
  const idx = findSection(sections, input.matchday);
  const existingRows = sections[idx].rows;

  const games = input.games.map((g) => {
    const existing = lookupExisting(existingRows, g.home, g.away);
    return { home: g.home, away: g.away, predicted: existing[2], result: g.result, odds: g.odds };
  });

  const { rows, accuracyText, bettingText } = computeCompletedGames(games);
  sections[idx].text = buildChunk(input.matchday, accuracyText, bettingText, rows);
  writeSeasonFile(seasonPath, preamble, sections);

  const readmePath = path.join(REPO_ROOT, "README.md");
  let content = fs.readFileSync(readmePath, "utf8");

  if (input.seasonEnd) {
    if (!input.seasonLabel) {
      throw new Error('seasonEnd requires a "seasonLabel", e.g. "2026-2027"');
    }
    content = content.replace(/### Previous Season \(([^)]+)\) Results/, "### $1 Season Results");
    content = removeReadmeSection(content, "Upcoming prediction");
    content = removeReadmeSection(content, "Previous Matchday Results");

    const summaries = extractAllMatchdaySummaries(seasonPath);
    const summaryRows = summaries.map((m) => [
      String(m.number),
      `${m.accuracyPct}%`,
      formatPercent(m.returnPct),
    ]);
    const avgAcc = summaries.reduce((s, m) => s + m.accuracyPct, 0) / summaries.length;
    const avgRet = summaries.reduce((s, m) => s + m.returnPct, 0) / summaries.length;
    summaryRows.push([
      "**Total**",
      `**${formatPercent2(avgAcc, false)}**`,
      `**${formatPercent2(avgRet)}**`,
    ]);
    const table = rawTable(["Matchday", "Accuracy", "Betting Return"], summaryRows);
    const block = `### Previous Season (${input.seasonLabel}) Results\n\n${table}\n\n`;
    content = content.replace(/^# Footy Predictions\n\n/, `# Footy Predictions\n\n${block}`);
  } else {
    const table = rawTable(FULL_HEADERS, rows);
    const block = `### Previous Matchday Results\n\n${table}\n\n`;
    content = upsertReadmeSection(content, "Previous Matchday Results", block, "Upcoming prediction");
  }

  fs.writeFileSync(readmePath, content);
  console.log(`Inserted results for Matchday ${input.matchday} into ${input.seasonFile} and README.md.`);
}

main();
