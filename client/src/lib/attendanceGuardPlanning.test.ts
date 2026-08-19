import { describe, expect, it } from "vitest";
import { attendanceThursdayForOffset, attendanceWeekKey, upcomingAttendanceGuards } from "./attendanceGuardPlanning";
import type { AttendanceGuard } from "./types";

describe("planificación de guardia", () => {
  it("construye cuatro jueves consecutivos desde cualquier día de la semana", () => {
    const reference = new Date(2026, 7, 19, 12);
    const weeks = upcomingAttendanceGuards([], reference);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((item) => item.date.getDay())).toEqual([4, 4, 4, 4]);
    expect(weeks[1]!.date.getTime() - weeks[0]!.date.getTime()).toBe(7 * 86_400_000);
    expect(new Set(weeks.map((item) => item.weekKey)).size).toBe(4);
  });

  it("muestra la guardia persistida en la semana correcta y preserva su reasignación", () => {
    const reference = new Date(2026, 7, 19, 12);
    const key = attendanceWeekKey(attendanceThursdayForOffset(1, reference));
    const guard: AttendanceGuard = { id: key, weekKey: key, guardUserId: "u-2", guardUserName: "Carla", assignedBy: "system", reassignedReason: "approved_leave", replacedGuardUserName: "Luis" };
    const weeks = upcomingAttendanceGuards([guard], reference);
    expect(weeks[1]?.guard).toMatchObject({ guardUserName: "Carla", reassignedReason: "approved_leave", replacedGuardUserName: "Luis" });
  });
});
