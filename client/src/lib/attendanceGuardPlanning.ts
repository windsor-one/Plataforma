import type { AttendanceGuard, LeaveRequest } from "./types";

export interface GuardCandidate {
  id: string;
  displayName: string;
}

export interface GuardDebt {
  employeeId: string;
  pendingTurns: number;
}

export function attendanceWeekKey(date = new Date()) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function attendanceThursdayForOffset(offset: number, reference = new Date()) {
  const date = new Date(reference);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 4 + offset * 7);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Combina cuatro jueves consecutivos con las guardias persistidas, sin inventar responsables faltantes. */
export function upcomingAttendanceGuards(guards: AttendanceGuard[], reference = new Date()) {
  return Array.from({ length: 4 }, (_, offset) => {
    const date = attendanceThursdayForOffset(offset, reference);
    const weekKey = attendanceWeekKey(date);
    return { date, weekKey, guard: guards.find((item) => item.weekKey === weekKey) };
  });
}

const dateKey = (value: unknown) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return dateKey((value as { toDate: () => Date }).toDate());
  return "";
};

export function approvedLeaveCoversDate(employeeId: string, targetDate: Date | string, leaves: LeaveRequest[]) {
  const target = dateKey(targetDate);
  return leaves.some((leave) => leave.employeeId === employeeId && leave.status === "approved" && dateKey(leave.startDate) <= target && dateKey(leave.endDate) >= target);
}

/**
 * Selecciona al siguiente responsable con una rotación circular.
 * Primero atiende una deuda pendiente que ya esté disponible; si no existe, toma el primer integrante posterior al anterior.
 * Solo repite cuando no queda otra persona activa disponible.
 */
export function selectNextAttendanceGuard(candidates: GuardCandidate[], previousId: string | undefined, targetDate: Date | string, leaves: LeaveRequest[], debts: GuardDebt[] = []) {
  if (!candidates.length) return null;
  const previousIndex = candidates.findIndex((candidate) => candidate.id === previousId);
  const rotation = Array.from({ length: candidates.length }, (_, index) => candidates[(Math.max(previousIndex, -1) + 1 + index) % candidates.length]);
  const available = rotation.filter((candidate) => !approvedLeaveCoversDate(candidate.id, targetDate, leaves));
  if (!available.length) return null;
  const debtByEmployee = new Map(debts.map((debt) => [debt.employeeId, Math.max(0, Number(debt.pendingTurns) || 0)]));
  return available.find((candidate) => candidate.id !== previousId && (debtByEmployee.get(candidate.id) || 0) > 0) || available.find((candidate) => candidate.id !== previousId) || available[0] || null;
}
