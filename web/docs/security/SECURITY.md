# Security Policy

## Supported Versions

We support the **latest release only**. Security fixes are applied to the current version - we do not backport to older releases.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x: |

**Recommendation:** Always update to the latest version for security fixes and features.

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow responsible disclosure:

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead:

1. **Email:** security@sparkincreations.com
2. **Direct Message:** Contact maintainers privately via GitHub

### What to Include

Please provide:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Affected versions**
- **Potential impact** (data exposure, XSS, etc.)
- **Suggested fix** (if you have one)
- **Your contact info** for follow-up

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 7 days
- **Fix Timeline:** Critical issues within 14 days
- **Public Disclosure:** After fix is deployed (coordinated with you)
- **Credit:** We'll credit you in release notes (if desired)

---

## Security Architecture

### Data Storage

miniCycle uses **client-side only** storage:

**localStorage:**
- Stores cycle data, tasks, settings
- Never transmitted to servers
- Accessible only to miniCycle origin
- **Risk:** Physical device access

**IndexedDB:**
- Stores undo/redo history
- Persists across sessions
- Isolated per-origin
- **Risk:** Physical device access

**Minimal Network Communication:**
- ✅ No analytics or telemetry
- ✅ No third-party scripts loaded
- ⚠️ **Exception:** Feedback form uses [Web3Forms API](https://web3forms.com) to send user-submitted feedback
  - Only triggered when user explicitly submits the feedback form
  - Sends: user email (optional), message text, timestamp
  - No automatic data collection

### Data Privacy

**Automatic Collection:** None. No tracking, analytics, or telemetry.
**Data Storage:** All routine/task data stored locally in browser (localStorage/IndexedDB).
**Network Transmission:** Only via explicit user action (feedback form submission).

miniCycle is fully offline-capable. Network access is only used for the optional feedback feature.

---

## Known Security Considerations

### Browser-Level Security

**1. Physical Device Access**
- Anyone with access to your unlocked device can access miniCycle data
- **Mitigation:** Lock your device when not in use

**2. Browser Extensions**
- Malicious extensions can access localStorage/IndexedDB
- **Mitigation:** Only install trusted extensions

**3. Browser Developer Tools**
- Anyone with physical access can view data via DevTools
- **Mitigation:** Lock device when away

**4. Cross-Site Scripting (XSS)**
- We sanitize all user input
- HTML escaped in task text, notifications, onboarding themes
- **Risk Level:** Low (active protection in place)

### PWA-Specific Security

**Service Worker:**
- Caches files for offline use
- Uses versioned cache keys
- No sensitive data in cache (only code)
- **Risk:** Stale cache serving old code (mitigated via version checks)

**Installation:**
- PWA requires HTTPS (enforced by browsers)
- Can't install from insecure origins
- **Risk Level:** Low

---

## Security Best Practices for Users

### Data Protection

1. **Regular Backups**
   - Export cycles regularly (Menu → Settings → Export)
   - Store `.mcyc` files in secure location
   - Consider encrypting backup files

2. **Device Security**
   - Use device lock (PIN, password, biometric)
   - Enable automatic device lock
   - Keep OS and browser updated

3. **Browser Security**
   - Use latest browser version
   - Enable automatic updates
   - Use reputable browser (Chrome, Firefox, Safari)

4. **Network Security**
   - miniCycle works fully offline
   - Only network use: optional feedback form (user-initiated)
   - Safe to use on public Wi-Fi

### Import/Export Security

**Cycle Import (.mcyc files) - `modules/ui/cycleImportManager.js`:**

When importing `.mcyc` cycle files:

| Check | Implementation |
|-------|----------------|
| File size | 10MB limit via `MAX_FILE_SIZE_BYTES` |
| Task count | 250 max via `MAX_TASK_COUNT` |
| Task text | Sanitized via `fallbackSanitize()` (100 chars default) |
| Cycle name | Sanitized via `fallbackSanitize()` (100 chars) |
| Recurring templates | Imported and merged from file data; task text is sanitized |
| JSON parsing | Standard `JSON.parse()` with try-catch |

**Backup Restore (full app data) - `modules/testing/testing-modal.js`:**

When restoring full backups (via Developer Tools):
- Uses `safeJSONParse()` for protected parsing
- Validates schema structure before applying
- User must explicitly confirm restore action

**Security checks on import:**
- ✅ File size limited (10MB for cycles)
- ✅ All user content sanitized for XSS
- ✅ Task/name length limits enforced
- ✅ Invalid files rejected with error message

### When Sharing Data

**If exporting/sharing .mcyc files:**

1. **Review contents** - `.mcyc` files are plain JSON
   - May contain sensitive task names
   - Could reveal routines/habits
   - Consider sanitizing before sharing

2. **Secure transfer** - If emailing/uploading:
   - Use encrypted email
   - Avoid public file sharing links
   - Delete after recipient downloads

3. **Sharing with team:**
   - Only share cycles meant for collaboration
   - Remove personal tasks first
   - Consider separate work/personal cycles

4. **Receiving .mcyc files:**
   - Only import from trusted sources
   - Review file contents before import (plain JSON)
   - 10MB size limit protects against memory issues
   - All content automatically sanitized on import

---

## Security Features

### Input Sanitization

**v1.352+ includes:**

```javascript
// All user input is escaped before rendering
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
```

**Applied to:**
- Task text
- Cycle names
- Notification messages
- Onboarding theme names
- All user-generated content

**Input Length Limits:**
```javascript
sanitizeInput(input, maxLength = 100)
```
- Default 100-character limit for most inputs
- Configurable per use case
- Prevents UI/performance issues (not a security feature)
- Used in 11+ locations across codebase

### Content Security Policy

**Implemented CSP (v1.569+):**

miniCycle includes a Content Security Policy via meta tag in `miniCycle.html` and HTTP headers in `netlify.toml`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
  img-src 'self' data: blob:;
  connect-src 'self' https://api.web3forms.com;
  form-action 'self' https://api.web3forms.com;
  base-uri 'self';
```

**What each directive allows:**

| Directive | Allows | Why |
|-----------|--------|-----|
| `script-src 'self' 'unsafe-inline'` | Local scripts + inline scripts | Feature detection needs inline script |
| `style-src ...` | Local + Google Fonts + Font Awesome | External stylesheets |
| `font-src ...` | Google Fonts + Font Awesome CDN | Font files |
| `img-src 'self' data: blob:` | Local + data URLs + blobs | Logos, generated images |
| `connect-src ...` | Local + Web3Forms API | Feedback form submission |
| `form-action ...` | Local + Web3Forms | Form POST targets |
| `base-uri 'self'` | Only local base URLs | Prevents base tag injection |

**This prevents:**
- Loading external scripts from untrusted sources
- XSS attacks via injected scripts
- Data exfiltration to unauthorized endpoints
- Base tag injection attacks

**Note:** `frame-ancestors` (clickjacking protection) is set via HTTP header in `netlify.toml` since it cannot be set via meta tags.

### No eval() Usage

miniCycle **never** uses:
- `eval()`
- `Function()` constructor
- `setTimeout()`/`setInterval()` with string arguments
- `innerHTML` with unsanitized content

All code is statically analyzable and safe.

### Developer Security Rules

When contributing to miniCycle, follow these security practices:

**DOM Manipulation:**
- Always use `textContent` for user-provided text (auto-escapes HTML)
- Never use `innerHTML` with unsanitized user input
- Sanitize values before using in class names or attributes: `value.replace(/[^a-zA-Z0-9-_]/g, '')`

**Data Handling:**
- Use `safeJSONParse()` and `safeJSONStringify()` for JSON operations
- Use `safeLocalStorageGet/Set/Remove()` for storage operations
- Validate imported data before using (check types, lengths, structure)

**External Data:**
- All imported .mcyc file content must be sanitized via `fallbackSanitize()` or `DataValidator`
- Never trust imported data - treat as untrusted input
- Apply length limits to prevent DoS (10MB file, 250 tasks, 500 char text)

**CSP Compliance:**
- Don't add external script sources without updating CSP
- Don't use `eval()`, `Function()`, or string-based `setTimeout/setInterval`
- Keep inline scripts minimal (currently needed for feature detection only)

See [SECURITY_GUIDE.md](../developer-guides/SECURITY_GUIDE.md) for detailed patterns and examples.

### Error Handling & Resilience

**v1.355+ includes comprehensive error handling:**

**Global Error Handlers:**
- `window.onerror` - Catches all synchronous errors
- `unhandledrejection` - Catches all promise rejections
- Prevents app crashes from unexpected errors
- User-friendly error notifications with recovery suggestions

**Safe Utility Functions:**
```javascript
// Protected localStorage operations
safeLocalStorageGet(key, defaultValue)
safeLocalStorageSet(key, value)
safeLocalStorageRemove(key)

// Protected JSON operations
safeJSONParse(jsonString, defaultValue)
safeJSONStringify(data, defaultValue)
```

**What This Protects Against:**
- Storage quota exceeded errors
- Corrupted localStorage data
- Invalid JSON data
- Circular reference errors
- Browser storage unavailable (private browsing)
- Unexpected runtime exceptions

**Security Benefits:**
- Prevents data loss from errors
- Graceful degradation under failure conditions
- No silent failures that could mask security issues
- Error logging for debugging (last 50 errors)
- Spam prevention (max 10 error notifications)

**Test Coverage:**
- 34 error handler tests
- 25 XSS vulnerability tests
- 59 total security & error handling tests
- 100% pass rate

For details, see [Error Handling Documentation](ERROR_HANDLING_AND_TESTING_SUMMARY.md).

---

## Vulnerability History

### v1.569 (2025-12-27)

**Content Security Policy Implementation:**
- Added CSP meta tag to `miniCycle.html`
- Added CSP HTTP headers to `netlify.toml`
- Configured to allow: self-hosted scripts, Google Fonts, Font Awesome, Web3Forms feedback
- Added `frame-ancestors: 'none'` via HTTP header (clickjacking protection)
- Added `base-uri 'self'` (base tag injection protection)
- **Impact:** Defense in depth against XSS, script injection, clickjacking
- **Severity:** Enhancement (proactive security hardening)

**Schema Normalization:**
- Fixed `dueDate` validator to accept ISO date strings (YYYY-MM-DD) from HTML inputs
- Fixed reminders read/write location mismatch in `dataAccess.js`
- Updated schema documentation in `SCHEMA_2_5.md`
- **Impact:** Data consistency, prevents validation errors
- **Severity:** Low (bug fix)

**Recurring Template Sanitization:**
- Fixed `.mcyc` import to reject imported `recurringTemplates` in favor of templates generated from sanitized task text
- Previously, imported files could supply `recurringTemplates` with unsanitized text, bypassing XSS protection
- Now all recurring template text derives from already-sanitized task text
- **Impact:** Closes XSS vector via malicious .mcyc files
- **Severity:** Medium (security fix)

### v1.357 (2025-11-14)

**Namespace Pollution Fix (Phase 1):**
- Created unified `window.miniCycle.*` API to replace 163 global variables
- Added comprehensive namespace architecture documentation
- Implemented 75 namespace API tests
- Added deprecation warnings for old global API
- Full backward compatibility maintained
- **Impact:** Improved code organization, reduced global namespace pollution
- **Severity:** Low (architectural improvement, no security impact)
- **Reporter:** Internal code quality audit
- **Note:** This namespace approach was later reverted (Nov 2025) as it reorganized globals without eliminating them. See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for the actual solution.

### v1.356 (2025-11-14)

**Mini Games & Documentation:**
- Added mini games (Task Whack-a-Task, Task Whack-a-Order, Task Name Scramble)
- Enhanced Undo/Redo architecture documentation
- Performance testing framework and benchmarks
- **Impact:** Feature additions, no security changes
- **Severity:** N/A (feature release)

### v1.355 (2025-11-14)

**Error Handling & Resilience Enhancement:**
- Added global error handlers (window.onerror, unhandledrejection)
- Implemented safe utility functions for localStorage and JSON operations
- Protected 50+ unprotected localStorage operations
- Protected 23+ unprotected JSON.parse operations
- Added comprehensive error handling tests (34 tests)
- **Impact:** Prevents data loss, improves stability, prevents silent failures
- **Severity:** Medium (security hardening, no known exploitation)
- **Reporter:** Internal security audit

### v1.353 (2025-11-13)

**Import Validation & XSS Prevention:**
- Added 10MB file size limit for imports
- Implemented `sanitizeImportedData()` function
- Sanitizes all user content in imported .mcyc files
- Schema validation on import
- Protected JSON parsing with safeJSONParse
- **Impact:** Prevents XSS via malicious .mcyc files, prevents memory issues
- **Severity:** Medium (defense in depth)
- **Reporter:** Internal security audit

### v1.352 (2025-11-13)

**XSS Prevention Enhancement:**
- Added HTML escaping to task text rendering
- Sanitized notification messages
- Escaped onboarding theme names
- **Impact:** Prevented potential stored XSS
- **Severity:** Medium (no known exploitation)
- **Reporter:** Internal security audit

### v1.330 (2025-01)

**Service Worker Cache Bypass:**
- Added version-based cache keys
- Implemented cache invalidation on version change
- **Impact:** Prevented serving stale code
- **Severity:** Low (non-security bug)

### Prior Versions

No known security vulnerabilities reported.

---

## Security Roadmap

### Planned Improvements

**Short-term (next 3 months):**
- [x] Add Content Security Policy headers ✅ (v1.569)
- [ ] Implement Subresource Integrity (SRI)
- [ ] Add security.txt file
- [ ] Automated security scanning in CI/CD

**Medium-term (next 6 months):**
- [ ] Optional data encryption at rest (user-provided password)
- [ ] Audit logging for data export/import
- [ ] Security headers best practices
- [ ] Penetration testing

**Long-term (next 12 months):**
- [ ] End-to-end encryption for cloud sync (if implemented)
- [ ] Two-factor authentication (if accounts added)
- [ ] Security certification (if applicable)

---

## Security Contacts

### Reporting Security Issues

- **Email:** security@minicycle.app (if available)
- **GitHub:** Security Advisories (preferred)
- **Response Time:** 48 hours

### Security Team

- Lead: (maintainer name/GitHub handle)
- Contact: (email/GitHub)

---

## Security Acknowledgments

We'd like to thank the following individuals for responsibly disclosing security issues:

- (List will be populated as reports come in)

---

## Compliance & Standards

### Web Security Standards

miniCycle follows:
- ✅ OWASP Top 10 guidelines
- ✅ CWE/SANS Top 25
- ✅ Mozilla Web Security Guidelines
- ✅ W3C Security and Privacy Questionnaire

### Privacy Regulations

**GDPR Compliance:**
- ✅ No personal data collected
- ✅ No data processing
- ✅ No data transfers
- ✅ User has full control (export/delete)

**CCPA Compliance:**
- ✅ No data sale (nothing to sell)
- ✅ No data sharing
- ✅ Full user control

---

## Legal & Liability

### Disclaimer

miniCycle is provided "as is" without warranty of any kind. Users are responsible for:
- Backing up their own data
- Securing their devices
- Protecting sensitive information

### Data Loss

While we implement data integrity measures:
- Always maintain backups
- Test restore procedures
- Don't rely solely on browser storage

### Third-Party Security

If self-hosting or modifying miniCycle:
- You are responsible for security
- Review all code changes
- Keep dependencies updated
- Follow security best practices

---

## Updates & Notifications

### Security Updates

**How we notify:**
1. GitHub Security Advisories
2. Release notes (CHANGELOG.md)
3. GitHub Releases
4. (Email list if implemented)

**Update frequency:**
- Critical: Immediate (within hours)
- High: 1-7 days
- Medium: Next release
- Low: Scheduled release

### Checking Your Version

1. Open miniCycle
2. Menu → Settings → About
3. Version shown at bottom
4. Compare with latest version at [minicycleapp.com](https://minicycleapp.com)

---

## Resources

### Security Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Mozilla Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Web Security Cheat Sheet](https://cheatsheetseries.owasp.org/)

### Reporting Tools

- [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories)
- [HackerOne](https://www.hackerone.com/) (if using bug bounty)

---

**Security Policy Version:** 1.1
**Last Updated:** December 27, 2025
**miniCycle Version:** 1.569

*This security policy is a living document and will be updated as needed.*
