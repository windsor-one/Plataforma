import type { AttendanceRecord, EmploymentContract, HrProfile, LeaveRequest, PayrollLine, UserProfile } from "./types";
import { businessDateKey } from "./businessDate";

const dateValue = (value: unknown) => {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate().getTime();
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
};
const periodMatch = (value: unknown, periodKey: string) => (businessDateKey(value) || String(value || "")).startsWith(periodKey);
const dayKey = (record: AttendanceRecord) => record.dayKey || businessDateKey(record.occurredAt);
const hours = (milliseconds: number) => Math.max(0, milliseconds / 3_600_000);

export function workedHoursForEmployee(records: AttendanceRecord[], periodKey: string) {
  const grouped = new Map<string, AttendanceRecord[]>();
  records.filter(record => periodMatch(record.dayKey || (record.occurredAt as string), periodKey)).forEach(record => grouped.set(dayKey(record), [...(grouped.get(dayKey(record)) || []), record]));
  let total = 0;
  grouped.forEach(dayRecords => {
    const ordered = [...dayRecords].sort((left, right) => dateValue(left.occurredAt) - dateValue(right.occurredAt));
    const entry = ordered.find(record => record.type === "clock_in");
    const exit = [...ordered].reverse().find(record => record.type === "clock_out");
    if (!entry || !exit) return;
    const breakStart = ordered.find(record => record.type === "break_start");
    const breakEnd = ordered.find(record => record.type === "break_end");
    const breakDuration = breakStart && breakEnd ? Math.max(0, dateValue(breakEnd.occurredAt) - dateValue(breakStart.occurredAt)) : 0;
    total += hours(dateValue(exit.occurredAt) - dateValue(entry.occurredAt) - breakDuration);
  });
  return Math.round(total * 100) / 100;
}

export function approvedLeaveDaysForEmployee(leaves: LeaveRequest[], employeeId: string, periodKey: string) {
  return leaves.filter(leave => leave.employeeId === employeeId && leave.status === "approved" && (periodMatch(leave.startDate, periodKey) || periodMatch(leave.endDate, periodKey))).reduce((total, leave) => {
    const start = new Date(`${leave.startDate}T12:00:00`);
    const end = new Date(`${leave.endDate}T12:00:00`);
    return total + Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }, 0);
}

export function buildPayrollLines(employees: UserProfile[], profiles: HrProfile[], contracts: EmploymentContract[], attendance: AttendanceRecord[], leaves: LeaveRequest[], periodKey: string, currency = "USD"): PayrollLine[] {
  return employees.filter(employee => employee.status === "active").map(employee => {
    const profile = profiles.find(item => item.employeeId === employee.id);
    const contract = contracts.find(item => item.employeeId === employee.id && item.status !== "ended");
    const regularHours = workedHoursForEmployee(attendance.filter(item => item.employeeId === employee.id), periodKey);
    const leaveDays = approvedLeaveDaysForEmployee(leaves, employee.id, periodKey);
    const hourlyRate = Number((contract as EmploymentContract & { hourlyRate?: number })?.hourlyRate || 0);
    const grossPay = Math.round(regularHours * hourlyRate * 100) / 100;
    return { employeeId: employee.id, employeeName: employee.displayName, employeeCode: profile?.employeeCode, regularHours, overtimeHours: 0, hourlyRate, grossPay, deductions: 0, netPay: grossPay, currency: contract?.currency || currency, attendanceRecordCount: attendance.filter(item => item.employeeId === employee.id && periodMatch(item.dayKey || (item.occurredAt as string), periodKey)).length, leaveDays, notes: contract?.hourlyRate ? "Tarifa horaria del contrato" : "Configura la tarifa horaria antes de aprobar" };
  });
}

export function recalculatePayrollLine(line: PayrollLine, hourlyRate: number, overtimeHours = line.overtimeHours, deductions = line.deductions): PayrollLine {
  const safeRate = Math.max(0, Number(hourlyRate) || 0);
  const safeOvertime = Math.max(0, Number(overtimeHours) || 0);
  const safeDeductions = Math.max(0, Number(deductions) || 0);
  const grossPay = Math.round((line.regularHours + safeOvertime) * safeRate * 100) / 100;
  return { ...line, hourlyRate: safeRate, overtimeHours: safeOvertime, deductions: safeDeductions, grossPay, netPay: Math.max(0, Math.round((grossPay - safeDeductions) * 100) / 100) };
}
