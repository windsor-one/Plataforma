import { describe, expect, it } from "vitest";
import { buildReport, type ReportSnapshot } from "./reportBuilder";

const snapshot: ReportSnapshot = {
  reservations: [{ id: "r1", code: "RES-00001", customerId: "c1", customerName: "Cliente Real", date: "2026-08-10", time: "10:00", service: "Sesión", durationMinutes: 60, status: "confirmed", totalDue: 300, currency: "USD" }],
  payments: [{ id: "p1", code: "PAG-00001", customerId: "c1", customerName: "Cliente Real", reservationId: "r1", productName: "Paquete Premium", amount: 150, currency: "USD", method: "transfer", status: "paid", paidAt: "2026-08-19", createdBy: "u1" }],
  expenses: [{ id: "e1", code: "GAS-00001", concept: "Impresión", category: "services", amount: 25, currency: "USD", method: "cash", status: "paid", spentAt: "2026-08-19", createdBy: "u1" }],
  employees: [{ id: "e1", email: "persona@example.com", displayName: "Persona Real", role: "personal", status: "active" }],
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

  it("calcula la cartera usando pagos hasta el período seleccionado", () => {
    const report = buildReport("ar-detail", "2026-08", { ...snapshot, payments: [...snapshot.payments, { ...snapshot.payments[0], id: "p2", code: "PAG-00002", amount: 150, paidAt: "2026-09-01" }] });
    const text = report.sections.flatMap((section) => section.rows).flat().join(" ");
    expect(text).toContain("150,00");
    expect(text).toContain("1");
  });

  it("genera planilla y expedientes desde las colecciones reales entregadas", () => {
    const payroll = buildReport("payroll", "2026-08", { ...snapshot, payrollRuns: [{ id: "run-1", periodKey: "2026-08", periodStart: "2026-08-01", periodEnd: "2026-08-31", status: "paid", currency: "USD", lines: [], totalGross: 200, totalDeductions: 20, totalNet: 180, createdBy: "u1" }] });
    const hr = buildReport("hr-files", "2026-08", { ...snapshot, hrProfiles: [{ id: "hr-1", employeeId: "e1", employeeName: "Persona Real", employeeCode: "EMP-00001", position: "Asistente", department: "Operaciones", area: "Producción", team: "Equipo A", workMode: "remote", createdBy: "u1" }] });
    expect(payroll.sections.flatMap((section) => section.rows).flat().join(" ")).toContain("180,00");
    expect(hr.sections.flatMap((section) => section.rows).flat().join(" ")).toContain("Persona Real");
  });
});
