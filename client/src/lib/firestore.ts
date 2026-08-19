/**
 * Sala de Operaciones Editorial: operaciones auditables con degradación segura.
 * El registro principal nunca se bloquea por una regla de historial aún no publicada.
 */
import type { User } from "firebase/auth";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type { AccessLog, ActivityAction, ActivityEntity, ActivityLog, AttendanceRecord, AttendanceSettings, AttendanceType, CarbonUsage, Customer, EmploymentContract, Expense, GeneralReminder, HrDocument, HrGoal, HrPolicy, HrProfile, Incident, InternalMessage, Invitation, LeaveRequest, LifecycleChecklist, OrganizationUnit, Payment, PerformanceReview, PolicyAcknowledgment, Product, Recognition, Reservation, SecuritySettings, Task, TrainingRecord, UserProfile, UserRole, WorkSchedule } from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "products" | "users" | "invitations" | "activityLogs" | "generalReminders" | "accessLogs" | "tasks" | "incidents" | "expenses" | "hrProfiles" | "organizationUnits" | "employmentContracts" | "hrDocuments" | "workSchedules" | "attendanceRecords" | "leaveRequests" | "lifecycleChecklists" | "hrGoals" | "performanceReviews" | "trainingRecords" | "recognitions" | "hrPolicies" | "policyAcknowledgments" | "internalMessages";
type OperationalCollection = "customers" | "reservations" | "payments";
type SequencedCollection = OperationalCollection | "tasks" | "incidents" | "expenses" | "employees";
type HrAdminCollection = "hrProfiles" | "organizationUnits" | "employmentContracts" | "hrDocuments" | "workSchedules" | "lifecycleChecklists" | "hrGoals" | "performanceReviews" | "trainingRecords" | "recognitions" | "hrPolicies";
type HrEmployeeCollection = "attendanceRecords" | "leaveRequests" | "hrGoals" | "performanceReviews" | "trainingRecords" | "recognitions" | "policyAcknowledgments";
type OperationalPayload = Omit<Customer, "id" | "createdAt" | "updatedAt"> | Omit<Reservation, "id" | "createdAt" | "updatedAt"> | Omit<Payment, "id" | "createdAt" | "updatedAt">;

