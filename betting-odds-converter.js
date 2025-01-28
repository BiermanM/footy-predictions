#!/usr/bin/node

import * as readline from "node:readline";

const userInput = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};

const sum = (values) => {
  return values.reduce((total, num) => total + num, 0);
};

const formatNumber = (num) => {
  return num % 1 === 0 ? num.toString() : parseFloat(num.toFixed(1));
};

const getPayoutFromAmericanOdds = (odds) => {
  // always assuming $1 wager
  const wager = 1;

  if (odds === 0) {
    throw new Error("Invalid input: Odds cannot be zero.");
  }

  const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  return payout + wager;
};

(async () => {
  const inputNumGames = await userInput("Enter the number of games: ");
  const inputAmericanOddsList = await userInput("Enter the list of odds: ");

  const americanOddsList = inputAmericanOddsList
    .replaceAll(" ", "")
    .split(",")
    .map((odds) => parseInt(odds));
  const numGames = parseInt(inputNumGames);

  const totalPayout = sum(
    americanOddsList.map((odds) => getPayoutFromAmericanOdds(odds))
  );
  const percentageReturn = ((totalPayout - numGames) / numGames) * 100;

  console.log(
    `Percentage return: ${percentageReturn > 0 ? "+" : ""}${formatNumber(
      percentageReturn
    )}%`
  );

  process.exit();
})();
