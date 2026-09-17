export type CurrencyOption = {
  value: string;
  label: string;
};

/**
 * Real ISO 4217 currency codes — exactly the set used as each seeded
 * Country's defaultCurrencyCode (see docs/26-database-schema-design.md
 * §8). Shared by the job-creation form (UI options) and the createJob
 * service (server-side validation) so there is exactly one allowlist,
 * not two that could drift apart.
 */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "NOK", label: "NOK — Norwegian Krone" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "KRW", label: "KRW — South Korean Won" },
  { value: "HKD", label: "HKD — Hong Kong Dollar" },
  { value: "ILS", label: "ILS — Israeli Shekel" },
];

export const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  CURRENCY_OPTIONS.map((option) => option.value)
);
