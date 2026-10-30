# Fomo3D on Sui

**The last key wins.**

Fomo3D is an on-chain countdown game and token ecosystem on Sui. Players buy Keys to grow the prize pool and become the latest Key holder. Every successful purchase resets the timer. When time runs out, the last buyer wins the largest share of the pool, and part of the balance carries into the next round.

[Play Fomo3D](https://fomo.dappnav.org) · [Game Guide](https://fomo.dappnav.org/docs) · [Game Lobby](https://fomo.dappnav.org/games)

## How to Play

1. Connect a Sui wallet to the application on Sui Mainnet.
2. Open the SUI game or choose a community token game.
3. Review the current Key price, prize pool, and countdown before confirming a purchase.
4. Buy a Key to become the latest holder and reset the countdown.
5. If no one buys another Key before the deadline, the last holder wins when the round is settled on-chain.

A Key purchase does not guarantee a win. Another player can take the lead by purchasing the next Key. The contract determines transaction ordering, deadlines, and settlement results.

## The SUI Game

| Parameter | Value |
| --- | --- |
| Initial Key price | 2 SUI |
| Price increase per Key | 0.004 SUI |
| Countdown reset | 60 seconds |
| Winner's share | 65% of the round's prize pool |
| Next-round pool | Approximately 30%, including rounding remainder |
| FOMO3D buyback and burn | 5% |

Key prices increase linearly: each purchase adds a fixed amount to the next Key's price. The countdown starts with the first purchase of a round and resets with each subsequent purchase.

SUI Key purchases also reward FOMO3D tokens according to the contract's issuance and halving rules. The game page displays the reward for the current purchase.

[Open the SUI Game](https://fomo.dappnav.org/game/sui)

## Genesis ICO

The Genesis ICO targets **11,000 SUI**, with an allocation of **200,000 FOMO3D per SUI** contributed.

At completion:

- **10,000 SUI** seeds the main game's prize pool.
- **1,000 SUI** and **200 million FOMO3D** establish initial FOMO3D/SUI liquidity.
- Contributors can claim their allocated FOMO3D tokens.
- Community game creation becomes available.

Contributions above the remaining ICO capacity return the excess SUI through the transaction.

[View the ICO](https://fomo.dappnav.org/ico)

## FOMO3D and Community Games

FOMO3D connects gameplay rewards with token trading and buyback-and-burn mechanics. Players can swap FOMO3D and SUI, add liquidity, and manage liquidity positions through the application.

After the Genesis ICO completes, users can create games for other tokens with their own starting Key price, fixed price increment, and countdown settings.

Round distributions depend on the game token:

| Game | Winner | Next round | Other allocation |
| --- | --- | --- | --- |
| SUI | 65% | Approximately 30% | 5% buys back and burns FOMO3D |
| FOMO3D | 65% | Approximately 30% | 5% burns FOMO3D directly |
| Other tokens | 65% | Approximately 30% | 2% routes through SUI to buy back and burn FOMO3D; 3% transfers to the zero address |

A zero-address transfer is distinct from a supply-reducing token burn. Exact allocations use the contract's integer arithmetic.

[Explore FOMO3D](https://fomo.dappnav.org/fomo) · [Community Swap](https://fomo.dappnav.org/swap) · [Create a Game](https://fomo.dappnav.org/create)

## Explore the Platform

- **Game Lobby:** Discover the SUI game and community token games.
- **Swap and Liquidity:** Search community pools by token name or address, exchange tokens, and provide liquidity.
- **Leaderboard:** View winners and recorded payouts.
- **Account:** Review balances, liquidity positions, created games, and activity.
- **Docs:** Explore game rules, token distribution, and interactive examples.

The interface supports English and Chinese, automatically selects a language from browser preferences, and adapts to desktop and mobile screens.

## Understand the Rules

Fomo3D is a competitive game involving real tokens. Purchases can result in a complete loss, token prices can change, and liquidity provision carries risk. No return or token value is guaranteed. Read the [game guide](https://fomo.dappnav.org/docs) and [rules](https://fomo.dappnav.org/rules) before participating.