const normalizedEmail = (email: string) => email.trim().toLowerCase();
const bootstrapAdminEmail = normalizedEmail(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL || "");
const withoutUndefined = (payload: DocumentData) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
const auditWriteBlocked = (error: unknown) => ["permission-denied", "firestore/permission-denied"].includes((error as { code?: string })?.code || "");
const entityFromCollection = (name: OperationalCollection): ActivityEntity => name === "customers" ? "customer" : name === "reservations" ? "reservation" : "payment";
const pluralLabel = (name: OperationalCollection) => name === "customers" ? "clientes" : name === "reservations" ? "reservas" : "pagos";
const recordLabel = (name: OperationalCollection, payload: DocumentData) => name === "customers" ? `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || payload.fullName || "Cliente" : name === "reservations" ? `Reserva de ${payload.customerName || "cliente"}` : `Pago de ${payload.customerName || "cliente"}`;
const codePrefix = (name: SequencedCollection) => name === "customers" ? "CLI" : name === "reservations" ? "RES" : name === "payments" ? "PAG" : name === "tasks" ? "TAR" : name === "incidents" ? "INC" : name === "expenses" ? "GAS" : "EMP";
const sequentialCode = (name: SequencedCollection, number: number) => `${codePrefix(name)}-${String(number).padStart(5, "0")}`;

async function fallbackSequence(name: SequencedCollection) {
  if (name === "employees") {
    const snapshot = await getDocs(collection(db, "hrProfiles"));
    return snapshot.docs.reduce((highest, item) => {
      const match = String(item.data().employeeCode || "").match(/^EMP-(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0) + 1;
  }
  const snapshot = await getDocs(collection(db, name));
  const prefix = codePrefix(name);
  const max = snapshot.docs.reduce((highest, item) => {
    const code = String(item.data().code || "");
    const match = code.match(new RegExp(`^${prefix}-(\\d+)$`));
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  return max + 1;
}

async function activityActor(actorId: string) {
  const snapshot = await getDoc(doc(db, "users", actorId));
  const profile = snapshot.exists() ? snapshot.data() as UserProfile : null;
  return { actorId, actorName: profile?.displayName || "Empleado", actorEmail: profile?.email || "" };
}

function activityEntry(action: ActivityAction, entity: ActivityEntity, entityId: string, summary: string, actor: Awaited<ReturnType<typeof activityActor>>) {
  return { action, entity, entityId, summary, ...actor, occurredAt: serverTimestamp() } satisfies Omit<ActivityLog, "id">;
}

export function subscribeCollection<T extends { id: string }>(name: ManagedCollection, onData: (data: T[]) => void, onError: (error: Error) => void) {
  const sortField = name === "users" || name === "invitations" || name === "generalReminders" || name === "products" || name === "internalMessages" ? "createdAt" : name === "activityLogs" || name === "accessLogs" || name === "attendanceRecords" || name === "policyAcknowledgments" ? "occurredAt" : name === "hrPolicies" ? "publishedAt" : "updatedAt";
  return onSnapshot(query(collection(db, name), orderBy(sortField, "desc")), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)), onError);
}

export function subscribeInternalMessages(userId: string, isAdmin: boolean, onData: (data: InternalMessage[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "internalMessages");
  const request = isAdmin ? query(source, orderBy("createdAt", "desc")) : query(source, where("participantIds", "array-contains", userId));
  return onSnapshot(request, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as InternalMessage).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))), onError);
}

export async function saveInternalMessage(message: Omit<InternalMessage, "createdAt" | "updatedAt">) {
  const reference = message.id ? doc(db, "internalMessages", message.id) : doc(collection(db, "internalMessages"));
  const existing = await getDoc(reference);
  await setDoc(reference, { ...withoutUndefined(message as unknown as DocumentData), id: reference.id, createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  return reference.id;
}

export async function markInternalMessageRead(messageId: string, userId: string, readByIds: string[]) {
  await updateDoc(doc(db, "internalMessages", messageId), { readByIds: Array.from(new Set([...readByIds, userId])), updatedAt: serverTimestamp() });
}

export async function updateInternalMessageDelivery(messageId: string, status: InternalMessage["status"], scheduledFor?: string) {
  await updateDoc(doc(db, "internalMessages", messageId), { status, scheduledFor: scheduledFor || deleteField(), updatedAt: serverTimestamp() });
}

export async function deleteInternalMessage(messageId: string) {
  await deleteDoc(doc(db, "internalMessages", messageId));
}

const hrEntityForCollection: Record<HrAdminCollection, ActivityEntity> = {
  hrProfiles: "hr_profile", organizationUnits: "employee", employmentContracts: "contract", hrDocuments: "document", workSchedules: "employee", lifecycleChecklists: "employee", hrGoals: "goal", performanceReviews: "review", trainingRecords: "training", recognitions: "recognition", hrPolicies: "policy",
};

export function subscribeOwnHrProfile(userId: string, onData: (profile: HrProfile | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, "hrProfiles", userId), (snapshot) => onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as HrProfile : null), onError);
}

export function subscribeEmployeeHrRecords<T extends { id: string }>(name: HrEmployeeCollection, employeeId: string, isAdmin: boolean, onData: (data: T[]) => void, onError: (error: Error) => void) {
  const source = collection(db, name);
  const request = isAdmin ? query(source, orderBy(name === "attendanceRecords" || name === "policyAcknowledgments" ? "occurredAt" : "updatedAt", "desc")) : query(source, where("employeeId", "==", employeeId));
  return onSnapshot(request, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)), onError);
}

export function subscribeHrPolicies(isAdmin: boolean, onData: (data: HrPolicy[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "hrPolicies");
  const request = isAdmin ? query(source, orderBy("publishedAt", "desc")) : query(source, where("active", "==", true));
  return onSnapshot(request, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as HrPolicy)), onError);
}

export async function saveHrAdminRecord<T extends { id: string }>(name: HrAdminCollection, record: T, actorId: string, summary: string) {
  const actor = await activityActor(actorId);
  const isNew = !record.id;
  const reference = record.id ? doc(db, name, record.id) : doc(collection(db, name));
  const payload = { ...withoutUndefined(record as unknown as DocumentData), id: reference.id, createdBy: (record as { createdBy?: string }).createdBy || actorId, createdByName: (record as { createdByName?: string }).createdByName || actor.actorName, createdByEmail: (record as { createdByEmail?: string }).createdByEmail || actor.actorEmail, createdAt: (record as { createdAt?: unknown }).createdAt || serverTimestamp(), updatedAt: serverTimestamp(), ...(name === "hrPolicies" ? { publishedAt: serverTimestamp() } : {}) };
  const batch = writeBatch(db);
  batch.set(reference, payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(isNew ? "created" : "updated", hrEntityForCollection[name], reference.id, summary, actor));
  await batch.commit();
  return reference.id;
}

/** Los códigos EMP-xxxxx se generan por secuencia y los expedientes existentes preservan su código histórico. */
export async function saveEmployeeHrProfile(employeeId: string, payload: Omit<HrProfile, "id" | "employeeId" | "employeeCode" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "createdByEmail">, actorId: string) {
  const actor = await activityActor(actorId);
  const profileRef = doc(db, "hrProfiles", employeeId);
  const sequenceRef = doc(db, "sequences", "employees");
  await runTransaction(db, async (transaction) => {
    const [existing, counter] = await Promise.all([transaction.get(profileRef), transaction.get(sequenceRef)]);
    const current = existing.exists() ? existing.data() as HrProfile : null;
    const next = (counter.exists() ? Number(counter.data().current || 0) : 0) + 1;
    const employeeCode = current?.employeeCode || sequentialCode("employees", next);
    transaction.set(profileRef, {
      ...withoutUndefined(payload as unknown as DocumentData), id: employeeId, employeeId, employeeCode,
      createdBy: current?.createdBy || actorId, createdByName: current?.createdByName || actor.actorName, createdByEmail: current?.createdByEmail || actor.actorEmail,
      createdAt: current?.createdAt || serverTimestamp(), updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp(),
    }, { merge: true });
    if (!current?.employeeCode) transaction.set(sequenceRef, { current: next, category: "employees", updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(doc(collection(db, "activityLogs")), activityEntry(existing.exists() ? "updated" : "created", "hr_profile", employeeId, `${existing.exists() ? "Actualizó" : "Creó"} el expediente ${employeeCode}`, actor));
  });
  return employeeId;
}

export async function deleteHrAdminRecord(name: HrAdminCollection, id: string, actorId: string, summary: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, name, id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", hrEntityForCollection[name], id, summary, actor));
  await batch.commit();
}

export async function updateOwnHrProfile(userId: string, payload: Pick<HrProfile, "personalEmail" | "personalPhone" | "address" | "emergencyContactName" | "emergencyContactPhone">) {
  const actor = await activityActor(userId);
  const reference = doc(db, "hrProfiles", userId);
  const existing = await getDoc(reference);
  const contactPayload = { ...withoutUndefined(payload), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  if (existing.exists()) batch.update(reference, contactPayload);
  else batch.set(reference, { ...contactPayload, employeeId: userId, createdAt: serverTimestamp(), createdBy: userId, createdByName: actor.actorName, createdByEmail: actor.actorEmail });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "hr_profile", userId, "Actualizó sus datos de contacto de RR. HH.", actor));
  await batch.commit();
}

const defaultAttendanceSettings: AttendanceSettings = {
  id: "global", timezone: "local",
  clockIn: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 },
  clockOut: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 },
  breakStart: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 },
  breakEnd: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 },
};

const dayKeyFor = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const timeFor = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const attendanceSettingKey: Record<AttendanceType, keyof Pick<AttendanceSettings, "clockIn" | "clockOut" | "breakStart" | "breakEnd">> = { clock_in: "clockIn", clock_out: "clockOut", break_start: "breakStart", break_end: "breakEnd" };

export function subscribeAttendanceSettings(onData: (settings: AttendanceSettings) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, "attendanceSettings", "global"), (snapshot) => onData(snapshot.exists() ? { ...defaultAttendanceSettings, ...snapshot.data(), id: "global" } as AttendanceSettings : defaultAttendanceSettings), onError);
}

export async function updateAttendanceSettings(settings: AttendanceSettings, actorId: string) {
  const actor = await activityActor(actorId);
  const safe = (window: AttendanceSettings["clockIn"]) => ({ startTime: /^\d\d:\d\d$/.test(window.startTime) ? window.startTime : "07:00", endTime: /^\d\d:\d\d$/.test(window.endTime) ? window.endTime : "12:00", maxPerDay: Math.min(12, Math.max(1, Math.round(window.maxPerDay || 1))) });
  const payload = { id: "global", timezone: "local", clockIn: safe(settings.clockIn), clockOut: safe(settings.clockOut), breakStart: safe(settings.breakStart), breakEnd: safe(settings.breakEnd), updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(doc(db, "attendanceSettings", "global"), payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "attendance", "global", "Actualizó la ventana y los límites de marcación", actor));
  await batch.commit();
}

export async function recordOwnAttendance(employeeId: string, employeeName: string, type: AttendanceRecord["type"], note = "") {
  const actor = await activityActor(employeeId);
  const reference = doc(collection(db, "attendanceRecords"));
  const now = new Date(); const dayKey = dayKeyFor(now); const currentTime = timeFor(now);
  const settingsRef = doc(db, "attendanceSettings", "global");
  const existingEntries = query(collection(db, "attendanceRecords"), where("employeeId", "==", employeeId), where("dayKey", "==", dayKey), where("type", "==", type));
  const existingSnapshot = await getDocs(existingEntries);
  const counterRef = doc(db, "attendanceCounters", `${employeeId}_${dayKey}_${type}`);
  await runTransaction(db, async (transaction) => {
    const [settingsSnapshot, counterSnapshot] = await Promise.all([transaction.get(settingsRef), transaction.get(counterRef)]);
    const settings = settingsSnapshot.exists() ? { ...defaultAttendanceSettings, ...settingsSnapshot.data() } as AttendanceSettings : defaultAttendanceSettings;
    const window = settings[attendanceSettingKey[type]];
    if (currentTime < window.startTime || currentTime > window.endTime) throw new Error(`La marcación está permitida de ${window.startTime} a ${window.endTime}.`);
    const count = Math.max(existingSnapshot.size, Number(counterSnapshot.exists() ? counterSnapshot.data().count || 0 : 0));
    if (count >= window.maxPerDay) throw new Error(`Ya alcanzaste el límite de ${window.maxPerDay} marcación(es) de este tipo hoy.`);
    const payload = { employeeId, employeeName, type, dayKey, note: note.trim() || undefined, source: "self_service" as const, createdBy: employeeId, createdByName: actor.actorName, createdByEmail: actor.actorEmail, occurredAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    transaction.set(reference, withoutUndefined(payload));
    transaction.set(counterRef, { employeeId, dayKey, type, count: count + 1, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(doc(collection(db, "activityLogs")), activityEntry("created", "attendance", reference.id, `Registró ${type === "clock_in" ? "entrada" : type === "clock_out" ? "salida" : type === "break_start" ? "inicio de descanso" : "fin de descanso"}`, actor));
  });
}

export async function createLeaveRequest(payload: Omit<LeaveRequest, "id" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "createdByEmail">, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = doc(collection(db, "leaveRequests"));
  const record = { ...withoutUndefined(payload), createdBy: actorId, createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(reference, record);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "leave", reference.id, `Solicitó ${payload.type === "vacation" ? "vacaciones" : "una ausencia"} del ${payload.startDate}`, actor));
  await batch.commit();
  return reference.id;
}

export async function reviewLeaveRequest(id: string, status: LeaveRequest["status"], reviewerId: string, reviewerComment = "") {
  const actor = await activityActor(reviewerId);
  const payload = { status, reviewerId, reviewerName: actor.actorName, reviewerComment: reviewerComment.trim() || undefined, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "leaveRequests", id), withoutUndefined(payload));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "leave", id, `${status === "approved" ? "Aprobó" : status === "rejected" ? "Rechazó" : "Actualizó"} una solicitud de ausencia`, actor));
  await batch.commit();
}

/** Administración/IT puede registrar o corregir marcaciones sin perder al responsable ni la trazabilidad. */
export async function saveHrAttendanceRecord(record: Partial<AttendanceRecord> & Pick<AttendanceRecord, "employeeId" | "employeeName" | "type">, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = record.id ? doc(db, "attendanceRecords", record.id) : doc(collection(db, "attendanceRecords"));
  const isNew = !record.id;
  const occurredAt = record.occurredAt instanceof Date ? record.occurredAt : new Date();
  const dayKey = dayKeyFor(occurredAt);
  const payload = {
    ...withoutUndefined(record as DocumentData), id: reference.id, dayKey, occurredAt,
    source: record.source || "manual", createdBy: record.createdBy || actorId, createdByName: record.createdByName || actor.actorName, createdByEmail: record.createdByEmail || actor.actorEmail,
    createdAt: record.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
    adjustedAt: isNew ? undefined : serverTimestamp(), adjustedBy: isNew ? undefined : actorId, adjustedByName: isNew ? undefined : actor.actorName,
  };
  const batch = writeBatch(db);
  batch.set(reference, payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(isNew ? "created" : "updated", "attendance", reference.id, `${isNew ? "Registró" : "Corrigió"} una marcación administrativa de ${record.employeeName}`, actor));
  await batch.commit();
  return reference.id;
}

export async function deleteHrAttendanceRecord(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "attendanceRecords", id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "attendance", id, "Eliminó una marcación desde Control de RR. HH.", actor));
  await batch.commit();
}

/** Procesa hasta 200 registros por lote para reservar capacidad a la auditoría de cada operación. */
const bulkChunks = <T,>(items: T[], size = 200) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function bulkUpdateAttendanceRecords(ids: string[], payload: Pick<AttendanceRecord, "type" | "note" | "correctionReason">, actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  const recordPayload = { ...withoutUndefined(payload), source: "manual" as const, adjustedAt: serverTimestamp(), adjustedBy: actorId, adjustedByName: actor.actorName, updatedAt: serverTimestamp() };
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.update(doc(db, "attendanceRecords", id), recordPayload);
      batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "attendance", id, "Corrigió una marcación mediante edición masiva", actor));
    });
    await batch.commit();
  }
}

export async function bulkDeleteHrAttendanceRecords(ids: string[], actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.delete(doc(db, "attendanceRecords", id));
      batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "attendance", id, "Eliminó una marcación mediante selección masiva", actor));
    });
    await batch.commit();
  }
}

/** Administración/IT puede ajustar íntegramente una ausencia cuando el Personal cometió un error de captura. */
export async function saveHrLeaveRequest(record: Partial<LeaveRequest> & Pick<LeaveRequest, "employeeId" | "employeeName" | "type" | "startDate" | "endDate" | "days" | "status">, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = record.id ? doc(db, "leaveRequests", record.id) : doc(collection(db, "leaveRequests"));
  const isNew = !record.id;
  const payload = {
    ...withoutUndefined(record as DocumentData), id: reference.id, createdBy: record.createdBy || actorId, createdByName: record.createdByName || actor.actorName, createdByEmail: record.createdByEmail || actor.actorEmail,
    createdAt: record.createdAt || serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: actorId, updatedByName: actor.actorName,
  };
  const batch = writeBatch(db);
  batch.set(reference, payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(isNew ? "created" : "updated", "leave", reference.id, `${isNew ? "Registró" : "Corrigió"} una ausencia de ${record.employeeName}`, actor));
  await batch.commit();
  return reference.id;
}

export async function deleteHrLeaveRequest(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "leaveRequests", id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "leave", id, "Eliminó una ausencia desde Control de RR. HH.", actor));
  await batch.commit();
}

export async function acknowledgeHrPolicy(policy: HrPolicy, employeeId: string, employeeName: string) {
  const actor = await activityActor(employeeId);
  const reference = doc(db, "policyAcknowledgments", `${policy.id}_${employeeId}`);
  await setDoc(reference, { policyId: policy.id, employeeId, employeeName, version: policy.version, acknowledgedAt: serverTimestamp(), createdBy: employeeId, createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } satisfies Omit<PolicyAcknowledgment, "id">, { merge: true });
}

export async function createRecord(name: OperationalCollection, payload: OperationalPayload) {
  const record = doc(collection(db, name));
  const actor = await activityActor(payload.createdBy);
  const counterRef = doc(db, "sequences", name);
  try {
    await runTransaction(db, async (transaction) => {
      const counter = await transaction.get(counterRef);
      const next = (counter.exists() ? Number(counter.data().current || 0) : 0) + 1;
      const recordPayload = { ...withoutUndefined(payload), code: sequentialCode(name, next), createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      transaction.set(record, recordPayload);
      transaction.set(counterRef, { current: next, category: name, updatedAt: serverTimestamp() });
      transaction.set(doc(collection(db, "activityLogs")), activityEntry("created", entityFromCollection(name), record.id, `Creó ${recordLabel(name, payload)} · ${sequentialCode(name, next)}`, actor));
    });
  } catch (error) {
    if (!auditWriteBlocked(error)) throw error;
    const next = await fallbackSequence(name);
    await setDoc(record, { ...withoutUndefined(payload), code: sequentialCode(name, next), createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  return record.id;
}

export async function updateRecord(name: OperationalCollection, id: string, payload: DocumentData, actorId: string) {
  const actor = await activityActor(actorId);
  const recordPayload = { ...withoutUndefined(payload), updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, name, id), recordPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", entityFromCollection(name), id, `Actualizó un registro de ${pluralLabel(name)}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, name, id), recordPayload); }
}

