module fomo::fomo3d {
    use sui::event::emit;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self};
    use sui::clock::{Clock};

    const TOTAL_SUPPLY_RAW: u64 = 10_000_000_000_000_000_000;
    // One Time Witness
    public struct FOMO3D has drop {}

    public struct Halving_cycle has key, store{
        id: UID,
        current:u64,
        remaining: u64, 
        halved:u64,
    }

    public struct Minter has key, store {
        id: UID,
        cap: TreasuryCap<FOMO3D>,
        total_burned: u64,
    }

    public struct TokenInitialized has copy, drop {
        minter_id: ID, halving_cycle_id: ID, metadata_id: ID,
        decimals: u8, configured_supply_cap: u64,
    }
    // Actual minting may be zero; requested_amount is not a payment receipt.
    public struct MintProcessed has copy, drop {
        minter_id: ID, kind: u8, // 0: game reward, 1: ICO claim, 2: initial pool
        requested_amount: u64, actual_minted: u64,
        recipient: Option<address>, minted_coin_id: Option<ID>, reward_divisor: Option<u64>,
        circulating_supply_after: u64, total_burned: u64,
    }
    public struct TokensBurned has copy, drop {
        minter_id: ID, amount: u64, circulating_supply_after: u64, total_burned: u64,
    }
    public struct HalvingApplied has copy, drop {
        halving_cycle_id: ID, lifetime_issued: u64,
        old_divisor: u64, new_divisor: u64, old_threshold: u64, new_threshold: u64,
    }

    fun init(witness: FOMO3D, ctx: &mut TxContext) {
        // TODO
        let decimals = 9;
        let symbol = b"FOMO3D";
        let name = b"Fomo3dGameCoin";
        let description = b"The only way you lose is if you stop playing!Give your memecoin something to market.";
        let icon_url = url::new_unsafe_from_bytes(b"https://ipfs.io/ipfs/bafybeicpom5zalu3nk5ldxkbiidnx2xu4fiquhjd46edgfv6jl76jytr4u");

        let (treasury, metadata) = coin::create_currency(witness, decimals, symbol, name, description, option::some(icon_url), ctx);

        let hc = Halving_cycle {
            id: object::new(ctx),
            current:TOTAL_SUPPLY_RAW,
            remaining: TOTAL_SUPPLY_RAW / 4, 
            halved:1,
        };
        let event_metadata_id = object::id(&metadata);
        transfer::public_freeze_object(metadata);
        // transfer::public_share_object(metadata);
        let minter = Minter { id: object::new(ctx), cap: treasury,total_burned:0 };
        emit(TokenInitialized {
            minter_id: object::id(&minter), halving_cycle_id: object::id(&hc),
            metadata_id: event_metadata_id, decimals, configured_supply_cap: TOTAL_SUPPLY_RAW,
        });
        transfer::share_object(minter);
        transfer::public_share_object(hc);
    }

    public(package) fun mint(
        minter: &mut Minter,hc:&mut Halving_cycle, amount: u64,  ctx: &mut TxContext
    ) {
        let event_supply_before = coin::total_supply(&minter.cap);
        let ts: u64 = coin::total_supply<FOMO3D>(&minter.cap) + minter.total_burned;
        halved(ts,hc);
        let amount_to = amount / hc.halved;
        if(ts < TOTAL_SUPPLY_RAW && amount_to > 0){
            coin::mint_and_transfer(&mut minter.cap, amount_to, ctx.sender(), ctx)
        };
        emit(MintProcessed {
            minter_id: object::id(minter), kind: 0, requested_amount: amount,
            actual_minted: coin::total_supply(&minter.cap) - event_supply_before,
            recipient: option::some(ctx.sender()), minted_coin_id: option::none(),
            reward_divisor: option::some(hc.halved), circulating_supply_after: coin::total_supply(&minter.cap),
            total_burned: minter.total_burned,
        });
    }
    public(package) fun mint_ico(
        minter: &mut Minter, amount: u64,  ctx: &mut TxContext
    ) {
        let event_supply_before = coin::total_supply(&minter.cap);
        let ts: u64 = coin::total_supply<FOMO3D>(&minter.cap) + minter.total_burned;
        if(ts < TOTAL_SUPPLY_RAW && amount > 0){
            coin::mint_and_transfer(&mut minter.cap, amount, ctx.sender(), ctx)
        };
        emit(MintProcessed {
            minter_id: object::id(minter), kind: 1, requested_amount: amount,
            actual_minted: coin::total_supply(&minter.cap) - event_supply_before,
            recipient: option::some(ctx.sender()), minted_coin_id: option::none(),
            reward_divisor: option::none(), circulating_supply_after: coin::total_supply(&minter.cap),
            total_burned: minter.total_burned,
        });
    }
    public(package) fun mint_init(
        minter: &mut Minter, amount: u64,  ctx: &mut TxContext
    ) :Coin<FOMO3D>{
        let event_coin = coin::mint(&mut minter.cap, amount,ctx);
        emit(MintProcessed {
            minter_id: object::id(minter), kind: 2, requested_amount: amount,
            actual_minted: event_coin.value(), recipient: option::none(),
            minted_coin_id: option::some(object::id(&event_coin)), reward_divisor: option::none(),
            circulating_supply_after: coin::total_supply(&minter.cap), total_burned: minter.total_burned,
        });
        event_coin
    }

    public entry fun burn(minter: &mut Minter,c: Coin<FOMO3D>) {
        let value = c.value();
        minter.total_burned = minter.total_burned + value;
        coin::burn(&mut minter.cap, c);
        emit(TokensBurned { minter_id: object::id(minter), amount: value,
            circulating_supply_after: coin::total_supply(&minter.cap), total_burned: minter.total_burned });
    }

    fun halved(total:u64,hc:&mut Halving_cycle){
        if(total >= hc.remaining && hc.halved <= 536_870_912){
            let event_old_divisor = hc.halved;
            let event_old_threshold = hc.remaining;
            hc.halved = hc.halved * 2;
            hc.current = TOTAL_SUPPLY_RAW - hc.remaining;
            hc.remaining = hc.current / 4 + hc.remaining;
            emit(HalvingApplied { halving_cycle_id: object::id(hc), lifetime_issued: total,
                old_divisor: event_old_divisor, new_divisor: hc.halved,
                old_threshold: event_old_threshold, new_threshold: hc.remaining });
        }
    }
}
