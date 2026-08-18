/**
 * Sala de Operaciones Editorial: panel asimétrico, cifras de registro y marcadores de estado.
 * La UI refleja permisos, pero Firestore sigue siendo la capa que los hace obligatorios.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, signOut, updatePassword, updateProfile as updateAuthProfile, type User } from "firebase/auth";
import {
  CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, CreditCard,
  History, LayoutDashboard, LogOut, Menu, Moon, Pencil, Plus, Search, ShieldAlert, Sun, Trash2,
  UserCog, UserRound, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import {
  createRecord, deleteEmployeeProfile, inviteEmployee, removeRecord, subscribeCollection,
  updateEmployee, updateOwnProfile, updateRecord,
} from "@/lib/firestore";
import type { ActivityLog, Customer, Payment, PaymentMethod, PaymentStatus, Reservation, ReservationStatus, UserProfile, UserRole } from "@/lib/types";
import { useTheme } from "@/contexts/ThemeContext";

type Section = "overview" | "reservations" | "customers" | "payments" | "employees" | "history" | "profile";
type RecordType = "customer" | "reservation" | "payment" | "employee";
type RecordData = Customer | Reservation | Payment | UserProfile;
type RelatedPanel = "customer" | "reservation" | null;

const dateToday = () => new Date().toISOString().slice(0, 10);
const currency = (amount: number, code = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount || 0);
const readableDate = (value: string) => value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—";
const readableTimestamp = (value: unknown) => {
  const date = value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date ? value : null;
  return date ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Pendiente de sincronizar";
};
const labelStatus: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", paid: "Pagado", refunded: "Reintegrado", active: "Activo", suspended: "Suspendido", admin: "Administrador", personal: "Personal" };

function StatusPill({ status }: { status: string }) {
  const tone = status === "active" || status === "confirmed" || status === "completed" || status === "paid"
    ? "success" : status === "pending" ? "warning" : status === "cancelled" || status === "suspended" || status === "refunded" ? "danger" : "muted";
  return <span className={`status-pill ${tone}`}>{labelStatus[status] || status}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07151A]/55 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/40 bg-card text-card-foreground shadow-2xl"><header className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-extrabold tracking-tight">{title}</h2><button aria-label="Cerrar" onClick={onClose} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-5">{children}</div></section></div>;
}

function WorkflowDialog({ title, onClose, primary, relatedTitle, related, onCloseRelated }: { title: string; onClose: () => void; primary: ReactNode; relatedTitle?: string; related?: ReactNode; onCloseRelated: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07151A]/55 p-4 backdrop-blur-sm"><div className="mx-auto flex min-h-full max-w-6xl items-center justify-center"><motion.div layout transition={{ type: "spring", stiffness: 280, damping: 28 }} className={`workflow-dialog ${related ? "has-related" : ""}`}><section role="dialog" aria-modal="true" className="workflow-main-panel"><header className="flex items-center justify-between border-b px-5 py-4"><div><p className="eyebrow">Flujo de registro</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2></div><button aria-label="Cerrar" onClick={onClose} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-5">{primary}</div></section><AnimatePresence>{related && <motion.aside initial={{ opacity: 0, x: 72 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 72 }} transition={{ type: "spring", stiffness: 290, damping: 27 }} className="workflow-related-panel"><header className="flex items-center justify-between border-b px-5 py-4"><div><p className="eyebrow">Registro relacionado</p><h3 className="mt-1 text-lg font-extrabold tracking-tight">{relatedTitle}</h3></div><button aria-label="Cerrar panel relacionado" onClick={onCloseRelated} className="icon-button"><X size={18} /></button></header><div className="max-h-[76vh] overflow-y-auto p-5">{related}</div></motion.aside>}</AnimatePresence></motion.div></div></div>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-64 place-items-center px-6 text-center"><div><img className="mx-auto h-24 w-24 object-contain" src="/manus-storage/gestionpro-empty-state_f0539f74.png" alt="" /><h3 className="mt-3 font-extrabold">{title}</h3><p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{detail}</p></div></div>;
}

function PageTitle({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">{title}</h1></div>{actions}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = "jade" }: { label: string; value: string; note: string; icon: LucideIcon; tone?: "jade" | "amber" | "ink" | "rose" }) {
  return <article className="metric-card"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="metric-number mt-4 text-3xl font-semibold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div><div className={`metric-icon ${tone}`}><Icon size={19} /></div></article>;
}

function RecordActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex justify-end gap-1"><button className="icon-button" title="Editar" onClick={onEdit}><Pencil size={16} /></button><button className="icon-button danger" title="Eliminar" onClick={onDelete}><Trash2 size={16} /></button></div>;
}

function AppSidebar({ active, onNavigate, isAdmin, onLogout, collapsed, onToggle }: { active: Section; onNavigate: (section: Section) => void; isAdmin: boolean; onLogout: () => void; collapsed: boolean; onToggle: () => void }) {
  const base: Array<{ key: Section; label: string; icon: LucideIcon }> = [
    { key: "overview", label: "Resumen", icon: LayoutDashboard }, { key: "reservations", label: "Reservas", icon: CalendarDays },
    { key: "customers", label: "Clientes", icon: UsersRound }, { key: "payments", label: "Pagos", icon: CreditCard },
  ];
  if (isAdmin) base.push({ key: "employees", label: "Empleados", icon: UserCog }, { key: "history", label: "Historial", icon: History });
  return <aside className={`sidebar-panel ${collapsed ? "is-collapsed" : ""}`}><div className="flex items-center justify-between gap-2 px-2"><div className="flex min-w-0 items-center gap-3"><img src="/manus-storage/gestionpro-mark_51952039.png" alt="Heliot Media" className="h-11 w-11 shrink-0 rounded-xl bg-white p-1" />{!collapsed && <div><span className="text-lg font-extrabold tracking-tight">Heliot <span className="text-[#0F8F73]">Media</span></span><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Operaciones</p></div>}</div><button className="icon-button" onClick={onToggle} title={collapsed ? "Expandir menú" : "Colapsar menú"}><Menu size={18} /></button></div><nav className="mt-10 space-y-1">{base.map(({ key, label, icon: Icon }) => <button key={key} title={collapsed ? label : undefined} onClick={() => onNavigate(key)} className={`side-link ${active === key ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}><Icon size={18} />{!collapsed && label}</button>)}</nav><div className="mt-auto space-y-1 border-t pt-5"><button title={collapsed ? "Mi perfil" : undefined} onClick={() => onNavigate("profile")} className={`side-link ${active === "profile" ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}><UserRound size={18} />{!collapsed && "Mi perfil"}</button><button title={collapsed ? "Cerrar sesión" : undefined} onClick={onLogout} className={`side-link text-destructive ${collapsed ? "justify-center px-2" : ""}`}><LogOut size={18} />{!collapsed && "Cerrar sesión"}</button>{!collapsed && <p className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Con tecnología de Windsor</p>}</div></aside>;
}

function CustomerForm({ initial, userId, onDone, onCreated }: { initial?: Customer; userId: string; onDone: () => void; onCreated?: (customer: Customer) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitting(true); const form = new FormData(event.currentTarget); const payload = { fullName: String(form.get("fullName")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), notes: String(form.get("notes")).trim() }; try { const id = initial ? initial.id : await createRecord("customers", { ...payload, createdBy: userId }); if (initial) await updateRecord("customers", initial.id, payload, userId); else onCreated?.({ id, ...payload, createdBy: userId }); toast.success(initial ? "Cliente actualizado." : "Cliente registrado."); onDone(); } catch { toast.error("No fue posible guardar el cliente."); } finally { setSubmitting(false); } };
  return <form className="form-stack" onSubmit={submit}><label>Nombre completo<input className="field" name="fullName" required defaultValue={initial?.fullName} /></label><div className="grid gap-4 sm:grid-cols-2"><label>Correo<input className="field" type="email" name="email" defaultValue={initial?.email} /></label><label>Teléfono<input className="field" name="phone" defaultValue={initial?.phone} /></label></div><label>Notas<textarea className="field min-h-24" name="notes" defaultValue={initial?.notes} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar cliente"}<ChevronRight size={16} /></button></form>;
}

function InlineCustomer({ userId, onCreated }: { userId: string; onCreated: (customer: Customer) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = { fullName: String(form.get("fullName")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), notes: "", createdBy: userId };
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
  return <form className="mt-3 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 p-3" onSubmit={submit}><p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#08745D] dark:text-[#5DDBC0]">Añadir cliente sin salir</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className="field" name="fullName" required placeholder="Nombre completo" /><input className="field" name="email" type="email" placeholder="Correo (opcional)" /><button className="secondary-button" disabled={submitting}>{submitting ? "Añadiendo…" : "Añadir cliente"}</button></div><input className="field mt-2" name="phone" placeholder="Teléfono (opcional)" /></form>;
}

function InlineReservation({ customer, userId, onCreated }: { customer: Customer; userId: string; onCreated: (reservation: Reservation) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = { customerId: customer.id, customerName: customer.fullName, date: String(form.get("date")), time: String(form.get("time")), service: String(form.get("service")).trim(), durationMinutes: Number(form.get("durationMinutes")), status: "confirmed" as ReservationStatus, notes: "", createdBy: userId };
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
  return <form className="mt-3 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 p-3" onSubmit={submit}><p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#08745D] dark:text-[#5DDBC0]">Añadir reserva para {customer.fullName}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="field" name="service" required placeholder="Servicio" /><input className="field" name="date" type="date" required defaultValue={dateToday()} /><input className="field" name="time" type="time" required defaultValue="09:00" /><input className="field" name="durationMinutes" type="number" min="5" step="5" required defaultValue={60} /></div><button className="secondary-button mt-2" disabled={submitting}>{submitting ? "Añadiendo…" : "Añadir reserva"}</button></form>;
}

function ReservationForm({ initial, customers, userId, onDone, linkedCustomer, onOpenCustomerPanel, onCreated }: { initial?: Reservation; customers: Customer[]; userId: string; onDone: () => void; linkedCustomer?: Customer | null; onOpenCustomerPanel?: () => void; onCreated?: (reservation: Reservation) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initial?.customerId || linkedCustomer?.id || "");
  useEffect(() => { if (linkedCustomer) setSelectedCustomerId(linkedCustomer.id); }, [linkedCustomer]);
  const customerOptions = linkedCustomer && !customers.some((customer) => customer.id === linkedCustomer.id) ? [...customers, linkedCustomer] : customers;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitting(true); const form = new FormData(event.currentTarget); const customer = customerOptions.find((item) => item.id === form.get("customerId")); if (!customer) { toast.error("Selecciona un cliente."); setSubmitting(false); return; } const payload = { customerId: customer.id, customerName: customer.fullName, date: String(form.get("date")), time: String(form.get("time")), service: String(form.get("service")).trim(), durationMinutes: Number(form.get("durationMinutes")), status: String(form.get("status")) as ReservationStatus, notes: String(form.get("notes")).trim() }; try { const id = initial ? initial.id : await createRecord("reservations", { ...payload, createdBy: userId }); if (initial) await updateRecord("reservations", initial.id, payload, userId); else onCreated?.({ id, ...payload, createdBy: userId }); toast.success(initial ? "Reserva actualizada." : "Reserva creada."); onDone(); } catch { toast.error("No fue posible guardar la reserva."); } finally { setSubmitting(false); } };
  return <form className="form-stack" onSubmit={submit}><label>Cliente<select className="field" required name="customerId" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Selecciona un cliente</option>{customerOptions.map((customer) => <option value={customer.id} key={customer.id}>{customer.fullName}</option>)}</select></label>{onOpenCustomerPanel && <button type="button" className="workflow-link" onClick={onOpenCustomerPanel}>+ Registrar cliente en panel lateral</button>}<div className="grid gap-4 sm:grid-cols-2"><label>Fecha<input className="field" type="date" name="date" required defaultValue={initial?.date || dateToday()} /></label><label>Hora<input className="field" type="time" name="time" required defaultValue={initial?.time || "09:00"} /></label></div><div className="grid gap-4 sm:grid-cols-[1fr_.6fr]"><label>Servicio<input className="field" name="service" required defaultValue={initial?.service} placeholder="Ej. Consulta" /></label><label>Duración (min.)<input className="field" type="number" name="durationMinutes" min="5" step="5" required defaultValue={initial?.durationMinutes || 60} /></label></div><label>Estado<select className="field" name="status" defaultValue={initial?.status || "confirmed"}><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label><label>Notas<textarea className="field min-h-20" name="notes" defaultValue={initial?.notes} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar reserva"}<ChevronRight size={16} /></button></form>;
}

function PaymentForm({ initial, customers, reservations, userId, onDone, linkedCustomer, linkedReservation, onOpenCustomerPanel, onOpenReservationPanel }: { initial?: Payment; customers: Customer[]; reservations: Reservation[]; userId: string; onDone: () => void; linkedCustomer?: Customer | null; linkedReservation?: Reservation | null; onOpenCustomerPanel?: () => void; onOpenReservationPanel?: (customer: Customer) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initial?.customerId || linkedCustomer?.id || "");
  const customerOptions = linkedCustomer && !customers.some((customer) => customer.id === linkedCustomer.id) ? [...customers, linkedCustomer] : customers;
  const reservationOptions = linkedReservation && !reservations.some((reservation) => reservation.id === linkedReservation.id) ? [...reservations, linkedReservation] : reservations;
  useEffect(() => { if (linkedCustomer) setSelectedCustomerId(linkedCustomer.id); }, [linkedCustomer]);
  const selectedCustomer = customerOptions.find((customer) => customer.id === selectedCustomerId);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitting(true); const form = new FormData(event.currentTarget); const customer = customerOptions.find((item) => item.id === form.get("customerId")); if (!customer) { toast.error("Selecciona un cliente."); setSubmitting(false); return; } const payload = { customerId: customer.id, customerName: customer.fullName, reservationId: String(form.get("reservationId")) || undefined, amount: Number(form.get("amount")), currency: String(form.get("currency")) as Payment["currency"], method: String(form.get("method")) as PaymentMethod, status: String(form.get("status")) as PaymentStatus, paidAt: String(form.get("paidAt")), notes: String(form.get("notes")).trim() }; try { initial ? await updateRecord("payments", initial.id, payload, userId) : await createRecord("payments", { ...payload, createdBy: userId }); toast.success(initial ? "Pago actualizado." : "Pago registrado."); onDone(); } catch { toast.error("No fue posible guardar el pago."); } finally { setSubmitting(false); } };
  return <form className="form-stack" onSubmit={submit}><label>Cliente<select className="field" required name="customerId" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Selecciona un cliente</option>{customerOptions.map((customer) => <option value={customer.id} key={customer.id}>{customer.fullName}</option>)}</select></label>{onOpenCustomerPanel && <button type="button" className="workflow-link" onClick={onOpenCustomerPanel}>+ Registrar cliente en panel lateral</button>}<label>Reserva relacionada <span className="font-normal text-muted-foreground">(opcional)</span><select key={linkedReservation?.id || initial?.reservationId || "empty"} className="field" name="reservationId" defaultValue={linkedReservation?.id || initial?.reservationId || ""}><option value="">Sin asociar</option>{reservationOptions.filter((reservation) => !selectedCustomerId || reservation.customerId === selectedCustomerId).map((reservation) => <option value={reservation.id} key={reservation.id}>{reservation.customerName} · {readableDate(reservation.date)} {reservation.time}</option>)}</select></label>{selectedCustomer && onOpenReservationPanel && <button type="button" className="workflow-link" onClick={() => onOpenReservationPanel(selectedCustomer)}>+ Registrar reserva en panel lateral</button>}<div className="grid gap-4 sm:grid-cols-2"><label>Importe<input className="field" type="number" name="amount" min="0" step="0.01" required defaultValue={initial?.amount} /></label><label>Moneda<select className="field" name="currency" defaultValue={initial?.currency || "USD"}><option>USD</option><option>EUR</option><option>MXN</option><option>ARS</option><option>COP</option></select></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Método<select className="field" name="method" defaultValue={initial?.method || "card"}><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label><label>Estado<select className="field" name="status" defaultValue={initial?.status || "paid"}><option value="paid">Pagado</option><option value="pending">Pendiente</option><option value="refunded">Reintegrado</option></select></label></div><label>Fecha<input className="field" type="date" name="paidAt" required defaultValue={initial?.paidAt || dateToday()} /></label><label>Notas<textarea className="field min-h-20" name="notes" defaultValue={initial?.notes} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : "Guardar pago"}<ChevronRight size={16} /></button></form>;
}

function EmployeeForm({ initial, adminId, onDone }: { initial?: UserProfile; adminId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName")).trim();
    const role = String(form.get("role")) as UserRole;
    const status = String(form.get("status")) as "active" | "suspended";
    const email = String(form.get("email")).trim().toLowerCase();
    try {
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
    <label>Correo de acceso<input className="field" type="email" name="email" required defaultValue={initial?.email} placeholder="persona@empresa.com" /></label>
    {initial && <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">Al cambiar el correo se genera automáticamente una invitación para el nuevo acceso y se suspende el acceso anterior. Así no se modifican usuarios manualmente desde la base de datos.</p>}
    <label>Rol<select className="field" name="role" defaultValue={initial?.role || "personal"}><option value="personal">Personal</option><option value="admin">Administrador</option></select></label>
    {initial && <label>Estado<select className="field" name="status" defaultValue={initial.status}><option value="active">Activo</option><option value="suspended">Suspendido</option></select></label>}
    <button className="primary-button" disabled={submitting}>{submitting ? "Guardando…" : initial ? "Guardar cambios" : "Crear invitación"}<ChevronRight size={16} /></button>
    {!initial && <p className="text-xs leading-5 text-muted-foreground">La persona podrá crear su contraseña con este mismo correo. Comparte la instrucción de registro tras crear la invitación.</p>}
  </form>;
}

export default function Dashboard({ user, profile }: { user: User; profile: UserProfile }) {
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [queryText, setQueryText] = useState("");
  const [modal, setModal] = useState<{ type: RecordType; data?: RecordData } | null>(null);
  const [relatedPanel, setRelatedPanel] = useState<RelatedPanel>(null);
  const [workflowCustomer, setWorkflowCustomer] = useState<Customer | null>(null);
  const [workflowReservation, setWorkflowReservation] = useState<Reservation | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("heliot-sidebar-collapsed") === "true");
  const isAdmin = profile.role === "admin";

  useEffect(() => {
    const report = () => toast.error("No se pudo sincronizar un módulo. Comprueba las reglas de Firebase.");
    const stops = [subscribeCollection<Customer>("customers", setCustomers, report), subscribeCollection<Reservation>("reservations", setReservations, report), subscribeCollection<Payment>("payments", setPayments, report)];
    if (isAdmin) stops.push(subscribeCollection<UserProfile>("users", setEmployees, report), subscribeCollection<ActivityLog>("activityLogs", setActivityLogs, report));
    return () => stops.forEach((stop) => stop());
  }, [isAdmin]);

  const todayReservations = useMemo(() => reservations.filter((reservation) => reservation.date === dateToday() && reservation.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time)), [reservations]);
  const paidToday = useMemo(() => payments.filter((payment) => payment.paidAt === dateToday() && payment.status === "paid").reduce((total, payment) => total + payment.amount, 0), [payments]);
  const filtered = <T extends object>(rows: T[]): T[] => !queryText
    ? rows
    : rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(queryText.toLowerCase())));
  const handleDelete = async (type: "customers" | "reservations" | "payments" | "employee", id: string) => { if (!window.confirm("Esta acción no se puede deshacer. ¿Deseas continuar?")) return; try { if (type === "employee") await deleteEmployeeProfile(id, user.uid); else await removeRecord(type, id, user.uid); toast.success("Registro eliminado."); } catch { toast.error("No se pudo eliminar el registro."); } };
  const navigate = (next: Section) => { setSection(next); setMobileOpen(false); setQueryText(""); };
  const toggleSidebar = () => setSidebarCollapsed((collapsed) => {
    const next = !collapsed;
    localStorage.setItem("heliot-sidebar-collapsed", String(next));
    return next;
  });
  const closeModal = () => { setModal(null); setRelatedPanel(null); setWorkflowCustomer(null); setWorkflowReservation(null); };
  const newLabel = section === "customers" ? "Nuevo cliente" : section === "reservations" ? "Nueva reserva" : section === "payments" ? "Registrar pago" : section === "employees" ? "Invitar empleado" : "Nueva reserva";
  const opening = () => { setRelatedPanel(null); setWorkflowCustomer(null); setWorkflowReservation(null); setModal({ type: section === "customers" ? "customer" : section === "payments" ? "payment" : section === "employees" ? "employee" : "reservation" }); };

  const modalBody = modal && (modal.type === "customer" ? <CustomerForm initial={modal.data as Customer | undefined} userId={user.uid} onDone={closeModal} /> : modal.type === "reservation" ? <ReservationForm initial={modal.data as Reservation | undefined} customers={customers} userId={user.uid} linkedCustomer={workflowCustomer} onOpenCustomerPanel={() => setRelatedPanel("customer")} onDone={closeModal} /> : modal.type === "payment" ? <PaymentForm initial={modal.data as Payment | undefined} customers={customers} reservations={reservations} userId={user.uid} linkedCustomer={workflowCustomer} linkedReservation={workflowReservation} onOpenCustomerPanel={() => setRelatedPanel("customer")} onOpenReservationPanel={(customer) => { setWorkflowCustomer(customer); setRelatedPanel("reservation"); }} onDone={closeModal} /> : <EmployeeForm initial={modal.data as UserProfile | undefined} adminId={user.uid} onDone={closeModal} />);
  const relatedBody = relatedPanel === "customer" ? <CustomerForm userId={user.uid} onDone={() => setRelatedPanel(null)} onCreated={(customer) => { setWorkflowCustomer(customer); setWorkflowReservation(null); setRelatedPanel(null); }} /> : relatedPanel === "reservation" && workflowCustomer ? <ReservationForm customers={customers} userId={user.uid} linkedCustomer={workflowCustomer} onDone={() => setRelatedPanel(null)} onCreated={(reservation) => { setWorkflowReservation(reservation); setRelatedPanel(null); }} /> : null;
  const relatedTitle = relatedPanel === "customer" ? "Registrar cliente" : "Registrar reserva";
  const modalTitle = modal?.type === "customer" ? `${modal.data ? "Editar" : "Nuevo"} cliente` : modal?.type === "reservation" ? `${modal.data ? "Editar" : "Nueva"} reserva` : modal?.type === "payment" ? `${modal.data ? "Editar" : "Registrar"} pago` : modal?.data ? "Configurar empleado" : "Invitar empleado";

  const profilePanel = <section className="max-w-2xl">
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
    </div>
  </section>;

  const overview = <><PageTitle eyebrow="Vista operativa" title="La jornada de hoy" actions={<button onClick={opening} className="primary-button"><Plus size={17} />Nueva reserva</button>} /><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Agenda de hoy" value={String(todayReservations.length).padStart(2, "0")} note="Reservas activas" icon={CalendarDays} /><Metric label="Cobrado hoy" value={currency(paidToday)} note="Pagos confirmados" icon={CircleDollarSign} tone="amber" /><Metric label="Clientes" value={String(customers.length).padStart(2, "0")} note="En tu registro" icon={UsersRound} tone="ink" /><Metric label="Pendientes" value={String(reservations.filter((item) => item.status === "pending").length).padStart(2, "0")} note="Por confirmar" icon={ClipboardList} tone="rose" /></section><section className="mt-7 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><article className="panel-card"><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="font-extrabold">Agenda inmediata</p><p className="mt-0.5 text-xs text-muted-foreground">Reservas activas del día</p></div><button className="text-sm font-bold text-[#08745D] hover:underline dark:text-[#5DDBC0]" onClick={() => navigate("reservations")}>Ver agenda</button></div>{todayReservations.length ? <div className="divide-y">{todayReservations.slice(0, 5).map((reservation) => <div className="agenda-row" key={reservation.id}><span className="time-code">{reservation.time}</span><span className={`status-marker ${reservation.status}`} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{reservation.customerName}</p><p className="truncate text-sm text-muted-foreground">{reservation.service} · {reservation.durationMinutes} min</p></div><StatusPill status={reservation.status} /></div>)}</div> : <Empty title="Agenda despejada" detail="Cuando registres reservas para hoy aparecerán aquí ordenadas por hora." />}</article><article className="panel-card flex flex-col overflow-hidden"><div className="border-b px-5 py-4"><p className="font-extrabold">Señales del sistema</p><p className="mt-0.5 text-xs text-muted-foreground">Información para decidir rápido</p></div><div className="space-y-4 p-5"><div className="signal-card"><CheckCircle2 className="text-[#0F8F73]" size={20} /><p><strong>Datos sincronizados</strong><span>Los cambios se reflejan en tiempo real para empleados activos.</span></p></div>{isAdmin && <div className="signal-card"><ShieldAlert className="text-amber-600" size={20} /><p><strong>Control de empleados</strong><span>Puedes suspender accesos desde el módulo de empleados.</span></p></div>}<img src="/manus-storage/gestionpro-onboarding-agenda_127aa8f5.png" className="mt-auto h-36 w-full rounded-xl object-cover" alt="Organización de una agenda de trabajo" /></div></article></section></>;

  const customersPanel = <><PageTitle eyebrow="Directorio operativo" title="Clientes" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Nuevo cliente</button>} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar por nombre, correo o teléfono…" /></div>{filtered(customers).length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Contacto</th><th>Registro</th><th>Notas</th><th aria-label="Acciones" /></tr></thead><tbody>{filtered(customers).map((customer) => <tr key={customer.id}><td><p className="font-bold">{customer.fullName}</p></td><td><p>{customer.email || "Sin correo"}</p><span>{customer.phone || "Sin teléfono"}</span></td><td><p className="font-semibold">{customer.createdByName || "Sin dato"}</p><span>{readableTimestamp(customer.createdAt)}</span></td><td className="max-w-52 truncate">{customer.notes || "—"}</td><td><RecordActions onEdit={() => setModal({ type: "customer", data: customer })} onDelete={() => handleDelete("customers", customer.id)} /></td></tr>)}</tbody></table></div> : <Empty title="Aún no hay clientes" detail="Añade el primer cliente para empezar a crear reservas y registrar pagos." />}</section></>;

  const reservationsPanel = <><PageTitle eyebrow="Agenda de servicio" title="Reservas" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Nueva reserva</button>} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar cliente, servicio o estado…" /></div>{filtered(reservations).length ? <div className="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Cliente</th><th>Servicio</th><th>Estado</th><th>Registro</th><th aria-label="Acciones" /></tr></thead><tbody>{filtered(reservations).map((reservation) => <tr key={reservation.id}><td><span className="time-code">{reservation.time}</span><p className="mt-1 text-xs text-muted-foreground">{readableDate(reservation.date)}</p></td><td className="font-bold">{reservation.customerName}</td><td><p>{reservation.service}</p><span>{reservation.durationMinutes} min</span></td><td><StatusPill status={reservation.status} /></td><td><p className="font-semibold">{reservation.createdByName || "Sin dato"}</p><span>{readableTimestamp(reservation.createdAt)}</span></td><td><RecordActions onEdit={() => setModal({ type: "reservation", data: reservation })} onDelete={() => handleDelete("reservations", reservation.id)} /></td></tr>)}</tbody></table></div> : <Empty title="No hay reservas todavía" detail="Crea una reserva vinculada a un cliente y aparecerá de inmediato en la agenda." />}</section></>;

  const paymentsPanel = <><PageTitle eyebrow="Libro de cobros" title="Pagos" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Registrar pago</button>} /><section className="panel-card mt-8 overflow-hidden"><div className="table-toolbar"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar por cliente, importe o método…" /></div>{filtered(payments).length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Importe</th><th>Método</th><th>Estado</th><th>Registro</th><th aria-label="Acciones" /></tr></thead><tbody>{filtered(payments).map((payment) => <tr key={payment.id}><td>{readableDate(payment.paidAt)}</td><td className="font-bold">{payment.customerName}</td><td className="metric-number font-semibold">{currency(payment.amount, payment.currency)}</td><td className="capitalize">{payment.method === "card" ? "Tarjeta" : payment.method === "cash" ? "Efectivo" : payment.method === "transfer" ? "Transferencia" : "Otro"}</td><td><StatusPill status={payment.status} /></td><td><p className="font-semibold">{payment.createdByName || "Sin dato"}</p><span>{readableTimestamp(payment.createdAt)}</span></td><td><RecordActions onEdit={() => setModal({ type: "payment", data: payment })} onDelete={() => handleDelete("payments", payment.id)} /></td></tr>)}</tbody></table></div> : <Empty title="Aún no hay pagos" detail="Registra un cobro para llevar el seguimiento del ingreso diario." />}</section></>;

  const employeesPanel = <><PageTitle eyebrow="Administración del equipo" title="Empleados" actions={<button className="primary-button" onClick={opening}><Plus size={17} />Invitar empleado</button>} /><div className="mt-4 rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Acceso administrativo:</strong> aquí puedes cambiar roles y suspender perfiles. La persona suspendida no podrá acceder ni leer datos de la plataforma.</div><section className="panel-card mt-5 overflow-hidden">{employees.length ? <div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Rol</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><p className="font-bold">{employee.displayName}</p><span>{employee.email}</span></td><td><StatusPill status={employee.role} /></td><td><StatusPill status={employee.status} /></td><td>{employee.id === user.uid ? <span className="text-xs text-muted-foreground">Tu cuenta</span> : <RecordActions onEdit={() => setModal({ type: "employee", data: employee })} onDelete={() => handleDelete("employee", employee.id)} />}</td></tr>)}</tbody></table></div> : <Empty title="El directorio está vacío" detail="Crea una invitación para dar acceso al primer integrante del equipo." />}</section></>;

  const historyPanel = <><PageTitle eyebrow="Auditoría administrativa" title="Historial de movimientos" /><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Este registro inmutable reúne creaciones, cambios, eliminaciones e invitaciones. Solo los administradores pueden acceder al historial completo.</p><section className="panel-card mt-6 overflow-hidden">{activityLogs.length ? <div className="table-wrap"><table><thead><tr><th>Movimiento</th><th>Responsable</th><th>Fecha y hora</th></tr></thead><tbody>{activityLogs.map((activity) => <tr key={activity.id}><td><p className="font-bold">{activity.summary}</p><span className="capitalize">{activity.entity}</span></td><td><p className="font-semibold">{activity.actorName}</p><span>{activity.actorEmail || "Sin correo"}</span></td><td>{readableTimestamp(activity.occurredAt)}</td></tr>)}</tbody></table></div> : <Empty title="Aún no hay movimientos" detail="Los nuevos registros y cambios aparecerán aquí automáticamente." />}</section></>;

  return <div className="min-h-screen bg-background text-foreground"><div className="lg:hidden"><div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur"><div className="flex items-center gap-2"><img src="/manus-storage/gestionpro-mark_51952039.png" alt="Heliot Media" className="h-9 w-9 rounded-lg" /><b>Heliot Media</b></div><button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button></div>{mobileOpen && <div className="border-b bg-card p-3"><AppSidebar active={section} onNavigate={navigate} isAdmin={isAdmin} onLogout={() => signOut(auth)} collapsed={false} onToggle={() => setMobileOpen(false)} /></div>}</div><div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}><div className="hidden lg:block"><AppSidebar active={section} onNavigate={navigate} isAdmin={isAdmin} onLogout={() => signOut(auth)} collapsed={sidebarCollapsed} onToggle={toggleSidebar} /></div><main className="min-w-0 px-4 py-6 sm:px-7 lg:px-10 lg:py-8"><header className="mb-8 flex items-center justify-between gap-4"><div className="hidden text-sm text-muted-foreground sm:block"><span className="font-bold text-foreground">{profile.displayName}</span><span className="mx-2">·</span><StatusPill status={profile.role} /></div><div className="ml-auto flex items-center gap-2"><button onClick={toggleTheme} title="Cambiar tema" className="icon-button">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5 text-left shadow-sm" onClick={() => navigate("profile")}><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0F8F73] text-xs font-extrabold text-white">{profile.displayName.slice(0, 2).toUpperCase()}</span><span className="hidden max-w-32 truncate pr-1 text-xs font-bold sm:block">{profile.displayName}</span></button></div></header>{section === "overview" ? overview : section === "customers" ? customersPanel : section === "reservations" ? reservationsPanel : section === "payments" ? paymentsPanel : section === "employees" && isAdmin ? employeesPanel : section === "history" && isAdmin ? historyPanel : profilePanel}</main></div>{modal && (modal.type === "employee" || modal.type === "customer" ? <Modal title={modalTitle} onClose={closeModal}>{modalBody}</Modal> : <WorkflowDialog title={modalTitle} onClose={closeModal} primary={modalBody} relatedTitle={relatedTitle} related={relatedBody} onCloseRelated={() => setRelatedPanel(null)} />)}</div>;
}
