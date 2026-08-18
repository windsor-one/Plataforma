/**
 * Sala de Operaciones Editorial: tipos explícitos para que permisos, estados y registros
 * mantengan la misma semántica desde Firestore hasta cada panel de la interfaz.
 */
export type UserRole = "admin" | "personal";
export type EmployeeStatus = "active" | "suspended";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type ActivityAction = "created" | "updated" | "deleted" | "invited" | "profile_updated";
export type ActivityEntity = "customer" | "reservation" | "payment" | "employee" | "profile" | "reminder";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: EmployeeStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface OperationalAuditFields {
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface Customer extends OperationalAuditFields {
  id: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  /** Compatibilidad con clientes creados antes de separar nombres y apellidos. */
  fullName?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface Reservation extends OperationalAuditFields {
  id: string;
  code?: string;
  customerId: string;
  customerName: string;
  date: string;
  time: string;
  service: string;
  durationMinutes: number;
  status: ReservationStatus;
  notes?: string;
}

export interface Payment extends OperationalAuditFields {
  id: string;
  code?: string;
  customerId: string;
  customerName: string;
  reservationId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  notes?: string;
}

export interface Invitation {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: "pending" | "accepted" | "cancelled";
  createdAt?: unknown;
  acceptedAt?: unknown;
  acceptedBy?: string;
  invitedBy: string;
}

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string;
  summary: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  occurredAt?: unknown;
}

export interface GeneralReminder {
  id: string;
  title: string;
  message: string;
  priority: "info" | "important" | "urgent";
  active: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