export async function removeRecord(name: OperationalCollection, id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, name, id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", entityFromCollection(name), id, `Eliminó un registro de ${pluralLabel(name)}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await deleteDoc(doc(db, name, id)); }
}

/** Actualiza registros operativos seleccionados y deja una entrada de Historial por cada uno. */
export async function bulkUpdateRecords(name: OperationalCollection, ids: string[], payload: DocumentData, actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  const recordPayload = { ...withoutUndefined(payload), updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() };
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.update(doc(db, name, id), recordPayload);
      batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", entityFromCollection(name), id, `Actualizó masivamente un registro de ${pluralLabel(name)}`, actor));
    });
    try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await Promise.all(group.map((id) => updateDoc(doc(db, name, id), recordPayload))); }
  }
}

/** Elimina registros operativos seleccionados, preservando la evidencia de cada eliminación en Historial. */
export async function bulkRemoveRecords(name: OperationalCollection, ids: string[], actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.delete(doc(db, name, id));
      batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", entityFromCollection(name), id, `Eliminó masivamente un registro de ${pluralLabel(name)}`, actor));
    });
    try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await Promise.all(group.map((id) => deleteDoc(doc(db, name, id)))); }
  }
}

async function createSequencedWorkRecord(name: "tasks" | "incidents" | "expenses", entity: ActivityEntity, summary: string, payload: DocumentData, actorId: string) {
  const record = doc(collection(db, name));
  const actor = await activityActor(actorId);
  const counterRef = doc(db, "sequences", name);
  try {
    await runTransaction(db, async (transaction) => {
      const counter = await transaction.get(counterRef);
      const next = (counter.exists() ? Number(counter.data().current || 0) : 0) + 1;
      const code = sequentialCode(name, next);
      transaction.set(record, { ...withoutUndefined(payload), code, createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.set(counterRef, { current: next, category: name, updatedAt: serverTimestamp() });
      transaction.set(doc(collection(db, "activityLogs")), activityEntry("created", entity, record.id, `${summary} · ${code}`, actor));
    });
  } catch (error) {
    if (!auditWriteBlocked(error)) throw error;
    const next = await fallbackSequence(name);
    await setDoc(record, { ...withoutUndefined(payload), code: sequentialCode(name, next), createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  return record.id;
}

async function updateWorkRecord(name: "tasks" | "incidents" | "expenses", entity: ActivityEntity, id: string, payload: DocumentData, actorId: string, summary: string) {
  const actor = await activityActor(actorId);
  const recordPayload = { ...withoutUndefined(payload), updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, name, id), recordPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", entity, id, summary, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, name, id), recordPayload); }
}

async function removeWorkRecord(name: "tasks" | "incidents" | "expenses", entity: ActivityEntity, id: string, payload: DocumentData, actorId: string, summary: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.set(doc(db, name, id), { ...withoutUndefined(payload), archived: true, updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", entity, id, summary, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(doc(db, name, id), { ...withoutUndefined(payload), archived: true, updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() }, { merge: true }); }
}

export async function createTask(payload: Omit<Task, "id" | "code" | "createdAt" | "updatedAt" | "createdByName" | "createdByEmail" | "updatedBy" | "updatedByName">) {
  return createSequencedWorkRecord("tasks", "task", `Creó la tarea «${payload.title.trim()}»`, payload, payload.createdBy);
}

export async function updateTask(id: string, payload: Partial<Pick<Task, "title" | "description" | "priority" | "status" | "dueDate" | "assignedToId" | "assignedToName" | "reservationId" | "reservationCode" | "customerId" | "customerName">>, actorId: string) {
  return updateWorkRecord("tasks", "task", id, payload, actorId, `Actualizó una tarea operativa${payload.status ? ` a «${payload.status}»` : ""}`);
}

export async function deleteTask(id: string, actorId: string) {
  return removeWorkRecord("tasks", "task", id, {}, actorId, "Archivó una tarea operativa");
}

export async function createIncident(payload: Omit<Incident, "id" | "code" | "createdAt" | "updatedAt" | "createdByName" | "createdByEmail" | "updatedBy" | "updatedByName">) {
  return createSequencedWorkRecord("incidents", "incident", `Reportó la incidencia «${payload.title.trim()}»`, payload, payload.createdBy);
}

export async function updateIncident(id: string, payload: Partial<Pick<Incident, "title" | "description" | "priority" | "status" | "assignedToId" | "assignedToName" | "reservationId" | "reservationCode" | "customerId" | "customerName" | "resolvedAt">>, actorId: string) {
  return updateWorkRecord("incidents", "incident", id, payload, actorId, `Actualizó una incidencia${payload.status ? ` a «${payload.status}»` : ""}`);
}

export async function deleteIncident(id: string, actorId: string) {
  return removeWorkRecord("incidents", "incident", id, {}, actorId, "Archivó una incidencia operativa");
}

export async function createExpense(payload: Omit<Expense, "id" | "code" | "createdAt" | "updatedAt" | "createdByName" | "createdByEmail" | "updatedBy" | "updatedByName">) {
  return createSequencedWorkRecord("expenses", "expense", `Registró el gasto «${payload.concept.trim()}»`, payload, payload.createdBy);
}

export async function updateExpense(id: string, payload: Partial<Pick<Expense, "concept" | "category" | "amount" | "currency" | "method" | "status" | "spentAt" | "supplier" | "department" | "project" | "reservationId" | "reservationCode" | "notes" | "archived">>, actorId: string) {
  return updateWorkRecord("expenses", "expense", id, payload, actorId, `Actualizó un gasto operativo${payload.status ? ` a «${payload.status}»` : ""}`);
}

export async function archiveExpense(id: string, actorId: string) {
  return removeWorkRecord("expenses", "expense", id, {}, actorId, "Archivó un gasto operativo");
}

export async function inviteEmployee(email: string, displayName: string, role: UserRole, invitedBy: string) {
  const normalized = normalizedEmail(email);
  const actor = await activityActor(invitedBy);
  const invitationPayload = { email: normalized, displayName: displayName.trim(), role, status: "pending" as const, invitedBy, createdAt: serverTimestamp() } satisfies Omit<Invitation, "id">;
  const batch = writeBatch(db);
  batch.set(doc(db, "invitations", normalized), invitationPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("invited", "employee", normalized, `Invitó a ${displayName.trim() || normalized}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(doc(db, "invitations", normalized), invitationPayload); }
  return normalized;
}

export async function completeInvitationOnboarding(user: User): Promise<UserProfile> {
  if (!user.email) throw new Error("Tu cuenta no tiene un correo electrónico válido.");
  const email = normalizedEmail(user.email);
  const profileRef = doc(db, "users", user.uid);
  const invitationRef = doc(db, "invitations", email);
  const profileSnapshot = await getDoc(profileRef);
  if (profileSnapshot.exists()) {
    const existing = { id: profileSnapshot.id, ...profileSnapshot.data() } as UserProfile;
    if (bootstrapAdminEmail && email === bootstrapAdminEmail && existing.role === "admin") {
      await updateDoc(profileRef, { role: "it", updatedAt: serverTimestamp() });
      return { ...existing, role: "it" };
    }
    return existing;
  }
  let accountCreated = false;
  const invitationSnapshot = await getDoc(invitationRef);
  if (!invitationSnapshot.exists()) {
    if (!bootstrapAdminEmail || email !== bootstrapAdminEmail) throw new Error("No existe una invitación activa para este correo. Pide al administrador que te invite.");
    await setDoc(profileRef, { email, displayName: user.displayName || email.split("@")[0], role: "it", status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    accountCreated = true;
  } else {
    const invitation = invitationSnapshot.data() as Omit<Invitation, "id">;
    if (invitation.status !== "pending" || normalizedEmail(invitation.email) !== email) throw new Error("La invitación no está disponible. Solicita una nueva invitación al administrador.");
    await setDoc(profileRef, { email, displayName: invitation.displayName || user.displayName || email.split("@")[0], role: invitation.role, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    accountCreated = true;
    try { await updateDoc(invitationRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: serverTimestamp() }); } catch (error) { console.warn("El perfil del invitado fue creado, pero no se pudo cerrar la invitación.", error); }
  }
  const completed = await getDoc(profileRef);
  if (!completed.exists()) throw new Error("No se pudo finalizar el acceso a la plataforma.");
  const profile = { id: completed.id, ...completed.data() } as UserProfile;
  if (accountCreated) await recordAccountCreated(user.uid, profile);
  return profile;
}

export async function updateEmployee(employeeId: string, payload: Pick<UserProfile, "displayName" | "role" | "status">, actorId: string) {
  const actor = await activityActor(actorId);
  const employeePayload = { ...payload, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "users", employeeId), employeePayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "employee", employeeId, `Actualizó el perfil de ${payload.displayName}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, "users", employeeId), employeePayload); }
}

export async function deleteEmployeeProfile(employeeId: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", employeeId));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "employee", employeeId, "Eliminó un perfil de empleado", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await deleteDoc(doc(db, "users", employeeId)); }
}

export async function bulkUpdateEmployees(ids: string[], payload: Partial<Pick<UserProfile, "role" | "status">>, actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  const employeePayload = { ...payload, updatedAt: serverTimestamp() };
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.update(doc(db, "users", id), employeePayload);
      batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "employee", id, "Actualizó masivamente la configuración de Personal", actor));
    });
    try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await Promise.all(group.map((id) => updateDoc(doc(db, "users", id), employeePayload))); }
  }
}

