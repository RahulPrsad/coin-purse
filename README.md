# Coin Purse

An LLM research agent with a small, auditable x402 purse. It buys synthetic monsoon research fixtures from an honest seller and refuses hostile payment requirements from a rogue seller. Spending policy is enforced by ordinary code before signing, not by asking the model to behave.

**Implementation status:** real Groq tool-calling research run completed on Base Sepolia. Three confirmed x402 purchases spent 0.15 test USDC; all six hostile scenarios were refused. See examples/testnet for transaction hashes, decisions and research. The separate offline example is explicitly simulated. Public repository publication remains pending the repository destination.

## Quick start

Requires Node **22.13+** (Node 24 LTS recommended). SQLite is built into Node. No Python, database server, browser extension, or smart-contract deployment is required.

Run commands from this folder:

~~~sh
npm ci
npm test
npm run demo
~~~

Open **examples/offline-demo/audit.html**. The demo starts both HTTP sellers on temporary local ports, makes three simulated purchases, exercises six attacks, exports an audit, then shuts the sellers down. It uses no wallet, LLM key, or network service. It is a deterministic demonstration, not the LLM research mode.

## Fill in your .env

A blank .env has been created locally and is ignored by Git. On a fresh clone, copy .env.example to .env first. Only these three fields need your credentials or account details:

| Variable | What you enter |
| --- | --- |
| BUYER_PRIVATE_KEY | Private key of a **dedicated Base Sepolia test wallet**, kept locally |
| SELLER_ADDRESS | Public receiving address for test USDC, preferably a separate test account |
| LLM_API_KEY | Groq API key for the free-plan research agent |

The default agent uses Groq’s free plan with tool calling. Create a key at https://console.groq.com/keys and put it in LLM_API_KEY. Keep LLM_PROVIDER=groq, LLM_BASE_URL=https://api.groq.com/openai/v1 and LLM_MODEL=qwen/qwen3.8-27b. Stay on the Free plan; no paid upgrade is needed for this setup. Free quotas and model availability depend on the account; see https://console.groq.com/docs/rate-limits. A 429 stops the run safely: wait for the quota reset and retry with the same RUN_ID. The loop is capped at 12 turns and does not automatically switch to a paid provider.

Anthropic remains an optional adapter: set LLM_PROVIDER=anthropic, LLM_BASE_URL=https://api.anthropic.com, LLM_MODEL to an available Claude model, and LLM_API_KEY to an Anthropic key. That provider requires its own API credits. Never reuse a key across providers.

For MetaMask, create a separate test account and fund its public address with **5 test USDC on Base Sepolia**. A public address alone cannot authorize unattended payments; the CLI uses a local private-key signer. Never enter a seed phrase, mainnet key, or your regular wallet credentials. Do not paste secrets into chat. The seller only needs a public address. With a functioning gas-sponsored facilitator, the buyer signs EIP-3009 authorizations and does not send gas-paying transactions itself.

Defaults:

- Network: eip155:84532 (Base Sepolia), hard-coded allowlist.
- Asset: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (test USDC), hard-coded allowlist.
- PER_CALL_MAX=250000 → 0.25 USDC.
- RUN_BUDGET=5000000 → 5 USDC.
- Each honest fixture costs 50000 → 0.05 USDC.
- RUN_ID=arjun-testnet-001 persists across restarts.
- FACILITATOR_URL=https://x402.org/facilitator; it must support x402 v2 exact EVM on Base Sepolia.

Amounts must be canonical integer strings in six-decimal base units. Do not put 0.25 in PER_CALL_MAX. A run binds its original policy and wallet in SQLite: changing the budget or wallet with the same run ID fails. A new RUN_ID deliberately creates a **new** allowance; do not rotate run IDs to resume an unfinished run.

## Real testnet run

After installing dependencies, filling .env, and funding the buyer:

~~~sh
npm run testnet
~~~

This command starts both local sellers, exercises the six rogue cases, lets the LLM choose paid research tools, confirms successful transfers independently through RPC, and saves reports. The LLM receives only an endpoint ID tool; it never receives wallet secrets or a way to write config. The rogue probes are a deterministic acceptance check; honest research purchases are chosen by the model.

Outputs:

- reports/<RUN_ID>/audit.html — human-readable payment decisions and research.
- reports/<RUN_ID>/decisions.json — machine-readable decisions and purchased evidence.
- reports/<RUN_ID>/research.md — research synthesis.
- examples/testnet/ — publication-ready copies, exported only when the run contains a confirmed purchase and refusal.
- data/testnet.sqlite — durable private local ledger, ignored by Git.

Review and commit the examples/testnet files after a successful run. If the provider, wallet balance, RPC, or facilitator is unavailable, the command fails and keeps any existing payment reservations. It does not invent a receipt or silently substitute the simulation.

To run the sellers and agent separately, use two terminals:

~~~sh
# Terminal 1
npm run sellers
# Terminal 2
npm run agent -- "How might a wetter monsoon affect rice and maize prices?"
~~~

Rebuild an existing report without signing or requiring an LLM key:

~~~sh
npm run audit
~~~

## How payments are bounded

