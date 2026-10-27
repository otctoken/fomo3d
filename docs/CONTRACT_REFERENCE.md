# Contract function and event reference

Generated from the supplied local Move source. Parameter order is preserved. `TxContext` is injected by Sui, not passed as a PTB argument. No Move files are modified.

## fomo::fomo3d

### Public functions

| Function | Parameters | Returns | Visibility |
| --- | --- | --- | --- |
| `mint` | `minter: &mut Minter,hc:&mut Halving_cycle, amount: u64, ctx: &mut TxContext` | `()` | package-only; not callable by frontend |
| `mint_ico` | `minter: &mut Minter, amount: u64, ctx: &mut TxContext` | `()` | package-only; not callable by frontend |
| `mint_init` | `minter: &mut Minter, amount: u64, ctx: &mut TxContext` | `Coin<FOMO3D>` | package-only; not callable by frontend |
| `burn` | `minter: &mut Minter,c: Coin<FOMO3D>` | `()` | public |

### Events

| Event | Fields |
| --- | --- |
| `TokenInitialized` | `minter_id: ID, halving_cycle_id: ID, metadata_id: ID, decimals: u8, configured_supply_cap: u64,` |
| `MintProcessed` | `minter_id: ID, kind: u8, requested_amount: u64, actual_minted: u64, recipient: Option<address>, minted_coin_id: Option<ID>, reward_divisor: Option<u64>, circulating_supply_after: u64, total_burned: u64,` |
| `TokensBurned` | `minter_id: ID, amount: u64, circulating_supply_after: u64, total_burned: u64,` |
| `HalvingApplied` | `halving_cycle_id: ID, lifetime_issued: u64, old_divisor: u64, new_divisor: u64, old_threshold: u64, new_threshold: u64,` |

## fomo::game

### Public functions

| Function | Parameters | Returns | Visibility |
| --- | --- | --- | --- |
| `change_version` | `_:&AdminCap,fomo:&mut FomoData<SUI>,r:&mut Registry,v:u64` | `()` | public |
| `change_admin` | `_:&AdminCap,r:&mut Registry,registry:&mut PoolRegistry,a:address` | `()` | public |
| `admin_init_FomoData<T>` | `_:&AdminCap,r:&mut Registry,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext` | `()` | public |
| `init_FomoData<T>` | `r:&mut Registry,registry:&mut PoolRegistry,initcoin:Coin<T>,tcoin:Coin<T>,suicoin:Coin<SUI>,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext` | `()` | public |
| `init_FomoData_fomo3d` | `_:&AdminCap,r:&mut Registry,registry:&mut PoolRegistry,initcoin:Coin<FOMO3D>,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext` | `()` | public |
| `play_games<T>` | `r:&mut Registry,fomo:&mut FomoData<T>,coin:Coin<T>,minter: &mut Minter,hc:&mut Halving_cycle,clk:&Clock,ctx:&mut TxContext` | `()` | public |
| `open_award_sui` | `r:&mut Registry,fomo:&mut FomoData<SUI>,pool: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext` | `()` | public |
| `open_award_meme<T>` | `r:&mut Registry,registry:&PoolRegistry,fomo:&mut FomoData<T>,pool: &mut Pool<T, SUI>,pool_fomo: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext` | `()` | public |
| `open_award_fomo3d` | `r:&mut Registry,registry:&PoolRegistry,fomo:&mut FomoData<FOMO3D>,pool_fomo: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext` | `()` | public |
| `get_key_price` | `total_keys: u64, initial_price: u64, price_update_percentage: u8,` | `u64` | public |
| `join_ico` | `minter: &mut Minter,r:&mut Registry,registry:&mut PoolRegistry,fomo:&mut FomoData<SUI>,ico: &mut Ico,getico:&mut GetIcoCoin,mut coin:Coin<SUI>,ctx:&mut TxContext` | `Coin<SUI>` | public |
| `refund_ico` | `fomo:&mut FomoData<SUI>,ico: &mut Ico,getico:&mut GetIcoCoin,ctx:&mut TxContext` | `Coin<SUI>` | public |
| `get_fomo3d` | `minter: &mut Minter,ico: &mut Ico,getico:&mut GetIcoCoin,ctx:&mut TxContext` | `()` | public |
| `finalize_and_destroy_ico` | `ico: Ico, getico:GetIcoCoin,ctx: &mut TxContext` | `()` | public |

### Events

