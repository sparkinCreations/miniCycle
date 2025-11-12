# Performance Testing Guide for miniCycle

Complete guide to testing and optimizing miniCycle's performance.

---

## 🎯 Quick Start

### 1. **Browser Performance Benchmarks** (Fastest)
```bash
npm start
# Open: http://localhost:8080/tests/module-test-suite.html
# Select: "⚡ Performance Benchmarks"
# Click: "Run Tests"
```

**What it tests:**
- Task creation/rendering speed
- localStorage read/write performance
- Array operations (filter, sort, map)
- String/HTML escaping performance
- Date calculations for recurring tasks
- Memory usage

**Thresholds:**
- ✅ Green = Passing (under threshold)
- ⚠️ Yellow = Warning (exceeds threshold)
- ❌ Red = Error

---

## 🔍 Chrome DevTools Performance Testing

### Method 1: Lighthouse (Overall Score)

1. **Start dev server**: `npm start`
2. **Open app**: http://localhost:8080/miniCycle.html
3. **Open DevTools**: Press `F12` or `Cmd+Option+I` (Mac)
4. **Go to Lighthouse tab**
5. **Select categories**: Performance + Progressive Web App
6. **Click "Analyze page load"**

**Target Scores:**
- **Performance**: 90+ (Excellent), 50-89 (Good), <50 (Needs work)
- **PWA**: 100 (All PWA requirements met)

**Key Metrics to Watch:**
- **First Contentful Paint (FCP)**: < 1.8s (Good)
- **Largest Contentful Paint (LCP)**: < 2.5s (Good)
- **Total Blocking Time (TBT)**: < 200ms (Good)
- **Cumulative Layout Shift (CLS)**: < 0.1 (Good)
- **Speed Index**: < 3.4s (Good)

### Method 2: Performance Profiler (Detailed Analysis)

1. **Open DevTools** → **Performance tab**
2. **Click Record** ⏺️
3. **Perform actions**:
   - Add 50 tasks
   - Switch cycles
   - Use undo/redo 20 times
   - Complete all tasks
4. **Stop recording** ⏹️

**What to look for:**
- **Long tasks** (>50ms) - Yellow bars in flamegraph
- **Scripting time** - Should be <30% of total
- **Layout thrashing** - Multiple consecutive layouts
- **Memory leaks** - Saw-tooth pattern in memory graph

### Method 3: Memory Profiler (Find Leaks)

1. **Open DevTools** → **Memory tab**
2. **Take heap snapshot**
3. **Use the app** (add/remove tasks, switch cycles, etc.)
4. **Take another snapshot**
5. **Compare snapshots** - Look for growing object counts

**Red flags:**
- Task objects not being garbage collected
- Event listeners accumulating
- Detached DOM nodes increasing

---

## 📊 Real-World Performance Testing

### Test with Large Datasets

```javascript
// Open browser console at http://localhost:8080/miniCycle.html

// Create 1000 tasks
const data = { cycles: { 'test-cycle': {
    name: 'Performance Test',
    tasks: Array.from({length: 1000}, (_, i) => ({
        id: `task-${i}`,
        text: `Task ${i}`,
        checked: false,
        priority: i % 3 === 0 ? 'high' : 'normal',
        createdAt: Date.now()
    })),
    cycleCount: 0
}}};

localStorage.setItem('miniCycleData', JSON.stringify(data));
location.reload();

// Measure load time
```

**Expected Results:**
- **100 tasks**: <50ms render time
- **500 tasks**: <200ms render time
- **1000 tasks**: <500ms render time

### Test Recurring Task Processing

```javascript
// Create 100 recurring tasks
const templates = {};
for (let i = 0; i < 100; i++) {
    templates[`task-${i}`] = {
        id: `task-${i}`,
        text: `Recurring task ${i}`,
        recurring: true,
        recurringSettings: {
            frequency: 'daily',
            indefinitely: true
        }
    };
}

// Measure processing time
console.time('Recurring Processing');
// ... run recurring task check
console.timeEnd('Recurring Processing');
```

