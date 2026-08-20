import type { AttendanceRecord } from "./types";

/**
 * Marcaciones que deben aparecer en "Mi asistencia personal".
 * Las capturas colectivas de una guardia se identifican por guardWeekKey
 * y deben permanecer fuera del historial personal.
 */
export function personalAttendance(records: AttendanceRecord[], employeeId: string): AttendanceRecord[] {
  return records.filter((record) => record.employeeId === employeeId && !record.guardWeekKey);
}

export function guardAttendance(records: AttendanceRecord[], weekKey?: string): AttendanceRecord[] {
  return records.filter((record) => record.source === "manual" && Boolean(record.guardWeekKey) && (!weekKey || record.guardWeekKey === weekKey));
}
