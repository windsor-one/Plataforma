import { describe, expect, it } from "vitest";
import { businessDateKey, businessDateTimeInput, businessPeriodKey } from "./businessDate";

describe("businessDate", () => {
  it("conserva fechas de calendario sin convertirlas a UTC", () => {
    expect(businessDateKey("2026-08-19")).toBe("2026-08-19");
    expect(businessPeriodKey("2026-08-19")).toBe("2026-08");
  });

  it("acepta objetos Timestamp compatibles con Firestore", () => {
    expect(businessDateKey({ toDate: () => new Date(2026, 7, 19, 14, 30) })).toBe("2026-08-19");
    expect(businessDateTimeInput("2026-08-19T14:30:00")).toContain("2026-08-19T");
  });
});
