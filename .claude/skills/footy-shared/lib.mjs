// Shared helpers for the footy-predictions weekly-data-entry skills
// (populate-season-fixtures, insert-predictions, insert-results).
// Not a skill itself — imported by the scripts in the sibling skill dirs.

import fs from "node:fs";

export const REPO_ROOT = process.cwd();

export function readInput() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node <script>.mjs <input.json>");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

export function formatOdds(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

export const RESULT_INDEX = { 1: 0, X: 1, 2: 2 };

export function payoutFor(americanOdds) {
  const wager = 1;
  return americanOdds > 0
    ? americanOdds / 100 + wager
    : 100 / Math.abs(americanOdds) + wager;
}

// Matches the repo's existing style: whole numbers print without a decimal
// point (e.g. "-38%"), fractional ones get exactly 1 decimal (e.g. "-40.6%").
export function formatPercent(num) {
  const rounded = Math.round(num * 10) / 10;
  const str = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `${rounded > 0 ? "+" : ""}${str}%`;
}

// Season-summary "Total" row uses 2 decimals, always, per the repo's
// existing season-end commits (e.g. "51.05%", "+4.64%").
export function formatPercent2(num, forceSign = true) {
  const str = (Math.round(num * 100) / 100).toFixed(2);
  return `${forceSign && num > 0 ? "+" : ""}${str}%`;
}

export function rawTable(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}

export const FULL_HEADERS = [
  "Home Team",
  "Away Team",
  "Predicted Result",
  "Betting Odds",
  "Official Result",
  "Correct Prediction?",
];

// ---- Season file section handling ----

export function splitSeasonFile(content) {
  const marker = "\n## Matchday ";
  const firstIdx = content.indexOf(marker);
  const preamble = content.slice(0, firstIdx);
  const rest = content.slice(firstIdx + 1);
  const chunks = rest.split(/(?=^## Matchday )/m);
  return { preamble, chunks };
}

export function parseChunk(chunk) {
  const numMatch = chunk.match(/^## Matchday (\d+)/);
  const rows = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("|") && !line.includes("---") && !line.includes("Home Team")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.some((c) => c.length > 0)) rows.push(cells);
    }
  }
  return { number: parseInt(numMatch[1], 10), text: chunk, rows };
}

export function buildChunk(number, accuracyText, bettingText, tableRows, headers = FULL_HEADERS) {
  const table = rawTable(headers, tableRows);
  return `## Matchday ${number}\n\n#### Accuracy: ${accuracyText}\n\n#### Betting Result: ${bettingText}\n\n${table}\n`;
}

export function loadSeasonFile(seasonPath) {
  const original = fs.readFileSync(seasonPath, "utf8");
  const { preamble, chunks } = splitSeasonFile(original);
  return { preamble, sections: chunks.map(parseChunk) };
}

export function writeSeasonFile(seasonPath, preamble, sections) {
  const rebuilt = preamble + "\n" + sections.map((c) => c.text).join("\n");
  fs.writeFileSync(seasonPath, rebuilt.trimEnd() + "\n");
}

export function findSection(sections, number) {
  const idx = sections.findIndex((c) => c.number === number);
  if (idx === -1) {
    throw new Error(`Matchday ${number} section not found in season file`);
  }
  return idx;
}

// Match input games to a section's existing rows by home/away team name.
export function lookupExisting(sectionRows, home, away) {
  const row = sectionRows.find(
    (r) => r[0].toLowerCase() === home.toLowerCase() && r[1].toLowerCase() === away.toLowerCase()
  );
  if (!row) {
    throw new Error(`No existing fixture "${home}" vs "${away}" found in this matchday's section`);
  }
  return row;
}

// ---- Scoring math ----

export function computeCompletedGames(games) {
  let correct = 0;
  let totalPayout = 0;
  const rows = games.map((g) => {
    const idx = RESULT_INDEX[g.result];
    if (idx === undefined) {
      throw new Error(`Invalid result "${g.result}" for ${g.home} vs ${g.away}`);
    }
    const isCorrect = g.predicted === g.result;
    if (isCorrect) {
      correct += 1;
      totalPayout += payoutFor(g.odds[idx]);
    }
    const oddsStr = g.odds
      .map((o, i) => {
        const s = formatOdds(o);
        return isCorrect && i === idx ? `**${s}**` : s;
      })
      .join(", ");
    return [g.home, g.away, g.predicted, oddsStr, g.result, isCorrect ? "✅" : "❌"];
  });
  const returnPct = ((totalPayout - games.length) / games.length) * 100;
  return {
    rows,
    correct,
    total: games.length,
    accuracyText: `${correct} / ${games.length} correct predictions`,
    bettingText: `${formatPercent(returnPct)} return`,
    accuracyPct: Math.round((correct / games.length) * 100),
    returnPct,
  };
}

// Predictions are recorded without odds — odds are only captured later,
// alongside the result, in insert-results.
export function computePredictedGames(games) {
  return games.map((g) => [g.home, g.away, g.predicted, "", "", ""]);
}

// ---- README.md section editing ----

// Replace a top-level "### {heading}" section's block if it exists;
// otherwise insert `block` right after "### {insertAfterHeading}" (if that
// exists), falling back to right after the H1 title.
export function upsertReadmeSection(content, heading, block, insertAfterHeading = null) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRe = new RegExp(`### ${escaped}\\n\\n[\\s\\S]*?\\n\\n(?=###|$)`);
  if (sectionRe.test(content)) {
    return content.replace(sectionRe, block);
  }
  if (insertAfterHeading) {
    const afterEscaped = insertAfterHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const afterRe = new RegExp(`(### ${afterEscaped}\\n\\n[\\s\\S]*?\\n\\n)(?=###|$)`);
    if (afterRe.test(content)) {
      return content.replace(afterRe, `$1${block}`);
    }
  }
  return content.replace(/^# Footy Predictions\n\n/, `# Footy Predictions\n\n${block}`);
}

export function removeReadmeSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRe = new RegExp(`### ${escaped}\\n\\n[\\s\\S]*?\\n\\n(?=###|$)`);
  return content.replace(sectionRe, "");
}

export function extractAllMatchdaySummaries(seasonPath) {
  const { sections } = loadSeasonFile(seasonPath);
  return sections.map((s) => {
    const acc = s.text.match(/#### Accuracy: (\d+) \/ \d+ correct predictions/);
    const bet = s.text.match(/#### Betting Result: ([+-]?[\d.]+)% return/);
    if (!acc || !bet) {
      throw new Error(`Matchday ${s.number} is missing results; cannot build season summary.`);
    }
    return { number: s.number, accuracyPct: parseInt(acc[1], 10) * 10, returnPct: parseFloat(bet[1]) };
  });
}
