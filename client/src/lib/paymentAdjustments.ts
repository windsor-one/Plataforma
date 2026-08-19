import type { Payment, PaymentAdjustmentRequest } from "./types";

export type PaymentAdjustmentDraft = Pick<Payment, "amount" | "kind" | "currency" | "method" | "status" | "paidAt" | "notes">;

const adjustmentFields: Array<keyof PaymentAdjustmentDraft> = ["amount", "kind", "currency", "method", "status", "paidAt", "notes"];

const normalizedValue = (field: keyof PaymentAdjustmentDraft, value: PaymentAdjustmentDraft[keyof PaymentAdjustmentDraft]) => field === "notes" ? String(value || "").trim() : value;

/** Devuelve únicamente los datos que cambiarían en un pago confirmado. */
export function proposedPaymentChanges(payment: Payment, candidate: PaymentAdjustmentDraft): PaymentAdjustmentRequest["proposedChanges"] {
  return adjustmentFields.reduce<PaymentAdjustmentRequest["proposedChanges"]>((changes, field) => {
    const current = normalizedValue(field, payment[field]);
    const next = normalizedValue(field, candidate[field]);
    if (current !== next) {
      const writableChanges = changes as Record<keyof PaymentAdjustmentDraft, PaymentAdjustmentDraft[keyof PaymentAdjustmentDraft] | undefined>;
      writableChanges[field] = candidate[field];
    }
    return changes;
  }, {});
}

export function paymentAdjustmentChangeCount(request: PaymentAdjustmentRequest) {
  return Object.keys(request.proposedChanges).length;
}
