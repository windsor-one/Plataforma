import type { UpdateRequest, UpdateRequestAction, UpdateRequestModule, UpdateRequestStatus } from "./types";

const modules = new Set<UpdateRequestModule>(["profile", "hr", "products", "tasks", "reservations", "customers", "payments", "employees", "calendar", "mail", "updates", "automations", "hr_reports", "performance", "impact", "finance", "history", "operations", "access", "pending", "reminders", "other"]);
const scopes = new Set<UpdateRequest["scope"]>(["self", "record", "module"]);
const actions = new Set<UpdateRequestAction>(["edit", "delete"]);
const statuses = new Set<UpdateRequestStatus>(["pending", "completed", "expired", "cancelled", "rejected"]);

const stringValue = (value: unknown) => typeof value === "string" ? value : "";
const optionalString = (value: unknown) => {
  const result = stringValue(value).trim();
  return result || undefined;
};

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

/** Convierte documentos antiguos de updateRequests a la forma que espera la UI. */
export function normalizeUpdateRequest(value: unknown, fallbackId = ""): UpdateRequest {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawModule = stringValue(raw.module) as UpdateRequestModule;
  const rawScope = stringValue(raw.scope) as UpdateRequest["scope"];
  const rawStatus = stringValue(raw.status) as UpdateRequestStatus;
  const normalizedActions = stringArray(raw.allowedActions).filter((action): action is UpdateRequestAction => actions.has(action as UpdateRequestAction));
  const deadline = stringValue(raw.deadline);

  return {
    id: optionalString(raw.id) || fallbackId,
    targetUserId: stringValue(raw.targetUserId),
    targetUserName: optionalString(raw.targetUserName) || "Personal",
    module: modules.has(rawModule) ? rawModule : "other",
    scope: scopes.has(rawScope) ? rawScope : "module",
    targetRecordId: optionalString(raw.targetRecordId),
    targetRecordLabel: optionalString(raw.targetRecordLabel),
    submodule: optionalString(raw.submodule),
    targetCollection: optionalString(raw.targetCollection),
    allowedActions: normalizedActions.length ? normalizedActions : ["edit"],
    permissionId: optionalString(raw.permissionId),
    fields: stringArray(raw.fields),
    instructions: optionalString(raw.instructions),
    deadline,
    expiresAt: raw.expiresAt,
    status: statuses.has(rawStatus) ? rawStatus : "pending",
    decisionReason: optionalString(raw.decisionReason),
    assignedBy: stringValue(raw.assignedBy),
    assignedByName: optionalString(raw.assignedByName),
    createdAt: raw.createdAt,
    completedAt: raw.completedAt,
    updatedAt: raw.updatedAt,
  };
}
