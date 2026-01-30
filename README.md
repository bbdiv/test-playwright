# Playwright E2E Test Automation

End-to-end automation script using Playwright, TypeScript, and pnpm for testing client data loading across multiple clients.

## Overview

This project automates the testing of a web application that:

- Requires authentication (email + password)
- Allows switching between ~1,000 clients via a dropdown/select component
- Loads client-specific data via API after client selection

The test suite:

- Logs in once
- Iterates through selected customers
- Validates data loading after selection

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **pnpm** (package manager)
- **Playwright browsers** (installed automatically)

## Installation

### Step 1: Install Dependencies

```powershell
cd "<path-to-this-repo>"
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

### Customer Selection

The current test selects customers returned from the `/customers` API response (see `tests/client-data.e2e.spec.ts`).

## Running Tests

Playwright runs your browser automation tests for you. These commands launch Playwright Test with different UX options.

### Run all tests (E2E + unit):

```powershell
pnpm test:e2e
```

### Run specific test types:

```powershell
# Run only unit tests (fast, ~1 second)
pnpm test:e2e --grep "unit.spec"

# Run only smoke test (quick validation, ~25 seconds)
pnpm test:e2e smoke.e2e.spec.ts

# Run full load test (all customers, ~45 minutes)
pnpm test:e2e client-data-load.e2e.spec.ts
```

### Run tests with browser visible (headed, useful to watch what happens):

```powershell
pnpm test:e2e:headed
```

### Run tests with Playwright UI (interactive runner for debugging/inspecting steps):

```powershell
pnpm test:e2e:ui
```

### Run linting and formatting:

```powershell
# Check code quality
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format all files
pnpm format

# Check formatting
pnpm format:check
```

## Project Structure

```
.
├── tests/
│   ├── e2e/                            # End-to-end tests
│   │   ├── client-data-load.e2e.spec.ts  # Full load test (~45min)
│   │   └── smoke.e2e.spec.ts             # Quick smoke test (~25s)
│   ├── unit/                           # Unit tests (fast)
│   │   ├── customer.helper.unit.spec.ts  # Customer helper tests
│   │   └── reporting.helper.unit.spec.ts # Reporting helper tests
│   ├── integration/                    # Integration tests (TBD)
│   ├── helpers/                        # Reusable helper functions
│   │   ├── auth.helper.ts                # Authentication (login)
│   │   ├── customer.helper.ts            # Customer selection & data loading
│   │   └── reporting.helper.ts           # Report generation
│   ├── pages/                          # Page object models (TBD)
│   ├── fixtures/                       # Test fixtures (TBD)
│   └── config/                         # Test configuration
│       └── selectors.ts                  # Centralized selectors
├── types/
│   └── customer.ts                     # TypeScript types
├── .env                                # Environment variables (not committed)
├── playwright.config.ts                # Playwright configuration
├── eslint.config.js                    # ESLint configuration
├── .prettierrc.json                    # Prettier configuration
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Dependencies and scripts
└── README.md                           # This file
```

## Testing Strategy

This project follows a test pyramid approach:

### Unit Tests (`tests/unit/`)

- **Purpose:** Test helper functions in isolation
- **Speed:** Very fast (~1 second for all unit tests)
- **When to run:** Always, on every code change
- **Examples:**
  - `customer.helper.unit.spec.ts`: Tests customer filtering logic
  - `reporting.helper.unit.spec.ts`: Tests report generation

### Integration Tests (`tests/integration/`) - Coming Soon

- **Purpose:** Test feature flows without full E2E overhead
- **Speed:** Medium (~30 seconds per test)
- **When to run:** Before commits, in CI

### End-to-End Tests (`tests/e2e/`)

- **Smoke Test (`smoke.e2e.spec.ts`):**
  - **Purpose:** Quick validation that core flow works
  - **Speed:** Fast (~25 seconds)
  - **When to run:** Before deployments, after major changes
- **Load Test (`client-data-load.e2e.spec.ts`):**
  - **Purpose:** Test all customers, measure performance
  - **Speed:** Slow (~45 minutes for 1000 customers)
  - **When to run:** Nightly, before major releases

### Recommended Workflow

1. **During development:** Run unit tests continuously
2. **Before commit:** Run smoke test + unit tests
3. **Before deployment:** Run full test suite
4. **Scheduled:** Run load test nightly

## Test Output

Playwright outputs traces/reports according to `playwright.config.ts`.

- **HTML Report:** `playwright-report/` (after test run)
- **Test Results:** `test-results/` (screenshots, traces, custom reports)
- **Customer Load Reports:** `test-results/customer-load-report-*.json`

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

**Solution:** Update selectors in `tests/config/selectors.ts`:

- Inspect your app's HTML elements in DevTools (F12)
- Update the `SELECTORS` object with correct selectors:
  - `login.emailInput`: Email input selector
  - `login.emailContinueButton`: Continue button after email
  - `login.passwordInput`: Password input selector
  - `login.submitButton`: Final login submit button
  - `login.postLoginTopbar`: Element that appears after successful login
  - `customerSelector.*`: Customer dropdown selectors
  - `customerDataTable`: Data rows selector

### Issue: Test times out waiting for elements

**Solution:** Adjust timeouts:

- **Helper-level timeouts:** In `tests/helpers/auth.helper.ts` or `tests/helpers/customer.helper.ts`

  ```typescript
  const LOGIN_TIMEOUT_MS = 30_000; // Increase if needed
  const CLIENT_LOAD_TIMEOUT_MS = 25_000; // Increase if needed
  ```

- **Global timeouts:** In `playwright.config.ts`
  ```typescript
  const ACTION_TIMEOUT_MS = 15_000; // Individual action timeout
  const NAVIGATION_TIMEOUT_MS = 30_000; // Navigation timeout
  ```

## Customization

### Updating Selectors

All selectors are centralized in `tests/config/selectors.ts`. Update them to match your application's HTML structure.

```typescript
// tests/config/selectors.ts
export const SELECTORS = {
  login: { ... },
  customerSelector: { ... },
  // Add more selectors as needed
};
```

### API Endpoints

Update `SUBFOLDER_API_PARTIAL_URL` in `tests/config/selectors.ts` to match your actual API endpoint pattern.

### Creating New Helpers

Add reusable helper functions to `tests/helpers/`:

```typescript
// Example: tests/helpers/my-feature.helper.ts
import { Page } from '@playwright/test';

