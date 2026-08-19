import { describe, expect, it } from "vitest";
import { buildReport, type ReportSnapshot } from "./reportBuilder";

const snapshot: ReportSnapshot = {
  reservations: [{ id: "r1", code: "RES-00001", customerId: "c1", customerName: "Cliente Real", date: "2026-08-10", time: "10:00", service: "Sesión", durationMinutes: 60, status: "confirmed", totalDue: 300, currency: "USD" }],
  payments: [{ id: "p1", code: "PAG-00001", customerId: "c1", customerName: "Cliente Real", reservationId: "r1", productName: "Paquete Premium", amount: 150, currency: "USD", method: "transfer", status: "paid", paidAt: "2026-08-19", createdBy: "u1" }],
  expenses: [{ id: "e1", code: "GAS-00001", concept: "Impresión", category: "services", amount: 25, currency: "USD", method: "cash", status: "paid", spentAt: "2026-08-19", createdBy: "u1" }],
};

describe("Centro de Informes", () => {
  it("incluye el pago real en Pagos recibidos", () => {
    const report = buildReport("payments", "2026-08", snapshot);
    const text = report.sections.flatMap((section) => section.rows).flat().join(" ");
    expect(text).toContain("PAG-00001");
    expect(text).toContain("Cliente Real");
    expect(text).toContain("Paquete Premium");
    expect(text).toContain("150,00");
  });

  it("incluye el detalle del pago en Beneficio y pérdida", () => {
    const report = buildReport("profit-loss", "2026-08", snapshot);
    const headings = report.sections.map((section) => section.heading);
    const text = report.sections.flatMap((section) => section.rows).flat().join(" ");
    expect(headings).toContain("Pagos registrados en el período");
    expect(text).toContain("PAG-00001");
    expect(text).toContain("150,00");
  });

  it("calcula cartera con saldo pendiente y una cuota", () => {
    const report = buildReport("ar-detail", "2026-08", snapshot);
    const text = report.sections.flatMap((section) => section.rows).flat().join(" ");
    expect(text).toContain("150,00");
    expect(text).toContain("1");
  });
});
