/**
 * Seal a manifest exported by Veilbooks Desk for the operator and an auditor, and print what goes on chain.
 * Run: npm run seal-manifest -- path/to/run-rail-manifest.json
 * Demo keys are derived from fixed seeds. Use your own keys for anything real.
 */
import { readFileSync } from "node:fs";
import { manifestTotal, memberKeys, parseManifest, sealManifest } from "./manifest.js";

const file = process.argv[2];
if (!file) throw new Error("usage: npm run seal-manifest -- <manifest.json>");
const m = parseManifest(readFileSync(file, "utf8"));
const op = memberKeys(new Uint8Array(64).fill(7));
const aud = memberKeys(new Uint8Array(64).fill(8));
const sealed = sealManifest(m, [{ member: "qor1operator", encapsulationKey: op.publicKey }, { member: "qor1auditor", encapsulationKey: aud.publicKey }]);
console.log(`run        ${m.runId}`);
console.log(`lines      ${m.lines.length}`);
console.log(`total      ${Number(manifestTotal(m)) / 1e6} QOR`);
console.log(`digest     ${sealed.digest}`);
console.log(`dataHash   ${sealed.dataHash}`);
console.log(`envelope   ${sealed.envelope.length} bytes`);
