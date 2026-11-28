import { useEffect, useMemo, useState } from "react";
import { runScenarios } from "../../rollup/src/scenarios";
import { Footer, Hero, Navbar, Steps } from "./chrome";

const ROLLUP = "veilbooks-rail";
const B = "/chain/qorechain/rdk/v1";
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

interface Rollup { status: string; creator: string; settlement_mode: string; execution_vm: string; challenge_window_sec: string; deposit_pool: string }
interface Batch { batch_index: string; state_root: string; prev_state_root: string; tx_count: string; status: string; withdrawals_root: string }

export function App() {
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const results = useMemo(() => runScenarios(), []);

  useEffect(() => {
    (async () => {
      try {
        const r = (await (await fetch(`${B}/rollup/${ROLLUP}`)).json()) as { rollup: Rollup };
        const b = (await (await fetch(`${B}/batches/${ROLLUP}`)).json()) as { batches: Batch[] };
        setRollup(r.rollup);
        setBatches([...b.batches].sort((x, y) => Number(x.batch_index) - Number(y.batch_index)));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // Each batch must start from the state root of the batch before it. Anyone can check this from public data.
  const links = batches.map((b, i) => (i === 0 ? null : b.prev_state_root === batches[i - 1]!.state_root));
  const allLinked = links.every((l) => l !== false);

  const jump = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <>
      <Navbar
        kind="rail"
        name="Veilbooks Rail"
        items={[{ label: "Rollup", href: "#rollup" }, { label: "Batches", href: "#batches" }, { label: "Watchtower", href: "#watchtower" }]}
        cta={{ label: "Run the checks", onClick: jump("watchtower") }}
      />
      <main>
      <Hero
        kicker="Settlement rollup"
        title="Settle payroll."
        accent="Without showing it."
        lead="A private payment rollup on QoreChain. Accounts use post-quantum keys, payment manifests are sealed, and anyone can replay a batch to check that the operator told the truth."
        chips={[{ text: "Live on testnet", hot: true }, { text: "ML-DSA-44 accounts" }, { text: "Optimistic, fraud-checked" }, { text: "Withdrawals with proofs" }]}
      />
      <Steps
        steps={[
          { title: "Deposit", text: "Put uqor into a rollup account controlled by a post-quantum key." },
          { title: "Pay", text: "Signed transfers go to the inbox, one per person. Manifests stay sealed." },
          { title: "Batch", text: "The operator posts a state root. Anyone can replay it from public data." },
          { title: "Withdraw", text: "After the challenge window, recipients withdraw with a Merkle proof." },
        ]}
      />

      <section className="panel" id="rollup">
        <h2>1. The rollup on chain</h2>
        {error && <p className="badtxt">Could not read the chain: {error}</p>}
        {rollup && (
          <table>
            <tbody>
              <tr><th>Rollup</th><td>{ROLLUP}</td></tr>
              <tr><th>Status</th><td><span className="tag pay">{rollup.status}</span></td></tr>
              <tr><th>Settlement</th><td>{rollup.settlement_mode}, challenge window {Number(rollup.challenge_window_sec) / 60} min</td></tr>
              <tr><th>State machine</th><td>{rollup.execution_vm}</td></tr>
              <tr><th>Deposited</th><td>{Number(rollup.deposit_pool) / 1e6} QOR</td></tr>
              <tr><th>Operator</th><td className="mono">{rollup.creator}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" id="batches">
        <h2>2. Batches and receipts</h2>
        <p className={allLinked ? "good" : "badtxt"}>{batches.length ? (allLinked ? "Every batch starts from the state root of the one before it." : "A batch does not start from the previous batch's root.") : "Loading…"}</p>
        <table>
          <thead><tr><th>#</th><th>Status</th><th>Entries</th><th>State root</th><th>Parent root</th><th>Link</th><th>Withdrawals root</th></tr></thead>
          <tbody>
            {batches.map((b, i) => (
              <tr key={b.batch_index}>
                <td>{b.batch_index}</td>
                <td><span className={`tag ${b.status === "finalized" ? "pay" : "escalate"}`}>{b.status}</span></td>
                <td>{b.tx_count}</td>
                <td className="mono">{short(b.state_root)}</td>
                <td className="mono">{short(b.prev_state_root)}</td>
                <td>{links[i] === null ? "start" : links[i] ? "ok" : "BROKEN"}</td>
                <td className="mono">{b.withdrawals_root ? short(b.withdrawals_root) : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">To check a batch's contents too, replay its entries from the previous ledger. <code>npm run judge</code> in <code>rollup/</code> does this for a history it builds itself.</p>
      </section>

      <section className="panel" id="watchtower">
        <h2>3. Watchtower attack checks</h2>
        <p className="note">An honest three-batch history is built here, then attacked six ways. The watchtower replays each batch and must raise a challenge for every attack and none for the control.</p>
        <table>
          <thead><tr><th>Check</th><th>Result</th><th>What it found</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.name}><td>{r.name}</td><td><span className={`tag ${r.pass ? "pay" : "reject"}`}>{r.pass ? "pass" : "FAIL"}</span></td><td>{r.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      </main>
      <Footer
        kind="rail"
        name="Veilbooks Rail"
        blurb="The quantum-safe settlement rail for private business payments."
        links={[
          { title: "Rail", items: [["The rollup", "#rollup"], ["Batches", "#batches"], ["Watchtower", "#watchtower"]] },
          { title: "Docs", items: [["Threat model", "https://github.com/ayushsingh82/veilbooks-rail/blob/main/THREAT_MODEL.md"], ["Testnet run", "https://github.com/ayushsingh82/veilbooks-rail#live-testnet-run"], ["Source", "https://github.com/ayushsingh82/veilbooks-rail"]] },
        ]}
      />
    </>
  );
}
