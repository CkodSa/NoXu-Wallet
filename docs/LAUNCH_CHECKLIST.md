# NoXu Wallet Launch Day Checklist

## Overview
This checklist covers everything needed for a successful launch day on Chrome and Firefox.

---

## 📅 PRE-LAUNCH (1 Week Before)

### Code & Build
- [ ] All features working and tested
- [ ] No console errors or warnings
- [ ] Build completes without errors for both browsers
- [ ] Tested on Chrome (latest)
- [ ] Tested on Firefox (latest)
- [ ] Tested on fresh browser profile (both browsers)
- [ ] Tested create wallet flow
- [ ] Tested import wallet flow
- [ ] Tested send/receive (on testnet at minimum)

### Security
- [ ] Security audit complete (SECURITY_AUDIT.md)
- [ ] No debug console.logs (except security warning)
- [ ] All dependencies at fixed versions
- [ ] `npm audit` shows no critical issues
- [ ] Memory wiping implemented
- [ ] HTTPS enforced for custom RPCs

### Documentation
- [ ] Terms of Service finalized (src/legal/terms.ts)
- [ ] Privacy Policy finalized (src/legal/privacy.ts)
- [ ] Recovery Guide ready (src/legal/recovery.ts)
- [ ] Support Policy ready (src/legal/support.ts)
- [ ] Verification Guide ready (src/legal/verification.ts)

### Store Preparation
- [ ] Icon 128x128 PNG (high quality, looks good at small size)
- [ ] Screenshots (1280x800 or 640x400, showing key features):
  - Screenshot 1: Login/Welcome screen
  - Screenshot 2: Home screen with balance
  - Screenshot 3: Send transaction screen
  - Screenshot 4: Seed backup screen (with warning visible)
  - Screenshot 5: Settings/Privacy disclosure
- [ ] Promotional tile 440x280 (Chrome only, optional but recommended)
- [ ] Short description (132 chars max)
- [ ] Detailed description (16,000 chars max)
- [ ] Privacy policy URL (or inline)
- [ ] Category selected: Productivity or Finance

---

## 🚀 LAUNCH DAY

### Hour 0: Final Checks
- [ ] Run `npm run build:chrome` - verify successful
- [ ] Run `npm run build:firefox` - verify successful
- [ ] Test both dist folders load correctly in respective browsers
- [ ] Verify manifest.json has correct:
  - [ ] Name: "NoXu Wallet"
  - [ ] Version: "1.0.0"
  - [ ] Description matches store listing
  - [ ] Permissions are minimal

### Hour 1: Chrome Web Store Submission

1. Go to: https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload ZIP of `dist-chrome/` folder (exclude source maps if desired)
4. Fill in all fields:
   - [ ] Title
   - [ ] Summary
   - [ ] Description
   - [ ] Category
   - [ ] Language
   - [ ] Screenshots
   - [ ] Icons
5. Privacy tab:
   - [ ] Single purpose description: "Kaspa cryptocurrency wallet"
   - [ ] Permission justification for each permission
   - [ ] Data usage disclosure (select: "I do not collect user data")
   - [ ] Privacy policy (link or inline)
6. Distribution tab:
   - [ ] Visibility: Public
   - [ ] Regions: All (or select specific)
7. [ ] Submit for review

**Note:** Review typically takes 1-3 business days. May take longer for new developers.

### Hour 2: Firefox Add-ons Submission

1. Go to: https://addons.mozilla.org/developers/
2. Click "Submit a New Add-on"
3. Upload ZIP of `dist-firefox/` folder
4. Fill in all fields:
   - [ ] Name: NoXu Wallet
   - [ ] Summary (250 chars max)
   - [ ] Description
   - [ ] Categories
   - [ ] Screenshots
   - [ ] Icon
5. Source code (if requested):
   - [ ] Upload clean source code ZIP
   - [ ] Include build instructions
6. [ ] Submit for review

**Note:** Firefox reviews can take 1-7 days. Source code review may extend this.

### Hour 3: Prepare Web Presence

#### Website (if launching)
- [ ] Landing page live
- [ ] Link to Chrome Web Store (pending = add "Coming Soon")
- [ ] Link to Firefox Add-ons (pending = add "Coming Soon")
- [ ] Verification guide page
- [ ] Recovery guide page
- [ ] Terms of Service page
- [ ] Privacy Policy page

#### GitHub Repository
- [ ] Repository is public (or decide on timing)
- [ ] README.md includes:
  - [ ] What the wallet does
  - [ ] Installation instructions (Chrome + Firefox)
  - [ ] Build commands for both browsers
  - [ ] Security model overview
  - [ ] Links to store listings
  - [ ] How to report issues
  - [ ] License