export async function bulkDeleteEmployeeProfiles(ids: string[], actorId: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (!uniqueIds.length) return;
  const actor = await activityActor(actorId);
  for (const group of bulkChunks(uniqueIds)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      batch.delete(doc(db, "users", id));
      batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "employee", id, "Eliminó un perfil de Personal mediante selección masiva", actor));
    });
    try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await Promise.all(group.map((id) => deleteDoc(doc(db, "users", id)))); }
  }
}

export async function updateOwnProfile(userId: string, displayName: string) {
  const actor = await activityActor(userId);
  const profilePayload = { displayName: displayName.trim(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId), profilePayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("profile_updated", "profile", userId, "Actualizó su nombre de perfil", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, "users", userId), profilePayload); }
}

export async function recordAccess(userId: string, profile: UserProfile, event: AccessLog["event"] = "login") {
  const payload = { userId, displayName: profile.displayName, email: profile.email, role: profile.role, event, occurredAt: serverTimestamp() } satisfies Omit<AccessLog, "id">;
  try { await setDoc(doc(collection(db, "accessLogs")), payload); } catch (error) { console.warn("No se pudo registrar el acceso.", error); }
}

/** Factor transparente: 0.300 kWh/GB × 494 gCO2e/kWh = 148.2 gCO2e/GB (SWDM v4). */
const CARBON_FACTOR_GRAMS_PER_GB = 148.2;