**Expected**: <100ms for 100 templates

---

## 🌐 Network Performance Testing

### Throttle Network Speed

1. **DevTools** → **Network tab**
2. **Select throttling**: Fast 3G, Slow 3G, Offline
3. **Test PWA behavior**:
   - ✅ Works offline
   - ✅ Service worker caches assets
   - ✅ Shows offline indicator

### Test Service Worker Updates

```bash
# Terminal 1: Run server
npm start

# Terminal 2: Watch network
# Chrome DevTools → Application → Service Workers
# Update version.js
# Reload page
# Verify new service worker activates
```

---

## 🎯 Performance Optimization Checklist

### If Performance is Slow:

#### **Rendering Issues** (FCP, LCP slow)
- [ ] Check if miniCycle-styles.css is minified
- [ ] Verify images are optimized (favicon, logos)
- [ ] Test with smaller task lists first
- [ ] Check for CSS animations causing reflows

#### **JavaScript Execution** (TBT, Speed Index slow)
- [ ] Profile with DevTools Performance tab
- [ ] Look for long-running functions (>50ms)
- [ ] Check if undo/redo snapshots are throttled properly
- [ ] Verify recurring task watch function isn't running too frequently

#### **Memory Issues** (Crashes, slowdowns over time)
- [ ] Take heap snapshots before/after operations
- [ ] Check for event listener leaks
- [ ] Verify localStorage isn't exceeding limits (5-10MB)
- [ ] Test undo/redo cleanup (old snapshots deleted)

#### **localStorage Performance**
- [ ] Batch writes instead of saving on every change
- [ ] Consider IndexedDB for large datasets (>5MB)
- [ ] Compress data before storing (if needed)

---

## 📈 Continuous Performance Monitoring

### Add to CI/CD (GitHub Actions)

Your existing `.github/workflows/test.yml` could be extended:

```yaml
- name: Run Performance Benchmarks
  run: |
    npm start &
    sleep 3
    npm run test:performance
```

### Track Performance Over Time

Use Lighthouse CI for regression testing:
```bash
npm install -g @lhci/cli
lhci autorun --config=lighthouserc.json
```

---

## 🚀 Performance Best Practices

### Current Architecture Strengths
✅ **Modular design** (33 modules) - Code splitting ready
✅ **Lazy loading** with dynamic imports
✅ **Throttled operations** (undo snapshots, recurring checks)
✅ **IndexedDB for undo/redo** - Keeps memory low
✅ **Service worker caching** - Fast offline loading

### Recommended Limits
- **Tasks per cycle**: <500 (optimal), <1000 (acceptable)
- **Undo history**: 20 snapshots (current limit)
- **Recurring templates**: <100 per cycle
- **localStorage size**: <5MB total

### When to Optimize
- **Only if needed**: Don't optimize prematurely
- **Measure first**: Use profiler to find actual bottlenecks
- **Test on real devices**: iPad/iPhone performance matters
- **Monitor over time**: Check after major feature additions

---

## 🛠️ Tools Summary

| Tool | Use Case | How to Access |
|------|----------|--------------|
| **Performance Benchmarks** | Quick operation timing | `tests/module-test-suite.html` |
| **Lighthouse** | Overall score + metrics | Chrome DevTools → Lighthouse |
| **Performance Profiler** | Find slow functions | DevTools → Performance |
| **Memory Profiler** | Find memory leaks | DevTools → Memory |
| **Network Throttling** | Test slow connections | DevTools → Network |
| **Service Worker** | Test PWA caching | DevTools → Application |

---

## 🎓 Learn More

- [Web Vitals](https://web.dev/vitals/) - Core metrics explained
- [Chrome DevTools Docs](https://developer.chrome.com/docs/devtools/) - Complete guide
- [Lighthouse Scoring](https://web.dev/performance-scoring/) - How scores calculated
- [JavaScript Profiling](https://developer.chrome.com/docs/devtools/performance/) - Find bottlenecks

---

**Current Status**: miniCycle passes 1011/1011 tests (100%) ✅

*Last updated: 2025-11-12*
