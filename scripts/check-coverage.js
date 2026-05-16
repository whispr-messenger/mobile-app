#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Coverage threshold checker.
 *
 * Jest's built-in `coverageThreshold` is broken in this repo because the root
 * `overrides` pin glob@10, which no longer exposes the `glob.sync` API that
 * Jest 29 expects. This script replaces that mechanism by reading the
 * istanbul coverage-summary.json produced by `npm test -- --coverage`.
 *
 * Run:
 *   npm test -- --watchAll=false --coverage \
 *     --coverageReporters=json-summary --coverageReporters=text
 *   node scripts/check-coverage.js
 */

const fs = require("fs");
const path = require("path");

// Project-wide baselines. Ratcheted incrementally as new test surface
// landed:
//   v1 (pre-2026-05): 35/60/33/35
//   v2 (groups/api + 5 Chat components): 55/65/48/55
//   v3 (stack modernization + admin smoke + heavy screen smoke): 72/65/50/72
// Headroom of ~5 pts below the current measurement so a normal PR can't
// silently regress.
const THRESHOLDS = {
  statements: 72,
  branches: 65,
  functions: 50,
  lines: 72,
};

const summaryPath = path.resolve(
  __dirname,
  "..",
  "coverage",
  "coverage-summary.json",
);

if (!fs.existsSync(summaryPath)) {
  console.error(
    `[check-coverage] ${summaryPath} not found — run jest with --coverage --coverageReporters=json-summary first.`,
  );
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const total = summary.total;
if (!total) {
  console.error("[check-coverage] Missing 'total' in coverage-summary.json");
  process.exit(1);
}

let failed = false;
for (const [metric, min] of Object.entries(THRESHOLDS)) {
  const pct = total[metric]?.pct;
  if (typeof pct !== "number") {
    console.error(`[check-coverage] No ${metric} coverage reported`);
    failed = true;
    continue;
  }
  const ok = pct >= min;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[check-coverage] ${tag} ${metric}: ${pct}% (min ${min}%)`);
  if (!ok) failed = true;
}

process.exit(failed ? 1 : 0);
