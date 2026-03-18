# NoXu Wallet

A security-first, non-custodial browser extension wallet for the Kaspa blockchain.

<p align="center">
  <img src="packages/extension/src/ui/assets/NoxuLogoAnimation.gif" alt="NoXu Wallet" width="200" />
</p>

## Overview

NoXu Wallet enables users to securely manage their KAS holdings with industry-leading security practices. Built specifically for the Kaspa blockchain, it implements military-grade encryption (Argon2id + AES-256-GCM), automatic memory wiping of sensitive data, and supports both Chrome and Firefox browsers.

**Your keys, your crypto. Always.**

## Changelog

### v1.0.1 — Multi-Currency, KRC-20 Transfers & UI Overhaul

**Multi-Currency Fiat Support**
- Added support for 8 fiat currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW
- Fiat balance is now the primary display on the home card (KAS amount shown secondary)
- In-card currency picker with animated dropdown — tap the currency badge (e.g. `EUR ▾`) to switch
- All prices (KAS, KRC-20 tokens) update to reflect the selected currency via CoinGecko API
- Currency preference persists across sessions

**KRC-20 Token Transfers (Schnorr Signatures)**
- Full KRC-20 token sending is now live — commit + reveal transaction flow using Schnorr signatures
- Uses `@noble/curves/secp256k1` for cryptographic signing
- Removed all "Schnorr not yet supported" warning texts from the UI

**Redesigned Send Page**
- Token selector: tappable card showing selected token icon, symbol, balance, and fiat value
- Expandable token sheet listing all owned tokens (KAS + KRC-20) with balances
- Large centered amount input with live fiat conversion (for KAS)
- MAX button that auto-fills the maximum sendable balance (reserves dust for fees)
- Disabled review button when fields are empty

**Popular & Trending Tokens**
- New dual-tab section on home page: Popular and Trending
- Popular tokens sourced from CoinGecko's Kaspa ecosystem category
- Trending tokens sorted by 24h price gainers — reuses cached data, no extra API calls
- Each token shows price and 24h change with color-coded indicators

**QR Code Fix**
- Fixed critical bug: QR code was encoding addresses in uppercase (alphanumeric mode)
- Kaspa addresses are lowercase and case-sensitive — the old QR codes produced invalid addresses
- Switched to byte mode encoding which preserves the exact address

**Other Improvements**
- Per-currency caching for price data (currency string in cache keys)
- Cleaned up unused imports and dead code in background service worker
- Replaced stub KRC-20 send handler with real `KRC20TransferClient.executeTransfer()`

## Features

### Core Wallet
- **Create & Import Wallets** - Generate new wallets with 12 or 24-word BIP39 mnemonics or import existing seed phrases
- **Send & Receive KAS** - Full transaction support with confirmation modals and scannable QR codes
- **Send KRC-20 Tokens** - Transfer KRC-20 tokens using Schnorr signatures (commit + reveal flow)
- **Multi-Currency Fiat** - View balances in 8 currencies (USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW)
- **Popular & Trending Tokens** - Browse top KRC-20 tokens by market cap and 24h gainers
- **Balance & History** - Real-time balance updates, transaction history with manual refresh
- **Address Book** - Save frequently used addresses with labels for easy sending
- **Contact Labels in History** - Transaction history shows contact names instead of raw addresses
- **Export Transaction History** - Download your complete transaction history as CSV
- **KRC-20 Token Support** - View and track KRC-20 tokens on Kaspa via Kasplex indexer with detailed token info
- **Hide Small Balances** - Option to hide tokens with small balances for cleaner display
- **Network Switching** - Support for Kaspa mainnet and testnet with custom RPC configuration

### Security
- **Argon2id + AES-256-GCM Encryption** - Military-grade encryption for stored data
- **Memory Wiping** - Automatic clearing of sensitive data from memory after use
- **Auto-Lock** - Configurable automatic wallet locking on idle or system lock (default: 5 min)
- **dApp Approval System** - Granular control over which sites can connect
- **Phishing Protection** - Extension ID verification and console security warnings
- **No Tracking** - Zero analytics or telemetry

