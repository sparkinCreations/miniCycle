# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.352+  | :white_check_mark: |
| 1.330-1.351 | :white_check_mark: |
| < 1.330 | :x: |

**Recommendation:** Always use the latest version for best security and features.

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow responsible disclosure:

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead:

1. **Email:** security@minicycle.app (if available)
2. **GitHub Security:** Use [GitHub Security Advisories](https://github.com/[your-repo]/security/advisories/new)
3. **Direct Message:** Contact maintainers privately

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

**No Server Communication:**
- ✅ No API calls
- ✅ No analytics
- ✅ No telemetry
- ✅ No third-party scripts

### Data Privacy

**What We Collect:** Nothing.
**What We Store:** Everything locally.
**What We Send:** Nothing.

miniCycle is 100% offline-capable and privacy-respecting.

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
   - miniCycle doesn't require internet (works offline)
   - No data transmitted over network
   - Safe to use on public Wi-Fi

### Import/Export Security

**Import Validation (v1.353+):**

When importing `.mcyc` files, miniCycle performs validation:

```javascript
// File size limit
maxSize: 10MB  // Prevents memory issues

// Content sanitization
sanitizeImportedData() {
  - Sanitizes all task text
  - Sanitizes cycle names
  - Sanitizes recurring template text
  - Prevents XSS via malicious imports
}

// Schema validation
- Checks for valid schemaVersion
- Validates data structure
- Safe JSON parsing
```

**Security checks on import:**
- ✅ File size limited to 10MB
- ✅ All user content sanitized for XSS
- ✅ Schema version validated
- ✅ JSON parsing protected with safeJSONParse
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

**Recommended CSP for self-hosting:**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';
```

This prevents:
- Loading external scripts
- XSS attacks
- Clickjacking
- Data exfiltration

### No eval() Usage

miniCycle **never** uses:
- `eval()`
- `Function()` constructor
- `setTimeout()`/`setInterval()` with string arguments
- `innerHTML` with unsanitized content

All code is statically analyzable and safe.

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
- [ ] Add Content Security Policy headers
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
4. Compare with [latest release](https://github.com/[your-repo]/releases)

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

**Security Policy Version:** 1.0
**Last Updated:** November 14, 2025
**miniCycle Version:** 1.356

*This security policy is a living document and will be updated as needed.*
