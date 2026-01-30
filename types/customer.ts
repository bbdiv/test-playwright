export type Product = {
  code: string;
  root_path: string | null;
};

export type Company = {
  id: string;
  name: string;
  cnpj: string;
};

export type Customer = {
  id: string;
  name: string;
  company: Company;
  products: Product[];
  service_providers: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Customers = Customer[];
