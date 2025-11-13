# Privacy Policy

> **How miniCycle handles your data**

**Effective Date:** November 13, 2025
**Version:** 1.0
**miniCycle Version:** 1.352

---

## TL;DR (Summary)

**miniCycle collects ZERO data.**

- ✅ All data stored locally on your device
- ✅ No servers, no cloud, no tracking
- ✅ No analytics, no telemetry, no cookies
- ✅ No accounts, no authentication, no registration
- ✅ **100% private by design**

---

## Data Collection

### What We Collect

**Nothing.** miniCycle collects zero data.

### What We Store (Locally Only)

All data is stored **in your browser** using:

**localStorage:**
- Your cycles and tasks
- App settings and preferences
- Theme selections
- Onboarding state

**IndexedDB:**
- Undo/redo history (per-cycle)
- Temporary state snapshots

**This data never leaves your device.**

---

## Data Transmission

### Network Activity

miniCycle makes **zero network requests** for:
- ❌ No analytics
- ❌ No error reporting
- ❌ No telemetry
- ❌ No tracking pixels
- ❌ No third-party scripts
- ❌ No API calls

**The only network activity:**
- Initial page load (downloading app files)
- Service Worker updates (checking for new versions)

**No data is transmitted.**

---

## Third-Party Services

### What We Use

**None.**

- No Google Analytics
- No Firebase
- No Sentry
- No advertising networks
- No CDNs (for user data)
- No external fonts
- No external scripts

**100% self-contained application.**

---

## Cookies

### Cookie Usage

miniCycle uses **zero cookies**.

- No tracking cookies
- No analytics cookies
- No advertising cookies
- No session cookies

**Local Storage != Cookies:**
- localStorage is for app functionality
- Stays on your device
- Not sent to servers
- You control it

---

## Data Access

### Who Has Access

**Only you.**

- miniCycle developers: ❌ No access
- Third parties: ❌ No access
- Servers: ❌ Don't exist
- Cloud providers: ❌ Not used

**Exception:** Anyone with physical access to your unlocked device can see your data (this is a browser security model limitation, not a miniCycle limitation).

---

## Data Storage

### Where Data Lives

**In your browser only:**

```
Your Device
  └── Browser
      ├── localStorage (cycle data)
      └── IndexedDB (undo history)
```

**Not stored:**
- ❌ On any server
- ❌ In any cloud
- ❌ On any other device

### Storage Limits

**Browser-imposed limits:**
- localStorage: ~5-10MB (browser-dependent)
- IndexedDB: ~50MB-unlimited (browser-dependent)

**miniCycle usage:**
- Typical: < 1MB for 10 cycles with 50 tasks each
- Heavy: < 5MB for 50 cycles with 100 tasks each

---

## Data Control

### Your Rights

You have **complete control** over your data:

**Export:**
- Download all data as `.mcyc` files
- JSON format, human-readable
- No vendor lock-in

**Delete:**
- Clear individual tasks
- Delete entire cycles
- Factory reset (Settings → Clear All Data)

**Modify:**
- Edit any task or cycle
- Change any setting
- No restrictions

**Transfer:**
- Export → Import on another device
- Share cycles with others
- Backup to your own cloud storage

---

## Data Retention

### How Long We Keep Data

**Forever (unless you delete it).**

miniCycle stores data in your browser until:
- You explicitly delete it
- You clear browser data
- You uninstall the browser
- You factory reset your device

**We don't have a copy to retain.**

---

## Data Sharing

### Who We Share With

**No one.**

- Not shared with miniCycle team
- Not shared with third parties
- Not shared with advertisers
- Not shared with anyone

**You control sharing:**
- You can export and share `.mcyc` files
- Your choice entirely
- Consider sanitizing sensitive data first

---

## Security

### How We Protect Your Data

**By not having it.**

Since all data is local:
- No server breaches
- No database leaks
- No unauthorized access
- No data transmission to intercept

**Your responsibility:**
- Lock your device
- Use strong device password
- Keep browser updated
- Backup data yourself

See [SECURITY.md](../SECURITY.md) for details.

---

## Children's Privacy

### COPPA Compliance

miniCycle is safe for all ages:

- No data collection
- No account creation
- No social features
- No advertising
- No tracking

