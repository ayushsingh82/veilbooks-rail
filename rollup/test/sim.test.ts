import { describe, expect, it } from "vitest";
import { encodeQledgerTx } from "@qorechain/rdk";
import { RailSim, accountFromSeed } from "../src/sim.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const alice = accountFromSeed(seed(1));
const bob = accountFromSeed(seed(2));
const QOR1 = "qor10fymynds2l93n07cnhkqqjggmavqzvrk6clclh";

function funded() {
  const s = new RailSim();
  s.deposit("qor1depositor", alice, 10_000_000n);
  return s;
}

describe("deposit, transfer, withdraw", () => {
  it("deposit credits the account", () => {
    expect(funded().balance(alice)).toBe(10_000_000n);
  });
  it("transfer moves funds and bumps the nonce", () => {
    const s = funded();
    s.post("qor1sub", s.signTransfer(alice, bob, 4_000_000n));
    expect(s.balance(alice)).toBe(6_000_000n);
    expect(s.balance(bob)).toBe(4_000_000n);
    expect(s.nonce(alice)).toBe(1n);
  });
  it("withdraw is recorded in the batch result", () => {
    const s = funded();
    const r = s.post("qor1sub", s.signWithdraw(alice, QOR1, 3_000_000n));
    expect(r.withdrawals).toHaveLength(1);
    expect(r.withdrawals[0]!.amount).toBe(3_000_000n);
    expect(s.balance(alice)).toBe(7_000_000n);
  });
});

describe("attacks are no-ops", () => {
  it("replaying a signed transfer does nothing the second time", () => {
    const s = funded();
    const tx = s.signTransfer(alice, bob, 1_000_000n);
    s.post("qor1sub", tx);
    s.post("qor1sub", tx);
    expect(s.balance(bob)).toBe(1_000_000n);
  });
  it("overspending does nothing", () => {
    const s = funded();
    s.post("qor1sub", s.signTransfer(alice, bob, 99_000_000n));
    expect(s.balance(bob)).toBe(0n);
    expect(s.balance(alice)).toBe(10_000_000n);
  });
  it("an edited amount invalidates the signature", () => {
    const s = funded();
    const tx = s.signTransfer(alice, bob, 1_000_000n);
    s.post("qor1sub", { ...tx, amount: 9_000_000n });
    expect(s.balance(bob)).toBe(0n);
  });
  it("a tampered transaction is refused", () => {
    const s = funded();
    const bytes = encodeQledgerTx(s.signTransfer(alice, bob, 1_000_000n));
    bytes[bytes.length - 1] ^= 1;
    s.postRaw("qor1sub", bytes);
    expect(s.balance(bob)).toBe(0n);
  });
  it("a wrong nonce does nothing", () => {
    const s = funded();
    s.post("qor1sub", s.signTransfer(alice, bob, 1_000_000n, 5n));
    expect(s.balance(bob)).toBe(0n);
  });
  it("a stranger cannot spend someone else's account", () => {
    const s = funded();
    const eve = accountFromSeed(seed(9));
    // Eve signs a transfer from her own key; alice's funds are untouched
    s.post("qor1sub", s.signTransfer(eve, bob, 1_000_000n, 0n));
    expect(s.balance(alice)).toBe(10_000_000n);
    expect(s.balance(bob)).toBe(0n);
  });
});
