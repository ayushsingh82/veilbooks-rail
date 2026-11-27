/**
 * Judge checks for Veilbooks Rail. No network, no funds: builds an honest three-batch history, then attacks it.
 * Run: npm run judge
 */
import { QledgerLedger, encodeQledgerDeposit, encodeQledgerTx, executeQledger, type QledgerEntry } from "@qorechain/rdk";
import { CHAIN_ID, ROLLUP_ID, RailSim, accountFromSeed } from "./sim.js";
import { honestClaim } from "./receipt.js";
import { watch, type PostedBatch } from "./watchtower.js";

const alice = accountFromSeed(new Uint8Array(32).fill(1));
const bob = accountFromSeed(new Uint8Array(32).fill(2));

function history() {
  const sim = new RailSim();
  const start = sim.ledger.clone() as QledgerLedger;
  const run = new QledgerLedger();
  const make = (entries: QledgerEntry[], i: number): PostedBatch => {
    const claim = honestClaim(run, entries, i);
    executeQledger({ chainId: CHAIN_ID, rollupId: ROLLUP_ID }, run, entries);
    return { entries, claim };
  };
  const batches = [
    make([{ height: 1n, poster: "deposit:qor1d", payload: encodeQledgerDeposit(alice.accountId, 10_000_000n) }], 0),
    make([{ height: 2n, poster: "qor1sub", payload: encodeQledgerTx(sim.signTransfer(alice, bob, 1_000_000n, 0n)) }], 1),
    make([{ height: 3n, poster: "qor1sub", payload: encodeQledgerTx(sim.signTransfer(alice, bob, 2_000_000n, 1n)) }], 2),
  ];
  return { start, batches };
}

const rows: [string, boolean, string][] = [];
const row = (name: string, expectCaught: boolean, mutate: (b: PostedBatch[]) => PostedBatch[]) => {
  const { start, batches } = history();
  const r = watch(start, mutate(batches));
  const caught = r.challenge !== null;
  rows.push([name, caught === expectCaught, caught ? `challenge at batch ${r.challenge!.batchIndex}: ${r.challenge!.errors[0]}` : "no challenge"]);
};

row("Control: honest history", false, (b) => b);
row("Forged state root", true, (b) => [b[0]!, { ...b[1]!, claim: { ...b[1]!.claim, stateRoot: "ab".repeat(32) } }, b[2]!]);
row("Operator drops a transfer", true, (b) => [b[0]!, b[1]!, { ...b[2]!, entries: [] }]);
row("Wrong parent root", true, (b) => [b[0]!, { ...b[1]!, claim: { ...b[1]!.claim, prevStateRoot: "00".repeat(32) } }, b[2]!]);
row("Replayed batch", true, (b) => [b[0]!, b[1]!, { ...b[1]!, claim: { ...b[1]!.claim, batchIndex: 2 } }]);
row("Batch skipped", true, (b) => [b[0]!, b[2]!]);

for (const [name, pass, detail] of rows) console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(28)} ${detail}`);
if (rows.some((r) => !r[1])) process.exit(1);
