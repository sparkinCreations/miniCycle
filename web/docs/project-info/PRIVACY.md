# Privacy Policy

> **How miniCycle handles your data**

**Effective Date:** October 2, 2025
**Last Updated:** May 2, 2026
**Version:** 2.5
**miniCycle Version:** 2.216

---

## TL;DR (Summary)

**The miniCycle app collects ZERO data.** All your task data, settings, and history stay on your device. The app makes no analytics, telemetry, or tracking calls.

**The miniCycle marketing pages** (product page and learn-more page) use a small self-hosted counter to record button clicks and page views in aggregate — no cookies, no stored IP addresses, no personal data, no third-party analytics, and no advertising trackers. See "Analytics & Tracking" below for the full disclosure.

- ✅ The app: 100% local, zero data collection
- ✅ No accounts, no authentication, no registration
- ✅ No cookies anywhere
- ⚠️ Marketing pages only: anonymous click & page-view counts (no PII, no cookies, no IPs stored, no third-party analytics or ad trackers)

---

## Data Collection

### What We Collect

**Inside the app: nothing.** miniCycle (the application at `miniCycle.html`) collects zero data.

**On the marketing pages:** anonymous, aggregated click and page-view counts. No cookies, no IPs, no fingerprinting, no personal data. See "Analytics & Tracking" further down for the full disclosure.

### What We Store (Locally Only)

All data is stored **in your browser** using:

**localStorage:**
- Your routines and tasks
- App settings and preferences
- Theme selections
- Onboarding state

**IndexedDB:**
- Undo/redo history (per-cycle)
- Temporary state snapshots

**This data never leaves your device.**

---

## Data Transmission

### Network Activity (App)

The miniCycle app makes **zero network requests** for:
- ❌ No analytics
- ❌ No error reporting
- ❌ No telemetry
- ❌ No tracking pixels
- ❌ No third-party scripts
- ❌ No API calls

**The only network activity in the app:**
- Initial page load (downloading app files)
- Service Worker updates (checking for new versions)

### Network Activity (Marketing Pages)

The product and learn-more pages POST anonymous click and page-view events to a self-hosted Netlify Function on our own infrastructure. See "Analytics & Tracking" below for what is and isn't included in those events.

**No data from inside the app is ever transmitted.**

---

## Third-Party Services

### What We Use

**For the app: none.** The application has no third-party integrations.

**For the marketing pages:** anonymous event counts are stored using Netlify Blobs (our own hosting infrastructure). No third-party analytics, advertising, or tracking services are involved.

- No Google Analytics
- No Firebase
- No Sentry
- No advertising networks
- No CDNs (for user data)
- No external fonts
- No external scripts

**The app itself remains 100% self-contained.**

---

## Cookies

### Cookie Usage

miniCycle uses **zero cookies** — neither the app nor the marketing pages set cookies of any kind.

- No tracking cookies
- No analytics cookies
- No advertising cookies
- No session cookies

**localStorage and sessionStorage are not cookies:**

- localStorage stores your task data (in the app) — never transmitted
- sessionStorage stores a single per-tab flag on the marketing pages (`pv-product` / `pv-learn-more`) to deduplicate page views; never transmitted, automatically discarded when the tab closes
- Both are isolated to the originating site by your browser and cannot be read by other websites

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
      ├── localStorage (routine data)
      └── IndexedDB (undo history)
