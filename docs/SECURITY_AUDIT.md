# Hostile User Security Audit - NoXu Wallet

## Audit Date: January 2026
## Auditor: Pre-launch security review

---

## 1. ATTACK VECTORS ANALYZED

### 1.1 Seed Phrase Extraction Attacks

#### Attack: Memory Dump
**Vector:** Attacker with local access dumps browser memory to extract seed/keys
**Current Protection:**
- ✅ Memory wiping via `wipeBytes()` after use
- ✅ Seeds wiped after encryption
- ✅ Private keys wiped on lock
**Risk Level:** LOW (best-effort, JS GC limitations acknowledged)
**Recommendation:** Document that physical device security is user responsibility

#### Attack: Extension Storage Access
**Vector:** Malicious extension or script reads chrome.storage.local
**Current Protection:**
- ✅ Seed encrypted with Argon2id + AES-256-GCM
- ✅ No plaintext secrets in storage
**Risk Level:** LOW (encrypted at rest)
**Recommendation:** None needed

#### Attack: Console/DevTools Extraction
**Vector:** User tricked into pasting malicious code in console
**Current Protection:**
- ⚠️ No console warning banner
**Risk Level:** MEDIUM
**Recommendation:** Add console.log warning on load (see fix below)

#### Attack: Clipboard Hijacking
**Vector:** Malware monitors clipboard for seed phrases
**Current Protection:**
- ⚠️ "Copy all words" button puts seed in clipboard
**Risk Level:** MEDIUM (user convenience vs security tradeoff)
**Recommendation:** Add warning that clipboard may be monitored; suggest manual writing

---

### 1.2 Transaction Manipulation Attacks

#### Attack: Address Replacement
**Vector:** Malware replaces recipient address in clipboard or display
**Current Protection:**
- ✅ Address shown before send
- ⚠️ No address verification/checksum display
**Risk Level:** MEDIUM
**Recommendation:** Add prominent address verification UI; show first/last chars highlighted

#### Attack: Amount Manipulation
**Vector:** UI shows different amount than actually sent
**Current Protection:**
- ✅ Amount input directly used
- ✅ No intermediate manipulation
**Risk Level:** LOW
**Recommendation:** Add confirmation modal showing exact amount before broadcast

#### Attack: Fee Manipulation
**Vector:** Excessive fees drained to attacker
**Current Protection:**
- ✅ Fixed fee (1000 sompi) in code
- ⚠️ No user visibility of fee
**Risk Level:** LOW (fixed fee protects against this)
**Recommendation:** Show fee in confirmation UI

---

### 1.3 Phishing & Social Engineering

#### Attack: Fake Extension
**Vector:** User installs malicious clone extension
**Current Protection:**
- ✅ Verification guide created
- ⚠️ No in-extension verification
**Risk Level:** HIGH (external threat)
**Recommendation:**
- Publish extension ID prominently
- Add "Verify installation" in settings
- Monitor Chrome Web Store for clones

#### Attack: Fake Support
**Vector:** Scammer poses as support, asks for seed
**Current Protection:**
- ✅ Warning banners on seed screens
- ✅ Support policy document
- ✅ "We will never ask" messaging
**Risk Level:** MEDIUM (user education dependent)
**Recommendation:** Add periodic reminder in UI

#### Attack: Malicious dApp
**Vector:** dApp tricks user into signing malicious transaction
**Current Protection:**
- ✅ Explicit connection approval required
- ⚠️ No transaction details shown for dApp requests
**Risk Level:** MEDIUM
**Recommendation:** Always show full transaction details before signing

---

### 1.4 Network-Level Attacks

#### Attack: RPC Manipulation
**Vector:** Malicious RPC returns false balance/history
**Current Protection:**
- ✅ Zod schema validation on responses
- ✅ HTTPS required
- ⚠️ Single RPC source (no cross-verification)
**Risk Level:** LOW-MEDIUM
**Recommendation:** Consider multi-RPC verification for high-value operations

#### Attack: Man-in-the-Middle
**Vector:** Attacker intercepts RPC traffic
**Current Protection:**
- ✅ HTTPS enforced for api.kaspa.org
- ⚠️ Custom RPCs could be HTTP
**Risk Level:** LOW
**Recommendation:** Enforce HTTPS for custom RPCs

---

### 1.5 Browser/Extension Attacks

#### Attack: Extension Update Hijack
**Vector:** Malicious update pushed to compromise wallet
**Current Protection:**
- ⚠️ Auto-updates enabled by default
**Risk Level:** LOW (Chrome Web Store review)
**Recommendation:**
- Use reproducible builds
- Publish source hashes
- Consider delayed update rollout

