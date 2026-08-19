import { receivableAccounts, receivableTotalsByCurrency } from "./accountsReceivable";
import { subtractCurrencyTotals, totalsByCurrency, type CurrencyTotals } from "./financeMath";
import type { Expense, Payment, Reservation } from "./types";

export type FinanceReportPeriod = { key: string; label: string };
export type FinanceSummary = {
  period: FinanceReportPeriod;
  income: CurrencyTotals;
  paidExpenses: CurrencyTotals;
  committedExpenses: CurrencyTotals;
  pendingExpenses: CurrencyTotals;
  cashFlow: CurrencyTotals;
  projectedResult: CurrencyTotals;
  receivables: ReturnType<typeof receivableTotalsByCurrency>;
  revenueByProduct: Array<{ label: string; currency: string; amount: number }>;
  expensesByCategory: Array<{ label: string; currency: string; amount: number }>;
  paymentCount: number;
  expenseCount: number;
  paymentDetails: Array<{ code: string; date: string; customer: string; concept: string; amount: number; currency: string }>;
};

const activeExpense = (expense: Expense) => !expense.archived && expense.status !== "cancelled";

/** Convierte fechas de formularios, Date y Timestamp de Firestore a YYYY-MM. */
export function financePeriodKey(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4}-\d{2})/);
    if (direct) return direct[1];
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 7);
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 7);
  }
  if (typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString().slice(0, 7);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 7);
}

export const inFinancePeriod = (value: unknown, period: string) => financePeriodKey(value) === period;

export function buildFinanceSummary(payments: Payment[], expenses: Expense[], reservations: Reservation[], period: FinanceReportPeriod): FinanceSummary {
  const periodPayments = payments.filter(payment => inFinancePeriod(payment.paidAt, period.key));
  const periodExpenses = expenses.filter(expense => activeExpense(expense) && inFinancePeriod(expense.spentAt, period.key));
  const paidExpenses = periodExpenses.filter(expense => expense.status === "paid");
  const committedExpenses = periodExpenses.filter(expense => expense.status === "paid" || expense.status === "approved");
  const pendingExpenses = periodExpenses.filter(expense => expense.status === "pending");
  const income = totalsByCurrency(periodPayments.filter(payment => payment.status === "paid"));
  const paidExpenseTotals = totalsByCurrency(paidExpenses);
  const committedExpenseTotals = totalsByCurrency(committedExpenses);
  const pendingExpenseTotals = totalsByCurrency(pendingExpenses);
  const cashFlow = subtractCurrencyTotals(income, paidExpenseTotals);
  const projectedResult = subtractCurrencyTotals(income, committedExpenseTotals);
  const accounts = receivableAccounts(reservations, payments);
  const revenueMap = new Map<string, number>();
  periodPayments.filter(payment => payment.status === "paid").forEach(payment => {
    const currency = payment.currency || "USD";
    const label = payment.productName || payment.kind || "Pago operativo";
    const key = `${label}__${currency}`;
    revenueMap.set(key, (revenueMap.get(key) || 0) + Number(payment.amount || 0));
  });
  const expenseMap = new Map<string, number>();
  committedExpenses.forEach(expense => {
    const currency = expense.currency || "USD";
    const label = expense.category;
    const key = `${label}__${currency}`;
    expenseMap.set(key, (expenseMap.get(key) || 0) + Number(expense.amount || 0));
  });
  return {
    period,
    income,
    paidExpenses: paidExpenseTotals,
    committedExpenses: committedExpenseTotals,
    pendingExpenses: pendingExpenseTotals,
    cashFlow,
    projectedResult,
    receivables: receivableTotalsByCurrency(accounts),
    revenueByProduct: Array.from(revenueMap.entries()).map(([key, amount]) => { const [label, currency] = key.split("__"); return { label, currency, amount }; }).sort((left, right) => right.amount - left.amount),
    expensesByCategory: Array.from(expenseMap.entries()).map(([key, amount]) => { const [label, currency] = key.split("__"); return { label, currency, amount }; }).sort((left, right) => right.amount - left.amount),
    paymentCount: periodPayments.filter(payment => payment.status === "paid").length,
    expenseCount: periodExpenses.length,
    paymentDetails: periodPayments.filter(payment => payment.status === "paid").map(payment => ({ code: payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`, date: String(payment.paidAt || "—"), customer: payment.customerName, concept: payment.productName || payment.kind || "Pago operativo", amount: Number(payment.amount || 0), currency: payment.currency || "USD" })),
  };
}

export function balanceRows(summary: FinanceSummary) {
  const currencies = new Set([...Object.keys(summary.cashFlow), ...Object.keys(summary.receivables), ...Object.keys(summary.pendingExpenses)]);
  return Array.from(currencies).sort().map(currency => {
    const cash = summary.cashFlow[currency] || 0;
    const receivable = summary.receivables[currency]?.pendingBalance || 0;
    const liabilities = summary.pendingExpenses[currency] || 0;
    const assets = cash + receivable;
    return { currency, cash, receivable, assets, liabilities, netPosition: assets - liabilities };
  });
}
