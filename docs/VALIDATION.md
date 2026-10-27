# Validation record

Date: 2026-10-27 (Asia/Singapore).

## Passed

- TypeScript strict compilation and Vite production build.
- 56 executable tests: precise amounts and u64 bounds, linear price rounding, asymmetric swaps, LP rounding and fees, strict Clock boundary, ICO readiness gates, 14 PTB construction cases, real deployment BCS decoding, simulation evidence, 17 language cases.
- Public Devnet package exists. Fourteen public function signatures checked against gRPC Move introspection. Full evidence in `deployment-verification.json`.
- Read-only simulation against current deployed shared objects: full ICO completion emits IcoCompleted, creates initial FOMO/SUI pool, produces 10,000 SUI starting jackpot, permits ICO claim, then permits a 2 SUI first key and 60-second Clock-based timer. Evidence in `ico-simulation.json` is explicitly simulated and uses mocked gas.
- Indexer ran against Devnet and persisted actual initialization/game events under `.indexer/`. No fabricated game IDs.
- Browser rendered 13 routes/tabs at 320, 768 and 1440 pixel viewports with no root horizontal overflow: Home, ICO, main game, all games, create game, swap, liquidity, token, claim, account, leaderboard, admin access state, Docs.
- Loaded main-game state separately checked at all three widths; actual price 2 SUI and linear increment 0.004 SUI displayed.
- Chinese mobile Docs interaction: changing community-game example pool to 12,345 shows 8,024.25 winner, 3,703.5 next-round, 246.9 buyback, 370.35 blackhole transfer. UI simulation is labeled illustrative, not live.
- User-provided logo rendered in header/footer and used as favicon/token introduction. Mobile language control remains accessible.
- English Rules page additionally checked at 320, 768 and 1440 pixels without horizontal overflow; English Docs checked at 390 pixels. Language toggle updates the page text and HTML language.

## Not represented as passed

- Real wallet approval, rejected signature, real transaction confirmation and mobile Slush embedded-wallet E2E: no connected test wallet was used and no funds were moved.
- Supabase hosted integration and SQL execution: schema/worker supplied, but the user has not supplied/provisioned a database for this task.
- Pool/LP-dependent populated UI and real settlement execution: no live deployed AMM pool at initial verification; PTB tests and simulated ICO exercise construction, not a funded LP/settlement E2E.
- Administrator-authorized screens beyond their access guard were not exercised with a real AdminCap wallet.
- Vercel production deployment: reserved for the user, as requested.
- Public RPC retention is not permanent. Historical coverage is deliberately labeled partial without the production index.

SDK build emits a third-party annotation warning and a large initial bundle advisory. Optional GraphQL and Supabase clients load in separate chunks. These are build advisories, not test failures.
