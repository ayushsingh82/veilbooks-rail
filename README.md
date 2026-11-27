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
npm run seal-manifest -- run.json   # seal a manifest exported from Veilbooks Desk
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

- The offline logic is complete and tested, and the full flow has run on the QoreChain testnet (`qorechain-diana`): the rollup `veilbooks-rail` is active, a submitter is bonded (1,000 QOR), 100 QOR was deposited, two transfers were posted, and batch 0 (3 entries) was submitted. The state root on chain, `9bff8066cc904e14819cdcd25adad126e0994593d489361b553a2111a9b9af6d`, matches the root computed locally.
- The batch is inside its challenge window. Finalising it and withdrawing are not yet done.
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

## Testnet run

| Step | Transaction |
| --- | --- |
| Bond submitter | `94AD97EC68833F7D0FBD323E9A74DE00F21F0FAB9C45265C85C000AC2DA7348B` |
| Deposit 100 QOR | `880AB1CBD4CEC98336BAA60419E351C735E5C920DAD0694F8CD3FEF71EC057E6` |
| Transfer 20 QOR | `2A0769C7B4276C9CD4F2B09F67378F416CBB56C3E3CB487348297438E7207C52` |
| Transfer 30 QOR | `E7821FC9759E8E5F5117E229B00E208447E7238C451CB2907DA9ADE0D12B167E` |
| Submit batch 0 | `4A6FE51A66D5B0652C7E035BFC41A1850F0E2CF2D484E55A8125AAAF0C79D6B1` |
