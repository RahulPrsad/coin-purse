# Verified Base Sepolia run

Run: arjun-testnet-001. Three LLM-selected purchases (rainfall, prices, satellite) spent 150000 base units = 0.15 test USDC. The buyer independently checked successful receipts, USDC Transfer events and matching AuthorizationUsed nonces.

All six hostile scenarios were refused before signing. The ledger contains two sets of these six refusals because the first attempt stopped on insufficient Anthropic credits; the same run was resumed successfully using Groq. No spend was erased between attempts.

Files: decisions.json (full evidence and transaction hashes), audit.html (readable ledger), research.md (model-generated research).

Research review notes: the model only saw the three honest tool calls, so its statement that no endpoint was declined refers to its research calls, not the separate hostile preflight. The full ledger proves those preflight refusals. The rainfall fixture is +18%, not the plus-or-minus 18% wording used once in the model note. All datasets are synthetic; the testnet payments are real. The original model output is retained for transparency.
