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

/** Check a manifest file (for example one exported by Veilbooks Desk). Throws on the first problem. */
export function parseManifest(json: string): Manifest {
  const m = JSON.parse(json) as Manifest;
  if (typeof m.runId !== "string" || !m.runId) throw new Error("manifest: missing runId");
  if (!Array.isArray(m.lines) || m.lines.length === 0) throw new Error("manifest: no lines");
  const seen = new Set<string>();
  for (const [i, l] of m.lines.entries()) {
    if (!l.invoiceId || seen.has(l.invoiceId)) throw new Error(`manifest line ${i + 1}: missing or duplicate invoiceId`);
    seen.add(l.invoiceId);
    if (!/^qor1[0-9a-z]{20,}$/.test(l.payee)) throw new Error(`manifest line ${i + 1}: bad payee`);
    if (!/^[1-9]\d*$/.test(l.amountUqor)) throw new Error(`manifest line ${i + 1}: bad amount`);
  }
  return { runId: m.runId, lines: m.lines.map((l) => ({ invoiceId: l.invoiceId, payee: l.payee, amountUqor: l.amountUqor })) };
}
