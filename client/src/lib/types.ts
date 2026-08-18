/**
 * Sala de Operaciones Editorial: tipos explícitos para que permisos, estados y registros
 * mantengan la misma semántica desde Firestore hasta cada panel de la interfaz.
 */
export type UserRole = "admin" | "personal";
export type EmployeeStatus = "active" | "suspended";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type PaymentKind = "deposit" | "partial" | "balance" | "full";
export type ActivityAction = "created" | "updated" | "deleted" | "invited" | "profile_updated";
export type ActivityEntity = "customer" | "reservation" | "payment" | "product" | "employee" | "profile" | "reminder" | "access";

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
  productId?: string;
  productName?: string;
  productCategory?: ProductCategory;
  productPrice?: number;
  productUnit?: string;
  customerId: string;
  customerName: string;
  date: string;
  time: string;
  service: string;
  durationMinutes: number;
  status: ReservationStatus;
  totalDue?: number;
  groupName?: string;
  groupSize?: number;
  participantNames?: string[];
  groupBonusEligible?: boolean;
  assignedToId?: string;
  assignedToName?: string;
  assignmentNote?: string;
  notes?: string;
}

export interface Payment extends OperationalAuditFields {
  id: string;
  code?: string;
  productId?: string;
  productName?: string;
  productCategory?: ProductCategory;
  productPrice?: number;
  productUnit?: string;
  customerId: string;
  customerName: string;
  reservationId?: string;
  amount: number;
  kind?: PaymentKind;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  notes?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  event: "login" | "logout" | "account_created";
  summary?: string;
  occurredAt?: unknown;
}

export interface SecuritySettings {
  id: string;
  /** Campo heredado para instalaciones que ya guardaban minutos. */
  inactivityMinutes?: number;
  inactivityValue?: number;
  inactivityUnit?: "seconds" | "minutes" | "hours";
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: unknown;
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

export type ProductCategory = "tariff" | "promotion";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  tagline: string;
  details: Array<{ label: string; value: string }>;
  active: boolean;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
