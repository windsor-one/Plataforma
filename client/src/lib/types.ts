/**
 * Sala de Operaciones Editorial: tipos explícitos para que permisos, estados y registros
 * mantengan la misma semántica desde Firestore hasta cada panel de la interfaz.
 */
/** Jerarquía de acceso: IT controla la plataforma; Administración opera los módulos esenciales; Personal trabaja en sus propios flujos. */
export type UserRole = "it" | "admin" | "personal";
export type EmployeeStatus = "active" | "suspended";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "refunded";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type PaymentKind = "deposit" | "partial" | "balance" | "full";
export type TaskStatus = "pending" | "in_progress" | "review" | "completed" | "cancelled";
export type IncidentStatus = "reported" | "investigating" | "resolved" | "closed";
export type WorkPriority = "low" | "medium" | "high" | "urgent";
export type ExpenseStatus = "pending" | "approved" | "paid" | "cancelled";
export type ExpenseCategory = "materials" | "equipment" | "transport" | "marketing" | "services" | "payroll" | "other";
export type EmploymentStatus = "active" | "suspended" | "vacation" | "leave" | "terminated";
export type WorkMode = "onsite" | "remote" | "hybrid";
export type ContractType = "indefinite" | "fixed_term" | "temporary" | "internship" | "service";
export type OrganizationUnitKind = "department" | "area" | "team" | "position" | "site";
export type DocumentStatus = "valid" | "expiring" | "expired" | "pending";
export type LeaveType = "vacation" | "personal" | "medical" | "academic" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type AttendanceType = "clock_in" | "clock_out" | "break_start" | "break_end";
export type ReviewStatus = "draft" | "shared" | "acknowledged";
export type ActivityAction = "created" | "updated" | "deleted" | "invited" | "profile_updated";
export type ActivityEntity = "customer" | "reservation" | "payment" | "product" | "employee" | "profile" | "reminder" | "access" | "task" | "incident" | "expense" | "hr_profile" | "contract" | "document" | "attendance" | "leave" | "goal" | "review" | "training" | "recognition" | "policy";

export interface InternalAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  storagePath: string;
}

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  recipientIds: string[];
  participantIds: string[];
  subject: string;
  body: string;
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: string;
  sentAt?: unknown;
  readByIds?: string[];
  attachments?: InternalAttachment[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: EmployeeStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Expediente privado: titular y Administración/IT. No se mezcla con el perfil de acceso. */
export interface HrProfile extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeCode?: string;
  personalEmail?: string;
  personalPhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  birthDate?: string;
  nationality?: string;
  maritalStatus?: string;
  departmentId?: string;
  department?: string;
  areaId?: string;
  area?: string;
  teamId?: string;
  team?: string;
  positionId?: string;
  position?: string;
  siteId?: string;
  supervisorId?: string;
  supervisorName?: string;
  startDate?: string;
  contractType?: ContractType;
  workDay?: string;
  scheduleId?: string;
  scheduleName?: string;
  workMode?: WorkMode;
  site?: string;
  employmentStatus?: EmploymentStatus;
  vacationAllowanceDays?: number;
  vacationUsedDays?: number;
  notes?: string;
}

export interface OrganizationUnit extends OperationalAuditFields {
  id: string;
  name: string;
  kind: OrganizationUnitKind;
  parentId?: string;
  parentName?: string;
  leaderId?: string;
  leaderName?: string;
  active: boolean;
}

export interface EmploymentContract extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  contractType: ContractType;
  status: "draft" | "active" | "expiring" | "ended";
  startDate: string;
  endDate?: string;
  position?: string;
  workDay?: string;
  workMode?: WorkMode;
  salaryAmount?: number;
  currency?: string;
  notes?: string;
}

/** El documento físico se guarda fuera de Firestore; aquí queda su expediente y vigencia. */
export interface HrDocument extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  name: string;
  type: "identity" | "contract" | "cv" | "certificate" | "training" | "evaluation" | "other";
  status: DocumentStatus;
  issuedAt?: string;
  expiresAt?: string;
  private: boolean;
  referenceUrl?: string;
  notes?: string;
}

export interface WorkSchedule extends OperationalAuditFields {
  id: string;
  name: string;
  days: string[];
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  active: boolean;
}

export interface AttendanceRecord extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AttendanceType;
  dayKey?: string;
  occurredAt?: unknown;
  note?: string;
  source: "manual" | "self_service";
  correctionReason?: string;
  /** Semana ISO de la guardia que capturó la marcación colectiva, cuando aplica. */
  guardWeekKey?: string;
  adjustedAt?: unknown;
  adjustedBy?: string;
  adjustedByName?: string;
}

/** Persona responsable de capturar la asistencia colectiva de una semana laboral. */
export interface AttendanceGuard {
  id: string;
  weekKey: string;
  guardUserId: string;
  guardUserName: string;
  assignedBy: string;
  assignedByName?: string;
  assignedAt?: unknown;
  overriddenBy?: string;
  overriddenAt?: unknown;
  updatedAt?: unknown;
}

