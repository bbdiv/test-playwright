import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import clients from '../data/clients.json';

const LOGIN_TIMEOUT_MS = 30_000;
const CLIENT_LOAD_TIMEOUT_MS = 25_000;

const SELECTORS = {
  login: {
    emailInput: '#email_input', // Email input with id="email_input"
    emailContinueButton: '.login_continue_btn', // Continue button after email
    passwordInput: '#password_input', // TODO: Update with actual password input selector
    submitButton: 'button[type="submit"]',
    postLoginTopbar: '#topbar'
  },
  clientSelector: {
    trigger: '[data-test-id="client-select-trigger"]',
    searchInput: '[data-test-id="client-select-search"]',
    optionByText: (clientId: string) =>
      `[data-test-id="client-option"][data-client-id="${clientId}"]`
  },
  clientDataContainer: '[data-test-id="client-data-root"]'
};

const CLIENT_DATA_API_PARTIAL_URL = '/api/client-data';

interface FailedClient {
  clientId: string;
  reason: string;
  screenshotPath: string;
}

async function login(page: Page): Promise<void> {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing TEST_USERNAME or TEST_PASSWORD environment variables for login.'
    );
  }

  await page.goto('/', { waitUntil: 'networkidle', timeout: LOGIN_TIMEOUT_MS });

  // Step 1: Enter email and click Continue
  await page.fill(SELECTORS.login.emailInput, username);

  // Wait for Continue button to be enabled (it starts disabled)
  const continueButton = page.locator(SELECTORS.login.emailContinueButton);
  await continueButton.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS });
  await expect(continueButton).toBeEnabled({ timeout: 5_000 });
  await continueButton.click();

  // Step 2: Wait for password input to appear, then enter password and submit
  await page.waitForSelector(SELECTORS.login.passwordInput, {
    state: 'visible',
    timeout: LOGIN_TIMEOUT_MS
  });
  await page.fill(SELECTORS.login.passwordInput, password);
  await page.click(SELECTORS.login.submitButton);

  // Step 3: Wait for successful login
  await page.waitForSelector(SELECTORS.login.postLoginTopbar, {
    state: 'visible',
    timeout: LOGIN_TIMEOUT_MS
  });
}

async function selectClient(page: Page, clientId: string): Promise<void> {
  const { trigger, searchInput, optionByText } = SELECTORS.clientSelector;

  await page.click(trigger);

  const searchInputLocator = page.locator(searchInput);
  if (await searchInputLocator.isVisible().catch(() => false)) {
    await searchInputLocator.fill('');
    await searchInputLocator.type(clientId, { delay: 50 });
  }

  const optionLocator = page.locator(optionByText(clientId));
  await optionLocator.waitFor({ state: 'visible', timeout: CLIENT_LOAD_TIMEOUT_MS / 2 });
  await optionLocator.click();
}

async function waitForClientData(page: Page, clientId: string): Promise<void> {
  const clientDataLocator = page.locator(SELECTORS.clientDataContainer);

  await Promise.race([
    page
      .waitForResponse(
        (response) => {
          const url = response.url();
          const ok = response.status() === 200;
          const urlMatches = url.includes(CLIENT_DATA_API_PARTIAL_URL);
          return ok && urlMatches;
        },
        { timeout: CLIENT_LOAD_TIMEOUT_MS }
      )
      .catch(() => {
        return;
      }),
    clientDataLocator.waitFor({
      state: 'visible',
      timeout: CLIENT_LOAD_TIMEOUT_MS
    })
  ]);

  await expect(clientDataLocator).toBeVisible({ timeout: CLIENT_LOAD_TIMEOUT_MS });

  const containerText = await clientDataLocator.textContent();
  if (!containerText || !containerText.toLowerCase().includes(clientId.toLowerCase())) {
    throw new Error(
      `Client data container did not appear to contain client identifier "${clientId}".`
    );
  }
}

function slugify(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

async function writeFailureReports(failures: FailedClient[]): Promise<void> {
  if (!failures.length) {
    console.log('All clients loaded successfully. No failure report generated.');
    return;
  }

  const resultsDir = path.resolve('test-results');
  await fs.promises.mkdir(resultsDir, { recursive: true });

  const jsonPath = path.join(resultsDir, 'client-load-failures.json');
  const csvPath = path.join(resultsDir, 'client-load-failures.csv');

  await fs.promises.writeFile(jsonPath, JSON.stringify(failures, null, 2), 'utf-8');

  const csvHeader = 'clientId,reason,screenshotPath';
  const csvRows = failures.map((f) =>
    [
      JSON.stringify(f.clientId),
      JSON.stringify(f.reason.replace(/\r?\n/g, ' ')),
      JSON.stringify(f.screenshotPath)
    ].join(',')
  );
  const csvContent = [csvHeader, ...csvRows].join('\n');
  await fs.promises.writeFile(csvPath, csvContent, 'utf-8');

  console.log(
    `Client load failures: ${failures.length} clients.\nJSON: ${jsonPath}\nCSV: ${csvPath}`
  );
}

test('load client data for all clients', async ({ page }) => {
  const failures: FailedClient[] = [];

  await test.step('Login', async () => {
    await login(page);
  });

  // for (const clientId of clients as string[]) {
  //   await test.step(`Load client: ${clientId}`, async () => {
  //     try {
  //       await selectClient(page, clientId);
  //       await waitForClientData(page, clientId);
  //       console.log(`✅ Successfully loaded client data for: ${clientId}`);
  //     } catch (error: any) {
  //       const reason =
  //         error instanceof Error ? error.message : `Unknown error: ${String(error)}`;

  //       const resultsDir = path.resolve('test-results', 'client-screenshots');
  //       await fs.promises.mkdir(resultsDir, { recursive: true });
  //       const filename = `client-${slugify(clientId)}.png`;
  //       const screenshotPath = path.join(resultsDir, filename);

  //       await page.screenshot({ path: screenshotPath, fullPage: true });

  //       console.error(`❌ Failed to load client data for: ${clientId}`);
  //       console.error(`   Reason: ${reason}`);
  //       console.error(`   Screenshot: ${screenshotPath}`);

  //       failures.push({
  //         clientId,
  //         reason,
  //         screenshotPath
  //       });
  //     }
  //   });
  // }

  // await test.step('Generate failure reports', async () => {
  //   await writeFailureReports(failures);
  // });
});

