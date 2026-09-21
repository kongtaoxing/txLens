# TxLens

Review wallet requests before you confirm them. TxLens is a free Chrome / Edge extension that shows recipients, amounts and permissions, with optional AI explanations powered by Orbio.

- Local checks appear immediately. AI never blocks Cancel or Continue.
- The AI can investigate verified contract ABI and source, including proxy implementations and nested calls.
- English and Simplified Chinese cover the interface, findings and AI explanations.
- Pause one website for 15 minutes, skip it indefinitely, or resume reviews.
- No account, transaction commission, private-key custody or automatic signing.

## Run locally

Requirements: Node.js 22.x, npm, and desktop Chrome / Edge 120+. Extension ZIPs are built with JavaScript; no system ZIP utility is required.

From the cloned repository:

```sh
npm ci
cp .env.example .env.local
npm run build:extension
npm run dev
```

Open **http://localhost:5173** for the product page, interactive preview and extension download. Basic checks work without an AI key. To enable AI, fill in the server-side settings described below and restart the development server.

### Install the extension

1. Open your browser's Extensions manager and enable **Developer mode**.
2. Choose **Load unpacked** and select `build/txlens-extension`.
3. Pin TxLens and reload the dApp in the same browser/profile as your wallet.
4. A supported transaction or signing request opens a TxLens review window. Cancel or close it to reject; Continue forwards the original request to the wallet for its own confirmation.

`npm run build:extension` also creates `public/downloads/txlens-extension.zip`. Unzip it before loading. Generated packages are excluded from Git; build them from source or attach the ZIP to a GitHub Release. There is no Chrome Web Store listing yet. Opening the website alone does not install the extension.

## Orbio configuration

Set these in **`.env.local` on the server**, using `.env.example` as the template:

| Variable | Purpose |
| --- | --- |
| `AI_BASE_URL` | Orbio gateway, `https://api.orbio.so/api/v1` |
| `AI_API_KEY` | Your Orbio gateway key; never commit it |
| `AI_MODEL` | Tested model: `deepseek/deepseek-v4.1-flash` |
| `AI_PROVIDER_LABEL` | `Orbio` |
| `TXLENS_EXTENSION_IDS` | Optional comma-separated IDs for older unpacked installations |
| `TXLENS_SERVICE_URL` | Optional public HTTPS backend origin for extension builds |

Never put a key in extension files or `NEXT_PUBLIC_*` variables. The extension stores the **TxLens backend URL**, not an AI provider endpoint or key. Local builds default to `http://localhost:5173`. Vercel builds use the production domain; `TXLENS_SERVICE_URL` can explicitly select another HTTPS origin at build time. A different backend can also be selected in extension settings, with browser permission for that host. Existing installations keep their saved settings.

On demand, `/api/explain` sends request evidence to Orbio. The model can call tools to retrieve verified ABI/source from Sourcify, inspect reported proxy implementations and decode nested bytes. Results explain the action, its effect and what to check; supporting sources are available in the review. Deterministic findings are kept separate from model interpretation.

Real Orbio-backed Chinese and English explanations and contract-tool calls were verified on September 17, 2026. See [VALIDATION.md](VALIDATION.md) for evidence and limits. Runtime provider labels reflect the configured endpoint.

Opening `/api/explain` in a browser is a read-only status check. `online` / `aiConfigured` does not test upstream model connectivity or make a paid AI call.

## Language

The website defaults to browser language and offers **Auto / 简体中文 / English**. An explicit choice is saved in a website-only cookie and also sets the demo's AI language; Auto restores browser matching.

The extension follows the browser UI language automatically. Chinese locales use Simplified Chinese; other currently unsupported languages use English. Old extension language overrides are ignored.

## Coverage and limits

**Wallet transport.** Injected EVM providers using EIP-1193 `request`, including EIP-6963 announcements and the separate OKX `window.okxwallet` entry. Reviewed methods include `eth_sendTransaction`, `eth_signTransaction`, `wallet_sendCalls`, `personal_sign`, `eth_sign` and typed-data variants. Connection and read-only requests pass through. Parameters are snapshotted; a network change cancels before forwarding.

