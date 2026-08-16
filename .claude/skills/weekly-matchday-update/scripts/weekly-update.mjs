#!/usr/bin/env node
// Applies a weekly matchday update (or a season-boundary update) to a season
// markdown file and README.md, following the repo's established formatting.
// Usage: node weekly-update.mjs <input.json>
// See SKILL.md in the parent directory for the JSON schema and workflow.

import fs from "node:fs";
import path from "node:path";

// Paths in the input JSON (seasonFile, etc.) are resolved relative to the
// current working directory, which must be the repo root.
const REPO_ROOT = process.cwd();

function readInput() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node weekly-update.mjs <input.json>");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

function formatOdds(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

const RESULT_INDEX = { 1: 0, X: 1, 2: 2 };

function payoutFor(americanOdds) {
  const wager = 1;
  return americanOdds > 0
    ? americanOdds / 100 + wager
    : 100 / Math.abs(americanOdds) + wager;
}

function formatPercent(num) {
  const rounded = Math.round(num * 10) / 10;
  const str = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `${rounded > 0 ? "+" : ""}${str}%`;
}

function computeCompletedGames(games) {
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
    return [
      g.home,
      g.away,
      g.predicted,
      oddsStr,
      g.result,
      isCorrect ? "✅" : "❌",
    ];
  });
  const returnPct = ((totalPayout - games.length) / games.length) * 100;
  return {
    rows,
    accuracyText: `${correct} / ${games.length} correct predictions`,
    bettingText: formatPercent(returnPct).replace("%", "% return"),
    accuracyPct: Math.round((correct / games.length) * 100),
    returnPct,
  };
}

function computeNextGames(games) {
  return games.map((g) => [
    g.home,
    g.away,
    g.predicted,
    g.odds.map(formatOdds).join(", "),
    "",
    "",
  ]);
}

function rawTable(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}

const FULL_HEADERS = [
  "Home Team",
  "Away Team",
  "Predicted Result",
  "Betting Odds",
  "Official Result",
  "Correct Prediction?",
];

// ---- Season file editing -----------------------------------------------

