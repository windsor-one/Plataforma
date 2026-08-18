/**
 * Sala de Operaciones Editorial: operaciones auditables con degradación segura.
 * El registro principal nunca se bloquea por una regla de historial aún no publicada.
 */
import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type { ActivityAction, ActivityEntity, ActivityLog, Customer, GeneralReminder, Invitation, Payment, Reservation, UserProfile, UserRole } from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "users" | "invitations" | "activityLogs" | "generalReminders";
type OperationalCollection = "customers" | "reservations" | "payments";
type OperationalPayload = Omit<Customer, "id" | "createdAt" | "updatedAt"> | Omit<Reservation, "id" | "createdAt" | "updatedAt"> | Omit<Payment, "id" | "createdAt" | "updatedAt">;

const normalizedEmail = (email: string) => email.trim().toLowerCase();
const bootstrapAdminEmail = normalizedEmail(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL || "");
const withoutUndefined = (payload: DocumentData) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
const auditWriteBlocked = (error: unknown) => ["permission-denied", "firestore/permission-denied"].includes((error as { code?: string })?.code || "");
const entityFromCollection = (name: OperationalCollection): ActivityEntity => name === "customers" ? "customer" : name === "reservations" ? "reservation" : "payment";
const pluralLabel = (name: OperationalCollection) => name === "customers" ? "clientes" : name === "reservations" ? "reservas" : "pagos";
const recordLabel = (name: OperationalCollection, payload: DocumentData) => name === "customers" ? `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || payload.fullName || "Cliente" : name === "reservations" ? `Reserva de ${payload.customerName || "cliente"}` : `Pago de ${payload.customerName || "cliente"}`;
const codePrefix = (name: OperationalCollection) => name === "customers" ? "CLI" : name === "reservations" ? "RES" : "PAG";
const sequentialCode = (name: OperationalCollection, number: number) => `${codePrefix(name)}-${String(number).padStart(5, "0")}`;

async function fallbackSequence(name: OperationalCollection) {
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
  const sortField = name === "users" || name === "invitations" ? "createdAt" : name === "activityLogs" ? "occurredAt" : name === "generalReminders" ? "createdAt" : "updatedAt";
  return onSnapshot(query(collection(db, name), orderBy(sortField, "desc")), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)), onError);
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
  if (profileSnapshot.exists()) return { id: profileSnapshot.id, ...profileSnapshot.data() } as UserProfile;
  const invitationSnapshot = await getDoc(invitationRef);
  if (!invitationSnapshot.exists()) {
    if (!bootstrapAdminEmail || email !== bootstrapAdminEmail) throw new Error("No existe una invitación activa para este correo. Pide al administrador que te invite.");
    await setDoc(profileRef, { email, displayName: user.displayName || email.split("@")[0], role: "admin", status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    const invitation = invitationSnapshot.data() as Omit<Invitation, "id">;
    if (invitation.status !== "pending" || normalizedEmail(invitation.email) !== email) throw new Error("La invitación no está disponible. Solicita una nueva invitación al administrador.");
    await setDoc(profileRef, { email, displayName: invitation.displayName || user.displayName || email.split("@")[0], role: invitation.role, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    try { await updateDoc(invitationRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: serverTimestamp() }); } catch (error) { console.warn("El perfil del invitado fue creado, pero no se pudo cerrar la invitación.", error); }
  }
  const completed = await getDoc(profileRef);
  if (!completed.exists()) throw new Error("No se pudo finalizar el acceso a la plataforma.");
  return { id: completed.id, ...completed.data() } as UserProfile;
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

export async function updateOwnProfile(userId: string, displayName: string) {
  const actor = await activityActor(userId);
  const profilePayload = { displayName: displayName.trim(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId), profilePayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("profile_updated", "profile", userId, "Actualizó su nombre de perfil", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await updateDoc(doc(db, "users", userId), profilePayload); }
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

export async function deleteGeneralReminder(id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "generalReminders", id));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "reminder", id, "Eliminó un aviso general", actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await deleteDoc(doc(db, "generalReminders", id)); }
}
