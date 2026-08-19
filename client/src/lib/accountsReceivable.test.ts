import { describe, expect, it } from "vitest";
import { receivableAccounts, receivableTotalsByCurrency } from "./accountsReceivable";
import type { Payment, Reservation } from "./types";

const reservation = (overrides: Partial<Reservation> = {}): Reservation => ({ id: "res-1", customerId: "customer-1", customerName: "Ana Pérez", date: "2026-08-20", time: "10:00", service: "Paquete Básico", durationMinutes: 10, status: "confirmed", totalDue: 100, currency: "USD", createdBy: "it-1", ...overrides });
const payment = (overrides: Partial<Payment> = {}): Payment => ({ id: "pay-1", customerId: "customer-1", customerName: "Ana Pérez", reservationId: "res-1", amount: 30, kind: "partial", currency: "USD", method: "cash", status: "paid", paidAt: "2026-08-19", createdBy: "it-1", ...overrides });

describe("receivableAccounts", () => {
  it("calcula abonos ilimitados y saldo restante de una reserva", () => {
    const [account] = receivableAccounts([reservation()], [payment(), payment({ id: "pay-2", amount: 25, paidAt: "2026-08-20" })]);
    expect(account).toMatchObject({ totalDue: 100, paidTotal: 55, pendingBalance: 45, installmentCount: 2, status: "pending" });
  });

  it("separa monedas y excluye pagos no confirmados del saldo pagado", () => {
    const accounts = receivableAccounts([reservation(), reservation({ id: "res-2", customerId: "customer-2", customerName: "Luis", totalDue: 50, currency: "MXN" })], [payment({ status: "pending" }), payment({ id: "pay-2", reservationId: "res-2", customerId: "customer-2", customerName: "Luis", amount: 20, currency: "MXN" })]);
    expect(receivableTotalsByCurrency(accounts)).toMatchObject({ USD: { pendingBalance: 100, accounts: 1 }, MXN: { pendingBalance: 30, accounts: 1 } });
  });
});
