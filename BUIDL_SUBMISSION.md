# DoraHacks BUIDL Submission - NoXu Wallet

---

## PROJECT NAME

NoXu Wallet

---

## ONE-LINER / TAGLINE

A modern, security-first browser extension wallet for Kaspa with full KRC-20 token transfers, multi-currency fiat display, and real-time market data.

---

## SHORT DESCRIPTION (for submission form, ~150-200 words)

NoXu Wallet is a non-custodial browser extension wallet purpose-built for the Kaspa blockchain. It gives users full control over their KAS and KRC-20 tokens with real transaction signing powered by Schnorr signatures (secp256k1).

Security is baked in from the ground up: Argon2id key derivation (64MB memory-hard), AES-256-GCM encryption, automatic memory wiping, duress mode (decoy wallet under coercion), and time-delayed transactions for large transfers. Your keys never leave your device.

Beyond security, NoXu delivers a polished user experience: multi-currency fiat display (8 currencies via CoinGecko), a redesigned send page with token selection and live fiat conversion, popular and trending KRC-20 token discovery, address book with contact labels, QR code receiving, and full transaction history with CSV export.

Available on Chrome and Firefox with a modular TypeScript architecture that cleanly separates core crypto logic from the UI and extension layers.

Your keys, your crypto. Always.

---

## WHAT WE BUILT

### ✨ Features

#### Core Wallet
- 🔐 **Full Kaspa transaction signing** — Schnorr signatures via `@noble/curves/secp256k1`
- 💰 **Send & receive KAS** — real-time balance updates, confirmation modals, address verification
- 🎨 **Full KRC-20 token transfers** — commit + reveal inscription pattern with real `KRC20TransferClient`
- 📊 **Complete transaction history** — with explorer links, contact labels, and CSV export
- 👁️ **Watch-only mode** — monitor any Kaspa address without importing keys
- 📖 **Address book** — save contacts with labels, use them directly when sending
- 📱 **QR code support** — byte-mode encoding that correctly preserves lowercase Kaspa addresses

#### Multi-Currency & Market Data
- 💱 **8 fiat currencies** — USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW
- 📈 **Fiat as primary balance** — KAS amount shown secondary, currency badge picker on home card
- 🔥 **Popular tokens** — top KRC-20 tokens from CoinGecko's Kaspa ecosystem category
- 📊 **Trending tokens** — sorted by 24h price gainers with color-coded change indicators
- 💾 **Per-currency caching** — smart cache keys prevent stale price data when switching currencies

#### Security & Advanced Features
- 🛡️ **Argon2id + AES-256-GCM** — military-grade encryption for stored wallet data
- 🧹 **Automatic memory wiping** — sensitive data cleared immediately after use
- 🔒 **Auto-lock** — configurable locking on idle or system lock (default: 5 min)
- 🎭 **Duress mode** — panic PIN opens a decoy wallet with fake balance under coercion
- ⏰ **Time-delayed transactions** — large transfers queued with configurable delay + cancellation window
- 🌐 **dApp approval system** — granular control over which sites can connect
- 🛡️ **Phishing protection** — extension ID verification and console security warnings

#### Redesigned Send Page (v1.0.1)
- Token selector card showing icon, symbol, balance, and fiat equivalent
- Expandable token sheet listing all owned tokens (KAS + KRC-20)
- Large centered amount input with live fiat conversion
- MAX button that auto-fills maximum sendable balance (reserves dust for network fees)
- Smart review button — disabled until all fields are valid

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18.2, TypeScript 5.4 |
| Build | Vite 7.2 |
| State | Zustand 4.5 |
| Crypto | `@noble/curves` (Schnorr), `@scure/bip39`, `@scure/bip32`, `@noble/hashes` |
| KRC-20 | Kasplex indexer API, commit/reveal inscription pattern |
| Prices | CoinGecko API (Kaspa ecosystem category, multi-currency) |
| Validation | Zod 3.22 |
| Cross-Browser | webextension-polyfill |
| Platform | Chrome Extension (MV3), Firefox Add-on (MV3) |

---

## TECHNICAL ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│                          NoXu Wallet v1.0.1                       │
├──────────────────────────────────────────────────────────────────┤
│  UI Layer (React 18 + Zustand)                                    │
│  ├── Home Card (fiat balance, currency picker, price chart)       │
│  ├── Send Page (token selector, amount input, fiat conversion)    │
│  ├── Receive Page (QR code, address copy)                         │
│  ├── Popular & Trending Tokens (dual-tab, CoinGecko data)        │
│  ├── Security Settings (duress, time-delay, auto-lock)            │
│  └── Address Book, History, CSV Export                            │
├──────────────────────────────────────────────────────────────────┤
│  Extension Layer (Chrome MV3 / Firefox MV3)                       │
│  ├── Background Service Worker (RPC handler, settings, cache)     │
│  ├── Content Script (dApp bridge)                                 │
│  └── Message Passing (type-safe RPC with 30+ message types)       │
├──────────────────────────────────────────────────────────────────┤
│  Core Layer (Framework-Agnostic)                                  │
│  ├── Wallet (state, account, UTXOs)                               │
│  ├── KRC20TransferClient (commit + reveal Schnorr-signed tx)      │
│  ├── Price Client (CoinGecko, multi-currency, caching)            │
│  ├── Crypto (Argon2id KDF, AES-256-GCM, memory wiping)            │
│  └── Mnemonic (BIP39/BIP44, SLIP-44 coin type 972)                │
├──────────────────────────────────────────────────────────────────┤
│  External APIs                                                    │
│  ├── Kaspa Network (api.kaspa.org / Custom RPC)                   │
│  ├── Kasplex Indexer (KRC-20 balances & token info)               │
│  └── CoinGecko (prices, ecosystem data, trending)                 │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Real Schnorr Signing** — KRC-20 transfers use `@noble/curves/secp256k1` Schnorr signatures with Blake2b Kaspa-specific personalization. Full commit + reveal pattern handled by `KRC20TransferClient.executeTransfer()`.

