/**
 * Sala de Operaciones Editorial: operaciones tipadas y auditables. Cada cambio operativo
 * se escribe junto con una entrada inmutable de historial; las reglas siguen siendo la barrera real.
 */
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ActivityAction,
  ActivityEntity,
  ActivityLog,
  Customer,
  Invitation,
  Payment,
  Reservation,
  UserProfile,
  UserRole,
} from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "users" | "activityLogs";
type OperationalCollection = "customers" | "reservations" | "payments";
type OperationalPayload = Omit<Customer, "id" | "createdAt" | "updatedAt"> | Omit<Reservation, "id" | "createdAt" | "updatedAt"> | Omit<Payment, "id" | "createdAt" | "updatedAt">;

const normalizedEmail = (email: string) => email.trim().toLowerCase();
const bootstrapAdminEmail = normalizedEmail(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL || "");

function withoutUndefined(payload: DocumentData) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function entityFromCollection(name: OperationalCollection): ActivityEntity {
  return name === "customers" ? "customer" : name === "reservations" ? "reservation" : "payment";
}

function pluralLabel(name: OperationalCollection) {
  return name === "customers" ? "clientes" : name === "reservations" ? "reservas" : "pagos";
}

function recordLabel(name: OperationalCollection, payload: DocumentData) {
  if (name === "customers") return payload.fullName || "Cliente";
  if (name === "reservations") return `Reserva de ${payload.customerName || "cliente"}`;
  return `Pago de ${payload.customerName || "cliente"}`;
}

async function activityActor(actorId: string) {
  const snapshot = await getDoc(doc(db, "users", actorId));
  const profile = snapshot.exists() ? snapshot.data() as UserProfile : null;
  return {
    actorId,
    actorName: profile?.displayName || "Empleado",
    actorEmail: profile?.email || "",
  };
}

function activityEntry(
  action: ActivityAction,
  entity: ActivityEntity,
  entityId: string,
  summary: string,
  actor: Awaited<ReturnType<typeof activityActor>>,
) {
  return {
    action,
    entity,
    entityId,
    summary,
    ...actor,
    occurredAt: serverTimestamp(),
  } satisfies Omit<ActivityLog, "id">;
}

export function subscribeCollection<T extends { id: string }>(
  name: ManagedCollection,
  onData: (data: T[]) => void,
  onError: (error: Error) => void,
) {
  const sortField = name === "users" ? "createdAt" : name === "activityLogs" ? "occurredAt" : "updatedAt";
  return onSnapshot(
    query(collection(db, name), orderBy(sortField, "desc")),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)),
    (error) => onError(error),
  );
}

export async function createRecord(name: OperationalCollection, payload: OperationalPayload) {
  const record = doc(collection(db, name));
  const actor = await activityActor(payload.createdBy);
  const batch = writeBatch(db);
  batch.set(record, {
    ...withoutUndefined(payload),
    createdByName: actor.actorName,
    createdByEmail: actor.actorEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(collection(db, "activityLogs")),
    activityEntry("created", entityFromCollection(name), record.id, `Creó ${recordLabel(name, payload)}`, actor),
  );
  await batch.commit();
  return record.id;
}

export async function updateRecord(name: OperationalCollection, id: string, payload: DocumentData, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.update(doc(db, name, id), {
    ...withoutUndefined(payload),
    updatedBy: actorId,
    updatedByName: actor.actorName,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(collection(db, "activityLogs")),
    activityEntry("updated", entityFromCollection(name), id, `Actualizó un registro de ${pluralLabel(name)}`, actor),
  );
  await batch.commit();
}

export async function removeRecord(name: OperationalCollection, id: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, name, id));
  batch.set(
    doc(collection(db, "activityLogs")),
    activityEntry("deleted", entityFromCollection(name), id, `Eliminó un registro de ${pluralLabel(name)}`, actor),
  );
  await batch.commit();
}

export async function inviteEmployee(email: string, displayName: string, role: UserRole, invitedBy: string) {
  const normalized = normalizedEmail(email);
  const actor = await activityActor(invitedBy);
  const batch = writeBatch(db);
  batch.set(doc(db, "invitations", normalized), {
    email: normalized,
    displayName: displayName.trim(),
    role,
    status: "pending",
    invitedBy,
    createdAt: serverTimestamp(),
  } satisfies Omit<Invitation, "id">);
  batch.set(
    doc(collection(db, "activityLogs")),
    activityEntry("invited", "employee", normalized, `Invitó a ${displayName.trim() || normalized}`, actor),
  );
  await batch.commit();
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
    if (!bootstrapAdminEmail || email !== bootstrapAdminEmail) {
      throw new Error("No existe una invitación activa para este correo. Pide al administrador que te invite.");
    }
    await setDoc(profileRef, {
      email,
      displayName: user.displayName || email.split("@")[0],
      role: "admin",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const invitation = invitationSnapshot.data() as Omit<Invitation, "id">;
    if (invitation.status !== "pending" || normalizedEmail(invitation.email) !== email) {
      throw new Error("La invitación no está disponible. Solicita una nueva invitación al administrador.");
    }
    await setDoc(profileRef, {
      email,
      displayName: invitation.displayName || user.displayName || email.split("@")[0],
      role: invitation.role,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await updateDoc(invitationRef, {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("El perfil del invitado fue creado, pero no se pudo cerrar la invitación.", error);
    }
  }

  const completed = await getDoc(profileRef);
  if (!completed.exists()) throw new Error("No se pudo finalizar el acceso a la plataforma.");
  return { id: completed.id, ...completed.data() } as UserProfile;
}

export async function updateEmployee(employeeId: string, payload: Pick<UserProfile, "displayName" | "role" | "status">, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.update(doc(db, "users", employeeId), { ...payload, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("updated", "employee", employeeId, `Actualizó el perfil de ${payload.displayName}`, actor));
  await batch.commit();
}

export async function deleteEmployeeProfile(employeeId: string, actorId: string) {
  const actor = await activityActor(actorId);
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", employeeId));
  batch.set(doc(collection(db, "activityLogs")), activityEntry("deleted", "employee", employeeId, "Eliminó un perfil de empleado", actor));
  await batch.commit();
}

export async function updateOwnProfile(userId: string, displayName: string) {
  const actor = await activityActor(userId);
  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId), { displayName: displayName.trim(), updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "activityLogs")), activityEntry("profile_updated", "profile", userId, "Actualizó su nombre de perfil", actor));
  await batch.commit();
}
