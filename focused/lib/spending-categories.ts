export function cleanSpendingCategory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().split(" ").filter(Boolean).join(" ").slice(0, 60);
  return clean || undefined;
}

export function findSpendingCategory(value: unknown, categories: string[]): string | undefined {
  const clean = cleanSpendingCategory(value);
  if (!clean) return undefined;
  const comparable = clean.toLocaleLowerCase("en");
  return categories.find((category) => category.toLocaleLowerCase("en") === comparable);
}
