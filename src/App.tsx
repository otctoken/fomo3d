import { Logo } from "./components/Logo";
import { useState } from "react";
import { NavLink, Link, Route, Routes } from "react-router-dom";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCurrentNetwork, useDAppKit } from "@mysten/dapp-kit-react";
import { Flame, Menu, X, Globe, ArrowUpRight, Github } from "lucide-react";
import { useOwned } from "./hooks/useProtocol";
import { useI18n } from "./components/I18n";
import { DataHealth, PageTitle } from "./components/Common";
import { config, explorer, networks, type Network } from "./config/contracts";
import { short } from "./lib/sui/math";
import { Home } from "./pages/Home";
import { Ico } from "./pages/Ico";
import { Games } from "./pages/Games";
import { GamePage } from "./pages/Game";
import { CreateGame } from "./pages/CreateGame";
import { Fomo } from "./pages/Fomo";
import { Account } from "./pages/Account";
import { Leaderboard } from "./pages/Leaderboard";
import { Admin } from "./pages/Admin";
import { Docs } from "./pages/Docs";
import { useTransaction } from "./components/Transactions";
export default function App() {
  const { t, toggle, lang } = useI18n(),
    network = useCurrentNetwork(),
    kit = useDAppKit(),
    owned = useOwned(),
    [menu, setMenu] = useState(false);
  const c = config(network);
  const { busy } = useTransaction();
  return (
    <div className="app">
      <div className="network-banner">
        {network === "mainnet"
          ? t(
              "Real funds · Understand the game before participating",
              "真实资金 · 参与前请了解规则",
            )
          : t(
              `${network.toUpperCase()} NETWORK · Experimental deployment · Tokens have no guaranteed value`,
              `${network.toUpperCase()} 网络 · 实验性部署 · 代币价值无保证`,
            )}
      </div>
      <header className="site-header">
        <Link to="/" className="brand">
          <Logo />
          Fomo<span>3D</span>
        </Link>
        <nav
          className={menu ? "main-nav open" : "main-nav"}
          onClick={() => setMenu(false)}
        >
          <NavLink to="/" end>
            {t("Home", "首页")}
          </NavLink>
          <NavLink to="/game/sui" className="sui-nav">
            {t("SUI Game", "SUI 游戏")}
            <span className="dot" />
          </NavLink>
          <NavLink to="/games">{t("All Games", "全部游戏")}</NavLink>
          <NavLink to="/fomo">FOMO3D</NavLink>
          <NavLink to="/account">{t("My Account", "我的账户")}</NavLink>
          <NavLink to="/docs">{t("Docs", "文档")}</NavLink>
          {!!owned.data?.adminCaps.length && (
            <NavLink to="/admin">Admin</NavLink>
          )}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button language"
            onClick={toggle}
            aria-label="Switch language"
          >
            <Globe size={16} />
            <span>{lang === "en" ? "EN" : "中文"}</span>
          </button>
          <select
            className="network-select"
            aria-label="Network"
            disabled={busy}
            value={network}
            onChange={(e) => kit.switchNetwork(e.target.value as Network)}
          >
            {networks.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <ConnectButton>{t("Connect Wallet", "连接钱包")}</ConnectButton>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <DataHealth />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ico" element={<Ico />} />
          <Route path="/games" element={<Games />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/fomo" element={<Fomo />} />
          <Route path="/account" element={<Account />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/rules" element={<Rules />} />
          <Route
            path="*"
            element={
              <>
                <PageTitle title="404" />
                <Link to="/">{t("Back home", "返回首页")}</Link>
              </>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="footer-main">
          <div>
            <Link to="/" className="brand">
              <Logo />
              Fomo<span>3D</span>
            </Link>
            <p>
              {t(
                "The last key. The next chapter.",
                "最后一把 Key，下一个篇章。",
              )}
            </p>
            <span className="powered">◈ BUILT ON SUI</span>
          </div>
          <div className="footer-links">
            <Link to="/docs">{t("Docs", "文档")}</Link>
            <Link to="/rules">{t("Game rules & risks", "游戏规则与风险")}</Link>
            <Link to="/leaderboard">{t("Leaderboard", "排行榜")}</Link>
            <a href="https://x.com/SuiSgGame" target="_blank" rel="noreferrer">
              X / Twitter <ArrowUpRight size={12} />
            </a>
            <a href="https://t.me/Sui_Nav" target="_blank" rel="noreferrer">
              Telegram <ArrowUpRight size={12} />
            </a>
            <a
              href="https://github.com/otctoken/fomo3d"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={14} /> GitHub
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            {t(
              "Participation can result in total loss. No guaranteed returns.",
              "参与可能损失全部资金，无收益保证。",
            )}
          </span>
          {c.packageId && (
            <a
              href={explorer(network, "object", c.packageId)}
              target="_blank"
              rel="noreferrer"
            >
              {network} · {short(c.packageId)} ↗
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
function Rules() {
  const { t } = useI18n();
  return (
    <>
      <PageTitle
        eyebrow="READ BEFORE PLAYING"
        title={t("Know the game. Know the risk.", "了解游戏，了解风险。")}
      />
      <div className="panel prose">
        <h2>{t("The last key", "最后一把 Key")}</h2>
        <p>
          {t(
            "Each key purchase resets the timer using Sui’s Clock. The last buyer at expiry receives 65% when anyone settles the round. Until the first key, a round is waiting and has no countdown. Key prices grow linearly using initial + keys × floor(initial × pup / 1000).",
            "每次购买 Key 按 Sui Clock 重置计时。到期后任何人可结算，最后购买者获得 65%。第一把 Key 前没有倒计时。价格按 initial + keys × floor(initial × pup / 1000) 线性增长。",
          )}
        </p>
        <h2>{t("Three settlement routes", "三种结算方式")}</h2>
        <p>
          {t(
            "SUI: 65% winner, approximately 30% rollover, 5% FOMO buyback. Community tokens: 65% winner, approximately 30% rollover, 2% two-hop buyback and 3% transfer to 0x0. FOMO3D: 65% winner, approximately 30% rollover and 5% direct burn. Integer rounding remains in the pool.",
            "SUI：65% 赢家、约 30% 下一轮、5% 回购 FOMO。社区代币：65% 赢家、约 30% 下一轮、2% 两跳回购、3% 转入 0x0。FOMO3D：65% 赢家、约 30% 下一轮、5% 直接销毁。整数取整余款留在奖池。",
          )}
        </p>
        <h2>{t("Liquidity and contract risks", "流动性与合约风险")}</h2>
        <p>
          {t(
            "Game creators own their initial LP and may withdraw liquidity. AMM prices can move sharply; buybacks may be delayed or skipped when reserves or the time gate prevent execution. A blackhole transfer does not necessarily reduce a third-party token’s supply. The same-timestamp guard is not a general MEV guarantee.",
            "游戏创建者持有初始 LP，可撤走流动性。AMM 价格可能剧烈变化，储备不足或时间限制可能导致回购延迟或跳过。黑洞转账不一定减少第三方代币供应量。同一时间戳检查不构成全面 MEV 防护。",
          )}
        </p>
        <p>
          {t(
            "The contract exposes administrator version changes. This UI never calls change_version. The token mint cap is checked before minting rather than clamping the entire mint, and a claim can consume an entitlement while minting zero at the cap. Verify actual MintProcessed events.",
            "合约包含管理员版本修改能力，本界面不调用 change_version。铸币上限在铸币前检查，未对整笔铸币量裁剪；达到上限时领取可能移除份额但实际铸币为零，应核对 MintProcessed 事件。",
          )}
        </p>
        <h2>{t("No guaranteed return", "无收益保证")}</h2>
        <p>
          {t(
            "Key purchases are not refundable. There may always be a later buyer. Smart-contract, token, network, indexer, liquidity, and wallet risks can cause loss of all funds. Devnet can reset and historical public RPC coverage is limited.",
            "Key 购买不可退款，随时可能出现后续买家。合约、代币、网络、索引、流动性与钱包风险可能造成全部资金损失。Devnet 可能重置，公共 RPC 历史保留范围有限。",
          )}
        </p>
      </div>
    </>
  );
}
