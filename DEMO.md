# Demo run-sheet: Veilbooks Rail (about 3 minutes)

Have ready: a terminal in `rollup/`, the browser page (`cd web && npm run dev`), and the tx hashes from the README.

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | README title and the problem section | "Businesses pay people in bulk. On a public chain every salary is visible, and today's signatures are expected to break once quantum computers exist." |
| 0:20 | `npm run demo` | "Here is a payroll run. Five transfers are deposited and signed with post-quantum keys. The manifest is sealed to the operator and an auditor. Only its digest is public." |
| 0:50 | End of the demo output (forged root caught) | "A dishonest operator publishes a wrong state root, or drops a transfer. Anyone can replay the batch and see that it does not match." |
| 1:10 | Browser page, section 1 and 2 | "This is the live rollup on the QoreChain testnet. Two batches, both finalized. Each batch starts from the previous batch's state root. Anyone can check that from public data." |
| 1:40 | Browser page, section 3 | "The watchtower builds an honest history, then attacks it six ways: a forged root, a dropped transfer, a wrong parent, a replayed batch, a skipped batch. It raises a challenge for every attack and none for the honest history." |
| 2:10 | README, Live testnet run table | "This all ran on the testnet: bond, deposit, transfers, two batches, and a withdrawal paid out with a Merkle proof after the challenge window." |
| 2:40 | THREAT_MODEL.md | "Every claim is marked tested, by design or planned. Posting a challenge on chain is planned. We say so." |

Before recording: `npm test` and `npm run judge` should both pass.
