import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "./types";
import { guardAttendance, personalAttendance } from "./attendanceVisibility";

const record = (overrides: Partial<AttendanceRecord>): AttendanceRecord => ({
  id: "attendance-1",
  employeeId: "employee-1",
  employeeName: "Ana",
  type: "clock_in",
  source: "self_service",
  dayKey: "2026-08-20",
  ...overrides,
});

describe("attendance visibility", () => {
  it("shows only the employee's own non-guard records", () => {
    const records = [
      record({ id: "own-in" }),
      record({ id: "other-in", employeeId: "employee-2", employeeName: "Luis" }),
      record({ id: "guard-in", guardWeekKey: "2026-W34", source: "manual" }),
    ];

    expect(personalAttendance(records, "employee-1").map((item) => item.id)).toEqual(["own-in"]);
  });

  it("identifies collective guard records by week", () => {
    const records = [
      record({ id: "guard-current", source: "manual", guardWeekKey: "2026-W34" }),
      record({ id: "guard-next", source: "manual", guardWeekKey: "2026-W35" }),
      record({ id: "own", source: "self_service" }),
    ];

    expect(guardAttendance(records, "2026-W34").map((item) => item.id)).toEqual(["guard-current"]);
    expect(guardAttendance(records).map((item) => item.id)).toEqual(["guard-current", "guard-next"]);
  });
});
