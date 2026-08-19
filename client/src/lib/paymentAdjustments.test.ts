import { describe, expect, it } from "vitest";
import { paymentAdjustmentChangeCount, proposedPaymentChanges } from "./paymentAdjustments";
import type { Payment } from "./types";

const payment: Payment = {
  id: "payment-1",
  code: "PAG-00001",
  customerId: "customer-1",
  customerName: "Ana Pérez",
  amount: 10,
  kind: "full",
  currency: "USD",
  method: "cash",
  status: "paid",
  paidAt: "2026-08-19",
  notes: undefined,
  createdBy: "user-1",
};

describe("proposedPaymentChanges", () => {
  it("omite los campos que permanecen iguales, incluso si las notas pasan de indefinidas a vacías", () => {
    expect(proposedPaymentChanges(payment, { amount: 10, kind: "full", currency: "USD", method: "cash", status: "paid", paidAt: "2026-08-19", notes: "" })).toEqual({});
  });

  it("conserva solo el cambio justificable que se debe aprobar", () => {
    const proposed = proposedPaymentChanges(payment, { amount: 8.5, kind: "partial", currency: "USD", method: "transfer", status: "paid", paidAt: "2026-08-20", notes: "Comprobante corregido" });
    expect(proposed).toEqual({ amount: 8.5, kind: "partial", method: "transfer", paidAt: "2026-08-20", notes: "Comprobante corregido" });
    expect(paymentAdjustmentChangeCount({ id: "request-1", paymentId: payment.id, requestedBy: "user-1", reason: "Corrección", proposedChanges: proposed, status: "pending" })).toBe(5);
  });
});
