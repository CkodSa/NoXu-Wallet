# DoraHacks BUIDL Submission - NoXu Wallet

This document contains all the content you need to copy/paste into the DoraHacks BUIDL submission form.

---

## PROJECT NAME

NoXu Wallet

---

## ONE-LINER / TAGLINE

A security-first, non-custodial browser extension wallet for the Kaspa blockchain - available on Chrome and Firefox.

---

## SHORT DESCRIPTION (for submission form, ~150-200 words)

NoXu Wallet is a non-custodial browser extension wallet built specifically for the Kaspa blockchain. It enables users to securely manage their KAS holdings with industry-leading security practices including Argon2id key derivation, AES-256-GCM encryption, and automatic memory wiping of sensitive data.

Built with a security-first architecture, NoXu Wallet ensures your private keys never leave your device. The wallet supports BIP39 mnemonic generation (12/24 words), BIP44 key derivation with Kaspa's SLIP-44 standard (coin type 972), and features automatic wallet locking, dApp connection management, and custom RPC configuration for both mainnet and testnet.

Now available on both Chrome and Firefox, NoXu provides a clean React-based interface while maintaining a modular TypeScript codebase that separates core cryptographic logic from the extension layer. This architecture enables future portability and extensibility for KRC20 tokens, hardware wallet support, and L2 integrations.

Your keys, your crypto. Always.

---

## PROBLEM STATEMENT / MOTIVATION

### The Problem

Kaspa is one of the fastest and most innovative blockchains, utilizing a BlockDAG architecture that enables unprecedented throughput. However, the ecosystem needs diverse, security-focused wallet options. Users face several challenges:

**1. Security Gaps**
Many existing wallet solutions compromise on security or require trusting third parties with sensitive key material. Users deserve true self-custody without sacrificing protection against modern attack vectors.

**2. Limited Browser Integration**
Users need seamless access to emerging Kaspa dApps without managing separate applications or complex setups.

**3. Outdated Security Practices**
Few wallets implement modern cryptographic best practices like memory-safe key handling, Argon2id key derivation, or protection against clipboard hijacking and phishing attacks.

**4. Ecosystem Growth Barriers**
As Kaspa prepares for KRC20 tokens and L2 solutions, the ecosystem needs wallet infrastructure that can grow alongside it.

**5. Browser Compatibility**
Many crypto wallets only support Chrome, leaving Firefox users without options.

### Why This Matters

As Kaspa adoption grows, secure and user-friendly wallet infrastructure becomes critical. A single security breach can devastate user trust and harm the entire ecosystem. NoXu Wallet addresses this by implementing bank-grade encryption and defensive security measures typically found only in enterprise applications.

---

## SOLUTION DESCRIPTION

### What We Built

NoXu Wallet is a cross-browser extension (Chrome + Firefox) that provides complete Kaspa wallet functionality with an uncompromising focus on security.

### Core Features

**Wallet Management**
- Create new wallets with 12 or 24-word BIP39 seed phrases
- Import existing wallets from seed phrases
- Secure password protection with visual strength indicator

**Transactions**
- Send KAS with amount validation and confirmation modals
- Receive with address display, copy functionality, and QR codes
- View transaction history with status tracking
- Support for both mainnet and testnet

**Security Architecture**
- **Argon2id Key Derivation:** Memory-hard KDF (64MB, 3 iterations) prevents brute-force attacks
- **AES-256-GCM Encryption:** Authenticated encryption for stored wallet data
- **Memory Wiping:** Sensitive data cleared from memory immediately after use
- **Auto-Lock:** Configurable automatic locking on idle or system lock
- **dApp Approval:** Granular control over which websites can connect

**User Experience**
- Clean, intuitive interface (380x620px popup)
- Network switching with one click
- Custom RPC URL support for advanced users
- Address verification UI to prevent manipulation attacks

**Cross-Browser Support**
- Chrome Extension (Manifest V3 with service worker)
- Firefox Add-on (Manifest V3 with background scripts)
- Single codebase using webextension-polyfill

### Technical Implementation

- **Chrome/Firefox MV3:** Modern extension architecture with service workers
- **React 18 + TypeScript:** Type-safe, maintainable UI layer
- **Zustand:** Lightweight state management
- **Zod:** Runtime API response validation
- **webextension-polyfill:** Cross-browser compatibility
- **Modular Architecture:** Core logic is framework-agnostic for future portability

---

## TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         NoXu Wallet                             │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (React + Zustand)                                     │
│  ├── Popup Interface (380x620px)                                │
│  ├── Options/Settings Page                                      │
│  └── State Management (Zustand Store)                           │
├─────────────────────────────────────────────────────────────────┤
│  Extension Layer (Chrome MV3 / Firefox MV3)                     │
│  ├── Background Service Worker (State & RPC Handler)            │
│  ├── Content Script (dApp Bridge)                               │
│  └── Message Passing (Type-safe RPC)                            │
├─────────────────────────────────────────────────────────────────┤
│  Core Layer (Framework-Agnostic)                                │
│  ├── Wallet Class (State Management)                            │
│  ├── Crypto Module (Argon2id, AES-256-GCM, Memory Wiping)       │
│  ├── Mnemonic Module (BIP39/BIP44, SLIP-44 #972)                │
│  └── Kaspa Client (REST API, Zod Validation)                    │
├─────────────────────────────────────────────────────────────────┤
│  External                                                       │
│  └── Kaspa Network (api.kaspa.org / Custom RPC)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18.2, TypeScript 5.4 |
| Build | Vite 7.2 |
| State | Zustand 4.5 |
| Crypto | @scure/bip32, @scure/bip39, @noble/hashes |
| Validation | Zod 3.22 |
| Cross-Browser | webextension-polyfill |
| Platform | Chrome Extension (MV3), Firefox Add-on (MV3) |

### Key Design Decisions

1. **Separation of Concerns:** Core cryptographic logic is completely isolated from UI and extension code, enabling future mobile or desktop ports.

2. **No External Dependencies for Crypto:** We use audited, minimal libraries (@scure, @noble) rather than large frameworks, reducing attack surface.

3. **Memory Safety:** All sensitive data (seeds, private keys, passwords) is explicitly wiped from memory after use, protecting against memory dump attacks.

4. **Type Safety:** Full TypeScript with Zod runtime validation ensures API responses match expected schemas, preventing subtle bugs.

5. **Cross-Browser Compatibility:** Using webextension-polyfill allows a single codebase to target both Chrome and Firefox.

---

## FUTURE ROADMAP

### Phase 1 - Foundation (Completed ✅)
- Core wallet functionality (create, import, send, receive)
- Security infrastructure (encryption, memory wiping, auto-lock)
- Mainnet and testnet support
- dApp connection framework
- Cross-browser support (Chrome + Firefox)

### Phase 2 - Enhanced Transactions
- Full Kaspa transaction signing (Schnorr signatures)
- UTXO optimization for efficient spending
- Transaction fee estimation improvements
- Batch transaction support

### Phase 3 - Token Ecosystem
- KRC20 token support (send, receive, display)
- Remote token list integration
- Token metadata and price feeds
- NFT display support

### Phase 4 - dApp Integration
- Full dApp provider API (wallet_connect, sign_transaction)
- Transaction simulation/preview
- Approval popup UI for dApp requests
- WalletConnect protocol support

### Phase 5 - Advanced Features
- Multi-account support
- Hardware wallet integration (Ledger)
- Mobile companion app
- Edge/Brave explicit support

### Phase 6 - Ecosystem Growth
- Third-party security audit
- Open-source SDK for developers
- L2 solution integration
- Localization (multi-language support)

---

## TEAM INFORMATION

**[UPDATE THIS SECTION WITH YOUR ACTUAL INFORMATION]**

### Team Members

**[Your Name]** - Lead Developer / Founder
- Role: Full-stack development, security architecture, project lead
- Background: [Your background]
- GitHub: [Your GitHub URL]
- LinkedIn/Twitter: [Your social links]

### Why We're Building This

We are passionate about Kaspa's unique BlockDAG architecture and believe the ecosystem needs robust, security-focused wallet infrastructure to support mainstream adoption. With experience in [your relevant experience], we're committed to building tools that prioritize user safety without sacrificing usability.

---

## LINKS

**[UPDATE THESE WITH YOUR ACTUAL LINKS]**

- **GitHub Repository:** https://github.com/CkodSa/NoXu-Wallet
- **Demo Video:** [YouTube/Google Drive link - YOU NEED TO CREATE]
- **Chrome Web Store:** [Link if published]
- **Firefox Add-ons:** [Link if published]
- **Website:** [If you have one]
- **Twitter:** [Your Twitter]
- **Discord:** [If applicable]

---

## HACKATHON TRACK

Suggested tracks for submission (check the actual Kaspa hackathon page for available tracks):

- **Infrastructure / Tooling** - Wallet is core infrastructure
- **DeFi / Wallets** - Direct wallet submission
- **Security** - Strong security focus
- **User Experience** - Clean, intuitive interface

---

## SCREENSHOTS

**[YOU NEED TO CAPTURE THESE]**

Recommended screenshots to include:
1. Wallet creation / onboarding flow
2. Main dashboard showing balance
3. Send transaction screen
4. Receive screen with address/QR
5. Transaction history / Activity
6. Settings page

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

---

## SUBMISSION CHECKLIST

Before submitting, ensure you have:

- [ ] DoraHacks account created
- [ ] GitHub repository is PUBLIC
- [ ] README.md is comprehensive (DONE - check the updated README)
- [ ] Demo video recorded and uploaded (YOU NEED TO DO)
- [ ] Screenshots captured (YOU NEED TO DO)
- [ ] Team members added as contributors on DoraHacks
- [ ] All form fields filled out
- [ ] Project builds successfully for Chrome (`npm run build:chrome`)
- [ ] Project builds successfully for Firefox (`npm run build:firefox`)

---

*This document was prepared for the Kaspa Hackathon on DoraHacks (January 16 - February 15, 2026)*
