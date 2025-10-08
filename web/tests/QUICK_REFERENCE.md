# Test Suite Quick Reference Card

**Keep this handy when writing tests! 🚀**

## 📋 Adding a New Module (4 Steps)

### 1️⃣ Create Test File

```javascript
// tests/yourModule.tests.js
export function runYourModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 YourModule Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    function test(name, testFn) {
        total.count++;
        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // YOUR TESTS HERE
    resultsDiv.innerHTML += '<h4>🔧 Tests</h4>';
    test('module loads', () => {
        if (typeof YourModule === 'undefined') {
            throw new Error('Module not found');
        }
    });

    // SUMMARY
    const pct = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>${passed.count}/${total.count} passed (${pct}%)</h3>`;
}
```

### 2️⃣ Add to HTML Dropdown

```html
<select id="module-select">
    <option value="yourModule">YourModule</option> <!-- ADD THIS -->
</select>
```

### 3️⃣ Add Import

```javascript
import { runYourModuleTests } from './yourModule.tests.js';
```

### 4️⃣ Add Loading & Running Logic

```javascript
// In moduleSelect listener
else if (moduleName === 'yourModule') {
    await import('../utilities/yourModule.js');
    currentModule = 'yourModule';
    resultsDiv.innerHTML = '<p>✅ YourModule loaded.</p>';
}

// In runTestsBtn listener
else if (currentModule === 'yourModule') {
    runYourModuleTests(resultsDiv);
}
```

---

## 🧪 Test Pattern Cheat Sheet

### Static Utility ⚡

```javascript
test('pure function works', () => {
    const result = YourModule.pureFunction(input);
    if (result !== expected) throw new Error('Failed');
});
```

### Simple Instance 🎯

```javascript
test('instance creates', () => {
    const instance = new YourModule();
    if (!instance) throw new Error('Failed to create');
});
```

### Resilient Constructor 🛡️

```javascript
test('works without dependencies', () => {
    const instance = new YourModule(); // Uses fallbacks
    if (!instance) throw new Error('Should use fallbacks');
});
```

### Strict Injection 🔧

```javascript
test('requires dependencies', () => {
    let threw = false;
    try { processData(); }
    catch (e) { threw = true; }
    if (!threw) throw new Error('Should throw without deps');
});
```

---

## ✅ Common Test Patterns

### DOM Manipulation

```javascript
test('adds class', () => {
    const el = document.getElementById('test-element');
    el.className = '';
    YourModule.addClass(el, 'new-class');
    if (!el.classList.contains('new-class')) throw new Error('Class not added');
});
```

### Event Listeners

```javascript
test('event fires', () => {
    const el = document.getElementById('test-element');
    let called = false;
    YourModule.addEventListener(el, 'click', () => { called = true; });
    el.click();
    if (!called) throw new Error('Not called');
});
```

### localStorage

```javascript
test('saves data', () => {
    YourModule.save({ key: 'value' });
    const saved = JSON.parse(localStorage.getItem('yourKey'));
    if (saved.key !== 'value') throw new Error('Not saved');
});

test('loads data', () => {
    localStorage.setItem('yourKey', JSON.stringify({ key: 'value' }));
    const loaded = YourModule.load();
    if (loaded.key !== 'value') throw new Error('Not loaded');
});
```

### Error Handling

```javascript
test('handles null', () => {
    const result = YourModule.process(null);
    if (result === undefined) throw new Error('Should return null/default');
});
```

### Multiple Scenarios

```javascript
[
    { input: 'valid', expected: true },
    { input: '', expected: false },
    { input: null, expected: false }
].forEach(({ input, expected }) => {
    test(`handles ${input}`, () => {
        const result = YourModule.validate(input);
        if (result !== expected) throw new Error(`Expected ${expected}`);
    });
});
```

---

## 🎨 Section Headers

```javascript
resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';
resultsDiv.innerHTML += '<h4 class="test-section">✨ Features</h4>';
resultsDiv.innerHTML += '<h4 class="test-section">👂 Events</h4>';
resultsDiv.innerHTML += '<h4 class="test-section">💾 Storage</h4>';
resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Errors</h4>';
```

---

## 🐛 Debugging Tricks

### Console Logging

```javascript
test('debug test', () => {
    const result = YourModule.process(input);
    console.log('Input:', input);
    console.log('Result:', result);
    if (!result) throw new Error('Failed');
});
```

### Test in Console

```javascript
// Browser console
await import('./utilities/yourModule.js');
YourModule.yourFunction();
```

### Check Exports

```javascript
test('exports correct', () => {
    console.log('Exports:', Object.keys(window).filter(k => k.includes('Your')));
    if (typeof window.yourFunction !== 'function') {
        throw new Error('Not exported');
    }
});
```

---

## ⚡ Best Practices

✅ **DO:**
- Use descriptive test names
- Test one thing per test
- Clean up after tests
- Test edge cases (null, undefined, empty)
- Use clear error messages

❌ **DON'T:**
- Test multiple things in one test
- Use vague error messages
- Skip cleanup
- Only test happy path

---

## 📊 Coverage Targets

| Pattern | Target |
|---------|--------|
| ⚡ Static Utility | 90%+ |
| 🎯 Simple Instance | 85%+ |
| 🛡️ Resilient | 80%+ |
| 🔧 Strict Injection | 85%+ |

---

## 🚀 Quick Commands

```bash
# Open test suite
cd tests && open module-test-suite.html

# Or serve
python3 -m http.server 8080
# Visit: http://localhost:8080/tests/module-test-suite.html
```

---

## 💡 Remember

1. **Keep it simple** - Each test should be easy to understand
2. **Be specific** - Clear names and error messages
3. **Test edges** - null, undefined, empty, missing
4. **Organize** - Group related tests with section headers
5. **Clean up** - Reset state between tests

---

**Full docs:** [TESTING_GUIDE.md](./TESTING_GUIDE.md)
