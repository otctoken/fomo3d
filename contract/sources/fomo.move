module fomo::game{
    use std::ascii::{String};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use std::type_name::{Self};
    use sui::balance::{Self, Balance};
    use sui::clock::{Clock};
    use sui::table::{Self, Table};
    use sui::random::{Self,Random};
    use sui::bag::{Self, Bag};
    use sui::dynamic_field as df;
    use sui::event::emit;

    

    use fomo::fomo3d::{Self,FOMO3D,Minter,Halving_cycle};
    use fomo::swap::{Self,Pool,PoolRegistry};

    const ESameTypeName: u64 = 1;
    const ECountdown: u64 = 2;
    const EVersion: u64 = 3;
    const EAmount:u64 = 4;
    const ERound:u64 = 5;
    const EIcoend:u64 =6;
    const EZeroAmount:u64 =7;
    const EPriceOverflow:u64 =8;
    const EInitsui:u64 = 9;
    const EInitprice:u64 = 10;

    
    

    const VERSION: u64 = 1;
        // emit(Outcome {
        //     gamenumber:0,
        //     bonus:income,
        //     coinvalue:coin_value,
        //     result:first_num,
        // });


    public struct Registry has key {
        id: UID,
        admin:address,
        version:u64,
    }
    public struct Ico has key {
        id: UID,
        hardCap:u64,
        boo:bool,
    }
    public struct GetIcoCoin has key {
        id: UID,
        get:Table<address,u64>, 
    }

    public struct FomoData<phantom T> has key, store {
        id: UID,
        balance: Balance<T>,
        pending_buyback: Balance<T>,
        address1:address,
        countdown : u64,
        maturity:u64,
        initial_price:u64,
        price_update_percentage:u8,
        total_keys:u64,
        round_id: u64,
    }

    public struct AdminCap has key, store {
        id: UID
    }

    //.......................................................................emit........................................
    public struct Init_Fomo<phantom T> has copy,drop {
        id: ID,
        countdown : u64,
        initial_price:u64,
        price_update_percentage:u8,
    }

   
    // Event-only data: amounts use raw coin units; times use Clock milliseconds.
    public struct ProtocolInitialized has copy, drop {
        registry_id: ID, ico_id: ID, claims_id: ID,
        admin: address, version: u64, ico_remaining: u64,
    }
    public struct VersionChanged has copy, drop {
        registry_id: ID, old_version: u64, new_version: u64,
        source: u8, // 0: admin, 1: ICO completion
    }
    public struct AdminChanged has copy, drop {
        registry_id: ID, pool_registry_id: ID, old_admin: address, new_admin: address,
    }
    public struct GameCreated<phantom T> has copy, drop {
        game_id: ID, registry_id: ID, creator: address,
        mode: u8, // 0: admin, 1: public with new pool, 2: dedicated FOMO3D
        initial_lp_id: Option<ID>, round_id: u64,
        countdown_ms: u64, initial_price: u64, price_update_percentage: u8,
        initial_balance: u64,
    }
    public struct KeyPurchased<phantom T> has copy, drop {
        game_id: ID, round_id: u64, buyer: address, key_number: u64,
        paid_amount: u64, jackpot_after: u64, maturity_ms: u64, timestamp_ms: u64,
    }
    public struct RoundSettled<phantom T> has copy, drop {
        game_id: ID, round_id: u64, next_round_id: u64,
        winner: address, settler: address, total_keys: u64, maturity_ms: u64,
        jackpot_before: u64, winner_amount: u64, buyback_allocated: u64,
        blackhole_amount: u64, direct_burn_amount: u64,
        buyback_fomo_burned: u64, pending_buyback_after: u64,
        jackpot_after: u64, timestamp_ms: u64,
    }
    public struct BuybackExecuted<phantom T> has copy, drop {
        game_id: ID, trigger_round_id: u64, input_amount: u64,
        fomo_burned: u64, pending_after: u64,
        first_pool_id: Option<ID>, fomo_pool_id: ID, timestamp_ms: u64,
    }
    public struct BuybackSkipped<phantom T> has copy, drop {
        game_id: ID, trigger_round_id: u64, pending_amount: u64,
        reason: u8, // 0: no budget, 1: time gate, 2/3: first hop empty/zero quote,
                    // 4/5: second hop empty/zero quote
        timestamp_ms: u64,
    }
    public struct IcoContributed has copy, drop {
        ico_id: ID, claims_id: ID, game_id: ID, participant: address,
        accepted_sui: u64, returned_sui: u64, entitlement_added: u64,
        remaining_cap: u64,
    }
    public struct IcoCompleted has copy, drop {
        ico_id: ID, game_id: ID, pool_registry_id: ID, initial_lp_id: ID,
        seed_sui: u64, seed_fomo: u64, jackpot_after: u64, version_after: u64,
    }
    public struct IcoRefunded has copy, drop {
        ico_id: ID, claims_id: ID, game_id: ID, participant: address,
        returned_sui: u64, entitlement_removed: u64, remaining_cap: u64,
    }
    // Entitlement removal is NOT proof of minting; see fomo3d::MintProcessed.
    public struct IcoClaimProcessed has copy, drop {
        ico_id: ID, claims_id: ID, minter_id: ID, participant: address,
        entitlement_removed: u64,
    }
    public struct IcoFinalized has copy, drop {
        ico_id: ID, claims_id: ID, caller: address,
    }

    fun init(
        ctx: &mut TxContext
    ) {
        let registry = Registry {
            id: object::new(ctx),
            admin:ctx.sender(),
            version:0,
        };

        let event_registry_id = object::id(&registry);
        transfer::share_object(registry);
        let ico =  Ico{
            id: object::new(ctx),
            hardCap:11_000_000_000_000,
            boo:true,
        };
        let event_ico_id = object::id(&ico);
        let event_ico_remaining = ico.hardCap;
        transfer::share_object(ico);
        let getIco = GetIcoCoin{
            id: object::new(ctx),
            get:table::new(ctx), 
        };
        emit(ProtocolInitialized {
            registry_id: event_registry_id, ico_id: event_ico_id,
            claims_id: object::id(&getIco), admin: ctx.sender(),
            version: 0, ico_remaining: event_ico_remaining,
        });
        transfer::share_object(getIco);
        transfer::transfer(AdminCap {
            id: object::new(ctx)
        }, ctx.sender());
    }

    public fun change_version(_:&AdminCap,fomo:&mut FomoData<SUI>,r:&mut Registry,v:u64){
        assert!(fomo.maturity == 0,0);
        let event_old_version = r.version;
        r.version = v;
        emit(VersionChanged { registry_id: object::id(r), old_version: event_old_version,
            new_version: r.version, source: 0 });
    }
    public fun change_admin(_:&AdminCap,r:&mut Registry,registry:&mut PoolRegistry,a:address){
        let event_old_admin = r.admin;
        r.admin = a;
        swap::change_admin(registry,a);
        emit(AdminChanged { registry_id: object::id(r), pool_registry_id: object::id(registry),
            old_admin: event_old_admin, new_admin: r.admin });
    }






    public fun admin_init_FomoData<T>(_:&AdminCap,r:&mut Registry,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext){  //我们countdown为60000毫秒,initial_price   2SUI,pup 千分之2
        let coin_type = type_name::with_defining_ids<T>();
        assert!(countdown >= 10000 && countdown <= 28800000,ECountdown);
        assert!(!df::exists(&r.id,coin_type),ESameTypeName);
        df::add(&mut r.id,coin_type, 0u8);
        let data = FomoData<T>{
            id: object::new(ctx),
            balance: balance::zero<T>(),
            pending_buyback: balance::zero<T>(),
            address1:r.admin,
            countdown:countdown,
            maturity:0,
            initial_price:initial_price,
            price_update_percentage:pup,
            total_keys:0,
            round_id:1,
        };
        emit(Init_Fomo<T> {
            id: object::uid_to_inner(&data.id),
            countdown : countdown,
            initial_price:initial_price,
            price_update_percentage:pup,
        });
        emit(GameCreated<T> {
            game_id: object::id(&data), registry_id: object::id(r), creator: ctx.sender(),
            mode: 0, initial_lp_id: option::none(), round_id: data.round_id,
            countdown_ms: data.countdown, initial_price: data.initial_price,
            price_update_percentage: data.price_update_percentage,
            initial_balance: data.balance.value(),
        });
        transfer::share_object(data);
    }


//...................................................main.................................................
    public fun init_FomoData<T>(r:&mut Registry,registry:&mut PoolRegistry,initcoin:Coin<T>,tcoin:Coin<T>,suicoin:Coin<SUI>,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext){  //我们countdown为60000毫秒,initial_price   2SUI,pup 千分之2
        let coin_type = type_name::with_defining_ids<T>();
        assert!(countdown >= 10000 && countdown <= 28800000,ECountdown);
        assert!(!df::exists(&r.id,coin_type),ESameTypeName);
        assert!(initial_price >= 1000 && initial_price <= 10_000_000_000_000_000,EInitprice);
        assert!(r.version==VERSION,EVersion);
        let coin_value = coin::value(&suicoin);
        assert!(coin_value >= 100_000_000_000,EInitsui);
        df::add(&mut r.id,coin_type, 0u8);
        let data = FomoData<T>{
            id: object::new(ctx),
            balance: coin::into_balance(initcoin),
            pending_buyback: balance::zero<T>(),
            address1:r.admin,
            countdown:countdown,
            maturity:0,
            initial_price:initial_price,
            price_update_percentage:pup,
            total_keys:0,
            round_id:1,
        };
        let lp = swap::create_pool<T>(tcoin,suicoin,registry,ctx);
        let event_initial_lp_id = object::id(&lp);
        transfer::public_transfer(lp,ctx.sender());
        emit(Init_Fomo<T> {
            id: object::uid_to_inner(&data.id),
            countdown : countdown,
            initial_price:initial_price,
            price_update_percentage:pup,
        });
        emit(GameCreated<T> {
            game_id: object::id(&data), registry_id: object::id(r), creator: ctx.sender(),
            mode: 1, initial_lp_id: option::some(event_initial_lp_id), round_id: data.round_id,
            countdown_ms: data.countdown, initial_price: data.initial_price,
            price_update_percentage: data.price_update_percentage,
            initial_balance: data.balance.value(),
        });
        transfer::share_object(data);
    }
    public fun init_FomoData_fomo3d(_:&AdminCap,r:&mut Registry,registry:&mut PoolRegistry,initcoin:Coin<FOMO3D>,countdown:u64,initial_price:u64,pup:u8,ctx:&mut TxContext){  //我们countdown为60000毫秒,initial_price   2SUI,pup 千分之2
        let coin_type = type_name::with_defining_ids<FOMO3D>();
        assert!(countdown >= 10000 && countdown <= 28800000,ECountdown);
        assert!(!df::exists(&r.id,coin_type),ESameTypeName);
        assert!(initial_price >= 1000,EInitprice);
        assert!(r.version==VERSION,EVersion);
        let coinvol = coin::value(&initcoin);
        assert!(coinvol >= 200_000_000_000_000,EVersion);
        df::add(&mut r.id,coin_type, 0u8);
        let data = FomoData<FOMO3D>{
            id: object::new(ctx),
            balance: coin::into_balance(initcoin),
            pending_buyback: balance::zero<FOMO3D>(),
            address1:r.admin,
            countdown:countdown,
            maturity:0,
            initial_price:initial_price,
            price_update_percentage:pup,
            total_keys:0,
            round_id:1,
        };
        emit(Init_Fomo<FOMO3D> {
            id: object::uid_to_inner(&data.id),
            countdown : countdown,
            initial_price:initial_price,
            price_update_percentage:pup,
        });
        emit(GameCreated<FOMO3D> {
            game_id: object::id(&data), registry_id: object::id(r), creator: ctx.sender(),
            mode: 2, initial_lp_id: option::none(), round_id: data.round_id,
            countdown_ms: data.countdown, initial_price: data.initial_price,
            price_update_percentage: data.price_update_percentage,
            initial_balance: data.balance.value(),
        });
        transfer::share_object(data);
    }

    public fun play_games<T>(r:&mut Registry,fomo:&mut FomoData<T>,coin:Coin<T>,minter: &mut Minter,hc:&mut Halving_cycle,clk:&Clock,ctx:&mut TxContext){
        if(fomo.maturity != 0){
            assert!(fomo.maturity >= clk.timestamp_ms(),ERound);
        };
        assert!(r.version==VERSION,EVersion);
        let coinv = coin::value(&coin);
        let get_price = get_key_price(fomo.total_keys,fomo.initial_price,fomo.price_update_percentage);
        assert!(coinv == get_price,EAmount);
        coin::put(&mut fomo.balance, coin);
        fomo.total_keys = fomo.total_keys + 1;
        fomo.maturity = clk.timestamp_ms() + fomo.countdown;
        fomo.address1 = ctx.sender();
        if(type_name::with_defining_ids<T>() == type_name::with_defining_ids<SUI>()){
            let get_fomocoin = coinv * 5000;
            fomo3d::mint(minter,hc, get_fomocoin, ctx);
        };
        emit(KeyPurchased<T> {
            game_id: object::id(fomo), round_id: fomo.round_id, buyer: ctx.sender(),
            key_number: fomo.total_keys, paid_amount: coinv,
            jackpot_after: fomo.balance.value(), maturity_ms: fomo.maturity,
            timestamp_ms: clk.timestamp_ms(),
        });
    }

    public fun open_award_sui(r:&mut Registry,fomo:&mut FomoData<SUI>,pool: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext){
        assert!(fomo.maturity != 0,0);
        assert!(fomo.maturity < clk.timestamp_ms(),ERound);
        assert!(r.version==VERSION,EVersion);
        let event_round = fomo.round_id;
        let event_winner = fomo.address1;
        let event_keys = fomo.total_keys;
        let event_maturity = fomo.maturity;
        let amount = balance::value(&fomo.balance);
        let winner =((amount as u128) * 65 / 100) as u64;
        let buyback =((amount as u128) * 5 / 100) as u64;
        // 剩余给回购储备，约 5%
        // 下一轮奖池 30%
        let winnerCoin = coin::from_balance(balance::split(&mut fomo.balance, winner), ctx);
        transfer::public_transfer(winnerCoin,fomo.address1);
        let reserved = fomo.balance.split(buyback);
        fomo.pending_buyback.join(reserved);
        let event_budget = fomo.pending_buyback.value();
        let bought = try_buyback_sui(fomo, pool, clk, ctx);
        let event_bought = bought.value();
        if (bought.value() == 0) {
            // 本次没有执行兑换，预算仍在 pending_buyback。
            coin::destroy_zero(bought);
        } else {
            // 实际买到的 FOMO3D 才执行销毁。
            fomo3d::burn(minter, bought);
            emit(BuybackExecuted<SUI> {
                game_id: object::id(fomo), trigger_round_id: event_round,
                input_amount: event_budget, fomo_burned: event_bought,
                pending_after: fomo.pending_buyback.value(), first_pool_id: option::none(),
                fomo_pool_id: object::id(pool), timestamp_ms: clk.timestamp_ms(),
            });
        };
        fomo.total_keys = 0;
        fomo.maturity = 0;
        fomo.address1 = r.admin;
        fomo.round_id = fomo.round_id + 1;
        emit(RoundSettled<SUI> {
            game_id: object::id(fomo), round_id: event_round, next_round_id: fomo.round_id,
            winner: event_winner, settler: ctx.sender(), total_keys: event_keys,
            maturity_ms: event_maturity, jackpot_before: amount, winner_amount: winner,
            buyback_allocated: buyback, blackhole_amount: 0,
            direct_burn_amount: 0, buyback_fomo_burned: event_bought,
            pending_buyback_after: fomo.pending_buyback.value(),
            jackpot_after: fomo.balance.value(), timestamp_ms: clk.timestamp_ms(),
        });
   
    }

    public fun open_award_meme<T>(r:&mut Registry,registry:&PoolRegistry,fomo:&mut FomoData<T>,pool: &mut Pool<T, SUI>,pool_fomo: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext){
        assert!(type_name::with_defining_ids<T>() != type_name::with_defining_ids<SUI>(),ESameTypeName);
        if(fomo.maturity != 0){
            assert!(fomo.maturity < clk.timestamp_ms(),ERound);
            assert!(r.version==VERSION,EVersion);
            let event_round = fomo.round_id;
            let event_winner = fomo.address1;
            let event_keys = fomo.total_keys;
            let event_maturity = fomo.maturity;
            let amount = balance::value(&fomo.balance);
            let winner = ((amount as u128) * 65 / 100) as u64;
            let buyback = ((amount as u128) * 2 / 100) as u64;
            let burn_meme = ((amount as u128) * 3 / 100) as u64;
            // 剩余协议给回购储备，约 2%
            // 销毁meme，约 3%
            // 下一轮奖池 30%
            let winnerCoin = coin::from_balance(balance::split(&mut fomo.balance, winner), ctx);
            let burnCoin = coin::from_balance(balance::split(&mut fomo.balance, burn_meme), ctx);
            transfer::public_transfer(winnerCoin,fomo.address1);
            transfer::public_transfer(burnCoin,@0x0);
            let reserved = fomo.balance.split(buyback);
            fomo.pending_buyback.join(reserved);
            let event_budget = fomo.pending_buyback.value();
            let bought = try_buyback_meme(
                fomo, pool, pool_fomo, registry, clk, ctx,
            );

            let event_bought = bought.value();
            if (bought.value() == 0) {
                coin::destroy_zero(bought);
            } else {
                fomo3d::burn(minter, bought);
                emit(BuybackExecuted<T> {
                    game_id: object::id(fomo), trigger_round_id: event_round,
                    input_amount: event_budget, fomo_burned: event_bought,
                    pending_after: fomo.pending_buyback.value(), first_pool_id: option::some(object::id(pool)),
                    fomo_pool_id: object::id(pool_fomo), timestamp_ms: clk.timestamp_ms(),
                });
            };
            fomo.total_keys = 0;
            fomo.maturity = 0;
            fomo.address1 = r.admin;
            fomo.round_id = fomo.round_id + 1;
            emit(RoundSettled<T> {
                game_id: object::id(fomo), round_id: event_round, next_round_id: fomo.round_id,
                winner: event_winner, settler: ctx.sender(), total_keys: event_keys,
                maturity_ms: event_maturity, jackpot_before: amount, winner_amount: winner,
                buyback_allocated: buyback, blackhole_amount: burn_meme,
                direct_burn_amount: 0, buyback_fomo_burned: event_bought,
                pending_buyback_after: fomo.pending_buyback.value(),
                jackpot_after: fomo.balance.value(), timestamp_ms: clk.timestamp_ms(),
            });
        };
    }
    public fun open_award_fomo3d(r:&mut Registry,registry:&PoolRegistry,fomo:&mut FomoData<FOMO3D>,pool_fomo: &mut Pool<FOMO3D, SUI>,minter: &mut Minter,clk:&Clock,ctx:&mut TxContext){
        if(fomo.maturity != 0){
            assert!(fomo.maturity < clk.timestamp_ms(),ERound);
            assert!(r.version==VERSION,EVersion);
            let event_round = fomo.round_id;
            let event_winner = fomo.address1;
            let event_keys = fomo.total_keys;
            let event_maturity = fomo.maturity;
            let amount = balance::value(&fomo.balance);
            let winner = ((amount as u128) * 65 / 100) as u64;
            let burn_meme = ((amount as u128) * 5 / 100) as u64;
            // 剩余协议给回购储备，约 2%
            // 销毁meme，约 3%
            // 下一轮奖池 30%
            let winnerCoin = coin::from_balance(balance::split(&mut fomo.balance, winner), ctx);
            let burnCoin = coin::from_balance(balance::split(&mut fomo.balance, burn_meme), ctx);
            transfer::public_transfer(winnerCoin,fomo.address1);
            fomo3d::burn(minter,burnCoin);
            fomo.total_keys = 0;
            fomo.maturity = 0;
            fomo.address1 = r.admin;
            fomo.round_id = fomo.round_id + 1;
            emit(RoundSettled<FOMO3D> {
                game_id: object::id(fomo), round_id: event_round, next_round_id: fomo.round_id,
                winner: event_winner, settler: ctx.sender(), total_keys: event_keys,
                maturity_ms: event_maturity, jackpot_before: amount, winner_amount: winner,
                buyback_allocated: 0, blackhole_amount: 0,
                direct_burn_amount: burn_meme, buyback_fomo_burned: 0,
                pending_buyback_after: fomo.pending_buyback.value(),
                jackpot_after: fomo.balance.value(), timestamp_ms: clk.timestamp_ms(),
            });
        };
    }

    public fun get_key_price(
        total_keys: u64,
        initial_price: u64,
        price_update_percentage: u8,
    ): u64 {
        let initial = initial_price as u256;
        let increment =
            initial * (price_update_percentage as u256) / 1000;

        let price = initial + (total_keys as u256) * increment;

        assert!(
            price <= 18446744073709551615u256,
            EPriceOverflow,
        );

        price as u64
    }


  

//...................................................Initial Coin Offering.................................................
    public fun join_ico(minter: &mut Minter,r:&mut Registry,registry:&mut PoolRegistry,fomo:&mut FomoData<SUI>,ico: &mut Ico,getico:&mut GetIcoCoin,mut coin:Coin<SUI>,ctx:&mut TxContext):Coin<SUI>{
        assert!(ico.boo,EIcoend);
        let coinv = coin::value(&coin);
        assert!(coinv > 0, EZeroAmount);
        let mut coinamt = 0;
        if(coinv <= ico.hardCap){
            coinamt = coinv;
        }else{ 
            coinamt = ico.hardCap;
        };
        ico.hardCap = ico.hardCap - coinamt;
        let new_coin = coin::split(&mut coin, coinamt, ctx);
        coin::put(&mut fomo.balance, new_coin);
        let icofomo = coinamt * 200_000;
        if(table::contains(&getico.get, ctx.sender())){
            let change_ref = table::borrow_mut(&mut getico.get, ctx.sender());
            *change_ref = *change_ref + icofomo;
        }else{
            table::add(&mut getico.get, ctx.sender(), icofomo);
        };
        emit(IcoContributed {
            ico_id: object::id(ico), claims_id: object::id(getico), game_id: object::id(fomo),
            participant: ctx.sender(), accepted_sui: coinamt, returned_sui: coin.value(),
            entitlement_added: icofomo, remaining_cap: ico.hardCap,
        });
        if(ico.hardCap==0){
            ico.boo = false; 
            let event_old_version = r.version;
            r.version = 1;
            emit(VersionChanged { registry_id: object::id(r), old_version: event_old_version,
                new_version: r.version, source: 1 });
            let initsuicoin = coin::take(&mut fomo.balance, 1_000_000_000_000, ctx);
            let fomo3dinitcoin = fomo3d::mint_init(minter, 200_000_000_000_000_000 , ctx);
            let event_seed_sui = initsuicoin.value();
            let event_seed_fomo = fomo3dinitcoin.value();
            let lp = swap::create_pool<FOMO3D>(fomo3dinitcoin,initsuicoin,registry,ctx);
            let event_initial_lp_id = object::id(&lp);
            transfer::public_transfer(lp,@0x0);
            emit(IcoCompleted {
                ico_id: object::id(ico), game_id: object::id(fomo),
                pool_registry_id: object::id(registry), initial_lp_id: event_initial_lp_id,
                seed_sui: event_seed_sui, seed_fomo: event_seed_fomo,
                jackpot_after: fomo.balance.value(), version_after: r.version,
            });
        };
        coin
    }

    public fun refund_ico(fomo:&mut FomoData<SUI>,ico: &mut Ico,getico:&mut GetIcoCoin,ctx:&mut TxContext):Coin<SUI>{
        assert!(ico.boo,EIcoend);
        assert!(table::contains(&getico.get, ctx.sender()),0);
        let amount_ = table::remove(&mut getico.get, ctx.sender());
        let cointo = amount_ / 200_000;
        ico.hardCap = ico.hardCap + cointo;
        let coin = coin::take(&mut fomo.balance, cointo, ctx);
        emit(IcoRefunded {
            ico_id: object::id(ico), claims_id: object::id(getico), game_id: object::id(fomo),
            participant: ctx.sender(), returned_sui: coin.value(),
            entitlement_removed: amount_, remaining_cap: ico.hardCap,
        });
        coin
    }

    public fun get_fomo3d(minter: &mut Minter,ico: &mut Ico,getico:&mut GetIcoCoin,ctx:&mut TxContext){
        assert!(!ico.boo,EIcoend);
        assert!(table::contains(&getico.get, ctx.sender()),0);
        let amount_ = table::remove(&mut getico.get, ctx.sender());
        fomo3d::mint_ico(minter, amount_ , ctx);
        emit(IcoClaimProcessed {
            ico_id: object::id(ico), claims_id: object::id(getico), minter_id: object::id(minter),
            participant: ctx.sender(), entitlement_removed: amount_,
        });
    }

    public fun finalize_and_destroy_ico(ico: Ico, getico:GetIcoCoin,ctx: &mut TxContext) {
        // 这里确保只有当下线（boo == false）且额度满（hardCap == 0）时才能销毁
        assert!(!ico.boo && ico.hardCap == 0, 0); 
        assert!(sui::table::is_empty(&getico.get), 1);

    // 确认空了之后，安全解构并销毁
        let event_ico_id = object::id(&ico);
        let event_claims_id = object::id(&getico);
        let GetIcoCoin { id, get } = getico;
        sui::table::destroy_empty(get);
        sui::object::delete(id);
        
        // 此时 ico 是按值传递的（拥有所有权），可以安全地解构并删除
        let Ico { id, .. } = ico; // 使用 .. 忽略其余你没有列出的字段
        sui::object::delete(id);
        emit(IcoFinalized { ico_id: event_ico_id, claims_id: event_claims_id, caller: ctx.sender() });
    }

    fun try_buyback_meme<T>(
        fomo: &mut FomoData<T>,
        pool: &mut Pool<T, SUI>,
        pool_fomo: &mut Pool<FOMO3D, SUI>,
        registry: &PoolRegistry,
        clk: &Clock,
        ctx: &mut TxContext,
    ): Coin<FOMO3D> {
        let amount = fomo.pending_buyback.value();

        // 无预算或首跳受时间限制：不取出资金。
        if (amount == 0 || !swap::can_swap_now(pool, clk)) {
            emit(BuybackSkipped<T> {
                game_id: object::id(fomo), trigger_round_id: fomo.round_id,
                pending_amount: amount, reason: if (amount == 0) { 0 } else { 1 }, timestamp_ms: clk.timestamp_ms(),
            });
            return coin::zero<FOMO3D>(ctx)
        };

        // 首跳：Meme -> SUI。
        let (rx, ry, _) = swap::reserves(pool);
        let gross = swap::quote_or_zero(amount, rx, ry);

        if (gross == 0) {
            emit(BuybackSkipped<T> {
                game_id: object::id(fomo), trigger_round_id: fomo.round_id,
                pending_amount: amount, reason: if (rx == 0 || ry == 0) { 2 } else { 3 }, timestamp_ms: clk.timestamp_ms(),
            });
            return coin::zero<FOMO3D>(ctx)
        };

        // 必须按当前 swap 的实际扣费规则计算净输出。
        let fee = ((gross as u128) * 15 / 1000) as u64;
        let net_sui = gross - fee * 2;

        // 第二跳：SUI -> FOMO3D。
        let (fx, fy, _) = swap::reserves(pool_fomo);
        let out_fomo = swap::quote_or_zero(net_sui, fy, fx);

        if (out_fomo == 0) {
            emit(BuybackSkipped<T> {
                game_id: object::id(fomo), trigger_round_id: fomo.round_id,
                pending_amount: amount, reason: if (fx == 0 || fy == 0) { 4 } else { 5 }, timestamp_ms: clk.timestamp_ms(),
            });
            return coin::zero<FOMO3D>(ctx)
        };

        // 两跳都可执行，现在才取出回购资金。
        let input = coin::from_balance(
            fomo.pending_buyback.split(amount),
            ctx,
        );

        let sui_coin = swap::swap_x_to_y<T, SUI>(
            pool, input, net_sui, registry, clk, ctx,
        );

        // 沿用当前第二跳包内接口的时间检查语义。
        swap::swap_y_to_x_package<FOMO3D, SUI>(
            pool_fomo, sui_coin, out_fomo, clk, ctx,
        )
    }

    fun try_buyback_sui(
        fomo: &mut FomoData<SUI>,
        pool: &mut Pool<FOMO3D, SUI>,
        clk: &Clock,
        ctx: &mut TxContext,
    ): Coin<FOMO3D> {
        // 包括以前未执行的预算，以及本轮新增的预算。
        let amount = fomo.pending_buyback.value();

        // 不取走预算，不修改池，返回零金额 Coin。
        if (amount == 0 || !swap::can_swap_now(pool, clk)) {
            emit(BuybackSkipped<SUI> {
                game_id: object::id(fomo), trigger_round_id: fomo.round_id,
                pending_amount: amount, reason: if (amount == 0) { 0 } else { 1 }, timestamp_ms: clk.timestamp_ms(),
            });
            return coin::zero<FOMO3D>(ctx)
        };

        let (reserve_x, reserve_y, _) = swap::reserves(pool);

        // 池类型是 Pool<FOMO3D, SUI>。
        // 输入 SUI，所以输入储备是 reserve_y，输出储备是 reserve_x。
        let out = swap::quote_or_zero(
            amount,
            reserve_y,
            reserve_x,
        );

        if (out == 0) {
            emit(BuybackSkipped<SUI> {
                game_id: object::id(fomo), trigger_round_id: fomo.round_id,
                pending_amount: amount, reason: if (reserve_x == 0 || reserve_y == 0) { 2 } else { 3 }, timestamp_ms: clk.timestamp_ms(),
            });
            return coin::zero<FOMO3D>(ctx)
        };

        // 确认能够兑换后，才真正取出预算。
        let input = coin::from_balance(
            fomo.pending_buyback.split(amount),
            ctx,
        );

        swap::swap_y_to_x<FOMO3D, SUI>(
            pool,
            input,
            out,
            clk,
            ctx,
        )
    }

}