2. **No External Crypto Dependencies** — Only audited, minimal libraries (`@scure`, `@noble`) — no large frameworks, minimal attack surface.

3. **Memory Safety** — All sensitive data (seeds, private keys, passwords) explicitly wiped from memory after use.

4. **Smart Price Caching** — Currency string embedded in cache keys prevents stale data when switching between fiat currencies. Single CoinGecko endpoint serves both popular and trending token data.

5. **QR Code Byte Mode** — Custom QR generator uses byte-mode encoding (not alphanumeric) to preserve lowercase Kaspa addresses exactly as-is.

6. **Cross-Browser Single Codebase** — `webextension-polyfill` targets Chrome and Firefox from one TypeScript source.

---

## 🚀 Status & Testing

### What's Working (Tested ✅)

| Feature | Status | Notes |
|---------|--------|-------|
| Wallet create (12/24 word) | ✅ Tested | BIP39 mnemonic generation |
| Wallet import from seed | ✅ Tested | Restores accounts correctly |
| Send KAS transactions | ✅ Tested | With confirmation modal + address verification |
| Receive (QR + copy) | ✅ Tested | Byte-mode QR preserves lowercase addresses |
| KRC-20 token balances | ✅ Tested | Via Kasplex indexer |
| KRC-20 token transfers | ✅ Tested | Schnorr commit + reveal flow |
| Transaction history | ✅ Tested | With explorer links + contact labels |
| CSV export | ✅ Tested | Downloads full history |
| Address book | ✅ Tested | Save, edit, delete contacts |
| Multi-currency fiat (8) | ✅ Tested | USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW |
| Currency persistence | ✅ Tested | Saved across sessions |
| Popular tokens | ✅ Tested | CoinGecko Kaspa ecosystem |
| Trending tokens (gainers) | ✅ Tested | Sorted by 24h change |
| Duress mode (decoy wallet) | ✅ Tested | Panic PIN shows fake balance |
| Time-delayed transactions | ✅ Tested | Configurable delay + cancel window |
| Watch-only addresses | ✅ Tested | Monitor without keys |
| Auto-lock | ✅ Tested | Idle + system lock detection |
| Network switching | ✅ Tested | Mainnet / Testnet + custom RPC |
| Chrome MV3 | ✅ Tested | Service worker architecture |
| Firefox MV3 | ✅ Tested | Background scripts architecture |
| Production build | ✅ Passing | `npm run build` succeeds cleanly |

### What's Changed in v1.0.1

- **Multi-currency fiat support** — 8 currencies with in-card picker and animated dropdown
- **KRC-20 token transfers** — real Schnorr-signed commit + reveal (was previously a stub)
- **Redesigned Send page** — token selector card, large amount input, MAX button, fiat conversion
- **Popular & Trending tokens** — dual-tab section on home page with CoinGecko data
- **QR code fix** — switched from alphanumeric (uppercase) to byte mode (preserves lowercase)
- **Removed Schnorr warnings** — all "not yet supported" texts removed since signing is complete
- **Cleaned background worker** — removed dead imports, replaced stubs with real implementations

---

## 🗺️ Roadmap

### Completed ✅
- ✅ Core wallet (create, import, send, receive)
- ✅ Full Kaspa transaction signing (Schnorr signatures)
- ✅ KRC-20 token support (balances + transfers)
- ✅ Multi-currency fiat display (8 currencies)
- ✅ Popular & trending token discovery
- ✅ Security infrastructure (Argon2id, AES-256-GCM, memory wiping)
- ✅ Duress mode & time-delayed transactions
- ✅ Watch-only address tracking
- ✅ Address book, QR codes, CSV export
- ✅ Cross-browser (Chrome + Firefox)
- ✅ Mainnet and testnet support

### Coming Soon
- 🧪 Live mainnet stress testing & bug fixes
- 🌐 Chrome Web Store publication
- 🔗 dApp connection support (WalletConnect)
- 📱 Mobile-responsive popup UI

### Future Plans
- 🔄 Built-in token swap integration
- 🌍 Multi-language support
- 🔐 Hardware wallet support (Ledger)
- 📊 Portfolio tracking & advanced price charts
- 🎨 Enhanced token management & discovery
- 🤝 NFT support (when available on Kaspa)

---

## LINKS

- **GitHub Repository:** https://github.com/CkodSa/NoXu-Wallet
- **Demo Video:** [YouTube/Google Drive link]
- **Chrome Web Store:** [Coming soon]
- **Firefox Add-ons:** [Coming soon]

---

## BUILD INSTRUCTIONS

```bash
# Clone the repository
git clone https://github.com/CkodSa/NoXu-Wallet.git
cd NoXu-Wallet

# Install dependencies
npm install

# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Build for both browsers
npm run build:all
# Creates dist-chrome/ and dist-firefox/
```

### Load in Chrome
1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### Load in Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json` inside `dist/`

---

## ☕ Support Development

If you find NoXu Wallet useful, consider supporting continued development:

**Kaspa:** `kaspa:qpwan3a8mdg747vselffjzl4h5ayu0mxx6v2e9l63yxr6tt5asyru34jh3zs7`

All donations go toward testing, infrastructure, and future features. Thank you! 🙏

---

*Submitted to the Kaspa Hackathon on DoraHacks (January 16 - February 15, 2026)*