### Advanced Security Features
- **Duress Mode (Decoy Wallet)** - Create a panic PIN that opens a decoy wallet with a fake balance. Protects against physical threats and coercion - attackers see only a small decoy balance while your real funds remain hidden.
- **Time-Delayed Transactions** - Large transactions are automatically queued with a configurable delay period. Cancel within the window if compromised. Protects against hacks, scams, and impulsive decisions.

### Portfolio Tools
- **PnL Tracking** - FIFO cost-basis engine with per-token profit/loss, unrealized gains, and portfolio analysis stats. Historical price sync via CryptoCompare.
- **Watch-Only Tracking** - Monitor any Kaspa address without importing keys. Perfect for tracking whale wallets, cold storage, or friends' addresses. View balances and full transaction history.
- **Address Book** - Save and manage frequently used addresses with custom labels and notes.

### Technical
- **Cross-Browser Support** - Works on Chrome and Firefox
- **Chrome Manifest V3 / Firefox MV3** - Modern extension architecture
- **TypeScript** - Fully type-safe codebase
- **BIP39/BIP44 Compliant** - Standard key derivation with Kaspa's SLIP-44 coin type (972)
- **Zod Validation** - Runtime API response validation for reliability

## Architecture

Monorepo with NPM workspaces (`packages/*`):

```
┌───────────────────────────────────────────────────────────────┐
│  UI Layer (React 18 + Zustand)                                │
│  ├── Extension: Popup, Options, Content Script                │
│  └── Mobile: React Native (Expo) with native auth            │
├───────────────────────────────────────────────────────────────┤
│  Platform Layer                                               │
│  ├── Extension: Chrome MV3 / Firefox MV3 Service Worker       │
│  └── Mobile: Expo + React Native Quick Crypto                 │
├───────────────────────────────────────────────────────────────┤
│  Core Layer (Framework-Agnostic — @noxu/core)                 │
│  └── Wallet, Crypto (Argon2id/AES), Mnemonic, Kaspa Client   │
├───────────────────────────────────────────────────────────────┤
│  Kaspa Network (api.kaspa.org / Custom RPC)                   │
└───────────────────────────────────────────────────────────────┘
```

## Project Structure

```
packages/
├── core/src/                    # Shared, UI-agnostic business logic
│   ├── wallet.ts                # Wallet state management
│   ├── networks.ts              # Network configuration
│   ├── tokens/                  # Token metadata and resolution
│   ├── securityFeatures.ts      # Duress mode, watch-only, time-delay logic
│   ├── crypto/
│   │   ├── mnemonic.ts          # BIP39/BIP44 key derivation
│   │   ├── encryption.ts        # Argon2id + AES-256-GCM
│   │   └── secure.ts            # Memory wiping utilities
│   └── kaspa/
│       ├── client.ts            # REST API client with Zod validation
│       ├── transaction.ts       # Kaspa transaction building & Schnorr signing
│       ├── krc20-client.ts      # KRC-20 token client (Kasplex API)
│       ├── krc20-transaction.ts # KRC-20 inscription transactions
│       └── price-client.ts      # Price data (CryptoCompare, Kas.fyi)
├── extension/src/               # Browser extension
│   ├── extension/
│   │   ├── background/          # Service worker with security features
│   │   ├── contentScript/       # dApp bridge (IIFE bundled)
│   │   ├── manifest.chrome.json # Chrome manifest
│   │   └── manifest.firefox.json # Firefox manifest
│   ├── ui/
│   │   ├── popup/               # Main wallet interface
│   │   ├── options/             # Settings page
│   │   └── store.ts             # Zustand state store
│   └── platform/                # Browser crypto provider
└── mobile/src/                  # React Native mobile app (Expo)
    ├── screens/                 # Auth, onboarding, main, detail screens
    ├── navigation/              # React Navigation stack & tabs
    ├── store/                   # Zustand state store
    └── platform/                # Native crypto & storage providers
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18.2, TypeScript 5.4 |
| Build | Vite 7.2 |
| State | Zustand 4.5 |
| Crypto | @scure/bip32, @scure/bip39, @noble/hashes |
| Validation | Zod 3.22 |
| Cross-Browser | webextension-polyfill |
| Platform | Chrome Extension (MV3), Firefox Add-on (MV3) |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome or Firefox browser

### Installation

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
```

