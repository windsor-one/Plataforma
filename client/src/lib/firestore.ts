/**
 * Sala de Operaciones Editorial: operaciones cortas, tipadas y auditables para Firestore.
 * La autorización real no vive aquí; está reforzada por firestore.rules.
 */
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Customer,
  Invitation,
  Payment,
  Reservation,
  UserProfile,
  UserRole,
} from "./types";

type ManagedCollection = "customers" | "reservations" | "payments" | "users";

const normalizedEmail = (email: string) => email.trim().toLowerCase();

export function subscribeCollection<T extends { id: string }>(
  name: ManagedCollection,
  onData: (data: T[]) => void,
  onError: (error: Error) => void,
) {
  const sortField = name === "users" ? "createdAt" : "updatedAt";
  return onSnapshot(
    query(collection(db, name), orderBy(sortField, "desc")),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)),
    (error) => onError(error),
  );
}

export async function createRecord(
  name: "customers" | "reservations" | "payments",
  payload: Omit<Customer, "id" | "createdAt" | "updatedAt"> | Omit<Reservation, "id" | "createdAt" | "updatedAt"> | Omit<Payment, "id" | "createdAt" | "updatedAt">,
) {
  const record = doc(collection(db, name));
  await setDoc(record, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateRecord(
  name: "customers" | "reservations" | "payments",
  id: string,
  payload: DocumentData,
) {
  await updateDoc(doc(db, name, id), { ...payload, updatedAt: serverTimestamp() });
}

export async function removeRecord(name: "customers" | "reservations" | "payments", id: string) {
  await deleteDoc(doc(db, name, id));
}

export async function inviteEmployee(
  email: string,
  displayName: string,
  role: UserRole,
  invitedBy: string,
) {
  const normalized = normalizedEmail(email);
  await setDoc(doc(db, "invitations", normalized), {
    email: normalized,
    displayName: displayName.trim(),
    role,
    status: "pending",
    invitedBy,
    createdAt: serverTimestamp(),
  } satisfies Omit<Invitation, "id">);
  return normalized;
}

export async function completeInvitationOnboarding(user: User): Promise<UserProfile> {
  if (!user.email) throw new Error("Tu cuenta no tiene un correo electrónico válido.");
  const email = normalizedEmail(user.email);
  const profileRef = doc(db, "users", user.uid);
  const invitationRef = doc(db, "invitations", email);

  await runTransaction(db, async (transaction) => {
    const [profileSnapshot, invitationSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(invitationRef),
    ]);

    if (profileSnapshot.exists()) return;
    if (!invitationSnapshot.exists()) {
      throw new Error("No existe una invitación activa para este correo. Pide al administrador que te invite.");
    }

    const invitation = invitationSnapshot.data() as Omit<Invitation, "id">;
    if (invitation.status !== "pending" || invitation.email !== email) {
      throw new Error("La invitación no está disponible. Solicita una nueva invitación al administrador.");
    }

    transaction.set(profileRef, {
      email,
      displayName: invitation.displayName || user.displayName || email.split("@")[0],
      role: invitation.role,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(invitationRef, {
      status: "accepted",
      acceptedBy: user.uid,
      acceptedAt: serverTimestamp(),
    });
  });

  const completed = await getDoc(profileRef);
  if (!completed.exists()) throw new Error("No se pudo finalizar el acceso a la plataforma.");
  return { id: completed.id, ...completed.data() } as UserProfile;
}

export async function updateEmployee(
  employeeId: string,
  payload: Pick<UserProfile, "displayName" | "role" | "status">,
) {
  await updateDoc(doc(db, "users", employeeId), { ...payload, updatedAt: serverTimestamp() });
}

export async function deleteEmployeeProfile(employeeId: string) {
  await deleteDoc(doc(db, "users", employeeId));
}

export async function updateOwnProfile(userId: string, displayName: string) {
  await updateDoc(doc(db, "users", userId), { displayName: displayName.trim(), updatedAt: serverTimestamp() });
}

