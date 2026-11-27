import { describe, expect, it } from "vitest";
import { QledgerLedger, encodeQledgerDeposit, encodeQledgerTx, executeQledger, type QledgerEntry } from "@qorechain/rdk";
import { CHAIN_ID, ROLLUP_ID, RailSim, accountFromSeed } from "../src/sim.js";
import { honestClaim } from "../src/receipt.js";
import { watch, type PostedBatch } from "../src/watchtower.js";

const alice = accountFromSeed(new Uint8Array(32).fill(1));
const bob = accountFromSeed(new Uint8Array(32).fill(2));

/** Three honest batches: a deposit, then two transfers. Returns the empty start ledger too. */
function history(): { start: QledgerLedger; batches: PostedBatch[] } {
  const sim = new RailSim();
  const start = sim.ledger.clone() as QledgerLedger;
  const run = new QledgerLedger();
  const make = (entries: QledgerEntry[], i: number): PostedBatch => {
    const claim = honestClaim(run, entries, i);
    executeQledger({ chainId: CHAIN_ID, rollupId: ROLLUP_ID }, run, entries);
    return { entries, claim };
  };
  const b0 = make([{ height: 1n, poster: "deposit:qor1d", payload: encodeQledgerDeposit(alice.accountId, 10_000_000n) }], 0);
  const b1 = make([{ height: 2n, poster: "qor1sub", payload: encodeQledgerTx(sim.signTransfer(alice, bob, 1_000_000n, 0n)) }], 1);
  const b2 = make([{ height: 3n, poster: "qor1sub", payload: encodeQledgerTx(sim.signTransfer(alice, bob, 2_000_000n, 1n)) }], 2);
  return { start, batches: [b0, b1, b2] };
}

describe("watchtower", () => {
  it("passes an honest history", () => {
    const { start, batches } = history();
    expect(watch(start, batches)).toEqual({ checked: 3, challenge: null });
  });
  it("challenges the first forged batch and carries the right roots", () => {
    const { start, batches } = history();
    const honest = batches[1]!.claim.stateRoot;
    batches[1] = { ...batches[1]!, claim: { ...batches[1]!.claim, stateRoot: "cd".repeat(32) } };
    const r = watch(start, batches);
    expect(r.challenge?.batchIndex).toBe(1);
    expect(r.challenge?.expected.stateRoot).toBe(honest);
    expect(r.checked).toBe(2);
  });
  it("challenges a batch that drops an entry", () => {
    const { start, batches } = history();
    batches[2] = { ...batches[2]!, entries: [] };
    expect(watch(start, batches).challenge?.batchIndex).toBe(2);
  });
  it("challenges a batch posted out of order", () => {
    const { start, batches } = history();
    const r = watch(start, [batches[0]!, batches[2]!]);
    expect(r.challenge?.errors[0]).toMatch(/expected/);
  });
  it("does not change the starting ledger", () => {
    const { start, batches } = history();
    const before = Buffer.from(start.root()).toString("hex");
    watch(start, batches);
    expect(Buffer.from(start.root()).toString("hex")).toBe(before);
  });
});
