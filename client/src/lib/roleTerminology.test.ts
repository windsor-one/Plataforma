import { describe, expect, it } from "vitest";
import { administrativeRolesLabel, normalizeRoleTerminology } from "./roleTerminology";

describe("normalizeRoleTerminology", () => {
  it("unifica las frases heredadas que autorizan a ambos roles", () => {
    expect(normalizeRoleTerminology("Solo Administración/IT puede modificar esta política.")).toBe(`Solo ${administrativeRolesLabel} puede modificar esta política.`);
    expect(normalizeRoleTerminology("Administración e IT publican comunicaciones.")).toBe(`${administrativeRolesLabel} publican comunicaciones.`);
  });

  it("preserva el orden cuando el texto empieza con el rol técnico", () => {
    expect(normalizeRoleTerminology("IT/Administración revisa el registro.")).toBe("Departamento de IT y Administración revisa el registro.");
  });
});
