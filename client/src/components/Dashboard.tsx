/**
 * SIGES iPhone Native: navegación agrupada, listas claras y materiales ligeros.
 * La UI refleja permisos, pero Firestore sigue siendo la capa obligatoria.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, signOut, updatePassword, updateProfile as updateAuthProfile, type User } from "firebase/auth";
import {
  Bell, BarChart3, Bot, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, CreditCard, FileDown,
  Eye, History, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, Moon, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, ShieldAlert, Sun, Trash2,
  Leaf, UserCog, UserRound, UsersRound, WalletCards, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import {
  approvePaymentAdjustmentRequest, bulkDeleteEmployeeProfiles, bulkRemoveRecords, bulkUpdateEmployees, bulkUpdateRecords, createGeneralReminder, createRecord, deleteActivityLog, deleteEmployeeProfile, deleteGeneralReminder, deleteProduct, getRecordDependencySummary, inviteEmployee, markInternalMessageRead, rejectPaymentAdjustmentRequest, removeRecord, saveInternalMessage, saveProduct, saveProductCategorySetting, subscribeCollection, subscribeInternalMessages, subscribeOwnTemporaryPermissions, subscribePaymentAdjustmentRequests, subscribeProductCategorySettings, subscribeUpdateRequests, updateGeneralReminder,
  recordAccess, recordCarbonUsage, requestPaymentAdjustment, subscribeAttendanceSettings, subscribeCarbonUsage, subscribeEmployeeHrRecords, subscribeHrPolicies, subscribeOwnHrProfile, subscribeSecuritySettings, updateAttendanceSettings, updateCarbonUsageSession, updateEmployee, updateOwnProfile, updateRecord, updateSecuritySettings,
} from "@/lib/firestore";
import type { AccessLog, ActivityLog, AttendanceGuard, AttendanceRecord, AttendanceSettings, Automation, CarbonUsage, Customer, EmploymentContract, Expense, GeneralReminder, HrDocument, HrGoal, HrPolicy, HrProfile, Incident, InternalMessage, Invitation, LeaveRequest, LifecycleChecklist, OrganizationUnit, Payment, PaymentAdjustmentRequest, PaymentKind, PaymentMethod, PaymentStatus, PerformanceReview, PolicyAcknowledgment, Product, ProductCategory, ProductCategorySetting, Recognition, Reservation, ReservationStatus, SecuritySettings, Task, TemporaryPermission, TrainingRecord, UpdateRequest, UserProfile, UserRole, WorkSchedule, PayrollRun } from "@/lib/types";
import { resolveProducts } from "@/lib/products";
import { downloadPaymentInvoice } from "@/lib/invoice";
import { sortRecordsNewest } from "@/lib/recordSorting";
import { currencyTotalEntries, totalsByCurrency } from "@/lib/financeMath";
import { receivableAccounts, receivableTotalsByCurrency, type ReceivableAccount } from "@/lib/accountsReceivable";
import { EPSILON, currencyCode, derivedPaymentKind, derivedPaymentStatus, paidTotalForReservation, reservationTotal as calculateReservationTotal, settlementBalance, settlementOverpayment, settlementStatus, settlementLabel, type SettlementStatus } from "@/lib/paymentMath";
import { businessToday } from "@/lib/businessDate";
import { paymentAdjustmentChangeCount, proposedPaymentChanges, type PaymentAdjustmentDraft } from "@/lib/paymentAdjustments";
import { resolveProductCategoryLabels } from "@/lib/productCategories";
import { RoleTerminologyNormalizer } from "@/components/RoleTerminologyNormalizer";
import { administrativeRolesLabel, normalizeRoleTerminology } from "@/lib/roleTerminology";
import { useTheme } from "@/contexts/ThemeContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FinancePanel from "@/components/FinancePanel";
import ReportsCenterPanel from "@/components/ReportsCenterPanel";
import GlobalSearch, { type GlobalSearchDestination, type GlobalSearchIndexEntry } from "@/components/GlobalSearch";
import HrPanel from "@/components/HrPanel";
import { HrReportsPanel, PerformanceDashboard } from "@/components/HrInsightsPanel";
import ImpactPanel from "@/components/ImpactPanel";
import OverviewDashboard from "@/components/OverviewDashboard";
import WorkPanel from "@/components/WorkPanel";
import PayrollPanel from "@/components/PayrollPanel";
import InternalMailPanel from "@/components/InternalMailPanel";
import UpdateRequestsPanel from "@/components/UpdateRequestsPanel";
import AutomationsPanel from "@/components/AutomationsPanel";

type Section = "overview" | "calendar" | "mail" | "reservations" | "customers" | "payments" | "products" | "tasks" | "hr" | "updates" | "automations" | "hr_reports" | "performance" | "impact" | "finance" | "reports" | "payroll" | "employees" | "history" | "operations" | "access" | "pending" | "reminders" | "profile";
const sections: Section[] = ["overview", "calendar", "mail", "reservations", "customers", "payments", "products", "tasks", "hr", "updates", "automations", "hr_reports", "performance", "impact", "finance", "reports", "payroll", "employees", "history", "operations", "access", "pending", "reminders", "profile"];
const isSection = (value: unknown): value is Section => typeof value === "string" && sections.includes(value as Section);
type RecordType = "customer" | "reservation" | "payment" | "product" | "expense" | "employee" | "reminder";
type RecordData = Customer | Reservation | Payment | Product | Expense | UserProfile | GeneralReminder;
type RelatedPanel = "customer" | "reservation" | "product" | null;

const dateToday = businessToday;
const singleCurrency = (amount: number, code = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount || 0);
const currencyTotalsLabel = (totals: Record<string, number>) => {
  const entries = currencyTotalEntries(totals);
  return entries.length ? entries.map(([code, amount]) => singleCurrency(amount, code)).join(" · ") : singleCurrency(0);
};
const currency = (amount: number | Record<string, number>, code = "USD") => typeof amount === "number" ? singleCurrency(amount, code) : currencyTotalsLabel(amount);
const readableDate = (value: string) => value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—";
const readableTimestamp = (value: unknown) => {
  const date = value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date ? value : null;
  return date ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Pendiente de sincronizar";
};
const customerDisplayName = (customer: Customer) => `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName || "Cliente sin nombre";
const customerCode = (customer: Customer) => customer.code || `CLI-${customer.id.slice(0, 8).toUpperCase()}`;
const operationCode = (prefix: "RES" | "PAG", record: Reservation | Payment) => record.code || `${prefix}-${record.id.slice(0, 8).toUpperCase()}`;
const carbonLabel = (grams: number) => grams >= 1 ? `${grams.toFixed(2)} g CO₂e` : grams > 0 ? `${(grams * 1000).toFixed(1)} mg CO₂e` : "0 g CO₂e";
const dataLabel = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(0, Math.round(bytes / 1_000))} KB`;
const labelStatus: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", paid: "Pagado", refunded: "Reintegrado", settled: "Total liquidado", overpaid: "Sobrepago por revisar", active: "Activo", suspended: "Suspendido", it: "Departamento de IT", admin: "Administrador", personal: "Personal", deposit: "Anticipo", partial: "Pago parcial", balance: "Liquidación de saldo", full: "Pago completo" };

function StatusPill({ status }: { status: string }) {
  const tone = status === "active" || status === "confirmed" || status === "completed" || status === "paid" || status === "settled"
    ? "success" : status === "pending" ? "warning" : status === "cancelled" || status === "suspended" || status === "refunded" || status === "overpaid" ? "danger" : "muted";
  return <span className={`status-pill ${tone}`}>{labelStatus[status] || status}</span>;
}

function SigesWordmark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return <span className={`siges-wordmark ${className}`} title="Sistema Integral de Gestión Estratégica" aria-label="SIGES">{compact ? "S" : "SIGES"}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07151A]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="floating-surface w-full max-w-lg overflow-hidden rounded-[1.5rem]"><header className="flex items-center justify-between border-b px-6 py-4"><h2 className="text-[20px] font-bold tracking-[-.02em]">{title}</h2><button aria-label="Cerrar" onClick={onClose} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-6">{children}</div></section></div>;
}

function WorkflowDialog({ title, onClose, primary, relatedTitle, related, onCloseRelated }: { title: string; onClose: () => void; primary: ReactNode; relatedTitle?: string; related?: ReactNode; onCloseRelated: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07151A]/55 p-4 backdrop-blur-sm"><div className="mx-auto flex min-h-full max-w-6xl items-center justify-center"><motion.div layout transition={{ type: "spring", stiffness: 280, damping: 28 }} className={`workflow-dialog ${related ? "has-related" : ""}`}><section role="dialog" aria-modal="true" className="workflow-main-panel"><header className="flex items-center justify-between border-b px-5 py-4"><div><p className="eyebrow">Flujo de registro</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2></div><button aria-label="Cerrar" onClick={onClose} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-5">{primary}</div></section><AnimatePresence>{related && <motion.aside initial={{ opacity: 0, x: 72 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 72 }} transition={{ type: "spring", stiffness: 290, damping: 27 }} className="workflow-related-panel"><header className="flex items-center justify-between border-b px-5 py-4"><div><p className="eyebrow">Registro relacionado</p><h3 className="mt-1 text-lg font-extrabold tracking-tight">{relatedTitle}</h3></div><button aria-label="Cerrar panel relacionado" onClick={onCloseRelated} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-5">{related}</div></motion.aside>}</AnimatePresence></motion.div></div></div>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-64 place-items-center px-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0F8F73]/20 bg-[#0F8F73]/8 text-2xl font-black text-[#0F8F73]">S</div><h3 className="mt-3 font-extrabold">{title}</h3><p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{detail}</p></div>;
}

function PageTitle({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{normalizeRoleTerminology(eyebrow)}</p><h1 className="mt-1 text-[34px] font-bold leading-[1.08] tracking-[-.04em] sm:text-[40px]">{title}</h1></div>{actions}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = "jade" }: { label: string; value: string; note: string; icon: LucideIcon; tone?: "jade" | "amber" | "ink" | "rose" }) {
  return <article className="metric-card"><div><p className="text-[13px] font-medium text-muted-foreground">{label}</p><p className="metric-number mt-3 text-[30px] font-semibold">{value}</p><p className="mt-1.5 text-[12px] text-muted-foreground">{note}</p></div><div className={`metric-icon ${tone}`}><Icon size={19} /></div></article>;
}

type AdministrativePendingItem = { id: string; title: string; detail: string; count: number; section: Section; icon: LucideIcon };

function AdministrativePendingPanel({ items, onNavigate }: { items: AdministrativePendingItem[]; onNavigate: (section: Section) => void }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <section className="admin-pending-panel mt-7" aria-labelledby="admin-pending-title"><header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4"><div><p className="eyebrow">{administrativeRolesLabel}</p><h2 id="admin-pending-title" className="mt-1 text-xl font-bold tracking-[-.025em]">Pendientes de configuración</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Datos incompletos, asignaciones y revisiones que requieren acción administrativa.</p></div><span className="admin-pending-count">{total} pendiente{total === 1 ? "" : "s"}</span></header>{items.length ? <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">{items.map(({ id, title, detail, count, section, icon: Icon }) => <button key={id} onClick={() => onNavigate(section)} className="admin-pending-item text-left"><span className="admin-pending-icon"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">{title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span></span><span className="admin-pending-number">{count}</span></button>)}</div> : <div className="flex min-h-28 items-center gap-3 px-5 py-5"><CheckCircle2 className="text-[#1676F3]" size={22} /><div><p className="font-semibold">Configuración al día</p><p className="mt-1 text-sm text-muted-foreground">No se detectaron campos ni asignaciones administrativas pendientes.</p></div></div>}</section>;
}

function RecordActions({ onView, onEdit, onDelete, onInvoice, onPasswordReset }: { onView?: () => void; onEdit: () => void; onDelete?: () => void; onInvoice?: () => void; onPasswordReset?: () => void }) {
  return <div className="flex justify-end gap-1">{onView && <button className="icon-button" title="Ver detalles" onClick={(event) => { event.stopPropagation(); onView(); }}><Eye size={16} /></button>}{onInvoice && <button className="icon-button" title="Descargar comprobante PDF" onClick={(event) => { event.stopPropagation(); onInvoice(); }}><FileDown size={16} /></button>}{onPasswordReset && <button className="icon-button" title="Enviar restablecimiento de contraseña" onClick={(event) => { event.stopPropagation(); onPasswordReset(); }}><LockKeyhole size={16} /></button>}<button className="icon-button" title="Editar" onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil size={16} /></button>{onDelete && <button className="icon-button danger" title="Eliminar" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={16} /></button>}</div>;
}

function BulkActionBar({ count, label, onClear, children }: { count: number; label: string; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return <div className="bulk-action-bar"><div><p className="text-sm font-extrabold">{count} {label}{count === 1 ? " seleccionado" : " seleccionados"}</p><p className="mt-0.5 text-xs text-muted-foreground">Las acciones se aplican a los registros marcados y quedan auditadas.</p></div><div className="flex flex-wrap items-center gap-2">{children}<button className="secondary-button" onClick={onClear}>Limpiar</button></div></div>;
}

function BulkModeControl({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return <button type="button" aria-pressed={active} className={`secondary-button ${active ? "border-primary bg-primary/10 text-primary" : ""}`} onClick={onToggle}><Pencil size={16} />{active ? "Finalizar edición" : "Editar varios"}</button>;
}

function DetailViewer({ eyebrow, title, data, related }: { eyebrow: string; title: string; data: Record<string, unknown>; related?: Record<string, unknown> | null }) {
  const labels: Record<string, string> = { id: "Identificador", code: "Código", firstName: "Nombres", lastName: "Apellidos", fullName: "Nombre", customerName: "Cliente", customerId: "ID de cliente", reservationId: "ID de reserva", service: "Servicio", durationMinutes: "Duración", date: "Fecha", time: "Hora", amount: "Importe", kind: "Tipo de pago", totalDue: "Valor total", groupName: "Grupo", groupSize: "Participantes", participantNames: "Integrantes", groupBonusEligible: "Beneficio grupal", assignedToName: "Responsable asignado", assignmentNote: "Nota de asignación", currency: "Moneda", method: "Método", status: "Estado", paidAt: "Fecha de pago", email: "Correo", phone: "Teléfono", notes: "Notas", createdByName: "Registrado por", createdByEmail: "Correo del responsable", updatedByName: "Actualizado por", displayName: "Nombre visible", role: "Rol", message: "Mensaje", priority: "Prioridad", summary: "Movimiento", actorName: "Responsable", actorEmail: "Correo del responsable", action: "Acción", entity: "Categoría", entityId: "Registro relacionado", occurredAt: "Fecha y hora", createdAt: "Fecha de creación", updatedAt: "Última actualización" };
  const toText = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return "—";
    if (key === "amount") return currency(Number(value), String(data.currency || "USD"));
    if (key === "status" || key === "role" || key === "kind") return labelStatus[String(value)] || String(value);
    if (key === "durationMinutes") return `${value} min`;
    if (key.endsWith("At") || key === "occurredAt") return readableTimestamp(value);
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return String(value);
  };
  const visible = Object.entries(data).filter(([key, value]) => !["createdBy", "updatedBy", "acceptedBy", "active"].includes(key) && value !== undefined);
  const relatedVisible = related ? Object.entries(related).filter(([key, value]) => !["id", "createdBy", "updatedBy"].includes(key) && value !== undefined) : [];
  return <section><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">{title}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{visible.map(([key, value]) => <div className="rounded-xl border bg-muted/30 p-3" key={key}><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">{labels[key] || key}</p><p className="mt-1 break-words text-sm font-bold">{toText(key, value)}</p></div>)}</div>{relatedVisible.length > 0 && <div className="mt-6 border-t pt-5"><p className="text-sm font-extrabold">Detalles del registro vinculado</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{relatedVisible.map(([key, value]) => <div className="rounded-xl border bg-card p-3" key={key}><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">{labels[key] || key}</p><p className="mt-1 break-words text-sm font-bold">{toText(key, value)}</p></div>)}</div></div>}</section>;
}

function GeneralReminderForm({ initial, userId, onDone }: { initial?: GeneralReminder; userId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const payload = { title: String(form.get("title")).trim(), message: String(form.get("message")).trim(), priority: String(form.get("priority")) as GeneralReminder["priority"] };
      if (initial) await updateGeneralReminder(initial.id, payload, userId); else await createGeneralReminder(payload, userId);
      event.currentTarget.reset();
      toast.success(initial ? "Comunicación actualizada." : "Aviso publicado para el equipo.");
      onDone();
    } catch { toast.error("No fue posible publicar el aviso. Comprueba las reglas de Firestore."); } finally { setSubmitting(false); }
  };
  return <form className="form-stack" onSubmit={submit}><div className="rounded-xl border border-[#855CF5]/20 bg-[#855CF5]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Canal interno:</strong> este aviso será visible para todo el Personal. Solo Administración e IT pueden publicar, editar o retirar comunicaciones.</div><label>Asunto<input className="field" name="title" required defaultValue={initial?.title} placeholder="Ej. Reunión general" /></label><label>Mensaje<textarea className="field min-h-28" name="message" required defaultValue={initial?.message} placeholder="Escribe la notificación, recordatorio o anuncio que verá el Personal…" /></label><label>Prioridad<select className="field" name="priority" defaultValue={initial?.priority || "info"}><option value="info">Informativo</option><option value="important">Importante</option><option value="urgent">Urgente</option></select></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : initial ? "Guardar cambios" : "Enviar comunicación"}<ChevronRight size={16} /></button></form>;
}

function OperationalCalendar({ reservations, onOpenReservation }: { reservations: Reservation[]; onOpenReservation: (reservation: Reservation) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); const leading = (monthStart.getDay() + 6) % 7;
  const days = Array.from({ length: leading + monthEnd.getDate() }, (_, index) => index < leading ? null : index - leading + 1);
  const dayKey = (day: number) => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const byDay = (day: number) => reservations.filter((item) => item.date === dayKey(day)).sort((a, b) => a.time.localeCompare(b.time));
  const title = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(cursor);
  return <section><PageTitle eyebrow="Planificación operativa" title="Calendario" actions={<div className="flex gap-2"><button className="icon-button" aria-label="Mes anterior" onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button><button className="secondary-button" onClick={() => setCursor(new Date())}>Hoy</button><button className="icon-button" aria-label="Mes siguiente" onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button></div>} /><section className="panel-card mt-7 overflow-hidden"><div className="border-b px-5 py-4"><h2 className="capitalize text-lg font-extrabold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">Toca una reserva para revisar o editar sus datos.</p></div><div className="grid grid-cols-7 border-b bg-muted/35 text-center text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <div className="px-1 py-3" key={day}>{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day, index) => <div className="min-h-28 border-b border-r p-1.5 sm:min-h-36 sm:p-2" key={`${day}-${index}`}>{day && <><p className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${dateToday() === dayKey(day) ? "bg-primary text-primary-foreground" : ""}`}>{day}</p><div className="space-y-1">{byDay(day).slice(0, 3).map((item) => <button onClick={() => onOpenReservation(item)} className="block w-full truncate rounded-md bg-primary/10 px-1.5 py-1 text-left text-[10px] font-semibold text-primary hover:bg-primary/15" title={`${item.time} · ${item.customerName}`} key={item.id}>{item.time} · {item.customerName}</button>)}{byDay(day).length > 3 && <p className="px-1 text-[10px] font-semibold text-muted-foreground">+{byDay(day).length - 3} más</p>}</div></>}</div>)}</div></section></section>;
}

function ProductForm({ initial, userId, categoryLabels: _categoryLabels, onDone }: { initial?: Product; userId: string; categoryLabels: Record<ProductCategory, string>; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const category = String(form.get("category")) as ProductCategory;
    const details = String(form.get("details")).split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [label, ...value] = line.split(":");
      return { label: label.trim(), value: value.join(":").trim() || "Incluido" };
    });
    const id = initial?.id || `${category}-${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
    try {
      await saveProduct({ id, name, category, price: Number(form.get("price")), unit: String(form.get("unit")).trim(), tagline: String(form.get("tagline")).trim(), details, active: true, createdBy: initial?.createdBy || userId, createdAt: initial?.createdAt }, userId);
      toast.success(initial ? "Paquete actualizado." : "Paquete añadido al catálogo.");
      onDone();
    } catch { toast.error("No fue posible guardar el paquete. Comprueba las reglas de Firebase."); } finally { setSubmitting(false); }
  };
  const detailText = (initial?.details ?? []).map((item) => `${item.label}: ${item.value}`).join("\n") || "";
  return <form className="form-stack" onSubmit={submit}><div className="rounded-xl border border-[#1676F3]/20 bg-[#1676F3]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Catálogo interno:</strong> este paquete será visible para todo el Personal. Solo Administración e IT pueden modificarlo.</div><label>Nombre del paquete<input className="field" name="name" required defaultValue={initial?.name} placeholder="Ej. Paquete Básico" /></label><div className="grid gap-4 sm:grid-cols-2"><label>Categoría<select className="field" name="category" defaultValue={initial?.category || "tariff"}><option value="tariff">Aranceles</option><option value="promotion">Promociones</option></select></label><label>Precio USD<input className="field" name="price" type="number" min="0" step="0.01" required defaultValue={initial?.price} /></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Unidad<input className="field" name="unit" required defaultValue={initial?.unit} placeholder="por persona" /></label><label>Subtítulo<input className="field" name="tagline" required defaultValue={initial?.tagline} placeholder="Para momentos simples" /></label></div><label>Inclusiones <span className="font-normal text-muted-foreground">(una por línea: Título: detalle)</span><textarea className="field min-h-36" name="details" required defaultValue={detailText} placeholder="Tiempo de entrega: 2 días hábiles\nFotos digitales: 2 fotos enviadas por WhatsApp" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : initial ? "Guardar paquete" : "Añadir paquete"}<ChevronRight size={16} /></button></form>;
}

function ProductCategorySettingForm({ category, currentLabel, userId, onDone }: { category: ProductCategory; currentLabel: string; userId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await saveProductCategorySetting(category, String(new FormData(event.currentTarget).get("label")), userId);
      toast.success("Nombre de categoría actualizado para todo el catálogo.");
      onDone();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo actualizar la categoría."); }
    finally { setSubmitting(false); }
  };
  return <form className="form-stack" onSubmit={submit}><p className="rounded-xl border border-[#1676F3]/20 bg-[#1676F3]/5 px-4 py-3 text-sm leading-6 text-muted-foreground">Este cambio solo modifica el título visible del grupo. Los paquetes, precios, códigos e historial de reservas y pagos no se alteran.</p><label>Nombre visible<input className="field" name="label" required defaultValue={currentLabel} maxLength={80} placeholder="Ej. Promociones de graduación" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar nombre"}<ChevronRight size={16} /></button></form>;
}

function AccountMenu({ profile, onNavigate, onLogout }: { profile: UserProfile; onNavigate: (section: Section) => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const initials = profile.displayName.trim().slice(0, 2).toUpperCase() || "US";
  return <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger asChild><button aria-label={`Abrir menú de ${profile.displayName}`} onPointerEnter={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-muted px-1.5 py-1.5 text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F8F73]" type="button"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#0F8F73] text-xs font-bold text-white">{initials}</span><span className="hidden max-w-32 truncate pr-2 text-xs font-semibold sm:block">{profile.displayName}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="floating-surface w-56 rounded-[1.15rem] p-1.5" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}><DropdownMenuLabel className="px-3 py-2.5"><p className="truncate text-sm font-bold">{profile.displayName}</p><p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{profile.email}</p></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem className="cursor-pointer rounded-xl px-3 py-2.5" onSelect={() => onNavigate("profile")}><UserRound size={16} />Perfil</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" className="cursor-pointer rounded-xl px-3 py-2.5" onSelect={onLogout}><LogOut size={16} />Cerrar sesión</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function AppSidebar({ active, onNavigate, isAdmin, isIT, temporarySections, collapsed, onToggle }: { active: Section; onNavigate: (section: Section) => void; isAdmin: boolean; isIT: boolean; temporarySections: Section[]; collapsed: boolean; onToggle: () => void }) {
  type NavItem = { key: Section; label: string; icon: LucideIcon };
  type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };
  const groups: NavGroup[] = [
    { id: "daily", label: "Operación diaria", icon: ClipboardList, items: [{ key: "reservations", label: "Reservas", icon: CalendarDays }, { key: "customers", label: "Clientes", icon: UsersRound }, { key: "payments", label: "Pagos", icon: CreditCard }, { key: "products", label: "Productos", icon: CircleDollarSign }, { key: "tasks", label: "Tareas e incidencias", icon: ClipboardList }] },
    { id: "team", label: "Equipo", icon: UserCog, items: [{ key: "hr", label: "Recursos Humanos", icon: UserCog }, { key: "updates", label: "Actualizaciones", icon: ClipboardList }] },
    { id: "insights", label: "Paneles y análisis", icon: BarChart3, items: [...(isAdmin ? [{ key: "hr_reports" as Section, label: "Reportes RR. HH.", icon: FileDown }, { key: "performance" as Section, label: "Rendimiento", icon: BarChart3 }, { key: "finance" as Section, label: "Finanzas", icon: CircleDollarSign }, { key: "reports" as Section, label: "Centro de Informes", icon: FileDown }, { key: "payroll" as Section, label: "Planilla", icon: WalletCards }] : [])] },
  ];
  if (isAdmin) groups.push({ id: "admin", label: "Administración", icon: ShieldAlert, items: [{ key: "pending", label: "Pendientes", icon: CheckCircle2 }, { key: "operations", label: "Operación", icon: ClipboardList }, { key: "employees", label: "Personal", icon: UserCog }, { key: "automations", label: "Automatizaciones", icon: Bot }, { key: "history", label: "Historial", icon: History }] });
  if (isIT) groups.push({ id: "it", label: "Departamento de IT", icon: ShieldAlert, items: [{ key: "access", label: "Seguridad y actividad", icon: ShieldAlert }] });
  const temporaryLabels: Partial<Record<Section, string>> = { finance: "Finanzas (temporal)", hr_reports: "Reportes RR. HH. (temporal)", performance: "Rendimiento (temporal)", automations: "Automatizaciones (temporal)", operations: "Operación (temporal)", history: "Historial (temporal)", employees: "Personal (temporal)" };
  if (temporarySections.length) groups.push({ id: "temporary", label: "Accesos temporales", icon: LockKeyhole, items: temporarySections.map((key) => ({ key, label: temporaryLabels[key] || key, icon: LockKeyhole })) });
  const [openGroup, setOpenGroup] = useState<string | null>("daily");
  useEffect(() => { const currentGroup = groups.find((group) => group.items.some((item) => item.key === active)); if (currentGroup) setOpenGroup(currentGroup.id); }, [active, isAdmin]);
  const toggleGroup = (id: string) => setOpenGroup((current) => current === id ? null : id);
  return <aside className={`sidebar-panel ${collapsed ? "is-collapsed" : ""}`}><header className="sidebar-header"><button onClick={() => onNavigate("overview")} title="Ir al Resumen" className={`flex min-w-0 text-left ${collapsed ? "justify-center" : "flex-col items-start gap-1"}`}><SigesWordmark compact={collapsed} className={collapsed ? "siges-collapsed-mark" : "siges-sidebar-wordmark"} />{!collapsed && <p className="text-[9px] font-medium uppercase tracking-[.08em] text-muted-foreground">Sistema Integral de Gestión Estratégica</p>}</button><button className="sidebar-collapse-control" onClick={onToggle} aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} title={collapsed ? "Expandir menú" : "Colapsar menú"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></header><nav className="sidebar-navigation"><button title={collapsed ? "Resumen" : undefined} onClick={() => onNavigate("overview")} className={`side-link mb-1 ${active === "overview" ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}><LayoutDashboard size={18} />{!collapsed && "Resumen"}</button>{groups.filter((group) => group.items.length > 0).map((group) => { const isGroupActive = group.items.some((item) => item.key === active); const isOpen = openGroup === group.id; const GroupIcon = group.icon; return <section className="sidebar-group" key={group.id}><button aria-expanded={isOpen} onClick={() => collapsed ? onToggle() : toggleGroup(group.id)} className={`sidebar-group-trigger ${isGroupActive ? "has-active" : ""} ${collapsed ? "justify-center" : ""}`} title={collapsed ? group.label : undefined}><GroupIcon size={18} />{!collapsed && <><span>{group.label}</span><ChevronDown className={`ml-auto transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} size={16} /></>}</button>{!collapsed && isOpen && <div className="sidebar-submenu">{group.items.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => onNavigate(key)} className={`side-sub-link ${active === key ? "active" : ""}`}><Icon size={16} /><span>{label}</span></button>)}</div>}</section>; })}</nav><footer className="sidebar-footer">{!collapsed && <p>Con tecnología de Windsor</p>}</footer></aside>;
}

function CustomerForm({ initial, userId, onDone, onCreated }: { initial?: Customer; userId: string; onDone: () => void; onCreated?: (customer: Customer) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitting(true); const form = new FormData(event.currentTarget); const payload = { firstName: String(form.get("firstName")).trim(), lastName: String(form.get("lastName")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), notes: String(form.get("notes")).trim() }; try { const id = initial ? initial.id : await createRecord("customers", { ...payload, createdBy: userId }); if (initial) await updateRecord("customers", initial.id, payload, userId); else onCreated?.({ id, ...payload, createdBy: userId }); toast.success(initial ? "Cliente actualizado." : "Cliente registrado."); onDone(); } catch { toast.error("No fue posible guardar el cliente."); } finally { setSubmitting(false); } };
  return <form className="form-stack" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label>Nombres<input className="field" name="firstName" required defaultValue={initial?.firstName || initial?.fullName?.split(" ")[0] || ""} /></label><label>Apellidos<input className="field" name="lastName" required defaultValue={initial?.lastName || initial?.fullName?.split(" ").slice(1).join(" ") || ""} /></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Correo<input className="field" type="email" name="email" defaultValue={initial?.email} /></label><label>Teléfono<input className="field" name="phone" defaultValue={initial?.phone} /></label></div><label>Notas<textarea className="field min-h-24" name="notes" defaultValue={initial?.notes} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar cliente"}<ChevronRight size={16} /></button></form>;
}

function InlineCustomer({ userId, onCreated }: { userId: string; onCreated: (customer: Customer) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = { firstName: String(form.get("firstName")).trim(), lastName: String(form.get("lastName")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), notes: "", createdBy: userId };
    try {
      const id = await createRecord("customers", payload);
      onCreated({ id, ...payload });
      toast.success("Cliente añadido y seleccionado.");
    } catch {
      toast.error("No fue posible añadir el cliente.");
    } finally {
      setSubmitting(false);
    }
  };
  return <form className="mt-3 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 p-3" onSubmit={submit}><p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#08745D] dark:text-[#5DDBC0]">Añadir cliente sin salir</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="field" name="firstName" required placeholder="Nombres" /><input className="field" name="lastName" required placeholder="Apellidos" /></div><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><input className="field" name="email" type="email" placeholder="Correo (opcional)" /><button className="secondary-button" disabled={submitting}>{submitting ? "Añadiendo…" : "Añadir cliente"}</button></div><input className="field mt-2" name="phone" placeholder="Teléfono (opcional)" /></form>;
}

function InlineReservation({ customer, userId, onCreated }: { customer: Customer; userId: string; onCreated: (reservation: Reservation) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = { customerId: customer.id, customerName: customerDisplayName(customer), date: String(form.get("date")), time: String(form.get("time")), service: String(form.get("service")).trim(), durationMinutes: Number(form.get("durationMinutes")), status: "confirmed" as ReservationStatus, notes: "", createdBy: userId };
    try {
      const id = await createRecord("reservations", payload);
      onCreated({ id, ...payload });
      toast.success("Reserva añadida y asociada al pago.");
    } catch {
      toast.error("No fue posible añadir la reserva.");
    } finally {
      setSubmitting(false);
    }
  };
  return <form className="mt-3 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 p-3" onSubmit={submit}><p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#08745D] dark:text-[#5DDBC0]">Añadir reserva para {customerDisplayName(customer)}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="field" name="service" required placeholder="Servicio" /><input className="field" name="date" type="date" required defaultValue={dateToday()} /><input className="field" name="time" type="time" required defaultValue="09:00" /><input className="field" name="durationMinutes" type="number" min="5" step="5" required defaultValue={60} /></div><button className="secondary-button mt-2" disabled={submitting}>{submitting ? "Añadiendo…" : "Añadir reserva"}</button></form>;
}

function ReservationForm({ initial, customers, products = [], userId, onDone, linkedCustomer, onOpenCustomerPanel, onSelectProduct, onCreated }: { initial?: Reservation; customers: Customer[]; products?: Product[]; userId: string; onDone: () => void; linkedCustomer?: Customer | null; onOpenCustomerPanel?: () => void; onSelectProduct?: (product: Product) => void; onCreated?: (reservation: Reservation) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initial?.customerId || linkedCustomer?.id || "");
  const [selectedProductId, setSelectedProductId] = useState(initial?.productId || "");
  const [serviceName, setServiceName] = useState(initial?.service || "");
  const [groupEnabled, setGroupEnabled] = useState(Boolean(initial?.groupName || (initial?.groupSize || 0) > 1));
  useEffect(() => { if (linkedCustomer) setSelectedCustomerId(linkedCustomer.id); }, [linkedCustomer]);
  const customerOptions = linkedCustomer && !customers.some((customer) => customer.id === linkedCustomer.id) ? [...customers, linkedCustomer] : customers;
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const customer = customerOptions.find((item) => item.id === form.get("customerId"));
    if (!customer) { toast.error("Selecciona un cliente."); setSubmitting(false); return; }
    const groupSize = groupEnabled ? Math.max(2, Number(form.get("groupSize") || 2)) : undefined;
    const participants = groupEnabled ? String(form.get("participantNames") || "").split("\n").map((name) => name.trim()).filter(Boolean) : undefined;
    const unitPrice = selectedProduct?.price || Number(form.get("totalDue") || 0);
    const totalDue = groupEnabled && selectedProduct?.unit.toLowerCase().includes("persona") ? unitPrice * (groupSize || 1) : unitPrice;
    const payload = { customerId: customer.id, customerName: customerDisplayName(customer), productId: selectedProduct?.id, productName: selectedProduct?.name, productCategory: selectedProduct?.category, productPrice: selectedProduct?.price, productUnit: selectedProduct?.unit, totalDue, currency: String(form.get("currency") || "USD"), groupName: groupEnabled ? String(form.get("groupName")).trim() : undefined, groupSize, participantNames: participants, groupBonusEligible: Boolean(groupEnabled && (groupSize || 0) >= 5), date: String(form.get("date")), time: String(form.get("time")), service: selectedProduct?.name || serviceName.trim(), durationMinutes: Number(form.get("durationMinutes")), status: String(form.get("status")) as ReservationStatus, notes: String(form.get("notes")).trim() };
    try { const id = initial ? initial.id : await createRecord("reservations", { ...payload, createdBy: userId }); if (initial) await updateRecord("reservations", initial.id, payload, userId); else onCreated?.({ id, ...payload, createdBy: userId }); toast.success(initial ? "Reserva actualizada." : "Reserva creada."); onDone(); } catch { toast.error("No fue posible guardar la reserva."); } finally { setSubmitting(false); }
  };
  return <form className="form-stack" onSubmit={submit}><label>Cliente<select className="field" required name="customerId" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Selecciona un cliente</option>{customerOptions.map((customer) => <option value={customer.id} key={customer.id}>{customerDisplayName(customer)}</option>)}</select></label>{onOpenCustomerPanel && <button type="button" className="workflow-link" onClick={onOpenCustomerPanel}>+ Registrar cliente en panel lateral</button>}<label>Paquete <span className="font-normal text-muted-foreground">(opcional)</span><select className="field" name="productId" value={selectedProductId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setSelectedProductId(event.target.value); if (product) onSelectProduct?.(product); }}><option value="">Servicio personalizado / sin paquete</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {currency(product.price)} {product.unit}</option>)}</select></label>{selectedProduct && <button type="button" className="rounded-xl border border-[#1676F3]/20 bg-[#1676F3]/5 px-3 py-2 text-left text-xs leading-5 text-muted-foreground" onClick={() => onSelectProduct?.(selectedProduct)}><strong className="text-foreground">{selectedProduct.tagline}</strong> · {currency(selectedProduct.price)} {selectedProduct.unit}<span className="ml-2 font-bold text-[#1676F3]">Ver información</span></button>}<div className="grid gap-4 sm:grid-cols-2"><label>Fecha<input className="field" type="date" name="date" required defaultValue={initial?.date || dateToday()} /></label><label>Hora<input className="field" type="time" name="time" required defaultValue={initial?.time || "09:00"} /></label></div><div className="grid gap-4 sm:grid-cols-[1fr_.6fr]"><label>Servicio<input className="field" name="service" required readOnly={Boolean(selectedProduct)} value={selectedProduct?.name || serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ej. Consulta" /></label><label>Duración (min.)<input className="field" type="number" name="durationMinutes" min="5" step="5" required defaultValue={initial?.durationMinutes || 60} /></label></div><label className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-3 text-sm font-bold"><input type="checkbox" checked={groupEnabled} onChange={(event) => setGroupEnabled(event.target.checked)} />Reserva grupal</label>{groupEnabled && <div className="rounded-xl border border-[#FFC72C]/25 bg-[#FFC72C]/5 p-3"><div className="grid gap-3 sm:grid-cols-2"><label>Nombre del grupo<input className="field mt-1" name="groupName" required defaultValue={initial?.groupName} placeholder="Ej. 6.º A Colegio Central" /></label><label>Participantes<input className="field mt-1" name="groupSize" type="number" min="2" required defaultValue={initial?.groupSize || 2} /></label></div><label className="mt-3 block">Integrantes <span className="font-normal text-muted-foreground">(uno por línea)</span><textarea className="field mt-1 min-h-20" name="participantNames" defaultValue={initial?.participantNames?.join("\n")} placeholder="Ana Pérez\nLuis García" /></label><p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Desde 5 participantes se registra el beneficio de foto grupal adicional.</p></div>}<div className="grid gap-4 sm:grid-cols-[1fr_.55fr]"><label>Valor total<input className="field" name="totalDue" type="number" min="0" step="0.01" defaultValue={initial?.totalDue || initial?.productPrice || selectedProduct?.price || ""} placeholder="Se toma del paquete si aplica" /></label><label>Moneda<select className="field" name="currency" defaultValue={initial?.currency || "USD"}><option>USD</option><option>EUR</option><option>MXN</option><option>ARS</option><option>COP</option></select></label></div><label>Estado<select className="field" name="status" defaultValue={initial?.status || "confirmed"}><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label><label>Notas<textarea className="field min-h-20" name="notes" defaultValue={initial?.notes} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar reserva"}<ChevronRight size={16} /></button></form>;
}

function PaymentForm({ initial, customers, reservations, payments, products, userId, onDone, linkedCustomer, linkedReservation, onOpenCustomerPanel, onOpenReservationPanel, onSelectProduct }: { initial?: Payment; customers: Customer[]; reservations: Reservation[]; payments: Payment[]; products: Product[]; userId: string; onDone: () => void; linkedCustomer?: Customer | null; linkedReservation?: Reservation | null; onOpenCustomerPanel?: () => void; onOpenReservationPanel?: (customer: Customer) => void; onSelectProduct?: (product: Product) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initial?.customerId || linkedCustomer?.id || "");
  const [selectedProductId, setSelectedProductId] = useState(initial?.productId || linkedReservation?.productId || "");
  const [selectedReservationId, setSelectedReservationId] = useState(initial?.reservationId || linkedReservation?.id || "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [currencyState, setCurrencyState] = useState(initial?.currency || linkedReservation?.currency || "USD");
  const [statusState, setStatusState] = useState<PaymentStatus>(initial?.status || "paid");
  const customerOptions = linkedCustomer && !customers.some((customer) => customer.id === linkedCustomer.id) ? [...customers, linkedCustomer] : customers;
  const reservationOptions = linkedReservation && !reservations.some((reservation) => reservation.id === linkedReservation.id) ? [...reservations, linkedReservation] : reservations;
  useEffect(() => {
    if (linkedCustomer) setSelectedCustomerId(linkedCustomer.id);
    if (linkedReservation) {
      setSelectedReservationId(linkedReservation.id);
      setSelectedProductId(linkedReservation.productId || "");
      setCurrencyState(currencyCode(linkedReservation.currency));
      const total = calculateReservationTotal(linkedReservation);
      const alreadyPaid = paidTotalForReservation(linkedReservation, payments, initial?.id);
      setAmount(String(Math.max(0, total - alreadyPaid)));
    }
  }, [initial?.id, linkedCustomer, linkedReservation, payments]);
  const selectedCustomer = customerOptions.find((customer) => customer.id === selectedCustomerId);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedReservation = reservationOptions.find((reservation) => reservation.id === selectedReservationId);
  const reservationCurrency = selectedReservation ? currencyCode(selectedReservation.currency) : currencyCode(currencyState);
  const reservationTotalValue = selectedReservation ? calculateReservationTotal(selectedReservation) : selectedProduct?.price || 0;
  const previousPaid = paidTotalForReservation(selectedReservation, payments, initial?.id);
  const pendingBefore = Math.max(0, reservationTotalValue - previousPaid);
  const currentAmount = Math.max(0, Number(amount) || 0);
  const amountCountsTowardSettlement = statusState === "paid";
  const settlement = selectedReservation ? settlementStatus(reservationTotalValue, previousPaid, amountCountsTowardSettlement ? currentAmount : 0) : undefined;
  const pendingAfter = selectedReservation ? settlementBalance(reservationTotalValue, previousPaid, amountCountsTowardSettlement ? currentAmount : 0) : 0;
  const overpayment = selectedReservation ? settlementOverpayment(reservationTotalValue, previousPaid, amountCountsTowardSettlement ? currentAmount : 0) : 0;
  const kindPreview = selectedReservation ? derivedPaymentKind(reservationTotalValue, previousPaid, amountCountsTowardSettlement ? currentAmount : 0, initial?.kind) : initial?.kind || "partial";
  if (initial?.status === "paid") return <PaymentAdjustmentRequestForm payment={initial} userId={userId} onDone={onDone} />;
  const selectReservation = (reservationId: string) => {
    const reservation = reservationOptions.find((item) => item.id === reservationId);
    setSelectedReservationId(reservationId);
    if (!reservation) return;
    setSelectedCustomerId(reservation.customerId);
    setSelectedProductId(reservation.productId || "");
    setCurrencyState(currencyCode(reservation.currency));
    const total = calculateReservationTotal(reservation);
    const alreadyPaid = paidTotalForReservation(reservation, payments, initial?.id);
    setAmount(String(Math.max(0, total - alreadyPaid)));
    const product = products.find((item) => item.id === reservation.productId);
    if (product) onSelectProduct?.(product);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const customer = customerOptions.find((item) => item.id === form.get("customerId"));
    const requestedStatus = String(form.get("status") || statusState) as PaymentStatus;
    const requestedKind = String(form.get("kind") || "partial") as PaymentKind;
    const numericAmount = Number(form.get("amount"));
    const effectiveStatus = derivedPaymentStatus(numericAmount, requestedStatus);
    const effectiveCurrency = currencyCode(selectedReservation?.currency || form.get("currency") || currencyState);
    const effectiveSettlement = selectedReservation ? settlementStatus(reservationTotalValue, previousPaid, effectiveStatus === "paid" ? numericAmount : 0) : undefined;
    const effectiveKind = selectedReservation ? derivedPaymentKind(reservationTotalValue, previousPaid, numericAmount, requestedKind) : requestedKind;
    if (!customer) { toast.error("Selecciona un cliente."); setSubmitting(false); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= EPSILON) { toast.error("El importe debe ser mayor que cero."); setSubmitting(false); return; }
    if (selectedReservation && effectiveCurrency !== currencyCode(selectedReservation.currency)) { toast.error(`La reserva está registrada en ${currencyCode(selectedReservation.currency)}. No se puede cobrar en otra moneda.`); setSubmitting(false); return; }
    if (selectedReservation && effectiveStatus === "paid" && numericAmount > pendingBefore + EPSILON) { toast.error(`El importe supera el saldo pendiente de ${currency(pendingBefore, effectiveCurrency)}.`); setSubmitting(false); return; }
    const payload = {
      customerId: customer.id,
      customerName: customerDisplayName(customer),
      productId: selectedProduct?.id || selectedReservation?.productId,
      productName: selectedProduct?.name || selectedReservation?.productName,
      productCategory: selectedProduct?.category || selectedReservation?.productCategory,
      productPrice: selectedProduct?.price || selectedReservation?.productPrice,
      productUnit: selectedProduct?.unit || selectedReservation?.productUnit,
      reservationId: selectedReservationId || undefined,
      amount: numericAmount,
      kind: effectiveKind,
      currency: effectiveCurrency,
      method: String(form.get("method")) as PaymentMethod,
      status: effectiveStatus,
      settlementStatus: effectiveSettlement,
      paidAt: String(form.get("paidAt")),
      notes: String(form.get("notes")).trim(),
    };
    try {
      if (initial) await updateRecord("payments", initial.id, payload, userId); else await createRecord("payments", { ...payload, createdBy: userId });
      if (selectedReservation) await updateRecord("reservations", selectedReservation.id, { paymentStatus: effectiveSettlement }, userId);
      toast.success(effectiveSettlement === "settled" ? "Pago registrado: reserva totalmente liquidada." : effectiveSettlement === "overpaid" ? "Pago registrado: sobrepago enviado a revisión." : "Pago registrado: reserva aún pendiente.");
      onDone();
    } catch { toast.error("No fue posible guardar el pago o actualizar el estado financiero de la reserva."); } finally { setSubmitting(false); }
  };
  return <form className="form-stack" onSubmit={submit}>
    <label>Cliente<select className="field" required name="customerId" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Selecciona un cliente</option>{customerOptions.map((customer) => <option value={customer.id} key={customer.id}>{customerDisplayName(customer)}</option>)}</select></label>
    {onOpenCustomerPanel && <button type="button" className="workflow-link" onClick={onOpenCustomerPanel}>+ Registrar cliente en panel lateral</button>}
    <label>Reserva relacionada <span className="font-normal text-muted-foreground">(recomendado para cuotas)</span><select className="field" name="reservationId" value={selectedReservationId} onChange={(event) => selectReservation(event.target.value)}><option value="">Sin asociar</option>{reservationOptions.filter((reservation) => !selectedCustomerId || reservation.customerId === selectedCustomerId).map((reservation) => <option value={reservation.id} key={reservation.id}>{reservation.customerName} · {readableDate(reservation.date)} {reservation.time} · {currency(calculateReservationTotal(reservation), currencyCode(reservation.currency))}</option>)}</select></label>
    {selectedCustomer && onOpenReservationPanel && <button type="button" className="workflow-link" onClick={() => onOpenReservationPanel(selectedCustomer)}>+ Registrar reserva en panel lateral</button>}
    <label>Paquete <span className="font-normal text-muted-foreground">(el precio se copia exactamente)</span><select className="field" name="productId" value={selectedProductId} disabled={Boolean(selectedReservation)} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setSelectedProductId(event.target.value); if (product) { setAmount(String(product.price)); onSelectProduct?.(product); } }}><option value="">Pago personalizado / sin paquete</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {currency(product.price)} {product.unit}</option>)}</select></label>
    {selectedProduct && <button type="button" className="rounded-xl border border-[#1676F3]/20 bg-[#1676F3]/5 px-3 py-2 text-left text-xs leading-5 text-muted-foreground" onClick={() => onSelectProduct?.(selectedProduct)}><strong className="text-foreground">{selectedProduct.tagline}</strong> · {currency(selectedProduct.price)} {selectedProduct.unit}<span className="ml-2 font-bold text-[#1676F3]">Ver información</span></button>}
    {selectedReservation && <div className="rounded-xl border border-[#FFC72C]/25 bg-[#FFC72C]/5 px-3 py-3 text-xs leading-5 text-muted-foreground"><p><strong className="text-foreground">Precio exacto del paquete:</strong> {currency(reservationTotalValue, reservationCurrency)}</p><p className="mt-1"><strong className="text-foreground">Abonado anteriormente:</strong> {currency(previousPaid, reservationCurrency)}</p><p className="mt-1"><strong className="text-foreground">Esta cuota:</strong> {currency(currentAmount, reservationCurrency)} · <strong className="text-foreground">Saldo posterior:</strong> {currency(pendingAfter, reservationCurrency)}</p><p className={`mt-1 font-bold ${settlement === "settled" ? "text-[#08745D]" : settlement === "overpaid" ? "text-[#C53B53]" : "text-amber-800 dark:text-amber-200"}`}>{settlementLabel(settlement || "pending")}{overpayment > EPSILON ? ` · Exceso: ${currency(overpayment, reservationCurrency)}` : ""}</p></div>}
    <div className="grid gap-4 sm:grid-cols-2"><label>Tipo de pago<select className="field" name="kind" defaultValue={kindPreview}><option value="deposit">Anticipo</option><option value="partial">Pago parcial</option><option value="balance">Liquidación de saldo</option><option value="full">Pago completo</option></select></label><label>Importe<input className="field" type="number" name="amount" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label>Moneda<select className="field" name="currency" value={reservationCurrency} disabled={Boolean(selectedReservation)} onChange={(event) => setCurrencyState(event.target.value)}><option>USD</option><option>EUR</option><option>MXN</option><option>ARS</option><option>COP</option></select>{selectedReservation && <span className="mt-1 block text-xs font-normal text-muted-foreground">Bloqueada por la moneda de la reserva.</span>}</label><label>Método<select className="field" name="method" defaultValue={initial?.method || "card"}><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label></div>
    <label>Estado del movimiento<select className="field" name="status" value={statusState} onChange={(event) => setStatusState(event.target.value as PaymentStatus)}><option value="paid">Recibido / pagado</option><option value="pending">Pendiente de cobro</option><option value="refunded">Reintegrado</option></select></label>
    <label>Fecha<input className="field" type="date" name="paidAt" required defaultValue={initial?.paidAt || dateToday()} /></label>
    <label>Notas<textarea className="field min-h-20" name="notes" defaultValue={initial?.notes} /></label>
    <button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar pago"}<ChevronRight size={16} /></button>
  </form>;
}
function PaymentAdjustmentRequestForm({ payment, userId, onDone }: { payment: Payment; userId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const candidate: PaymentAdjustmentDraft = {
      amount: Number(form.get("amount")),
      kind: String(form.get("kind")) as PaymentKind,
      currency: String(form.get("currency")),
      method: String(form.get("method")) as PaymentMethod,
      status: String(form.get("status")) as PaymentStatus,
      paidAt: String(form.get("paidAt")),
      notes: String(form.get("notes")).trim(),
    };
    try {
      await requestPaymentAdjustment(payment, String(form.get("reason")), proposedPaymentChanges(payment, candidate), userId);
      toast.success("Solicitud enviada a Administración y Departamento de IT para su revisión.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible enviar la solicitud de ajuste.");
    } finally { setSubmitting(false); }
  };
  return <form className="form-stack" onSubmit={submit}><div className="rounded-xl border border-[#FFC72C]/30 bg-[#FFC72C]/10 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Pago confirmado protegido:</strong> el registro {operationCode("PAG", payment)} no cambia directamente. Indica la corrección y el motivo; Administración o Departamento de IT deberá aprobarla antes de aplicarla.</div><div className="grid gap-4 sm:grid-cols-2"><label>Importe<input className="field" name="amount" type="number" min="0" step="0.01" required defaultValue={payment.amount} /></label><label>Tipo de pago<select className="field" name="kind" defaultValue={payment.kind || "full"}><option value="deposit">Anticipo</option><option value="partial">Pago parcial</option><option value="balance">Liquidación de saldo</option><option value="full">Pago completo</option></select></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Moneda<select className="field" name="currency" defaultValue={payment.currency}><option>USD</option><option>EUR</option><option>MXN</option><option>ARS</option><option>COP</option></select></label><label>Método<select className="field" name="method" defaultValue={payment.method}><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Estado<select className="field" name="status" defaultValue={payment.status}><option value="paid">Pagado</option><option value="pending">Pendiente</option><option value="refunded">Reintegrado</option></select></label><label>Fecha de pago<input className="field" name="paidAt" type="date" required defaultValue={payment.paidAt} /></label></div><label>Notas<textarea className="field min-h-20" name="notes" defaultValue={payment.notes} /></label><label>Motivo del ajuste<textarea className="field min-h-24" name="reason" required placeholder="Explica qué se corrigió y por qué es necesario." /></label><button className="primary-button" disabled={submitting}>{submitting ? "Enviando…" : "Enviar solicitud de ajuste"}<ChevronRight size={16} /></button></form>;
}

const adjustmentFieldLabels: Record<string, string> = { amount: "Importe", kind: "Tipo de pago", currency: "Moneda", method: "Método", status: "Estado", paidAt: "Fecha de pago", notes: "Notas", settlementStatus: "Liquidación de la reserva" };
const adjustmentValue = (field: string, value: unknown, payment: Payment) => field === "amount" ? currency(Number(value), payment.currency) : field === "kind" || field === "status" ? labelStatus[String(value)] || String(value) : value === "" || value === undefined ? "Sin dato" : String(value);

function PaymentAdjustmentReviewPanel({ requests, payments, isAdmin, userId }: { requests: PaymentAdjustmentRequest[]; payments: Payment[]; isAdmin: boolean; userId: string }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const visible = isAdmin ? requests : requests.filter((request) => request.requestedBy === userId);
  const pending = visible.filter((request) => request.status === "pending");
  const decide = async (request: PaymentAdjustmentRequest, action: "approve" | "reject") => {
    setBusy(`${action}:${request.id}`);
    try {
      if (action === "approve") await approvePaymentAdjustmentRequest(request.id, notes[request.id] || "", userId);
      else await rejectPaymentAdjustmentRequest(request.id, notes[request.id] || "", userId);
      toast.success(action === "approve" ? "Ajuste aprobado y aplicado al pago." : "Solicitud de ajuste rechazada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo resolver la solicitud."); }
    finally { setBusy(null); }
  };
  if (!visible.length) return null;
  return <section className="panel-card mt-6 overflow-hidden"><header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"><div><p className="font-extrabold">{isAdmin ? "Solicitudes de ajuste de pagos" : "Mis solicitudes de ajuste"}</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{isAdmin ? "Las solicitudes pendientes requieren un dictamen. Aprobarlas aplica exclusivamente los cambios propuestos y deja el vínculo de auditoría en el pago." : "Aquí puedes consultar el estado de las correcciones solicitadas sobre pagos ya confirmados."}</p></div>{pending.length ? <span className="rounded-full bg-[#FFC72C]/15 px-3 py-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-200">{pending.length} pendiente{pending.length === 1 ? "" : "s"}</span> : <span className="rounded-full bg-[#38D98B]/15 px-3 py-1.5 text-xs font-extrabold text-[#08745D] dark:text-[#8BE3CB]">Al día</span>}</header><div className="divide-y">{visible.map((request) => { const payment = payments.find((item) => item.id === request.paymentId); return <article className="px-5 py-5" key={request.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold">{request.paymentCode || payment?.code || request.paymentId}</p><p className="mt-1 text-sm text-muted-foreground">Solicitada por {request.requestedByName || "Personal"} · {readableTimestamp(request.createdAt)}</p></div><StatusPill status={request.status} /></div><p className="mt-4 text-sm leading-6"><strong>Motivo:</strong> {request.reason}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(request.proposedChanges).map(([field, value]) => <div className="rounded-xl border bg-muted/25 px-3 py-2.5" key={field}><p className="text-[10px] font-extrabold uppercase tracking-[.11em] text-muted-foreground">{adjustmentFieldLabels[field] || field}</p><p className="mt-1 text-sm font-bold">{adjustmentValue(field, value, payment || { currency: "USD" } as Payment)}</p></div>)}</div>{request.status === "pending" && isAdmin ? <div className="mt-4 border-t pt-4"><label className="block text-sm font-bold">Observación administrativa <span className="font-normal text-muted-foreground">(opcional)</span><textarea className="field mt-1 min-h-20 font-normal" value={notes[request.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Añade una nota que recibirá la persona solicitante." /></label><div className="mt-3 flex flex-wrap gap-2"><button className="primary-button" disabled={Boolean(busy)} onClick={() => void decide(request, "approve")}>{busy === `approve:${request.id}` ? "Aprobando…" : "Aprobar y aplicar"}<CheckCircle2 size={16} /></button><button className="secondary-button text-destructive" disabled={Boolean(busy)} onClick={() => void decide(request, "reject")}>{busy === `reject:${request.id}` ? "Rechazando…" : "Rechazar"}<X size={16} /></button></div></div> : request.status !== "pending" ? <p className="mt-4 rounded-xl border bg-muted/30 px-3 py-3 text-xs leading-5 text-muted-foreground">Decidida por <strong className="text-foreground">{request.decidedByName || "Administración"}</strong> · {readableTimestamp(request.decidedAt)}{request.decisionReason ? ` · ${request.decisionReason}` : ""}</p> : <p className="mt-4 rounded-xl border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">Pendiente de revisión administrativa.</p>}</article>; })}</div></section>;
}

function ProductInfoPanel({ product }: { product: Product }) {
  return <section className="space-y-5"><div className="rounded-2xl border border-[#1676F3]/20 bg-[#1676F3]/5 p-4"><p className="eyebrow">{product.category === "promotion" ? "Promoción" : "Arancel"}</p><h3 className="mt-1 text-xl font-extrabold tracking-tight">{product.name}</h3><p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p><p className="mt-4 text-2xl font-extrabold">{currency(product.price)} <span className="text-sm font-semibold text-muted-foreground">{product.unit}</span></p></div><div><p className="text-sm font-extrabold">Incluye</p><dl className="mt-3 divide-y rounded-xl border">{(product.details ?? []).map((detail) => <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 px-3 py-3 text-sm" key={`${product.id}-${detail.label}`}><dt className="font-bold">{detail.label}</dt><dd className="text-muted-foreground">{detail.value}</dd></div>)}</dl></div><p className="rounded-xl border bg-muted/30 px-3 py-3 text-xs leading-5 text-muted-foreground">La información mostrada se copiará a la reserva o el pago al guardar, preservando el paquete, precio y unidad aplicados en ese momento.</p></section>;
}

function AccountsReceivablePanel({ accounts, onRegisterPayment }: { accounts: ReceivableAccount[]; onRegisterPayment: (reservation: Reservation) => void }) {
  const attentionAccounts = accounts.filter((account) => account.pendingBalance > 0 || account.status === "overpaid");
  const totals = receivableTotalsByCurrency(attentionAccounts);
  if (!attentionAccounts.length) return <section className="panel-card mt-5 border-[#38D98B]/25 bg-[#38D98B]/5 px-5 py-4"><p className="font-extrabold">Cuentas por cobrar al día</p><p className="mt-1 text-sm text-muted-foreground">No hay saldos pendientes ni sobrepagos por revisar.</p></section>;
  return <section className="panel-card mt-5 overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4"><div><p className="font-extrabold">Cuentas por cobrar y conciliación</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cada reserva conserva cuotas ilimitadas. Los abonos y saldos se calculan por moneda y los sobrepagos permanecen visibles para revisión.</p></div><div className="flex flex-wrap gap-2">{Object.entries(totals).map(([currencyCode, summary]) => <span className="rounded-full bg-[#FFC72C]/15 px-3 py-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-200" key={currencyCode}>{currency(summary.pendingBalance, currencyCode)} pendiente · {summary.accounts} abierta{summary.accounts === 1 ? "" : "s"}{summary.overpaid > 0 ? ` · sobrepago ${currency(summary.overpayment, currencyCode)}` : ""}</span>)}</div></div><div className="table-wrap"><table><thead><tr><th>Reserva</th><th>Cliente</th><th>Valor</th><th>Abonado</th><th>Saldo / exceso</th><th>Cuotas</th><th aria-label="Registrar pago" /></tr></thead><tbody>{attentionAccounts.map((account) => <tr key={account.reservation.id}><td><span className="time-code font-bold">{operationCode("RES", account.reservation)}</span><span className="mt-1 block text-xs text-muted-foreground">{account.reservation.productName || account.reservation.service}</span></td><td><p className="font-bold">{account.reservation.customerName}</p><span>{readableDate(account.reservation.date)}</span></td><td>{currency(account.totalDue, account.currency)}</td><td>{currency(account.paidTotal, account.currency)}</td><td className={`font-extrabold ${account.status === "overpaid" ? "text-[#C53B53]" : "text-amber-800 dark:text-amber-200"}`}>{account.status === "overpaid" ? `Exceso ${currency(account.overpayment, account.currency)}` : currency(account.pendingBalance, account.currency)}</td><td>{account.installmentCount} abono{account.installmentCount === 1 ? "" : "s"}</td><td>{account.pendingBalance > 0 ? <button className="secondary-button whitespace-nowrap" onClick={() => onRegisterPayment(account.reservation)}><CreditCard size={15} />Registrar siguiente pago</button> : <StatusPill status={account.status} />}</td></tr>)}</tbody></table></div></section>;
}

function EmployeeForm({ initial, adminId, canManageIT, onDone }: { initial?: UserProfile; adminId: string; canManageIT: boolean; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName")).trim();
    const role = (String(form.get("role") || initial?.role || "personal")) as UserRole;
    const status = (String(form.get("status") || initial?.status || "active")) as "active" | "suspended";
    const email = String(form.get("email")).trim().toLowerCase();
    try {
      if (initial?.role !== "personal" && !canManageIT) throw new Error("Administración solo puede editar datos operativos de perfiles de Personal.");
      if (initial && email !== initial.email.toLowerCase() && !canManageIT) throw new Error("Solo el Departamento de IT puede cambiar un correo de acceso.");
      if (!initial) {
        const invitationEmail = await inviteEmployee(email, displayName, role, adminId);
        toast.success(`Invitación preparada para ${invitationEmail}.`);
      } else if (email !== initial.email.toLowerCase()) {
        await inviteEmployee(email, displayName, role, adminId);
        await updateEmployee(initial.id, { displayName, role, status: "suspended" }, adminId);
        toast.success("Nueva invitación creada y acceso anterior suspendido. La persona podrá activar su nueva cuenta con el correo actualizado.");
      } else {
        await updateEmployee(initial.id, { displayName, role, status }, adminId);
        toast.success("Empleado actualizado.");
      }
      onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible guardar la información del empleado.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return <form className="form-stack" onSubmit={submit}>
    <label>Nombre completo<input className="field" name="displayName" required defaultValue={initial?.displayName} /></label>
    <label>Correo de acceso<input className={`field ${initial && !canManageIT ? "bg-muted" : ""}`} type="email" name="email" required defaultValue={initial?.email} placeholder="persona@empresa.com" readOnly={Boolean(initial && !canManageIT)} /></label>
    {initial && <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">Al cambiar el correo se genera automáticamente una invitación para el nuevo acceso y se suspende el acceso anterior. Así no se modifican usuarios manualmente desde la base de datos.</p>}
    {canManageIT ? <label>Rol<select className="field" name="role" defaultValue={initial?.role || "personal"}><option value="personal">Personal</option><option value="admin">Administración</option><option value="it">Departamento de IT</option></select></label> : <><input type="hidden" name="role" value={initial?.role || "personal"} /><div><p className="text-sm font-bold">Rol</p><p className="field mt-1 bg-muted text-muted-foreground">{initial?.role === "personal" ? "Personal" : "Asignación de acceso reservada a Departamento de IT"}</p></div></>}
    {initial && canManageIT ? <label>Estado<select className="field" name="status" defaultValue={initial.status}><option value="active">Activo</option><option value="suspended">Suspendido</option></select></label> : initial ? <input type="hidden" name="status" value={initial.status} /> : null}
    <button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : initial ? "Guardar cambios" : "Crear invitación"}<ChevronRight size={16} /></button>
    {!initial && <p className="text-xs leading-5 text-muted-foreground">La persona podrá crear su contraseña con este mismo correo. Comparte la instrucción de registro tras crear la invitación.</p>}
  </form>;
}

function OperationsPanel({ reservations, employees, userId }: { reservations: Reservation[]; employees: UserProfile[]; userId: string }) {
  const activeEmployees = employees.filter((employee) => employee.status === "active");
  const grouped = reservations.filter((reservation) => (reservation.groupSize || 0) > 1 || reservation.groupName);
  return <><PageTitle eyebrow="Coordinación administrativa" title="Asignaciones y grupos" /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Asigna un responsable a cada sesión y supervisa las reservas grupales. Este panel solo está disponible para Administración/IT.</p><section className="panel-card mt-6 overflow-hidden"><div className="border-b px-5 py-4"><p className="font-extrabold">Asignaciones de reservas</p><p className="mt-0.5 text-xs text-muted-foreground">El responsable queda guardado dentro de la reserva y visible en su ficha.</p></div>{reservations.length ? <div className="table-wrap"><table><thead><tr><th>Reserva</th><th>Cliente / grupo</th><th>Fecha</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation.id}><td><span className="time-code font-bold">{operationCode("RES", reservation)}</span><p className="mt-1 text-xs text-muted-foreground">{reservation.service}</p></td><td><p className="font-bold">{reservation.groupName || reservation.customerName}</p><span>{reservation.groupSize && reservation.groupSize > 1 ? `${reservation.groupSize} participantes${reservation.groupBonusEligible ? " · Foto grupal incluida" : ""}` : "Individual"}</span></td><td>{readableDate(reservation.date)}<span className="ml-2 text-xs text-muted-foreground">{reservation.time}</span></td><td><select className="field min-w-44 py-1.5 text-xs" value={reservation.assignedToId || ""} onChange={async (event) => { const employee = activeEmployees.find((item) => item.id === event.target.value); try { await updateRecord("reservations", reservation.id, { assignedToId: employee?.id, assignedToName: employee?.displayName || "", assignmentNote: reservation.assignmentNote || "" }, userId); toast.success(employee ? `Asignado a ${employee.displayName}.` : "Asignación retirada."); } catch { toast.error("No se pudo guardar la asignación."); } }}><option value="">Sin asignar</option>{activeEmployees.map((employee) => <option value={employee.id} key={employee.id}>{employee.displayName}</option>)}</select></td><td><StatusPill status={reservation.status} /></td></tr>)}</tbody></table></div> : <Empty title="Sin reservas para asignar" detail="Las nuevas reservas aparecerán aquí para coordinar al equipo." />}</section>{grouped.length > 0 && <section className="panel-card mt-6 overflow-hidden"><div className="border-b px-5 py-4"><p className="font-extrabold">Reservas grupales</p><p className="mt-0.5 text-xs text-muted-foreground">Control de participantes, paquete y beneficio de fotografía grupal.</p></div><div className="divide-y">{grouped.map((reservation) => <article className="px-5 py-4" key={reservation.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{reservation.groupName || reservation.customerName}</p><p className="mt-1 text-sm text-muted-foreground">{reservation.productName || reservation.service} · {reservation.groupSize || 0} participantes</p><p className="mt-1 text-xs text-muted-foreground">{reservation.participantNames?.length ? reservation.participantNames.join(", ") : "Sin integrantes detallados"}</p></div>{reservation.groupBonusEligible && <span className="rounded-full bg-[#38D98B]/15 px-2.5 py-1 text-xs font-bold text-[#08745D] dark:text-[#8BE3CB]">Foto grupal adicional incluida</span>}</div></article>)}</div></section>}</>;
}

function CarbonImpactPanel({ usage }: { usage: CarbonUsage[] }) {
  const byUser = useMemo(() => {
    const users = new Map<string, { id: string; displayName: string; email: string; grams: number; bytes: number; sessions: number }>();
    usage.forEach((entry) => {
      const previous = users.get(entry.userId) || { id: entry.userId, displayName: entry.displayName, email: entry.email, grams: 0, bytes: 0, sessions: 0 };
      previous.grams += Number(entry.estimatedGramsCO2e || 0);
      previous.bytes += Number(entry.transferredBytes || 0);
      previous.sessions += 1;
      users.set(entry.userId, previous);
    });
    return Array.from(users.values()).sort((left, right) => right.grams - left.grams);
  }, [usage]);
  const totalGrams = byUser.reduce((sum, item) => sum + item.grams, 0);
  const totalBytes = byUser.reduce((sum, item) => sum + item.bytes, 0);
  return <section className="panel-card mt-6 overflow-hidden"><div className="border-b bg-[#38D98B]/5 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold">Huella digital estimada por Personal</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Indicador informativo de datos transferidos durante sesiones de la plataforma. No es una medición física, un inventario de GEI ni una compensación de carbono.</p></div><Leaf className="text-[#0F8F73]" size={21} /></div></div><div className="grid gap-px border-b bg-border sm:grid-cols-3"><div className="bg-card px-5 py-4"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">Estimación acumulada</p><p className="mt-2 text-xl font-extrabold">{carbonLabel(totalGrams)}</p></div><div className="bg-card px-5 py-4"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">Transferencia registrada</p><p className="mt-2 text-xl font-extrabold">{dataLabel(totalBytes)}</p></div><div className="bg-card px-5 py-4"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">Sesiones registradas</p><p className="mt-2 text-xl font-extrabold">{usage.length}</p></div></div>{byUser.length ? <div className="table-wrap"><table><thead><tr><th>Personal</th><th>Transferencia estimada</th><th>Huella estimada</th><th>Sesiones</th></tr></thead><tbody>{byUser.map((entry) => <tr key={entry.id}><td><p className="font-bold">{entry.displayName}</p><span>{entry.email || "Sin correo"}</span></td><td>{dataLabel(entry.bytes)}</td><td className="font-bold text-[#08745D] dark:text-[#8BE3CB]">{carbonLabel(entry.grams)}</td><td>{entry.sessions}</td></tr>)}</tbody></table></div> : <Empty title="Aún no hay sesiones ambientales" detail="Cada inicio de sesión registrará de forma automática una estimación basada en la transferencia observada por el navegador." />}<div className="border-t bg-muted/30 px-5 py-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Metodología visible:</strong> se multiplican los bytes observados por el navegador por <strong className="text-foreground">148.2 g CO₂e/GB</strong> (0.300 kWh/GB × 494 g CO₂e/kWh), derivado del Sustainable Web Design Model v4. Los datos servidos desde caché, extensiones, actividad fuera de la aplicación y diferencias del dispositivo pueden hacer que esta estimación sea incompleta. <a className="font-bold text-[#1676F3] hover:underline" href="https://sustainablewebdesign.org/estimating-digital-emissions/" target="_blank" rel="noreferrer">Consultar metodología</a>.</div></section>;
}

function AccessPanel({ accessLogs, activityLogs, carbonUsage }: { accessLogs: AccessLog[]; activityLogs: ActivityLog[]; carbonUsage: CarbonUsage[] }) {
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({ id: "global", inactivityValue: 15, inactivityUnit: "minutes" });
  const [saving, setSaving] = useState(false);
  useEffect(() => subscribeSecuritySettings(setSecuritySettings, () => toast.error("No se pudo leer la política de seguridad.")), []);
  const timeline = useMemo(() => {
    const stamp = (value: unknown) => value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function" ? (value as { toDate: () => Date }).toDate().getTime() : 0;
    return [...accessLogs.map((log) => ({ id: `access-${log.id}`, name: log.displayName, email: log.email, role: log.role, label: log.event === "account_created" ? "Cuenta creada" : log.event === "login" ? "Inicio de sesión" : "Cierre de sesión", summary: log.summary || "Acceso autenticado a la plataforma", occurredAt: log.occurredAt, tone: "access" })), ...activityLogs.map((activity) => ({ id: `activity-${activity.id}`, name: activity.actorName, email: activity.actorEmail, role: undefined, label: "Movimiento operativo", summary: activity.summary, occurredAt: activity.occurredAt, tone: "activity" }))].sort((left, right) => stamp(right.occurredAt) - stamp(left.occurredAt));
  }, [accessLogs, activityLogs]);
  const inactivityValue = securitySettings.inactivityValue || securitySettings.inactivityMinutes || 15;
  const inactivityUnit = securitySettings.inactivityUnit || "minutes";
  const limits = inactivityUnit === "seconds" ? "10–3,600" : inactivityUnit === "minutes" ? "1–1,440" : "1–24";
  return <><PageTitle eyebrow="Seguridad administrativa" title="Accesos y actividad" /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Cronología completa de cada integrante: creación de cuenta, inicios de sesión y movimientos operativos, desde el primer registro hasta la última acción. Solo Administración/IT puede consultarla.</p><section className="panel-card mt-6 overflow-hidden"><div className="border-b px-5 py-4"><p className="font-extrabold">Cierre automático por inactividad</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Esta política es global: se sincroniza en las sesiones activas de toda la plataforma. Solo Administración/IT puede modificarla.</p><form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start" onSubmit={async (event) => { event.preventDefault(); const userId = auth.currentUser?.uid; if (!userId) return; setSaving(true); try { await updateSecuritySettings(inactivityValue, inactivityUnit, userId); toast.success("Tiempo de inactividad actualizado para todo el equipo."); } catch { toast.error("No se pudo actualizar la política de seguridad."); } finally { setSaving(false); } }}><label className="grid min-w-0 content-start gap-2 text-sm font-bold">Cerrar sesión después de<input className="field" type="number" min="1" value={inactivityValue} onChange={(event) => setSecuritySettings((settings) => ({ ...settings, inactivityValue: Number(event.target.value) || 1 }))} /><span className="min-h-8 text-xs font-normal leading-4 text-muted-foreground">Rango permitido: {limits} {inactivityUnit === "seconds" ? "segundos" : inactivityUnit === "minutes" ? "minutos" : "horas"}</span></label><label className="grid min-w-0 content-start gap-2 text-sm font-bold">Unidad<select className="field" value={inactivityUnit} onChange={(event) => setSecuritySettings((settings) => ({ ...settings, inactivityUnit: event.target.value as NonNullable<SecuritySettings["inactivityUnit"]> }))}><option value="seconds">Segundos</option><option value="minutes">Minutos</option><option value="hours">Horas</option></select><span aria-hidden="true" className="min-h-8 text-xs leading-4">&nbsp;</span></label><button className="primary-button col-span-full sm:col-span-1 sm:mt-6" disabled={saving}>{saving ? "Guardando…" : "Guardar política"}</button></form>{securitySettings.updatedByName && <p className="mt-3 text-xs text-muted-foreground">Última actualización: {securitySettings.updatedByName} · {readableTimestamp(securitySettings.updatedAt)}</p>}</div></section><CarbonImpactPanel usage={carbonUsage} /><section className="panel-card mt-6 overflow-hidden">{timeline.length ? <div className="table-wrap"><table><thead><tr><th>Personal</th><th>Tipo</th><th>Detalle</th><th>Fecha y hora</th></tr></thead><tbody>{timeline.map((item) => <tr key={item.id}><td><p className="font-bold">{item.name}</p><span>{item.email || "Sin correo"}</span></td><td>{item.role ? <StatusPill status={item.role} /> : <span className="rounded-full bg-[#855CF5]/10 px-2.5 py-1 text-xs font-bold text-[#6841D5] dark:text-[#C9B9FF]">Actividad</span>}</td><td><p className="font-semibold">{item.label}</p><span>{item.summary}</span></td><td>{readableTimestamp(item.occurredAt)}</td></tr>)}</tbody></table></div> : <Empty title="Sin actividad registrada" detail="Las altas de cuenta, accesos y nuevos movimientos aparecerán aquí automáticamente." />}</section></>;
}

export default function Dashboard({ user, profile }: { user: User; profile: UserProfile }) {
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>(() => isSection(window.history.state?.sigesSection) ? window.history.state.sigesSection : "overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAdjustmentRequests, setPaymentAdjustmentRequests] = useState<PaymentAdjustmentRequest[]>([]);
  const [productOverrides, setProductOverrides] = useState<Product[]>([]);
  const [productCategorySettings, setProductCategorySettings] = useState<ProductCategorySetting[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [carbonUsage, setCarbonUsage] = useState<CarbonUsage[]>([]);
  const [reminders, setReminders] = useState<GeneralReminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [hrProfile, setHrProfile] = useState<HrProfile | null>(null);
  const [hrProfiles, setHrProfiles] = useState<HrProfile[]>([]);
  const [organizationUnits, setOrganizationUnits] = useState<OrganizationUnit[]>([]);
  const [employmentContracts, setEmploymentContracts] = useState<EmploymentContract[]>([]);
  const [hrDocuments, setHrDocuments] = useState<HrDocument[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [attendanceGuards, setAttendanceGuards] = useState<AttendanceGuard[]>([]);
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([]);
  const [temporaryPermissions, setTemporaryPermissions] = useState<TemporaryPermission[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>({ id: "global", timezone: "local", clockIn: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 }, clockOut: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 }, breakStart: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 }, breakEnd: { startTime: "07:00", endTime: "12:00", maxPerDay: 1 } });
  const impactSessionId = useRef<string | null>(null);
  const impactInteractions = useRef(0);
  const impactPageViews = useRef(1);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [lifecycleChecklists, setLifecycleChecklists] = useState<LifecycleChecklist[]>([]);
  const [hrGoals, setHrGoals] = useState<HrGoal[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [hrPolicies, setHrPolicies] = useState<HrPolicy[]>([]);
  const [internalMessages, setInternalMessages] = useState<InternalMessage[]>([]);
  const [policyAcknowledgments, setPolicyAcknowledgments] = useState<PolicyAcknowledgment[]>([]);
  const [queryText, setQueryText] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const failedSyncModules = useRef(new Set<string>());
  const syncToastTimer = useRef<number | null>(null);
  const [modal, setModal] = useState<{ type: RecordType; data?: RecordData; detail?: { eyebrow: string; title: string; data: Record<string, unknown>; related?: Record<string, unknown> | null } } | null>(null);
  const [relatedPanel, setRelatedPanel] = useState<RelatedPanel>(null);
  const [workflowCustomer, setWorkflowCustomer] = useState<Customer | null>(null);
  const [workflowReservation, setWorkflowReservation] = useState<Reservation | null>(null);
  const [workflowProduct, setWorkflowProduct] = useState<Product | null>(null);
  const [categoryEditing, setCategoryEditing] = useState<ProductCategory | null>(null);
  const [customerSort, setCustomerSort] = useState<"first-asc" | "first-desc" | "last-asc" | "last-desc">("last-asc");
  const [historyFilter, setHistoryFilter] = useState<"all" | ActivityLog["entity"]>("all");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<"all" | ReservationStatus>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkEditSection, setBulkEditSection] = useState<Section | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("heliot-sidebar-collapsed") === "true");
  const isIT = profile.role === "it";
  const isAdmin = profile.role === "admin" || isIT;
  const hasTemporaryAccess = (module: TemporaryPermission["module"], collection?: string, recordId?: string, action: "edit" | "delete" = "edit") => temporaryPermissions.some((permission) => {
    if (permission.module !== module || !permission.actions.includes(action)) return false;
    if (permission.scope === "module") return true;
    if (permission.scope === "self") return recordId === user.uid;
    return permission.scope === "record" && (!permission.targetCollection || permission.targetCollection === collection) && permission.recordId === recordId;
  });
  const hasTemporaryModule = (module: TemporaryPermission["module"], action: "edit" | "delete" = "edit") => temporaryPermissions.some((permission) => permission.module === module && permission.actions.includes(action));
  const canManageHr = isAdmin || hasTemporaryModule("hr");
  const canManageFinance = isAdmin || hasTemporaryModule("finance");
  const canManageReports = isAdmin || hasTemporaryModule("hr_reports");
  const temporarySections = useMemo<Section[]>(() => Array.from(new Set(temporaryPermissions.flatMap((permission) => permission.module === "finance" ? ["finance" as Section] : permission.module === "hr_reports" ? ["hr_reports" as Section] : permission.module === "performance" ? ["performance" as Section] : permission.module === "automations" ? ["automations" as Section] : permission.module === "operations" ? ["operations" as Section] : permission.module === "history" ? ["history" as Section] : permission.module === "employees" ? ["employees" as Section] : []))), [temporaryPermissions]);
  const globalSearchIndex = useMemo<GlobalSearchIndexEntry[]>(() => [
    ...employees.map(item => ({ id: `employee-${item.id}`, destination: "employees" as const, category: "Personal", title: item.displayName, detail: `${item.email} · ${item.role}`, searchable: Object.values(item) })),
    ...hrProfiles.map(item => ({ id: `hr-profile-${item.id}`, destination: "hr" as const, category: "Expediente", title: item.employeeCode || item.employeeId, detail: `${item.position || "Sin cargo"} · ${item.department || "Sin departamento"}`, searchable: Object.values(item) })),
    ...organizationUnits.map(item => ({ id: `org-${item.id}`, destination: "hr" as const, category: "Organización", title: item.name, detail: `${item.kind} · ${item.parentName || "Sin superior"}`, searchable: Object.values(item) })),
    ...employmentContracts.map(item => ({ id: `contract-${item.id}`, destination: "hr" as const, category: "Contrato", title: item.employeeName, detail: `${item.contractType} · ${item.status}`, searchable: Object.values(item) })),
    ...hrDocuments.map(item => ({ id: `document-${item.id}`, destination: "hr" as const, category: "Documento RR. HH.", title: item.name, detail: `${item.employeeName} · ${item.status}`, searchable: Object.values(item) })),
    ...attendanceRecords.map(item => ({ id: `attendance-${item.id}`, destination: "hr" as const, category: "Asistencia", title: item.employeeName, detail: `${item.type} · ${item.dayKey || "Fecha pendiente"}`, searchable: Object.values(item) })),
    ...leaveRequests.map(item => ({ id: `leave-${item.id}`, destination: "hr" as const, category: "Ausencia", title: item.employeeName, detail: `${item.startDate} — ${item.endDate} · ${item.status}`, searchable: Object.values(item) })),
    ...internalMessages.map(item => ({ id: `mail-${item.id}`, destination: "mail" as const, category: "Correo interno", title: item.subject, detail: item.body, searchable: Object.values(item) })),
    ...(isAdmin ? payrollRuns.map(item => ({ id: `payroll-${item.id}`, destination: "payroll" as const, category: "Planilla", title: `Planilla ${item.periodKey}`, detail: `${item.status} · ${item.totalNet} ${item.currency}`, searchable: Object.values(item) })) : []),
    ...(isAdmin ? activityLogs.map(item => ({ id: `activity-${item.id}`, destination: "history" as const, category: "Historial", title: item.summary, detail: `${item.entity} · ${item.action}`, searchable: Object.values(item) })) : []),
  ], [activityLogs, attendanceRecords, employees, employmentContracts, hrDocuments, hrProfiles, internalMessages, isAdmin, leaveRequests, organizationUnits, payrollRuns]);
  const latestHrProfile = useRef<HrProfile | null>(null);
  const logout = () => void (async () => {
    try { await recordAccess(user.uid, profile, "logout"); }
    finally {
      window.localStorage.removeItem(`sistema-heliot:last-activity:${user.uid}`);
      window.sessionStorage.removeItem(`sistema-heliot:fresh-session:${user.uid}`);
      await signOut(auth);
    }
  })();

  useEffect(() => { latestHrProfile.current = hrProfile; }, [hrProfile]);

  useEffect(() => {
    failedSyncModules.current.clear();
    const report = (module: string, error: Error) => {
      failedSyncModules.current.add(module);
      const code = (error as { code?: string }).code || "";
      const reason = code === "failed-precondition"
        ? "Falta un índice de Firestore; revisa el enlace que Firebase muestra en la consola."
        : code === "permission-denied" || code === "firestore/permission-denied"
          ? "Publica el archivo firestore.rules completo para activar los permisos nuevos."
          : "Comprueba la conexión y la configuración de Firebase.";
      if (syncToastTimer.current) return;
      syncToastTimer.current = window.setTimeout(() => {
        syncToastTimer.current = null;
        toast.error("Hay módulos pendientes de sincronización.", { id: "firebase-sync-status", description: `${Array.from(failedSyncModules.current).join(", ")}. ${reason}` });
      }, 120);
    };
    const stops = [subscribeCollection<Customer>("customers", setCustomers, (error) => report("Clientes", error)), subscribeCollection<Reservation>("reservations", setReservations, (error) => report("Reservas", error)), subscribeCollection<Payment>("payments", setPayments, (error) => report("Pagos", error)), subscribePaymentAdjustmentRequests(user.uid, isAdmin, setPaymentAdjustmentRequests, (error) => report("Ajustes de pago", error)), subscribeCollection<Product>("products", setProductOverrides, (error) => report("Productos", error)), subscribeProductCategorySettings(setProductCategorySettings, (error) => report("Categorías de Productos", error)), subscribeCollection<UserProfile>("users", setEmployees, (error) => report("Personal", error)), subscribeInternalMessages(user.uid, isAdmin, setInternalMessages, (error) => report("Correo interno", error)), subscribeCollection<GeneralReminder>("generalReminders", setReminders, (error) => report("Notificaciones", error)), subscribeCollection<Task>("tasks", setTasks, (error) => report("Tareas", error)), subscribeCollection<Incident>("incidents", setIncidents, (error) => report("Incidencias", error)), subscribeCarbonUsage(user.uid, isAdmin, setCarbonUsage, (error) => report("Impacto digital", error)), subscribeOwnHrProfile(user.uid, setHrProfile, (error) => report("Mi expediente", error)), subscribeAttendanceSettings(setAttendanceSettings, (error) => report("Configuración de asistencia", error)), subscribeCollection<AttendanceGuard>("attendanceGuards", setAttendanceGuards, (error) => report("Guardia de asistencia", error)), subscribeUpdateRequests(user.uid, isAdmin, setUpdateRequests, (error) => report("Solicitudes de actualización", error)), subscribeOwnTemporaryPermissions(user.uid, setTemporaryPermissions, (error) => report("Permisos temporales", error)), subscribeEmployeeHrRecords<AttendanceRecord>("attendanceRecords", user.uid, isAdmin, setAttendanceRecords, (error) => report("Asistencia", error)), subscribeEmployeeHrRecords<LeaveRequest>("leaveRequests", user.uid, isAdmin, setLeaveRequests, (error) => report("Ausencias", error)), subscribeEmployeeHrRecords<HrGoal>("hrGoals", user.uid, isAdmin, setHrGoals, (error) => report("Objetivos", error)), subscribeEmployeeHrRecords<PerformanceReview>("performanceReviews", user.uid, isAdmin, setPerformanceReviews, (error) => report("Desempeño", error)), subscribeEmployeeHrRecords<TrainingRecord>("trainingRecords", user.uid, isAdmin, setTrainingRecords, (error) => report("Capacitación", error)), subscribeEmployeeHrRecords<Recognition>("recognitions", user.uid, isAdmin, setRecognitions, (error) => report("Reconocimientos", error)), subscribeEmployeeHrRecords<PolicyAcknowledgment>("policyAcknowledgments", user.uid, isAdmin, setPolicyAcknowledgments, (error) => report("Políticas", error)), subscribeHrPolicies(isAdmin, setHrPolicies, (error) => report("Políticas", error))];
    if (isAdmin) stops.push(subscribeCollection<ActivityLog>("activityLogs", setActivityLogs, (error) => report("Historial", error)), subscribeCollection<Expense>("expenses", setExpenses, (error) => report("Finanzas", error)), subscribeCollection<PayrollRun>("payrollRuns", setPayrollRuns, (error) => report("Planilla", error)), subscribeCollection<HrProfile>("hrProfiles", setHrProfiles, (error) => report("Expedientes", error)), subscribeCollection<OrganizationUnit>("organizationUnits", setOrganizationUnits, (error) => report("Organización", error)), subscribeCollection<EmploymentContract>("employmentContracts", setEmploymentContracts, (error) => report("Contratos", error)), subscribeCollection<HrDocument>("hrDocuments", setHrDocuments, (error) => report("Documentos RR. HH.", error)), subscribeCollection<WorkSchedule>("workSchedules", setWorkSchedules, (error) => report("Horarios", error)), subscribeCollection<LifecycleChecklist>("lifecycleChecklists", setLifecycleChecklists, (error) => report("Ciclos laborales", error)), subscribeCollection<Automation>("automations", setAutomations, (error) => report("Automatizaciones", error)));
    if (isIT) stops.push(subscribeCollection<Invitation>("invitations", setInvitations, (error) => report("Invitaciones", error)), subscribeCollection<AccessLog>("accessLogs", setAccessLogs, (error) => report("Accesos", error)));
    return () => { stops.forEach((stop) => stop()); if (syncToastTimer.current) { window.clearTimeout(syncToastTimer.current); syncToastTimer.current = null; } };
  }, [isAdmin, isIT, user.uid]);

  useEffect(() => {
    const sessionKey = `heliot-carbon-recorded-${user.uid}-${Math.round(performance.timeOrigin)}`;
    if (window.sessionStorage.getItem(sessionKey) || !window.performance?.getEntriesByType) return;
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const transferredBytes = Math.max(0, navigation?.transferSize || 0) + resources.reduce((total, entry) => total + Math.max(0, entry.transferSize || 0), 0);
    if (!transferredBytes) return;
    window.sessionStorage.setItem(sessionKey, "pending");
    const deviceClass: NonNullable<CarbonUsage["deviceClass"]> = window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
    let activeStartedAt = performance.now(); let activeMilliseconds = 0; let active = document.visibilityState === "visible";
    const captureActive = () => { if (active) { activeMilliseconds += Math.max(0, performance.now() - activeStartedAt); activeStartedAt = performance.now(); } };
    const updateSession = () => { if (!impactSessionId.current) return; captureActive(); const currentProfile = latestHrProfile.current; const organization = currentProfile?.departmentId ? { departmentId: currentProfile.departmentId, departmentName: currentProfile.department || "Sin departamento" } : {}; void updateCarbonUsageSession(impactSessionId.current, user.uid, { activeMilliseconds: Math.round(activeMilliseconds), operationCount: impactInteractions.current, pageViews: impactPageViews.current, ...organization }); };
    const changeVisibility = () => { captureActive(); active = document.visibilityState === "visible"; activeStartedAt = performance.now(); if (!active) updateSession(); };
    const countInteraction = () => { if (document.visibilityState === "visible") impactInteractions.current += 1; };
    const interval = window.setInterval(updateSession, 10_000);
    document.addEventListener("visibilitychange", changeVisibility);
    window.addEventListener("pagehide", updateSession);
    window.addEventListener("pointerdown", countInteraction, { passive: true });
    window.addEventListener("keydown", countInteraction, { passive: true });
    const currentProfile = latestHrProfile.current;
    const impactContext = currentProfile?.departmentId ? { departmentId: currentProfile.departmentId, departmentName: currentProfile.department || "Sin departamento", deviceClass } : { deviceClass };
    void recordCarbonUsage(user.uid, profile, transferredBytes, resources.length + (navigation ? 1 : 0), impactContext).then((id) => { impactSessionId.current = id; window.sessionStorage.setItem(sessionKey, "recorded"); }).catch(() => window.sessionStorage.removeItem(sessionKey));
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", changeVisibility); window.removeEventListener("pagehide", updateSession); window.removeEventListener("pointerdown", countInteraction); window.removeEventListener("keydown", countInteraction); updateSession(); };
  }, [profile, user.uid]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setGlobalSearchOpen(true); }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  useEffect(() => {
    if (!isSection(window.history.state?.sigesSection)) window.history.replaceState({ ...window.history.state, sigesSection: section }, "", window.location.href);
    const handlePopState = (event: PopStateEvent) => {
      const next = event.state?.sigesSection;
      if (isSection(next)) { setSection(next); setMobileOpen(false); setQueryText(""); return; }
      window.history.pushState({ ...window.history.state, sigesSection: "overview" }, "", window.location.href);
      setSection("overview"); setMobileOpen(false); setQueryText("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const todayReservations = useMemo(() => reservations.filter((reservation) => reservation.date === dateToday() && reservation.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time)), [reservations]);
  const catalog = useMemo(() => resolveProducts(productOverrides), [productOverrides]);
  const categoryLabels = useMemo(() => resolveProductCategoryLabels(productCategorySettings), [productCategorySettings]);
  const pendingInvitations = useMemo(() => {
    const registeredEmails = new Set(employees.map((employee) => employee.email.trim().toLowerCase()));
    return invitations.filter((invitation) => invitation.status === "pending" && !registeredEmails.has(invitation.email.trim().toLowerCase()));
  }, [employees, invitations]);
  const administrativePendingItems = useMemo<AdministrativePendingItem[]>(() => {
    const activeEmployees = employees.filter((employee) => employee.status === "active");
    const profileEmployeeIds = new Set(hrProfiles.map((item) => item.employeeId));
    const missingAccessData = employees.filter((employee) => !employee.displayName?.trim() || !employee.email?.trim() || !(employee as Partial<UserProfile>).role || !(employee as Partial<UserProfile>).status).length + invitations.filter((invitation) => !invitation.email?.trim() || !invitation.displayName?.trim() || !invitation.role).length;
    const withoutHrProfile = activeEmployees.filter((employee) => !profileEmployeeIds.has(employee.id)).length;
    const incompleteHrProfiles = hrProfiles.filter((item) => !item.employeeCode || !item.departmentId || !item.positionId || !item.scheduleId).length;
    const withoutContract = activeEmployees.filter((employee) => !employmentContracts.some((contract) => contract.employeeId === employee.id && ["draft", "active", "expiring"].includes(contract.status))).length;
    const missingCodes = customers.filter((item) => !item.code).length + reservations.filter((item) => !item.code).length + payments.filter((item) => !item.code).length + tasks.filter((item) => !item.code).length + incidents.filter((item) => !item.code).length + expenses.filter((item) => !item.code).length;
    const unassignedReservations = reservations.filter((item) => item.status !== "cancelled" && !item.assignedToId).length;
    const unassignedWork = tasks.filter((item) => !["completed", "cancelled"].includes(item.status) && !item.assignedToId).length + incidents.filter((item) => !["resolved", "closed"].includes(item.status) && !item.assignedToId).length;
    const pendingDocuments = hrDocuments.filter((item) => item.status === "pending" || item.status === "expired").length;
    const pendingLeaves = leaveRequests.filter((item) => item.status === "pending").length;
    return ([
      { id: "access", title: "Datos de acceso", detail: "Nombres, correos, roles o estados por completar.", count: missingAccessData, section: "employees", icon: UserCog },
      { id: "files", title: "Expedientes por crear", detail: "Personal activo sin expediente de Recursos Humanos.", count: withoutHrProfile, section: "hr", icon: UsersRound },
      { id: "organization", title: "Datos laborales", detail: "Código EMP, departamento, puesto u horario pendientes.", count: incompleteHrProfiles, section: "hr", icon: ClipboardList },
      { id: "contracts", title: "Contratos pendientes", detail: "Personal activo sin un contrato registrado o vigente.", count: withoutContract, section: "hr", icon: FileDown },
      { id: "codes", title: "Códigos por asignar", detail: "Registros anteriores sin código secuencial de identificación.", count: missingCodes, section: "history", icon: History },
      { id: "assignments", title: "Asignaciones operativas", detail: "Reservas, tareas o incidencias sin responsable.", count: unassignedReservations + unassignedWork, section: "operations", icon: CalendarDays },
      { id: "documents", title: "Documentos por revisar", detail: "Documentos RR. HH. pendientes o vencidos.", count: pendingDocuments, section: "hr", icon: ShieldAlert },
      { id: "leaves", title: "Ausencias por resolver", detail: "Solicitudes que esperan revisión administrativa.", count: pendingLeaves, section: "hr", icon: Bell },
    ] as AdministrativePendingItem[]).filter((item) => item.count > 0);
  }, [employees, invitations, hrProfiles, employmentContracts, customers, reservations, payments, tasks, incidents, expenses, hrDocuments, leaveRequests]);
  const prioritizedReminders = useMemo(() => {
    const priority = { urgent: 0, important: 1, info: 2 } as const;
    return reminders.filter((reminder) => reminder.active).sort((left, right) => {
      const byPriority = priority[left.priority] - priority[right.priority];
      if (byPriority) return byPriority;
      const leftDate = left.createdAt && typeof left.createdAt === "object" && "toDate" in left.createdAt ? (left.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
      const rightDate = right.createdAt && typeof right.createdAt === "object" && "toDate" in right.createdAt ? (right.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
      return rightDate - leftDate;
    });
  }, [reminders]);
  const paidToday = useMemo(() => totalsByCurrency(payments.filter((payment) => payment.paidAt === dateToday() && payment.status === "paid")), [payments]);
  const paymentBreakdown = useMemo(() => {
    const values = ["card", "cash", "transfer", "other"].map((method) => {
      const confirmed = payments.filter((payment) => payment.method === method && payment.status === "paid");
      return { method, count: confirmed.length, total: totalsByCurrency(confirmed) };
    });
    const maximum = Math.max(1, ...values.map((item) => item.count));
    return values.map((item) => ({ ...item, percent: Math.round((item.count / maximum) * 100) }));
  }, [payments]);
  const ownCarbonUsage = useMemo(() => carbonUsage.filter((entry) => entry.userId === user.uid).reduce((summary, entry) => ({ grams: summary.grams + Number(entry.estimatedGramsCO2e || 0), bytes: summary.bytes + Number(entry.transferredBytes || 0), sessions: summary.sessions + 1 }), { grams: 0, bytes: 0, sessions: 0 }), [carbonUsage, user.uid]);
  const unreadMailCount = useMemo(() => internalMessages.filter((message) => message.senderId !== user.uid && message.status === "sent" && !(message.readByIds || []).includes(user.uid)).length, [internalMessages, user.uid]);
  const filtered = <T extends object>(rows: T[]): T[] => !queryText
    ? rows
    : rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(queryText.toLowerCase())));
  const orderedCustomers = useMemo(() => [...filtered(customers)].sort((left, right) => {
    const byFirst = customerSort.startsWith("first");
    const leftValue = byFirst ? left.firstName || left.fullName || "" : left.lastName || left.fullName || "";
    const rightValue = byFirst ? right.firstName || right.fullName || "" : right.lastName || right.fullName || "";
    const result = leftValue.localeCompare(rightValue, "es", { sensitivity: "base" });
    return customerSort.endsWith("asc") ? result : -result;
  }), [customers, queryText, customerSort]);
  const visibleHistory = useMemo<ActivityLog[]>(() => {
    if (activityLogs.length) return activityLogs;
    const registrations: ActivityLog[] = [
      ...customers.map((customer) => ({ id: `customer-${customer.id}`, action: "created" as const, entity: "customer" as const, entityId: customer.id, summary: `Registró cliente ${customerDisplayName(customer)}`, actorId: customer.createdBy, actorName: customer.createdByName || "Empleado", actorEmail: customer.createdByEmail || "", occurredAt: customer.createdAt })),
      ...reservations.map((reservation) => ({ id: `reservation-${reservation.id}`, action: "created" as const, entity: "reservation" as const, entityId: reservation.id, summary: `Registró reserva ${operationCode("RES", reservation)}`, actorId: reservation.createdBy, actorName: reservation.createdByName || "Empleado", actorEmail: reservation.createdByEmail || "", occurredAt: reservation.createdAt })),
      ...payments.map((payment) => ({ id: `payment-${payment.id}`, action: "created" as const, entity: "payment" as const, entityId: payment.id, summary: `Registró pago ${operationCode("PAG", payment)}`, actorId: payment.createdBy, actorName: payment.createdByName || "Empleado", actorEmail: payment.createdByEmail || "", occurredAt: payment.createdAt })),
      ...expenses.map((expense) => ({ id: `expense-${expense.id}`, action: "created" as const, entity: "expense" as const, entityId: expense.id, summary: `Registró gasto ${expense.code || "GAS"}`, actorId: expense.createdBy, actorName: expense.createdByName || "Empleado", actorEmail: expense.createdByEmail || "", occurredAt: expense.createdAt })),
    ];
    return sortRecordsNewest(registrations, activity => activity.occurredAt);
  }, [activityLogs, customers, reservations, payments, expenses]);
  const filteredHistory = useMemo(() => historyFilter === "all" ? visibleHistory : visibleHistory.filter((activity) => activity.entity === historyFilter), [historyFilter, visibleHistory]);
  const linkedActivityRecord = (activity: ActivityLog) => activity.entity === "customer" ? customers.find((customer) => customer.id === activity.entityId) : activity.entity === "reservation" ? reservations.find((reservation) => reservation.id === activity.entityId) : activity.entity === "payment" ? payments.find((payment) => payment.id === activity.entityId) : activity.entity === "expense" ? expenses.find((expense) => expense.id === activity.entityId) : activity.entity === "product" ? catalog.find((product) => product.id === activity.entityId) : activity.entity === "reminder" ? reminders.find((reminder) => reminder.id === activity.entityId) : null;
  const dependencyText = (summary: { reservations: number; payments: number; tasks: number; incidents: number }) => [[summary.reservations, "reservas"], [summary.payments, "pagos"], [summary.tasks, "tareas"], [summary.incidents, "incidencias"]].filter(([count]) => Number(count) > 0).map(([count, label]) => `${count} ${label}`).join(", ");
  const handleDelete = async (type: "customers" | "reservations" | "payments" | "employee", id: string) => { try { const summary = type === "employee" ? null : await getRecordDependencySummary(type, id); const related = summary ? dependencyText(summary) : ""; const prompt = related ? `Esta acción eliminará el registro y también ${related} vinculados. Esta acción no se puede deshacer. ¿Deseas continuar?` : "Esta acción no se puede deshacer. ¿Deseas continuar?"; if (!window.confirm(prompt)) return; if (type === "employee") await deleteEmployeeProfile(id, user.uid); else await removeRecord(type, id, user.uid); toast.success(related ? `Registro y dependencias eliminados: ${related}.` : "Registro eliminado."); } catch { toast.error("No se pudo eliminar el registro o sus dependencias."); } };
  const toggleSelection = (id: string, setSelected: React.Dispatch<React.SetStateAction<string[]>>) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAllSelection = (ids: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => setSelected((current) => ids.length && ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  const deleteSelectedRecords = async (name: "customers" | "payments", ids: string[], onDone: () => void) => { if (!ids.length) return; try { const summaries = await Promise.all(ids.map((id) => getRecordDependencySummary(name, id))); const related = dependencyText(summaries.reduce((total, item) => ({ reservations: total.reservations + item.reservations, payments: total.payments + item.payments, tasks: total.tasks + item.tasks, incidents: total.incidents + item.incidents }), { reservations: 0, payments: 0, tasks: 0, incidents: 0 })); const prompt = related ? `¿Eliminar ${ids.length} registros y también ${related} vinculados? Esta acción no se puede deshacer.` : `¿Eliminar ${ids.length} registro${ids.length === 1 ? "" : "s"} seleccionado${ids.length === 1 ? "" : "s"}? Esta acción no se puede deshacer.`; if (!window.confirm(prompt)) return; await bulkRemoveRecords(name, ids, user.uid); onDone(); toast.success(related ? `Registros y dependencias eliminados: ${related}.` : "Registros eliminados y anotados en Historial."); } catch { toast.error("No se pudieron eliminar todos los registros y sus dependencias."); } };
  const updateSelectedCustomers = async () => { const notes = window.prompt("Escribe las notas que se aplicarán a los clientes seleccionados."); if (notes === null || !selectedCustomerIds.length) return; try { await bulkUpdateRecords("customers", selectedCustomerIds, { notes: notes.trim() }, user.uid); setSelectedCustomerIds([]); toast.success("Notas actualizadas en los clientes seleccionados."); } catch { toast.error("No se pudieron actualizar los clientes seleccionados."); } };
  const updateSelectedPayments = async (status: PaymentStatus) => { if (!selectedPaymentIds.length) return; const editableIds = selectedPaymentIds.filter((id) => payments.find((payment) => payment.id === id)?.status !== "paid"); if (!editableIds.length) { toast.error("Los pagos confirmados requieren una solicitud de ajuste individual."); return; } try { await Promise.all(editableIds.map(async (id) => { const payment = payments.find((item) => item.id === id); if (!payment) return; const reservation = payment.reservationId ? reservations.find((item) => item.id === payment.reservationId) : undefined; const nextPayments = payments.map((item) => item.id === id ? { ...item, status } : item); const account = reservation ? receivableAccounts([reservation], nextPayments)[0] : undefined; await updateRecord("payments", id, { status, settlementStatus: account?.status || "pending" }, user.uid); if (reservation) await updateRecord("reservations", reservation.id, { paymentStatus: account?.status || "pending" }, user.uid); })); setSelectedPaymentIds([]); if (editableIds.length < selectedPaymentIds.length) toast.message("Solo se actualizaron pagos no confirmados; los pagos confirmados requieren solicitud de ajuste."); else toast.success("Estados y liquidaciones actualizados en los pagos seleccionados."); } catch { toast.error("No se pudieron actualizar los pagos seleccionados y sus liquidaciones."); } };
  const updateSelectedEmployees = async (status: UserProfile["status"]) => { const ids = selectedEmployeeIds.filter((id) => id !== user.uid && employees.find((employee) => employee.id === id)?.role !== "it"); if (!ids.length) { toast.error("Selecciona perfiles no técnicos distintos a tu propia cuenta."); return; } try { await bulkUpdateEmployees(ids, { status }, user.uid); setSelectedEmployeeIds([]); toast.success("Configuración actualizada para el Personal seleccionado."); } catch { toast.error("No se pudo actualizar todo el Personal seleccionado."); } };
  const deleteSelectedEmployees = async () => { const ids = selectedEmployeeIds.filter((id) => id !== user.uid && employees.find((employee) => employee.id === id)?.role !== "it"); if (!ids.length || !window.confirm(`¿Eliminar ${ids.length} perfil${ids.length === 1 ? "" : "es"} de Personal? Esta acción no se puede deshacer.`)) return; try { await bulkDeleteEmployeeProfiles(ids, user.uid); setSelectedEmployeeIds([]); toast.success("Perfiles eliminados y anotados en Historial."); } catch { toast.error("No se pudieron eliminar todos los perfiles seleccionados."); } };
  const openDetail = (typeOrEyebrow: RecordType | string, eyebrowOrTitle: string, titleOrData: string | object, dataOrRelated?: object | null, relatedMaybe?: object | null) => {
    const hasExplicitType = ["customer", "reservation", "payment", "product", "expense", "employee", "reminder"].includes(typeOrEyebrow);
    const type = (hasExplicitType ? typeOrEyebrow : typeOrEyebrow.includes("pago") ? "payment" : typeOrEyebrow.includes("reserva") ? "reservation" : "customer") as RecordType;
    const eyebrow = hasExplicitType ? eyebrowOrTitle : typeOrEyebrow;
    const title = (hasExplicitType ? titleOrData : eyebrowOrTitle) as string;
    const data = (hasExplicitType ? dataOrRelated : titleOrData) as object;
    const related = hasExplicitType ? relatedMaybe : dataOrRelated;
    setModal({ type, detail: { eyebrow, title, data: data as Record<string, unknown>, related: related ? related as Record<string, unknown> : null } });
  };
  const toggleBulkMode = (target: Section) => {
    const next = bulkEditSection === target ? null : target;
    setBulkEditSection(next);
    if (!next) { setSelectedCustomerIds([]); setSelectedPaymentIds([]); setSelectedEmployeeIds([]); }
    else toast.message(`Modo “Editar varios” activado en ${target === "customers" ? "Clientes" : target === "payments" ? "Pagos" : "Personal"}. Marca las casillas para aplicar una acción.`);
  };
  const navigate = (next: Section) => { impactPageViews.current += 1; impactInteractions.current += 1; if (next !== section) window.history.pushState({ ...window.history.state, sigesSection: next }, "", window.location.href); setSection(next); setBulkEditSection(null); setSelectedCustomerIds([]); setSelectedPaymentIds([]); setSelectedEmployeeIds([]); setMobileOpen(false); setQueryText(""); };
  const openSearchResult = (destination: GlobalSearchDestination, resultId?: string) => {
    navigate(destination as Section);
    if (!resultId) return;
    const separator = resultId.indexOf("-");
    const kind = separator > 0 ? resultId.slice(0, separator) : resultId;
    const id = separator > 0 ? resultId.slice(separator + 1) : "";
    if (kind === "customer") { const record = customers.find((item) => item.id === id); if (record) openDetail("customer", "Ficha de cliente", customerDisplayName(record), record); }
    else if (kind === "reservation") { const record = reservations.find((item) => item.id === id); if (record) openDetail("reservation", "Detalle de reserva", operationCode("RES", record), record, customers.find((item) => item.id === record.customerId)); }
    else if (kind === "payment") { const record = payments.find((item) => item.id === id); if (record) openDetail("payment", "Detalle de pago", operationCode("PAG", record), record, record.reservationId ? reservations.find((item) => item.id === record.reservationId) : customers.find((item) => item.id === record.customerId)); }
    else if (kind === "employee") { const record = employees.find((item) => item.id === id); if (record) openDetail("employee", "Perfil de personal", record.displayName, record); }
  };
  const toggleSidebar = () => setSidebarCollapsed((collapsed) => {
    const next = !collapsed;
    localStorage.setItem("heliot-sidebar-collapsed", String(next));
    return next;
  });
  const closeModal = () => { setModal(null); setRelatedPanel(null); setWorkflowCustomer(null); setWorkflowReservation(null); setWorkflowProduct(null); };
  const newLabel = section === "customers" ? "Nuevo cliente" : section === "reservations" ? "Nueva reserva" : section === "payments" ? "Registrar pago" : section === "employees" ? "Invitar personal" : "Nueva reserva";
  const opening = () => { setRelatedPanel(null); setWorkflowCustomer(null); setWorkflowReservation(null); setWorkflowProduct(null); setModal({ type: section === "customers" ? "customer" : section === "payments" ? "payment" : section === "employees" ? "employee" : "reservation" }); };
  const registerNextPayment = (reservation: Reservation) => { setWorkflowReservation(reservation); setWorkflowCustomer(customers.find((customer) => customer.id === reservation.customerId) || null); setWorkflowProduct(catalog.find((product) => product.id === reservation.productId) || null); setRelatedPanel(null); setModal({ type: "payment" }); };

  const modalBody = modal && (modal.detail ? <DetailViewer {...modal.detail} /> : modal.type === "customer" ? <CustomerForm initial={modal.data as Customer | undefined} userId={user.uid} onDone={closeModal} /> : modal.type === "reservation" ? <ReservationForm initial={modal.data as Reservation | undefined} customers={customers} products={catalog} userId={user.uid} linkedCustomer={workflowCustomer} onOpenCustomerPanel={() => setRelatedPanel("customer")} onSelectProduct={(product) => { setWorkflowProduct(product); setRelatedPanel("product"); }} onDone={closeModal} /> : modal.type === "payment" ? <PaymentForm initial={modal.data as Payment | undefined} customers={customers} reservations={reservations} payments={payments} products={catalog} userId={user.uid} linkedCustomer={workflowCustomer} linkedReservation={workflowReservation} onOpenCustomerPanel={() => setRelatedPanel("customer")} onOpenReservationPanel={(customer) => { setWorkflowCustomer(customer); setRelatedPanel("reservation"); }} onSelectProduct={(product) => { setWorkflowProduct(product); setRelatedPanel("product"); }} onDone={closeModal} /> : modal.type === "product" ? <ProductForm initial={modal.data as Product | undefined} userId={user.uid} categoryLabels={categoryLabels} onDone={closeModal} /> : modal.type === "reminder" ? <GeneralReminderForm initial={modal.data as GeneralReminder | undefined} userId={user.uid} onDone={closeModal} /> : <EmployeeForm initial={modal.data as UserProfile | undefined} adminId={user.uid} canManageIT={isIT} onDone={closeModal} />);
  const relatedBody = relatedPanel === "customer" ? <CustomerForm userId={user.uid} onDone={() => setRelatedPanel(null)} onCreated={(customer) => { setWorkflowCustomer(customer); setWorkflowReservation(null); setRelatedPanel(null); }} /> : relatedPanel === "reservation" && workflowCustomer ? <ReservationForm customers={customers} products={catalog} userId={user.uid} linkedCustomer={workflowCustomer} onSelectProduct={(product) => { setWorkflowProduct(product); setRelatedPanel("product"); }} onDone={() => setRelatedPanel(null)} onCreated={(reservation) => { setWorkflowReservation(reservation); setRelatedPanel(null); }} /> : relatedPanel === "product" && workflowProduct ? <ProductInfoPanel product={workflowProduct} /> : null;
  const relatedTitle = relatedPanel === "customer" ? "Registrar cliente" : relatedPanel === "reservation" ? "Registrar reserva" : "Detalle del paquete";
  const modalTitle = modal?.detail?.title || (modal?.type === "customer" ? `${modal.data ? "Editar" : "Nuevo"} cliente` : modal?.type === "reservation" ? `${modal.data ? "Editar" : "Nueva"} reserva` : modal?.type === "payment" ? (modal.data && (modal.data as Payment).status === "paid" ? "Solicitar ajuste de pago" : `${modal.data ? "Editar" : "Registrar"} pago`) : modal?.type === "product" ? `${modal.data ? "Editar" : "Nuevo"} paquete` : modal?.type === "reminder" ? "Notificaciones" : modal?.data ? "Configurar personal" : "Invitar personal");
  const pendingPanel = <section><PageTitle eyebrow="Administración / IT" title="Pendientes de configuración" /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Consulta la información que falta completar y entra directamente al módulo responsable para resolverla. Este panel no está disponible para Personal.</p><AdministrativePendingPanel items={administrativePendingItems} onNavigate={navigate} /></section>;

  const profilePanel = section === "calendar" ? <OperationalCalendar reservations={reservations} onOpenReservation={(reservation) => setModal({ type: "reservation", data: reservation })} /> : section === "pending" && isAdmin ? pendingPanel : <section className="max-w-2xl">
    <PageTitle eyebrow="Cuenta personal" title="Mi perfil" />
    <div className="panel-card mt-8 overflow-hidden">
      <div className="border-b bg-[#0F8F73]/5 px-6 py-5"><p className="text-sm font-bold">Tu identidad de acceso</p><p className="mt-1 text-sm text-muted-foreground">El correo y el rol los controla la administración.</p></div>
      <form className="form-stack p-6" onSubmit={async (event) => {
        event.preventDefault();
        const displayName = String(new FormData(event.currentTarget).get("displayName")).trim();
        try {
          await updateOwnProfile(user.uid, displayName);
          await updateAuthProfile(user, { displayName });
          toast.success("Tu nombre fue actualizado.");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo actualizar tu perfil.");
        }
      }}>
        <label>Nombre visible<input className="field" name="displayName" defaultValue={profile.displayName} required /></label>
        <label>Correo<input className="field bg-muted" disabled value={profile.email} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label>Rol<div className="field flex items-center"><StatusPill status={profile.role} /></div></label><label>Estado<div className="field flex items-center"><StatusPill status={profile.status} /></div></label></div>
        <button className="primary-button w-fit">Guardar nombre<ChevronRight size={16} /></button>
      </form>
      <form className="border-t p-6" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const currentPassword = String(form.get("currentPassword"));
        const newPassword = String(form.get("password"));
        try {
          if (!user.email) throw new Error("No fue posible identificar el correo de tu cuenta.");
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
          await updatePassword(user, newPassword);
          event.currentTarget.reset();
          toast.success("Contraseña actualizada.");
        } catch (error) {
          const code = (error as { code?: string })?.code;
          toast.error(code === "auth/invalid-credential" ? "La contraseña actual no es correcta." : "No se pudo actualizar la contraseña. Inténtalo nuevamente.");
        }
      }}>
        <p className="font-bold">Cambiar contraseña</p><p className="mt-1 text-sm text-muted-foreground">Confirma tu contraseña actual y escribe una nueva de al menos seis caracteres.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><input className="field" required type="password" name="currentPassword" placeholder="Contraseña actual" autoComplete="current-password" /><input className="field" required minLength={6} type="password" name="password" placeholder="Nueva contraseña" autoComplete="new-password" /></div>
        <button className="secondary-button mt-3">Actualizar contraseña</button>
      </form>
      <div className="border-t bg-[#0F8F73]/5 px-6 py-5"><p className="font-bold">¿No recuerdas tu contraseña actual?</p><p className="mt-1 text-sm text-muted-foreground">Envía un enlace seguro al correo de esta cuenta para restablecerla.</p><button type="button" className="secondary-button mt-3" onClick={async () => { try { if (!user.email) throw new Error("No hay un correo asociado a esta cuenta."); await sendPasswordResetEmail(auth, user.email); toast.success("Enviamos un enlace de recuperación a tu correo."); } catch { toast.error("No se pudo enviar el enlace. Inténtalo desde la pantalla de acceso."); } }}>Enviar enlace por correo</button></div>
      <div className="border-t bg-[#38D98B]/5 px-6 py-5"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">Mi huella digital estimada</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{ownCarbonUsage.sessions ? `${carbonLabel(ownCarbonUsage.grams)} estimados a partir de ${dataLabel(ownCarbonUsage.bytes)} transferidos en ${ownCarbonUsage.sessions} sesión${ownCarbonUsage.sessions === 1 ? "" : "es"}.` : "La primera sesión con transferencia registrada mostrará aquí una estimación informativa."}</p></div><Leaf className="shrink-0 text-[#0F8F73]" size={21} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Es una estimación de uso digital, no una medición física ni una huella corporativa certificada.</p></div>
    </div>
  </section>;

  const visibleCustomerIds = orderedCustomers.map((customer) => customer.id);
  const filteredReservations = filtered(reservations).filter((reservation) => reservationStatusFilter === "all" || reservation.status === reservationStatusFilter);
  const visiblePayments = filtered(payments).filter((payment) => paymentStatusFilter === "all" || payment.status === paymentStatusFilter);
  const accounts = useMemo(() => receivableAccounts(reservations, payments), [reservations, payments]);
  const selectableEmployeeIds = employees.filter((employee) => employee.id !== user.uid && isIT && employee.role !== "it").map((employee) => employee.id);
  const overview = <OverviewDashboard
    userName={profile.displayName}
    isAdmin={isAdmin}
    customers={customers}
    reservations={reservations}
    payments={payments}
    expenses={expenses}
    tasks={tasks}
    incidents={incidents}
    employees={employees}
    reminders={reminders}
    onNavigate={(target) => navigate(target)}
    onNewReservation={opening}
  />;

  const customersPanel = <><PageTitle eyebrow="Directorio operativo" title="Clientes" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Nuevo cliente</button>} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar por código, nombres, apellidos, correo o teléfono…" /><select aria-label="Ordenar clientes" className="ml-auto rounded-lg border bg-card px-2 py-1.5 text-xs font-bold" value={customerSort} onChange={(event) => setCustomerSort(event.target.value as typeof customerSort)}><option value="last-asc">Apellidos A–Z</option><option value="last-desc">Apellidos Z–A</option><option value="first-asc">Nombres A–Z</option><option value="first-desc">Nombres Z–A</option></select></div><BulkActionBar count={selectedCustomerIds.length} label="cliente" onClear={() => setSelectedCustomerIds([])}><button className="secondary-button" onClick={updateSelectedCustomers}>Editar notas</button>{isAdmin && <button className="secondary-button text-destructive" onClick={() => void deleteSelectedRecords("customers", selectedCustomerIds, () => setSelectedCustomerIds([]))}><Trash2 size={16} />Eliminar</button>}</BulkActionBar>{orderedCustomers.length ? <div className="table-wrap"><table><thead><tr><th className="w-10"><input aria-label="Seleccionar todos los clientes visibles" type="checkbox" checked={visibleCustomerIds.length > 0 && visibleCustomerIds.every((id) => selectedCustomerIds.includes(id))} onChange={() => toggleAllSelection(visibleCustomerIds, setSelectedCustomerIds)} /></th><th>Código</th><th>Nombres</th><th>Apellidos</th><th>Contacto</th><th>Registro</th><th>Notas</th><th aria-label="Acciones" /></tr></thead><tbody>{orderedCustomers.map((customer) => <tr className="cursor-pointer" onClick={() => openDetail("Ficha de cliente", customerDisplayName(customer), customer)} key={customer.id}><td onClick={(event) => event.stopPropagation()}><input aria-label={`Seleccionar ${customerDisplayName(customer)}`} type="checkbox" checked={selectedCustomerIds.includes(customer.id)} onChange={() => toggleSelection(customer.id, setSelectedCustomerIds)} /></td><td><span className="time-code font-bold">{customerCode(customer)}</span></td><td><p className="font-bold">{customer.firstName || customer.fullName?.split(" ")[0] || "—"}</p></td><td><p className="font-bold">{customer.lastName || customer.fullName?.split(" ").slice(1).join(" ") || "—"}</p></td><td><p>{customer.email || "Sin correo"}</p><span>{customer.phone || "Sin teléfono"}</span></td><td><p className="font-semibold">{customer.createdByName || "Sin dato"}</p><span>{readableTimestamp(customer.createdAt)}</span></td><td className="max-w-52 truncate">{customer.notes || "—"}</td><td><RecordActions onView={() => openDetail("Ficha de cliente", customerDisplayName(customer), customer)} onEdit={() => setModal({ type: "customer", data: customer })} onDelete={isAdmin ? () => handleDelete("customers", customer.id) : undefined} /></td></tr>)}</tbody></table></div> : <Empty title="Aún no hay clientes" detail="Añade el primer cliente para empezar a crear reservas y registrar pagos." />}</section></>;

  const reservationsPanel = <><PageTitle eyebrow="Agenda de servicio" title="Reservas" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Nueva reserva</button>} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar código, cliente, servicio o estado…" /><select aria-label="Filtrar reservas por estado" className="ml-auto rounded-lg border bg-card px-2 py-1.5 text-xs font-bold" value={reservationStatusFilter} onChange={(event) => setReservationStatusFilter(event.target.value as typeof reservationStatusFilter)}><option value="all">Todos los estados</option><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></div>{filteredReservations.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Fecha y hora</th><th>Cliente</th><th>Servicio</th><th>Estado</th><th>Registro</th><th aria-label="Acciones" /></tr></thead><tbody>{filteredReservations.map((reservation) => <tr className="cursor-pointer" onClick={() => openDetail("Detalle de reserva", operationCode("RES", reservation), reservation, customers.find((customer) => customer.id === reservation.customerId))} key={reservation.id}><td><span className="time-code font-bold">{operationCode("RES", reservation)}</span></td><td><span className="time-code">{reservation.time}</span><p className="mt-1 text-xs text-muted-foreground">{readableDate(reservation.date)}</p></td><td className="font-bold">{reservation.customerName}</td><td><p>{reservation.service}</p><span>{reservation.durationMinutes} min</span></td><td><StatusPill status={reservation.status} /></td><td><p className="font-semibold">{reservation.createdByName || "Sin dato"}</p><span>{readableTimestamp(reservation.createdAt)}</span></td><td><RecordActions onView={() => openDetail("Detalle de reserva", operationCode("RES", reservation), reservation, customers.find((customer) => customer.id === reservation.customerId))} onEdit={() => setModal({ type: "reservation", data: reservation })} onDelete={isAdmin ? () => handleDelete("reservations", reservation.id) : undefined} /></td></tr>)}</tbody></table></div> : <Empty title="No hay reservas para este filtro" detail="Cambia el estado seleccionado o crea una reserva vinculada a un cliente." />}</section></>;

  const paymentsPanel = <><PageTitle eyebrow="Libro de cobros" title="Pagos" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Registrar pago</button>} /><AccountsReceivablePanel accounts={accounts} onRegisterPayment={registerNextPayment} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar código, cliente, importe o método…" /><select aria-label="Filtrar pagos por estado" className="ml-auto rounded-lg border bg-card px-2 py-1.5 text-xs font-bold" value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value as typeof paymentStatusFilter)}><option value="all">Todos los estados</option><option value="paid">Pagado</option><option value="pending">Pendiente</option><option value="refunded">Reintegrado</option></select></div><BulkActionBar count={selectedPaymentIds.length} label="pago" onClear={() => setSelectedPaymentIds([])}><button className="secondary-button" onClick={() => void updateSelectedPayments("paid")}>Marcar pagados</button><button className="secondary-button" onClick={() => void updateSelectedPayments("pending")}>Marcar pendientes</button>{isAdmin && <button className="secondary-button text-destructive" onClick={() => void deleteSelectedRecords("payments", selectedPaymentIds, () => setSelectedPaymentIds([]))}><Trash2 size={16} />Eliminar</button>}</BulkActionBar>{visiblePayments.length ? <div className="table-wrap"><table><thead><tr><th className="w-10"><input aria-label="Seleccionar todos los pagos visibles" type="checkbox" checked={visiblePayments.length > 0 && visiblePayments.every((payment) => selectedPaymentIds.includes(payment.id))} onChange={() => toggleAllSelection(visiblePayments.map((payment) => payment.id), setSelectedPaymentIds)} /></th><th>Código</th><th>Fecha</th><th>Cliente</th><th>Importe</th><th>Tipo</th><th>Estado</th><th>Registro</th><th aria-label="Acciones" /></tr></thead><tbody>{visiblePayments.map((payment) => { const reservation = payment.reservationId ? reservations.find((item) => item.id === payment.reservationId) : undefined; return <tr className="cursor-pointer" onClick={() => openDetail("Detalle de pago", operationCode("PAG", payment), payment, reservation || customers.find((customer) => customer.id === payment.customerId))} key={payment.id}><td onClick={(event) => event.stopPropagation()}><input aria-label={`Seleccionar ${operationCode("PAG", payment)}`} type="checkbox" checked={selectedPaymentIds.includes(payment.id)} onChange={() => toggleSelection(payment.id, setSelectedPaymentIds)} /></td><td><span className="time-code font-bold">{operationCode("PAG", payment)}</span></td><td>{readableDate(payment.paidAt)}</td><td className="font-bold">{payment.customerName}</td><td className="metric-number font-semibold">{currency(payment.amount, payment.currency)}</td><td><p>{payment.kind === "deposit" ? "Anticipo" : payment.kind === "partial" ? "Parcial" : payment.kind === "balance" ? "Saldo" : "Completo"}</p><span>{payment.method === "card" ? "Tarjeta" : payment.method === "cash" ? "Efectivo" : payment.method === "transfer" ? "Transferencia" : "Otro"}</span></td><td><StatusPill status={payment.status} /></td><td><p className="font-semibold">{payment.createdByName || "Sin dato"}</p><span>{readableTimestamp(payment.createdAt)}</span></td><td><RecordActions onView={() => openDetail("Detalle de pago", operationCode("PAG", payment), payment, reservation || customers.find((customer) => customer.id === payment.customerId))} onInvoice={() => downloadPaymentInvoice(payment, reservation, payments)} onEdit={() => setModal({ type: "payment", data: payment })} onDelete={isAdmin ? () => handleDelete("payments", payment.id) : undefined} /></td></tr>; })}</tbody></table></div> : <Empty title="No hay pagos para este filtro" detail="Cambia el estado seleccionado o registra un cobro." />}</section></>;

  const employeesPanel = <><PageTitle eyebrow={isIT ? "Gestión de identidades" : "Datos operativos del equipo"} title="Personal" actions={isIT ? <button className="primary-button" onClick={opening}><Plus size={17} />Invitar personal</button> : undefined} /><div className="mt-4 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Jerarquía aplicada:</strong> el Departamento de IT gestiona perfiles de Administración y Personal, sin editar otros perfiles técnicos. Administración puede consultar el directorio y editar únicamente datos operativos del Personal; no cambia roles, estados ni accesos.</div><section className="panel-card mt-5 overflow-hidden">{isIT && <BulkActionBar count={selectedEmployeeIds.length} label="perfil" onClear={() => setSelectedEmployeeIds([])}><button className="secondary-button" onClick={() => void updateSelectedEmployees("active")}>Activar</button><button className="secondary-button" onClick={() => void updateSelectedEmployees("suspended")}>Suspender</button><button className="secondary-button text-destructive" onClick={() => void deleteSelectedEmployees()}><Trash2 size={16} />Eliminar</button></BulkActionBar>}{employees.length || pendingInvitations.length ? <div className="table-wrap"><table><thead><tr><th className="w-10">{isIT && <input aria-label="Seleccionar todos los perfiles de Personal gestionables" type="checkbox" checked={selectableEmployeeIds.length > 0 && selectableEmployeeIds.every((id) => selectedEmployeeIds.includes(id))} onChange={() => toggleAllSelection(selectableEmployeeIds, setSelectedEmployeeIds)} />}</th><th>Personal</th><th>Rol</th><th>Estado</th><th>Incorporación</th><th aria-label="Acciones" /></tr></thead><tbody>{employees.map((employee) => { const editable = employee.id !== user.uid && (isIT ? employee.role !== "it" : employee.role === "personal"); return <tr className={editable ? "cursor-pointer" : ""} onClick={() => editable && setModal({ type: "employee", data: employee })} key={employee.id}><td onClick={(event) => event.stopPropagation()}>{isIT && editable ? <input aria-label={`Seleccionar ${employee.displayName}`} type="checkbox" checked={selectedEmployeeIds.includes(employee.id)} onChange={() => toggleSelection(employee.id, setSelectedEmployeeIds)} /> : <span className="text-xs text-muted-foreground">—</span>}</td><td><p className="font-bold">{employee.displayName}</p><span>{employee.email}</span></td><td><StatusPill status={employee.role} /></td><td><StatusPill status={employee.status} /></td><td><span>{readableTimestamp(employee.createdAt)}</span></td><td>{employee.id === user.uid ? <span className="text-xs text-muted-foreground">Tu cuenta</span> : editable ? <RecordActions onPasswordReset={isIT ? async () => { try { await sendPasswordResetEmail(auth, employee.email); toast.success(`Enlace de recuperación enviado a ${employee.email}.`); } catch { toast.error("No se pudo enviar el enlace de recuperación."); } } : undefined} onEdit={() => setModal({ type: "employee", data: employee })} onDelete={isIT ? () => handleDelete("employee", employee.id) : () => undefined} /> : <span className="text-xs text-muted-foreground">Perfil protegido</span>}</td></tr>; })}{pendingInvitations.map((invitation) => <tr className="bg-[#FFC72C]/5" key={`invitation-${invitation.id}`}><td><span className="text-xs text-muted-foreground">—</span></td><td><p className="font-bold">{invitation.displayName || "Sin nombre asignado"}</p><span>{invitation.email}</span></td><td><StatusPill status={invitation.role} /></td><td><span className="inline-flex rounded-full bg-[#FFC72C]/15 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">Invitación pendiente</span></td><td><span>{readableTimestamp(invitation.createdAt)}</span></td><td><span className="text-xs font-semibold text-muted-foreground">Pendiente de registro</span></td></tr>)}</tbody></table></div> : <Empty title="El directorio está vacío" detail="El Departamento de IT puede crear una invitación para dar acceso al primer integrante." />}</section></>;

  const canEditProducts = isAdmin || hasTemporaryModule("products");
  const productsPanel = <><PageTitle eyebrow="Catálogo de servicios" title="Productos" actions={canEditProducts ? <button className="primary-button" onClick={() => setModal({ type: "product" })}><Plus size={17} />Nuevo paquete</button> : undefined} /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Consulta los paquetes, precios e inclusiones antes de registrar una reserva o un pago. Los nombres de las categorías se sincronizan para todo el equipo y no alteran registros históricos.</p>{(["tariff", "promotion"] as ProductCategory[]).map((category) => { const products = catalog.filter((product) => product.category === category); const isPromotion = category === "promotion"; return <section className="mt-8" key={category}><div className={`mb-4 flex items-end justify-between rounded-2xl border px-5 py-4 ${isPromotion ? "border-[#FFC72C]/30 bg-[#FFC72C]/10" : "border-[#1676F3]/20 bg-[#1676F3]/5"}`}><div><p className="eyebrow">{isPromotion ? "Promoción especial" : "Catálogo regular"}</p><h2 className="mt-1 text-xl font-extrabold">{categoryLabels[category]}</h2></div><div className="flex items-end gap-3">{isPromotion && <p className="text-right text-xs font-bold text-amber-800 dark:text-amber-300">5 alumnos o más reciben una foto grupal adicional GRATIS</p>}{canEditProducts && <button className="icon-button" title={`Editar nombre de ${categoryLabels[category]}`} onClick={() => setCategoryEditing(category)}><Pencil size={16} /></button>}</div></div><div className="grid gap-5 lg:grid-cols-3">{products.map((product) => <article className={`panel-card flex min-h-80 flex-col overflow-hidden ${canEditProducts ? "cursor-pointer" : ""}`} onClick={() => canEditProducts && setModal({ type: "product", data: product })} key={product.id}><div className={`border-b px-5 py-4 ${isPromotion ? "bg-[#FFC72C]/10" : "bg-[#1676F3]/5"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{product.name}</p><p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p></div>{canEditProducts && <div className="flex gap-1"><button className="icon-button" title="Editar paquete" onClick={(event) => { event.stopPropagation(); setModal({ type: "product", data: product }); }}><Pencil size={16} /></button><button className="icon-button danger" title="Retirar paquete" onClick={async (event) => { event.stopPropagation(); try { await deleteProduct(product.id, user.uid); toast.success("Paquete retirado del catálogo."); } catch { toast.error("No se pudo retirar el paquete."); } }}><Trash2 size={16} /></button></div>}</div><p className="mt-4 text-2xl font-extrabold">{currency(product.price)} <span className="text-xs font-semibold text-muted-foreground">{product.unit}</span></p></div><div className="flex flex-1 flex-col p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">Incluye</p><dl className="mt-3 space-y-2">{(product.details ?? []).map((detail) => <div className="grid grid-cols-[.8fr_1.2fr] gap-3 text-xs" key={`${product.id}-${detail.label}`}><dt className="font-bold text-foreground">{detail.label}</dt><dd className="text-muted-foreground">{detail.value}</dd></div>)}</dl><button className="secondary-button mt-auto w-full pt-3" onClick={(event) => { event.stopPropagation(); navigate("reservations"); }}>Usar en una reserva</button></div></article>)}</div></section>;})}</>;

  const remindersPanel = <><PageTitle eyebrow="Comunicaciones internas" title="Notificaciones" actions={isAdmin ? <button className="primary-button" onClick={() => setModal({ type: "reminder" })}><Plus size={17} />Nuevo anuncio</button> : undefined} /><div className="mt-4 rounded-xl border border-[#855CF5]/20 bg-[#855CF5]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Canal del Personal:</strong> los anuncios se organizan primero por relevancia y después por fecha. Administración e IT publican y gestionan; el Personal puede consultar la información.</div><section className="panel-card mt-5 overflow-hidden"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="font-extrabold">Anuncios publicados</p><p className="mt-0.5 text-xs text-muted-foreground">Urgentes, importantes e informativos</p></div><Bell className="text-[#855CF5]" size={19} /></div>{prioritizedReminders.length ? <div className="divide-y">{prioritizedReminders.map((reminder) => <article className="cursor-pointer px-5 py-5 transition-colors hover:bg-muted/40" onClick={() => openDetail("reminder", "Notificaciones", reminder.title, reminder)} key={reminder.id}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{reminder.title}</h3><StatusPill status={reminder.priority === "urgent" ? "cancelled" : reminder.priority === "important" ? "pending" : "active"} /></div><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{reminder.message}</p><p className="mt-4 text-xs font-semibold text-muted-foreground">Publicado por <span className="text-foreground">{reminder.createdByName || "Administración / IT"}</span> · {readableTimestamp(reminder.createdAt)}</p></div>{isAdmin && <div className="flex shrink-0 gap-2"><button className="icon-button" title="Editar anuncio" onClick={(event) => { event.stopPropagation(); setModal({ type: "reminder", data: reminder }); }}><Pencil size={16} /></button><button className="icon-button danger" title="Eliminar anuncio" onClick={async (event) => { event.stopPropagation(); try { await deleteGeneralReminder(reminder.id, user.uid); toast.success("Anuncio eliminado."); } catch { toast.error("No se pudo eliminar el anuncio."); } }}><Trash2 size={16} /></button></div>}</div></article>)}</div> : <Empty title="Sin anuncios publicados" detail={isAdmin ? "Crea el primer anuncio para el Personal." : "Los anuncios de Administración e IT aparecerán aquí."} />}</section></>;

  const historyPanel = <><PageTitle eyebrow="Auditoría administrativa" title="Historial de movimientos" actions={<select className="field !mt-0 !w-auto !py-2" aria-label="Filtrar historial" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}><option value="all">Todos los movimientos</option><option value="payment">Pagos</option><option value="reservation">Reservas</option><option value="customer">Clientes</option><option value="employee">Personal</option><option value="task">Tareas</option><option value="incident">Incidencias</option><option value="expense">Finanzas</option><option value="hr_profile">Recursos Humanos</option><option value="access">Configuración y seguridad</option><option value="reminder">Notificaciones</option></select>} /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Filtra los movimientos por módulo y toca una fila para consultar su responsable, fecha, código y registro vinculado.</p><section className="panel-card mt-6 overflow-hidden">{filteredHistory.length ? <div className="table-wrap"><table><thead><tr><th>Movimiento</th><th>Responsable</th><th>Fecha y hora</th><th aria-label="Eliminar" /></tr></thead><tbody>{filteredHistory.map((activity) => <tr className="cursor-pointer" onClick={() => openDetail(activity.entity === "reservation" ? "reservation" : activity.entity === "payment" ? "payment" : activity.entity === "product" ? "product" : activity.entity === "reminder" ? "reminder" : "customer", "Movimiento de historial", activity.summary, activity, linkedActivityRecord(activity))} key={activity.id}><td><p className="font-bold">{activity.summary}</p><span className="capitalize">{activity.entity}</span></td><td><p className="font-semibold">{activity.actorName}</p><span>{activity.actorEmail || "Sin correo"}</span></td><td>{readableTimestamp(activity.occurredAt)}</td><td>{isAdmin && <button className="icon-button danger" title="Eliminar movimiento" onClick={async (event) => { event.stopPropagation(); if (!window.confirm("¿Eliminar este movimiento del historial?")) return; try { await deleteActivityLog(activity.id); toast.success("Movimiento eliminado del historial."); } catch { toast.error("No se pudo eliminar el movimiento."); } }}><Trash2 size={16} /></button>}</td></tr>)}</tbody></table></div> : <Empty title="Sin movimientos para este filtro" detail="Cambia el filtro para consultar otros registros auditados." />}</section></>;

  return <div className={`min-h-screen bg-background text-foreground ${bulkEditSection === section ? "bulk-editing" : ""}`}>
    <RoleTerminologyNormalizer />
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate("overview")} title="Ir al Resumen" className="flex min-w-0 items-center gap-2"><SigesWordmark /><span className="sr-only">Sistema Integral de Gestión Estratégica</span></button>
        <div className="flex shrink-0 items-center gap-2"><button className="icon-button" aria-label="Abrir notificaciones" onClick={() => navigate("reminders")}><Bell size={18} /></button><button className="icon-button relative" aria-label="Abrir correo interno" onClick={() => navigate("mail")}><Mail size={18} />{unreadMailCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#C53B53] px-1 text-[10px] font-bold text-white">{unreadMailCount}</span> : null}</button><button className="icon-button" aria-label="Abrir calendario" onClick={() => navigate("calendar")}><CalendarDays size={18} /></button><button className="icon-button" aria-label="Abrir impacto digital" onClick={() => navigate("impact")}><Leaf size={18} /></button><AccountMenu profile={profile} onNavigate={navigate} onLogout={logout} /><button className="icon-button" aria-label="Abrir navegación" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button></div>
      </div>
      {mobileOpen && <div className="floating-surface border-x-0 border-t-0 p-3"><AppSidebar active={section} onNavigate={navigate} isAdmin={isAdmin} isIT={isIT} temporarySections={temporarySections} collapsed={false} onToggle={() => setMobileOpen(false)} /></div>}
    </div>
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="hidden lg:block"><AppSidebar active={section} onNavigate={navigate} isAdmin={isAdmin} isIT={isIT} temporarySections={temporarySections} collapsed={sidebarCollapsed} onToggle={toggleSidebar} /></div>
      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-7 lg:px-10 lg:py-8">
        <header className="mb-8 flex items-center justify-between gap-4"><div className="hidden text-sm text-muted-foreground sm:block"><span className="font-bold text-foreground">{profile.displayName}</span><span className="mx-2">·</span><StatusPill status={profile.role} /></div><div className="ml-auto flex items-center gap-2"><button onClick={() => setGlobalSearchOpen(true)} title="Buscar en la plataforma" className="secondary-button hidden gap-2 px-3 sm:flex"><Search size={16} />Buscar <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd></button><button onClick={() => navigate("reminders")} title="Notificaciones" className="icon-button"><Bell size={18} /></button><button onClick={() => navigate("mail")} title="Correo interno" className="icon-button relative"><Mail size={18} />{unreadMailCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#C53B53] px-1 text-[10px] font-bold text-white">{unreadMailCount}</span> : null}</button><button onClick={() => navigate("calendar")} title="Calendario" className="icon-button"><CalendarDays size={18} /></button><button onClick={() => navigate("impact")} title="Impacto digital" className="icon-button"><Leaf size={18} /></button><button onClick={toggleTheme} title="Cambiar tema" className="icon-button">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><AccountMenu profile={profile} onNavigate={navigate} onLogout={logout} /></div></header>
        {(["customers", "payments"].includes(section) || (section === "employees" && isIT)) && <div className="mb-5 flex justify-end"><BulkModeControl active={bulkEditSection === section} onToggle={() => toggleBulkMode(section)} /></div>}
        <motion.div key={section} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, ease: [0.23, 1, 0.32, 1] }}>
        {section === "overview" ? overview : section === "mail" ? <InternalMailPanel messages={internalMessages} employees={employees} profile={profile} onRead={(message) => void markInternalMessageRead(message.id, user.uid, message.readByIds || []).catch(() => undefined)} /> : section === "customers" ? customersPanel : section === "reservations" ? reservationsPanel : section === "payments" ? paymentsPanel : section === "products" ? productsPanel : section === "tasks" ? <WorkPanel tasks={tasks} incidents={incidents} employees={employees} reservations={reservations} userId={user.uid} isAdmin={isAdmin} /> : section === "hr" ? <HrPanel user={profile} isAdmin={isAdmin} employees={employees} hrProfile={hrProfile} profiles={hrProfiles} units={organizationUnits} contracts={employmentContracts} documents={hrDocuments} schedules={workSchedules} attendance={attendanceRecords} guards={attendanceGuards} attendanceSettings={attendanceSettings} leaves={leaveRequests} lifecycle={lifecycleChecklists} goals={hrGoals} reviews={performanceReviews} training={trainingRecords} recognitions={recognitions} policies={hrPolicies} acknowledgments={policyAcknowledgments} /> : section === "updates" ? <UpdateRequestsPanel requests={updateRequests} employees={employees} profile={profile} isAdmin={isAdmin} onNavigate={navigate} customers={customers} reservations={reservations} payments={payments} products={catalog} productCategorySettings={productCategorySettings} tasks={tasks} incidents={incidents} expenses={expenses} profiles={hrProfiles} units={organizationUnits} contracts={employmentContracts} documents={hrDocuments} schedules={workSchedules} attendance={attendanceRecords} leaves={leaveRequests} goals={hrGoals} reviews={performanceReviews} training={trainingRecords} policies={hrPolicies} messages={internalMessages} automations={automations} activityLogs={activityLogs} accessLogs={accessLogs} carbonUsage={carbonUsage} reminders={reminders} /> : section === "automations" && isAdmin ? <AutomationsPanel automations={automations} profile={profile} /> : section === "hr_reports" && isAdmin ? <HrReportsPanel employees={employees} profiles={hrProfiles} attendance={attendanceRecords} leaves={leaveRequests} /> : section === "performance" && isAdmin ? <PerformanceDashboard employees={employees} profiles={hrProfiles} attendance={attendanceRecords} tasks={tasks} goals={hrGoals} reviews={performanceReviews} training={trainingRecords} /> : section === "impact" ? <ImpactPanel usage={carbonUsage} isAdmin={isAdmin} employees={employees} profiles={hrProfiles} /> : section === "finance" && isAdmin ? <FinancePanel payments={payments} expenses={expenses} reservations={reservations} userId={user.uid} /> : section === "reports" && isAdmin ? <ReportsCenterPanel payments={payments} expenses={expenses} reservations={reservations} customers={customers} tasks={tasks} incidents={incidents} activityLogs={activityLogs} employees={employees} hrProfiles={hrProfiles} employmentContracts={employmentContracts} hrDocuments={hrDocuments} attendanceRecords={attendanceRecords} leaveRequests={leaveRequests} payrollRuns={payrollRuns} internalMessages={internalMessages} automations={automations} /> : section === "payroll" && isAdmin ? <PayrollPanel employees={employees} profiles={hrProfiles} contracts={employmentContracts} attendance={attendanceRecords} leaves={leaveRequests} payrollRuns={payrollRuns} userId={user.uid} /> : section === "reminders" ? remindersPanel : section === "employees" && isAdmin ? employeesPanel : section === "operations" && isAdmin ? <OperationsPanel reservations={reservations} employees={employees} userId={user.uid} /> : section === "history" && isAdmin ? historyPanel : section === "access" && isIT ? <AccessPanel accessLogs={accessLogs} activityLogs={activityLogs} carbonUsage={carbonUsage} /> : profilePanel}
        {section === "payments" && <PaymentAdjustmentReviewPanel requests={paymentAdjustmentRequests} payments={payments} isAdmin={isAdmin} userId={user.uid} />}
        </motion.div>
      </main>
    </div>
    <nav className="ios-mobile-tabs lg:hidden" aria-label="Navegación principal"><button className={`ios-tab ${section === "overview" ? "active" : ""}`} onClick={() => navigate("overview")}><LayoutDashboard size={21} /><span>Resumen</span></button><button className={`ios-tab ${section === "reservations" ? "active" : ""}`} onClick={() => navigate("reservations")}><CalendarDays size={21} /><span>Reservas</span></button><button className={`ios-tab ${section === "customers" ? "active" : ""}`} onClick={() => navigate("customers")}><UsersRound size={21} /><span>Clientes</span></button><button className={`ios-tab ${section === "payments" ? "active" : ""}`} onClick={() => navigate("payments")}><CreditCard size={21} /><span>Pagos</span></button><button className={`ios-tab ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen((open) => !open)}><Menu size={21} /><span>Más</span></button></nav>
    {modal && (modal.type === "employee" || modal.type === "customer" || modal.type === "product" ? <Modal title={modalTitle} onClose={closeModal}>{modalBody}</Modal> : <WorkflowDialog title={modalTitle} onClose={closeModal} primary={modalBody} relatedTitle={relatedTitle} related={relatedBody} onCloseRelated={() => setRelatedPanel(null)} />)}
    {categoryEditing && <Modal title="Editar categoría de Productos" onClose={() => setCategoryEditing(null)}><ProductCategorySettingForm category={categoryEditing} currentLabel={categoryLabels[categoryEditing]} userId={user.uid} onDone={() => setCategoryEditing(null)} /></Modal>}
    <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} onNavigate={openSearchResult} customers={customers} reservations={reservations} payments={payments} tasks={tasks} incidents={incidents} expenses={expenses} isAdmin={isAdmin} index={globalSearchIndex} />
  </div>;
}
