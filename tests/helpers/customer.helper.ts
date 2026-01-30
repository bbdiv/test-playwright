import { Page, type Response as PWResponse } from "@playwright/test";
import type { Customer, Customers } from "../../types/customer";
import { SELECTORS, SUBFOLDER_API_PARTIAL_URL } from "../config/selectors";

const CLIENT_LOAD_TIMEOUT_MS = 25_000;

export async function getCustomersFromResponse(
  response: PWResponse,
): Promise<{ legacyCustomers: Customer[]; nextgenCustomers: Customer[] }> {
  const customers = (await response.json()).data as Customers;

  const legacyCustomers: Customer[] = [];
  const nextgenCustomers: Customer[] = [];

  for (const customer of customers) {
    const productCodes = customer.products.map((p) => p.code);
    const hasDocs = productCodes.includes("docs");
    const hasProjetos = productCodes.includes("projetos");

    if (hasDocs) {
      nextgenCustomers.push(customer);
    } else if (hasProjetos) {
      legacyCustomers.push(customer);
    }
  }

  return { legacyCustomers, nextgenCustomers };
}

export async function selectClient(
  page: Page,
  customer: Customer,
  isFirstSelection: boolean = false,
): Promise<void> {
  const { trigger, optionByIdLabel } = SELECTORS.customerSelector;

  // Open the customer selector
  await page.click(trigger);

  const optionSelector = optionByIdLabel(customer.id);

  // Wait for the option to appear in the DOM. Using waitForSelector is more reliable
  // for elements that are dynamically rendered after the dropdown opens.
  try {
    await page.waitForSelector(optionSelector, {
      state: "attached",
      timeout: 10_000,
    });
  } catch (error) {
    // Check if the element exists at all
    const exists = (await page.locator(optionSelector).count()) > 0;
    if (!exists) {
      throw new Error(
        `Could not find customer option with selector "${optionSelector}" for client "${customer.name}" id "${customer.id}". ` +
          `The element is not present in the DOM. The dropdown may not have rendered yet, or the selector may be incorrect.`,
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
    await card.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    const count = await page.locator(selector).count();
    throw new Error(
      `Could not find visible PROJETOS card with selector "${selector}". Match count: ${count}`,
    );
  }
  await card.click();
}

export async function waitForClientData(page: Page): Promise<void> {
  // Primary: page loaded when GET subfolder succeeds. Second confirmation: rows or empty image.
  const response = await page
    .waitForResponse((resp) => resp.url().includes(SUBFOLDER_API_PARTIAL_URL), {
      timeout: CLIENT_LOAD_TIMEOUT_MS,
    })
    .catch(() => {
      throw new Error(
        `Request to URL containing "${SUBFOLDER_API_PARTIAL_URL}" did not complete within ${CLIENT_LOAD_TIMEOUT_MS}ms. Possible network error or no response.`,
      );
    });

  if (!response.ok()) {
    const status = response.status();
    let bodyPreview: string;
    try {
      bodyPreview = await response.text();
    } catch {
      bodyPreview = "(could not read body)";
    }
    throw new Error(
      `Request to ${response.url()} failed with status ${status}. Response: ${bodyPreview.slice(0, 500)}`,
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
    `Subfolder loaded but within ${CONFIRMATION_TIMEOUT_MS}ms neither data rows ("${SELECTORS.customerDataTable}") nor empty state ("${SELECTORS.emptyStateImage}") appeared.`,
  );
}
