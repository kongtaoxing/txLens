# TxLens · Arc Microgrants 提交材料

核对日期：2026-10-01。活动：[Arc Microgrants / Circle](https://dorahacks.io/hackathon/2238/detail)。

## 先看要求

- 20 个名额，每个 500 USDC，总额 10,000 USDC；滚动评审。
- 截止：2026-10-14 23:59 美东时间，即 **2026-10-15 11:59 香港/北京时间**。官方表示最晚 10 月 21 日给出决定。
- 提交时需要已经可用的 **Arc 主网项目链接**、**公开代码仓库**、**简短项目说明与 Arc 的用途**、**公开开发者主页**。
- 可以是小工具、实验性基础设施、原型，也可以是已有黑客松项目的后续开发。只有设计图、仅测试网、没有 Arc 组件的项目不符合要求；已经获得 Circle 或 Arc 资助的工作不符合要求。
- 不要求已有用户量、公司、商业计划书或路线图。每个项目只提交一次。
- 可以使用公开网名申请；若入选，后续按官方流程完成资格核验并提供能在 Arc 接收 USDC 的地址。

实际申请表需要登录 DoraHacks。以下内容按已经核实的公开要求和常见 BUIDL 字段准备，**不是声称已查看登录后的字段名称、必填状态或字数限制**。如实际表单没有某一项，不必硬加。

## 可直接填写的基本信息

| 项目 | 填写内容 |
| --- | --- |
| 项目名称 | TxLens |
| 一句话介绍 / Tagline | Understand Arc USDC transfers and approvals before you confirm. |
| 项目网站 | https://tx-lens.vercel.app/ |
| 主网演示 | https://tx-lens.vercel.app/#arc |
| 公开代码仓库 | https://github.com/kongtaoxing/txLens |
| 开发者公开主页 | https://github.com/kongtaoxing |
| 插件下载 | https://tx-lens.vercel.app/downloads/txlens-extension.zip |
| 网络 | Arc mainnet — chain ID 5042 |
| 建议分类（若有） | Wallet tooling / Developer tooling / Infrastructure |
| 建议标签（若可自由填写） | Arc, USDC, Wallet UX, Browser Extension, Open Source |
| 金额（若询问申请多少） | 500 USDC |

产品名称继续使用 TxLens。不要写成 Circle 官方产品，不使用“获 Circle 资助”等尚未发生的表述。

## 简短项目说明

可用于短描述：

> TxLens is a free browser extension that explains Arc USDC transfers and spending approvals before wallet confirmation. A live web reader lets anyone inspect real Arc mainnet transactions, including execution status and USDC network fees, without connecting a wallet.

## 完整项目介绍 / BUIDL Description

可整体复制到项目详情；如果只给一个描述框，优先使用这一版：

> TxLens helps people understand wallet requests before they confirm them. A transfer and a spending approval can look similar in a dApp, but have very different consequences. TxLens puts the recipient, amount and permission scope in front of the user before a supported request reaches their wallet.
>
> The product consists of a free Chrome/Edge extension and a companion web app. Deterministic local decoding appears immediately. Users can cancel, continue to their wallet, pause reviews for a specific website, or request an optional AI explanation. The interface and explanations support English and Simplified Chinese, with browser-language defaults and manual selection.
>
> On Arc mainnet, TxLens recognizes native USDC transfers, USDC ERC-20 transfers and spending approvals. It handles Arc's 18-decimal native values separately from the 6-decimal ERC-20 interface, without treating them as different balances. Addresses link to Arc Explorer. The website also reads real mainnet transactions directly from Arc RPC, showing decoded inputs, receipt status and the actual USDC network fee. Reviewers can try this without a wallet or a funded account.
>
> TxLens is open-source, offchain wallet tooling. It does not deploy a new smart contract, hold private keys, sign transactions or charge a transaction commission. Unknown operations remain explicitly unresolved. It does not simulate execution or promise that a request is safe. AI is optional and cannot change the transaction or delay the user's decision.
>
> This application continues an existing wallet-review project with working Arc-specific functionality. The focus is practical USDC usability: helping users distinguish a payment from continuing spending permission, and making Arc activity easier to inspect.

## How does your project use Arc?

> Arc is an execution network supported by TxLens, rather than a branding-only integration. The extension decodes wallet requests for Arc mainnet (5042), recognizes USDC at 0x3600000000000000000000000000000000000000, and uses the correct precision for native USDC values (18 decimals) and ERC-20 amounts and allowances (6 decimals).
>
> The deployed web app's /api/arc endpoint connects to Arc mainnet RPC, verifies the chain ID, reads a recent USDC transaction or a supplied transaction hash, and retrieves its receipt. It displays execution status, decoded amounts and permissions, and actual gas paid in USDC. Results link to Arc Explorer for independent inspection. No wallet connection or new transaction is required for this live mainnet demonstration.
>
> TxLens is an offchain application. There is no TxLens smart-contract deployment address; the Arc USDC system contract is a dependency, not a contract deployed by our team.

## What problem does it solve / Why does it matter?

> Stablecoin users need to know whether they are making a payment or giving an application permission to spend later. TxLens makes that distinction visible before wallet confirmation, while keeping common checks fast and allowing users to bypass extra review on trusted sites. For Arc, it also removes avoidable confusion around USDC-denominated value and fees. A wallet-free mainnet reader makes the same information accessible to users and reviewers after a transaction.

## Technical implementation / Current progress

> Next.js and TypeScript power the web app and server routes. The extension uses Manifest V3 and supported EIP-1193/EIP-6963 injected wallet interfaces. Amounts, addresses and permissions are decoded deterministically with viem. Arc mainnet reads use standard, read-only JSON-RPC methods. Optional AI explanations use a server-side OpenAI-compatible gateway and tools for verified contract ABI/source lookup; API credentials are never included in the extension. The current AI gateway is Orbio and is independent of the Arc integration.
>
> The project includes regression tests for request cancellation and forwarding, multi-wallet behavior, language selection, Arc amount precision, explorer routing and mainnet-reader failure states. Automated wallet doubles are used for compatibility testing; these tests are not a claim that every live wallet or dApp has been tested.

如表单单独问测试结果，可在最终验证记录确认后填：

> 81 automated tests pass, including Arc native/ERC-20 precision and read-only RPC behavior. TypeScript and lint checks pass. Production build and browser verification are recorded in VALIDATION.md, together with the limits of testing.

## Builder / Team introduction

> I build open-source tools that make wallet interactions easier to understand. TxLens combines deterministic transaction decoding with optional AI explanations, focusing on a clear user experience and keeping the user's wallet in control. My public development profile is https://github.com/kongtaoxing and the complete TxLens source is available at https://github.com/kongtaoxing/txLens.

不要编造履历、用户数、团队人数或获奖情况。若表单要求成员列表，按实际参与者填写。

## How would you use the grant?（如询问）

以下是建议用途，提交前确认符合自己的计划；公开规则没有要求预算表或里程碑：

> I would use the 500 USDC microgrant to keep the public Arc reader available, test the extension with real Arc wallet and dApp workflows, and improve USDC request coverage and onboarding. The priority is a small, dependable open-source tool that reviewers and users can try immediately, rather than adding accounts, custody or a new token.

## Previous work / Other grants（如询问）

已有项目继续开发这一点可以直接说明：

> TxLens began as a wallet-request review tool submitted to an earlier Orbio build program. It was not selected there. This submission adds Arc mainnet USDC support and a live mainnet transaction reader. It is a continuation of the existing project, not a claim that the entire codebase was created during this program.

“是否获得 Circle / Arc 资助”必须按本人真实情况回答。已有信息只确认本次 Orbio 未入选，不能据此代替确认所有历史资助。

## 给评委的操作说明

> 1. Open https://tx-lens.vercel.app/#arc and click “Read a recent USDC transaction”. No wallet is required.
> 2. Inspect the execution result, amount, recipient and USDC network fee. Follow the Arc Explorer link to verify the transaction independently. If the latest few blocks contain no matching activity, paste an Arc transaction hash instead.
> 3. Open the interactive preview and compare unlimited approval, ERC-20 transfer and native USDC transfer examples. These are clearly labeled samples and do not submit transactions.
> 4. Download the extension ZIP, unzip it, and load the folder through Chrome/Edge's Extensions page in Developer mode. Reload your dApp. Supported injected-wallet requests open a review before the wallet confirmation. Cancel stops the request; Continue forwards the unchanged request to the wallet for the user's final decision.
> 5. Change the language in the website or extension header. English and Simplified Chinese are supported; each surface remembers its own preference.

## 截图与演示视频

公开页面没有把视频列为硬性要求。若实际 BUIDL 表单提供视频位置，建议补一个 60–90 秒屏幕录制，不需要制作宣传片：

| 时间 | 画面 | 英文旁白 |
| --- | --- | --- |
| 0–10 秒 | 主页及产品名称 | “TxLens helps you understand Arc USDC transfers and approvals before confirming in your wallet.” |
| 10–30 秒 | 点击读取近期交易，展示真实结果并打开浏览器核对 | “This is live Arc mainnet data, not a fixture. We read the transaction and receipt to show the operation, execution status and USDC network fee.” |
| 30–50 秒 | 切换三种明确标注的示例 | “A payment and a spending approval are different. TxLens shows the amount, recipient and permission scope immediately, including Arc's native and ERC-20 USDC interfaces.” |
| 50–70 秒 | 插件真实审阅窗口，取消一笔请求，不签名 | “The extension reviews supported injected-wallet requests. Cancel stops the request; Continue opens the wallet's own confirmation. TxLens never signs or holds keys.” |
| 70–90 秒 | 切换语言，展示 GitHub | “The product is free, bilingual and open-source. AI explanations are optional. Unrecognized behavior is shown as unknown.” |

建议截图：主页、真实 Arc 查询结果、插件审阅窗口。模拟钱包或示例必须标明，不得伪装成真实钱包交易。

## 提交前最后核对

- 线上页面已更新到 0.3.0，`/#arc` 实际可查询；下载 ZIP 也应为 0.3.0。
- GitHub 公开分支包含 Arc 实现和最新验证记录，而不是仅本地代码。
- 表单若强制要求“合约地址”，填写说明“Offchain wallet tooling; no project contract”，不要冒用 USDC 系统合约作为自己部署的合约。最终是否接受这种工具形态由主办方判断。
- 联系邮箱、Telegram / X、居住地或身份信息按本人实际填写；材料中不猜测。
- 收款地址需要由本人确认支持在 Arc 接收 USDC；不复制聊天中的历史交易地址作为收款地址。
- 没有录制视频就不要填虚构视频链接，没有用户量证明就不要填估计数字。
- 登录后核对真实字段、字数上限、条款和资格声明，再由本人提交。

## 参考与可复核主网记录

- [官方活动与要求](https://dorahacks.io/hackathon/2238/detail)
- [Arc 主网网络配置](https://docs.arc.io/arc/references/connect-to-arc)
- [USDC 合约与精度](https://docs.arc.io/arc/references/contract-addresses)
- 2026-10-01 06:10 UTC，开发检查从官方 RPC 读取到 [Arc 主网交易 0xf20a…b54b](https://explorer.arc.io/tx/0xf20a3a85840d69c41d77b88a638d2ca33ccd5ea578f92e6e014cbe4fc40ab54b)，区块 23664509，成功，网络手续费 0.00052500002625 USDC。这是公开链上第三方交易，不是 TxLens 发起的交易，也不作为自己的合约部署证明。
