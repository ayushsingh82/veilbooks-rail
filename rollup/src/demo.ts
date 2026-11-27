/**
 * Offline walk-through of Veilbooks Rail. No network, no funds.
 * Run: npm run demo
 */
import { QledgerLedger, encodeQledgerDeposit, encodeQledgerTx, type QledgerEntry } from "@qorechain/rdk";
import { accountFromSeed } from "./sim.js";
import { RailSim } from "./sim.js";
import { honestClaim, verifyBatch } from "./receipt.js";
import { manifestDigest, manifestTotal, memberKeys, openManifest, sealManifest, type Manifest } from "./manifest.js";

const QOR = 1_000_000n;
const q = (u: bigint) => `${Number(u) / 1e6} QOR`;
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const sim = new RailSim();
const payer = accountFromSeed(new Uint8Array(32).fill(1));
const staff = ["Ann", "Bob", "Chen", "Dara", "Eli"].map((name, i) => ({ name, acct: accountFromSeed(new Uint8Array(32).fill(10 + i)), pay: BigInt(2 + i) * QOR }));

console.log("== 1. Deposit ==");
const before = sim.ledger.clone() as QledgerLedger;
const entries: QledgerEntry[] = [{ height: 1n, poster: "deposit:qor1company", payload: encodeQledgerDeposit(payer.accountId, 100n * QOR) }];
console.log(`Company deposits ${q(100n * QOR)} into the payer account.`);

console.log("\n== 2. Payroll run (one signed transfer per person) ==");
let nonce = 0n;
staff.forEach((s, i) => {
  const tx = sim.signTransfer(payer, s.acct, s.pay, nonce++);
  entries.push({ height: BigInt(2 + i), poster: "qor1operator", payload: encodeQledgerTx(tx) });
  console.log(`  ${s.name.padEnd(5)} ${q(s.pay)}`);
});

console.log("\n== 3. Payment manifest, sealed for the operator and the auditor ==");
const manifest: Manifest = { runId: "payroll-nov", lines: staff.map((s) => ({ invoiceId: `nov-${s.name}`, payee: s.name, amountUqor: s.pay.toString() })) };
const op = memberKeys(new Uint8Array(64).fill(7));
const aud = memberKeys(new Uint8Array(64).fill(8));
const sealed = sealManifest(manifest, [{ member: "qor1operator", encapsulationKey: op.publicKey }, { member: "qor1auditor", encapsulationKey: aud.publicKey }]);
console.log(`  digest   ${short(sealed.digest)}   (public)`);
console.log(`  dataHash ${short(sealed.dataHash)}   (what the chain records when posted)`);
const opened = openManifest(sealed.envelope, "qor1auditor", aud.secretKey, sealed.digest);
console.log(`  auditor opens it: ${opened.lines.length} lines, total ${q(manifestTotal(opened))}`);

console.log("\n== 4. Batch and receipt ==");
const claim = honestClaim(before, entries, 0);
console.log(`  stateRoot ${short(claim.stateRoot)}  prev ${short(claim.prevStateRoot)}`);
const ok = verifyBatch(before, entries, claim);
console.log(`  honest batch verifies: ${ok.ok}`);

console.log("\n== 5. A dishonest operator ==");
const forged = verifyBatch(before, entries, { ...claim, stateRoot: "ab".repeat(32) });
console.log(`  forged root caught: ${!forged.ok} (${forged.errors.join("; ")})`);
const skipped = verifyBatch(before, entries.slice(0, 3), claim);
console.log(`  batch that drops two transfers caught: ${!skipped.ok}`);
console.log(`\nManifest digest unchanged by line order: ${manifestDigest({ ...manifest, lines: [...manifest.lines].reverse() }) === sealed.digest}`);
