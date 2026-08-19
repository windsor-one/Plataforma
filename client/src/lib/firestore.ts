/**
 * Sala de Operaciones Editorial: operaciones auditables con degradación segura.
 * El registro principal nunca se bloquea por una regla de historial aún no publicada.
 */
import type { User } from "firebase/auth";
import { Timestamp, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import { sortInternalMessagesNewest } from "./internalMail";
import { sortRecordsNewest, uniqueRecordsById } from "./recordSorting";
import type { AccessLog, ActivityAction, ActivityEntity, ActivityLog, AttendanceGuard, AttendanceRecord, AttendanceSettings, AttendanceType, Automation, CarbonUsage, Customer, EmploymentContract, Expense, GeneralReminder, HrDocument, HrGoal, HrPolicy, HrProfile, Incident, InternalMessage, Invitation, LeaveRequest, LifecycleChecklist, OrganizationUnit, Payment, PaymentAdjustmentRequest, PerformanceReview, PolicyAcknowledgment, Product, ProductCategory, ProductCategorySetting, Recognition, Reservation, SecuritySettings, Task, TemporaryPermission, TrainingRecord, UpdateRequest, UpdateRequestModule, UserProfile, UserRole, WorkSchedule } from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "paymentAdjustmentRequests" | "products" | "productCategorySettings" | "users" | "invitations" | "activityLogs" | "generalReminders" | "accessLogs" | "tasks" | "incidents" | "expenses" | "hrProfiles" | "organizationUnits" | "employmentContracts" | "hrDocuments" | "workSchedules" | "attendanceRecords" | "attendanceGuards" | "updateRequests" | "temporaryPermissions" | "automations" | "leaveRequests" | "lifecycleChecklists" | "hrGoals" | "performanceReviews" | "trainingRecords" | "recognitions" | "hrPolicies" | "policyAcknowledgments" | "internalMessages";
type OperationalCollection = "customers" | "reservations" | "payments";
type CascadingDependentCollection = "reservations" | "payments" | "tasks" | "incidents";
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
const cascadeLabels: Record<CascadingDependentCollection, string> = { reservations: "reservas", payments: "pagos", tasks: "tareas", incidents: "incidencias" };

export type RecordDependencySummary = {
  total: number;
  reservations: number;
  payments: number;
  tasks: number;
  incidents: number;
};

type CascadingDependent = { collection: CascadingDependentCollection; id: string };

const emptyDependencySummary = (): RecordDependencySummary => ({ total: 0, reservations: 0, payments: 0, tasks: 0, incidents: 0 });

const cascadeSummaryText = (summary: RecordDependencySummary) => {
  const parts = (Object.keys(cascadeLabels) as CascadingDependentCollection[]).filter((collectionName) => summary[collectionName]).map((collectionName) => `${summary[collectionName]} ${cascadeLabels[collectionName]}`);
  return parts.length ? parts.join(", ") : "sin registros dependientes";
};

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
  return { actorId, actorName: profile?.displayName || "Empleado", actorEmail: profile?.email || "", actorRole: profile?.role };
}

function activityEntry(action: ActivityAction, entity: ActivityEntity, entityId: string, summary: string, actor: Awaited<ReturnType<typeof activityActor>>) {
  return { action, entity, entityId, summary, ...actor, occurredAt: serverTimestamp() } satisfies Omit<ActivityLog, "id">;
}

export function subscribeCollection<T extends { id: string }>(name: ManagedCollection, onData: (data: T[]) => void, onError: (error: Error) => void) {
  const sortField = name === "users" || name === "invitations" || name === "generalReminders" || name === "products" || name === "internalMessages" ? "createdAt" : name === "activityLogs" || name === "accessLogs" || name === "attendanceRecords" ? "occurredAt" : name === "policyAcknowledgments" ? "acknowledgedAt" : name === "hrPolicies" ? "publishedAt" : "updatedAt";
  return onSnapshot(query(collection(db, name), orderBy(sortField, "desc")), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)), onError);
}

