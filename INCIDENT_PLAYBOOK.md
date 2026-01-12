# Post-Launch Incident Playbook

## Purpose
This document outlines how to respond to security incidents, user reports, and crises after NoXu Wallet launches.

---

## INCIDENT SEVERITY LEVELS

### 🔴 CRITICAL (P0)
**Definition:** Active exploitation, funds at risk, or security breach
**Examples:**
- Vulnerability allowing key extraction
- Malicious code in release
- Compromised update mechanism
- Mass user fund theft

**Response Time:** IMMEDIATE (within 1 hour)

### 🟠 HIGH (P1)
**Definition:** Potential security issue, widespread user impact
**Examples:**
- Discovered vulnerability (not yet exploited)
- Fake extension on store with significant installs
- Critical bug causing data loss
- RPC provider compromise

**Response Time:** Within 4 hours

### 🟡 MEDIUM (P2)
**Definition:** Localized issue, workaround available
**Examples:**
- UI bug affecting some users
- Minor security improvement needed
- Single phishing report
- Network connectivity issues

**Response Time:** Within 24 hours

### 🟢 LOW (P3)
**Definition:** Minor issues, feature requests
**Examples:**
- Cosmetic bugs
- Feature suggestions
- Documentation updates

**Response Time:** Best effort

---

## INCIDENT RESPONSE PROCEDURES

### 🔴 CRITICAL INCIDENT RESPONSE

#### Step 1: Confirm & Contain (0-15 minutes)
- [ ] Verify the report is legitimate
- [ ] Identify affected version(s)
- [ ] Determine if active exploitation is occurring
- [ ] DO NOT publicize yet

#### Step 2: Emergency Actions (15-60 minutes)
- [ ] If malicious release: Request Chrome Web Store takedown
- [ ] If vulnerability: Assess if patch can be deployed immediately
- [ ] Draft user communication (but don't send yet)
- [ ] Notify any security contacts/advisors

#### Step 3: Remediation (1-24 hours)
- [ ] Develop and test fix
- [ ] Prepare new release
- [ ] Update all official channels with incident notice
- [ ] Deploy fix to stores

#### Step 4: Communication
**Template:**
```
⚠️ SECURITY NOTICE

We identified a security issue affecting NoXu Wallet [version].

WHAT HAPPENED:
[Brief, honest description]

WHAT TO DO:
1. Update to version [X.X.X] immediately
2. [Any additional user actions needed]

WHAT WE'RE DOING:
[Actions taken]

If you believe you were affected, please [contact instructions].

We apologize for any concern this causes.
```

#### Step 5: Post-Incident
- [ ] Write detailed incident report
- [ ] Update security practices
- [ ] Consider bug bounty or security audit

---

### 🟠 FAKE EXTENSION RESPONSE

#### Detection
Monitor for:
- Similar names: "NoXu", "Noxu Wallet", "N0xu", etc.
- Similar icons or screenshots
- User reports

#### Response Steps
1. **Document:** Screenshot the fake listing, note extension ID
2. **Report to Store:**
   - Chrome: chrome.google.com/webstore/report
   - Select "Impersonation" or "Malware"
   - Include evidence
3. **Alert Users:**
   - Post on official channels
   - Add to known scams list
   - Update verification guide
4. **Monitor:** Check if removed within 48 hours
5. **Escalate:** If not removed, escalate to Google support

#### User Communication Template
```
⚠️ SCAM ALERT

A FAKE NoXu Wallet extension has been detected.

❌ FAKE Extension ID: [ID]
✅ REAL Extension ID: [Your real ID]

If you installed the fake extension:
1. DO NOT enter your seed phrase
2. Remove the extension immediately
3. If you already entered your seed:
   - Create a new wallet
   - Transfer all funds to the new address
   - Your old wallet is compromised

Only install NoXu from: [official link]
```

---

### 🟠 VULNERABILITY REPORT RESPONSE

#### If Reported Privately
1. **Acknowledge:** Reply within 24 hours
2. **Verify:** Reproduce the issue
3. **Assess:** Determine severity
4. **Fix:** Develop patch
5. **Credit:** Offer credit/thanks to reporter
6. **Disclose:** Coordinate disclosure timing

#### If Reported Publicly
1. **Don't panic:** Acknowledge seeing the report
2. **Assess quickly:** Is it actually exploitable?
3. **Communicate:** "We're investigating and will update soon"
4. **Fix ASAP:** This is now a race
5. **Full disclosure:** Once fixed, be transparent

---

### 🟡 USER LOST FUNDS REPORT

#### Triage Questions
1. Did they share their seed phrase with anyone?
2. Did they install any other wallet extensions?
3. Did they connect to any suspicious dApps?
4. What's their transaction history show?

#### Response Template
```
I'm sorry to hear about your situation. Let me help investigate.

Unfortunately, as a non-custodial wallet, we cannot:
- Access your funds
- Reverse transactions
- Recover your wallet

To help us understand what happened, can you tell us:
1. Did anyone ever ask for your seed phrase?
2. Did you install NoXu from the official Chrome Web Store?
3. What websites/dApps did you connect to recently?

If you shared your seed phrase with anyone, even "support",
your funds were likely stolen by a scammer.

We can help you:
- Verify your extension is the real one
- Report scammers
- Set up a new, secure wallet going forward
```

---

### 🟢 SUPPORT REQUEST HANDLING

#### Auto-Response Template (GitHub Issues)
```
Thanks for your report. A few things to note:

✅ We CAN help with: Bugs, crashes, feature requests, UI issues
❌ We CANNOT help with: Lost seed phrases, stolen funds, transaction reversal

If this is a security issue, please email [security contact] instead of
posting publicly.

For faster help, please include:
- Browser + version
- NoXu version
- Steps to reproduce
- Screenshots (but NEVER your seed phrase!)
```

---

## COMMUNICATION CHANNELS

### Where to Post Incident Notices
1. **GitHub:** Pin issue or release notes
2. **Website:** Banner on homepage
3. **Twitter/X:** If you have official account
4. **Discord/Telegram:** If you have communities

### Communication Principles
- **Be honest:** Don't minimize or hide issues
- **Be clear:** Avoid technical jargon
- **Be actionable:** Tell users exactly what to do
- **Be timely:** Faster is better
- **Take responsibility:** Don't blame users (even if it's their fault)

---

## EMERGENCY CONTACTS

Fill in before launch:
- **Primary responder:** _______________
- **Secondary responder:** _______________
- **Chrome Web Store contact:** (via developer console)
- **Legal counsel (if any):** _______________
- **Security advisor (if any):** _______________

---

## MONITORING CHECKLIST

### Daily
- [ ] Check GitHub issues
- [ ] Check official email
- [ ] Search social media for mentions

### Weekly
- [ ] Search Chrome Web Store for copycats
- [ ] Review analytics (if any)
- [ ] Check for dependency vulnerabilities (`npm audit`)

### Monthly
- [ ] Full dependency update review
- [ ] Security practice review
- [ ] Documentation update

---

## POST-INCIDENT REPORT TEMPLATE

```
# Incident Report: [Title]

## Summary
[One paragraph description]

## Timeline
- [Time]: Issue discovered
- [Time]: Response initiated
- [Time]: Fix deployed
- [Time]: Incident resolved

## Impact
- Users affected: [Number/estimate]
- Funds at risk: [Yes/No/Unknown]
- Duration: [Time period]

## Root Cause
[Technical explanation]

## Response Actions
1. [Action taken]
2. [Action taken]

## Lessons Learned
- What went well:
- What could improve:

## Preventive Measures
- [Measure to prevent recurrence]
```
