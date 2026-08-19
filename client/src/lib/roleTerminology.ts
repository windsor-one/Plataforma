export const administrativeRolesLabel = "Administración y Departamento de IT";

/** Convierte denominaciones heredadas de dos roles en la terminología oficial visible de SIGES. */
export function normalizeRoleTerminology(value: string) {
  return value
    .replaceAll("Administración / IT", administrativeRolesLabel)
    .replaceAll("Administración/IT", administrativeRolesLabel)
    .replaceAll("Administración e IT", administrativeRolesLabel)
    .replaceAll("Administración y IT", administrativeRolesLabel)
    .replaceAll("IT/Administración", "Departamento de IT y Administración")
    .replaceAll("IT / Administración", "Departamento de IT y Administración");
}
