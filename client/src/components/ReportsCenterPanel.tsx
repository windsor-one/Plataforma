import { useMemo, useState } from "react";
import { CalendarClock, Download, FileBarChart, Search, Star, StarOff } from "lucide-react";
import { jsPDF } from "jspdf";
import type { Expense, Payment, Reservation } from "@/lib/types";
import { downloadStatement } from "./FinancialStatementsPanel";
import { buildFinanceSummary } from "@/lib/financeReports";

 type ReportKind = "balance" | "income" | "cash" | "full" | "generic";
 type Report = { id: string; name: string; category: string; description: string; kind: ReportKind };

const categories = ["Información general del negocio", "Ventas", "Cuentas por cobrar", "Pagos recibidos", "Cuentas por pagar", "Compras y gastos", "Impuestos", "Banca", "Proyectos y hoja de horas", "Contable", "Moneda", "Actividad", "Automatización"];
const reportRows = [
  ["profit-loss", "Beneficio y pérdida", "Información general del negocio", "Ingresos cobrados, gastos y resultado operativo.", "income"],
  ["cash-flow", "Estado de flujos de efectivo", "Información general del negocio", "Entradas, salidas y flujo neto por moneda.", "cash"],
  ["balance-sheet", "Balance general", "Información general del negocio", "Activos operativos, cuentas por cobrar, compromisos y posición neta.", "balance"],
  ["business-rates", "Tasas de rendimiento empresarial", "Información general del negocio", "Indicadores construidos sobre ingresos, gastos y cartera.", "full"],
  ["capital-movement", "Movimiento de capital", "Información general del negocio", "Cambios operativos de la posición financiera registrada.", "full"],
  ["sales-customer", "Ventas por cliente", "Ventas", "Cobros agrupados por cliente.", "generic"],
  ["sales-item", "Ventas por artículo", "Ventas", "Cobros agrupados por producto o servicio.", "generic"],
  ["sales-vendor", "Ventas por vendedor", "Ventas", "Cobros agrupados por responsable del registro.", "generic"],
  ["sales-summary", "Resumen de ventas", "Ventas", "Resumen de cobros confirmados.", "generic"],
  ["ar-aging-summary", "Resumen de antigüedad de AR", "Cuentas por cobrar", "Cartera pendiente agrupada por reserva y moneda.", "full"],
  ["ar-aging-detail", "Detalles de antigüedad de AR", "Cuentas por cobrar", "Detalle de cuentas, pagos y saldos pendientes.", "generic"],
  ["invoice-detail", "Detalles de la factura", "Cuentas por cobrar", "Reservas que originan saldos y cobros.", "generic"],
  ["customer-balance", "Resumen del saldo del cliente", "Cuentas por cobrar", "Saldo por cliente y reserva.", "generic"],
  ["ar-summary", "Resumen de cuentas por cobrar", "Cuentas por cobrar", "Total por cobrar y total cobrado.", "full"],
  ["ar-detail", "Detalles de cuentas por cobrar", "Cuentas por cobrar", "Detalle de cartera por operación.", "generic"],
  ["payments", "Pagos recibidos", "Pagos recibidos", "Pagos confirmados durante el período.", "generic"],
  ["payment-history", "Historial de reembolsos", "Pagos recibidos", "Pagos y estados registrados para conciliación.", "generic"],
  ["vendor-balance", "Resumen de saldo del proveedor", "Cuentas por pagar", "Compromisos registrados por proveedor.", "generic"],
  ["payable-summary", "Resumen de cuentas por pagar", "Cuentas por pagar", "Gastos pendientes y aprobados.", "generic"],
  ["payable-detail", "Detalles de cuentas por pagar", "Cuentas por pagar", "Detalle de gastos y compromisos.", "generic"],
  ["expense-detail", "Detalles de gastos", "Compras y gastos", "Libro detallado de gastos.", "generic"],
  ["expense-category", "Gastos por categoría", "Compras y gastos", "Gastos agrupados por categoría.", "generic"],
  ["expense-customer", "Gastos por cliente", "Compras y gastos", "Gastos vinculados a reservas y clientes.", "generic"],
  ["expense-project", "Resumen de gastos por proyecto", "Compras y gastos", "Gastos agrupados por proyecto.", "generic"],
  ["tax-summary", "Resumen fiscal", "Impuestos", "Ingresos y gastos disponibles para revisión fiscal.", "full"],
  ["bank-reconciliation", "Estado de reconciliación", "Banca", "Flujo registrado para conciliación bancaria.", "cash"],
  ["account-transactions", "Transacciones de cuentas", "Contable", "Movimientos financieros del período.", "full"],
  ["account-type", "Resumen de tipo de cuenta", "Contable", "Clasificación de movimientos financieros.", "full"],
  ["general-ledger", "Libro mayor", "Contable", "Resumen contable basado en ingresos y gastos registrados.", "full"],
  ["journal", "Informe de diario", "Contable", "Secuencia de movimientos financieros auditables.", "generic"],
  ["trial-balance", "Saldo de prueba", "Contable", "Comprobación operativa de saldos por moneda.", "balance"],
  ["currency-gains", "Ganancias o pérdidas obtenidas", "Moneda", "Resultado registrado por moneda, sin conversión implícita.", "full"],
  ["activity-log", "Registros de actividad", "Actividad", "Actividad financiera disponible en el período.", "generic"],
  ["automation-rules", "Registros de ejecución del flujo de trabajo", "Automatización", "Automatizaciones financieras y sus resultados registrados.", "generic"],
] as const;
const reports: Report[] = reportRows.map(([id, name, category, description, kind]) => ({ id, name, category, description, kind }));

