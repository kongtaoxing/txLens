# TxLens validation

Current package: **v0.2.5**. The sections below are dated records; older provider and verification limits describe their respective versions. Real Orbio activation is recorded under September 17, and manual website language selection under September 18.

Earlier readiness check, September 21, 2026 (superseded by the Vercel migration below): 69 tests, type checking, lint, website build and extension build passed. The local API was online/configured; that status request did not test upstream AI. No paid model call, signature or transaction was made during that check. Native Chrome/OKX acceptance, public deployment and a deployment-specific AI smoke test remain outstanding.

## Completed

- `npm run typecheck`: passed.
- `npm run lint`: passed; tool/skill directories are excluded from application linting.
- `npm test`: 33 tests passed (21 new extension/inspector tests; 12 retained Orbio prototype tests).
- `npm run build:extension`: passed; Manifest V3 package contains its HTML, scripts, stylesheet, icons and bilingual installation notes.
- `npm run build`: passed for the companion website and AI routes.
- Archive inspection: manifest assets exist; no `.env`, source map or configured API key included.
- Live HTTP checks: product page and ZIP return 200; invalid AI input returns 400; an unrelated browser origin receives 403.

## Behavior covered by automated tests

- Correct USDC decimals, unlimited approvals, unknown-token ambiguity, percentage-payment basis, malformed input, chain mismatch, batches, Permit2 expiration versus signature deadline, and blind hash signing.
- Read-only provider calls pass through. Reviewed parameters are snapshotted. Requests wait for approval, forward once, return user rejection on cancel, and reject if the wallet network changed. EIP-6963 providers are wrapped without double-wrapping the same object.
- Background origin comes from browser metadata. A page sender cannot approve a pending background review. Close/navigation clear pending requests. Pause uses exact origins; cancel does not activate pause.

## Browser checks actually performed

Using the local site at `http://localhost:5173`:

- Chinese and English interface switching; all three interactive scenarios.
- Live Chinese and English explanations from the configured development service, without exposing its API key. Responses follow the selected language.
- A final shorter Chinese explanation was verified after restoring the tested model output budget. One failed AI call also verified the localized service-unavailable state.
- Continue stays available during an AI call. Demo continue and cancel show distinct completion states without invoking a real wallet.
- Desktop visual review and 390px mobile viewport. No horizontal overflow. Temporary viewport override reset afterward.
- No browser console warnings/errors observed during the checked flows.

## Not yet verified

- Installing the extension into a real Chrome/Edge profile and compatibility with individual third-party wallets. The in-page hook and background lifecycle were tested in isolated runtime harnesses, not against a live funded wallet.
- A real Orbio-backed call: the current server intentionally uses the user's development provider. Switching and testing Orbio requires issued Orbio credentials/model configuration.
- Public backend deployment and extension-store publication. The current deliverable is a local installable early release; AI defaults to the local service.

The decoder is not a transaction simulator or an anti-phishing guarantee. Unsupported methods/providers and unverified contract behavior are documented in README.md and the installation notes.

## v0.2.1 — OKX interception fix

Found a concrete omission: v0.2 only discovered `window.ethereum` and EIP-6963 announcements. A dApp using a separate `window.okxwallet` could bypass that hook. Added OKX discovery, immediate ordinary late-injection wrapping and polling for defineProperty injection. Replaced the popup's old stored detection flag with a live page/provider check; the popup shows its installed version.

38 tests now pass, including 5 new cases: OKX-only Base requests, late assignment, defineProperty injection, a no-RPC connection probe, and an immutable provider correctly shown as unattached. Type checking and lint pass; the updated extension package builds successfully. The user's exact browser, dApp URL and installation state remain unconfirmed, so this does not claim the reported live-wallet incident has been reproduced or resolved on their browser.


## v0.2.2 — non-reserving provider interception and honest coverage

### Reproduced before changing implementation

Added two regressions to the v0.2.1 code. Both failed as expected: absent `window.ethereum`/`window.okxwallet` properties were reserved before wallet injection; a frozen wallet object could not be guarded even when its global entry was configurable. These demonstrate code defects, not a confirmed diagnosis of the user's specific OKX installation.

