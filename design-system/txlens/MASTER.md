# TxLens product design

Apply the local Codex UI UX Pro Max skill for hierarchy, contrast, keyboard access, meaningful motion and responsive layout. No fabricated testimonials, metrics, certification claims or competitor comparisons.

## Homepage identity — September 17, 2026

TxLens has an editorial, paper-based identity: warm white `#F6F4ED`, navy `#202E43`, vermilion `#C33F29`, and paper `#FFFEFA`. Dark green, neon accents, orbit diagrams, glowing fingerprints and floating HUD cards are not the homepage design language.

Use a centered, bold headline, an annotated transaction receipt, numbered editorial rows, horizontal demo tabs and a full-width navy installation section. Navigation and favicon use a document mark. Regular sans-serif body typography; restrained serif type only for marginal notes and numbering. No external font dependency. The receipt highlights recipient, amount and permission rows, with a pause control, offscreen pause and reduced-motion support. The illustration is explicitly sample data.

The homepage styles live in `app/landing.css`, scoped to `.landing`. The interactive preview uses the real ReviewPanel with a readable paper theme. UI labels, accessibility labels, metadata and explanations support Chinese and English; browser language is the default, with English fallback. The website language selector offers Auto (browser), 简体中文 and English. An explicit choice is persisted in a website-only cookie and applies to both the interface and AI explanations; selecting Auto clears the override. Extension locale behavior remains unchanged.

## Extension surfaces

The existing extension presentation remains in `app/product.css`: background `#101714`, panel `#19221D`, text `#EFF5EF`, muted `#A6B5A9`, accent `#C4F18A`, warning `#EAD191`, danger `#FFAAA0`. Do not incidentally restyle installed wallet review surfaces through homepage CSS.

The extension popup shows exact-site attachment and pause/resume. The review window follows origin/network → amounts and permissions → material findings → optional AI explanation → cancel/continue. Green does not certify safety. Primary decision controls are at least 44px tall. AI requests do not disable the user's decision.

## Product behavior

The companion site offers installation and a live request preview, without connecting a wallet or sending a transaction. Requests are decoded locally; AI explanation is optional and currently provided via Orbio. Keep source evidence and raw request data collapsible. Mark unsupported behavior clearly. No copy/paste transaction bundle as the main user flow, account system, paywall or transaction commission.
