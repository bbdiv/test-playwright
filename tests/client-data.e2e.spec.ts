import { test, expect, Page, type Response as PWResponse } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import clients from '../data/clients.json';
import type { Customer, Customers } from '../types/customer';

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
  customerSelector: {
    trigger: '#topbar-customer-select',
    // searchInput: 'Search options',
    // NOTE: ids can start with a digit, so using `#${id}` requires CSS escaping.
    // Use an attribute selector to avoid CSS.escape issues.
    // Prefer clicking the actual button (the class also appears on an inner div).
    firstIterationCard: 'button.card-select-product-PROJETOS',
    optionByIdLabel: (clientId: string) => `[id="${clientId}-label"]`
  },
  customerDataTable: '[data-row-key]'
};

const CLIENT_DATA_API_PARTIAL_URL = '/api/client-data';
const SUBFOLDER_API_PARTIAL_URL = '/subfolder';

interface FailedClient {
  clientId: string;
  reason: string;
  screenshotPath: string;
}


async function getCustomersFromResponse(
  response: PWResponse
): Promise<{ legacyCustomers: Customer[]; nextgenCustomers: Customer[] }> {
  const customers = (await response.json()).data as Customers;

  const legacyCustomers: Customer[] = [];
  const nextgenCustomers: Customer[] = [];

  for (const customer of customers) {
    const productCodes = customer.products.map(p => p.code);
    const hasDocs = productCodes.includes('docs');
    const hasProjetos = productCodes.includes('projetos');

    if (hasDocs) {
      nextgenCustomers.push(customer);
    } else if (hasProjetos) {
      legacyCustomers.push(customer);
    }
  }

  return { legacyCustomers, nextgenCustomers };
}


async function login(
  page: Page
): Promise<{ legacyCustomers: Customer[]; nextgenCustomers: Customer[] }> {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing TEST_USERNAME or TEST_PASSWORD environment variables for login.'
    );
  }

  await page.goto('/', { waitUntil: 'networkidle', timeout: LOGIN_TIMEOUT_MS });

  // Step 1: Email
  await page.fill(SELECTORS.login.emailInput, username);

  const continueButton = page.locator(SELECTORS.login.emailContinueButton);
  await continueButton.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT_MS });
  await expect(continueButton).toBeEnabled({ timeout: 5_000 });
  await continueButton.click();

  // Step 2: Password
  await page.waitForSelector(SELECTORS.login.passwordInput, {
    state: 'visible',
    timeout: LOGIN_TIMEOUT_MS
  });

  await page.fill(SELECTORS.login.passwordInput, password);

  // 👇 START LISTENING BEFORE SUBMIT
  const customersResponsePromise = page.waitForResponse(resp =>
    resp.url().includes('/customers') &&
    resp.request().method() === 'GET'
  );

  await page.click(SELECTORS.login.submitButton);

  // Step 3: Login success
  await page.waitForSelector(SELECTORS.login.postLoginTopbar, {
    state: 'visible',
    timeout: LOGIN_TIMEOUT_MS
  });

  // Step 4: Await customers safely (no race)
  const customersResponse = await customersResponsePromise;

  return getCustomersFromResponse(customersResponse);
}


async function selectClient(
  page: Page,
  customer: Customer,
  isFirstSelection: boolean = false
): Promise<void> {
  const { trigger, optionByIdLabel } = SELECTORS.customerSelector;

  // Open the customer selector
  await page.click(trigger);

  const optionSelector = optionByIdLabel(customer.id);
  
  // Wait for the option to appear in the DOM. Using waitForSelector is more reliable
  // for elements that are dynamically rendered after the dropdown opens.
  try {
    await page.waitForSelector(optionSelector, { 
      state: 'attached', 
      timeout: 10_000 
    });
  } catch (error) {
    // Check if the element exists at all
    const exists = await page.locator(optionSelector).count() > 0;
    if (!exists) {
      throw new Error(
        `Could not find customer option with selector "${optionSelector}" for client "${customer.name}" id "${customer.id}". ` +
        `The element is not present in the DOM. The dropdown may not have rendered yet, or the selector may be incorrect.`
      );
    }
    // Re-throw the original error if element exists but waitForSelector failed
    throw error;
  }

  const option = page.locator(optionSelector);
  await option.click();

  // Some flows require selecting a product card only once (first customer selection).
  if (isFirstSelection) {
    await clickCardProjetos(page);
  }
}

async function clickCardProjetos(page: Page): Promise<void> {
  const selector = SELECTORS.customerSelector.firstIterationCard;
  const card = page.locator(selector).first();
  try {
    await card.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    const count = await page.locator(selector).count();
    throw new Error(
      `Could not find visible PROJETOS card with selector "${selector}". Match count: ${count}`
    );
  }
  await card.click();
}

async function waitForClientData(page: Page, clientId: string): Promise<void> {
  // Wait for the request whose URL contains /subfolder; the UI is rendered from this response.
  const response = await page
    .waitForResponse(
      (resp) => resp.url().includes(SUBFOLDER_API_PARTIAL_URL),
      { timeout: CLIENT_LOAD_TIMEOUT_MS }
    )
    .catch((err) => {
      throw new Error(
        `Request to URL containing "${SUBFOLDER_API_PARTIAL_URL}" did not complete within ${CLIENT_LOAD_TIMEOUT_MS}ms. Possible network error or no response.`
      );
    });

  if (!response.ok()) {
    const status = response.status();
    let bodyPreview: string;
    try {
      bodyPreview = await response.text();
    } catch {
      bodyPreview = '(could not read body)';
    }
    throw new Error(
      `Request to ${response.url()} failed with status ${status}. Response: ${bodyPreview.slice(0, 500)}`
    );
  }

  // `[data-row-key]` matches many rows, so avoid strict-mode violations by asserting
  // there is at least one row, and that the first row is visible.
  const rows = page.locator(SELECTORS.customerDataTable);
  await expect(rows).not.toHaveCount(0, { timeout: CLIENT_LOAD_TIMEOUT_MS });
  await expect(rows.first()).toBeVisible({ timeout: CLIENT_LOAD_TIMEOUT_MS });
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

const legacyCustomers: Customer[] = [];
const nextgenCustomers: Customer[] = [];
  

  await test.step('Login', async () => {
    const { legacyCustomers: loginLegacyCustomers, nextgenCustomers: loginNextgenCustomers } = await login(page);
    legacyCustomers.push(...loginLegacyCustomers);
    // nextgenCustomers.push(...loginNextgenCustomers);
    nextgenCustomers.push(loginNextgenCustomers[0]);
    nextgenCustomers.push(loginNextgenCustomers[1]);
    console.log('nextgenCustomers', nextgenCustomers);
  });

// for (const customer of legacyCustomers) {
//   await test.step(`Load legacy customer: ${customer.id}`, async () => {
//     await selectClient(page, customer.id);
//     await waitForClientData(page, customer.id);
//     console.log(`✅ Successfully loaded legacy customer data for: ${customer.id}`);
//   });
// }

let firstIteration = true;
for (const customer of nextgenCustomers) {
  await test.step(`Load nextgen customer: ${customer.name}`, async () => {
    await selectClient(page, customer, firstIteration);
    firstIteration = false;
    await waitForClientData(page, customer.id);
    console.log(`✅ Successfully loaded nextgen customer data for: ${customer.id}`);
  });
}

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

