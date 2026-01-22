# NoXu Wallet

A security-first, non-custodial browser extension wallet for the Kaspa blockchain.

![NoXu Wallet](src/extension/icons/icon128.png)

## Overview

NoXu Wallet enables users to securely manage their KAS holdings with industry-leading security practices. Built specifically for the Kaspa blockchain, it implements military-grade encryption (Argon2id + AES-256-GCM), automatic memory wiping of sensitive data, and supports both Chrome and Firefox browsers.

**Your keys, your crypto. Always.**

## Features

### Core Wallet
- **Create & Import Wallets** - Generate new wallets with 12 or 24-word BIP39 mnemonics or import existing seed phrases
- **Send & Receive KAS** - Full transaction support with confirmation modals
- **Balance & History** - Real-time balance updates and transaction history
- **KRC-20 Token Support** - View and track KRC-20 tokens on Kaspa via Kasplex indexer
- **Hide Small Balances** - Option to hide tokens with small balances for cleaner display
- **Network Switching** - Support for Kaspa mainnet and testnet with custom RPC configuration

### Security
- **Argon2id + AES-256-GCM Encryption** - Military-grade encryption for stored data
- **Memory Wiping** - Automatic clearing of sensitive data from memory after use
- **Auto-Lock** - Configurable automatic wallet locking on idle or system lock (default: 15 min)
- **dApp Approval System** - Granular control over which sites can connect
- **Phishing Protection** - Extension ID verification and console security warnings
- **No Tracking** - Zero analytics or telemetry

### Advanced Security Features
- **Duress Mode (Decoy Wallet)** - Create a panic PIN that opens a decoy wallet with a fake balance. Protects against physical threats and coercion - attackers see only a small decoy balance while your real funds remain hidden.
- **Time-Delayed Transactions** - Large transactions are automatically queued with a configurable delay period. Cancel within the window if compromised. Protects against hacks, scams, and impulsive decisions.

### Portfolio Tools
- **Watch-Only Tracking** - Monitor any Kaspa address without importing keys. Perfect for tracking whale wallets, cold storage, or friends' addresses. View balances and full transaction history.

### Technical
- **Cross-Browser Support** - Works on Chrome and Firefox
- **Chrome Manifest V3 / Firefox MV3** - Modern extension architecture
- **TypeScript** - Fully type-safe codebase
- **BIP39/BIP44 Compliant** - Standard key derivation with Kaspa's SLIP-44 coin type (972)
- **Zod Validation** - Runtime API response validation for reliability

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React 18 + Zustand)                              │
│  └── Popup Interface, Settings, State Management            │
├─────────────────────────────────────────────────────────────┤
│  Extension Layer (Chrome MV3 / Firefox MV3)                 │
│  └── Background Service Worker, Content Script, RPC         │
├─────────────────────────────────────────────────────────────┤
│  Core Layer (Framework-Agnostic)                            │
│  └── Wallet, Crypto (Argon2id/AES), Mnemonic, Kaspa Client  │
├─────────────────────────────────────────────────────────────┤
│  Kaspa Network (api.kaspa.org / Custom RPC)                 │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── core/                    # UI-agnostic business logic
│   ├── wallet.ts            # Wallet state management
│   ├── networks.ts          # Network configuration
│   ├── tokens/              # Token metadata and resolution
│   ├── securityFeatures.ts  # Duress mode, watch-only, time-delay logic
│   ├── crypto/
│   │   ├── mnemonic.ts      # BIP39/BIP44 key derivation
│   │   ├── encryption.ts    # Argon2id + AES-256-GCM
│   │   └── secure.ts        # Memory wiping utilities
│   └── kaspa/
│       ├── client.ts        # REST API client with Zod validation
│       └── krc20-client.ts  # KRC-20 token client (Kasplex API)
├── extension/               # Browser extension
│   ├── background/          # Service worker with security features
│   ├── contentScript/       # dApp bridge (IIFE bundled)
│   ├── manifest.chrome.json # Chrome manifest
│   └── manifest.firefox.json # Firefox manifest
├── ui/                      # React UI
│   ├── popup/               # Main wallet interface with security UI
│   ├── options/             # Settings page
│   └── store.ts             # Zustand state store
└── legal/                   # Terms, privacy, support docs
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

NoXu Wallet is built with security as the primary concern. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for our comprehensive security review covering:

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
- [ ] Full Kaspa transaction signing (Schnorr signatures)
- [ ] KRC-20 token transfers
- [ ] Hardware wallet integration (Ledger)
- [ ] Mobile companion app
- [ ] Third-party security audit

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **GitHub:** [github.com/CkodSa/NoXu-Wallet](https://github.com/CkodSa/NoXu-Wallet)
- **Kaspa:** [kaspa.org](https://kaspa.org)

---

Built with security in mind for the Kaspa ecosystem.
