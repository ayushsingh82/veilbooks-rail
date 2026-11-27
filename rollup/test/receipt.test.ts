import { describe, expect, it } from "vitest";
import { QledgerLedger, encodeQledgerDeposit, encodeQledgerTx, type QledgerEntry } from "@qorechain/rdk";
import { RailSim, accountFromSeed } from "../src/sim.js";
import { honestClaim, verifyBatch } from "../src/receipt.js";

const alice = accountFromSeed(new Uint8Array(32).fill(1));
const bob = accountFromSeed(new Uint8Array(32).fill(2));

function setup() {
  const sim = new RailSim();
  const prev = sim.ledger.clone() as QledgerLedger; // empty ledger before the batch
  const deposit: QledgerEntry = { height: 1n, poster: "deposit:qor1d", payload: encodeQledgerDeposit(alice.accountId, 10_000_000n) };
  const tx = sim.signTransfer(alice, bob, 2_000_000n, 0n);
  const transfer: QledgerEntry = { height: 2n, poster: "qor1sub", payload: encodeQledgerTx(tx) };
  return { prev, entries: [deposit, transfer] };
}

describe("verifyBatch", () => {
  it("accepts an honest batch", () => {
    const { prev, entries } = setup();
    expect(verifyBatch(prev, entries, honestClaim(prev, entries, 0)).ok).toBe(true);
  });
  it("rejects a forged state root", () => {
    const { prev, entries } = setup();
    const c = honestClaim(prev, entries, 0);
    const bad = verifyBatch(prev, entries, { ...c, stateRoot: "ab".repeat(32) });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join()).toMatch(/stateRoot/);
  });
  it("rejects a wrong parent root", () => {
    const { prev, entries } = setup();
    const c = honestClaim(prev, entries, 0);
    expect(verifyBatch(prev, entries, { ...c, prevStateRoot: "cd".repeat(32) }).errors.join()).toMatch(/prevStateRoot/);
  });
  it("rejects a batch that skips a posted entry", () => {
    const { prev, entries } = setup();
    const c = honestClaim(prev, entries, 0);
    expect(verifyBatch(prev, entries.slice(0, 1), c).ok).toBe(false);
  });
  it("does not modify the ledger it is given", () => {
    const { prev, entries } = setup();
    const before = Buffer.from(prev.root()).toString("hex");
    verifyBatch(prev, entries, honestClaim(prev, entries, 0));
    expect(Buffer.from(prev.root()).toString("hex")).toBe(before);
  });
});
