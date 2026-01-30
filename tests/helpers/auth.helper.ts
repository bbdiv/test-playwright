import { Page, expect } from "@playwright/test";
import type { Customer } from "../../types/customer";
import { SELECTORS } from "../config/selectors";
import { getCustomersFromResponse } from "./customer.helper";

const LOGIN_TIMEOUT_MS = 30_000;

export async function login(
  page: Page,
): Promise<{ legacyCustomers: Customer[]; nextgenCustomers: Customer[] }> {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Missing TEST_USERNAME or TEST_PASSWORD environment variables for login.",
    );
  }

  await page.goto("/", { waitUntil: "networkidle", timeout: LOGIN_TIMEOUT_MS });

  // Step 1: Email
  await page.fill(SELECTORS.login.emailInput, username);

  const continueButton = page.locator(SELECTORS.login.emailContinueButton);
  await continueButton.waitFor({ state: "visible", timeout: LOGIN_TIMEOUT_MS });
  await expect(continueButton).toBeEnabled({ timeout: 5_000 });
  await continueButton.click();

  // Step 2: Password
  await page.waitForSelector(SELECTORS.login.passwordInput, {
    state: "visible",
    timeout: LOGIN_TIMEOUT_MS,
  });

  await page.fill(SELECTORS.login.passwordInput, password);

  // 👇 START LISTENING BEFORE SUBMIT
  const customersResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/customers") && resp.request().method() === "GET",
  );

  await page.click(SELECTORS.login.submitButton);

  // Step 3: Login success
  await page.waitForSelector(SELECTORS.login.postLoginTopbar, {
    state: "visible",
    timeout: LOGIN_TIMEOUT_MS,
  });

  // Step 4: Await customers safely (no race)
  const customersResponse = await customersResponsePromise;

  return getCustomersFromResponse(customersResponse);
}