### Changes

- Do not create absent wallet globals. Preserve each wallet's selection, metadata, existing global setters and original methods.
- Wrap each provider in a stable facade. Frozen objects and getter-only/bound `request` methods work through configurable global entries and EIP-6963 announcements. Announcements retain every wallet and its identity; only the corresponding provider facade is substituted.
- Existing locked global entries remain untouched and appear as unavailable/partial. Cached original references and very early non-EIP-6963 calls remain outside coverage.
- Group wallet aliases into one row and distinguish attachment from an actually captured review request. Partial coverage has an amber warning; one available wallet cannot imply all wallets work.

### Verification

- 51 automated tests passed, including multi-wallet selection, readonly/getter interfaces, provider arrays, delayed injection, unchanged wallet methods, cached facade identity, aliases/partial coverage, zero-RPC probes, and five complete inpage/bridge/background pipeline tests.
- Typecheck and lint passed without warnings. Extension and website builds passed (the website build retains the dependency's punycode deprecation notice).
- Browser QA at `http://127.0.0.1:5174`, from `scripts/qa-extension.mjs` and `tests/inspector/browser/harness.html`: real production bundles for inpage, bridge, background and UI, with explicit test doubles for Chrome APIs and three wallets. `chrome.windows.create` is represented by an iframe; this does not verify native Chrome popup creation.
- Default generic wallet was Phantom; selected EIP-6963 wallet was a frozen OKX test object. Continue reached only that OKX object, exactly once. Cancel and closing review returned code 4001 with zero forwarded calls. Pause bypassed review and resume restored it. Chinese and English status UI were inspected, including single-row OKX alias grouping and partial coverage.
- No real wallet connected, signature requested from a real wallet, transaction broadcast, or AI call made during this regression run.

### Outstanding acceptance check

The user's screenshot establishes that BaseScan was connected to OKX while TxLens reported OKX as unattached. The exact live failure has not been reproduced. `cua.getApp("com.google.Chrome")` was denied because Computer Use was not approved for Chrome. Requested permission to inspect and test in that browser, then continued all independent work. Do not describe v0.2.2 as real-OKX-validated until that test is performed.

Final archive check: v0.2.2, 13 ZIP entries, no environment files, configured API key, source maps or QA harness. Direct local HTTP download matches the build byte-for-byte (SHA-256 `7418ab59bc1764af68f191bcee5e22e3bf19ff382ebd14ee3931fea86a8bf205`). Temporary QA tab and server were closed after testing; the existing product preview server was retained.


## v0.2.3 — real request, address links and AI investigation

### Evidence and fixes

- User transaction: https://arbiscan.io/tx/0x159ce0eb67842c8bc31b02754a9e7510a63f51dc877f21623b50d264a591471e . Read its exact calldata, successful receipt and transfer list in Arbiscan. Stored calldata in `tests/inspector/fixtures/arbitrum-remove-liquidity.json`.
- It calls Arbitrum's deployed v4 PositionManager `modifyLiquidities`, with decrease-liquidity and take-pair actions, position 198408 and two zero minimum amounts. Local decoding shows those fields and the caller recipient, with no fabricated estimate of the post-execution amounts. Fee-only collection, unknown commands, nonzero raw minimums, other recipients, malformed bytes and wrong deployment/chain are covered separately.
- Real server logs showed the development middleware rejecting the installed extension origin with HTTP 403. `TXLENS_EXTENSION_IDS` now configures only specific local extension IDs. Actual preflight for the observed extension returns 204; unrelated websites still get 403.
- All rendered full addresses and shortened fact addresses are links to their configured chain explorer, including AI text and raw JSON. Long calldata and transaction hashes do not produce spurious address links. Typed signatures and batch/transaction-declared chains use their stated network. Unknown networks do not guess an explorer.
- The AI can select `lookup_contract`, `read_contract_source` and `decode_bytes`. It retrieves Sourcify v2 verified runtime ABI/source, receives proxy information, and decodes observed bytes. Model-chosen tuple layouts remain explicitly identified as inferences. Fixed public endpoints, validated addresses and observed-byte references prevent arbitrary URL requests or fabricated calldata evidence. It never signs, broadcasts or simulates.
- Compact byte references avoid making the model copy long calldata. Existing deterministic findings are retained; the agent investigates missing essential facts rather than repeatedly decoding everything.

### Verification

- 65 automated tests pass; typecheck and lint pass. Production website and extension builds pass.
- Live generic test used WETH9 `deposit()` on Ethereum, a method the local decoder does not support. The model chose the lookup tool, retrieved verified ABI/source and explained wrapping 0.1 ETH. Chinese and English calls succeeded, respectively about 13.8 s and 29.0 s. No transaction was submitted.
- An initial live lookup exposed an unsupported `redirect: error` option in the Worker runtime. Changed it to `manual`; the actual Worker-backed route then retrieved source successfully. Unavailable sources remain visible rather than being described as verified.
- Browser replay of the user's calldata used production bundles with explicit Chrome and wallet doubles. Actual AI investigation called source lookup, source reading and nested decoding and displayed an answer with lookup evidence. This deeper run took 108.6 s. After reducing duplicate investigation of already decoded fields, the same fixture returned a grounded answer through the real API in 13.6 s, with successful contract and source queries. These are observed samples, not response-time guarantees.
- In the browser harness, Cancel returned 4001 and forwarded zero calls; Continue forwarded exactly one call to the selected OKX double. Continue and Cancel remained enabled during AI work. No private key, real wallet approval or rebroadcast was used.
- Arbitrum and Base rendered address URLs were inspected, including raw JSON; English switching passed. The 485 px content viewport had matching scroll/client widths, with no horizontal content overflow. Browser doubles do not validate native Chrome popup creation or third-party wallet compatibility.
- ZIP contains 13 entries, no environment files, API key, source maps or QA harness. Direct local download matches the built archive.

### Remaining limits

Source availability and provider latency vary. Contract source lookup is not execution simulation and does not establish current position state, prices, gas or final receipts. Nested behavior can remain unresolved. The configured model is the development provider, not yet a validated Orbio deployment. No Chrome Web Store publication or public backend deployment was performed.


## v0.2.4 — local API access after unpacking elsewhere

The next user report exposed a real origin regression: the installed extension was now `lgbbaakoeobkgdgkpciikcdomiojbcgb`, while the server allowed the earlier `gnachfkfadmgpofiicagmgnbamcbhmem`. Server logs confirmed repeated 403 rejection. Direct address-bar access was a separate GET 405, not proof that the service process was down.

- Preserved access for both observed old installations.
- New packages pin an unpacked extension identity with a manifest public key. `next.config.ts` derives and allows this ID automatically (`dhncocbicjigbihaekehhpihlepdbkph`), regardless of extraction directory. No signing private key is saved or distributed. The first upgrade from an unpinned package may be treated as a new installation; installation notes explain checking local preferences.
- Added a read-only GET response at `/api/explain`: service online/configuration status and bilingual directions. It does not claim to test the upstream AI or trigger a paid analysis.
- Reproduced that editing `.env.local`/config while Vite hot-reloads can retain the old dev-origin middleware. Restarted only the confirmed project server process, preserving port 5173. The restarted process accepts both the user's current ID and the pinned ID (OPTIONS 204 with the correct CORS origin), while unrelated web origins still receive 403. The direct GET returns 200 and `online`.
- Typecheck, lint, extension build and production website build passed. Existing decoder and interception behavior is unchanged.

Final live check: POST from the user's observed current extension origin returned 200 with matching Access-Control-Allow-Origin and a Chinese explanation in 12.6 s. The model successfully retrieved contract and source evidence. The v0.2.4 downloaded ZIP matches the built package; its derived ID matches the allowed pinned ID and no AI API key is included. This HTTP-origin reproduction does not claim to operate the user's Chrome UI.


## v0.2.5 — 2026-09-17

- 69 automated tests passed, including browser preference precedence (ignoring old manual storage), Chinese locale variants, zero ERC20 approval/self-spender semantics, unknown NFT ambiguity and structured AI response validation.
- Real configured development-provider calls through /api/explain: reconstructed Base USDC approve(self,0) returned Chinese and English three-field explanations (HTTP 200; 14.1s and 17.1s in final checks). WETH deposit, unsupported by the local decoder, was researched via a verified ABI tool call and explained in English (HTTP 200; 10.5s). These are observed samples, not latency guarantees or execution simulations. Real Orbio credentials were not tested.
- An earlier language failure was reproduced: a Chinese prompt example biased one English result. The example was removed, the requested language is explicit in the evidence message and final instruction, and the three final live checks returned the requested language. Model content remains probabilistic.
- In-app browser tested actual built extension bundles with explicit Chrome API and wallet doubles: Chinese to English browser-language change updates both popup and open review, resets the previous explanation, and sends the selected locale to AI. A stale saved Chinese preference did not override English. Real AI results rendered as labeled blocks with contract sources collapsed.
- Cancel returned 4001 and forwarded zero requests; Continue forwarded once to the selected OKX test wallet. This is not a real OKX wallet integration test and no transaction was signed or broadcast.
- Desktop website at normal browser size and mobile at 390x844 were visually checked. Mobile content width 375px matched viewport content width. Review frame 485px matched content width. A pre-existing popup overflow (365px viewport vs 380px content) was fixed and rechecked at 365/365.
- Server-rendered Chinese and English pages verified via Accept-Language. Local server restarted after removing the obsolete RPC environment variable; /api/explain runs without it.
- Final typecheck, lint, website build and extension build passed. Downloaded ZIP matches the verified v0.2.5 package, contains no AI key or QA harness, and retains extension ID dhncocbicjigbihaekehhpihlepdbkph. GET /api/explain returned HTTP 200 online with AI configured. Temporary QA tabs/server were closed; the localhost:5173 product service remains running.


## Orbio gateway activation — 2026-09-17

- User supplied an Orbio key and initially selected anthropic/claude-fable-5.1 in .env.example. Moved the configuration into the ignored .env.local (mode 0600) and cleared the key from .env.example. No secret is included in this record.
- Updated the default/example API base to the current official https://api.orbio.so/api/v1. The old starter’s direct OpenRouter instructions do not describe this sk-orbio gateway key.
- Fable 5.1 minimal authenticated chat returned HTTP 200 and its exact model name. Complete analysis and a separate minimal tool call returned HTTP 404/model_not_available. The user explicitly chose deepseek/deepseek-v4.1-flash instead.
- Active Orbio DeepSeek tests through /api/explain with the stable extension Origin: Base USDC approve(self,0), Chinese, HTTP 200, 39.6s, two successful lookup_contract calls; WETH deposit unsupported by the local decoder, English, HTTP 200, 9.5s, successful verified ABI lookup; historical Arbitrum Uniswap v4 withdrawal, Chinese, HTTP 200, 30.2s, successful contract lookup. Responses had the required action/effect/check fields and orbio=true. These sample timings are not guarantees. The historical deadline is retained, so expiry is correctly mentioned; this is not a new transaction or execution simulation.
- Website build passed after the default endpoint change. No extension source change or reinstall is required for the server-side provider switch. Verified the live service reports provider Orbio; keys are absent from the example file and 89 inspected build/public deliverable files.
- All testing was read-only inference and public contract lookup. No wallet signature or on-chain transaction was sent. Local product service remains running on http://localhost:5173.

## Editorial homepage redesign — 2026-09-17

- Replaced the rejected dark-green optical/fingerprint landing with a warm-white, navy and vermilion editorial identity. Centered headline, annotated sample receipt, numbered workflow, horizontal scenarios, light review preview and navy installation section. Added a document favicon and recorded the distinct identity in the design master.
- Kept browser-derived Chinese/English UI, accessibility copy and page metadata. Tested English through a temporary localhost proxy that sets a mocked browser locale; no user language settings were changed.
- Visually inspected Chinese desktop (1440px) and phone (390px), English phone (390px) and tablet (768px), including the hero, demo and installation content. Verified scenario clicks, horizontal arrow-key selection, cancel, retry, continue, and the motion pause control's visible state. Reduced-motion and offscreen pause are implemented; OS reduced-motion emulation was not available in this browser.
- Typecheck, ESLint, all 69 existing tests and the production site build passed. Chinese/English HTTP responses and the extension ZIP download return HTTP 200. No extra paid AI calls were needed for this presentation change. The extension source, actual transaction behavior and live Orbio credentials were not changed.

## Manual website language selector — 2026-09-18

- Replaced the static language indicator with a native, keyboard-accessible selector: Auto (browser), 简体中文 and English. Defaults to the browser; explicit selections persist in a website-only cookie. Returning to Auto clears the preference. Server-rendered HTML/title and client UI resolve the same choice. The demo AI request uses the resulting locale, and switching languages remounts the review to discard text from the previous language.
- Verified in the browser: English immediately updates the UI and survives reload; switching back to Chinese updates the UI; selecting Auto and reloading restores browser matching. Inspected the selector at desktop and 390px phone widths.
- Verified server responses for manual English over Chinese preferences, manual Chinese over English preferences, Auto and invalid cookie values. Typecheck, ESLint and the production build passed. No extra model calls or changes to the extension locale behavior.


## Git handoff — 2026-09-21

- Fixed the ignore rule that excluded the required `build/sites-vite-plugin.ts` and its upstream license. Generated extension output and download ZIPs remain ignored.
- Exported only the staged files to a new temporary directory, without `.env.local`, installed dependencies, tool state or existing build artifacts. `npm ci --prefer-offline` installed all 693 dependencies from the lockfile.
- In that clean export, all 69 tests, TypeScript checking, ESLint, extension packaging and production website build passed. No paid inference, real wallet connection, signature or transaction was used.
- Scanned the publishable files for locally configured secrets and common credential patterns; no matches were found. The checked-in environment example has a blank API key.
- README now documents first-time installation, package distribution, current language behavior and the pending Vercel adaptation. No remote repository, public deployment or submission was created.


## Vercel / Next.js migration — 2026-09-21

- Reproduced the reported public-registry 404 for `tinyglobby@0.2.46`. Empty-cache installation and a full tarball audit also found unavailable `@floating-ui/utils@0.2.42` and `@napi-rs/wasm-runtime@0.2.42`. The earlier cached-install check did not establish public-registry availability. Overrides select published versions in the same minor series: 0.2.17, 0.2.12 and 0.2.12 respectively.
- Rebuilt the dependency lock from the public registry and completed `npm ci` with a new empty cache: 524 packages installed. The preceding tarball audit returned HTTP 200 for all 615 checked links, including non-macOS native packages. The final install also repaired nested AJV entries produced by npm's lock-only resolution.
- Replaced Vinext / Cloudflare runtime with standard Next.js and Node API routes; pinned Node to 22.x and added explicit Vercel install/build configuration. Removed unused Cloudflare database/auth scaffolding and build helpers. Orbio settings are read from server-side `process.env`.
- Production builds generate the extension ZIP in JavaScript, without a system zip executable. Hosted bundles use the Vercel production origin or `TXLENS_SERVICE_URL`, and the output manifest grants access to that origin. Local builds retain localhost; existing saved settings are preserved.
- All 72 tests, TypeScript checking, ESLint and `next build` passed in an isolated source copy. Three new tests cover runtime environment configuration, secret-free status, missing-key behavior, extension CORS and a mocked structured AI response.
- Served the optimized production build separately on loopback. Chinese and English pages returned 200; the downloaded ZIP matched the build, passed integrity checks and contained the expected build-time test origin and host permission. Extension-origin GET returned 200 and OPTIONS 204.
- One real, read-only Orbio call through the Node production API explained wrapping 0.1 ETH into WETH: HTTP 200 in 19.8 seconds, English action/effect/check fields, `orbio=true`, and successful `lookup_contract`. No wallet connection, signature or broadcast occurred.
- Browser verification of the production page confirmed language switching and demo cancellation; no console warnings/errors were observed. This does not claim native Chrome/OKX acceptance.
