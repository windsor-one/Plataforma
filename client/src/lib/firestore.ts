/**
 * Sala de Operaciones Editorial: operaciones auditables con degradación segura.
 * El registro principal nunca se bloquea por una regla de historial aún no publicada.
 */
import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type { ActivityAction, ActivityEntity, ActivityLog, Customer, Invitation, Payment, Reservation, UserProfile, UserRole } from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "users" | "activityLogs";
type OperationalCollection = "customers" | "reservations" | "payments";
type OperationalPayload = Omit<Customer, "id" | "createdAt" | "updatedAt"> | Omit<Reservation, "id" | "createdAt" | "updatedAt"> | Omit<Payment, "id" | "createdAt" | "updatedAt">;

const normalizedEmail = (email: string) => email.trim().toLowerCase();
const bootstrapAdminEmail = normalizedEmail(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL || "");
const withoutUndefined = (payload: DocumentData) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
const auditWriteBlocked = (error: unknown) => ["permission-denied", "firestore/permission-denied"].includes((error as { code?: string })?.code || "");
const entityFromCollection = (name: OperationalCollection): ActivityEntity => name === "customers" ? "customer" : name === "reservations" ? "reservation" : "payment";
const pluralLabel = (name: OperationalCollection) => name === "customers" ? "clientes" : name === "reservations" ? "reservas" : "pagos";
const recordLabel = (name: OperationalCollection, payload: DocumentData) => name === "customers" ? `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || payload.fullName || "Cliente" : name === "reservations" ? `Reserva de ${payload.customerName || "cliente"}` : `Pago de ${payload.customerName || "cliente"}`;
const operationCode = (name: OperationalCollection, id: string) => name === "reservations" ? `RES-${id.slice(0, 8).toUpperCase()}` : name === "payments" ? `PAG-${id.slice(0, 8).toUpperCase()}` : undefined;

async function activityActor(actorId: string) {
  const snapshot = await getDoc(doc(db, "users", actorId));
  const profile = snapshot.exists() ? snapshot.data() as UserProfile : null;
  return { actorId, actorName: profile?.displayName || "Empleado", actorEmail: profile?.email || "" };
}

function activityEntry(action: ActivityAction, entity: ActivityEntity, entityId: string, summary: string, actor: Awaited<ReturnType<typeof activityActor>>) {
  return { action, entity, entityId, summary, ...actor, occurredAt: serverTimestamp() } satisfies Omit<ActivityLog, "id">;
}

export function subscribeCollection<T extends { id: string }>(name: ManagedCollection, onData: (data: T[]) => void, onError: (error: Error) => void) {
  const sortField = name === "users" ? "createdAt" : name === "activityLogs" ? "occurredAt" : "updatedAt";
  return onSnapshot(query(collection(db, name), orderBy(sortField, "desc")), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)), onError);
}

export async function createRecord(name: OperationalCollection, payload: OperationalPayload) {
  const record = doc(collection(db, name));
  const actor = await activityActor(payload.createdBy);
  const recordPayload = { ...withoutUndefined(payload), ...(operationCode(name, record.id) ? { code: operationCode(name, record.id) } : {}), createdByName: actor.actorName, createdByEmail: actor.actorEmail, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(record, recordPayload);
  batch.set(doc(collection(db, "activityLogs")), activityEntry("created", entityFromCollection(name), record.id, `Creó ${recordLabel(name, payload)}`, actor));
  try { await batch.commit(); } catch (error) { if (!auditWriteBlocked(error)) throw error; await setDoc(record, recordPayload); }
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
