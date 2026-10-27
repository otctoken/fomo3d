# Contract review and deployment limits

This is a source review and implementation note, not an independent security audit. Move sources were read in full and left unchanged. Public function/event reference: `CONTRACT_REFERENCE.md`.

## Material contract behaviors

1. `change_version` permits an AdminCap holder to override protocol version while SUI maturity is zero. The frontend exposes no version override. This restriction in the UI does not remove the on-chain administrator capability.
2. `mint` and `mint_ico` check lifetime issuance **before** minting; they do not clamp the new mint to remaining supply. `mint_init` has no independent cap check. Therefore the configured 10 billion FOMO cap is not a strict mathematical ceiling for all executions.
3. `get_fomo3d` removes an ICO entitlement even when `mint_ico` mints zero at the cap. Always verify `MintProcessed.actual_minted`; `IcoClaimProcessed` alone is insufficient evidence of receipt. ICO claims and game rewards share issuance capacity rather than separately reserving the 22% ICO allocation.
4. SUI game reward computes `coinv * 5000` in u64. A sufficiently high key price can overflow even if `get_key_price` itself remains within u64. The UI simulation catches a failing PTB but cannot repair this contract limitation.
5. Halving advances once per game-reward mint, not in a loop. Large issuance jumps can leave the divisor temporarily behind the threshold sequence. Burning does not restore lifetime issuance capacity.
6. Public `init_FomoData<T>` has exact limits: countdown 10,000–28,800,000 ms; initial price 1,000–10^16 raw units; SUI deposit at least 100 SUI; growth u8 in thousandths. Coin decimals need not be 9. The dedicated FOMO creation minimum is 200,000 FOMO. Initial LP share convention is `min(raw_x, raw_y)`, not square root with locked minimum liquidity.
7. The initial community-pool LP is held by its creator, who may withdraw the pool. The ICO pool’s initial LP is transferred to 0x0. Additional LP positions can still exist later. Liquidity concentration and manipulation can materially affect buyback proceeds.
8. Token→SUI computes `gross = floor(in * reserve_y / (reserve_x + in))`, then two separate fees of `floor(gross * 15 / 1000)`; one pays admin and one remains in the pool. The comment describing 0.3% is inaccurate for the implementation. SUI→Token has no additional fee. LP redemption takes 1% of gross SUI; min_y is checked against gross, not net.
9. `protectTransaction` only compares four stored timestamps with the current Clock timestamp. It is not comprehensive front-running/MEV protection. Meme second-hop package swap skips this gate. Buybacks may defer to pending balances when quotes/reserves/time gate prevent execution.
10. The 3% ordinary-token blackhole transfer does not invoke the token’s burn function and does not guarantee a reduction in total supply.
11. Game creation and shared parameter choices are permanent in these contracts. Zero/overlarge administrator prices are not fully constrained by `admin_init_FomoData`; the UI applies conservative minimum/range validation, but administrator capability remains powerful outside this UI.
12. `finalize_and_destroy_ico` destroys the ICO and claims objects after successful completion and all claims are removed. The frontend recognizes the finalized event and avoids reading deleted objects; missing history requires archival indexing to reconstruct this state.

## Frontend boundaries

- No keys, mnemonics, signing services, admin secrets or fund movement automation.
- Exact bigint amounts and BCS decoding for objects and events.
- Current object types verified against the configured package. Network-specific IDs never leak across networks.
- Quotes have explicit minima. Inputs returned by Move are transferred back; SDK intents handle wallet coin resolution and gas selection.
- Both simulation and execution failures are checked. The simulated ICO proof uses mocked gas and cannot substitute for a funded-wallet E2E test.
- A provider outage or pruned event history is shown as an error/coverage limitation, not a fabricated zero or success.
- Supabase service-role keys stay only in the indexer environment. RLS gives anonymous read access to public chain events, no write access.
- No contracts were published/upgraded, no admin transaction submitted, and no real ICO contribution or key purchase performed by this implementation task.

## Before production funds

The deployer must provision and operate a persistent index, configure target network deployments, run a real mobile-wallet signing/rejection/duplicate-click test, and assess the above contract risks. Current functional blockers are environment/deployment dependencies, not a claim that the contracts are safe after frontend verification.
