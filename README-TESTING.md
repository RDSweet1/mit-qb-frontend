# Testing Setup Guide

## Playwright Automated Tests

The test suite is ready, but requires Playwright to be installed locally.

### Installation:

```bash
cd frontend

# Install all dependencies including Playwright
npm install

# Install Playwright browsers
npx playwright install chromium

# Verify installation
npx playwright --version
```

### Running Tests:

```bash
# Run all tests in headless mode
npx playwright test

# Run tests with UI (interactive mode)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/login.spec.ts

# Generate HTML report
npx playwright show-report
```

### Available Tests:

1. **Login Flow Test** (`tests/login.spec.ts`)
   - Verifies login button is visible
   - Tests Microsoft login popup behavior
   - Captures screenshots on failure
   - Detects console errors

2. **Console Error Check**
   - Monitors for JavaScript errors
   - Logs all console output
   - Screenshots on errors

### Test Configuration:

- **Base URL:** `https://rdsweet1.github.io/mit-qb-frontend/`
- **Browser:** Chromium (Chrome)
- **Screenshots:** Enabled on failure
- **Videos:** Retained on failure
- **Reports:** HTML format

### Local Development Testing:

To test against localhost instead of production:

```bash
# Set environment variable
export TEST_LOCAL=true

# Run dev server
npm run dev

# Run tests (will use http://localhost:3000)
npx playwright test
```

### Troubleshooting:

**If npm install fails:**
```bash
# Try with --legacy-peer-deps
npm install --legacy-peer-deps

# Or use yarn
yarn install
yarn playwright install
```

**If tests fail to run:**
```bash
# Reinstall Playwright browsers
npx playwright install --force chromium
```

**If you see "command not found":**
```bash
# Use npx to run Playwright
npx playwright test
```

### Manual Testing (No Installation Required):

See `TEST-LOGIN-MANUAL.md` for step-by-step manual testing procedures.

### CI/CD Integration:

The Playwright tests can be integrated into GitHub Actions for automated testing on every deployment. Example workflow:

```yaml
- name: Install dependencies
  run: npm install

- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run tests
  run: npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### Next Steps:

1. Configure Azure Portal redirect URI (see `AZURE-REDIRECT-SETUP.md`)
2. Test login manually (see `TEST-LOGIN-MANUAL.md`)
3. Once login works, run automated tests to verify
4. Expand test suite for time entries and report generation
