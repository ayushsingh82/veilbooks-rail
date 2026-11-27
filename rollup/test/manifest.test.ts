import { describe, expect, it } from "vitest";
import { manifestDigest, manifestTotal, memberKeys, openManifest, parseManifest, sealManifest, type Manifest } from "../src/manifest.js";

const m: Manifest = { runId: "payroll-nov", lines: [
  { invoiceId: "b", payee: "qor1bob", amountUqor: "3000000" },
  { invoiceId: "a", payee: "qor1ann", amountUqor: "2000000" },
] };
const op = memberKeys(new Uint8Array(64).fill(7));
const aud = memberKeys(new Uint8Array(64).fill(8));
const eve = memberKeys(new Uint8Array(64).fill(9));
const members = [
  { member: "qor1operator", encapsulationKey: op.publicKey },
  { member: "qor1auditor", encapsulationKey: aud.publicKey },
];

describe("sealed manifest", () => {
  const sealed = sealManifest(m, members);
  it("operator and auditor can open it and the digest matches", () => {
    expect(openManifest(sealed.envelope, "qor1operator", op.secretKey, sealed.digest).runId).toBe("payroll-nov");
    expect(manifestTotal(openManifest(sealed.envelope, "qor1auditor", aud.secretKey, sealed.digest))).toBe(5_000_000n);
  });
  it("a non-member cannot open it", () => {
    expect(() => openManifest(sealed.envelope, "qor1eve", eve.secretKey, sealed.digest)).toThrow();
  });
  it("a wrong digest is refused", () => {
    expect(() => openManifest(sealed.envelope, "qor1operator", op.secretKey, "00".repeat(32))).toThrow(/digest/);
  });
  it("line order does not change the digest", () => {
    expect(manifestDigest({ ...m, lines: [...m.lines].reverse() })).toBe(sealed.digest);
  });
  it("the envelope does not contain the amounts in clear", () => {
    expect(Buffer.from(sealed.envelope).includes(Buffer.from("3000000"))).toBe(false);
  });
});

describe("parseManifest", () => {
  const P = "qor1" + "a".repeat(38);
  const ok = JSON.stringify({ runId: "r", lines: [{ invoiceId: "i1", payee: P, amountUqor: "5" }] });
  it("accepts a good manifest", () => expect(parseManifest(ok).lines).toHaveLength(1));
  it("rejects a duplicate invoice id", () => expect(() => parseManifest(JSON.stringify({ runId: "r", lines: [{ invoiceId: "i", payee: P, amountUqor: "5" }, { invoiceId: "i", payee: P, amountUqor: "6" }] }))).toThrow(/duplicate/));
  it("rejects a bad amount", () => expect(() => parseManifest(JSON.stringify({ runId: "r", lines: [{ invoiceId: "i", payee: P, amountUqor: "-1" }] }))).toThrow(/amount/));
  it("drops extra fields such as names", () => expect(JSON.stringify(parseManifest(JSON.stringify({ runId: "r", lines: [{ invoiceId: "i", payee: P, amountUqor: "5", name: "Ann" }] })))).not.toMatch(/Ann/));
});