#### Attack: Content Script Injection
**Vector:** Malicious page manipulates content script
**Current Protection:**
- ✅ Content script minimal (just provider injection)
- ✅ Message validation in background
**Risk Level:** LOW
**Recommendation:** None needed

#### Attack: Cross-Extension Communication
**Vector:** Malicious extension sends messages to wallet
**Current Protection:**
- ✅ Sender origin validation
- ✅ No external extension communication
**Risk Level:** LOW
**Recommendation:** None needed

---

### 1.6 Denial of Service / Griefing

#### Attack: Storage Exhaustion
**Vector:** Fill chrome.storage.local to break wallet
**Current Protection:**
- ⚠️ No storage limits checked
**Risk Level:** LOW (self-griefing)
**Recommendation:** Add storage size monitoring

#### Attack: Rapid Lock/Unlock
**Vector:** Repeatedly lock/unlock to cause issues
**Current Protection:**
- ✅ No rate limiting but no harmful effect
**Risk Level:** VERY LOW
**Recommendation:** None needed

---

## 2. FINDINGS REQUIRING CODE CHANGES

### 2.1 HIGH PRIORITY

#### Add Console Warning
```javascript
// Add to background/index.ts or inject via content script
console.log(
  '%c⚠️ STOP!',
  'color: red; font-size: 40px; font-weight: bold;'
);
console.log(
  '%cThis is a browser feature intended for developers. If someone told you to paste something here to "verify" or "hack" your wallet, it is a scam and they will steal your funds.',
  'font-size: 16px;'
);
```

#### Add Transaction Confirmation Modal
Before sending any transaction, show:
- Full recipient address (highlighted first/last 6 chars)
- Exact amount in KAS
- Network fee
- "Confirm" / "Cancel" buttons

### 2.2 MEDIUM PRIORITY

#### Enforce HTTPS for Custom RPCs
```typescript
// In SET_CUSTOM_RPC handler
if (rpcUrl && !rpcUrl.startsWith('https://')) {
  sendResponse({ ok: false, error: 'Custom RPC must use HTTPS' });
  break;
}
```

#### Add Clipboard Warning
On seed backup screen, change "Copy all words" to show:
"Copying to clipboard - your clipboard may be monitored by other apps. Writing down manually is safer."

### 2.3 LOW PRIORITY

- Add "Verify Installation" link in Settings
- Add periodic security reminder
- Consider multi-RPC verification

---

## 3. ATTACK SCENARIOS NOT PROTECTED AGAINST

These are **intentionally not protected** because they are outside wallet scope:

1. **Device Compromise** - If device has malware, all bets are off
2. **Physical Access** - If attacker has unlocked device, they win
3. **User Error** - Users who share seeds will lose funds
4. **Blockchain Attacks** - 51% attacks, consensus bugs (network-level)
5. **Social Engineering** - Determined scammers may succeed

**Documentation should make these clear to users.**

---

## 4. RECOMMENDED SECURITY DISCLOSURES

Add to documentation:

```
NoXu Wallet protects against:
✅ Remote key extraction
✅ Malicious websites reading your keys
✅ Unauthorized transactions
✅ Data collection and tracking

NoXu Wallet CANNOT protect against:
❌ Malware on your device
❌ Physical access to unlocked device
❌ Sharing your seed phrase
❌ Phishing if you enter seed on fake sites
❌ Malicious browser extensions with broad permissions
```

---

## 5. AUDIT SUMMARY

| Category | Risk Level | Status |
|----------|------------|--------|
| Key Storage | LOW | ✅ Secure |
| Encryption | LOW | ✅ Strong (Argon2id + AES-256-GCM) |
| Memory Handling | LOW | ✅ Best-effort wiping |
| Transaction Security | LOW | ✅ Confirmation modal added |
| Phishing Protection | MEDIUM | ✅ Warnings + verify link added |
| Network Security | LOW | ✅ HTTPS enforced |
| Extension Security | LOW | ✅ Minimal permissions |

**Overall Assessment:** Ready for launch.

**Critical Blockers:** None

**Completed Fixes (January 2026):**
1. ✅ Console security warning - Added
2. ✅ Transaction confirmation modal - Added with address highlighting
3. ✅ HTTPS enforcement for custom RPCs - Added
4. ✅ Clipboard warning on seed backup - Added
5. ✅ Verify installation link in Settings - Added
