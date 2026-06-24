const inrFormatters = new Map<number, Intl.NumberFormat>();

export function formatINR(amount: number, fractionDigits = 2): string {
  let formatter = inrFormatters.get(fractionDigits);

  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      currencyDisplay: "symbol",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    inrFormatters.set(fractionDigits, formatter);
  }

  return formatter.format(amount);
}
