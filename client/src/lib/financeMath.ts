export type CurrencyTotals = Record<string, number>;

type MonetaryRecord = { amount: number; currency?: string | null };

export function totalsByCurrency(records: MonetaryRecord[]): CurrencyTotals {
  return records.reduce<CurrencyTotals>((totals, record) => {
    const currency = record.currency || "USD";
    totals[currency] = (totals[currency] || 0) + Number(record.amount || 0);
    return totals;
  }, {});
}

export function subtractCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
  const currencies = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Array.from(currencies).reduce<CurrencyTotals>((totals, currency) => {
    totals[currency] = (left[currency] || 0) - (right[currency] || 0);
    return totals;
  }, {});
}

export function currencyTotalEntries(totals: CurrencyTotals) {
  return Object.entries(totals)
    .filter(([, amount]) => amount !== 0)
    .sort(([left], [right]) => left.localeCompare(right));
}