export async function recordCarbonUsage(userId: string, profile: UserProfile, transferredBytes: number, resourceCount: number, context: Pick<CarbonUsage, "departmentId" | "departmentName" | "deviceClass"> = {}) {
  const safeBytes = Math.max(0, Math.round(transferredBytes));
  const payload = {
    userId,
    displayName: profile.displayName,
    email: profile.email,
    ...withoutUndefined(context),
    transferredBytes: safeBytes,
    resourceCount: Math.max(0, Math.round(resourceCount)),
    activeMilliseconds: 0,
    operationCount: 0,
    pageViews: 1,
    estimatedGramsCO2e: Number(((safeBytes / 1_000_000_000) * CARBON_FACTOR_GRAMS_PER_GB).toFixed(6)),
    factorGramsCO2ePerGB: CARBON_FACTOR_GRAMS_PER_GB,
    methodology: "SWDM-v4" as const,
    source: "browser-resource-timing" as const,
    sessionStartedAt: serverTimestamp(),
    recordedAt: serverTimestamp(),
  } satisfies Omit<CarbonUsage, "id">;
  const reference = doc(collection(db, "carbonUsage"));
  await setDoc(reference, payload);
  return reference.id;
}

export async function updateCarbonUsageSession(recordId: string, userId: string, payload: Pick<CarbonUsage, "activeMilliseconds" | "operationCount" | "pageViews" | "departmentId" | "departmentName">) {
  await updateDoc(doc(db, "carbonUsage", recordId), { ...withoutUndefined(payload), sessionEndedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function subscribeCarbonUsage(userId: string, isAdmin: boolean, onData: (data: CarbonUsage[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "carbonUsage");
  const request = isAdmin
    ? query(source, orderBy("recordedAt", "desc"))
    : query(source, where("userId", "==", userId), orderBy("recordedAt", "desc"));
  return onSnapshot(request, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CarbonUsage)), onError);
}

export async function recordAccountCreated(userId: string, profile: UserProfile) {
  const actor = await activityActor(userId);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "accessLogs")), { userId, displayName: profile.displayName, email: profile.email, role: profile.role, event: "account_created", summary: "Cuenta creada y perfil activado", occurredAt: serverTimestamp() } satisfies Omit<AccessLog, "id">);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "employee", userId, `Creó su cuenta y activó el perfil de ${profile.displayName}`, actor));
  try { await batch.commit(); } catch (error) { console.warn("La cuenta fue creada, pero no se pudo registrar su auditoría inicial.", error); }
}