```

**Your task data is not stored:**

- ❌ On any server (no backend holds your routines, tasks, cycle history, reminders, or settings)
- ❌ In any cloud
- ❌ On any other device

### Storage Limits

**Browser-imposed limits:**
- localStorage: ~5-10MB (browser-dependent)
- IndexedDB: ~50MB-unlimited (browser-dependent)

**miniCycle usage:**
- Typical: < 1MB for 10 routines with 50 tasks each
- Heavy: < 5MB for 50 routines with 100 tasks each

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
- Delete entire routines
- Factory reset (Settings → Clear All Data)

**Modify:**
- Edit any task or cycle
- Change any setting
- No restrictions

**Transfer:**
- Export → Import on another device
- Share routines with others
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

See [SECURITY.md](../security/SECURITY.md) for details.

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

**Designed with these principles in mind:**

- ✅ No personal data collected inside the app
- ✅ No personal data processing inside the app
- ✅ No data transfers of user task data
- ✅ No consent required for app usage (nothing to consent to)
- ✅ Right to erasure (you can delete anytime)
- ✅ Data portability (export feature)

### CCPA (California)

**Designed with these principles in mind:**

- ✅ No personal information collected
- ✅ No personal information sold
- ✅ No personal information shared
- ✅ No opt-out required for app usage

### Other Jurisdictions

miniCycle is designed to respect privacy laws worldwide. The app collects no personal data; the marketing pages use only anonymous, aggregate counters as described in "Analytics & Tracking" below.

---

## Changes to Privacy Policy

### How We Notify

If this policy changes, please refer to the changelog at [minicycleapp.com](https://minicycleapp.com). We will:

1. Post the change in the changelog on the product page at [minicycleapp.com](https://minicycleapp.com)
2. Update this document and the "Last Updated" date at the top of the policy
3. Document the change in the project CHANGELOG

**Material changes** (e.g., introducing analytics or any new data collection):

- Require explicit user opt-in
- Are documented in the changelog

---

## Contact

### Privacy Questions

- **Email:** [admin@sparkinCreations.com](mailto:admin@sparkinCreations.com)

### Data Requests

Since we don't collect data, we can't:
- Provide data we don't have
- Delete data we don't store
- Correct data we don't keep

**You have all your data** in your browser.

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

### Inside the App

We do not track anything inside the miniCycle app:

- ❌ Page views
- ❌ Button clicks
- ❌ Feature usage
- ❌ Time spent
- ❌ Error rates
- ❌ Device info
- ❌ IP addresses
- ❌ User agents

### On the Marketing Pages: Anonymous Click & Page-View Counting

The product page and learn-more page run a small self-hosted counter to help us understand which content engages visitors and gauge overall traffic. This is **the only place** any tracking happens.

**What is collected:**

- The visible label of any clicked button or link (e.g., "Get Started", "View on GitHub", "FAQ: Is miniCycle free?")
- A page-view event when a marketing page is loaded
- An ISO 8601 timestamp for each event, used only for aggregate trend charts (clicks per day, by hour of day) on our internal admin dashboard
- A running total count for each named event

**What is NOT collected:**

- ❌ No cookies
- ❌ No personal data — no names, emails, or identifiers
- ❌ No IP addresses are stored in our counter database
- ❌ No browser fingerprinting
- ❌ No referrer URL, geolocation, or device information
- ❌ No identifier links one event to another — events cannot be traced back to a specific visitor or session by us
- ❌ No third-party analytics, advertising, or tracking services

**Page-view deduplication:** When you load a marketing page, a per-tab flag is written to your browser's `sessionStorage` so that refreshing within the same tab doesn't double-count. The flag stays on your device, is never transmitted, and is automatically discarded when you close the tab.

**Bot filtering:** Visits and clicks from browsers that announce themselves as automated (via `navigator.webdriver`) are excluded. We do not detect all bot traffic — counts may include legitimate web crawlers and link-preview fetchers.

**Storage:** Counter data lives in Netlify Blobs on our own infrastructure. No third-party analytics services (Google Analytics, Firebase, Sentry, etc.) are involved.

**Hosting provider note:** Every website on the internet relies on a hosting provider, and as part of delivering pages they routinely process standard technical request data — this is true of any site you visit. miniCycle is no different in that respect, and we do not access or use that hosting data. The only tracking miniCycle itself performs is the anonymous click and page-view counter on the product and learn-more pages. We do not track individual visitors, build user profiles, use cookies, fingerprint browsers, or connect events to a specific person or session.

**Exception:** GitHub (if you visit our repo) has its own analytics. We don't control that.

---

## Future Plans

### Beta Features

Some new features may require limited data sharing to function. **No beta feature will transmit task data unless you are clearly told first and explicitly opt in.** This protects the core promise: your routines, tasks, and settings stay on your device by default, regardless of what's in development.

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

### Source-Available

miniCycle's source code is publicly viewable for verification and educational purposes under a proprietary license (see [LICENSE](../../../LICENSE)):

- **Code is public** - Verify our claims
- **No hidden behavior** - Audit yourself
- **Independently reviewable** - Others can inspect it

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

---

## Summary

**miniCycle is private by design:**

1. **No app data ever leaves your device** (the app makes no analytics or tracking calls)
2. **No accounts or authentication**
3. **No servers or databases for user data**
4. **No third-party tracking or advertising services**
5. **You have complete control** over your task data
6. **Marketing pages have anonymous, aggregate click & view counters** with no cookies, no IP storage, and no personal data — see "Analytics & Tracking" above

**Questions?** See the FAQ or open a GitHub Issue.

---

**Privacy Policy Version:** 2.5
**Effective Date:** October 2, 2025
**Last Updated:** May 2, 2026
**miniCycle Version:** 2.216

*Your privacy is our priority. Always has been, always will be.*
