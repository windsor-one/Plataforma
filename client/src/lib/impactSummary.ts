import type { CarbonUsage, HrProfile, UserProfile } from "./types";

export type CarbonImpactSummary = {
  grams: number;
  bytes: number;
  sessions: number;
  active: number;
  operations: number;
};

export type CarbonImpactUser = CarbonImpactSummary & {
  userId: string;
  name: string;
  email: string;
  department?: string;
  employee?: UserProfile;
  hrProfile?: HrProfile;
};

export const addCarbonUsage = (summary: CarbonImpactSummary, entry: Pick<CarbonUsage, "estimatedGramsCO2e" | "transferredBytes" | "activeMilliseconds" | "operationCount">): CarbonImpactSummary => ({
  grams: summary.grams + Number(entry.estimatedGramsCO2e || 0),
  bytes: summary.bytes + Number(entry.transferredBytes || 0),
  sessions: summary.sessions + 1,
  active: summary.active + Number(entry.activeMilliseconds || 0),
  operations: summary.operations + Number(entry.operationCount || 0),
});

export function consolidateCarbonUsage(usage: CarbonUsage[], employees: UserProfile[], profiles: HrProfile[]): CarbonImpactUser[] {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const profileByEmployeeId = new Map(profiles.map((profile) => [profile.employeeId, profile]));
  const groups = new Map<string, CarbonImpactUser>();
  usage.forEach((entry) => {
    const employee = employeeById.get(entry.userId);
    const hrProfile = profileByEmployeeId.get(entry.userId);
    const previous = groups.get(entry.userId) || {
      userId: entry.userId,
      name: employee?.displayName || entry.displayName || "Cuenta sin nombre registrado",
      email: employee?.email || entry.email || "Sin correo registrado",
      department: hrProfile?.department || entry.departmentName,
      employee,
      hrProfile,
      grams: 0,
      bytes: 0,
      sessions: 0,
      active: 0,
      operations: 0,
    };
    groups.set(entry.userId, {
      ...previous,
      ...addCarbonUsage(previous, entry),
      name: employee?.displayName || previous.name,
      email: employee?.email || previous.email,
      department: hrProfile?.department || entry.departmentName || previous.department,
      employee,
      hrProfile,
    });
  });
  return Array.from(groups.values()).sort((left, right) => right.grams - left.grams);
}
