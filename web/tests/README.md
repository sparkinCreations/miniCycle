# Testing Guide

Simple, effective testing setup for the miniCycle modularization project.

## Quick Start

```bash
# Install dependencies (when you have Node.js)
npm install --save-dev jest jest-environment-jsdom

# Replace your package.json with package-jest.json
cp package-jest.json package.json

# Run tests
npm test
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

## Structure

```
tests/
├── setup.js              # Global Jest setup
├── themeManager.test.js   # ThemeManager tests  
└── README.md             # This file
```

## Adding Tests for New Modules

1. Create `tests/[moduleName].test.js`
2. Follow the pattern in `themeManager.test.js`
3. Use `setupMiniCycleDOM()` and `createMockSchemaData()` helpers

## Coverage Goals

- **Functions**: 80%+
- **Lines**: 80%+
- **Branches**: 75%+

## Example Test Structure

```javascript
describe('ModuleName', () => {
    let module;
    
    beforeEach(() => {
        setupMiniCycleDOM();
        module = new ModuleName();
    });
    
    describe('Feature Group', () => {
        test('does something specific', () => {
            // Test implementation
        });
    });
});
```

That's it! Simple but effective for a medium project.