export function subscribeInternalMessages(userId: string, isAdmin: boolean, onData: (data: InternalMessage[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "internalMessages");
  const request = isAdmin ? query(source, orderBy("createdAt", "desc")) : query(source, where("participantIds", "array-contains", userId));
  return onSnapshot(request, (snapshot) => onData(sortInternalMessagesNewest(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as InternalMessage))), onError);
}

export async function assignAttendanceGuard(weekKey: string, guard: Pick<UserProfile, "id" | "displayName">, actorId: string, override = false) {
  const actor = await activityActor(actorId);
  const reference = doc(db, "attendanceGuards", weekKey);
  const previous = await getDoc(reference);
  const payload = { id: weekKey, weekKey, guardUserId: guard.id, guardUserName: guard.displayName, assignedBy: previous.exists() ? String(previous.data().assignedBy || actorId) : actorId, assignedByName: previous.exists() ? String(previous.data().assignedByName || actor.actorName) : actor.actorName, assignedAt: previous.exists() ? previous.data().assignedAt : serverTimestamp(), ...(override ? { overriddenBy: actorId, overriddenAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() } satisfies Omit<AttendanceGuard, "id"> & { id: string };
  const batch = writeBatch(db);
  batch.set(reference, payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(previous.exists() ? "updated" : "created", "attendance", weekKey, `${override ? "Reasignó" : "Asignó"} la guardia semanal a ${guard.displayName}`, actor));
  await batch.commit();
}

export async function recordGuardAttendance(guard: AttendanceGuard, employee: Pick<UserProfile, "id" | "displayName">, type: AttendanceRecord["type"], note = "") {
  const actor = await activityActor(guard.guardUserId);
  const now = new Date(); const dayKey = dayKeyFor(now); const reference = doc(collection(db, "attendanceRecords"));
  const payload = { employeeId: employee.id, employeeName: employee.displayName, type, dayKey, guardWeekKey: guard.weekKey, note: note.trim() || undefined, source: "manual" as const, createdBy: guard.guardUserId, createdByName: actor.actorName, createdByEmail: actor.actorEmail, occurredAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(reference, withoutUndefined(payload));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "attendance", reference.id, `Guardia registró ${type === "clock_in" ? "entrada" : type === "clock_out" ? "salida" : type === "break_start" ? "inicio de descanso" : "fin de descanso"} de ${employee.displayName}`, actor));
  await batch.commit();
  return reference.id;
}

export function subscribeUpdateRequests(userId: string, isAdmin: boolean, onData: (data: UpdateRequest[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "updateRequests");
  const request = isAdmin ? query(source, orderBy("updatedAt", "desc")) : query(source, where("targetUserId", "==", userId));
  return onSnapshot(request, (snapshot) => onData(sortRecordsNewest(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as UpdateRequest), item => item.updatedAt)), onError);
}

/** Las solicitudes de pago se muestran completas a Administración y Departamento de IT, y solo propias al solicitante. */
export function subscribePaymentAdjustmentRequests(userId: string, isAdmin: boolean, onData: (data: PaymentAdjustmentRequest[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "paymentAdjustmentRequests");
  const request = isAdmin ? query(source, orderBy("updatedAt", "desc")) : query(source, where("requestedBy", "==", userId));
  return onSnapshot(request, (snapshot) => onData(sortRecordsNewest(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PaymentAdjustmentRequest), item => item.updatedAt)), onError);
}

type UpdateRequestDraft = Omit<UpdateRequest, "id" | "createdAt" | "updatedAt" | "assignedBy" | "assignedByName" | "expiresAt" | "permissionId">;

const temporaryPermissionId = (userId: string, module: UpdateRequestModule, scope: UpdateRequest["scope"], recordId?: string) => `${userId}__${module}__${scope === "record" ? recordId || "missing" : scope}`.replace(/[^a-zA-Z0-9_-]/g, "_");
const requestExpiry = (deadline: string) => Timestamp.fromDate(new Date(deadline));
const requestNotification = (request: Pick<UpdateRequest, "targetUserId" | "targetUserName" | "module" | "scope" | "allowedActions" | "deadline" | "fields" | "instructions" | "targetRecordLabel">, actor: Awaited<ReturnType<typeof activityActor>>, subject: string, intro: string) => {
  const actionText = request.allowedActions.includes("delete") ? "editar o eliminar" : "editar";
  const scopeText = request.scope === "record" ? `el registro «${request.targetRecordLabel || "asignado"}»` : request.scope === "self" ? "tu información propia" : `el módulo ${request.module}`;
  return {
    senderId: actor.actorId,
    senderName: actor.actorName,
    senderEmail: actor.actorEmail,
    recipientIds: [request.targetUserId],
    participantIds: [actor.actorId, request.targetUserId],
    subject,
    body: `${intro}\n\nTienes autorización temporal para ${actionText} en ${scopeText} hasta ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.deadline))}.\n\nCampos o resultado: ${request.fields.join(", ") || "Según indicaciones"}.${request.instructions ? `\n\nIndicaciones: ${request.instructions}` : ""}`,
    status: "sent" as const,
    readByIds: [actor.actorId],
  };
};

function temporaryPermissionPayload(requestId: string, request: UpdateRequestDraft, status: TemporaryPermission["status"] = "active") {
  const permissionId = temporaryPermissionId(request.targetUserId, request.module, request.scope, request.targetRecordId);
  return {
    id: permissionId,
    requestId,
    userId: request.targetUserId,
    module: request.module,
    scope: request.scope,
    recordId: request.targetRecordId,
    actions: request.allowedActions,
    expiresAt: requestExpiry(request.deadline),
    status,
    updatedAt: serverTimestamp(),
  };
}

export async function saveUpdateRequest(record: UpdateRequestDraft, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = doc(collection(db, "updateRequests"));
  const permission = temporaryPermissionPayload(reference.id, record);
  const payload = { ...withoutUndefined(record as unknown as DocumentData), id: reference.id, assignedBy: actorId, assignedByName: actor.actorName, permissionId: permission.id, expiresAt: permission.expiresAt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const mailReference = doc(collection(db, "internalMessages"));
  const batch = writeBatch(db);
  batch.set(reference, payload);
  batch.set(doc(db, "temporaryPermissions", permission.id), { ...permission, createdAt: serverTimestamp() });
  batch.set(mailReference, { ...requestNotification(record, actor, `Nueva solicitud: ${record.module}`, "Administración o el Departamento de IT te asignaron una solicitud de actualización."), id: mailReference.id, sentAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "profile", reference.id, `Asignó permiso temporal de ${record.module} a ${record.targetUserName}`, actor));
  await batch.commit();
  return reference.id;
}

export async function completeUpdateRequest(id: string, userId: string) {
  const actor = await activityActor(userId);
  const reference = doc(db, "updateRequests", id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new Error("La solicitud ya no existe.");
  const request = { id: snapshot.id, ...snapshot.data() } as UpdateRequest;
  const batch = writeBatch(db);
  batch.update(reference, { status: "completed", completedAt: serverTimestamp(), completedBy: userId, updatedAt: serverTimestamp() });
  if (request.permissionId) batch.set(doc(db, "temporaryPermissions", request.permissionId), { status: "revoked", updatedAt: serverTimestamp() }, { merge: true });
  if (request.assignedBy) { const mailReference = doc(collection(db, "internalMessages")); batch.set(mailReference, { id: mailReference.id, senderId: actor.actorId, senderName: actor.actorName, senderEmail: actor.actorEmail, recipientIds: [request.assignedBy], participantIds: [actor.actorId, request.assignedBy], subject: `Solicitud completada: ${request.module}`, body: `${request.targetUserName} marcó como completada la solicitud «${request.fields.join(", ") || request.module}». El permiso temporal fue revocado.`, status: "sent", sentAt: serverTimestamp(), readByIds: [actor.actorId], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "profile", id, "Completó una solicitud de actualización asignada.", actor));
  await batch.commit();
}

export async function updateUpdateRequest(id: string, record: UpdateRequestDraft, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = doc(db, "updateRequests", id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new Error("La solicitud ya no existe.");
  const existing = { id: snapshot.id, ...snapshot.data() } as UpdateRequest;
  const active = record.status === "pending" && new Date(record.deadline).getTime() > Date.now();
  const permission = temporaryPermissionPayload(id, record, active ? "active" : "revoked");
  const mailReference = doc(collection(db, "internalMessages"));
  const batch = writeBatch(db);
  if (existing.permissionId && existing.permissionId !== permission.id) batch.set(doc(db, "temporaryPermissions", existing.permissionId), { status: "revoked", updatedAt: serverTimestamp() }, { merge: true });
  batch.set(reference, { ...withoutUndefined(record as unknown as DocumentData), permissionId: permission.id, expiresAt: permission.expiresAt, updatedAt: serverTimestamp(), updatedBy: actorId, updatedByName: actor.actorName }, { merge: true });
  batch.set(doc(db, "temporaryPermissions", permission.id), { ...permission, createdAt: existing.createdAt || serverTimestamp() }, { merge: true });
  const changeIntro = record.status === "rejected" ? `La solicitud fue rechazada.${record.decisionReason ? ` Motivo: ${record.decisionReason}` : ""}` : record.status === "cancelled" ? `La solicitud fue cancelada.${record.decisionReason ? ` Motivo: ${record.decisionReason}` : ""}` : record.status === "completed" ? "La solicitud fue cerrada por Administración o el Departamento de IT." : "Administración o el Departamento de IT modificaron tu solicitud y permiso temporal.";
  batch.set(mailReference, { ...requestNotification(record, actor, `Solicitud actualizada: ${record.module}`, changeIntro), id: mailReference.id, sentAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "profile", id, `Actualizó la solicitud de ${record.module} para ${record.targetUserName}.`, actor));
  await batch.commit();
}

export async function deleteUpdateRequest(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = doc(db, "updateRequests", id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) return;
  const request = { id: snapshot.id, ...snapshot.data() } as UpdateRequest;
  const mailReference = doc(collection(db, "internalMessages"));
  const batch = writeBatch(db);
  batch.delete(reference);
  if (request.permissionId) batch.set(doc(db, "temporaryPermissions", request.permissionId), { status: "revoked", updatedAt: serverTimestamp() }, { merge: true });
  batch.set(mailReference, { ...requestNotification(request, actor, `Solicitud cancelada: ${request.module}`, "Administración o el Departamento de IT eliminaron la solicitud. Cualquier permiso temporal asociado fue revocado."), id: mailReference.id, sentAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "profile", id, `Eliminó una solicitud de actualización para ${request.targetUserName}.`, actor));
  await batch.commit();
}

export async function requestPaymentAdjustment(payment: Payment, reason: string, proposedChanges: PaymentAdjustmentRequest["proposedChanges"], actorId: string) {
  if (!reason.trim()) throw new Error("Indica el motivo del ajuste solicitado.");
  if (!Object.keys(proposedChanges).length) throw new Error("Selecciona al menos un dato que deba corregirse.");
  const actor = await activityActor(actorId);
  const reference = doc(collection(db, "paymentAdjustmentRequests"));
  const payload: Omit<PaymentAdjustmentRequest, "createdAt" | "updatedAt"> = { id: reference.id, paymentId: payment.id, paymentCode: payment.code, requestedBy: actorId, requestedByName: actor.actorName, reason: reason.trim(), proposedChanges, status: "pending" };
  const recipients = (await getDocs(collection(db, "users"))).docs
    .map((item) => ({ id: item.id, ...item.data() } as UserProfile))
    .filter((profile) => profile.status === "active" && (profile.role === "admin" || profile.role === "it"))
    .map((profile) => profile.id);
  const batch = writeBatch(db);
  batch.set(reference, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (recipients.length) {
    const mailReference = doc(collection(db, "internalMessages"));
    batch.set(mailReference, {
      id: mailReference.id,
      senderId: actor.actorId,
      senderName: actor.actorName,
      senderEmail: actor.actorEmail,
      recipientIds: recipients,
      participantIds: Array.from(new Set([actor.actorId, ...recipients])),
      subject: `Solicitud de ajuste: ${payment.code || payment.id}`,
      body: `${actor.actorName} solicita ajustar el pago ${payment.code || payment.id}.\n\nMotivo: ${reason.trim()}\n\nCampos propuestos: ${Object.keys(proposedChanges).join(", ")}.\n\nRevisa la solicitud desde Pagos antes de aprobarla o rechazarla.`,
      status: "sent",
      sentAt: serverTimestamp(),
      readByIds: [actor.actorId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", "payment", payment.id, `Solicitó ajuste justificado del pago ${payment.code || payment.id}.`, actor));
  await batch.commit();
  return reference.id;
}

function paymentAdjustmentDecisionMessage(request: PaymentAdjustmentRequest, actor: Awaited<ReturnType<typeof activityActor>>, approved: boolean, reason: string) {
  return {
    senderId: actor.actorId,
    senderName: actor.actorName,
    senderEmail: actor.actorEmail,
    recipientIds: [request.requestedBy],
    participantIds: [actor.actorId, request.requestedBy],
    subject: `${approved ? "Ajuste aprobado" : "Ajuste rechazado"}: ${request.paymentCode || request.paymentId}`,
    body: approved
      ? `Se aprobó y aplicó el ajuste solicitado para el pago ${request.paymentCode || request.paymentId}.${reason.trim() ? `\n\nObservación administrativa: ${reason.trim()}` : ""}`
      : `Se rechazó el ajuste solicitado para el pago ${request.paymentCode || request.paymentId}.${reason.trim() ? `\n\nMotivo: ${reason.trim()}` : ""}`,
    status: "sent" as const,
    sentAt: serverTimestamp(),
    readByIds: [actor.actorId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Aprueba y aplica una corrección en una transacción: el pago y su dictamen nunca se separan. */
export async function approvePaymentAdjustmentRequest(requestId: string, decisionReason: string, actorId: string) {
  const actor = await activityActor(actorId);
  const requestRef = doc(db, "paymentAdjustmentRequests", requestId);
  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) throw new Error("La solicitud de ajuste ya no existe.");
    const request = { id: requestSnapshot.id, ...requestSnapshot.data() } as PaymentAdjustmentRequest;
    if (request.status !== "pending") throw new Error("Esta solicitud ya fue resuelta.");
    const paymentRef = doc(db, "payments", request.paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error("El pago asociado ya no existe.");
    const mailReference = doc(collection(db, "internalMessages"));
    transaction.update(paymentRef, {
      ...withoutUndefined(request.proposedChanges as DocumentData),
      lastAdjustmentRequestId: request.id,
      updatedBy: actorId,
      updatedByName: actor.actorName,
      updatedAt: serverTimestamp(),
    });
    transaction.update(requestRef, {
      status: "approved",
      decisionReason: decisionReason.trim() || deleteField(),
      decidedBy: actorId,
      decidedByName: actor.actorName,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(mailReference, { id: mailReference.id, ...paymentAdjustmentDecisionMessage(request, actor, true, decisionReason) });
    transaction.set(doc(collection(db, "activityLogs")), activityEntry("updated", "payment", request.paymentId, `Aprobó y aplicó el ajuste del pago ${request.paymentCode || request.paymentId}.`, actor));
  });
}

export async function rejectPaymentAdjustmentRequest(requestId: string, decisionReason: string, actorId: string) {
  const actor = await activityActor(actorId);
  const requestRef = doc(db, "paymentAdjustmentRequests", requestId);
  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) throw new Error("La solicitud de ajuste ya no existe.");
    const request = { id: requestSnapshot.id, ...requestSnapshot.data() } as PaymentAdjustmentRequest;
    if (request.status !== "pending") throw new Error("Esta solicitud ya fue resuelta.");
    const mailReference = doc(collection(db, "internalMessages"));
    transaction.update(requestRef, {
      status: "rejected",
      decisionReason: decisionReason.trim() || deleteField(),
      decidedBy: actorId,
      decidedByName: actor.actorName,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(mailReference, { id: mailReference.id, ...paymentAdjustmentDecisionMessage(request, actor, false, decisionReason) });
    transaction.set(doc(collection(db, "activityLogs")), activityEntry("updated", "payment", request.paymentId, `Rechazó el ajuste solicitado para el pago ${request.paymentCode || request.paymentId}.`, actor));
  });
}

export async function saveAutomation(record: Omit<Automation, "id" | "createdAt" | "updatedAt" | "createdByName"> & { id?: string }, actorId: string) {
  const actor = await activityActor(actorId);
  const reference = record.id ? doc(db, "automations", record.id) : doc(collection(db, "automations"));
  const existing = await getDoc(reference);
  const payload = { ...withoutUndefined(record as unknown as DocumentData), id: reference.id, createdBy: existing.exists() ? existing.data().createdBy : actorId, createdByName: existing.exists() ? existing.data().createdByName : actor.actorName, runCount: existing.exists() ? existing.data().runCount || 0 : 0, createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(reference, payload, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry(existing.exists() ? "updated" : "created", "task", reference.id, `${existing.exists() ? "Actualizó" : "Creó"} la automatización ${record.name}`, actor));
  await batch.commit();
  return reference.id;
}

export async function setAutomationStatus(id: string, status: Automation["status"], actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.update(doc(db, "automations", id), { status, updatedAt: serverTimestamp(), updatedBy: actorId });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "task", id, `${status === "active" ? "Reanudó" : "Pausó"} una automatización`, actor));
  await batch.commit();
}

export async function removeAutomation(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "automations", id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "task", id, "Eliminó una automatización", actor));
  await batch.commit();
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
  const sortField = name === "attendanceRecords" ? "occurredAt" : name === "policyAcknowledgments" ? "acknowledgedAt" : "updatedAt";
  if (!isAdmin && name === "recognitions") {
    let own: T[] = [];
    let company: T[] = [];
    const emit = () => onData(sortRecordsNewest(uniqueRecordsById(own, company), item => (item as Record<string, unknown>)[sortField]));
    const stopOwn = onSnapshot(query(source, where("employeeId", "==", employeeId)), (snapshot) => {
      own = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
      emit();
    }, onError);
    const stopCompany = onSnapshot(query(source, where("visibility", "==", "company")), (snapshot) => {
      company = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
      emit();
    }, onError);
    return () => { stopOwn(); stopCompany(); };
  }
  const request = isAdmin ? query(source, orderBy(sortField, "desc")) : query(source, where("employeeId", "==", employeeId));
  return onSnapshot(request, (snapshot) => onData(sortRecordsNewest(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T), item => (item as Record<string, unknown>)[sortField])), onError);
}

export function subscribeHrPolicies(isAdmin: boolean, onData: (data: HrPolicy[]) => void, onError: (error: Error) => void) {
  const source = collection(db, "hrPolicies");
  const request = isAdmin ? query(source, orderBy("publishedAt", "desc")) : query(source, where("active", "==", true));
  return onSnapshot(request, (snapshot) => onData(sortRecordsNewest(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as HrPolicy), item => item.publishedAt)), onError);
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
  const reference = doc(db, name, id);
  const existing = await getDoc(reference);
  if (!existing.exists()) return;
  const profileReferences: Array<{ id: string; idField: keyof HrProfile; nameField: keyof HrProfile; label: string }> = [];
  let childUnits: Array<{ id: string }> = [];
  if (name === "organizationUnits") {
    const unit = existing.data() as OrganizationUnit;
    const fields: Record<OrganizationUnit["kind"], { idField: keyof HrProfile; nameField: keyof HrProfile; label: string }> = {
      department: { idField: "departmentId", nameField: "department", label: "departamento" },
      area: { idField: "areaId", nameField: "area", label: "área" },
      team: { idField: "teamId", nameField: "team", label: "equipo" },
      position: { idField: "positionId", nameField: "position", label: "cargo" },
      site: { idField: "siteId", nameField: "site", label: "sede" },
    };
    const fieldsToClear = fields[unit.kind];
    const [profiles, children] = await Promise.all([
      getDocs(query(collection(db, "hrProfiles"), where(fieldsToClear.idField, "==", id))),
      getDocs(query(collection(db, "organizationUnits"), where("parentId", "==", id))),
    ]);
    profiles.docs.forEach((profile) => profileReferences.push({ id: profile.id, idField: fieldsToClear.idField, nameField: fieldsToClear.nameField, label: fieldsToClear.label }));
    childUnits = children.docs.map((child) => ({ id: child.id }));
  }
  if (name === "workSchedules") {
    const profiles = await getDocs(query(collection(db, "hrProfiles"), where("scheduleId", "==", id)));
    profiles.docs.forEach((profile) => profileReferences.push({ id: profile.id, idField: "scheduleId", nameField: "scheduleName", label: "horario" }));
  }
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  profileReferences.forEach((profile) => operations.push((batch) => {
    batch.update(doc(db, "hrProfiles", profile.id), { [profile.idField]: deleteField(), [profile.nameField]: deleteField(), updatedAt: serverTimestamp(), updatedBy: actorId, updatedByName: actor.actorName });
    batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "hr_profile", profile.id, `Retiró la referencia de ${profile.label} al eliminar una configuración organizativa.`, actor));
  }));
  childUnits.forEach((child) => operations.push((batch) => {
    batch.update(doc(db, "organizationUnits", child.id), { parentId: deleteField(), parentName: deleteField(), updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "hr_profile", child.id, "Desvinculó una unidad organizativa de su unidad padre eliminada.", actor));
  }));
  operations.push((batch) => {
    batch.delete(reference);
    batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", hrEntityForCollection[name], id, summary, actor));
  });
  for (let index = 0; index < operations.length; index += 200) {
    const batch = writeBatch(db);
    operations.slice(index, index + 200).forEach((operation) => operation(batch));
    await batch.commit();
  }
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

/** Administración o el Departamento de IT pueden registrar o corregir marcaciones sin perder al responsable ni la trazabilidad. */
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

/** Administración o el Departamento de IT pueden ajustar íntegramente una ausencia cuando el Personal cometió un error de captura. */
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
  const isReservationUnassignment = name === "reservations" && payload.assignedToId === undefined && payload.assignedToName === "";
  const recordPayload = {
    ...withoutUndefined(payload),
    ...(isReservationUnassignment ? { assignedToId: deleteField(), assignedToName: deleteField(), assignmentNote: deleteField() } : {}),
    updatedBy: actorId,
    updatedByName: actor.actorName,
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.update(doc(db, name, id), recordPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", entityFromCollection(name), id, `Actualizó un registro de ${pluralLabel(name)}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, name, id), recordPayload); }
}

async function documentsWithField(collectionName: CascadingDependentCollection, field: "customerId" | "reservationId", values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  if (!uniqueValues.length) return [];
  const chunks = Array.from({ length: Math.ceil(uniqueValues.length / 30) }, (_, index) => uniqueValues.slice(index * 30, index * 30 + 30));
  const snapshots = await Promise.all(chunks.map((valuesChunk) => valuesChunk.length === 1
    ? getDocs(query(collection(db, collectionName), where(field, "==", valuesChunk[0])))
    : getDocs(query(collection(db, collectionName), where(field, "in", valuesChunk)))));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ collection: collectionName, id: item.id } as CascadingDependent)));
}

async function cascadingDependents(name: OperationalCollection, id: string) {
  if (name === "payments") return [] as CascadingDependent[];
  if (name === "reservations") {
    const [payments, tasks, incidents] = await Promise.all([
      documentsWithField("payments", "reservationId", [id]),
      documentsWithField("tasks", "reservationId", [id]),
      documentsWithField("incidents", "reservationId", [id]),
    ]);
    return [...payments, ...tasks, ...incidents];
  }
  const [reservations, customerPayments, customerTasks, customerIncidents] = await Promise.all([
    documentsWithField("reservations", "customerId", [id]),
    documentsWithField("payments", "customerId", [id]),
    documentsWithField("tasks", "customerId", [id]),
    documentsWithField("incidents", "customerId", [id]),
  ]);
  const reservationIds = reservations.map((reservation) => reservation.id);
  const [reservationPayments, reservationTasks, reservationIncidents] = await Promise.all([
    documentsWithField("payments", "reservationId", reservationIds),
    documentsWithField("tasks", "reservationId", reservationIds),
    documentsWithField("incidents", "reservationId", reservationIds),
  ]);
  const unique = new Map<string, CascadingDependent>();
  [...reservations, ...customerPayments, ...customerTasks, ...customerIncidents, ...reservationPayments, ...reservationTasks, ...reservationIncidents].forEach((item) => unique.set(`${item.collection}/${item.id}`, item));
  return Array.from(unique.values());
}

export async function getRecordDependencySummary(name: OperationalCollection, id: string): Promise<RecordDependencySummary> {
  const summary = emptyDependencySummary();
  const dependents = await cascadingDependents(name, id);
  dependents.forEach((dependent) => { summary[dependent.collection] += 1; summary.total += 1; });
  return summary;
}

async function commitCascadingDeletion(name: OperationalCollection, id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const dependents = await cascadingDependents(name, id);
  const requiresAdministrativeDeletion = dependents.some((dependent) => dependent.collection === "tasks" || dependent.collection === "incidents");
  if (requiresAdministrativeDeletion && actor.actorRole !== "admin" && actor.actorRole !== "it") {
    throw new Error("La eliminación incluye tareas o incidencias vinculadas y requiere Administración o Departamento de IT.");
  }
  const summary = emptyDependencySummary();
  dependents.forEach((dependent) => { summary[dependent.collection] += 1; summary.total += 1; });
  const targets = [{ collection: name, id }, ...dependents];
  const groups = Array.from({ length: Math.ceil(targets.length / 200) }, (_, index) => targets.slice(index * 200, index * 200 + 200));
  for (const group of groups) {
    const batch = writeBatch(db);
    group.forEach((target) => {
      batch.delete(doc(db, target.collection, target.id));
      const entity = target.collection === "customers" ? "customer" : target.collection === "reservations" ? "reservation" : target.collection === "payments" ? "payment" : target.collection === "tasks" ? "task" : "incident";
      const message = target.collection === name && target.id === id
        ? `Eliminó un registro de ${pluralLabel(name)}${summary.total ? ` junto con ${cascadeSummaryText(summary)}` : ""}`
        : `Eliminó ${cascadeLabels[target.collection as CascadingDependentCollection]} vinculadas a un registro eliminado de ${pluralLabel(name)}`;
      batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", entity, target.id, message, actor));
    });
    try { await batch.commit(); } catch (error) {
      if (!auditWriteBlocked(error)) throw error;
      await Promise.all(group.map((target) => deleteDoc(doc(db, target.collection, target.id))));
    }
  }
  return summary;
}

export async function removeRecord(name: OperationalCollection, id: string, actorId: string) {
  return commitCascadingDeletion(name, id, actorId);
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
  for (const id of uniqueIds) await commitCascadingDeletion(name, id, actorId);
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
    const onboarding = writeBatch(db);
    onboarding.set(profileRef, { email, displayName: invitation.displayName || user.displayName || email.split("@")[0], role: invitation.role, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    onboarding.update(invitationRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: serverTimestamp() });
    await onboarding.commit();
    accountCreated = true;
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

export function subscribeProductCategorySettings(onData: (data: ProductCategorySetting[]) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(db, "productCategorySettings"), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProductCategorySetting)), onError);
}

/** Persiste el nombre visible de una categoría sin reescribir paquetes ni su historial. */
export async function saveProductCategorySetting(category: ProductCategory, label: string, actorId: string) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) throw new Error("Escribe un nombre visible para la categoría.");
  const actor = await activityActor(actorId);
  const reference = doc(db, "productCategorySettings", category);
  const batch = writeBatch(db);
  batch.set(reference, { id: category, label: normalizedLabel, updatedBy: actorId, updatedByName: actor.actorName, updatedAt: serverTimestamp() } satisfies Omit<ProductCategorySetting, "createdAt">, { merge: true });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "product", category, `Actualizó el nombre visible de la categoría «${normalizedLabel}».`, actor));
  await batch.commit();
}

export async function clearReservationAssignment(reservationId: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.update(doc(db, "reservations", reservationId), { assignedToId: deleteField(), assignedToName: deleteField(), assignmentNote: deleteField(), updatedAt: serverTimestamp(), updatedBy: actorId, updatedByName: actor.actorName });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "reservation", reservationId, "Retiró la asignación de responsable de la reserva.", actor));
  await batch.commit();
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