export function subscribeSecuritySettings(onData: (settings: SecuritySettings) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, "securitySettings", "global"), (snapshot) => {
    const defaults: SecuritySettings = { id: "global", inactivityMinutes: 15 };
    onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as SecuritySettings : defaults);
  }, onError);
}

export async function updateSecuritySettings(inactivityValue: number, inactivityUnit: NonNullable<SecuritySettings["inactivityUnit"]>, actorId: string) {
  const limits = inactivityUnit === "seconds" ? [10, 3600] : inactivityUnit === "minutes" ? [1, 1440] : [1, 24];
  const safeValue = Math.min(limits[1], Math.max(limits[0], Math.round(inactivityValue)));
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.set(doc(db, "securitySettings", "global"), { inactivityValue: safeValue, inactivityUnit, updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "access", "global", `Actualizó el cierre automático por inactividad a ${safeValue} ${inactivityUnit === "seconds" ? "segundos" : inactivityUnit === "minutes" ? "minutos" : "horas"}`, actor));
  await batch.commit();
}

export async function createGeneralReminder(payload: Pick<GeneralReminder, "title" | "message" | "priority">, actorId: string) {
  const actor = await activityActor(actorId);
  const reminderRef = doc(collection(db, "generalReminders"));
  const reminderPayload = { ...payload, active: true, createdBy: actorId, createdByName: actor.actorName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(reminderRef, reminderPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "reminder", reminderRef.id, `Publicó el aviso «${payload.title.trim()}»`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(reminderRef, reminderPayload); }
  return reminderRef.id;
}

export async function updateGeneralReminder(id: string, payload: Pick<GeneralReminder, "title" | "message" | "priority">, actorId: string) {
  const actor = await activityActor(actorId);
  const reminderPayload = { ...payload, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "generalReminders", id), reminderPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "reminder", id, `Actualizó la comunicación «${payload.title.trim()}»`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, "generalReminders", id), reminderPayload); }
}

export async function saveProduct(product: Product, actorId: string) {
  const actor = await activityActor(actorId);
  const payload = { ...product, createdBy: product.createdBy || actorId, updatedAt: serverTimestamp(), createdAt: product.createdAt || serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(doc(db, "products", product.id), payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(product.createdAt ? "updated" : "created", "product", product.id, `${product.createdAt ? "Actualizó" : "Publicó"} el paquete «${product.name}»`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(doc(db, "products", product.id), payload, { merge: true }); }
}

export async function deleteProduct(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.set(doc(db, "products", id), { id, active: false, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "product", id, "Eliminó un paquete del catálogo", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(doc(db, "products", id), { id, active: false, updatedAt: serverTimestamp() }, { merge: true }); }
}

export async function deleteGeneralReminder(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "generalReminders", id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "reminder", id, "Eliminó un aviso general", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await deleteDoc(doc(db, "generalReminders", id)); }
}

export async function deleteActivityLog(id: string) {
  await deleteDoc(doc(db, "activityLogs", id));
}
