import { executeQledger, type QledgerEntry, type QledgerLedger } from "@qorechain/rdk";
import { CHAIN_ID, ROLLUP_ID } from "./sim.js";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** What a batch claims on chain. */
export interface BatchClaim {
  batchIndex: number;
  prevStateRoot: string; // hex
  stateRoot: string; // hex
  withdrawalsRoot: string; // hex, empty string when there is no withdrawal
}

export interface ReceiptCheck {
  ok: boolean;
  /** Reasons the batch is wrong. Empty when ok. */
  errors: string[];
  expected: { stateRoot: string; withdrawalsRoot: string };
}

/**
 * Independently re-execute a batch from the previous ledger and compare it with what was claimed.
 * This is the same check a challenger runs. `prev` is not modified.
 */
export function verifyBatch(prev: QledgerLedger, entries: QledgerEntry[], claim: BatchClaim): ReceiptCheck {
  const errors: string[] = [];
  if (hex(prev.root()) !== claim.prevStateRoot) errors.push("prevStateRoot does not match the ledger you hold");
  const work = prev.clone();
  const res = executeQledger({ chainId: CHAIN_ID, rollupId: ROLLUP_ID }, work, entries);
  const expected = { stateRoot: hex(res.stateRoot), withdrawalsRoot: hex(res.withdrawalsRoot) };
  if (expected.stateRoot !== claim.stateRoot) errors.push("stateRoot differs from re-execution");
  if (expected.withdrawalsRoot !== claim.withdrawalsRoot) errors.push("withdrawalsRoot differs from re-execution");
  return { ok: errors.length === 0, errors, expected };
}

/** Build the claim an honest operator would publish for these entries. */
export function honestClaim(prev: QledgerLedger, entries: QledgerEntry[], batchIndex: number): BatchClaim {
  const work = prev.clone();
  const res = executeQledger({ chainId: CHAIN_ID, rollupId: ROLLUP_ID }, work, entries);
  return { batchIndex, prevStateRoot: hex(prev.root()), stateRoot: hex(res.stateRoot), withdrawalsRoot: hex(res.withdrawalsRoot) };
}