**Local decoding.** Native value, selected known ERC-20 transfers/approvals, `setApprovalForAll`, readable Permit/Permit2 fields, selected Universal Router commands and Arbitrum Uniswap v4 liquidity actions. Unsupported behavior stays visible. Unknown token decimals remain raw rather than becoming a guessed amount. AI contract investigation extends beyond these local decoders.

**Explorer links.** Addresses in facts, raw requests and AI explanations link to the configured network's explorer. Unsupported networks do not fall back to a different chain.

**Privacy.** Local checks do not require a backend. Clicking AI sends the request to the configured backend for analysis and public contract lookup. No persistent review history is kept; cancellation, navigation, tab closure and expiry clear pending reviews. Website pause preferences are stored locally.

TxLens does not simulate execution, independently verify deployed bytecode, predict final balances/gas or guarantee safety. Signing alone can grant spending rights. The extension is a review assistant, not a security boundary against a malicious page.

Legacy `send` / `sendAsync`, direct broadcasts, non-EVM wallets, remote WalletConnect sessions and standalone wallet apps are outside current coverage. Locked globals, cached original provider references and very early calls can bypass the hook. Automated provider doubles do not establish compatibility with every live wallet or dApp.

## Development and verification

```sh
npm test
npm run typecheck
npm run lint
npm run build:extension
npm run build
```

The site uses Next.js with Node.js API routes. `npm run build` first creates the extension ZIP, then builds the website and API. `npm start` serves the production build on port 5173.

### Deploy on Vercel

Import this repository as **Next.js**, with Node.js **22.x**. `vercel.json` sets installation to `npm ci` and building to `npm run build`; leave the output directory at its framework default.

Add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` and `AI_PROVIDER_LABEL` to the project's server-side environment variables. The key stays in Vercel settings, never Git or a `NEXT_PUBLIC_*` variable. Redeploy after changing environment values. Without a key, local checks still work and the AI endpoint reports unconfigured.

The downloadable extension defaults to `VERCEL_PROJECT_PRODUCTION_URL`, automatically supplied by Vercel. To select your custom domain explicitly, set `TXLENS_SERVICE_URL=https://your-domain` before building. The built manifest grants access to that origin. Keep automatic system environment variables enabled; local builds use localhost. Existing users with a saved backend can change it in extension settings.

The lockfile overrides three unavailable transitive versions with published versions from the same minor series: `tinyglobby@0.2.17`, `@floating-ui/utils@0.2.12` and `@napi-rs/wasm-runtime@0.2.12`. Validate installs against the public registry without relying on a pre-populated cache when updating dependencies.

For an isolated browser replay, run `node scripts/qa-extension.mjs` after building the extension, then open **http://127.0.0.1:5174**. It uses production extension bundles with explicit Chrome API and wallet doubles. It does not connect to a real wallet, sign or broadcast; the harness is excluded from the distributed ZIP.

| Directory | Contents |
| --- | --- |
| `extension/` | Provider interception, request lifecycle, popup and review UI |
| `lib/inspector/` | Decoders, explorer links, language handling and AI investigation |
| `components/inspector/` | Product homepage and shared review components |
| `app/api/explain/` | Optional server-side AI endpoint |
| `tests/inspector/` | Decoder, wallet-hook and request-pipeline regressions |
| `lib/txlens/`, `tests/txlens/` | Retained deterministic tools and tests from the earlier Orbio prototype |

The legacy `/api/review` route belongs to the earlier prototype. Its optional `ROBINHOOD_RPC_URL` setting is not used by the extension's `/api/explain` flow.

## Troubleshooting interception

Install TxLens in the same browser/profile as the dApp and wallet. After an update, reload the extension **and** the dApp. Check the popup's wallet attachment and site-pause status. Wallet connection alone does not trigger review.

The popup's detection probe does not request an account or call wallet RPC. Attachment means a provider entry is hooked; it is not proof that a real transaction was tested. Verify compatibility without signing a real-value transaction first.

New packages have a fixed extension identity across extraction directories. For installations older than v0.2.4, add the old extension ID to `TXLENS_EXTENSION_IDS` and restart the dev server. Updating only the webpage does not reload extension code.

Implementation constraints are in [agent.md](agent.md). Upstream licenses are retained beside vendored sources.
