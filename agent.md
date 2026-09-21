# TxLens implementation rules

- 不要过度设计。先完成可演示的核心流程，不为假设中的需求添加抽象、账号、数据库或服务。
- 不要过度思考。做合理决定后推进，遇到真实阻碍再调研。
- 不要做过多防御性设计。只在外部输入、密钥、金额和链上事实边界保留必要校验；错误直接解释，不叠加静默兜底。
- Orbio 必须参与最终产品的核心分析：模型负责基于检查证据解释用户请求，不能只放赞助商标。
- 开发阶段允许用户指定的兼容 AI 服务，通过环境变量切换；调用记录必须反映实际提供方，不能伪造 Orbio 已接通。
- 金额、地址、授权与 calldata 由确定性工具校验，模型不得改写检查结论。
- 未识别的合约优先通过 AI 工具查询已验证 ABI 和源码、解码调用，不以逐个添加协议特判作为唯一扩展方式；查询失败和模型推断必须明确区分于已确认事实。
- 示例数据、链上查询、模型调用分别标注；不把示例描述成实时链上验证。
- 只生成未签名交易建议，不持有钱包私钥、不广播交易。
- UI 使用 `.agents/skills/ui-ux-pro-max/SKILL.md`（官方 CLI 的 Codex 初始化目录）。仅初始化 Codex，不使用其他 agent。
- 只测试关键行为，完成类型检查、构建和桌面/移动端验证。
- 钱包兼容性修改先复现关键问题，再测试取消、继续、多钱包共存和弹窗链路；区分模拟测试与真实钱包验证，未做实测就不能宣称该钱包已修好。

## Scope

The product is a free Manifest V3 browser extension, with a companion installation and interactive preview website. No competitor comparisons in the product. English and Simplified Chinese must cover interface text and AI explanations; keep locale handling easy to extend.

Automatically review supported injected EVM wallet requests before forwarding them unchanged to the wallet. Local deterministic checks are immediate; AI explanation is optional and must not block the user's decision. Support exact-origin site pause and resumption. Never claim complete protection, simulation or verified safety from decoded calldata alone. No accounts, database, transaction commission, private-key custody or automatic signing.

Keep AI credentials server-side. Development uses the user's configured compatible provider. Final Orbio integration switches the server configuration and must be validated with real Orbio credentials before claiming it is active.

- 产品文案直接描述操作、资产/权限变化和需要确认的事项，避免“人话”等调侃、技术报告和通用风险套话。界面与 AI 回复默认跟随浏览器语言。主页允许用户手动选择简体中文或 English，记住明确选择，并提供“跟随浏览器”以恢复自动匹配；AI 回复与当前界面语言一致。插件也在顶部提供“跟随浏览器 / 简体中文 / English”，偏好独立保存在插件中并同步到已打开的插件窗口，AI 回复跟随当前界面语言。