const periodNow = () => new Date().toISOString().slice(0, 7);
const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);
const fileSafe = (value: string) => value.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "");

function genericPdf(report: Report, period: string, payments: Payment[], expenses: Expense[], reservations: Reservation[]) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const rows: string[] = [];
  const periodPayments = payments.filter(item => String(item.paidAt || "").startsWith(period) && item.status === "paid");
  const periodExpenses = expenses.filter(item => !item.archived && String(item.spentAt || "").startsWith(period));
  if (report.category === "Ventas" || report.category === "Pagos recibidos") periodPayments.forEach(item => rows.push(`${item.code || item.id} · ${item.customerName} · ${item.productName || item.kind || "Pago"} · ${money(item.amount, item.currency)}`));
  else if (report.category === "Cuentas por cobrar") reservations.forEach(item => rows.push(`${item.code || item.id} · ${item.customerName} · ${item.service} · ${money(item.totalDue || item.productPrice || 0, item.currency)}`));
  else periodExpenses.forEach(item => rows.push(`${item.code || item.id} · ${item.concept} · ${item.category} · ${money(item.amount, item.currency)} · ${item.status}`));
  document.setFont("helvetica", "bold"); document.setFontSize(16); document.text("SIGES · Centro de Informes", 17, 18); document.setFontSize(13); document.text(report.name, 17, 28); document.setFont("helvetica", "normal"); document.setFontSize(9); document.text(`Categoría: ${report.category} · Período: ${period}`, 17, 35); document.text(`Registros: ${rows.length}`, 17, 41);
  let y = 51; document.setFontSize(9); rows.slice(0, 85).forEach(row => { const wrapped = document.splitTextToSize(row, 176) as string[]; document.text(wrapped, 17, y); y += wrapped.length * 4.5 + 1; if (y > 280) { document.addPage(); y = 20; } });
  if (!rows.length) document.text("No hay registros suficientes para este informe en el período seleccionado.", 17, y);
  document.save(`siges-${fileSafe(report.name)}-${period}.pdf`);
}

