import { test, expect } from "@playwright/test";
import { getCustomersFromResponse } from "../helpers/customer.helper";
import type { Customers } from "../../types/customer";

test.describe("getCustomersFromResponse", () => {
  test("should separate customers by product type (docs vs projetos)", async () => {
    // Mock response with test data
    const mockResponseData: Customers = [
      {
        id: "1",
        name: "Customer with docs",
        company: { id: "c1", name: "Company 1", cnpj: "111" },
        products: [{ code: "docs", root_path: "/docs" }],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
      {
        id: "2",
        name: "Customer with projetos",
        company: { id: "c2", name: "Company 2", cnpj: "222" },
        products: [{ code: "projetos", root_path: "/projetos" }],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
      {
        id: "3",
        name: "Customer with both",
        company: { id: "c3", name: "Company 3", cnpj: "333" },
        products: [
          { code: "docs", root_path: "/docs" },
          { code: "projetos", root_path: "/projetos" },
        ],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
      {
        id: "4",
        name: "Customer with neither",
        company: { id: "c4", name: "Company 4", cnpj: "444" },
        products: [{ code: "other", root_path: "/other" }],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
    ];

    const mockResponse = {
      json: async () => ({ data: mockResponseData }),
    } as any;

    const result = await getCustomersFromResponse(mockResponse);

    // Customer with docs should be in nextgenCustomers
    expect(result.nextgenCustomers).toHaveLength(2);
    expect(result.nextgenCustomers[0].name).toBe("Customer with docs");
    expect(result.nextgenCustomers[1].name).toBe("Customer with both");

    // Customer with only projetos should be in legacyCustomers
    expect(result.legacyCustomers).toHaveLength(1);
    expect(result.legacyCustomers[0].name).toBe("Customer with projetos");

    // Customer with neither should be excluded
  });

  test("should handle empty customer list", async () => {
    const mockResponse = {
      json: async () => ({ data: [] }),
    } as any;

    const result = await getCustomersFromResponse(mockResponse);

    expect(result.nextgenCustomers).toHaveLength(0);
    expect(result.legacyCustomers).toHaveLength(0);
  });

  test("should prioritize docs over projetos (nextgen wins)", async () => {
    const mockResponseData: Customers = [
      {
        id: "1",
        name: "Customer with both products",
        company: { id: "c1", name: "Company 1", cnpj: "111" },
        products: [
          { code: "projetos", root_path: "/projetos" },
          { code: "docs", root_path: "/docs" },
        ],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
    ];

    const mockResponse = {
      json: async () => ({ data: mockResponseData }),
    } as any;

    const result = await getCustomersFromResponse(mockResponse);

    // Should be in nextgenCustomers because it has docs
    expect(result.nextgenCustomers).toHaveLength(1);
    expect(result.legacyCustomers).toHaveLength(0);
  });

  test("should handle customers with multiple products of same type", async () => {
    const mockResponseData: Customers = [
      {
        id: "1",
        name: "Customer with multiple docs products",
        company: { id: "c1", name: "Company 1", cnpj: "111" },
        products: [
          { code: "docs", root_path: "/docs1" },
          { code: "docs", root_path: "/docs2" },
        ],
        service_providers: [],
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        deleted_at: null,
      },
    ];

    const mockResponse = {
      json: async () => ({ data: mockResponseData }),
    } as any;

    const result = await getCustomersFromResponse(mockResponse);

    expect(result.nextgenCustomers).toHaveLength(1);
  });
});
