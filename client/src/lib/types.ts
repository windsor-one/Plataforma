/**
 * Sala de Operaciones Editorial: tipos explícitos para que permisos, estados y registros
 * mantengan la misma semántica desde Firestore hasta cada panel de la interfaz.
 */
export type UserRole = "admin" | "personal";
export type EmployeeStatus = "active" | "suspended";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: EmployeeStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface Reservation {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  time: string;
  service: string;
  durationMinutes: number;
  status: ReservationStatus;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  reservationId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
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

