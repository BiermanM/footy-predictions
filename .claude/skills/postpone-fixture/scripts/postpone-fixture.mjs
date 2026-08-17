#!/usr/bin/env node
// Relocates a single fixture from one matchday section to another within
// the same season file (for postponed/rescheduled Serie A games). Carries
// over whatever's already recorded for that fixture (a prediction, if one
// was made before the postponement was announced) but refuses to move a
// fixture that already has an official result, since that would corrupt
// the source matchday's accuracy/betting-return numbers.
// Usage: node postpone-fixture.mjs <input.json>   (run from repo root)
// See ../SKILL.md for the JSON schema.

import path from "node:path";
import {
  REPO_ROOT,
  readInput,
  loadSeasonFile,
  writeSeasonFile,
  findSection,
  buildChunk,
  extractHeaderTexts,
} from "../../footy-shared/lib.mjs";

function main() {
  const input = readInput();
  const seasonPath = path.join(REPO_ROOT, input.seasonFile);

  const { preamble, sections } = loadSeasonFile(seasonPath);
  const fromIdx = findSection(sections, input.fromMatchday);
  const toIdx = findSection(sections, input.toMatchday);

  const fromRows = sections[fromIdx].rows;
  const matchIdx = fromRows.findIndex(
    (r) =>
      r[0].toLowerCase() === input.home.toLowerCase() &&
      r[1].toLowerCase() === input.away.toLowerCase()
  );
  if (matchIdx === -1) {
    throw new Error(
      `No fixture "${input.home}" vs "${input.away}" found in Matchday ${input.fromMatchday}`
    );
  }
  const row = fromRows[matchIdx];
  const [home, away, predicted, odds, result] = row;

  if (result) {
    throw new Error(
      `${home} vs ${away} (Matchday ${input.fromMatchday}) already has an official result recorded ` +
        "(" + result + "). Moving it now would corrupt that matchday's accuracy/betting numbers — " +
        "resolve this by hand instead."
    );
  }

  const newFromRows = fromRows.filter((_, i) => i !== matchIdx);
  const newToRows = [...sections[toIdx].rows, [home, away, predicted, odds, "", ""]];

  const fromHeaders = extractHeaderTexts(sections[fromIdx].text);
  const toHeaders = extractHeaderTexts(sections[toIdx].text);

  sections[fromIdx].text = buildChunk(
    input.fromMatchday,
    fromHeaders.accuracyText,
    fromHeaders.bettingText,
    newFromRows
  );
  sections[toIdx].text = buildChunk(
    input.toMatchday,
    toHeaders.accuracyText,
    toHeaders.bettingText,
    newToRows
  );

  writeSeasonFile(seasonPath, preamble, sections);

  console.log(
    `Moved ${home} vs ${away} from Matchday ${input.fromMatchday} to Matchday ${input.toMatchday} ` +
      `in ${input.seasonFile}.` +
      (predicted ? ` (carried over existing prediction: ${predicted})` : "")
  );
  console.log(
    "Note: this only edits the season file. If either matchday is currently shown in README.md, " +
      "re-run insert-predictions or insert-results for that matchday to refresh it."
  );
}

main();
