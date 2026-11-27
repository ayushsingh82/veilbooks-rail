/**
 * On-chain flow for Veilbooks Rail. One step per command, so each can be checked on the explorer.
 *   npm run flow -- bond
 *   npm run flow -- deposit <QOR>
 *   npm run flow -- pay <name> <QOR>      (signed transfer from the payer to a named account)
 *   npm run flow -- batch                 (plan and submit the next batch)
 *   npm run flow -- status
 * Demo account seeds are generated into .accounts.json (gitignored). They are testnet-only.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  QledgerLedger,
  bytesToHex,
  encodeQledgerTx,
  planQledgerBatch,
  qorToUqor,
  uqorToQor,
  type QledgerBatchPlan,
} from "@qorechain/rdk";
import { accountFromSeed, CHAIN_ID } from "./sim.js";
import { getClient, ROLLUP_ID } from "./client.js";
import { connectOperator } from "./signer.js";

const FILE = ".accounts.json";
interface Saved {
  seeds: Record<string, string>; // name -> 32-byte seed hex
  nonces: Record<string, string>; // name -> next nonce (decimal)
  ledger: { id: string; balance: string; nonce: string }[]; // state after the last submitted batch
  withdrawals?: Record<string, { index: string; recipient: string; amount: string }[]>; // batch index -> withdrawals it committed
}

function load(): Saved {
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8")) as Saved;
  return { seeds: {}, nonces: {}, ledger: [] };
}
const save = (s: Saved) => writeFileSync(FILE, JSON.stringify(s, null, 2), { mode: 0o600 });

function account(s: Saved, name: string) {
  if (!s.seeds[name]) s.seeds[name] = bytesToHex(randomBytes(32));
  return accountFromSeed(Uint8Array.from(Buffer.from(s.seeds[name]!, "hex")));
}

function ledgerOf(s: Saved): QledgerLedger {
  const l = new QledgerLedger();
  for (const a of s.ledger) l.set(Uint8Array.from(Buffer.from(a.id, "hex")), BigInt(a.balance), BigInt(a.nonce));
  return l;
}
const saveLedger = (s: Saved, l: QledgerLedger) => {
  s.ledger = l.accounts().map((a) => ({ id: Buffer.from(a.id).toString("hex"), balance: a.balance.toString(), nonce: a.nonce.toString() }));
};

async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  const client = getClient();
  const s = load();

  if (cmd === "status") {
    const rollup = await client.rest.getRollup(ROLLUP_ID);
    console.log(`rollup ${ROLLUP_ID}: ${rollup.status}`);
    for (const n of Object.keys(s.seeds)) {
      const acc = account(s, n);
      console.log(`  ${n.padEnd(8)} id ${bytesToHex(acc.accountId).slice(0, 16)}…  local ledger: ${s.ledger.find((x) => x.id === bytesToHex(acc.accountId))?.balance ?? "0"} uqor`);
    }
    return;
  }

  const tx = await connectOperator(client);
  if (cmd === "bond") {
    const params = await client.params();
    const amount = params.minSubmitterBond ?? "0";
    console.log(`Bonding ${uqorToQor(BigInt(amount))} QOR as submitter on ${ROLLUP_ID}`);
    const res = await tx.bondRollupSubmitter({ rollupId: ROLLUP_ID, amount });
    console.log(`tx ${res.transactionHash} (code ${res.code})`);
  } else if (cmd === "deposit") {
    const qor = Number(a1 ?? "5");
    const payer = account(s, "payer");
    const res = await tx.depositToRollup({ rollupId: ROLLUP_ID, account: payer.accountId, amount: qorToUqor(qor) });
    save(s);
    console.log(`Deposited ${qor} QOR to payer ${bytesToHex(payer.accountId).slice(0, 16)}…  tx ${res.transactionHash} (code ${res.code})`);
  } else if (cmd === "pay") {
    if (!a1 || !a2) throw new Error("usage: pay <name> <QOR>");
    const payer = account(s, "payer");
    const to = account(s, a1);
    const nonce = BigInt(s.nonces.payer ?? "0");
    const { signQledgerTx } = await import("@qorechain/rdk");
    const signed = signQledgerTx({ chainId: CHAIN_ID, rollupId: ROLLUP_ID, secretKey: payer.secretKey, publicKey: payer.publicKey, nonce, amount: BigInt(qorToUqor(Number(a2))), to: to.accountId });
    const res = await tx.postRollupData({ rollupId: ROLLUP_ID, data: encodeQledgerTx(signed) });
    s.nonces.payer = (nonce + 1n).toString();
    save(s);
    console.log(`Posted transfer ${a2} QOR payer -> ${a1} (nonce ${nonce})  tx ${res.transactionHash} (code ${res.code})`);
  } else if (cmd === "withdraw") {
    if (!a1 || !a2) throw new Error("usage: withdraw <name> <QOR>   (pays out to the operator address)");
    const from = account(s, a1);
    const nonce = BigInt(s.nonces[a1] ?? "0");
    const { signQledgerTx } = await import("@qorechain/rdk");
    const signed = signQledgerTx({ chainId: CHAIN_ID, rollupId: ROLLUP_ID, secretKey: from.secretKey, publicKey: from.publicKey, nonce, amount: BigInt(qorToUqor(Number(a2))), recipient: tx.address });
    const res = await tx.postRollupData({ rollupId: ROLLUP_ID, data: encodeQledgerTx(signed) });
    s.nonces[a1] = (nonce + 1n).toString();
    save(s);
    console.log(`Posted withdrawal ${a2} QOR from ${a1} to ${tx.address} (nonce ${nonce})  tx ${res.transactionHash} (code ${res.code})`);
  } else if (cmd === "execute") {
    const batchIndex = a1 ?? "";
    const ws = (s.withdrawals?.[batchIndex] ?? []).map((w) => ({ index: BigInt(w.index), recipient: w.recipient, amount: BigInt(w.amount) }));
    const i = Number(a2 ?? "0");
    const w = ws[i];
    if (!w) throw new Error(`batch ${batchIndex} has no withdrawal ${i} in .accounts.json`);
    const { qledgerWithdrawalProof } = await import("@qorechain/rdk");
    const res = await tx.executeWithdrawal({ rollupId: ROLLUP_ID, batchIndex, withdrawalIndex: w.index, recipient: w.recipient, denom: "uqor", amount: w.amount, proof: qledgerWithdrawalProof(CHAIN_ID, ROLLUP_ID, ws, i) });
    console.log(`Executed withdrawal ${w.index} (${Number(w.amount) / 1e6} QOR to ${w.recipient})  tx ${res.transactionHash} (code ${res.code})`);
  } else if (cmd === "batch") {
    const plan: QledgerBatchPlan = await planQledgerBatch(client.rest, { chainId: CHAIN_ID, rollupId: ROLLUP_ID, submitter: tx.address, ledger: ledgerOf(s) });
    console.log(`Batch ${plan.input.batchIndex}: ${plan.input.txCount} entries, stateRoot ${bytesToHex(plan.input.stateRoot).slice(0, 16)}…, inboxEnd ${plan.input.inboxEnd}`);
    const res = await tx.submitBatch(plan.input);
    saveLedger(s, plan.ledger);
    if (plan.result.withdrawals.length) (s.withdrawals ??= {})[String(plan.input.batchIndex)] = plan.result.withdrawals.map((w) => ({ index: w.index.toString(), recipient: w.recipient, amount: w.amount.toString() }));
    save(s);
    console.log(`Submitted: ${res.transactionHash} (code ${res.code}); withdrawals in this batch: ${plan.result.withdrawals.length}`);
  } else {
    console.log("commands: status | bond | deposit <QOR> | pay <name> <QOR> | withdraw <name> <QOR> | batch | execute <batchIndex> [i]");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
