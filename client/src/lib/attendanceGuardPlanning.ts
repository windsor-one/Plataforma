import type { AttendanceGuard } from "./types";

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
