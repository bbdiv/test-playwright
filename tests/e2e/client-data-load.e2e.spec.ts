import { test } from "@playwright/test";
import type { Customer } from "../../types/customer";
import { login } from "../helpers/auth.helper";
import { selectClient, waitForClientData } from "../helpers/customer.helper";
import {
  writeCustomerLoadReport,
  type CustomerLoadResult,
} from "../helpers/reporting.helper";

test("load client data for all clients", async ({ page }) => {
  const nextgenCustomers: Customer[] = [];
  const customerLoadResults: CustomerLoadResult[] = [];

  await test.step("Login", async () => {
    const { nextgenCustomers: loginNextgenCustomers } = await login(page);
    // nextgenCustomers.push(loginNextgenCustomers[0]);
    // nextgenCustomers.push(loginNextgenCustomers[3]);
    nextgenCustomers.push(...loginNextgenCustomers);
    console.log("nextgenCustomers", nextgenCustomers);
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

        const finishedAt = new Date();
        const durationMs = Date.now() - startedAtMs;
        customerLoadResults.push({
          customerId: customer.id,
          customerName: customer.name,
          status: "success",
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
        });

        console.log(
          `Customer ${customer.name} id ${customer.id} loaded successfully`,
        );

        await test.step("Result: success", () => {});
      } catch (error) {
        const finishedAt = new Date();
        const durationMs = Date.now() - startedAtMs;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        customerLoadResults.push({
          customerId: customer.id,
          customerName: customer.name,
          status: "error",
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
          errorMessage,
        });

        console.log(
          `Customer ${customer.name} id ${customer.id} failed to load: ${errorMessage}`,
        );

        await test.step("Result: failed", () => {});
      }
    });
  }

  const { reportPath } = await writeCustomerLoadReport(customerLoadResults);

  const successCount = customerLoadResults.filter(
    (r) => r.status === "success",
  ).length;
  const errorCount = customerLoadResults.filter(
    (r) => r.status === "error",
  ).length;
  console.log(
    `Customer load report written: ${reportPath} (success: ${successCount}, error: ${errorCount})`,
  );

  if (errorCount > 0) {
    throw new Error(
      `One or more customers failed to load. See report: ${reportPath}`,
    );
  }
});
