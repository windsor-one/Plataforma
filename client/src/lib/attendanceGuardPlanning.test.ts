import { describe, expect, it } from "vitest";
import { attendanceThursdayForOffset, attendanceWeekKey, approvedLeaveCoversDate, selectNextAttendanceGuard, upcomingAttendanceGuards } from "./attendanceGuardPlanning";
import type { AttendanceGuard, LeaveRequest } from "./types";

const leave = (employeeId: string, startDate: string, endDate = startDate): LeaveRequest => ({ id: `leave-${employeeId}`, employeeId, employeeName: employeeId, type: "permission", startDate, endDate, days: 1, status: "approved", reason: "Ausencia justificada", createdBy: "admin" });

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

  it("avanza por toda la lista y no repite inmediatamente al responsable anterior", () => {
    const people = [{ id: "u-1", displayName: "Ana" }, { id: "u-2", displayName: "Bruno" }, { id: "u-3", displayName: "Carla" }];
    const date = new Date(2026, 7, 20, 12);
    expect(selectNextAttendanceGuard(people, "u-1", date, [])?.id).toBe("u-2");
    expect(selectNextAttendanceGuard(people, "u-2", date, [])?.id).toBe("u-3");
    expect(selectNextAttendanceGuard(people, "u-3", date, [])?.id).toBe("u-1");
  });

  it("salta a quien tiene ausencia aprobada y confirma la cobertura por fecha", () => {
    const people = [{ id: "u-1", displayName: "Ana" }, { id: "u-2", displayName: "Bruno" }, { id: "u-3", displayName: "Carla" }];
    const date = new Date(2026, 7, 20, 12);
    const leaves = [leave("u-2", "2026-08-20")];
    expect(approvedLeaveCoversDate("u-2", date, leaves)).toBe(true);
    expect(selectNextAttendanceGuard(people, "u-1", date, leaves)?.id).toBe("u-3");
  });

  it("prioriza en la siguiente ronda a la persona que acumuló una deuda", () => {
    const people = [{ id: "u-1", displayName: "Ana" }, { id: "u-2", displayName: "Bruno" }, { id: "u-3", displayName: "Carla" }];
    const date = new Date(2026, 7, 27, 12);
    expect(selectNextAttendanceGuard(people, "u-3", date, [], [{ employeeId: "u-2", pendingTurns: 1 }])?.id).toBe("u-2");
  });

  it("si toda la lista tiene ausencia aprobada no inventa una asignación", () => {
    const people = [{ id: "u-1", displayName: "Ana" }, { id: "u-2", displayName: "Bruno" }];
    const date = new Date(2026, 7, 20, 12);
    const leaves = [leave("u-1", "2026-08-20"), leave("u-2", "2026-08-20")];
    expect(selectNextAttendanceGuard(people, "u-1", date, leaves)).toBeNull();
  });
});
