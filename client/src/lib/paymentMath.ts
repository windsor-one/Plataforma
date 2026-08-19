import type { Payment, PaymentKind, PaymentStatus, Reservation } from "./types";

export type SettlementStatus = "pending" | "settled" | "overpaid";

export const EPSILON = 0.005;

export const positiveAmount = (value: unknown) => Math.max(0, Number(value) || 0);

export const currencyCode = (value: unknown) => String(value || "USD").trim().toUpperCase();

export const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export function reservationTotal(reservation?: Reservation | null, fallback = 0) {
  return roundMoney(positiveAmount(reservation?.totalDue ?? reservation?.productPrice ?? fallback));
}

export function paidPaymentsForReservation(reservation: Reservation | null | undefined, payments: Payment[], excludePaymentId?: string) {
  if (!reservation) return [];
  const currency = currencyCode(reservation.currency);
  return payments.filter((payment) => payment.reservationId === reservation.id
    && payment.id !== excludePaymentId
    && payment.status === "paid"
    && currencyCode(payment.currency) === currency);
}

export function paidTotalForReservation(reservation: Reservation | null | undefined, payments: Payment[], excludePaymentId?: string) {
  return roundMoney(paidPaymentsForReservation(reservation, payments, excludePaymentId).reduce((total, payment) => total + positiveAmount(payment.amount), 0));
}

export function settlementStatus(reservationTotalValue: number, paidBefore: number, currentAmount = 0): SettlementStatus {
  const difference = roundMoney(reservationTotalValue - paidBefore - positiveAmount(currentAmount));
  if (difference < -EPSILON) return "overpaid";
  if (Math.abs(difference) <= EPSILON) return "settled";
  return "pending";
}

export function settlementBalance(reservationTotalValue: number, paidBefore: number, currentAmount = 0) {
  return roundMoney(Math.max(0, reservationTotalValue - paidBefore - positiveAmount(currentAmount)));
}

export function settlementOverpayment(reservationTotalValue: number, paidBefore: number, currentAmount = 0) {
  return roundMoney(Math.max(0, paidBefore + positiveAmount(currentAmount) - reservationTotalValue));
}

export function derivedPaymentKind(reservationTotalValue: number, paidBefore: number, currentAmount: number, requestedKind?: PaymentKind): PaymentKind {
  if (!reservationTotalValue) return requestedKind || "full";
  const paidAfter = roundMoney(paidBefore + positiveAmount(currentAmount));
  if (paidAfter >= reservationTotalValue - EPSILON) return paidBefore > EPSILON ? "balance" : "full";
  return paidBefore > EPSILON ? "partial" : requestedKind === "deposit" ? "deposit" : "partial";
}

export function derivedPaymentStatus(amount: number, requestedStatus: PaymentStatus): PaymentStatus {
  // El estado del movimiento indica si la cuota fue recibida; la liquidación de la reserva
  // se calcula por separado con settlementStatus(). Nunca se marca una cuota con importe cero como pagada.
  if (positiveAmount(amount) <= EPSILON) return "pending";
  return requestedStatus;
}

export function settlementLabel(status: SettlementStatus) {
  return status === "settled" ? "Total liquidado" : status === "overpaid" ? "Sobrepago por revisar" : "Pendiente de liquidación";
}
