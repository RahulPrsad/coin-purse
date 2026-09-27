# Coin Purse

An LLM research agent with a small, auditable x402 purse. It buys synthetic monsoon research fixtures from an honest seller and refuses hostile payment requirements from a rogue seller. Spending is enforced by code before signing — not by asking the model to behave.

**Status:** real Groq tool-calling run completed on Base Sepolia. Three confirmed x402 purchases (0.15 test USDC); all six hostile scenarios refused. See `examples/testnet` for tx hashes, decisions, research. `examples/offline-demo` is simulated only.

## Quick start

Node **22.13+**. No Python, DB server, browser extension, or contract deployment needed.

```sh
npm ci
npm test
npm run demo
```

Open `examples/offline-demo/audit.html` — spins up two local sellers, makes 3 simulated purchases, runs 6 attacks, exports an audit, shuts down. No wallet/LLM key/network needed.

## .env setup

Copy `.env.example` → `.env`. Fill in:

| Variable | What you enter |
| --- | --- |
| `BUYER_PRIVATE_KEY` | A **dedicated** Base Sepolia test wallet key |
| `SELLER_ADDRESS` | Receiving address for test USDC |
| `LLM_API_KEY` | Groq API key (free plan) |

Default provider: `LLM_PROVIDER=groq`, `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_MODEL=qwen/qwen3.8-27b`. Free plan is sufficient. A 429 stops the run safely — wait and retry with the same `RUN_ID`.

Anthropic is an optional adapter (`LLM_PROVIDER=anthropic`, own API credits required). Never reuse a key across providers, never paste secrets/seed phrases into chat.

Fund your MetaMask test account with **5 test USDC on Base Sepolia**. The buyer signs EIP-3009 authorizations locally; a public address alone can't authorize payments.

**Defaults:** Base Sepolia (`eip155:84532`) + test USDC, both hard-allowlisted · `PER_CALL_MAX=250000` (0.25 USDC) · `RUN_BUDGET=5000000` (5 USDC) · each fixture = 0.05 USDC · `FACILITATOR_URL=https://x402.org/facilitator`.

Amounts are canonical integer strings in six-decimal base units (not `0.25`). A run binds its policy + wallet to its `RUN_ID` in SQLite — same ID can't change budget/wallet; new ID creates a new allowance.

## Real testnet run

```sh
npm run testnet
```

Starts both sellers, runs the six rogue probes, lets the LLM pick paid research tools, confirms transfers via RPC, saves reports. The LLM only gets an endpoint-ID tool — no wallet secrets, no config access. Rogue probes are deterministic; honest purchases are model-chosen.

**Outputs:** `reports/<RUN_ID>/{audit.html, decisions.json, research.md}`, `examples/testnet/` (only on a run with a confirmed purchase + refusal), `data/testnet.sqlite`.

Fails closed (keeps reservations, no fake receipts) if provider/wallet/RPC/facilitator is unavailable.

```sh
# two terminals
npm run sellers
npm run agent -- "How might a wetter monsoon affect rice and maize prices?"

# rebuild a report without signing/LLM key
npm run audit
```

## How payments are bounded

1. Model calls `paid_fetch(endpointId)` — no URL/budget/network/token/key/headers as args.
2. Unsigned GET; redirects refused.
3. 402 response returns x402 v2 `PAYMENT-REQUIRED`.
4. In a SQLite `BEGIN IMMEDIATE` transaction, code validates scheme/chain/token/recipient/domain/amount against per-call and cumulative budget (BigInt).
5. Amount is reserved **before** signing — safe across concurrent processes on the same ledger.
6. viem signs the exact EIP-3009 `TransferWithAuthorization`; payload sent manually, retried once with `PAYMENT-SIGNATURE`.
7. Seller settles via facilitator `/verify` + `/settle`; buyer checks receipt + on-chain `Transfer`/`AuthorizationUsed` before marking `paid`.
8. Any timeout/crash/invalid receipt/uncertainty keeps the reservation — no auto-retry reclaims it.

Only one exact EIP-3009 offer per challenge is supported. Anything else (multiple offers, other schemes, long timeouts, Permit2, unknown domain/asset/network) fails closed. Seller text/extensions are never treated as authority.

## Hostile fixtures

| Endpoint | Attack | Expected refusal |
| --- | --- | --- |
| rogue-expensive | 4.99 USDC for one row | `PER_CALL_LIMIT` |
| rogue-asset | Unknown token | `ASSET_NOT_ALLOWED` |
| rogue-network | Mainnet chain | `NETWORK_NOT_ALLOWED` |
| rogue-injection | Claims budget is now 100 USDC, quotes 4.99 | `PER_CALL_LIMIT` |
| rogue-malformed | Decimal instead of integer base units | `INVALID_AMOUNT` |
| rogue-recipient | Changes payout address | `RECIPIENT_NOT_ALLOWED` |

Honest seller serves synthetic rainfall/price/satellite JSON fixtures only — never claimed as live data or causal proof.

## Audit states

`refused` (no signature) · `reserved` (committed, may not have signed/completed) · `uncertain` (committed, signing/delivery unconfirmed) · `paid` (confirmed on-chain) · `simulated` (offline demo only) · `free` (no payment needed).

HTML output escapes seller/model text, runs no JS. Keys/signatures/auth headers are never written to the ledger. Scope: protects this wallet's run budget, not the whole wallet — external txs, other ledgers, new run IDs, a compromised host, or DB deletion are outside the boundary. No auto-refund/reconciliation.

## Scored acceptance map

| Check | Evidence |
| --- | --- |
| x402 handling | `src/buyer.mjs`, `src/signer.mjs` |
| Model chooses paid tool | `src/agent.mjs`, `src/buyer.mjs` |
| Rogue seller | `src/sellers.mjs` (6 endpoints) |
| No tracked credentials | `.gitignore`, placeholder `.env.example` |
| Per-call limit before signing | `src/policy.mjs`, `src/ledger.mjs` |
| Cumulative budget before signing | `src/ledger.mjs` |
| Durable spend | SQLite WAL + synchronous FULL |
| Network/asset allowlist | `src/policy.mjs` |
| Tool can't change limits | endpoint-only schema + strict validation |
| Integer arithmetic | BigInt throughout |

30 passing tests covering hostile quotes, honest flow, boundary arithmetic, restart, concurrency, malformed challenges, and signature recovery. See `test/`.

## Publish

```sh
git status --short
git add .
git commit -m "Build bounded x402 research purse"
git branch -M main
git remote add origin YOUR_PUBLIC_REPOSITORY_URL
git push -u origin main
```

`.env`, `node_modules`, private data, and reports are gitignored. Review `examples/testnet` for anything personal before committing. Run `npm run check:secrets` first.

**Refs:** [x402 v2 spec](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md) · [exact EVM scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md) · [Circle faucet](https://faucet.circle.com/) · [Groq rate limits](https://console.groq.com/docs/rate-limits) · [full audit](docs/ACCEPTANCE-AUDIT.md)
