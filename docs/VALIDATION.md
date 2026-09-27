# Local verification

Verified on Node v24.16.0.

- 23 tests passed; zero failures.
- Actual HTTP demo: 3 simulated purchases, 6 hostile refusals.
- Demo commitment: 150000 base units (0.15 USDC); confirmed spend: zero.
- EIP-3009 signature recovered to the ephemeral signing account.
- Receipt matcher accepted matching Transfer + AuthorizationUsed logs and refused a wrong nonce or network.
- SQLite reservations survived restart and prevented concurrent overspend.
- Git ignores .env, node_modules, data/ and reports/.
- Source/example scan found no raw 64-hex key, Anthropic secret or private-key PEM patterns.
- npm dependency audit reported zero vulnerabilities at installation.

Not yet validated: live Anthropic credentials, funded testnet settlement, external facilitator/RPC availability, or GitHub publishing. Mocked receipt tests are not on-chain evidence. The example report is explicitly labeled simulation.

## Subsequent live verification

Groq adapter added: all 28 tests passed. Real Groq tool-calling run completed with 3 confirmed Base Sepolia payments totaling 0.15 test USDC. All 6 hostile scenarios refused. See examples/testnet/README.md for evidence and research review notes. Public GitHub publishing remains pending.
