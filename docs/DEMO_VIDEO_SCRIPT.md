# NoXu Wallet - Demo Video Script

**Target Length:** 5-7 minutes (max 10 minutes per DoraHacks)
**Requirements:** Code walkthrough with voiceover or subtitles

---

## Pre-Recording Checklist

Before recording:
- [ ] Build the extension fresh: `npm run build`
- [ ] Load extension in Chrome (chrome://extensions -> Load unpacked -> dist/)
- [ ] Clear any existing wallet data (for clean demo)
- [ ] Have testnet KAS ready (or use mainnet with small amount)
- [ ] Prepare screen recording software (OBS, Loom, QuickTime, etc.)
- [ ] Test microphone audio quality
- [ ] Close unnecessary browser tabs and notifications

---

## Video Script

### [0:00 - 0:30] Introduction (30 seconds)

**[Show: Title slide or wallet logo]**

> "Hi, I'm [YOUR NAME], and this is NoXu Wallet - a security-first, non-custodial browser extension wallet built for the Kaspa blockchain.
>
> In this demo, I'll show you the core features of the wallet and walk through the code architecture that makes it secure."

**[Transition to Chrome browser]**

---

### [0:30 - 2:00] Live Demo - Wallet Creation (90 seconds)

**[Show: Chrome with extension icon]**

> "Let's start by creating a new wallet."

**[Click extension icon to open popup]**

> "When you first open NoXu, you're presented with options to create a new wallet or import an existing one using a seed phrase."

**[Click "Create New Wallet"]**

> "The wallet generates a secure 12-word seed phrase using the BIP39 standard. This is the only way to recover your wallet, so it's critical to back it up safely."

**[Show seed phrase screen]**

> "Notice we warn users to write this down and never share it. We also provide a copy button, but we warn about clipboard security risks."

**[Continue through confirmation step]**

> "Users must confirm their seed phrase to ensure they've saved it correctly."

**[Set password screen]**

> "Finally, we set a password. This password encrypts the wallet data stored locally using Argon2id key derivation and AES-256-GCM encryption."

**[Complete wallet creation, show dashboard]**

> "And we're in! The dashboard shows our balance, which is zero for a new wallet."

---

### [2:00 - 3:30] Core Features Demo (90 seconds)

**[Show: Main dashboard]**

> "Let me walk through the main features."

**[Click Receive]**

> "The Receive screen shows your Kaspa address with a copy button. In a full implementation, this would also show a QR code."

**[Show address]**

> "Notice the address format - Kaspa uses a custom Bech32 encoding with the 'kaspa:' prefix."

**[Navigate back, click Send]**

> "To send KAS, you enter the recipient address and amount. The wallet validates the address format before allowing you to proceed."

**[Show send form with validation]**

> "We show confirmation details before signing and broadcasting the transaction."

**[Navigate to Activity]**

> "The Activity tab shows your transaction history, pulled from the Kaspa REST API."

**[Navigate to Settings]**

> "In Settings, you can switch between mainnet and testnet, configure a custom RPC URL, set the auto-lock timeout, and manage connected dApps."

**[Show network switching]**

> "Switching networks is instant - the wallet reconnects to the appropriate Kaspa node."

---

### [3:30 - 5:30] Code Walkthrough (2 minutes)

**[Switch to: VS Code or code editor showing project]**

> "Now let's look at the code architecture."

**[Show: Project structure in file tree]**

> "The project is organized into three main layers: core, extension, and UI."

```
src/
├── core/        # Framework-agnostic business logic
├── extension/   # Chrome MV3 specific code
└── ui/          # React components
```

**[Open: src/core/crypto/encryption.ts]**

> "The core layer contains all the security-critical code. Here's our encryption module."

**[Highlight Argon2id section]**

> "We use Argon2id for key derivation with a 64 megabyte memory cost and 3 iterations. This makes brute-force attacks extremely expensive."

**[Highlight AES-GCM section]**

> "Encryption uses AES-256-GCM, which provides both confidentiality and authenticity."

**[Open: src/core/crypto/secure.ts]**

> "This module handles memory wiping. After any sensitive operation, we explicitly zero out arrays containing seeds, keys, or passwords."

**[Show wipe function]**

> "This protects against memory dump attacks where an attacker might try to extract secrets from RAM."

**[Open: src/core/crypto/mnemonic.ts]**

> "Key derivation follows BIP39 and BIP44 standards, using Kaspa's registered SLIP-44 coin type 972."

**[Open: src/extension/background/index.ts]**

> "The extension layer uses Chrome's Manifest V3 with a service worker. All sensitive operations happen here, isolated from the UI."

**[Open: src/core/kaspa/client.ts]**

> "API calls use Zod for runtime validation, ensuring responses match our expected schemas."

---

### [5:30 - 6:30] Security Highlights (1 minute)

**[Show: SECURITY_AUDIT.md in editor]**

> "We've documented our security model in SECURITY_AUDIT.md, covering threat vectors like:"

**[Scroll through document, highlight sections]**

> "Memory dump attacks - mitigated with explicit wiping.
> Console extraction - we add warning banners.
> Clipboard hijacking - we warn users when copying sensitive data.
> Phishing attacks - we verify extension IDs and origins."

**[Switch back to browser, show auto-lock]**

> "The wallet auto-locks after configurable inactivity, requiring the password to unlock."

---

### [6:30 - 7:00] Roadmap & Closing (30 seconds)

**[Show: Roadmap slide or README roadmap section]**

> "Looking ahead, we're working on full Schnorr signature support, KRC20 tokens, and hardware wallet integration."

**[Show: Final slide with links]**

> "NoXu Wallet - built for security, designed for Kaspa.
>
> Check out the code on GitHub, and thank you for watching!"

**[End screen with:]**
- GitHub: github.com/YOUR_USERNAME/noxu-wallet
- Twitter/Contact: [Your contact]

---

## Recording Tips

1. **Audio Quality:** Use a decent microphone, reduce background noise
2. **Screen Resolution:** Record at 1080p or higher
3. **Font Size:** Increase code editor font size so it's readable
4. **Pacing:** Speak clearly, don't rush through features
5. **Mistakes:** It's okay to make minor mistakes - shows authenticity
6. **Cursor:** Make your cursor visible and move it deliberately
7. **Editing:** You can edit out long pauses, but keep it natural

## Post-Recording

1. Export video as MP4 (H.264 codec recommended)
2. Upload to YouTube (unlisted or public) or Google Drive
3. Add the link to your BUIDL submission
4. Consider adding subtitles for accessibility

---

*Good luck with your recording!*