**Parents:** miniCycle is as safe as an offline notebook app.

---

## International Users

### GDPR (EU)

**Compliant by design:**

- ✅ No personal data collected
- ✅ No data processing
- ✅ No data transfers
- ✅ No consent required (nothing to consent to)
- ✅ Right to erasure (you can delete anytime)
- ✅ Data portability (export feature)

### CCPA (California)

**Compliant by design:**

- ✅ No personal information collected
- ✅ No personal information sold
- ✅ No personal information shared
- ✅ No opt-out required (nothing to opt out of)

### Other Jurisdictions

miniCycle respects privacy laws worldwide by **not collecting any data**.

---

## Changes to Privacy Policy

### How We Notify

If this policy changes:

1. Update this document
2. Update "Last Updated" date
3. Announce in release notes
4. GitHub notification

**Major changes** (e.g., introducing analytics):
- Require user opt-in
- Clearly communicated
- Documented in CHANGELOG

---

## Contact

### Privacy Questions

- **GitHub Issues:** Privacy-related questions
- **Email:** privacy@minicycle.app (if available)

### Data Requests

Since we don't collect data, we can't:
- Provide data we don't have
- Delete data we don't store
- Correct data we don't keep

**You have all your data** in your browser.

---

## Self-Hosting

### Privacy for Self-Hosters

If you self-host miniCycle:

**You are responsible for:**
- Server logs (may contain IP addresses)
- Access controls
- TLS/SSL certificates
- Privacy policy for your users

**miniCycle itself still:**
- Doesn't collect data
- Doesn't transmit data
- Stores everything locally

---

## Browser Privacy

### Browser Storage

**localStorage and IndexedDB:**
- Part of browser security model
- Isolated by origin (domain)
- Can't be accessed by other sites
- Can be cleared by user

**Service Worker:**
- Caches files for offline use
- No user data in cache
- Only app code and assets

---

## Analytics & Tracking

### What We Don't Track

- ❌ Page views
- ❌ Button clicks
- ❌ Feature usage
- ❌ Time spent
- ❌ Error rates
- ❌ Device info
- ❌ IP addresses
- ❌ User agents
- ❌ Anything else

**Exception:** GitHub (if you visit our repo) has their own analytics. We don't control that.

---

## Future Plans

### Cloud Sync (Under Consideration)

If we add cloud sync (optional):

**Principles:**
- 🔒 **End-to-end encryption** (we can't read your data)
- 🎯 **Opt-in only** (default remains local)
- 🔓 **Zero-knowledge** (server can't decrypt)
- 📤 **Your key, your data** (lose key = lose data)
- 🗑️ **Deletable anytime** (one-click account deletion)

**We will:**
- Update this privacy policy
- Require explicit opt-in
- Allow local-only use
- Keep it 100% optional

**This is not implemented yet.** Current version is 100% local.

---

## Transparency

### Open Source

miniCycle is open source:

- **Code is public** - Verify our claims
- **No hidden behavior** - Audit yourself
- **Community reviewed** - Others check it
- **Forkable** - Run your own version

**See for yourself:** Browse the code on GitHub.

---

## Privacy Comparison

### vs. Other Task Apps

| Feature | miniCycle | Todoist | Asana | Trello |
|---------|-----------|---------|-------|--------|
| **Data Collection** | None | Yes | Yes | Yes |
| **Cloud Required** | No | Yes | Yes | Yes |
| **Account Required** | No | Yes | Yes | Yes |
| **Analytics** | No | Yes | Yes | Yes |
| **Third-party Scripts** | No | Yes | Yes | Yes |
| **Ad Tracking** | No | Free tier: Yes | No | No |
| **Data Portability** | Yes | Limited | Limited | Limited |
| **Self-Hostable** | Yes | No | No | No |

---

## Summary

**miniCycle is private by design:**

1. **No data leaves your device**
2. **No accounts or authentication**
3. **No servers or databases**
4. **No analytics or tracking**
5. **No third-party services**
6. **You have complete control**

**Questions?** See the FAQ or open a GitHub Issue.

---

**Privacy Policy Version:** 1.0
**Effective Date:** November 13, 2025
**Last Updated:** November 13, 2025
**miniCycle Version:** 1.352

*Your privacy is our priority. Always has been, always will be.*
