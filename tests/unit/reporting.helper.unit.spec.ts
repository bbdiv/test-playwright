import { test, expect } from "@playwright/test";
import {
  writeCustomerLoadReport,
  type CustomerLoadResult,
} from "../helpers/reporting.helper";
import * as fs from "node:fs/promises";

test.describe("writeCustomerLoadReport", () => {
  test("should write report with correct structure and totals", async () => {
    const testResults: CustomerLoadResult[] = [
      {
        customerId: "1",
        customerName: "Customer 1",
        status: "success",
        startedAt: "2024-01-01T10:00:00.000Z",
        finishedAt: "2024-01-01T10:00:05.000Z",
        durationMs: 5000,
      },
      {
        customerId: "2",
        customerName: "Customer 2",
        status: "success",
        startedAt: "2024-01-01T10:00:10.000Z",
        finishedAt: "2024-01-01T10:00:12.000Z",
        durationMs: 2000,
      },
      {
        customerId: "3",
        customerName: "Customer 3",
        status: "error",
        startedAt: "2024-01-01T10:00:15.000Z",
        finishedAt: "2024-01-01T10:00:20.000Z",
        durationMs: 5000,
        errorMessage: "Timeout error",
      },
    ];

    const { reportPath } = await writeCustomerLoadReport(testResults);

    // Verify file was created
    expect(reportPath).toContain("customer-load-report-");
    expect(reportPath).toContain(".json");

    // Read the file and verify contents
    const fileContent = await fs.readFile(reportPath, "utf8");
    const report = JSON.parse(fileContent);

    // Verify structure
    expect(report).toHaveProperty("generatedAt");
    expect(report).toHaveProperty("totals");
    expect(report).toHaveProperty("results");

    // Verify totals
    expect(report.totals.total).toBe(3);
    expect(report.totals.success).toBe(2);
    expect(report.totals.error).toBe(1);

    // Verify results
    expect(report.results).toHaveLength(3);
    expect(report.results[0].status).toBe("success");
    expect(report.results[2].status).toBe("error");
    expect(report.results[2].errorMessage).toBe("Timeout error");

    // Clean up
    await fs.unlink(reportPath);
  });

  test("should handle empty results array", async () => {
    const testResults: CustomerLoadResult[] = [];

    const { reportPath } = await writeCustomerLoadReport(testResults);

    const fileContent = await fs.readFile(reportPath, "utf8");
    const report = JSON.parse(fileContent);

    expect(report.totals.total).toBe(0);
    expect(report.totals.success).toBe(0);
    expect(report.totals.error).toBe(0);
    expect(report.results).toHaveLength(0);

    // Clean up
    await fs.unlink(reportPath);
  });

  test("should handle all successful results", async () => {
    const testResults: CustomerLoadResult[] = [
      {
        customerId: "1",
        customerName: "Customer 1",
        status: "success",
        startedAt: "2024-01-01T10:00:00.000Z",
        finishedAt: "2024-01-01T10:00:05.000Z",
        durationMs: 5000,
      },
      {
        customerId: "2",
        customerName: "Customer 2",
        status: "success",
        startedAt: "2024-01-01T10:00:10.000Z",
        finishedAt: "2024-01-01T10:00:15.000Z",
        durationMs: 5000,
      },
    ];

    const { reportPath } = await writeCustomerLoadReport(testResults);

    const fileContent = await fs.readFile(reportPath, "utf8");
    const report = JSON.parse(fileContent);

    expect(report.totals.total).toBe(2);
    expect(report.totals.success).toBe(2);
    expect(report.totals.error).toBe(0);

    // Clean up
    await fs.unlink(reportPath);
  });

  test("should handle all error results", async () => {
    const testResults: CustomerLoadResult[] = [
      {
        customerId: "1",
        customerName: "Customer 1",
        status: "error",
        startedAt: "2024-01-01T10:00:00.000Z",
        finishedAt: "2024-01-01T10:00:05.000Z",
        durationMs: 5000,
        errorMessage: "Error 1",
      },
      {
        customerId: "2",
        customerName: "Customer 2",
        status: "error",
        startedAt: "2024-01-01T10:00:10.000Z",
        finishedAt: "2024-01-01T10:00:15.000Z",
        durationMs: 5000,
        errorMessage: "Error 2",
      },
    ];

    const { reportPath } = await writeCustomerLoadReport(testResults);

    const fileContent = await fs.readFile(reportPath, "utf8");
    const report = JSON.parse(fileContent);

    expect(report.totals.total).toBe(2);
    expect(report.totals.success).toBe(0);
    expect(report.totals.error).toBe(2);
    expect(report.results[0].errorMessage).toBe("Error 1");
    expect(report.results[1].errorMessage).toBe("Error 2");

    // Clean up
    await fs.unlink(reportPath);
  });

  test("should create output directory if it does not exist", async () => {
    const testResults: CustomerLoadResult[] = [
      {
        customerId: "1",
        customerName: "Test Customer",
        status: "success",
        startedAt: "2024-01-01T10:00:00.000Z",
        finishedAt: "2024-01-01T10:00:05.000Z",
        durationMs: 5000,
      },
    ];

    // This should not throw even if directory doesn't exist
    const { reportPath } = await writeCustomerLoadReport(testResults);

    // Verify file exists
    const stats = await fs.stat(reportPath);
    expect(stats.isFile()).toBe(true);

    // Clean up
    await fs.unlink(reportPath);
  });
});
