# Veilbooks Rail

> The quantum-safe settlement rail for private business payments.

Part of Veilbooks: business payments with the amounts veiled, safe from quantum attacks.

Post-quantum settlement rollup for private business payments.

Entry in the QoreChain "Build Before Q-Day" developer fest, category: Protocol Builders. Apache-2.0.

_Work in progress._

## Try it (no wallet, no funds)
```sh
cd rollup && npm install
npm test        # 19 tests: ledger, attacks, sealed manifest, receipt verifier
npm run demo    # deposit, payroll run, sealed manifest, honest and forged batches
```
The on-chain steps (create rollup, bond, deposit, post, submit batch) need a funded operator and are not done yet. See [THREAT_MODEL.md](THREAT_MODEL.md) for what is and is not protected.

## Status
Work in progress for the QoreChain "Build Before Q-Day" developer fest (deadline 2 December 2026). Network: QoreChain testnet `qorechain-diana`.

## The Veilbooks suite
| Repo | Role | Category |
|---|---|---|
| [veilbooks-rail](https://github.com/ayushsingh82/veilbooks-rail) | Settlement rollup | Protocol Builders |
| [veilbooks-desk](https://github.com/ayushsingh82/veilbooks-desk) | Sealed invoices and payroll app | Encrypted Apps |
| [veilbooks-steward](https://github.com/ayushsingh82/veilbooks-steward) | Agent that pays within signed limits | Post-Quantum AI Agents |
| [veilbooks-core](https://github.com/ayushsingh82/veilbooks-core) | Shared library | not entered |

## How it works
A `qledger-v1` optimistic rollup built with the QoreChain RDK. Users deposit uqor, transfer between ML-DSA accounts and withdraw. Payment manifests are committed through the rollup inbox. Receipts and a watchtower are planned.

## Licence
Apache-2.0. AI use is documented in [AI_USAGE.md](AI_USAGE.md).
