#!/usr/bin/env node
/**
 * Validates a quest JSON for vanilla-doability.
 * Usage: node validate-quest.js quests/2025-11-04.json
 * Exits non-zero on failure.
 */

const fs = require("fs");

const bannedPhrases = [
  // Non-vanilla items/behaviors we’ve seen
  "spore stew",
  "enchanted bread",
  "feed it to a wandering trader",
  "secret honeycomb",
  "cauldron stew",
  "nether wart and sugar stew",
  "command block",
  "use /give",
  "datapack needed",
  "mod-only",
];

const mustBePresent = ["title", "steps"];

function main(file) {
  if (!file) die("Provide a quest json file path.");
  if (!fs.existsSync(file)) die(`File not found: ${file}`);
  const j = JSON.parse(fs.readFileSync(file, "utf8"));

  // Basic schema
  mustBePresent.forEach((k) => {
    if (!(k in j)) die(`Missing required field: ${k}`);
  });
  if (!Array.isArray(j.steps) || j.steps.length < 1 || j.steps.length > 3) {
    die("steps must be an array of length 1–3");
  }

  // Banned phrases
  const blob = JSON.stringify(j).toLowerCase();
  for (const bad of bannedPhrases) {
    if (blob.includes(bad)) die(`BANNED content detected: "${bad}"`);
  }

  // Sanity checks—no obviously fake items
  const fakeItems = [/enchanted\s+\w+/, /secret\s+chest/];
  fakeItems.forEach((rx) => {
    if (rx.test(blob)) die(`Likely non-vanilla concept: ${rx}`);
  });

  // Gentle allowlist idea: assert common verbs/items appear, not required though
  ok(`Valid: ${file}`);
}

function ok(msg) {
  console.log(msg);
  process.exit(0);
}
function die(msg) {
  console.error("VALIDATION ERROR:", msg);
  process.exit(1);
}

main(process.argv[2]);
