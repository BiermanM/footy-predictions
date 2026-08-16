#!/usr/bin/env node
// Fills in predictions + odds for one matchday (its fixtures are expected
// to already exist in the season file, e.g. from populate-season-fixtures,
// though this will also work against a fully empty placeholder section).
// Updates README.md's "Upcoming prediction" section to match.
// Usage: node insert-predictions.mjs <input.json>   (run from repo root)
// See ../SKILL.md for the JSON schema.

import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  readInput,
  loadSeasonFile,
  writeSeasonFile,
  findSection,
  buildChunk,
  computeNextGames,
  rawTable,
  upsertReadmeSection,
} from "../../footy-shared/lib.mjs";

function main() {
  const input = readInput();
  const seasonPath = path.join(REPO_ROOT, input.seasonFile);

  const { preamble, sections } = loadSeasonFile(seasonPath);
  const idx = findSection(sections, input.matchday);
  const rows = computeNextGames(input.games);
  sections[idx].text = buildChunk(input.matchday, "? / 10 correct predictions", "?% return", rows);
  writeSeasonFile(seasonPath, preamble, sections);

  const readmePath = path.join(REPO_ROOT, "README.md");
  let content = fs.readFileSync(readmePath, "utf8");
  const table = rawTable(
    ["Home Team", "Away Team", "Predicted Result"],
    input.games.map((g) => [g.home, g.away, g.predicted])
  );
  const block = `### Upcoming prediction\n\n**Matchday ${input.matchday}** (${input.date})\n\n${table}\n\n`;
  content = upsertReadmeSection(content, "Upcoming prediction", block);
  fs.writeFileSync(readmePath, content);

  console.log(`Inserted predictions for Matchday ${input.matchday} into ${input.seasonFile} and README.md.`);
}

main();
