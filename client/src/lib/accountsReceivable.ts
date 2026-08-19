import type { Payment, Reservation } from "./types";
import { currencyCode, paidPaymentsForReservation, reservationTotal, roundMoney, settlementStatus, type SettlementStatus } from "./paymentMath";

export type ReceivableAccount = {
  reservation: Reservation;
  currency: string;
  totalDue: number;
  paidTotal: number;
  pendingBalance: number;
  overpayment: number;
  installmentCount: number;
  payments: Payment[];
  status: SettlementStatus;
};

export function receivableAccounts(reservations: Reservation[], payments: Payment[]): ReceivableAccount[] {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .map((reservation) => {
      const currency = currencyCode(reservation.currency);
      const totalDue = reservationTotal(reservation);
      const paidPayments = paidPaymentsForReservation(reservation, payments)
        .sort((left, right) => String(left.paidAt).localeCompare(String(right.paidAt)));
      const paidTotal = roundMoney(paidPayments.reduce((total, payment) => total + Math.max(0, Number(payment.amount) || 0), 0));
      const status = settlementStatus(totalDue, paidTotal);
      return {
        reservation,
        currency,
        totalDue,
        paidTotal,
        pendingBalance: roundMoney(Math.max(0, totalDue - paidTotal)),
        overpayment: roundMoney(Math.max(0, paidTotal - totalDue)),
        installmentCount: paidPayments.length,
        payments: paidPayments,
        status,
      };
    })
    .filter((account) => account.totalDue > 0)
    .sort((left, right) => right.pendingBalance - left.pendingBalance || right.overpayment - left.overpayment || left.reservation.date.localeCompare(right.reservation.date));
}

export function receivableTotalsByCurrency(accounts: ReceivableAccount[]) {
  return accounts.reduce<Record<string, { totalDue: number; paidTotal: number; pendingBalance: number; overpayment: number; accounts: number; settled: number; overpaid: number }>>((totals, account) => {
    const current = totals[account.currency] || { totalDue: 0, paidTotal: 0, pendingBalance: 0, overpayment: 0, accounts: 0, settled: 0, overpaid: 0 };
    totals[account.currency] = {
      totalDue: roundMoney(current.totalDue + account.totalDue),
      paidTotal: roundMoney(current.paidTotal + account.paidTotal),
      pendingBalance: roundMoney(current.pendingBalance + account.pendingBalance),
      overpayment: roundMoney(current.overpayment + account.overpayment),
      accounts: current.accounts + (account.pendingBalance > 0 ? 1 : 0),
      settled: current.settled + (account.status === "settled" ? 1 : 0),
      overpaid: current.overpaid + (account.status === "overpaid" ? 1 : 0),
    };
    return totals;
  }, {});
}