| Event | Fields |
| --- | --- |
| `Init_Fomo<phantom T>` | `id: ID, countdown : u64, initial_price:u64, price_update_percentage:u8,` |
| `ProtocolInitialized` | `registry_id: ID, ico_id: ID, claims_id: ID, admin: address, version: u64, ico_remaining: u64,` |
| `VersionChanged` | `registry_id: ID, old_version: u64, new_version: u64, source: u8,` |
| `AdminChanged` | `registry_id: ID, pool_registry_id: ID, old_admin: address, new_admin: address,` |
| `GameCreated<phantom T>` | `game_id: ID, registry_id: ID, creator: address, mode: u8, initial_lp_id: Option<ID>, round_id: u64, countdown_ms: u64, initial_price: u64, price_update_percentage: u8, initial_balance: u64,` |
| `KeyPurchased<phantom T>` | `game_id: ID, round_id: u64, buyer: address, key_number: u64, paid_amount: u64, jackpot_after: u64, maturity_ms: u64, timestamp_ms: u64,` |
| `RoundSettled<phantom T>` | `game_id: ID, round_id: u64, next_round_id: u64, winner: address, settler: address, total_keys: u64, maturity_ms: u64, jackpot_before: u64, winner_amount: u64, buyback_allocated: u64, blackhole_amount: u64, direct_burn_amount: u64, buyback_fomo_burned: u64, pending_buyback_after: u64, jackpot_after: u64, timestamp_ms: u64,` |
| `BuybackExecuted<phantom T>` | `game_id: ID, trigger_round_id: u64, input_amount: u64, fomo_burned: u64, pending_after: u64, first_pool_id: Option<ID>, fomo_pool_id: ID, timestamp_ms: u64,` |
| `BuybackSkipped<phantom T>` | `game_id: ID, trigger_round_id: u64, pending_amount: u64, reason: u8, timestamp_ms: u64,` |
| `IcoContributed` | `ico_id: ID, claims_id: ID, game_id: ID, participant: address, accepted_sui: u64, returned_sui: u64, entitlement_added: u64, remaining_cap: u64,` |
| `IcoCompleted` | `ico_id: ID, game_id: ID, pool_registry_id: ID, initial_lp_id: ID, seed_sui: u64, seed_fomo: u64, jackpot_after: u64, version_after: u64,` |
| `IcoRefunded` | `ico_id: ID, claims_id: ID, game_id: ID, participant: address, returned_sui: u64, entitlement_removed: u64, remaining_cap: u64,` |
| `IcoClaimProcessed` | `ico_id: ID, claims_id: ID, minter_id: ID, participant: address, entitlement_removed: u64,` |
| `IcoFinalized` | `ico_id: ID, claims_id: ID, caller: address,` |

## fomo::swap

### Public functions

| Function | Parameters | Returns | Visibility |
| --- | --- | --- | --- |
| `change_admin` | `r:&mut PoolRegistry,a:address` | `()` | package-only; not callable by frontend |
| `create_pool<X>` | `x: Coin<X>, y: Coin<SUI>, registry:&mut PoolRegistry, ctx: &mut TxContext,` | `LP<X, SUI>` | package-only; not callable by frontend |
| `add_liquidity<X, Y>` | `pool: &mut Pool<X, Y>, mut x: Coin<X>, mut y: Coin<Y>, min_shares: u128, clk: &Clock, ctx: &mut TxContext,` | `(LP<X, Y>, Coin<X>, Coin<Y>)` | public |
| `remove_liquidity<X, Y>` | `pool: &mut Pool<X, Y>, lp: LP<X, Y>, min_x: u64, min_y: u64, registry:&PoolRegistry, clk:&Clock, ctx: &mut TxContext,` | `(Coin<X>, Coin<Y>)` | public |
| `swap_x_to_y<X, Y>` | `pool: &mut Pool<X, Y>, input: Coin<X>, min_out: u64, registry:&PoolRegistry, clk:&Clock, ctx: &mut TxContext,` | `Coin<Y>` | public |
| `swap_y_to_x<X, Y>` | `pool: &mut Pool<X, Y>, input: Coin<Y>, min_out: u64, clk:&Clock, ctx: &mut TxContext,` | `Coin<X>` | public |
| `swap_y_to_x_package<X, Y>` | `pool: &mut Pool<X, Y>, input: Coin<Y>, min_out: u64, clk:&Clock, ctx: &mut TxContext,` | `Coin<X>` | package-only; not callable by frontend |
| `get_amount_out` | `amount_in: u64, reserve_in: u64, reserve_out: u64` | `u64` | public |
| `quote_or_zero` | `amount_in: u64, reserve_in: u64, reserve_out: u64,` | `u64` | package-only; not callable by frontend |
| `reserves<X, Y>` | `pool: &Pool<X, Y>` | `(u64, u64, u128)` | public |
| `protectTransaction` | `a:u64,b:u64,c:u64,d:u64,time:u64` | `bool` | public |
| `can_swap_now<X, Y>` | `pool: &Pool<X, Y>, clk: &Clock,` | `bool` | package-only; not callable by frontend |

### Events

| Event | Fields |
| --- | --- |
| `PoolRegistryCreated` | `registry_id: ID, admin: address,` |
| `PoolAdminChanged` | `registry_id: ID, old_admin: address, new_admin: address,` |
| `PoolCreated<phantom X, phantom Y>` | `registry_id: ID, pool_id: ID, initial_lp_id: ID, creator: address, amount_x: u64, amount_y: u64, total_shares: u128,` |
| `LiquidityAdded<phantom X, phantom Y>` | `pool_id: ID, lp_id: ID, provider: address, used_x: u64, used_y: u64, returned_x: u64, returned_y: u64, shares_minted: u128, total_shares_after: u128, reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,` |
| `LiquidityRemoved<phantom X, phantom Y>` | `pool_id: ID, lp_id: ID, caller: address, shares_burned: u128, amount_x: u64, gross_y: u64, net_y: u64, admin_fee_y: u64, fee_recipient: address, min_x: u64, min_y: u64, total_shares_after: u128, reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,` |
| `SwapExecuted<phantom X, phantom Y>` | `pool_id: ID, caller: address, direction: u8, package_route: bool, amount_in: u64, gross_out: u64, amount_out: u64, admin_fee: u64, lp_fee: u64, fee_recipient: Option<address>, min_out: u64, reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,` |
