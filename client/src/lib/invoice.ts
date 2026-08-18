/**
 * Facturación Heliot Media: comprobantes generados en el navegador, sin datos
 * de terceros ni costos adicionales. El PDF refleja el pago concreto elegido.
 */
import { jsPDF } from "jspdf";
import type { Payment, Reservation } from "./types";

const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);

export function downloadPaymentInvoice(payment: Payment, reservation?: Reservation) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const code = payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`;
  const kind = payment.kind === "deposit" ? "Anticipo" : payment.kind === "partial" ? "Pago parcial" : payment.kind === "balance" ? "Liquidación de saldo" : "Pago completo";
  const total = reservation?.totalDue || reservation?.productPrice || payment.productPrice || payment.amount;
  const paid = payment.amount;
  const balance = Math.max(0, total - paid);
  document.setFillColor(22, 118, 243);
  document.rect(0, 0, 210, 31, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(21);
  document.text("HELIOT MEDIA", 16, 17);
  document.setFontSize(9);
  document.text("Capturamos tus mejores momentos", 16, 24);
  document.setTextColor(25, 34, 44);
  document.setFontSize(19);
  document.text("COMPROBANTE DE PAGO", 16, 47);
  document.setFontSize(10);
  document.setFont("helvetica", "normal");
  document.text(`Código: ${code}`, 16, 56);
  document.text(`Fecha de pago: ${payment.paidAt || "—"}`, 16, 62);
  document.text(`Cliente: ${payment.customerName}`, 16, 71);
  document.text(`Concepto: ${payment.productName || reservation?.productName || "Servicio personalizado"}`, 16, 77);
  document.text(`Tipo de pago: ${kind}`, 16, 83);
  document.text(`Método: ${payment.method === "card" ? "Tarjeta" : payment.method === "cash" ? "Efectivo" : payment.method === "transfer" ? "Transferencia" : "Otro"}`, 16, 89);
  document.setDrawColor(220, 225, 230);
  document.line(16, 99, 194, 99);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("Resumen financiero", 16, 110);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(`Valor total: ${money(total, payment.currency)}`, 16, 120);
  document.text(`Pago registrado: ${money(paid, payment.currency)}`, 16, 127);
  document.setFont("helvetica", "bold");
  document.setTextColor(balance > 0 ? 180 : 20, balance > 0 ? 105 : 140, balance > 0 ? 30 : 100);
  document.text(`Saldo pendiente: ${money(balance, payment.currency)}`, 16, 134);
  document.setTextColor(80, 90, 100);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.text("Documento generado por Heliot Media. Conserva este comprobante como constancia del pago.", 16, 274);
  document.save(`Comprobante-${code}.pdf`);
}