1. The model calls paid_fetch with an approved endpoint ID. No URL, budget, network, token, key, headers or policy overrides are tool arguments.
2. The buyer makes an unsigned GET. Redirects are refused.
3. A 402 response supplies the x402 v2 PAYMENT-REQUIRED header.
4. In a SQLite BEGIN IMMEDIATE transaction, code validates the scheme, chain, token, receiving address, domain and amount. It compares the quote with the per-call ceiling and committed spend plus quote with the total budget, all using BigInt.
5. It durably reserves the amount **before** asking the signer for a signature. Multiple processes sharing the same ledger and run cannot race past the limit.
6. viem signs the exact EIP-3009 TransferWithAuthorization message. The buyer constructs the x402 v2 payload manually and retries once with PAYMENT-SIGNATURE. Manual payload construction is explicitly accepted by the project rubric.
7. The honest seller uses the facilitator /verify and /settle endpoints. The buyer checks the receipt status and matching USDC Transfer plus AuthorizationUsed nonce before recording paid.
8. Timeout, crash, invalid receipt, signing failure or uncertain delivery keeps the reservation. No automatic retry can reclaim that allowance. Data delivery can fail even after payment succeeds; the ledger distinguishes confirmed payment from research availability.

The buyer intentionally supports one exact EIP-3009 offer per challenge. Multiple offers, other schemes, long timeouts, Permit2, unknown domains, assets or networks fail closed. It does not interpret seller text or extensions as authority.

## Hostile fixtures

| Endpoint | Attack | Expected refusal |
| --- | --- | --- |
| rogue-expensive | 4.99 USDC for one row | PER_CALL_LIMIT |
| rogue-asset | Unknown token | ASSET_NOT_ALLOWED |
| rogue-network | Mainnet chain | NETWORK_NOT_ALLOWED |
| rogue-injection | Claims the budget is now 100 USDC, quotes 4.99 | PER_CALL_LIMIT |
| rogue-malformed | Decimal amount instead of integer base units | INVALID_AMOUNT |
| rogue-recipient | Changes the payout address | RECIPIENT_NOT_ALLOWED |

The honest stall serves rainfall, prices and satellite JSON. **All datasets are explicitly synthetic fixtures**, including on a real payment run. The research note must not claim these are live observations or prove that forecasts cause price changes.

## Audit semantics

- refused: no signature was issued; zero commitment, quote recorded in the reason where available.
- reserved: committed durably; execution may have stopped before signing or completion.
- uncertain: signing or delivery could not be completed or confirmed; the amount remains committed.
- paid: transfer and authorization nonce independently confirmed through the configured Base Sepolia RPC.
- simulated: offline fake authorization, counts against demo allowance only; never a real receipt.
- free: successful response without payment.

The HTML escapes seller/model text and executes no JavaScript. Signatures, keys and LLM authorization headers are never written to the ledger. Persistent budgets protect this agent, not an entire wallet: external transactions, different ledgers, new run IDs, a compromised host, or deletion of the database are outside the policy boundary. Keep the dedicated wallet balance small and preserve the ledger. Reservations are deliberately conservative; there is no automatic refund/reconciliation tool.

## Scored acceptance map

| Check | Implementation / evidence |
| --- | --- |
| 1. x402 payment handling | src/buyer.mjs, src/signer.mjs: v2 headers and manual payload construction |
| 2. Model chooses paid tool | src/agent.mjs, src/buyer.mjs: Groq/Anthropic tool loops and paid_fetch schema |
| 3. Runnable rogue seller | src/sellers.mjs: six hostile endpoints |
| 4. No tracked credentials | .gitignore, placeholder-only .env.example; ephemeral test keys generated in memory |
| 5. Per-call limit before signing | src/policy.mjs validateQuote; src/ledger.mjs reserve before signer |
| 6. Cumulative budget before signing | src/ledger.mjs: committed + amount <= budget |
| 7. Durable spend | SQLite WAL + synchronous FULL, restored on same run ID |
| 8. Network / asset allowlist | src/policy.mjs: exact Base Sepolia + test USDC |
| 9. Tool cannot change limits | endpoint-only schema plus strict runtime argument validation |
| 10. Integer arithmetic | BigInt parsing, comparisons and totals; string storage |

Tests cover all hostile quotes, honest flow, exact boundary arithmetic, cumulative exhaustion, restart, changed config, concurrent connections, uncertainty, repeated 402, malformed challenges, unauthorized tool fields, actual HTTP stalls, model tool round trips, and cryptographic signature recovery. See test/.

## Publish the deliverable

A local Git repository is prepared. No GitHub repository has been created or uploaded because no destination/account was supplied. After the testnet run, review files and publish to your chosen **public** repository:

~~~sh
git status --short
git add .
git commit -m "Build bounded x402 research purse"
git branch -M main
git remote add origin YOUR_PUBLIC_REPOSITORY_URL
git push -u origin main
~~~

.env, node_modules, private data and reports are ignored. The selected examples are publishable, but inspect research/evidence content for anything personal before committing. Do not use git add -f on .env.

Protocol references: [x402 v2 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md), [exact EVM scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md), [Anthropic tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [Circle testnet faucet](https://faucet.circle.com/).

Free-provider references: [Groq free-plan limits](https://console.groq.com/docs/rate-limits), [local tool calling](https://console.groq.com/docs/tool-use/local-tool-calling).

## Scored-check audit

See [the 10-check acceptance audit](docs/ACCEPTANCE-AUDIT.md) for code links, rubric weights, reproducible commands and limitations. Latest local suite: 30 passing tests. Run `npm run check:secrets` before publishing.
