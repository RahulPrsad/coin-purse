# Hackathon acceptance audit

Result: **10/10 stated code checks meet the supplied rubric in this local review.** Their published weights total **80 points**. This is a reproducible self-audit, not an official judge score or a guarantee of the remaining 20 judgment points.

Verification: **30 automated tests passed, 0 failed** on Node 24.16.0. The credential scanner passed against tracked and unignored submission-candidate files. No new testnet purchases were made during this audit.

| # | Published check | Weight | Local result | Code and evidence |
|---|---|---:|---|---|
| 1 | Payments made through x402 client or manual payload construction | 4 | PASS | [buyer](../src/buyer.mjs) reads PAYMENT-REQUIRED and sends PAYMENT-SIGNATURE; [signer](../src/signer.mjs) constructs v2 exact EIP-3009 payloads using viem. Real signature recovery test and 3 previous confirmed testnet transactions. Manual construction is expressly allowed by the rubric. |
| 2 | Paid fetch exposed as a model tool | 4 | PASS | [tool schema](../src/buyer.mjs), [Groq model loop](../src/groq.mjs), optional [Anthropic loop](../src/agent.mjs). Tests verify model-selected calls and tool-result round trips. Real Groq run selected rainfall, prices and satellite. |
| 3 | Runnable rogue seller | 5 | PASS | [sellers](../src/sellers.mjs) exposes six deliberately hostile routes; npm run sellers or npm run testnet starts both stalls. Real HTTP integration exercises all routes. |
| 4 | No credentials in tracked files | 8 | PASS for current submission candidates | [.gitignore](../.gitignore) excludes .env, data and reports; [.env.example](../.env.example) has blank secrets. [scanner](../scripts/check-secrets.mjs) checks tracked and unignored files, known current local secrets without printing them, credential patterns and nonblank example secrets. Test keys are ephemeral and generated in memory. Public addresses and transaction hashes are not secrets. |
| 5 | Per-call ceiling compared before signing | 18 | PASS | [validateQuote](../src/policy.mjs) compares BigInt amount with explicit configured perCall. [reserve](../src/ledger.mjs) invokes validation before [buyer](../src/buyer.mjs) calls signer.sign. Overpriced/injection tests assert zero signer calls; exact ceiling test succeeds. |
| 6 | Cumulative budget checked before signing | 10 | PASS | [reserve](../src/ledger.mjs) checks committed() + amount against budget within BEGIN IMMEDIATE. Tests cover next-payment refusal, exact total boundary and concurrent connections; denied calls never sign. |
| 7 | Spend persisted outside memory | 7 | PASS | [SQLite ledger](../src/ledger.mjs) uses WAL, synchronous FULL and durable reservations before signing; totals are read from stored decisions. Restart tests prove reservations survive and block overspend. |
| 8 | Network and asset allowlist | 10 | PASS | [policy](../src/policy.mjs) explicitly permits only eip155:84532 and the configured constant Base Sepolia USDC contract. Unknown network/token tests show refusal before signing; recipient and EIP-712 domain are also checked. |
| 9 | Tool arguments cannot set spending limits | 8 | PASS | Endpoint-only schema, additionalProperties:false, and runtime exact-field validation in [buyer](../src/buyer.mjs). Limits originate in environment config and are copied/frozen in the ledger; a changed policy for the same run fails. Seller text is not parsed into policy. |
| 10 | Integer base-unit monetary arithmetic | 6 | PASS | [units](../src/policy.mjs) returns BigInt; [ledger](../src/ledger.mjs) sums BigInt and stores strings. Tests reject fractional/scientific amounts and preserve totals above Number.MAX_SAFE_INTEGER across SQLite restart. Number usage is confined to ports/timeouts/timestamps, not money. |

## Reproduce locally

Run from the project folder:

~~~sh
npm ci
npm run check:secrets
npm test
~~~

These checks do not spend test USDC or call a paid LLM. CI runs the credential scanner and tests on Node 22 and 24; the remote CI runs themselves have not yet been observed.

## Existing real testnet evidence

[Decision record](../examples/testnet/decisions.json) and [audit report](../examples/testnet/audit.html) contain 3 confirmed payments totaling **150000 base units = 0.15 test USDC**. All 6 hostile scenario types were refused. The record retains 12 refusals from two attempts of the same run; it did not reset spending history. The earlier successful run independently verified USDC Transfer and AuthorizationUsed events. This audit checked the stored evidence consistency without resending payments.

The LLM research is based on explicitly synthetic data. [Research review notes](../examples/testnet/README.md) identify the model's +18%/±18% wording issue and clarify that the model's no-refusals statement concerns its honest research calls, while the separate hostile checks were refused. Original model output is retained transparently.

## Submission status and limitations

- Source, tests, README, both sellers and real testnet record are present.
- Git has been initialized locally; publication to a public repository is still pending a destination. Re-run the credential scan immediately before committing/pushing. Pattern scanning is not proof against every possible secret format; do not force-add .env.
- Private keys previously pasted into chat must remain revoked/replaced; chat exposure cannot be undone by .gitignore.
- These are the 10 supplied checks, not undisclosed organizer tests. Final scoring belongs to the organizers.
- Budgets are per run/database. Deleting the ledger, switching run IDs, compromising the host or spending elsewhere in the wallet is outside the enforcement boundary; see [threat model](THREAT-MODEL.md).
