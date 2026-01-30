import * as fs from "node:fs/promises";
import * as path from "node:path";

export type CustomerLoadResult = {
  customerId: string;
  customerName: string;
  status: "success" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage?: string;
};

export async function writeCustomerLoadReport(
  results: CustomerLoadResult[],
): Promise<{ reportPath: string }> {
  const outputDir = path.resolve(process.cwd(), "test-results");
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    outputDir,
    `customer-load-report-${timestamp}.json`,
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    totals: {
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      error: results.filter((r) => r.status === "error").length,
    },
    results,
  };

  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");
  return { reportPath };
}
