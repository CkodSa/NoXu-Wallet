# NoXu Wallet Launch Day Checklist

## Overview
This checklist covers everything needed for a successful launch day.

---

## 📅 PRE-LAUNCH (1 Week Before)

### Code & Build
- [ ] All features working and tested
- [ ] No console errors or warnings
- [ ] Build completes without errors
- [ ] Tested on Chrome (latest)
- [ ] Tested on fresh browser profile
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
- [ ] Promotional tile 440x280 (optional but recommended)
- [ ] Short description (132 chars max)
- [ ] Detailed description (16,000 chars max)
- [ ] Privacy policy URL (or inline)
- [ ] Category selected: Productivity or Finance

---

## 🚀 LAUNCH DAY

### Hour 0: Final Checks
- [ ] Run `npm run build` one final time
- [ ] Test the dist/ folder loads correctly
- [ ] Verify manifest.json has correct:
  - [ ] Name: "NoXu Wallet"
  - [ ] Version: "1.0.0"
  - [ ] Description matches store listing
  - [ ] Permissions are minimal

### Hour 1: Store Submission

#### Chrome Web Store
1. Go to: https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload ZIP of `dist/` folder (exclude source maps if desired)
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

### Hour 2: Prepare Web Presence

#### Website (if launching)
- [ ] Landing page live
- [ ] Link to Chrome Web Store (pending = add "Coming Soon")
- [ ] Verification guide page
- [ ] Recovery guide page
- [ ] Terms of Service page
- [ ] Privacy Policy page

#### GitHub Repository
- [ ] Repository is public (or decide on timing)
- [ ] README.md includes:
  - [ ] What the wallet does
  - [ ] Installation instructions
  - [ ] Security model overview
  - [ ] Link to store listing
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

### Community
- [ ] Announce in Kaspa community (Discord/Telegram)
- [ ] Reach out to Kaspa-related accounts for potential RT
- [ ] Prepare response templates for common questions

### Monitoring Setup
- [ ] Set Google Alert for "NoXu Wallet"
- [ ] Set up periodic check for copycat extensions
- [ ] Bookmark Chrome Web Store search for similar names

---

## 🎉 APPROVAL & GO-LIVE

### Immediately After Approval
- [ ] Verify listing is live and accessible
- [ ] Install from store and test (fresh profile)
- [ ] Note the Extension ID for verification guide
- [ ] Update verification.ts with real Extension ID

### Announcements
- [ ] Update website with "Now Available" + store link
- [ ] Tweet announcement
- [ ] Post in Kaspa community channels
- [ ] Update README with store link

### Monitor First 24 Hours
- [ ] Watch for user reports
- [ ] Respond quickly to any issues
- [ ] Monitor store reviews
- [ ] Check for fake extension submissions

---

## 📊 FIRST WEEK METRICS TO TRACK

- [ ] Install count
- [ ] Uninstall count (developer dashboard)
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
- Report immediately
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

Get it: [Chrome Web Store link]
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
• Chrome extension

Important:
• Only install from the official Chrome Web Store
• Extension ID: [ID]
• Verify at: [link]

Would love feedback! Report issues on GitHub: [link]

Thanks for being part of the Kaspa community 🙏
```

### GitHub README Badge
```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
```

---

## ✅ LAUNCH COMPLETE CHECKLIST

After everything is live:
- [ ] Extension available in Chrome Web Store
- [ ] Website live with all documentation
- [ ] GitHub repository accessible
- [ ] Verification guide updated with real Extension ID
- [ ] At least one announcement posted
- [ ] Monitoring in place
- [ ] First user feedback received
- [ ] Responded to early reviews/issues

**Congratulations on launching! 🎉**

Remember: The real work starts now. Stay responsive, stay secure, and keep improving.
