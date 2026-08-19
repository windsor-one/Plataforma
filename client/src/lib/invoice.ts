/**
 * Comprobante de pago SIGES generado en el navegador, sin servicios adicionales.
 * El documento refleja el movimiento elegido y el acumulado real de su reserva.
 */
import { jsPDF } from "jspdf";
import type { Payment, Reservation } from "./types";
import { addDownloadFooter } from "./pdfFooter";
import { addDocumentHeader, addKeyValueGrid, addSectionHeading, addTable, pdfPalette } from "./pdfDesign";
import { paidPaymentsForReservation, reservationTotal, roundMoney, settlementStatus, settlementLabel } from "./paymentMath";

const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);

export function downloadPaymentInvoice(payment: Payment, reservation?: Reservation, allPayments: Payment[] = []) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const code = payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`;
  const kind = payment.kind === "deposit" ? "Anticipo" : payment.kind === "partial" ? "Pago parcial" : payment.kind === "balance" ? "Liquidación de saldo" : "Pago completo";
  const total = reservationTotal(reservation, payment.productPrice || payment.amount);
  const reservationPayments = reservation ? paidPaymentsForReservation(reservation, allPayments).filter((item) => item.id !== payment.id) : [];
  const paidBefore = roundMoney(reservationPayments.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0));
  const currentPaid = payment.status === "paid" ? Math.max(0, Number(payment.amount) || 0) : 0;
  const paidAfter = roundMoney(paidBefore + currentPaid);
  const balance = roundMoney(Math.max(0, total - paidAfter));
  const overpayment = roundMoney(Math.max(0, paidAfter - total));
  const settlement = reservation ? settlementStatus(total, paidBefore, currentPaid) : undefined;
  const method = payment.method === "card" ? "Tarjeta" : payment.method === "cash" ? "Efectivo" : payment.method === "transfer" ? "Transferencia" : "Otro";
  let y = addDocumentHeader(document, "Comprobante de pago", [`Código: ${code}`, `Fecha de pago: ${payment.paidAt || "Pendiente"}`, "Documento operativo generado desde SIGES"], pdfPalette.blue);
  y = addKeyValueGrid(document, [["Cliente", payment.customerName], ["Concepto", payment.productName || reservation?.productName || "Servicio personalizado"], ["Tipo de pago", kind], ["Método", method]], y, 2) + 8;
  y = addSectionHeading(document, "Resumen financiero", y, pdfPalette.blue);
  y = addKeyValueGrid(document, [["Valor total del paquete", money(total, payment.currency)], ["Cuotas anteriores", money(paidBefore, payment.currency)], ["Esta cuota", money(payment.amount, payment.currency)], ["Abonado acumulado", money(paidAfter, payment.currency)], ["Saldo posterior", money(balance, payment.currency)], ["Moneda", payment.currency]], y, 2) + 8;
  if (reservationPayments.length) {
    y = addSectionHeading(document, "Historial de cuotas", y, pdfPalette.blue);
    y = addTable(document, ["Código", "Fecha", "Importe", "Estado"], reservationPayments.map((item) => [item.code || `PAG-${item.id.slice(0, 8).toUpperCase()}`, item.paidAt || "—", money(item.amount, item.currency), item.status === "paid" ? "Pagado" : item.status === "refunded" ? "Reintegrado" : "Pendiente"]), y) + 8;
  }
  const statusText = settlement ? settlementLabel(settlement) : payment.status === "paid" ? "Pago registrado" : "Movimiento pendiente";
  document.setFillColor(overpayment > 0 ? 255 : balance > 0 ? 255 : 235, overpayment > 0 ? 235 : balance > 0 ? 248 : 247, overpayment > 0 ? 235 : balance > 0 ? 240 : 242);
  document.roundedRect(16, y, 178, 24, 2, 2, "F");
  document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "bold"); document.setFontSize(10); document.text(statusText, 22, y + 8);
  document.setFont("helvetica", "normal"); document.setFontSize(8);
  document.text(overpayment > 0 ? `Exceso por revisar: ${money(overpayment, payment.currency)}` : balance > 0 ? `Saldo pendiente: ${money(balance, payment.currency)}` : "La reserva queda totalmente liquidada.", 22, y + 15);
  document.text("Conserva este documento como constancia del movimiento registrado.", 22, y + 20);
  addDownloadFooter(document);
  document.save(`Comprobante-${code}.pdf`);
}
