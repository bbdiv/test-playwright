import { test, expect, Page, type Response as PWResponse } from '@playwright/test';
import type { Customer, Customers } from '../types/customer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import staticData from './pages/staticData';

const LOGIN_TIMEOUT_MS = 30_000;
const CLIENT_LOAD_TIMEOUT_MS = 25_000;

type CustomerLoadResult = {
  customerId: string;
  customerName: string;
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage?: string;
};

async function writeCustomerLoadReport(
  results: CustomerLoadResult[]
): Promise<{ reportPath: string }> {
  const outputDir = path.resolve(process.cwd(), 'test-results');
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `customer-load-report-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    totals: {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      error: results.filter(r => r.status === 'error').length
    },
    results
  };

  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf8');
  return { reportPath };
}

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
    // NOTE: ids can start with a digit, so using `#${id}` requires CSS escaping.
    // Use an attribute selector to avoid CSS.escape issues.
    // Prefer clicking the actual button (the class also appears on an inner div).
    firstIterationCard: 'button.card-select-product-PROJETOS',
    optionByIdLabel: (clientId: string) => `[id="${clientId}-label"]`
  },
  reportsPage: {
    trigger:'a[href="/projetos/reports"]',
    triggerShortcut:  'Ctrl+Shift+2'
  },
  customerDataTable: '[data-row-key]',
  // Ant Design empty state: page rendered but list is empty.
  emptyStateImage: '.ant-empty-image'
};

const SUBFOLDER_API_PARTIAL_URL = '/subfolder';


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

async function waitForClientData(page: Page): Promise<void> {
  // Primary: page loaded when GET subfolder succeeds. Second confirmation: rows or empty image.
  const response = await page
    .waitForResponse(
      (resp) => resp.url().includes(SUBFOLDER_API_PARTIAL_URL),
      { timeout: CLIENT_LOAD_TIMEOUT_MS }
    )
    .catch(() => {
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

  // Page loaded when subfolder responded OK. Second confirmation: UI shows either rows or empty state.
  const CONFIRMATION_TIMEOUT_MS = 5_000;
  const rows = page.locator(SELECTORS.customerDataTable);
  const emptyState = page.locator(SELECTORS.emptyStateImage).first();

  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
  const pollMs = 300;

  while (Date.now() < deadline) {
    try {
      if (await rows.first().isVisible()) {
        return;
      }
      if (await emptyState.isVisible()) {
        return;
      }
    } catch {
      // Transient failure (e.g. element detached); continue polling until deadline.
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Subfolder loaded but within ${CONFIRMATION_TIMEOUT_MS}ms neither data rows ("${SELECTORS.customerDataTable}") nor empty state ("${SELECTORS.emptyStateImage}") appeared.`
  );
}

async function checkReportsPage(page: Page): Promise<void> {
  // Only match the response that returns JSON (Content-Type: application/json), not the HTML page
  const responsePromise = page.waitForResponse(resp => {
    const url = resp.url();
    const contentType = (resp.headers()['content-type'] ?? '').toLowerCase();
    return (
      url.includes('/reports') &&
      resp.request().method() === 'GET' &&
      contentType.includes('application/json')
    );
  });

  const link = page.locator(SELECTORS.reportsPage.trigger);
  await link.waitFor({ state: 'visible', timeout: 5_000 });
  await link.click();

  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(`Reports request failed: ${response.status()}`);
  }

  const body = await response.text();
  let data: unknown[];
  try {
    data = (JSON.parse(body) as { data?: unknown[] }).data ?? [];
  } catch {
    throw new Error(`Reports response is not valid JSON (URL: ${response.url()})`);
  }

  const emptyStateLocator = page.locator(SELECTORS.emptyStateImage).first();

  if (!Array.isArray(data) || data.length === 0) {
    await emptyStateLocator.waitFor({ state: 'visible', timeout: 5_000 });
    return;
  }

  const firstId = data[0]?.id;
  if (firstId == null) {
    throw new Error('First report item has no id');
  }

  await page.locator(`[data-row-key="${firstId}"]`).waitFor({ state: 'visible', timeout: 5_000 });
}

test('load client data for all clients', async ({ page }) => {
  const nextgenCustomers: Customer[] = [];
  const customerLoadResults: CustomerLoadResult[] = [];

  await test.step('Login', async () => {
    const { nextgenCustomers: loginNextgenCustomers } = await login(page);
    // ler lista de clientes do login(/customers)
    // nextgenCustomers.push(...loginNextgenCustomers);
    //ler lista de clientes estáticos
    nextgenCustomers.push(...staticData as Customer[]);
  });

  let firstIteration = true;
  for (const customer of nextgenCustomers) {
    await test.step(`Load nextgen customer: ${customer.name}`, async () => {
      const startedAt = new Date();
      const startedAtMs = Date.now();

      try {
        await selectClient(page, customer, firstIteration);
        firstIteration = false;
        await waitForClientData(page);

        await checkReportsPage(page);

        const finishedAt = new Date();
        const durationMs = Date.now() - startedAtMs;
        customerLoadResults.push({
          customerId: customer.id,
          customerName: customer.name,
          status: 'success',
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs
        });

        console.log(
          `Customer ${customer.name} id ${customer.id} loaded successfully`
        );
        await test.step('Result: success', () => {});
      } catch (error) {
        const finishedAt = new Date();
        const durationMs = Date.now() - startedAtMs;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        customerLoadResults.push({
          customerId: customer.id,
          customerName: customer.name,
          status: 'error',
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
          errorMessage
        });

        console.log(
          `Customer ${customer.name} id ${customer.id} failed to load: ${errorMessage}`
        );
        await test.step('Result: failed', () => {});
      }
    });
  }

  const { reportPath } = await writeCustomerLoadReport(customerLoadResults);

  const successCount = customerLoadResults.filter(r => r.status === 'success')
    .length;
  const errorCount = customerLoadResults.filter(r => r.status === 'error').length;
  console.log(
    `Customer load report written: ${reportPath} (success: ${successCount}, error: ${errorCount})`
  );

  if (errorCount > 0) {
    throw new Error(
      `One or more customers failed to load. See report: ${reportPath}`
    );
  }
});

