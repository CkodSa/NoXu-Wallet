# Onboarding Text Review - Legal & Security Clarity

## Current Text Analysis

### Welcome/Login Screen
**Current:** "ENTER YOUR PASSWORD" / "Create new wallet" / "Import existing wallet"
**Assessment:** ✅ Clear, neutral
**No changes needed**

---

### Create Wallet Screen

**Current Warning Banner:**
```
Security Warning: Never share your seed phrase with anyone.
NoXu will NEVER ask for your seed phrase. Beware of scams and phishing sites.
```

**Assessment:** ✅ Good
**Suggestions:**
- Consider adding: "This includes NoXu support staff"

**Password Field:**
```
Set a strong password (for local encryption)
```

**Assessment:** ✅ Clear about local-only purpose

---

### Seed Backup Screen

**Current Critical Banner:**
```
CRITICAL: Write these words on paper and store securely offline.
NEVER enter them on any website. NoXu support will NEVER ask for your seed phrase.
```

**Assessment:** ✅ Excellent - covers key risks

**Current Instructions:**
```
Write down these [12/24] words. Never share them.
You will not see this screen again.
```

**Assessment:** ⚠️ Could be clearer
**Suggested revision:**
```
Write down these [12/24] words IN ORDER. Never share them with anyone.
If you lose these words, you lose access to your funds FOREVER.
NoXu cannot recover them for you.
```

**"Copy all words" Button:**
**Assessment:** ⚠️ Security concern
**Recommendation:** Add tooltip or change to:
```
Copy to clipboard (⚠️ clipboard may be monitored)
```

**Security Footer:**
```
Security: Keep it offline. Anyone with these words can spend your funds.
```

**Assessment:** ✅ Good

---

### Seed Confirmation Screen

**Current:**
```
To confirm, type word #[N] from your seed phrase.
```

**Assessment:** ✅ Good verification method

---

### Import Wallet Screen

**Current Warning Banner:**
```
Scam Alert: Only import your seed phrase in the official NoXu extension.
Never enter it on websites or share it with anyone claiming to be support.
```

**Assessment:** ✅ Excellent

**Placeholder:**
```
Enter your 12/24-word mnemonic
```

**Assessment:** ✅ Clear

---

### Settings - Privacy Disclosure

**Current:**
```
🔐 Your keys never leave this device
🚫 No analytics or tracking
📡 Only connects to Kaspa RPC for balances/transactions
⚠️ We cannot recover your wallet - backup your seed phrase!

NoXu is non-custodial. You have full control and responsibility.
```

**Assessment:** ✅ Excellent - covers all key points

---

## Recommended Text Updates

### Update 1: Seed Backup Instructions
Change from:
```
Write down these {wordCount} words. Never share them. You will not see this screen again.
```

To:
```
Write down these {wordCount} words IN ORDER. This is your ONLY backup.
If you lose these words, your funds are gone forever. NoXu cannot help.
```

### Update 2: Copy Button Warning
Add to the seed backup screen after "Copy all words" button:
```
<div className="muted small warning-text">
  ⚠️ Clipboard contents can be read by other apps. Writing manually is safer.
</div>
```

### Update 3: Confirmation Screen Enhancement
Add before the input:
```
This confirms you have actually saved your seed phrase - not just clicked through.
```

---

## Legal Compliance Checklist

| Requirement | Status | Location |
|-------------|--------|----------|
| Non-custodial disclaimer | ✅ | Settings, ToS |
| No recovery possible warning | ✅ | Seed screen, Settings |
| User responsibility statement | ✅ | Settings, ToS |
| No financial advice | ✅ | Not applicable (no advice given) |
| Data handling disclosure | ✅ | Privacy Policy, Settings |
| Third-party RPC disclosure | ✅ | Privacy Policy |
| Scam warnings | ✅ | All seed screens |

---

## Store Listing Compliance

### Words to AVOID (per store policy):
- ❌ "Secure your crypto" (implies guarantee)
- ❌ "Protect your funds" (implies guarantee)
- ❌ "Safe storage" (implies guarantee)
- ❌ "Recover your wallet" (misleading for non-custodial)

### Words to USE:
- ✅ "Non-custodial" (accurate)
- ✅ "You control your keys" (accurate)
- ✅ "Self-custody" (accurate)
- ✅ "Open source" (verifiable)

### Current Description:
```
A non-custodial Kaspa wallet. You control your keys.
```

**Assessment:** ✅ Perfect - accurate and compliant
