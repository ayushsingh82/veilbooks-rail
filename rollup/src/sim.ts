import {
  QledgerLedger,
  encodeQledgerDeposit,
  encodeQledgerTx,
  executeQledger,
  qledgerKeypairFromSeed,
  signQledgerTx,
  type QledgerEntry,
  type QledgerResult,
} from "@qorechain/rdk";

export const CHAIN_ID = "qorechain-diana";
export const ROLLUP_ID = "veilbooks-rail";
const env = { chainId: CHAIN_ID, rollupId: ROLLUP_ID };

export type Account = ReturnType<typeof qledgerKeypairFromSeed>;

/** A deterministic ML-DSA-44 account from a 32-byte seed (tests and demos only). */
export function accountFromSeed(seed: Uint8Array): Account {
  return qledgerKeypairFromSeed(seed);
}

/**
 * A local model of the rollup: the same state machine the chain re-executes on a challenge.
 * Use it to check what a batch must publish before spending fees on testnet.
 */
export class RailSim {
  readonly ledger = new QledgerLedger();
  private height = 1n;
  private nonces = new Map<string, bigint>();

  private entry(poster: string, payload: Uint8Array): QledgerEntry {
    return { height: this.height++, poster, payload };
  }

  private run(entries: QledgerEntry[]): QledgerResult {
    return executeQledger(env, this.ledger, entries);
  }

  deposit(depositor: string, to: Account, amountUqor: bigint): QledgerResult {
    return this.run([this.entry(`deposit:${depositor}`, encodeQledgerDeposit(to.accountId, amountUqor))]);
  }

  /** Build a signed transfer. `nonce` defaults to the account's next nonce. */
  signTransfer(from: Account, to: Account, amountUqor: bigint, nonce?: bigint) {
    return signQledgerTx({ ...env, secretKey: from.secretKey, publicKey: from.publicKey, nonce: nonce ?? this.next(from), amount: amountUqor, to: to.accountId });
  }

  signWithdraw(from: Account, recipientQor1: string, amountUqor: bigint, nonce?: bigint) {
    return signQledgerTx({ ...env, secretKey: from.secretKey, publicKey: from.publicKey, nonce: nonce ?? this.next(from), amount: amountUqor, recipient: recipientQor1 });
  }

  /** Post a signed tx into the next batch. A bad tx is a no-op, exactly as on chain. */
  post(poster: string, tx: ReturnType<typeof signQledgerTx>): QledgerResult {
    return this.run([this.entry(poster, encodeQledgerTx(tx))]);
  }

  /** Post raw bytes (for tamper tests). */
  postRaw(poster: string, payload: Uint8Array): QledgerResult {
    return this.run([this.entry(poster, payload)]);
  }

  balance(a: Account): bigint {
    return this.ledger.get(a.accountId).balance;
  }
  nonce(a: Account): bigint {
    return this.ledger.get(a.accountId).nonce;
  }
  private next(a: Account): bigint {
    return this.nonce(a);
  }
}
