/**
 * Facturación Heliot Media: comprobantes generados en el navegador, sin datos
 * de terceros ni costos adicionales. El PDF refleja el pago concreto elegido.
 */
import { jsPDF } from "jspdf";
import type { Payment, Reservation } from "./types";
import { addDownloadFooter } from "./pdfFooter";
import { addDocumentHeader, addKeyValueGrid, addSectionHeading, pdfPalette } from "./pdfDesign";

const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);

export function downloadPaymentInvoice(payment: Payment, reservation?: Reservation) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const code = payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`;
  const kind = payment.kind === "deposit" ? "Anticipo" : payment.kind === "partial" ? "Pago parcial" : payment.kind === "balance" ? "Liquidación de saldo" : "Pago completo";
  const total = reservation?.totalDue || reservation?.productPrice || payment.productPrice || payment.amount;
  const paid = payment.amount;
  const balance = Math.max(0, total - paid);
  const method = payment.method === "card" ? "Tarjeta" : payment.method === "cash" ? "Efectivo" : payment.method === "transfer" ? "Transferencia" : "Otro";
  let y = addDocumentHeader(document, "Comprobante de pago", [`Código: ${code}`, `Fecha de pago: ${payment.paidAt || "Pendiente"}`, "Documento operativo generado desde SIGES"], pdfPalette.blue);
  y = addKeyValueGrid(document, [["Cliente", payment.customerName], ["Concepto", payment.productName || reservation?.productName || "Servicio personalizado"], ["Tipo de pago", kind], ["Método", method]], y, 2) + 8;
  y = addSectionHeading(document, "Resumen financiero", y, pdfPalette.blue);
  y = addKeyValueGrid(document, [["Valor total", money(total, payment.currency)], ["Pago registrado", money(paid, payment.currency)], ["Saldo pendiente", money(balance, payment.currency)], ["Moneda", payment.currency]], y, 2) + 8;
  document.setFillColor(balance > 0 ? 255 : 235, balance > 0 ? 248 : 247, balance > 0 ? 240 : 242); document.roundedRect(16, y, 178, 20, 2, 2, "F"); document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "bold"); document.setFontSize(10); document.text(balance > 0 ? "Saldo pendiente de liquidación" : "Pago completamente liquidado", 22, y + 8); document.setFont("helvetica", "normal"); document.setFontSize(8); document.text("Conserva este documento como constancia del movimiento registrado.", 22, y + 14);
  addDownloadFooter(document);
  document.save(`Comprobante-${code}.pdf`);
}
