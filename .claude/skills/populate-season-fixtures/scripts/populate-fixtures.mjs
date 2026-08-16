#!/usr/bin/env node
// Creates a new season markdown file scaffolded with every matchday's
// fixtures (home/away only — no predictions, odds, or results yet).
// Usage: node populate-fixtures.mjs <input.json>   (run from repo root)
// See ../SKILL.md for the JSON schema.

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, readInput, buildChunk, FULL_HEADERS } from "../../footy-shared/lib.mjs";

function main() {
  const input = readInput();
  const seasonPath = path.join(REPO_ROOT, input.seasonFile);

  if (fs.existsSync(seasonPath)) {
    throw new Error(
      `${input.seasonFile} already exists. This script only creates a brand-new season file; ` +
        "remove it first if you intend to regenerate it from scratch."
    );
  }

  const byNumber = new Map(input.matchdays.map((m) => [m.number, m.games]));
  const totalMatchdays =
    input.totalMatchdays || Math.max(...input.matchdays.map((m) => m.number));

  const sections = [];
  for (let n = 1; n <= totalMatchdays; n++) {
    const games = byNumber.get(n) || [];
    const rows = games.map((g) => [g.home, g.away, "", "", "", ""]);
    sections.push(buildChunk(n, "? / 10 correct predictions", "?% return", rows, FULL_HEADERS));
  }

  const preamble = `# ${input.title}\n\nNotes:\n\n- \`1\` = home team, \`X\` = draw, \`2\` = away team\n- Betting odds from [OddsPortal](https://www.oddsportal.com/football/italy/serie-a/results)\n`;
  const content = preamble + "\n" + sections.join("\n");
  fs.writeFileSync(seasonPath, content.trimEnd() + "\n");

  console.log(`Created ${input.seasonFile} with ${totalMatchdays} matchdays (${byNumber.size} with fixtures loaded).`);
}

main();
