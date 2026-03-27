# Architecture

## Overview

NoXu Wallet is a monorepo with three packages sharing a common core library:

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer                                                       │
│  ├── Extension: React 18 popup + options pages (Zustand state)  │
│  └── Mobile: React Native screens (Expo, Zustand state)         │
├─────────────────────────────────────────────────────────────────┤
│  Platform Layer (abstracts crypto + storage per platform)       │
│  ├── Extension: Web Crypto API, Chrome/Firefox storage           │
│  └── Mobile: expo-crypto, react-native-quick-crypto, AsyncStorage│
├─────────────────────────────────────────────────────────────────┤
│  Core Layer (@noxu/core — framework-agnostic TypeScript)        │
│  └── Wallet, Crypto, Kaspa client, KRC-20, pricing, PnL        │
├─────────────────────────────────────────────────────────────────┤
│  External APIs                                                  │
│  ├── Kaspa REST API (api.kaspa.org or custom RPC)               │
│  ├── Kasplex indexer (KRC-20 token data)                        │
│  └── CoinGecko / CryptoCompare (price data)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

### `packages/core` — @noxu/core

Shared, framework-agnostic business logic. No React, no browser APIs, no React Native APIs.

| Module | Purpose |
|--------|---------|
| `wallet.ts` | Wallet state, account management, UTXO tracking |
| `networks.ts` | Kaspa mainnet/testnet configuration |
| `crypto/mnemonic.ts` | BIP39 mnemonic generation, BIP44 key derivation (SLIP-44 coin type 972) |
| `crypto/encryption.ts` | Argon2id KDF + AES-256-GCM encryption/decryption |
| `crypto/secure.ts` | Memory wiping utilities for sensitive data |
| `kaspa/client.ts` | Kaspa REST API client with Zod response validation |
| `kaspa/transaction.ts` | Transaction building, UTXO selection, Schnorr signing |
| `kaspa/signer.ts` | Transaction signing abstraction |
| `kaspa/krc20-client.ts` | KRC-20 token queries via Kasplex API |
| `kaspa/krc20-transaction.ts` | KRC-20 transfer (commit + reveal inscription pattern) |
| `kaspa/price-client.ts` | Price data from CoinGecko and CryptoCompare |
| `securityFeatures.ts` | Duress mode, watch-only addresses, time-delayed transactions |
| `tokens/` | Token metadata and resolution (KAS + KRC-20) |
| `platform/` | Platform abstraction interfaces (crypto provider, storage provider) |
| `utils.ts` | Shared utilities |

### `packages/extension` — Browser Extension

Chrome and Firefox extension built with Vite. Single codebase targets both browsers via `webextension-polyfill`.

```
extension/src/
├── extension/
│   ├── background/           # Service worker — RPC message handler, state persistence
│   ├── contentScript/        # dApp bridge — injected into web pages (IIFE bundle)
│   ├── ledger/               # Ledger hardware wallet integration (USB/HID)
│   ├── manifest.chrome.json  # Chrome Manifest V3 (service_worker)
│   └── manifest.firefox.json # Firefox Manifest V3 (background.scripts)
├── ui/
│   ├── popup/                # Main wallet UI (single-page React app)
│   ├── options/              # Settings/options page
│   ├── assets/               # Icons, logos, animations
│   └── store.ts              # Zustand state store
└── platform/                 # Browser-specific crypto provider (Web Crypto API)
```

**Extension messaging:** Type-safe RPC between popup UI and background service worker. The background script holds wallet state and handles all crypto operations. The popup is a stateless view that queries the background.

**Content script / dApp bridge:** Injected into web pages. Provides `window.kaspa` API for dApp connections with per-site approval.

### `packages/mobile` — Mobile App

React Native app via Expo 55. Targets iOS and Android.

```
mobile/src/
├── screens/
│   ├── auth/          # Login (PIN + biometric)
│   ├── onboarding/    # Welcome, create wallet, import, seed phrase backup
│   ├── main/          # Home, send, receive, activity, settings
│   └── details/       # Token detail, transaction detail, PnL
├── navigation/        # React Navigation (stack + bottom tabs)
├── components/        # Wallet components, QR code, tab icons
├── hooks/             # Custom React hooks
├── store/             # Zustand state store
├── platform/          # Native crypto (react-native-quick-crypto, react-native-argon2)
└── theme/             # Dark theme configuration
```

## Key Design Decisions

### 1. Platform Abstraction

Core crypto and storage are abstracted behind interfaces in `core/platform/`. Each platform provides its own implementation:

- **Extension:** Web Crypto API for random bytes, browser storage API for persistence
- **Mobile:** `expo-crypto` / `react-native-quick-crypto` for native crypto, AsyncStorage for persistence

This keeps `@noxu/core` pure TypeScript with no platform dependencies.

### 2. Audited Crypto Libraries Only

All cryptography uses `@noble/curves`, `@noble/hashes`, `@scure/bip32`, and `@scure/bip39` — independently audited, minimal-dependency libraries. No large crypto frameworks.

### 3. Argon2id + AES-256-GCM

Wallet encryption uses Argon2id with 64MB memory cost (memory-hard, resistant to GPU/ASIC attacks) for key derivation, and AES-256-GCM for authenticated encryption. This is the same approach used by modern password managers.

### 4. Memory Wiping

All sensitive data (seeds, private keys, decrypted passwords) is explicitly zeroed from memory after use via `secure.ts` utilities. Prevents memory dump attacks.

### 5. KRC-20 Commit + Reveal

KRC-20 token transfers use a two-transaction pattern (commit + reveal) with Schnorr signatures via `@noble/curves/secp256k1`. The `KRC20TransferClient` handles the full flow.

### 6. Zod API Validation

All responses from Kaspa REST API are validated at runtime with Zod schemas. Prevents silent failures from API changes.

### 7. Single Codebase, Dual Browser

`webextension-polyfill` + separate manifest files for Chrome (service_worker) and Firefox (background.scripts). Vite build picks the correct manifest per target.

## Data Flow

```
User Action (UI)
    │
    ▼
Zustand Store (state update)
    │
    ▼ (extension: message to background)
    │ (mobile: direct call to core)
    │
Core Logic (@noxu/core)
    │
    ├── Crypto operations (sign, encrypt, derive)
    │
    ├── API calls (Kaspa, Kasplex, CoinGecko)
    │
    └── State mutations (wallet, balances, tokens)
    │
    ▼
UI re-render (React)
```

## Build System

- **Vite 7.2** for the extension — fast ES module builds, separate entry points for popup, options, background, and content script
- **Expo / Metro** for mobile — standard React Native bundling
- **npm workspaces** for monorepo — `packages/*` linked, shared `@noxu/core` dependency
