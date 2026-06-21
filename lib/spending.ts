export const SPEND_CATEGORIES = [
  "Food",
  "Transport",
  "Health",
  "Entertainment",
  "Shopping",
  "Other",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

const SPEND_CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

export function isSpendCategory(value: string): value is SpendCategory {
  return SPEND_CATEGORY_SET.has(value);
}

export function matchSpendCategory(value: unknown): SpendCategory {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const match = SPEND_CATEGORIES.find((category) => category.toLowerCase() === normalized);
    if (match) return match;
  }

  return "Other";
}
