# Playwright E2E Test Automation

End-to-end automation script using Playwright, TypeScript, and pnpm for testing client data loading across multiple clients.

## Overview

This project automates the testing of a web application that:
- Requires authentication (email + password)
- Allows switching between ~1,000 clients via a dropdown/select component
- Loads client-specific data via API after client selection

The test suite:
- Logs in once
- Iterates through all clients
- Validates data loading for each client
- Captures screenshots on failures
- Generates JSON and CSV failure reports

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **pnpm** (package manager)
- **Playwright browsers** (installed automatically)

## Installation

### Step 1: Install Dependencies

```powershell
cd "c:\Users\bb\Documents\autodoc2\test playwright"
pnpm install
```

### Step 2: Install Playwright Browsers

Install all browsers:
```powershell
pnpm exec playwright install
```

Or install only Chromium (faster, recommended):
```powershell
pnpm exec playwright install chromium
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
BASE_URL=https://your-app.example.com
TEST_USERNAME=your-email@example.com
TEST_PASSWORD=your-password
```

**Note:** The `.env` file is already configured to load automatically via `dotenv` in `playwright.config.ts`.

### Alternative: Set Environment Variables Manually (PowerShell)

```powershell
$env:BASE_URL = "https://your-app.example.com"
$env:TEST_USERNAME = "your-email@example.com"
$env:TEST_PASSWORD = "your-password"
```

### Client List

Edit `data/clients.json` to include all client identifiers:

```json
[
  "3P INSTALAÇOES",
  "A.C. CAMARGO",
  "Autodoc NextGen"
]
```

Add all ~1,000 clients to this array.

## Running Tests

### Run tests in headless mode:
```powershell
pnpm test:e2e
```

### Run tests with browser visible (headed):
```powershell
pnpm test:e2e:headed
```

### Run tests with Playwright UI (recommended for debugging):
```powershell
pnpm test:e2e:ui
```

## Project Structure

```
.
├── data/
│   └── clients.json              # List of client identifiers
├── tests/
│   └── client-data.e2e.spec.ts   # Main test file
├── .env                          # Environment variables (not committed)
├── playwright.config.ts          # Playwright configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
```

## Test Output

### Screenshots
Failed client screenshots are saved to:
```
test-results/client-screenshots/client-{client-id}.png
```

### Failure Reports
After test completion, failure reports are generated in:
- **JSON**: `test-results/client-load-failures.json`
- **CSV**: `test-results/client-load-failures.csv`

Both files contain:
- `clientId`: The client identifier that failed
- `reason`: Error message explaining the failure
- `screenshotPath`: Path to the screenshot

## Troubleshooting

### Issue: `'playwright' is not recognized`

**Solution:** Install dependencies and browsers:
```powershell
pnpm install
pnpm exec playwright install chromium
```

### Issue: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`

**Solution 1:** Clean install:
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item pnpm-lock.yaml -ErrorAction SilentlyContinue
pnpm install
```

**Solution 2:** Set CI environment variable:
```powershell
$env:CI = "true"
pnpm install
```

### Issue: Test fails to find selectors

**Solution:** Update selectors in `tests/client-data.e2e.spec.ts`:
- Inspect your app's HTML elements in DevTools (F12)
- Update the `SELECTORS` object with correct selectors:
  - `login.emailInput`: Email input selector
  - `login.emailContinueButton`: Continue button after email
  - `login.passwordInput`: Password input selector
  - `login.submitButton`: Final login submit button
  - `login.postLoginGuard`: Element that appears after successful login
  - `clientSelector.*`: Client dropdown selectors
  - `clientDataContainer`: Container showing loaded client data

### Issue: Test times out waiting for elements

**Solution:** Adjust timeouts in `tests/client-data.e2e.spec.ts`:
```typescript
const LOGIN_TIMEOUT_MS = 30_000;        // Increase if needed
const CLIENT_LOAD_TIMEOUT_MS = 25_000;  // Increase if needed
```

Or in `playwright.config.ts`:
```typescript
const ACTION_TIMEOUT_MS = 15_000;        // Individual action timeout
const NAVIGATION_TIMEOUT_MS = 30_000;    // Navigation timeout
```

## Customization

### Updating Selectors

All selectors are centralized in the `SELECTORS` object at the top of `tests/client-data.e2e.spec.ts`. Update them to match your application's HTML structure.

### API Endpoint

Update `CLIENT_DATA_API_PARTIAL_URL` in `tests/client-data.e2e.spec.ts` to match your actual API endpoint pattern.

### Timeouts

Adjust timeouts based on your application's performance:
- Fast apps: Reduce timeouts
- Slow apps: Increase timeouts

## Best Practices

1. **Never commit `.env` file** - Add it to `.gitignore`
2. **Use stable selectors** - Prefer `id` or `data-testid` over CSS classes
3. **Test incrementally** - Start with a few clients, then scale up
4. **Review failure reports** - Check JSON/CSV reports to identify patterns
5. **Use headed mode for debugging** - Run `pnpm test:e2e:headed` to see what's happening

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm test:e2e` | Run tests in headless mode |
| `pnpm test:e2e:headed` | Run tests with visible browser |
| `pnpm test:e2e:ui` | Run tests with Playwright UI (interactive) |

## License

Private project - Internal use only.
