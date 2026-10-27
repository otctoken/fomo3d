module fomo::swap {
    use sui::event::emit;
    use std::type_name;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::object::{Self, ID};
    use sui::dynamic_field as df;
    use sui::clock::{Self, Clock};
    use sui::sui::SUI;





    const EZeroAmount: u64 = 0;
    const EInsufficientLiquidity: u64 = 1;
    const ESlippage: u64 = 2;
    const EWrongPool: u64 = 3;
    const ESameType: u64 = 4;
    const ESameTypeName: u64 = 5;
    const ESpt: u64 = 6;

    public struct PoolRegistry has key {
        id: UID,
        admin:address,
    }

    /// The pool is a shared object. X and Y have a fixed order.
    public struct Pool<phantom X, phantom Y> has key {
        id: UID,
        reserve_x: Balance<X>,
        reserve_y: Balance<Y>,
        total_shares: u128,
        buytime:u64,
        selltime:u64,
        addtime:u64,
        removetime:u64,
    }

    /// A freely transferable LP position for exactly one pool.
    public struct LP<phantom X, phantom Y> has key, store {
        id: UID,
        pool: ID,
        shares: u128,
    }


    public struct PoolRegistryCreated has copy, drop {
        registry_id: ID, admin: address,
    }
    public struct PoolAdminChanged has copy, drop {
        registry_id: ID, old_admin: address, new_admin: address,
    }
    public struct PoolCreated<phantom X, phantom Y> has copy, drop {
        registry_id: ID, pool_id: ID, initial_lp_id: ID, creator: address,
        amount_x: u64, amount_y: u64, total_shares: u128,
    }
    public struct LiquidityAdded<phantom X, phantom Y> has copy, drop {
        pool_id: ID, lp_id: ID, provider: address,
        used_x: u64, used_y: u64, returned_x: u64, returned_y: u64,
        shares_minted: u128, total_shares_after: u128,
        reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,
    }
    public struct LiquidityRemoved<phantom X, phantom Y> has copy, drop {
        pool_id: ID, lp_id: ID, caller: address, shares_burned: u128,
        amount_x: u64, gross_y: u64, net_y: u64, admin_fee_y: u64, fee_recipient: address,
        min_x: u64, min_y: u64, total_shares_after: u128,
        reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,
    }
    public struct SwapExecuted<phantom X, phantom Y> has copy, drop {
        pool_id: ID, caller: address, direction: u8, // 0: X -> Y, 1: Y -> X
        package_route: bool, amount_in: u64, gross_out: u64, amount_out: u64,
        admin_fee: u64, lp_fee: u64, fee_recipient: Option<address>, min_out: u64,
        reserve_x_after: u64, reserve_y_after: u64, timestamp_ms: u64,
    }

    public(package) fun change_admin(r:&mut PoolRegistry,a:address){
        let event_old_admin = r.admin;
        r.admin = a;
        emit(PoolAdminChanged { registry_id: object::id(r), old_admin: event_old_admin, new_admin: r.admin });
    }



    fun init(ctx: &mut TxContext) {
        let registry = PoolRegistry {
            id: object::new(ctx),
            admin:tx_context::sender(ctx),
        };

        emit(PoolRegistryCreated { registry_id: object::id(&registry), admin: registry.admin });
        transfer::share_object(registry);
    }

    /// Create a new public pool and receive the initial LP position.

    /// The creator sets the initial price through its deposit ratio.
    public(package) fun create_pool<X>(
        x: Coin<X>,
        y: Coin<SUI>,
        registry:&mut PoolRegistry,
        ctx: &mut TxContext,
    ): LP<X, SUI> {
        assert!(type_name::with_defining_ids<X>() != type_name::with_defining_ids<SUI>(),ESameType);
        let x_type = type_name::with_defining_ids<X>();
        assert!(!df::exists(&registry.id,x_type),ESameTypeName);
        df::add(&mut registry.id,x_type, 0u8);
        let amount_x = coin::value(&x);
        let amount_y = coin::value(&y);
        assert!(amount_x > 0 && amount_y > 0, EZeroAmount);
        // Educational LP-share convention; both example coins use 9 decimals.
        // A production DEX generally uses sqrt(amount_x * amount_y) and
        // permanently locks minimum initial liquidity.
        let shares = min_u256(amount_x as u256, amount_y as u256) as u128;
        let pool = Pool<X, SUI> {
            id: object::new(ctx),
            reserve_x: coin::into_balance(x),
            reserve_y: coin::into_balance(y),
            total_shares: shares,
            buytime:0,
            selltime:0,
            addtime:0,
            removetime:0,
        };
        let lp = LP<X, SUI> {
            id: object::new(ctx),
            pool: object::id(&pool),
            shares,
        };
        emit(PoolCreated<X, SUI> {
            registry_id: object::id(registry), pool_id: object::id(&pool),
            initial_lp_id: object::id(&lp), creator: ctx.sender(),
            amount_x, amount_y, total_shares: pool.total_shares,
        });
        transfer::share_object(pool);
        lp
    }

    public fun add_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        mut x: Coin<X>,
        mut y: Coin<Y>,
        min_shares: u128,
        clk: &Clock,
        ctx: &mut TxContext,
    ): (LP<X, Y>, Coin<X>, Coin<Y>) {
        assert!(protectTransaction(pool.buytime,pool.selltime,pool.addtime,pool.removetime,clock::timestamp_ms(clk)),ESpt);
        pool.addtime = clock::timestamp_ms(clk);
        let input_x = coin::value(&x);
        let input_y = coin::value(&y);
        assert!(input_x > 0 && input_y > 0, EZeroAmount);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        let total_shares = pool.total_shares;

        let (used_x, used_y, shares) = if (total_shares == 0) {
            // A pool can be restarted after all liquidity is removed.
            assert!(reserve_x == 0 && reserve_y == 0, EInsufficientLiquidity);
            (
                input_x,
                input_y,
                min_u256(input_x as u256, input_y as u256) as u128,
            )
        } else {
            assert!(reserve_x > 0 && reserve_y > 0, EInsufficientLiquidity);
            let lp_x = (input_x as u256) * (total_shares as u256) / (reserve_x as u256);
            let lp_y = (input_y as u256) * (total_shares as u256) / (reserve_y as u256);
            let shares = min_u256(lp_x, lp_y) as u128;
            assert!(shares > 0, EZeroAmount);
            let used_x = ceil_div(
                (shares as u256) * (reserve_x as u256),
                total_shares as u256,
            ) as u64;
            let used_y = ceil_div(
                (shares as u256) * (reserve_y as u256),
                total_shares as u256,
            ) as u64;
            (used_x, used_y, shares)
        };
        assert!(shares > 0 && shares >= min_shares, ESlippage);
        assert!(used_x <= input_x && used_y <= input_y, EInsufficientLiquidity);

        balance::join(&mut pool.reserve_x, coin::into_balance(coin::split(&mut x, used_x, ctx)));
        balance::join(&mut pool.reserve_y, coin::into_balance(coin::split(&mut y, used_y, ctx)));
        pool.total_shares = pool.total_shares + shares;

        let lp = LP<X, Y> {
            id: object::new(ctx),
            pool: object::id(pool),
            shares,
        };
        emit(LiquidityAdded<X, Y> {
            pool_id: object::id(pool), lp_id: object::id(&lp), provider: ctx.sender(),
            used_x, used_y, returned_x: x.value(), returned_y: y.value(),
            shares_minted: shares, total_shares_after: pool.total_shares,
            reserve_x_after: pool.reserve_x.value(), reserve_y_after: pool.reserve_y.value(),
            timestamp_ms: clk.timestamp_ms(),
        });
        (lp, x, y)
    }

    /// Fully redeem one LP position. Pass min outputs for slippage protection.
    public fun remove_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        lp: LP<X, Y>,
        min_x: u64,
        min_y: u64,
        registry:&PoolRegistry,
        clk:&Clock,
        ctx: &mut TxContext,
    ): (Coin<X>, Coin<Y>) {
        assert!(protectTransaction(pool.buytime,pool.selltime,pool.addtime,pool.removetime,clock::timestamp_ms(clk)),ESpt);
        pool.removetime = clock::timestamp_ms(clk);
        assert!(lp.pool == object::id(pool), EWrongPool);
        let shares = lp.shares;
        assert!(shares > 0 && shares <= pool.total_shares, EInsufficientLiquidity);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        let amount_x = ((reserve_x as u256) * (shares as u256)
            / (pool.total_shares as u256)) as u64;
        let amount_y = ((reserve_y as u256) * (shares as u256)
            / (pool.total_shares as u256)) as u64;
        assert!(amount_x > 0 && amount_y > 0, EInsufficientLiquidity);
        assert!(amount_x >= min_x && amount_y >= min_y, ESlippage);

        pool.total_shares = pool.total_shares - shares;
        let admin_fee = ((amount_y as u128) / 100) as u64;
        let outy = amount_y - admin_fee;
        let out_x = coin::from_balance(balance::split(&mut pool.reserve_x, amount_x), ctx);
        let out_y = coin::from_balance(balance::split(&mut pool.reserve_y, outy), ctx);
        let cointoA = coin::from_balance(balance::split(&mut pool.reserve_y, admin_fee), ctx);
        transfer::public_transfer(cointoA,registry.admin);
        let event_lp_id = object::id(&lp);
        let LP { id, pool: _, shares: _ } = lp;
        object::delete(id);
        emit(LiquidityRemoved<X, Y> {
            pool_id: object::id(pool), lp_id: event_lp_id, caller: ctx.sender(), shares_burned: shares,
            amount_x: out_x.value(), gross_y: amount_y, net_y: out_y.value(),
            admin_fee_y: admin_fee, fee_recipient: registry.admin, min_x, min_y,
            total_shares_after: pool.total_shares, reserve_x_after: pool.reserve_x.value(),
            reserve_y_after: pool.reserve_y.value(), timestamp_ms: clk.timestamp_ms(),
        });
        (out_x, out_y)
    }

    /// X -> Y swap. The full input joins reserves, including the 0.3% fee.
    public fun swap_x_to_y<X, Y>(
        pool: &mut Pool<X, Y>,
        input: Coin<X>,
        min_out: u64,
        registry:&PoolRegistry,
        clk:&Clock,
        ctx: &mut TxContext,
    ): Coin<Y> {
        assert!(protectTransaction(pool.buytime,pool.selltime,pool.addtime,pool.removetime,clock::timestamp_ms(clk)),ESpt);
        pool.selltime = clock::timestamp_ms(clk);
        let amount_in = coin::value(&input);
        let out_ = get_amount_out(
            amount_in,
            balance::value(&pool.reserve_x),
            balance::value(&pool.reserve_y),
        );
        let admin_fee = ((out_ as u128) * 15  / 1000) as u64;
        let out = out_ - (admin_fee * 2);
        assert!(out >= min_out, ESlippage);
        balance::join(&mut pool.reserve_x, coin::into_balance(input));
        let cointoA = coin::from_balance(balance::split(&mut pool.reserve_y, admin_fee), ctx);
        transfer::public_transfer(cointoA,registry.admin);
        let event_output = coin::from_balance(balance::split(&mut pool.reserve_y, out), ctx);
        emit(SwapExecuted<X, Y> {
            pool_id: object::id(pool), caller: ctx.sender(), direction: 0,
            package_route: false, amount_in, gross_out: out_, amount_out: event_output.value(),
            admin_fee: admin_fee, lp_fee: admin_fee, fee_recipient: option::some(registry.admin), min_out,
            reserve_x_after: pool.reserve_x.value(), reserve_y_after: pool.reserve_y.value(),
            timestamp_ms: clk.timestamp_ms(),
        });
        event_output
    }

    /// Y -> X swap.
    public fun swap_y_to_x<X, Y>(
        pool: &mut Pool<X, Y>,
        input: Coin<Y>,
        min_out: u64,
        clk:&Clock,
        ctx: &mut TxContext,
    ): Coin<X> {
        assert!(protectTransaction(pool.buytime,pool.selltime,pool.addtime,pool.removetime,clock::timestamp_ms(clk)),ESpt);
        pool.buytime = clock::timestamp_ms(clk);
        let amount_in = coin::value(&input);
        let out = get_amount_out(
            amount_in,
            balance::value(&pool.reserve_y),
            balance::value(&pool.reserve_x),
        );
        assert!(out >= min_out, ESlippage);
        balance::join(&mut pool.reserve_y, coin::into_balance(input));
        let event_output = coin::from_balance(balance::split(&mut pool.reserve_x, out), ctx);
        emit(SwapExecuted<X, Y> {
            pool_id: object::id(pool), caller: ctx.sender(), direction: 1,
            package_route: false, amount_in, gross_out: out, amount_out: event_output.value(),
            admin_fee: 0, lp_fee: 0, fee_recipient: option::none(), min_out,
            reserve_x_after: pool.reserve_x.value(), reserve_y_after: pool.reserve_y.value(),
            timestamp_ms: clk.timestamp_ms(),
        });
        event_output
    }

    public(package) fun swap_y_to_x_package<X, Y>(
        pool: &mut Pool<X, Y>,
        input: Coin<Y>,
        min_out: u64,
        clk:&Clock,
        ctx: &mut TxContext,
    ): Coin<X> {
        pool.buytime = clock::timestamp_ms(clk);
        let amount_in = coin::value(&input);
        let out = get_amount_out(
            amount_in,
            balance::value(&pool.reserve_y),
            balance::value(&pool.reserve_x),
        );
        assert!(out >= min_out, ESlippage);
        balance::join(&mut pool.reserve_y, coin::into_balance(input));
        let event_output = coin::from_balance(balance::split(&mut pool.reserve_x, out), ctx);
        emit(SwapExecuted<X, Y> {
            pool_id: object::id(pool), caller: ctx.sender(), direction: 1,
            package_route: true, amount_in, gross_out: out, amount_out: event_output.value(),
            admin_fee: 0, lp_fee: 0, fee_recipient: option::none(), min_out,
            reserve_x_after: pool.reserve_x.value(), reserve_y_after: pool.reserve_y.value(),
            timestamp_ms: clk.timestamp_ms(),
        });
        event_output
    }

    /// Quote output using u256 to prevent overflow in products of u64 reserves.
    public fun get_amount_out(
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64
    ): u64 {
        assert!(amount_in > 0, EZeroAmount);
        assert!(
            reserve_in > 0 && reserve_out > 0,
            EInsufficientLiquidity
        );

        let output =
            (amount_in as u256) * (reserve_out as u256)
            / ((reserve_in as u256) + (amount_in as u256));

        assert!(
            output > 0 && output < (reserve_out as u256),
            EInsufficientLiquidity
        );

        output as u64
    }

    public(package) fun quote_or_zero(
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
    ): u64 {
        if (amount_in == 0 || reserve_in == 0 || reserve_out == 0) {
            return 0
        };

        (
            (amount_in as u256) * (reserve_out as u256)
            / ((reserve_in as u256) + (amount_in as u256))
        ) as u64
    }

    public fun reserves<X, Y>(pool: &Pool<X, Y>): (u64, u64, u128) {
        (
            balance::value(&pool.reserve_x),
            balance::value(&pool.reserve_y),
            pool.total_shares,
        )
    }

    fun min_u256(a: u256, b: u256): u256 {
        if (a < b) a else b
    }

    fun ceil_div(n: u256, d: u256): u256 {
        let q = n / d;
        if (n % d == 0) q else q + 1
    }

    //Preventing MEV sandwich attacks 
    public fun protectTransaction(a:u64,b:u64,c:u64,d:u64,time:u64):bool{
        if(a!=time && b!=time && c!=time  && d!=time){
            true
        }else{
            false
        }
    }

    public(package) fun can_swap_now<X, Y>(
        pool: &Pool<X, Y>,
        clk: &Clock,
    ): bool {
        protectTransaction(
            pool.buytime,
            pool.selltime,
            pool.addtime,
            pool.removetime,
            clk.timestamp_ms(),
        )
    }


}