### Build Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build for Chrome (default) |
| `npm run build:chrome` | Build for Chrome → `dist/` |
| `npm run build:firefox` | Build for Firefox → `dist/` |
| `npm run build:all` | Build both → `dist-chrome/` and `dist-firefox/` |

### Load in Chrome

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` or `dist-chrome/` folder

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` file inside `dist/` or `dist-firefox/` folder

For permanent installation in Firefox, submit to [Firefox Add-ons](https://addons.mozilla.org/).

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production (Chrome)
npm run build:chrome

# Build for production (Firefox)
npm run build:firefox
```

## Security

NoXu Wallet is built with security as the primary concern. See [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for our comprehensive security review covering:

- Memory dump attack mitigations
- Console/DevTools extraction protection
- Clipboard hijacking prevention
- Transaction manipulation defenses
- Phishing/fake extension detection
- Malicious dApp attack vectors

### Security Features
- Encrypted at rest (Argon2id KDF with 64MB memory cost + AES-256-GCM)
- Memory wiping for all sensitive data
- Approval-based dApp connections
- Auto-lock on system idle/lock
- HTTPS-only custom RPC URLs
- Console security warnings
- **Duress Mode** - Decoy wallet with fake balance for coercion protection
- **Time-Delayed Transactions** - Configurable delays for large transfers with cancellation window

## Browser Support

| Browser | Status | Manifest |
|---------|--------|----------|
| Chrome | ✅ Supported | Manifest V3 (service_worker) |
| Firefox | ✅ Supported | Manifest V3 (background.scripts) |
| Edge | ✅ Compatible | Uses Chrome build |
| Brave | ✅ Compatible | Uses Chrome build |

## Roadmap

- [x] Core wallet functionality (create, import, send, receive)
- [x] Security infrastructure (encryption, memory wiping, auto-lock)
- [x] Mainnet and testnet support
- [x] dApp connection framework
- [x] Cross-browser support (Chrome + Firefox)
- [x] Duress Mode (decoy wallet protection)
- [x] Watch-only address tracking with transaction history
- [x] Time-delayed transactions for large transfers
- [x] KRC-20 token support (view balances via Kasplex indexer)
- [x] Address book with contact labels
- [x] QR code for receiving payments
- [x] Transaction history CSV export
- [x] Manual refresh for balance and history
- [x] Full Kaspa transaction signing (Schnorr signatures)
- [x] KRC-20 token transfers
- [x] Multi-currency fiat support (USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW)
- [x] Popular & trending KRC-20 tokens dashboard
- [x] PnL tracking with FIFO cost-basis engine
- [x] Mobile companion app (React Native / Expo)
- [ ] Hardware wallet integration (Ledger)
- [ ] Third-party security audit

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support the Project

If you find NoXu Wallet useful, consider supporting continued development:

**Kaspa:** `kaspa:qpwan3a8mdg747vselffjzl4h5ayu0mxx6v2e9l63yxr6tt5asyru34jh3zs7`

All donations go toward testing, infrastructure, and future features. Thank you!

## Links

- **GitHub:** [github.com/CkodSa/NoXu-Wallet](https://github.com/CkodSa/NoXu-Wallet)
- **Kaspa:** [kaspa.org](https://kaspa.org)

---

Built with security in mind for the Kaspa ecosystem.
