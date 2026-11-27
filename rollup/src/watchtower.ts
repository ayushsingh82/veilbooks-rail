import { executeQledger, type QledgerEntry, type QledgerLedger } from "@qorechain/rdk";
import { CHAIN_ID, ROLLUP_ID } from "./sim.js";
import { verifyBatch, type BatchClaim } from "./receipt.js";

export interface PostedBatch {
  entries: QledgerEntry[];
  claim: BatchClaim;
}

export interface Challenge {
  batchIndex: number;
  errors: string[];
  /** What the operator should have published. This is the evidence a challenge carries. */
  expected: { stateRoot: string; withdrawalsRoot: string };
  claimed: { stateRoot: string; withdrawalsRoot: string };
}

export interface WatchReport {
  checked: number;
  /** The first bad batch, or null when every batch re-executes to the roots it claimed. */
  challenge: Challenge | null;
}

/**
 * Walk a run of posted batches from a known starting ledger. Each batch is re-executed on its own; the walk follows the
 * claimed history, so one forged batch is reported once at its index and the rest are not blamed on it. `start` is not modified.
 */
export function watch(start: QledgerLedger, batches: PostedBatch[]): WatchReport {
  let ledger = start.clone() as QledgerLedger;
  for (const [i, b] of batches.entries()) {
    if (b.claim.batchIndex !== i) {
      return { checked: i, challenge: { batchIndex: b.claim.batchIndex, errors: [`batch index ${b.claim.batchIndex} where ${i} was expected`], expected: { stateRoot: "", withdrawalsRoot: "" }, claimed: { stateRoot: b.claim.stateRoot, withdrawalsRoot: b.claim.withdrawalsRoot } } };
    }
    const check = verifyBatch(ledger, b.entries, b.claim);
    if (!check.ok) {
      return { checked: i + 1, challenge: { batchIndex: i, errors: check.errors, expected: check.expected, claimed: { stateRoot: b.claim.stateRoot, withdrawalsRoot: b.claim.withdrawalsRoot } } };
    }
    executeQledger({ chainId: CHAIN_ID, rollupId: ROLLUP_ID }, ledger, b.entries);
  }
  return { checked: batches.length, challenge: null };
}
