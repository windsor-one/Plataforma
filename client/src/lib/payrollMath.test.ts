import { describe, expect, it } from "vitest";
import { recalculatePayrollLine, workedHoursForEmployee } from "./payrollMath";
import type { AttendanceRecord, PayrollLine } from "./types";

const record = (type: AttendanceRecord["type"], occurredAt: string): AttendanceRecord => ({ id: `${type}-${occurredAt}`, employeeId: "u1", employeeName: "Ana", type, occurredAt, source: "self_service", dayKey: "2026-08-19" });

describe("cálculo de planilla", () => {
  it("calcula horas restando el receso registrado", () => {
    const records = [record("clock_in", "2026-08-19T07:00:00"), record("break_start", "2026-08-19T12:00:00"), record("break_end", "2026-08-19T13:00:00"), record("clock_out", "2026-08-19T16:00:00")];
    expect(workedHoursForEmployee(records, "2026-08")).toBe(8);
  });
  it("recalcula bruto y neto con horas extra y deducciones", () => {
    const line: PayrollLine = { employeeId: "u1", employeeName: "Ana", regularHours: 8, overtimeHours: 0, hourlyRate: 10, grossPay: 80, deductions: 0, netPay: 80, currency: "USD", attendanceRecordCount: 4, leaveDays: 0 };
    const result = recalculatePayrollLine(line, 12, 2, 5);
    expect(result.grossPay).toBe(120);
    expect(result.netPay).toBe(115);
  });
  it("mantiene el salario mensual fijo y suma solo los conceptos variables", () => {
    const line: PayrollLine = { employeeId: "u1", employeeName: "Ana", regularHours: 168, overtimeHours: 0, monthlySalary: 900, hourlyRate: 5.625, grossPay: 900, deductions: 0, netPay: 900, currency: "USD", attendanceRecordCount: 4, leaveDays: 0 };
    const result = recalculatePayrollLine(line, 5.625, 4, 50, 900, "Ajuste de horas extra");
    expect(result.grossPay).toBe(922.5);
    expect(result.netPay).toBe(872.5);
    expect(result.adjustmentReason).toBe("Ajuste de horas extra");
  });
});
