/*
 * Búsqueda global contextual y limitada a los datos que el Dashboard ya
 * cargó para el rol autenticado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Customer, Expense, Incident, Payment, Reservation, Task } from "@/lib/types";

export type GlobalSearchDestination = "overview" | "calendar" | "mail" | "reservations" | "customers" | "payments" | "products" | "tasks" | "hr" | "updates" | "automations" | "hr_reports" | "performance" | "impact" | "finance" | "reports" | "payroll" | "employees" | "history" | "operations" | "access" | "pending" | "reminders" | "profile";
export type GlobalSearchIndexEntry = { id: string; destination: GlobalSearchDestination; category: string; title: string; detail: string; searchable?: unknown[] };
type SearchResult = Omit<GlobalSearchIndexEntry, "searchable">;

const customerName = (customer: Customer) => `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName || "Cliente sin nombre";
const reservationCode = (reservation: Reservation) => reservation.code || `RES-${reservation.id.slice(0, 8).toUpperCase()}`;
const paymentCode = (payment: Payment) => payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`;
const taskCode = (task: Task) => task.code || `TAR-${task.id.slice(0, 8).toUpperCase()}`;
const incidentCode = (incident: Incident) => incident.code || `INC-${incident.id.slice(0, 8).toUpperCase()}`;
const expenseCode = (expense: Expense) => expense.code || `GAS-${expense.id.slice(0, 8).toUpperCase()}`;

const serialise = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value ?? ""); } catch { return String(value ?? ""); }
};

export default function GlobalSearch({ open, onClose, onNavigate, customers, reservations, payments, tasks, incidents, expenses, isAdmin, index = [] }: { open: boolean; onClose: () => void; onNavigate: (destination: GlobalSearchDestination, resultId?: string) => void; customers: Customer[]; reservations: Reservation[]; payments: Payment[]; tasks: Task[]; incidents: Incident[]; expenses: Expense[]; isAdmin: boolean; index?: GlobalSearchIndexEntry[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!open) { setQuery(""); return; } const timer = window.setTimeout(() => inputRef.current?.focus(), 80); return () => window.clearTimeout(timer); }, [open]);
  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    const includes = (...values: unknown[]) => values.some((value) => serialise(value).toLocaleLowerCase().includes(term));
    const recordMatches = (record: object) => includes(...Object.values(record));
    const operational: SearchResult[] = [
      ...customers.filter(recordMatches).map((item) => ({ id: `customer-${item.id}`, destination: "customers" as const, category: "Cliente", title: customerName(item), detail: `${item.code || "CLI"} · ${item.email || item.phone || "Sin contacto"}` })),
      ...reservations.filter(recordMatches).map((item) => ({ id: `reservation-${item.id}`, destination: "reservations" as const, category: "Reserva", title: `${reservationCode(item)} · ${item.customerName}`, detail: `${item.service} · ${item.date} ${item.time}` })),
      ...payments.filter(recordMatches).map((item) => ({ id: `payment-${item.id}`, destination: "payments" as const, category: "Pago", title: `${paymentCode(item)} · ${item.customerName}`, detail: `${item.amount} ${item.currency} · ${item.status}` })),
      ...tasks.filter(recordMatches).map((item) => ({ id: `task-${item.id}`, destination: "tasks" as const, category: "Tarea", title: `${taskCode(item)} · ${item.title}`, detail: `${item.assignedToName || "Sin asignar"} · ${item.status}` })),
      ...incidents.filter(recordMatches).map((item) => ({ id: `incident-${item.id}`, destination: "tasks" as const, category: "Incidencia", title: `${incidentCode(item)} · ${item.title}`, detail: `${item.assignedToName || "Sin asignar"} · ${item.status}` })),
      ...(isAdmin ? expenses.filter((item) => !item.archived && recordMatches(item)).map((item) => ({ id: `expense-${item.id}`, destination: "finance" as const, category: "Gasto", title: `${expenseCode(item)} · ${item.concept}`, detail: `${item.amount} ${item.currency} · ${item.status}` })) : []),
    ];
    const indexed = index.filter((item) => includes(item.title, item.detail, ...(item.searchable || []))).map(({ searchable: _searchable, ...item }) => item);
    return [...operational, ...indexed].filter((item, position, all) => all.findIndex((candidate) => candidate.id === item.id) === position).slice(0, 30);
  }, [customers, expenses, incidents, index, isAdmin, payments, query, reservations, tasks]);
  const choose = (result: SearchResult) => { onNavigate(result.destination, result.id); onClose(); };
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#07151A]/55 p-4 backdrop-blur-sm" onMouseDown={onClose}><motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="floating-surface mx-auto mt-[10vh] w-full max-w-2xl overflow-hidden rounded-[1.35rem] border-white/40" role="dialog" aria-modal="true" aria-label="Búsqueda global" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b px-5 py-1"><Search className="text-[#1676F3]" size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground" placeholder="Buscar cualquier dato permitido: nombre, código, estado, fecha o descripción…" /><button className="icon-button" aria-label="Cerrar búsqueda" title="Cerrar búsqueda" onClick={onClose}><X size={18} /></button></div><div className="max-h-[60vh] overflow-y-auto">{query.trim() ? results.length ? <div className="divide-y">{results.map((result) => <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50" key={result.id} onClick={() => choose(result)}><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#1676F3]">{result.category}</p><p className="mt-1 truncate font-bold">{result.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{result.detail}</p></div><span className="shrink-0 text-xs font-bold text-muted-foreground">Abrir</span></button>)}</div> : <div className="px-6 py-14 text-center"><p className="font-extrabold">No se encontraron coincidencias</p><p className="mt-1 text-sm text-muted-foreground">Prueba con cualquier dato visible para tu rol: código, nombre, fecha, estado o descripción.</p></div> : <div className="px-6 py-14 text-center"><p className="font-extrabold">Búsqueda global</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Busca en todos los módulos y campos que tu rol tiene autorizados. La información restringida nunca se carga en este índice.</p><p className="mt-4 text-xs font-semibold text-muted-foreground">Atajo: <kbd className="rounded border bg-muted px-1.5 py-0.5">Ctrl</kbd> + <kbd className="rounded border bg-muted px-1.5 py-0.5">K</kbd></p></div>}</div></motion.section></motion.div>}</AnimatePresence>;
}
