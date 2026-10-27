# Fomo3D · Sui DApp

React 19 + TypeScript + Vite + Tailwind 4 + `@mysten/sui` 2.38 + `@mysten/dapp-kit-react` 2.1.42. Uses Sui gRPC for live state, simulation and confirmation; supports GraphQL for event queries. Application code does not use deprecated JSON-RPC.

## 本地运行

```sh
npm ci
npm run dev
```

Requires Node.js 22. The supplied Devnet deployment and publicly verified shared object IDs are configured by default. No private key is needed by the frontend or indexer.

- 主游戏：`0x29174c3720606a1bb7d4fbf7b9647c933f21da0c1c42305d0a6867531f72b697`
- 配置：`src/config/contracts.ts`、`src/config/deployment.ts`
- 首次语言由浏览器首选语言决定：`zh`、简体、繁体、香港、台湾等中文语言显示简体中文，其余显示英文。手动选择会保存在当前设备。
- Logo 是用户提供的原图：`public/fomo3d-logo.png`。

## Vercel 手动部署

1. 导入此 GitHub 仓库，根目录为仓库根。
2. Framework Preset: **Vite**；Install: **npm ci**；Build: **npm run build**；Output: **dist**；Node: **22.x**。
3. 根据 `.env.example` 配置公开环境变量。默认网络为 Devnet；Mainnet/Testnet 不会复用 Devnet 对象。
4. `vercel.json` 已配置 SPA 路由回退。
5. 发布前按下方步骤部署持久索引。Vercel 静态前端不负责运行常驻索引进程。

修改 `VITE_*` 后需要重新构建。不要在 `VITE_*`、仓库或前端中放置私钥、助记词、Supabase service-role key。

## 永久游戏目录与历史索引

`Registry` 的动态字段不存储 Game ID；应用通过真实 `GameCreated<T>`、`PoolCreated<T,SUI>` 事件发现游戏和池，然后重新读取链上共享对象。

生产环境设置：

1. 在你管理的 Supabase 数据库运行 `scripts/indexer-schema.sql`。事件表和游标表启用 RLS，匿名角色只有 SELECT 权限，写入 RPC 仅授予 service_role。
2. 在独立的 Node 22 常驻服务上复制 `.env.indexer.example` 为 `.env.indexer`，填入网络、包地址、RPC/归档 GraphQL 和 Supabase 后端凭据。
3. 运行 `npm run indexer`。用进程管理器保持运行；一个网络/包运行一个实例。
4. Vercel 前端配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`，然后重新部署。

索引器具有幂等事件 ID、原子事件/游标提交、并发游标冲突检测、断点续扫、空分页推进、初始化事件覆盖标识和 chain identifier 检查。无数据库时可以 `node scripts/indexer.mjs --once` 将真实事件保存至 `.indexer/`，用于开发验证；该本地文件不作为生产 API。

必须在公共 RPC 裁剪历史之前启动索引，或使用能够回溯到部署时点的归档源。初始化事件不可取得时，覆盖状态保持不完整；代码不会虚报“全历史”。数据库备份与运维由部署者管理。当前前端对历史进行分页读取并在浏览器聚合，超大规模历史应增加服务端聚合/分页查询，而不是无限扩大浏览器内存。

索引记录仅用于目录和历史。余额、奖池、ICO、Clock、Minter、Halving_cycle、池储备和交易预检查均来自链上。交易确认后的事件会立即合入当前会话目录，再由常驻索引追上。

## 页面和交易

| Route                    | 功能                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `/`                      | 主 SUI 奖池、ICO、游戏大厅、真实事件动态                    |
| `/ico`                   | 认购、完整退款、领取、链上 entitlement                      |
| `/game/sui`, `/game/:id` | 实时状态、线性 Key 价格、倒计时、购买、三类结算路径         |
| `/games`                 | 事件发现的游戏列表，搜索、状态、同币种奖池排序              |
| `/create`                | 创建普通代币游戏及 AMM，合并/拆分 Coin，显示创建事件对象 ID |
| `/fomo`                  | Swap、LP 添加/完整赎回、代币数据、ICO 领取                  |
| `/leaderboard`           | 分币种累计奖金、单次最大赢家、最近中奖                      |
| `/account`               | 余额、entitlement、LP、已创建游戏、个人事件、设备交易记录   |
| `/admin`                 | 持有有效 AdminCap 时可见，初始化主游戏或 FOMO 专用游戏      |
| `/docs`                  | 双语规则、交互分配图、ICO 分配、线性价格与减半演示          |
| `/rules`                 | 风险与规则说明                                              |

所有金额使用 bigint。每次操作新建 Transaction，SDK coin intents 负责 Coin/地址余额与 gas 解析；创建游戏的两笔 T 输入从同一合并 Coin 拆出。返回 Coin/LP 必须转给当前钱包。买 Key 对比最新精确价格，变化时要求重新报价；禁止自动重签。

提交顺序：新建 PTB → 构建和模拟 → 展示金额/Gas → 用户确认 → 再新建 PTB 并模拟 → 钱包签名执行 → 检查 FailedTransaction → waitForTransaction → 刷新链上状态。跨页面锁和执行锁避免重复点击提交；网络和账户变化要求重新检查。收到 digest 并不等于成功。

## 验证命令与证据

```sh
npm run typecheck
npm test
npm run build
node scripts/discover.mjs
node scripts/verify-deployment.mjs
node scripts/simulate-ico.mjs
```

`verify-deployment` 只读校验 14 个已部署公共函数的参数数量、泛型数量与返回数量。证据在 `docs/deployment-verification.json`。

`simulate-ico` 使用未签名交易和模拟 gas，在当前真实 Devnet 对象上模拟 ICO 最后一笔认购 → 建池 → 领取 → 首把 Key。不会提交交易。证据 `docs/ico-simulation.json` 明确标注 `simulationOnly`、`checksEnabled:false`、`gasPaymentMocked:true`。这不代表真实钱包资金、签名或移动设备的端到端测试已完成；ICO 已达标后该脚本会主动停止。

查看 `docs/VALIDATION.md` 和 `docs/SECURITY_NOTES.md` 了解测试边界及合约风险。所有 `.move` 文件保持用户提供状态；仓库与用户本地已有的注释差异没有纳入前端提交。

## 官方 SDK 参考

- [React dApp Kit](https://sdk.mystenlabs.com/dapp-kit/getting-started/react)
- [gRPC client](https://sdk.mystenlabs.com/sui/clients/grpc)
- [GraphQL client](https://sdk.mystenlabs.com/sui/clients/graphql)
- [Signing and execution](https://sdk.mystenlabs.com/sui/transactions/signing-and-execution)

真实资金可能全部损失。合约未经本项目宣称的独立审计，无保本或收益保证。
