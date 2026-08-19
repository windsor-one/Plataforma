import type { Payment, Reservation } from "./types";

export type ReceivableAccount = {
  reservation: Reservation;
  currency: string;
  totalDue: number;
  paidTotal: number;
  pendingBalance: number;
  installmentCount: number;
  payments: Payment[];
  status: "pending" | "settled" | "overpaid";
};

const positive = (value: unknown) => Math.max(0, Number(value) || 0);

export function receivableAccounts(reservations: Reservation[], payments: Payment[]): ReceivableAccount[] {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .map((reservation) => {
      const currency = reservation.currency || "USD";
      const totalDue = positive(reservation.totalDue ?? reservation.productPrice);
      const paidPayments = payments.filter((payment) => payment.reservationId === reservation.id && payment.status === "paid" && (payment.currency || "USD") === currency);
      const paidTotal = paidPayments.reduce((total, payment) => total + positive(payment.amount), 0);
      const difference = totalDue - paidTotal;
      return {
        reservation,
        currency,
        totalDue,
        paidTotal,
        pendingBalance: Math.max(0, difference),
        installmentCount: paidPayments.length,
        payments: paidPayments.sort((left, right) => String(left.paidAt).localeCompare(String(right.paidAt))),
        status: (difference > 0 ? "pending" : difference < 0 ? "overpaid" : "settled") as ReceivableAccount["status"],
      };
    })
    .filter((account) => account.totalDue > 0)
    .sort((left, right) => right.pendingBalance - left.pendingBalance || left.reservation.date.localeCompare(right.reservation.date));
}

export function receivableTotalsByCurrency(accounts: ReceivableAccount[]) {
  return accounts.reduce<Record<string, { totalDue: number; paidTotal: number; pendingBalance: number; accounts: number }>>((totals, account) => {
    const current = totals[account.currency] || { totalDue: 0, paidTotal: 0, pendingBalance: 0, accounts: 0 };
    totals[account.currency] = { totalDue: current.totalDue + account.totalDue, paidTotal: current.paidTotal + account.paidTotal, pendingBalance: current.pendingBalance + account.pendingBalance, accounts: current.accounts + (account.pendingBalance > 0 ? 1 : 0) };
    return totals;
  }, {});
}
