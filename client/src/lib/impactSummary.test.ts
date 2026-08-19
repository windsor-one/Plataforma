import { describe, expect, it } from "vitest";
import { consolidateCarbonUsage } from "./impactSummary";
import type { CarbonUsage, HrProfile, UserProfile } from "./types";

const session = (overrides: Partial<CarbonUsage> = {}): CarbonUsage => ({
  id: "session-1",
  userId: "user-1",
  displayName: "Nombre antiguo",
  email: "old@example.com",
  transferredBytes: 1_200,
  resourceCount: 2,
  estimatedGramsCO2e: 0.4,
  factorGramsCO2ePerGB: 148.2,
  methodology: "SWDM-v4",
  source: "browser-resource-timing",
  ...overrides,
});

const employee: UserProfile = { id: "user-1", displayName: "Ana López", email: "ana@heliot.media", role: "personal", status: "active", createdAt: 0, updatedAt: 0 };
const hrProfile: HrProfile = { id: "hr-user-1", employeeId: "user-1", employeeCode: "EMP-00001", department: "Producción", area: "Fotografía", position: "Fotógrafa", createdBy: "it-1" };

describe("consolidateCarbonUsage", () => {
  it("prioriza el directorio y el expediente actual sobre datos antiguos de una sesión", () => {
    const [result] = consolidateCarbonUsage([session()], [employee], [hrProfile]);

    expect(result).toMatchObject({
      userId: "user-1",
      name: "Ana López",
      email: "ana@heliot.media",
      department: "Producción",
      sessions: 1,
    });
  });

  it("consolida varias sesiones de la misma cuenta y conserva un aviso implícito si no hay departamento", () => {
    const [result] = consolidateCarbonUsage([session({ estimatedGramsCO2e: 0.4, operationCount: 3 }), session({ id: "session-2", estimatedGramsCO2e: 1.2, operationCount: 2 })], [employee], []);

    expect(result).toMatchObject({ sessions: 2, grams: 1.6, operations: 5 });
    expect(result.department).toBeUndefined();
  });
});
