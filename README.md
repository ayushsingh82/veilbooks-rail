# Veilbooks Rail

> The quantum-safe settlement rail for private business payments.

Veilbooks Rail is an optimistic rollup on QoreChain using the `qledger-v1` execution model. Accounts are controlled by post-quantum (ML-DSA-44) keys, payments are batched and settled with verifiable state roots, and payment manifests are sealed with ML-KEM so that amounts and recipients are not exposed on chain.

## Features

- **Deposit, transfer and withdraw** in uqor between ML-DSA-44 accounts.
- **Local ledger simulator** that runs the same state machine the chain re-executes on a challenge, so a batch can be checked before it is submitted.
- **Sealed payment manifests**: a payment run is encrypted to the operator and an auditor (ML-KEM envelope) and committed by digest.
- **Batch receipt verifier**: independently re-executes a batch and compares state and withdrawal roots, flagging forged roots, wrong parents and dropped entries.
- **Threat model** tied to the test suite: see [THREAT_MODEL.md](THREAT_MODEL.md).

## Quick start

Requires Node.js 20 or newer.

```sh
cd rollup
npm install
npm test        # ledger, attack cases, sealed manifest, receipt verifier
npm run demo    # deposit, payroll run, sealed manifest, honest and forged batches
npm run judge   # watchtower replays a history and catches 5 attacks plus 1 control
```

The demo needs no network and no funds.

## How it works

1. A company **deposits** uqor into an ML-DSA-44 account on the rollup.
2. A payment run is a set of **signed transfers**, one per recipient, posted to the rollup inbox.
3. The run's **manifest** is sealed to the operator and auditor, and only its digest is public.
4. The operator publishes a **batch** with a state root. Anyone can re-execute it with the receipt verifier; a mismatch is a fraud proof candidate during the challenge window.
5. Recipients **withdraw** to their `qor1` addresses.

## Repository layout

| Path | Contents |
| --- | --- |
| `rollup/rollup.config.ts` | Rollup configuration (optimistic, based sequencing, `qledger-v1`) |
| `rollup/src/sim.ts` | Local ledger simulator |
| `rollup/src/manifest.ts` | Sealed payment manifests |
| `rollup/src/receipt.ts` | Batch receipt verifier |
| `rollup/src/demo.ts` | Offline walk-through |
| `rollup/src/watchtower.ts` | Replays posted batches and reports the first bad one as a challenge |
| `rollup/src/judge.ts` | Attack checks a judge can run offline |
| `rollup/src/{doctor,create,submit-batch,query-status}.ts` | Operator scripts for the testnet |

## Status and limits

- The offline logic is complete and tested. Creating the rollup, bonding a submitter, depositing and submitting batches on the testnet is not yet done: it needs a funded operator account.
- The rollup moves **uqor only**, and its only account scheme is ML-DSA-44.
- A single dedicated operator submits batches. Forced exit through the inbox is planned, not built.

## Configuration

Copy `rollup/.env.example` to `rollup/.env` and set `QORE_MNEMONIC` (or `QORE_OPERATOR_PRIVATE_KEY_HEX` with `QORE_PQC_SEED_HEX`). Use a testnet-only key. Never commit `.env`.

## The Veilbooks suite

| Repository | Role |
| --- | --- |
| [veilbooks-rail](https://github.com/ayushsingh82/veilbooks-rail) | Settlement rollup for private business payments |
| [veilbooks-desk](https://github.com/ayushsingh82/veilbooks-desk) | Sealed invoices and payroll for people and auditors |
| [veilbooks-steward](https://github.com/ayushsingh82/veilbooks-steward) | Agent that pays invoices within limits the owner signed |
| [veilbooks-core](https://github.com/ayushsingh82/veilbooks-core) | Shared library: sealing, commitments, key registration |

Veilbooks keeps business payment amounts private, with signatures and encryption designed to remain secure against quantum attacks. It runs on the QoreChain testnet (`qorechain-diana`).

## Licence and AI use

Apache-2.0. See [AI_USAGE.md](AI_USAGE.md) for how AI tools were used.
