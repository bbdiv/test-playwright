import { test, expect } from "@playwright/test";
import type { Customer } from "../../types/customer";
import { login } from "../helpers/auth.helper";
import { selectClient, waitForClientData } from "../helpers/customer.helper";

test("smoke test - login and verify data loads", async ({ page }) => {
  let testCustomer: Customer | null = null;

  await test.step("Login and get customers", async () => {
    const { nextgenCustomers } = await login(page);

    expect(nextgenCustomers.length).toBeGreaterThan(0);
    console.log(`Found ${nextgenCustomers.length} nextgen customers`);

    testCustomer = nextgenCustomers[0];
    console.log(`Will test with: ${testCustomer.name} (${testCustomer.id})`);
  });

  await test.step("Select customer and verify data loads", async () => {
    if (!testCustomer) throw new Error("No test customer available");

    // Select the first customer (isFirstSelection = true to handle product card)
    await selectClient(page, testCustomer, true);

    // Wait for the customer data to load
    await waitForClientData(page);

    console.log(`Customer ${testCustomer.name} data loaded successfully`);
  });
});
