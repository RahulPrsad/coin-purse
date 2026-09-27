# Security boundary

The model and all seller responses are untrusted. The local operator, environment, source code, RPC endpoint and SQLite database are trusted. Only the CLI configures the signer and policy. The model can choose from named local endpoints; it has no shell, file writer, browser, wallet-management tool or arbitrary URL fetch.

## Before any signature

The exact chain/token pair, recipient, EIP-712 domain, scheme, timeout and integer amount are checked. SQLite serializes the read-sum-reserve operation with BEGIN IMMEDIATE. FULL synchronous mode commits the reservation before signing. Simultaneous buyers must share this same ledger and run ID. Per-run policy and buyer address are stored at creation and must match on restart.

## After signing

The authorization fixes sender, recipient, value, time window and random nonce. There is one signed HTTP retry, with redirects disabled. No payload or signature is written to disk. The seller verifies then settles through the configured facilitator. Confirmation checks receipt success, USDC contract, Transfer sender/recipient/value and AuthorizationUsed authorizer/nonce through the configured Base Sepolia RPC.

A timeout or crash cannot safely prove that no payment occurred, so uncertain and reserved amounts remain committed indefinitely. Even signing failures retain reservations conservatively. The implementation never frees funds based on a seller's claim that payment failed. An operator can inspect chain evidence, but there is intentionally no automated budget-release operation.

## Remaining limits

- A host attacker can steal the signing key or modify policy/database. This is application-layer control, not an on-chain spending-limited smart account.
- A new run ID or another database creates another allowance. The limit is per run, not wallet-wide or lifetime.
- The honest server is a local fixture, not a production data marketplace. It has no production authentication, rate limiting or settlement retry cache.
- A seller can receive payment and withhold data. x402 payment does not guarantee data quality or delivery.
- All research data here is synthetic. LLM-generated analysis must still be reviewed.
- The configured RPC is trusted for confirmation; a dishonest RPC could fabricate receipts.
- LLM costs are separate from test USDC. Twelve turns limit requests but are not a monetary LLM billing cap.
- Only v2 exact EIP-3009 USDC is supported. Alternate or multiple offers fail closed.
- Local exports may contain research text. Review before publishing.
