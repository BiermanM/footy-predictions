#!/usr/bin/env node

import fs from "fs";
import path from "path";

/**
 * Parses a single CSV line, handling quoted fields that may contain commas
 * @param {string} line - A single line from the CSV file
 * @returns {string[]} - Array of parsed field values
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i += 2;
      } else {
        // Start or end of quoted field
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      fields.push(currentField.trim());
      currentField = "";
      i++;
    } else {
      // Regular character
      currentField += char;
      i++;
    }
  }

  // Add the last field
  fields.push(currentField.trim());

  return fields;
}

/**
 * Converts a CSV file to a markdown table format
 * @param {string} csvContent - The content of the CSV file
 * @param {boolean} reverse - Whether to reverse the order of data rows
 * @returns {string} - The markdown table string
 */
function csvToMarkdownTable(csvContent, reverse = false) {
  const lines = csvContent.trim().split("\n");

  if (lines.length === 0) {
    return "";
  }

  // Parse CSV lines with proper handling of quoted fields
  const rows = lines.map((line) => parseCSVLine(line));

  if (rows.length === 0) {
    return "";
  }

  // Get the maximum number of columns
  const maxColumns = Math.max(...rows.map((row) => row.length));

  // Normalize all rows to have the same number of columns
  const normalizedRows = rows.map((row) => {
    while (row.length < maxColumns) {
      row.push("");
    }
    return row;
  });

  // Create markdown table
  let markdownTable = "";

  // Add header row
  if (normalizedRows.length > 0) {
    markdownTable += "| " + normalizedRows[0].join(" | ") + " |\n";

    // Add separator row
    markdownTable +=
      "| " + normalizedRows[0].map(() => "---").join(" | ") + " |\n";

    // Add data rows (reverse if requested)
    const dataRows = normalizedRows.slice(1);
    const rowsToProcess = reverse ? dataRows.reverse() : dataRows;

    for (const row of rowsToProcess) {
      markdownTable += "| " + row.join(" | ") + " |\n";
    }
  }

  return markdownTable;
}

/**
 * Main function to handle command line arguments and file processing
 */
function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  // Check if CSV filename is provided
  if (args.length === 0) {
    console.error("Error: Please provide a CSV filename as an argument.");
    console.error(
      "Usage: node csv-to-markdown-table-converter.js [--reverse|-r] <filename.csv>"
    );
    process.exit(1);
  }

  // Parse arguments for reverse flag
  let reverse = false;
  let csvFilename = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--reverse" || arg === "-r") {
      reverse = true;
    } else if (!csvFilename && !arg.startsWith("-")) {
      csvFilename = arg;
    }
  }

  if (!csvFilename) {
    console.error("Error: Please provide a CSV filename as an argument.");
    console.error(
      "Usage: node csv-to-markdown-table-converter.js [--reverse|-r] <filename.csv>"
    );
    process.exit(1);
  }

  // Check if file exists in current directory
  const csvPath = path.join(process.cwd(), csvFilename);

  if (!fs.existsSync(csvPath)) {
    console.error(
      `Error: File '${csvFilename}' not found in current directory.`
    );
    process.exit(1);
  }

  // Check if file has .csv extension
  if (!csvFilename.toLowerCase().endsWith(".csv")) {
    console.error(
      `Error: File '${csvFilename}' does not have a .csv extension.`
    );
    process.exit(1);
  }

  try {
    // Read the CSV file
    const csvContent = fs.readFileSync(csvPath, "utf8");

    // Convert to markdown table
    const markdownTable = csvToMarkdownTable(csvContent, reverse);

    // Print the markdown table to console
    console.log(markdownTable);
  } catch (error) {
    console.error(`Error reading file '${csvFilename}':`, error.message);
    process.exit(1);
  }
}

// Run the main function
main();
