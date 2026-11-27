# Threat model: Veilbooks Rail

Status: draft. Claims marked **tested** have a test in `rollup/test/`. Claims marked **planned** are not built yet. Anything not listed is not protected.

## What Rail is
A `qledger-v1` optimistic rollup on the QoreChain testnet. Accounts are ML-DSA-44. Operations are deposit, transfer and withdraw in uqor. Payment manifests are sealed with ML-KEM and posted through the rollup inbox.

## Assets
1. Balances held in rollup accounts.
2. The contents of payment manifests (who was paid how much).
3. The integrity of the published state root and withdrawals root.

## Attackers and what stops them

| Attacker | Attempt | Result | Status |
|---|---|---|---|
| Someone who stole a user's classical (secp256k1) key | Spend from a rollup account | Rollup accounts are controlled only by an ML-DSA-44 key. A classical key cannot produce a valid rollup signature. | By design (account id is derived from the ML-DSA public key); the stranger test covers an unrelated key |
| Replayer | Post the same signed transfer twice | The second one does nothing (nonce already used) | **tested** |
| Editor | Change the amount of a signed transfer | Signature no longer verifies, no effect | **tested** |
| Tamperer | Flip bits in a posted transaction | Refused, no effect | **tested** |
| Overspender | Transfer more than the balance | No effect | **tested** |
| Wrong-nonce sender | Skip or reuse a nonce | No effect | **tested** |
| Stranger | Sign with their own key to move another account's funds | Only their own account is affected | **tested** |
| Dishonest operator | Publish a state root that does not match the inbox | Re-execution gives a different root; `verifyBatch` flags it. On chain, a challenger wins during the challenge window. | **tested** (verifier); on-chain challenge **planned** |
| Dishonest operator | Publish a wrong parent root, or skip a posted entry | Flagged by `verifyBatch` | **tested** |
| Dishonest operator | Replay an old batch, skip a batch index, or forge a root deep in a history | The watchtower replays the history in order and reports the first bad batch with the roots it should have published | **tested** (`npm run judge`); posting the challenge on chain **planned** |
| Observer of the chain | Read manifest contents | Manifests are ML-KEM envelopes; amounts do not appear in the posted bytes | **tested** (no plaintext amount in envelope); only members can open |
| Non-member | Open a sealed manifest | Refused | **tested** |
| Quantum-capable attacker (later) | Harvest posted envelopes now, break them later | ML-KEM-1024 is designed to resist this | Relies on the library, not tested here |

## Not protected / known limits
- **Currency:** uqor only. No other tokens.
- **Scheme:** the rollup's account scheme is ML-DSA-44, not ML-DSA-87. This is the rollup's only supported scheme.
- **Operator availability:** one dedicated operator posts batches. If it stops, users wait. Forced exit through the inbox is **planned**, not built.
- **Metadata:** poster addresses, post sizes and timing are public.
- **Manifest members:** anyone in the member list can read the whole manifest. The auditor sees every line.
- **Off-chain code:** the web app, key storage and the agent are outside this model (see their repos).
- **Testnet:** all keys and funds are test-only.

## How to check
`cd rollup && npm install && npm test && npm run judge`
