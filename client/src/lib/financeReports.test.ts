import { describe, expect, it } from "vitest";
import { balanceRows, buildFinanceSummary } from "./financeReports";
import type { Expense, Payment, Reservation } from "./types";

const period = { key: "2026-08", label: "agosto de 2026" };
const payment = (overrides: Partial<Payment>): Payment => ({ id: "p1", customerId: "c1", customerName: "Cliente", amount: 100, currency: "USD", method: "cash", status: "paid", paidAt: "2026-08-10", createdBy: "u1", ...overrides });
const expense = (overrides: Partial<Expense>): Expense => ({ id: "e1", concept: "Servicio", category: "services", amount: 40, currency: "USD", method: "transfer", status: "paid", spentAt: "2026-08-11", createdBy: "u1", ...overrides });
const reservation = (overrides: Partial<Reservation>): Reservation => ({ id: "r1", customerId: "c1", customerName: "Cliente", date: "2026-08-10", time: "10:00", service: "Sesión", durationMinutes: 60, status: "confirmed", totalDue: 150, currency: "USD", ...overrides });

describe("reportes financieros", () => {
  it("calcula ingresos, gastos y flujo por moneda", () => {
    const summary = buildFinanceSummary([payment({})], [expense({})], [], period);
    expect(summary.income.USD).toBe(100);
    expect(summary.paidExpenses.USD).toBe(40);
    expect(summary.cashFlow.USD).toBe(60);
  });
  it("integra cuentas por cobrar desde reservas y pagos", () => {
    const summary = buildFinanceSummary([payment({ amount: 50, reservationId: "r1" })], [], [reservation({})], period);
    expect(summary.receivables.USD?.pendingBalance).toBe(100);
    expect(balanceRows(summary)[0]?.receivable).toBe(100);
  });
  it("no mezcla monedas en la posición", () => {
    const summary = buildFinanceSummary([payment({ currency: "EUR", amount: 80 })], [expense({ currency: "USD", amount: 20 })], [], period);
    expect(summary.cashFlow.EUR).toBe(80);
    expect(summary.cashFlow.USD).toBe(-20);
  });
});
