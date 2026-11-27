import { createHash } from "node:crypto";
import { kemKeypairFromSeed, openEnvelope, postedDataHash, sealEnvelope } from "@qorechain/rdk";
import { CHAIN_ID, ROLLUP_ID } from "./sim.js";

/** One line of a payment run. Amounts are uqor decimal strings. */
export interface ManifestLine {
  invoiceId: string;
  payee: string; // qor1...
  amountUqor: string;
}

export interface Manifest {
  runId: string;
  lines: ManifestLine[];
}

export interface Member {
  member: string; // qor1 address of the operator or auditor
  encapsulationKey: Uint8Array;
}

const enc = new TextEncoder();

function canonical(m: Manifest): Uint8Array {
  const lines = [...m.lines].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
  return enc.encode(JSON.stringify({ runId: m.runId, lines }));
}

/** Total of a manifest in uqor, as a bigint. */
export function manifestTotal(m: Manifest): bigint {
  return m.lines.reduce((t, l) => t + BigInt(l.amountUqor), 0n);
}

/** SHA-256 of the canonical manifest. It reveals nothing about the amounts. */
export function manifestDigest(m: Manifest): string {
  return createHash("sha256").update(canonical(m)).digest("hex");
}

/**
 * Seal a manifest to the operator and auditor (ML-KEM envelope, the form a private rollup requires).
 * The result is what gets posted with postRollupData. `dataHash` is the hash the chain records.
 */
export function sealManifest(m: Manifest, members: Member[], epoch = 1): { envelope: Uint8Array; dataHash: string; digest: string } {
  if (members.length === 0) throw new Error("sealManifest: at least one member is required");
  const envelope = sealEnvelope({ chainId: CHAIN_ID, rollupId: ROLLUP_ID, epoch, recipients: members, plaintext: canonical(m) });
  const dataHash = Buffer.from(postedDataHash(envelope)).toString("hex");
  return { envelope, dataHash, digest: manifestDigest(m) };
}

/** Open a sealed manifest and check it matches the digest that was committed. */
export function openManifest(envelope: Uint8Array, member: string, decapsulationKey: Uint8Array, expectedDigest: string): Manifest {
  const bytes = openEnvelope({ envelope, chainId: CHAIN_ID, rollupId: ROLLUP_ID, member, decapsulationKey });
  const m = JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
  if (manifestDigest(m) !== expectedDigest) throw new Error("openManifest: digest mismatch");
  return m;
}

/** A deterministic ML-KEM key pair for tests and demos. */
export function memberKeys(seed: Uint8Array) {
  return kemKeypairFromSeed(seed);
}
