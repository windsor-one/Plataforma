/**
 * Sala de Operaciones Editorial: una búsqueda breve, contextual y accesible.
 * Cada resultado guía al módulo correspondiente sin exponer información restringida por rol.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Customer, Expense, Incident, Payment, Reservation, Task } from "@/lib/types";

export type GlobalSearchDestination = "customers" | "reservations" | "payments" | "tasks" | "finance";

type SearchResult = { id: string; destination: GlobalSearchDestination; category: string; title: string; detail: string };
const customerName = (customer: Customer) => `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName || "Cliente sin nombre";
const reservationCode = (reservation: Reservation) => reservation.code || `RES-${reservation.id.slice(0, 8).toUpperCase()}`;
const paymentCode = (payment: Payment) => payment.code || `PAG-${payment.id.slice(0, 8).toUpperCase()}`;
const taskCode = (task: Task) => task.code || `TAR-${task.id.slice(0, 8).toUpperCase()}`;
const incidentCode = (incident: Incident) => incident.code || `INC-${incident.id.slice(0, 8).toUpperCase()}`;
const expenseCode = (expense: Expense) => expense.code || `GAS-${expense.id.slice(0, 8).toUpperCase()}`;

export default function GlobalSearch({ open, onClose, onNavigate, customers, reservations, payments, tasks, incidents, expenses, isAdmin }: { open: boolean; onClose: () => void; onNavigate: (destination: GlobalSearchDestination) => void; customers: Customer[]; reservations: Reservation[]; payments: Payment[]; tasks: Task[]; incidents: Incident[]; expenses: Expense[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!open) { setQuery(""); return; } const timer = window.setTimeout(() => inputRef.current?.focus(), 80); return () => window.clearTimeout(timer); }, [open]);
  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    const includes = (...values: unknown[]) => values.some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
    return [
      ...customers.filter((item) => includes(item.code, customerName(item), item.email, item.phone)).map((item) => ({ id: `customer-${item.id}`, destination: "customers" as const, category: "Cliente", title: customerName(item), detail: `${item.code || "CLI"} · ${item.email || item.phone || "Sin contacto"}` })),
      ...reservations.filter((item) => includes(item.code, item.customerName, item.service, item.date, item.status)).map((item) => ({ id: `reservation-${item.id}`, destination: "reservations" as const, category: "Reserva", title: `${reservationCode(item)} · ${item.customerName}`, detail: `${item.service} · ${item.date} ${item.time}` })),
      ...payments.filter((item) => includes(item.code, item.customerName, item.productName, item.amount, item.status)).map((item) => ({ id: `payment-${item.id}`, destination: "payments" as const, category: "Pago", title: `${paymentCode(item)} · ${item.customerName}`, detail: `${item.amount} ${item.currency} · ${item.status}` })),
      ...tasks.filter((item) => includes(item.code, item.title, item.description, item.assignedToName, item.reservationCode)).map((item) => ({ id: `task-${item.id}`, destination: "tasks" as const, category: "Tarea", title: `${taskCode(item)} · ${item.title}`, detail: `${item.assignedToName || "Sin asignar"} · ${item.status}` })),
      ...incidents.filter((item) => includes(item.code, item.title, item.description, item.assignedToName, item.reservationCode)).map((item) => ({ id: `incident-${item.id}`, destination: "tasks" as const, category: "Incidencia", title: `${incidentCode(item)} · ${item.title}`, detail: `${item.assignedToName || "Sin asignar"} · ${item.status}` })),
      ...(isAdmin ? expenses.filter((item) => !item.archived && includes(item.code, item.concept, item.supplier, item.project, item.category)).map((item) => ({ id: `expense-${item.id}`, destination: "finance" as const, category: "Gasto", title: `${expenseCode(item)} · ${item.concept}`, detail: `${item.amount} ${item.currency} · ${item.status}` })) : []),
    ].slice(0, 14);
  }, [customers, expenses, incidents, isAdmin, payments, query, reservations, tasks]);
  const choose = (destination: GlobalSearchDestination) => { onNavigate(destination); onClose(); };
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#07151A]/55 p-4 backdrop-blur-sm" onMouseDown={onClose}><motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="mx-auto mt-[10vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/40 bg-card shadow-2xl" role="dialog" aria-modal="true" aria-label="Búsqueda global" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b px-4"><Search className="text-[#1676F3]" size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground" placeholder="Buscar cliente, código, pago, tarea, incidencia o gasto…" /><button className="icon-button" aria-label="Cerrar búsqueda" onClick={onClose}><X size={18} /></button></div><div className="max-h-[60vh] overflow-y-auto">{query.trim() ? results.length ? <div className="divide-y">{results.map((result) => <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50" key={result.id} onClick={() => choose(result.destination)}><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#1676F3]">{result.category}</p><p className="mt-1 truncate font-bold">{result.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{result.detail}</p></div><span className="shrink-0 text-xs font-bold text-muted-foreground">Abrir</span></button>)}</div> : <div className="px-6 py-14 text-center"><p className="font-extrabold">No se encontraron coincidencias</p><p className="mt-1 text-sm text-muted-foreground">Prueba con un código, un nombre, un servicio o una palabra más corta.</p></div> : <div className="px-6 py-14 text-center"><p className="font-extrabold">Búsqueda global</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Localiza rápidamente información operativa. Las finanzas solo aparecen para Administración/IT.</p><p className="mt-4 text-xs font-semibold text-muted-foreground">Atajo: <kbd className="rounded border bg-muted px-1.5 py-0.5">Ctrl</kbd> + <kbd className="rounded border bg-muted px-1.5 py-0.5">K</kbd></p></div>}</div></motion.section></motion.div>}</AnimatePresence>;
}
