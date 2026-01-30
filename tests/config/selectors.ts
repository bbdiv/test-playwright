export const SELECTORS = {
  login: {
    emailInput: "#email_input", // Email input with id="email_input"
    emailContinueButton: ".login_continue_btn", // Continue button after email
    passwordInput: "#password_input", // TODO: Update with actual password input selector
    submitButton: 'button[type="submit"]',
    postLoginTopbar: "#topbar",
  },
  customerSelector: {
    trigger: "#topbar-customer-select",
    // NOTE: ids can start with a digit, so using `#${id}` requires CSS escaping.
    // Use an attribute selector to avoid CSS.escape issues.
    // Prefer clicking the actual button (the class also appears on an inner div).
    firstIterationCard: "button.card-select-product-PROJETOS",
    optionByIdLabel: (clientId: string) => `[id="${clientId}-label"]`,
  },
  customerDataTable: "[data-row-key]",
  // Ant Design empty state: page rendered but list is empty.
  emptyStateImage: ".ant-empty-image",
};

export const SUBFOLDER_API_PARTIAL_URL = "/subfolder";