function splitSeasonFile(content) {
  const marker = "\n## Matchday ";
  const firstIdx = content.indexOf(marker);
  const preamble = content.slice(0, firstIdx);
  const rest = content.slice(firstIdx + 1); // drop leading \n, keep "## Matchday ..."
  const chunks = rest.split(/(?=^## Matchday )/m);
  return { preamble, chunks };
}

function parseChunk(chunk) {
  const numMatch = chunk.match(/^## Matchday (\d+)/);
  return { number: parseInt(numMatch[1], 10), text: chunk };
}

function buildChunk(number, accuracyText, bettingText, tableRows, headers = FULL_HEADERS) {
  const table =
    tableRows.length > 0
      ? rawTable(headers, tableRows)
      : rawTable(
          headers.length === 6
            ? ["Home Team", "Away Team", "Predicted Result", "Betting Odds", "Official Result", "Correct Prediction?"]
            : headers,
          []
        );
  return `## Matchday ${number}\n\n#### Accuracy: ${accuracyText}\n\n#### Betting Result: ${bettingText}\n\n${table}\n`;
}

function updateSeasonFile(seasonPath, { completed, next }) {
  const original = fs.readFileSync(seasonPath, "utf8");
  const { preamble, chunks } = splitSeasonFile(original);
  const parsed = chunks.map(parseChunk);

  if (completed) {
    const { rows, accuracyText, bettingText } = computeCompletedGames(completed.games);
    const idx = parsed.findIndex((c) => c.number === completed.number);
    if (idx === -1) {
      throw new Error(`Matchday ${completed.number} section not found in ${seasonPath}`);
    }
    parsed[idx].text = buildChunk(completed.number, accuracyText, bettingText, rows);
  }

  if (next) {
    const rows = computeNextGames(next.games);
    const idx = parsed.findIndex((c) => c.number === next.number);
    if (idx === -1) {
      throw new Error(`Matchday ${next.number} section not found in ${seasonPath}`);
    }
    parsed[idx].text = buildChunk(
      next.number,
      "? / 10 correct predictions",
      "?% return",
      rows
    );
  }

  const rebuilt = preamble + "\n" + parsed.map((c) => c.text).join("\n");
  fs.writeFileSync(seasonPath, rebuilt.trimEnd() + "\n");
}

function createSeasonFile(seasonPath, { title, totalMatchdays, next }) {
  const emptyHeaders = ["Home Team", "Away Team", "Predicted Result", "Betting Odds", "Official Result", "Correct Prediction?"];
  const sections = [];
  for (let n = 1; n <= totalMatchdays; n++) {
    if (n === next.number) {
      const rows = computeNextGames(next.games);
      sections.push(buildChunk(n, "? / 10 correct predictions", "?% return", rows, emptyHeaders));
    } else {
      sections.push(buildChunk(n, "? / 10 correct predictions", "?% return", [], emptyHeaders));
    }
  }
  const preamble = `# ${title}\n\nNotes:\n\n- \`1\` = home team, \`X\` = draw, \`2\` = away team\n- Betting odds from [OddsPortal](https://www.oddsportal.com/football/italy/serie-a/results)\n`;
  const content = preamble + "\n" + sections.join("\n");
  fs.writeFileSync(seasonPath, content.trimEnd() + "\n");
}

// ---- README.md editing --------------------------------------------------

function updateReadmeWeekly(readmePath, { completed, next }) {
  let content = fs.readFileSync(readmePath, "utf8");

  if (next) {
    const rows = next.games.map((g) => [g.home, g.away, g.predicted]);
    const table = rawTable(["Home Team", "Away Team", "Predicted Result"], rows);
    content = content.replace(
      /### Upcoming prediction\n\n\*\*Matchday \d+\*\* \([^)]*\)\n\n\|[\s\S]*?\n\n(?=###)/,
      `### Upcoming prediction\n\n**Matchday ${next.number}** (${next.date})\n\n${table}\n\n`
    );
  }

  if (completed) {
    const { rows } = computeCompletedGames(completed.games);
    const table = rawTable(FULL_HEADERS, rows);
    content = content.replace(
      /### Previous Matchday Results\n\n\|[\s\S]*?\n\n(?=###)/,
      `### Previous Matchday Results\n\n${table}\n\n`
    );
  }

  fs.writeFileSync(readmePath, content);
}

function insertUpcomingSection(readmePath, { next }) {
  let content = fs.readFileSync(readmePath, "utf8");
  const rows = next.games.map((g) => [g.home, g.away, g.predicted]);
  const table = rawTable(["Home Team", "Away Team", "Predicted Result"], rows);
  const block = `### Upcoming prediction\n\n**Matchday ${next.number}** (${next.date})\n\n${table}\n\n`;
  content = content.replace(/^# Footy Predictions\n\n/, `# Footy Predictions\n\n${block}`);
  fs.writeFileSync(readmePath, content);
}

function rebuildReadmeForSeasonEnd(readmePath, { seasonLabel, matchdaySummaries }) {
  let content = fs.readFileSync(readmePath, "utf8");

  // Demote the currently-topmost "Previous Season (X) Results" heading, if present.
  content = content.replace(
    /### Previous Season \(([^)]+)\) Results/,
    "### $1 Season Results"
  );

  const rows = matchdaySummaries.map((m) => [
    String(m.number),
    `${m.accuracyPct}%`,
    formatPercent(m.returnPct).replace(" return", ""),
  ]);
  const avgAcc =
    matchdaySummaries.reduce((s, m) => s + m.accuracyPct, 0) / matchdaySummaries.length;
  const avgRet =
    matchdaySummaries.reduce((s, m) => s + m.returnPct, 0) / matchdaySummaries.length;
  const avgRetStr = (Math.round(avgRet * 100) / 100).toFixed(2);
  rows.push([
    "**Total**",
    `**${(Math.round(avgAcc * 100) / 100).toFixed(2)}%**`,
    `**${avgRet > 0 ? "+" : ""}${avgRetStr}%**`,
  ]);
  const table = rawTable(["Matchday", "Accuracy", "Betting Return"], rows);
  const block = `### Previous Season (${seasonLabel}) Results\n\n${table}\n\n`;

  // Remove the "Upcoming prediction" and "Previous Matchday Results" sections entirely.
  content = content.replace(/### Upcoming prediction\n\n[\s\S]*?\n\n(?=###)/, "");
  content = content.replace(/### Previous Matchday Results\n\n[\s\S]*?\n\n(?=###)/, "");

  content = content.replace(/^# Footy Predictions\n\n/, `# Footy Predictions\n\n${block}`);
  fs.writeFileSync(readmePath, content);
}

function extractAllMatchdaySummaries(seasonPath) {
  const content = fs.readFileSync(seasonPath, "utf8");
  const { chunks } = splitSeasonFile(content);
  return chunks.map((chunk) => {
    const number = parseInt(chunk.match(/^## Matchday (\d+)/)[1], 10);
    const acc = chunk.match(/#### Accuracy: (\d+) \/ \d+ correct predictions/);
    const bet = chunk.match(/#### Betting Result: ([+-]?[\d.]+)% return/);
    if (!acc || !bet) {
      throw new Error(`Matchday ${number} is missing results; cannot build season summary.`);
    }
    return {
      number,
      accuracyPct: parseInt(acc[1], 10) * 10,
      returnPct: parseFloat(bet[1]),
    };
  });
}

// ---- Main -----------------------------------------------------------------

function main() {
  const input = readInput();
  const action = input.action || "weekly";
  const seasonPath = path.join(REPO_ROOT, input.seasonFile);

  if (action === "weekly") {
    if (!input.completed && !input.next) {
      throw new Error('"weekly" action requires at least one of completed/next');
    }
    updateSeasonFile(seasonPath, input);
    updateReadmeWeekly(path.join(REPO_ROOT, "README.md"), input);
    console.log(`Updated ${input.seasonFile} and README.md (weekly).`);
  } else if (action === "new-season") {
    if (!input.newSeason || !input.next) {
      throw new Error('"new-season" action requires newSeason and next');
    }
    createSeasonFile(seasonPath, {
      title: input.newSeason.title,
      totalMatchdays: input.newSeason.totalMatchdays || 38,
      next: input.next,
    });
    insertUpcomingSection(path.join(REPO_ROOT, "README.md"), input);
    console.log(`Created ${input.seasonFile} and updated README.md (new season).`);
  } else if (action === "season-end") {
    if (!input.completed || !input.seasonLabel) {
      throw new Error('"season-end" action requires completed and seasonLabel');
    }
    updateSeasonFile(seasonPath, { completed: input.completed, next: null });
    const matchdaySummaries = extractAllMatchdaySummaries(seasonPath);
    rebuildReadmeForSeasonEnd(path.join(REPO_ROOT, "README.md"), {
      seasonLabel: input.seasonLabel,
      matchdaySummaries,
    });
    console.log(`Updated ${input.seasonFile} and rebuilt README.md summary (season end).`);
  } else {
    throw new Error(`Unknown action "${action}"`);
  }
}

main();