export default function ReportsCenterPanel({ payments, expenses, reservations }: { payments: Payment[]; expenses: Expense[]; reservations: Reservation[] }) {
  const [period, setPeriod] = useState(periodNow);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [view, setView] = useState<"all" | "favorites" | "shared" | "scheduled">("all");
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem("siges-report-favorites") || "[]"));
  const [shared, setShared] = useState<string[]>(() => JSON.parse(localStorage.getItem("siges-report-shared") || "[]"));
  const [scheduled, setScheduled] = useState<string[]>(() => JSON.parse(localStorage.getItem("siges-report-scheduled") || "[]"));
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const financeSummary = useMemo(() => buildFinanceSummary(payments, expenses, reservations, { key: period, label: period }), [expenses, payments, period, reservations]);
  const visibleReports = useMemo(() => reports.filter(report => (category === "Todas" || report.category === category) && (!query.trim() || `${report.name} ${report.category} ${report.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && (view === "all" || view === "favorites" && favorites.includes(report.id) || view === "shared" && shared.includes(report.id) || view === "scheduled" && scheduled.includes(report.id))), [category, favorites, query, scheduled, shared, view]);
  const toggle = (bucket: "favorites" | "shared" | "scheduled", id: string) => { const setter = bucket === "favorites" ? setFavorites : bucket === "shared" ? setShared : setScheduled; const current = bucket === "favorites" ? favorites : bucket === "shared" ? shared : scheduled; const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]; setter(next); localStorage.setItem(`siges-report-${bucket}`, JSON.stringify(next)); };
  const download = (report: Report) => { if (report.kind === "balance" || report.kind === "income" || report.kind === "cash" || report.kind === "full") downloadStatement(report.kind, financeSummary); else genericPdf(report, period, payments, expenses, reservations); };
  const previewRows = (report: Report) => report.kind === "balance" ? Object.entries(financeSummary.cashFlow).map(([currency, amount]) => [`Efectivo disponible · ${currency}`, money(amount, currency)]).concat(Object.entries(financeSummary.receivables).map(([currency, value]) => [`Cuentas por cobrar · ${currency}`, money(value.pendingBalance, currency)])) : report.kind === "income" ? [["Ingresos cobrados", Object.entries(financeSummary.income).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"], ["Gastos pagados", Object.entries(financeSummary.paidExpenses).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"], ["Resultado operativo", Object.entries(financeSummary.cashFlow).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"]] : report.kind === "cash" ? [["Entradas", Object.entries(financeSummary.income).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"], ["Salidas", Object.entries(financeSummary.paidExpenses).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"], ["Flujo neto", Object.entries(financeSummary.cashFlow).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0"]] : report.kind === "full" ? [["Balance", "Disponible en el informe integral"], ["Estado de resultados", "Disponible en el informe integral"], ["Cartera", `${Object.values(financeSummary.receivables).reduce((total, value) => total + value.accounts, 0)} cuenta(s)`]] : [["Registros del período", String(payments.filter(item => String(item.paidAt || "").startsWith(period)).length + expenses.filter(item => String(item.spentAt || "").startsWith(period)).length)], ["Reservas relacionadas", String(reservations.filter(item => String(item.date || "").startsWith(period)).length)]];
  return <section className="panel-card mt-7 overflow-hidden"><div className="border-b px-5 py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Finanzas · Informes</p><h2 className="mt-1 text-2xl font-extrabold">Centro de Informes</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Busca, organiza y descarga informes financieros, contables y operativos conectados con SIGES.</p></div><FileBarChart className="text-[#0F8F73]" size={28} /></div><div className="mt-5 flex flex-wrap gap-2"><button className={`secondary-button ${view === "all" ? "border-[#0F8F73] bg-[#0F8F73]/8" : ""}`} onClick={() => setView("all")}>Todos los informes <span className="ml-1 text-xs">{reports.length}</span></button><button className={`secondary-button ${view === "favorites" ? "border-[#0F8F73] bg-[#0F8F73]/8" : ""}`} onClick={() => setView("favorites")}><Star size={15} />Favoritos</button><button className={`secondary-button ${view === "shared" ? "border-[#0F8F73] bg-[#0F8F73]/8" : ""}`} onClick={() => setView("shared")}>Informes compartidos</button><button className={`secondary-button ${view === "scheduled" ? "border-[#0F8F73] bg-[#0F8F73]/8" : ""}`} onClick={() => setView("scheduled")}><CalendarClock size={15} />Informes programados</button></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_150px]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input className="field !mt-0 pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar informes" /></label><select className="field !mt-0" value={category} onChange={event => setCategory(event.target.value)}><option>Todas</option>{categories.map(item => <option key={item}>{item}</option>)}</select><input className="field !mt-0" type="month" value={period} onChange={event => setPeriod(event.target.value)} /></div></div>{selectedReport && <section className="border-b bg-[#0F8F73]/5 px-5 py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Vista previa del informe</p><h3 className="mt-1 text-xl font-extrabold">{selectedReport.name}</h3><p className="mt-1 text-sm text-muted-foreground">{selectedReport.category} · {period}</p></div><div className="flex gap-2"><button className="secondary-button" onClick={() => setSelectedReport(null)}>Cerrar vista</button><button className="primary-button" onClick={() => download(selectedReport)}><Download size={16} />Descargar PDF</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{previewRows(selectedReport).map(([label, value]) => <div className="rounded-xl border bg-card p-4" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-extrabold">{value}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Vista generada dentro de SIGES con los datos disponibles. La descarga PDF es opcional.</p></section>}<div className="divide-y">{visibleReports.map(report => <article className="flex flex-wrap items-center gap-4 px-5 py-4" key={report.id}><div className="min-w-0 flex-1"><p className="font-extrabold">{report.name}</p><p className="mt-1 text-xs text-muted-foreground">{report.category} · Generado por SIGES</p><p className="mt-1 text-sm text-muted-foreground">{report.description}</p></div><div className="flex flex-wrap items-center gap-2"><button className="icon-button" title={favorites.includes(report.id) ? "Quitar de favoritos" : "Añadir a favoritos"} onClick={() => toggle("favorites", report.id)}>{favorites.includes(report.id) ? <Star size={16} className="fill-[#FFC72C] text-[#FFC72C]" /> : <StarOff size={16} />}</button><button className="secondary-button" onClick={() => toggle("shared", report.id)}>{shared.includes(report.id) ? "Compartido" : "Compartir"}</button><button className="secondary-button" onClick={() => toggle("scheduled", report.id)}>{scheduled.includes(report.id) ? "Programado" : "Programar"}</button><button className="secondary-button" onClick={() => setSelectedReport(report)}>Ver informe</button><button className="primary-button" onClick={() => download(report)}><Download size={16} />PDF</button></div></article>)}{!visibleReports.length && <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">No hay informes en esta vista o categoría.</div>}</div><div className="border-t bg-muted/20 px-5 py-4 text-xs leading-5 text-muted-foreground">Los favoritos, compartidos y programados se conservan en este navegador. La generación PDF usa datos reales de pagos, gastos y reservas; no inventa saldos iniciales ni tipos de cambio.</div></section>;
}
