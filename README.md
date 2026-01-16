# NoXu Wallet

A security-first, non-custodial Chrome extension wallet for the Kaspa blockchain.

![NoXu Wallet](src/extension/icons/icon128.png)

## Overview

NoXu Wallet enables users to securely manage their KAS holdings with industry-leading security practices. Built specifically for the Kaspa blockchain, it implements military-grade encryption (Argon2id + AES-256-GCM), automatic memory wiping of sensitive data, and a modern Chrome Manifest V3 architecture.

**Your keys, your crypto. Always.**

## Features

### Core Wallet
- **Create & Import Wallets** - Generate new wallets with 12 or 24-word BIP39 mnemonics or import existing seed phrases
- **Send & Receive KAS** - Full transaction support with confirmation modals
- **Balance & History** - Real-time balance updates and transaction history
- **Network Switching** - Support for Kaspa mainnet and testnet with custom RPC configuration

### Security
- **Argon2id + AES-256-GCM Encryption** - Military-grade encryption for stored data
- **Memory Wiping** - Automatic clearing of sensitive data from memory after use
- **Auto-Lock** - Configurable automatic wallet locking on idle or system lock (default: 15 min)
- **dApp Approval System** - Granular control over which sites can connect
- **Phishing Protection** - Extension ID verification and console security warnings
- **No Tracking** - Zero analytics or telemetry

### Technical
- **Chrome Manifest V3** - Modern extension architecture with service workers
- **TypeScript** - Fully type-safe codebase
- **BIP39/BIP44 Compliant** - Standard key derivation with Kaspa's SLIP-44 coin type (972)
- **Zod Validation** - Runtime API response validation for reliability

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React 18 + Zustand)                              │
│  └── Popup Interface, Settings, State Management            │
├─────────────────────────────────────────────────────────────┤
│  Extension Layer (Chrome MV3)                               │
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
│   ├── crypto/
│   │   ├── mnemonic.ts      # BIP39/BIP44 key derivation
│   │   ├── encryption.ts    # Argon2id + AES-256-GCM
│   │   └── secure.ts        # Memory wiping utilities
│   └── kaspa/
│       └── client.ts        # REST API client with Zod validation
├── extension/               # Chrome MV3 extension
│   ├── background/          # Service worker
│   ├── contentScript/       # dApp bridge
│   └── manifest.json        # Extension manifest
├── ui/                      # React UI
│   ├── popup/               # Main wallet interface
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
| Platform | Chrome Extension (Manifest V3) |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome browser

### Installation

```bash
# Clone the repository
git clone https://github.com/CkodSa/NoXu-Wallet.git
cd NoXu-Wallet

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build
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

## Roadmap

- [x] Core wallet functionality (create, import, send, receive)
- [x] Security infrastructure (encryption, memory wiping, auto-lock)
- [x] Mainnet and testnet support
- [x] dApp connection framework
- [ ] Full Kaspa transaction signing (Schnorr signatures)
- [ ] KRC20 token support
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