export type UpdateRequestModule = "profile" | "hr" | "products" | "tasks" | "reservations" | "customers" | "payments" | "employees" | "other";
export type UpdateRequestAction = "edit" | "delete";
export type UpdateRequestStatus = "pending" | "completed" | "expired" | "cancelled" | "rejected";

/** Solicitud administrativa que puede delegar, de forma temporal y limitada, una acción concreta. */
export interface UpdateRequest {
  id: string;
  targetUserId: string;
  targetUserName: string;
  module: UpdateRequestModule;
  scope: "self" | "record" | "module";
  targetRecordId?: string;
  targetRecordLabel?: string;
  allowedActions: UpdateRequestAction[];
  permissionId?: string;
  fields: string[];
  instructions?: string;
  deadline: string;
  /** Marca de tiempo comparable desde las reglas de Firestore. */
  expiresAt?: unknown;
  status: UpdateRequestStatus;
  decisionReason?: string;
  assignedBy: string;
  assignedByName?: string;
  createdAt?: unknown;
  completedAt?: unknown;
  updatedAt?: unknown;
}

/** Espejo de una solicitud pendiente que las reglas usan para permitir una acción concreta hasta su vencimiento. */
export interface TemporaryPermission {
  id: string;
  requestId: string;
  userId: string;
  module: UpdateRequestModule;
  scope: "self" | "record" | "module";
  recordId?: string;
  actions: UpdateRequestAction[];
  expiresAt: unknown;
  status: "active" | "revoked" | "expired";
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Regla determinista administrada por personas autorizadas y ejecutada con trazabilidad. */
export interface Automation {
  id: string;
  name: string;
  trigger: "weekly_attendance" | "contract_expiry" | "document_expiry" | "update_deadline";
  action: "assign_guard" | "create_task" | "send_notification" | "close_request";
  description?: string;
  status: "active" | "paused";
  createdBy: string;
  createdByName?: string;
  lastRunAt?: unknown;
  runCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceWindow {
  startTime: string;
  endTime: string;
  maxPerDay: number;
}

/** Política global para la marcación personal; Administración/IT es la única entidad que la modifica. */
export interface AttendanceSettings {
  id: "global";
  timezone?: string;
  clockIn: AttendanceWindow;
  clockOut: AttendanceWindow;
  breakStart: AttendanceWindow;
  breakEnd: AttendanceWindow;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: unknown;
}

export interface LeaveRequest extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewerComment?: string;
}

export interface LifecycleChecklist extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  stage: "onboarding" | "offboarding";
  title: string;
  ownerId?: string;
  ownerName?: string;
  status: "pending" | "in_progress" | "completed";
  dueDate?: string;
  notes?: string;
}

export interface HrGoal extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  target?: string;
  progress: number;
  dueDate?: string;
  status: "active" | "completed" | "paused";
}

export interface PerformanceReview extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  score?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  status: ReviewStatus;
}

export interface TrainingRecord extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  provider?: string;
  completedAt?: string;
  expiresAt?: string;
  cost?: number;
  status: "assigned" | "in_progress" | "completed" | "expired";
}

export interface Recognition extends OperationalAuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  message: string;
  visibility: "company" | "private";
}

export interface HrPolicy extends OperationalAuditFields {
  id: string;
  title: string;
  version: string;
  content: string;
  active: boolean;
  publishedAt?: unknown;
}

export interface PolicyAcknowledgment extends OperationalAuditFields {
  id: string;
  policyId: string;
  employeeId: string;
  employeeName: string;
  version: string;
  acknowledgedAt?: unknown;
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

export interface Task extends OperationalAuditFields {
  id: string;
  code?: string;
  title: string;
  description?: string;
  priority: WorkPriority;
  status: TaskStatus;
  dueDate?: string;
  assignedToId?: string;
  assignedToName?: string;
  reservationId?: string;
  reservationCode?: string;
  customerId?: string;
  customerName?: string;
  archived?: boolean;
}

export interface Incident extends OperationalAuditFields {
  id: string;
  code?: string;
  title: string;
  description: string;
  priority: WorkPriority;
  status: IncidentStatus;
  assignedToId?: string;
  assignedToName?: string;
  reservationId?: string;
  reservationCode?: string;
  customerId?: string;
  customerName?: string;
  resolvedAt?: unknown;
  archived?: boolean;
}

export interface Expense extends OperationalAuditFields {
  id: string;
  code?: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: ExpenseStatus;
  spentAt: string;
  supplier?: string;
  department?: string;
  project?: string;
  reservationId?: string;
  reservationCode?: string;
  notes?: string;
  archived?: boolean;
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

/**
 * Estimación informativa basada en los bytes transferidos por el navegador.
 * No representa una medición física ni un inventario corporativo de GEI.
 */
export interface CarbonUsage {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  departmentId?: string;
  departmentName?: string;
  deviceClass?: "desktop" | "tablet" | "mobile";
  transferredBytes: number;
  resourceCount: number;
  activeMilliseconds?: number;
  operationCount?: number;
  pageViews?: number;
  sessionStartedAt?: unknown;
  sessionEndedAt?: unknown;
  estimatedGramsCO2e: number;
  factorGramsCO2ePerGB: number;
  methodology: "SWDM-v4";
  source: "browser-resource-timing";
  recordedAt?: unknown;
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
