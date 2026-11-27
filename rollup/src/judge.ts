/**
 * Judge checks for Veilbooks Rail. No network, no funds: builds an honest three-batch history, then attacks it.
 * Run: npm run judge
 */
import { runScenarios } from "./scenarios.js";

const rows = runScenarios();
for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(28)} ${r.detail}`);
if (rows.some((r) => !r.pass)) process.exit(1);