- [ ] Issue templates created:
  - [ ] Bug report template
  - [ ] Feature request template
  - [ ] Security issue template (point to private channel)
- [ ] SECURITY.md with responsible disclosure info

#### Social Media (if applicable)
- [ ] Twitter/X account ready
- [ ] Launch tweet drafted
- [ ] Pinned tweet: How to verify real extension

---

## ✅ POST-SUBMISSION (While Waiting for Review)

### Documentation
- [ ] Publish website (if not yet live)
- [ ] Create FAQ based on expected questions
- [ ] Set up monitoring for:
  - [ ] GitHub issues
  - [ ] Social media mentions
  - [ ] Chrome Web Store reviews (once live)
  - [ ] Firefox Add-ons reviews (once live)

### Community
- [ ] Announce in Kaspa community (Discord/Telegram)
- [ ] Reach out to Kaspa-related accounts for potential RT
- [ ] Prepare response templates for common questions

### Monitoring Setup
- [ ] Set Google Alert for "NoXu Wallet"
- [ ] Set up periodic check for copycat extensions (both stores)
- [ ] Bookmark both store searches for similar names

---

## 🎉 APPROVAL & GO-LIVE

### Immediately After Approval (Each Store)
- [ ] Verify listing is live and accessible
- [ ] Install from store and test (fresh profile)
- [ ] Note the Extension/Add-on ID for verification guide
- [ ] Update verification.ts with real IDs

### Announcements
- [ ] Update website with "Now Available" + store links
- [ ] Tweet announcement
- [ ] Post in Kaspa community channels
- [ ] Update README with store links

### Monitor First 24 Hours
- [ ] Watch for user reports
- [ ] Respond quickly to any issues
- [ ] Monitor store reviews
- [ ] Check for fake extension submissions

---

## 📊 FIRST WEEK METRICS TO TRACK

- [ ] Install count (Chrome)
- [ ] Install count (Firefox)
- [ ] Uninstall count (developer dashboards)
- [ ] GitHub issues opened
- [ ] Store reviews (respond to all!)
- [ ] Support requests received
- [ ] Any security reports

---

## 🚨 IF SOMETHING GOES WRONG

### Store Rejection
- Read rejection reason carefully
- Common reasons:
  - Excessive permissions (reduce them)
  - Unclear purpose (improve description)
  - Missing privacy policy
  - Misleading claims
- Fix and resubmit

### Bug Discovered After Launch
- Assess severity (see INCIDENT_PLAYBOOK.md)
- If critical: Request expedited review for fix
- If non-critical: Fix and submit update normally

### Fake Extension Appears
- Follow fake extension response in INCIDENT_PLAYBOOK.md
- Report immediately to both stores
- Warn users on all channels

---

## 📝 LAUNCH ANNOUNCEMENT TEMPLATES

### Twitter/X
```
🚀 NoXu Wallet is LIVE!

A non-custodial Kaspa wallet for your browser.

✅ You control your keys
✅ No tracking, no accounts
✅ Open source
✅ Chrome + Firefox

Chrome: [Chrome Web Store link]
Firefox: [Firefox Add-ons link]
Verify: [Verification page link]

#Kaspa #KAS #Crypto #Wallet
```

### Community Post (Discord/Telegram)
```
Hey everyone! 👋

Excited to share NoXu Wallet - a browser wallet for Kaspa.

What it is:
• Non-custodial (you control your keys)
• No tracking or analytics
• Open source
• Works on Chrome AND Firefox

Important:
• Only install from official stores
• Chrome Extension ID: [ID]
• Firefox Add-on ID: [ID]
• Verify at: [link]

Download:
• Chrome: [link]
• Firefox: [link]

Would love feedback! Report issues on GitHub: [link]

Thanks for being part of the Kaspa community 🙏
```

### GitHub README Badge
```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
[![Firefox Add-on](https://img.shields.io/amo/v/YOUR_ADDON_ID)](https://addons.mozilla.org/firefox/addon/YOUR_ADDON_ID/)
```

---

## ✅ LAUNCH COMPLETE CHECKLIST

After everything is live:
- [ ] Extension available in Chrome Web Store
- [ ] Add-on available in Firefox Add-ons
- [ ] Website live with all documentation
- [ ] GitHub repository accessible
- [ ] Verification guide updated with real Extension IDs
- [ ] At least one announcement posted
- [ ] Monitoring in place
- [ ] First user feedback received
- [ ] Responded to early reviews/issues

**Congratulations on launching! 🎉**

Remember: The real work starts now. Stay responsive, stay secure, and keep improving.