export async function myFeatureHelper(page: Page) {
  // Your logic here
}
```

### Creating New Tests

Follow the naming convention:

- E2E tests: `*.e2e.spec.ts` in `tests/e2e/`
- Unit tests: `*.unit.spec.ts` in `tests/unit/`
- Integration tests: `*.integration.spec.ts` in `tests/integration/`

### Timeouts

Adjust timeouts based on your application's performance:

- Fast apps: Reduce timeouts
- Slow apps: Increase timeouts

## Best Practices

### General

1. **Never commit `.env` file** - Add it to `.gitignore`
2. **Use stable selectors** - Prefer `id` or `data-testid` over CSS classes
3. **Run unit tests frequently** - They're fast (~1s) and catch issues early
4. **Use smoke test before committing** - Quick validation (~25s)
5. **Reserve load tests for scheduled runs** - Too slow for interactive development

### Code Quality

1. **Run `pnpm lint` before committing** - Catch issues early
2. **Run `pnpm format` to auto-format** - Consistent code style
3. **Write unit tests for helpers** - Test logic in isolation
4. **Keep helpers pure** - Separate concerns (auth, customer, reporting)

### Debugging

1. **Use headed mode** - `pnpm test:e2e:headed` to see what's happening
2. **Use Playwright UI** - `pnpm test:e2e:ui` for step-by-step debugging
3. **Check screenshots** - `test-results/` has failure screenshots
4. **Review reports** - `customer-load-report-*.json` for load test analysis

### Test Organization

1. **Extract reusable logic to helpers** - Don't duplicate code in tests
2. **Use page objects for complex UIs** - Encapsulate UI interactions
3. **Keep tests focused** - One test should verify one thing
4. **Use descriptive test names** - Explain what's being tested

## Scripts Reference

| Script                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `pnpm test:e2e`        | Run tests in headless mode                 |
| `pnpm test:e2e:headed` | Run tests with visible browser             |
| `pnpm test:e2e:ui`     | Run tests with Playwright UI (interactive) |

## License

Private project - Internal use only.
