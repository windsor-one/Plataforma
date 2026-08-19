import { balanceRows, buildFinanceSummary, financePeriodKey, inFinancePeriod, type FinanceSummary } from "./financeReports";
import { receivableAccounts } from "./accountsReceivable";
import type { ActivityLog, AttendanceRecord, Automation, Customer, EmploymentContract, Expense, HrDocument, HrProfile, Incident, InternalMessage, LeaveRequest, Payment, PayrollRun, Reservation, Task, UserProfile } from "./types";

export type ReportSection = { heading: string; headers: string[]; rows: string[][] };
export type ReportDefinition = { id: string; name: string; category: string; description: string };
export type ReportSnapshot = {
  customers?: Customer[];
  reservations: Reservation[];
  payments: Payment[];
  expenses: Expense[];
  tasks?: Task[];
  incidents?: Incident[];
  activityLogs?: ActivityLog[];
  employees?: UserProfile[];
  hrProfiles?: HrProfile[];
  employmentContracts?: EmploymentContract[];
  hrDocuments?: HrDocument[];
  attendanceRecords?: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  payrollRuns?: PayrollRun[];
  internalMessages?: InternalMessage[];
  automations?: Automation[];
};
export type BuiltReport = { report: ReportDefinition; period: string; summary: FinanceSummary; sections: ReportSection[]; totalRows: number };

export const reportDefinitions: ReportDefinition[] = [
  ["profit-loss", "Beneficio y pérdida", "Información general del negocio", "Ingresos cobrados, gastos y resultado operativo."],
  ["cash-flow", "Estado de flujos de efectivo", "Información general del negocio", "Entradas, salidas y flujo neto por moneda."],
  ["balance-sheet", "Balance general", "Información general del negocio", "Activos operativos, cuentas por cobrar, compromisos y posición neta."],
  ["business-rates", "Tasas de rendimiento empresarial", "Información general del negocio", "Indicadores construidos sobre ingresos, gastos y cartera."],
  ["capital-movement", "Movimiento de capital", "Información general del negocio", "Cambios operativos de la posición financiera registrada."],
  ["sales-customer", "Ventas por cliente", "Ventas", "Cobros agrupados por cliente."],
  ["sales-item", "Ventas por artículo", "Ventas", "Cobros agrupados por producto o servicio."],
  ["sales-vendor", "Ventas por vendedor", "Ventas", "Cobros agrupados por responsable del registro."],
  ["sales-summary", "Resumen de ventas", "Ventas", "Resumen de cobros confirmados."],
  ["ar-aging-summary", "Resumen de antigüedad de AR", "Cuentas por cobrar", "Cartera pendiente agrupada por reserva y moneda."],
  ["ar-aging-detail", "Detalles de antigüedad de AR", "Cuentas por cobrar", "Detalle de cuentas, pagos y saldos pendientes."],
  ["invoice-detail", "Detalles de la factura", "Cuentas por cobrar", "Reservas que originan saldos y cobros."],
  ["customer-balance", "Resumen del saldo del cliente", "Cuentas por cobrar", "Saldo por cliente y reserva."],
  ["ar-summary", "Resumen de cuentas por cobrar", "Cuentas por cobrar", "Total por cobrar y total cobrado."],
  ["ar-detail", "Detalles de cuentas por cobrar", "Cuentas por cobrar", "Detalle de cartera por operación."],
  ["payments", "Pagos recibidos", "Pagos recibidos", "Todos los pagos registrados durante el período, con su estado."],
  ["payment-history", "Historial de reembolsos", "Pagos recibidos", "Pagos y estados registrados para conciliación."],
  ["vendor-balance", "Resumen de saldo del proveedor", "Cuentas por pagar", "Compromisos registrados por proveedor."],
  ["payable-summary", "Resumen de cuentas por pagar", "Cuentas por pagar", "Gastos pendientes, aprobados y pagados."],
  ["payable-detail", "Detalles de cuentas por pagar", "Cuentas por pagar", "Detalle de gastos y compromisos."],
  ["expense-detail", "Detalles de gastos", "Compras y gastos", "Libro detallado de gastos."],
  ["expense-category", "Gastos por categoría", "Compras y gastos", "Gastos agrupados por categoría."],
  ["expense-customer", "Gastos por cliente", "Compras y gastos", "Gastos vinculados a reservas y clientes."],
  ["expense-project", "Resumen de gastos por proyecto", "Compras y gastos", "Gastos agrupados por proyecto."],
  ["tax-summary", "Resumen fiscal", "Impuestos", "Ingresos y gastos disponibles para revisión fiscal."],
  ["bank-reconciliation", "Estado de reconciliación", "Banca", "Flujo registrado para conciliación bancaria."],
  ["account-transactions", "Transacciones de cuentas", "Contable", "Movimientos financieros del período."],
  ["account-type", "Resumen de tipo de cuenta", "Contable", "Clasificación de movimientos financieros."],
  ["general-ledger", "Libro mayor", "Contable", "Resumen contable basado en ingresos y gastos registrados."],
  ["journal", "Informe de diario", "Contable", "Secuencia de movimientos financieros auditables."],
  ["trial-balance", "Saldo de prueba", "Contable", "Comprobación operativa de saldos por moneda."],
  ["currency-gains", "Ganancias o pérdidas obtenidas", "Moneda", "Resultado registrado por moneda, sin conversión implícita."],
  ["activity-log", "Registros de actividad", "Actividad", "Actividad financiera y operativa disponible en el período."],
  ["automation-rules", "Registros de ejecución del flujo de trabajo", "Automatización", "Automatizaciones financieras y sus resultados registrados."],
  ["payroll", "Planilla de empleados", "Recursos Humanos", "Horas, bruto, deducciones y neto de las planillas registradas."],
  ["hr-files", "Expedientes del personal", "Recursos Humanos", "Expedientes laborales y asignaciones organizacionales."],
  ["attendance", "Asistencia registrada", "Recursos Humanos", "Marcaciones reales de entrada, salida y recesos."],
  ["leaves", "Ausencias y permisos", "Recursos Humanos", "Solicitudes, fechas, días y estados de ausencia."],
  ["contracts", "Contratos laborales", "Recursos Humanos", "Vigencia, modalidad, jornada y salario registrado."],
  ["hr-documents", "Documentos de RR. HH.", "Recursos Humanos", "Documentos, vigencia y estado documental."],
  ["tasks", "Tareas operativas", "Operación", "Tareas reales, prioridad, responsable y estado."],
  ["incidents", "Incidencias operativas", "Operación", "Incidencias reales, prioridad, responsable y resolución."],
  ["internal-mail", "Correo interno", "Comunicación", "Mensajes internos del período y sus estados."],
].map(([id, name, category, description]) => ({ id, name, category, description }));

export const reportCategories = Array.from(new Set(reportDefinitions.map((report) => report.category)));
const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount) || 0);
const label = (value: unknown) => String(value || "—");
const code = (prefix: string, id: string, value?: string) => value || `${prefix}-${id.slice(0, 8).toUpperCase()}`;
const dateText = (value: unknown) => {
  if (!value) return "—";
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate().toLocaleDateString("es-ES");
  if (value instanceof Date) return value.toLocaleDateString("es-ES");
  return String(value).slice(0, 10);
};
const emptyRows = (message: string, width: number): string[][] => [Array.from({ length: Math.max(1, width) }, (_, index) => index === 0 ? message : "—")];
const periodFilter = <T,>(items: T[], getter: (item: T) => unknown, period: string) => items.filter((item) => inFinancePeriod(getter(item), period));
const summaryValue = (values: Record<string, number>) => Object.entries(values).map(([currency, amount]) => money(amount, currency)).join(" · ") || "0";

function table(heading: string, headers: string[], rows: string[][]): ReportSection {
  return { heading, headers, rows: rows.length ? rows : emptyRows("No hay registros reales para este período", headers.length) };
}

function groupedRows(items: Array<{ key: string; currency: string; amount: number }>, firstHeader: string, firstFallback = "Sin clasificar") {
  const totals = new Map<string, { currency: string; amount: number }>();
  items.forEach((item) => { const key = `${item.key || firstFallback}__${item.currency || "USD"}`; const current = totals.get(key) || { currency: item.currency || "USD", amount: 0 }; current.amount += Number(item.amount) || 0; totals.set(key, current); });
  return Array.from(totals.entries()).sort((left, right) => right[1].amount - left[1].amount).map(([key, value]) => [key.split("__")[0], value.currency, money(value.amount, value.currency)]);
}

function financialSections(reportId: string, summary: FinanceSummary, snapshot: ReportSnapshot, period: string, accounts: ReturnType<typeof receivableAccounts>): ReportSection[] {
  const rows = balanceRows(summary);
  const periodPayments = periodFilter(snapshot.payments, (item) => item.paidAt, period);
  const paidPayments = periodPayments.filter((item) => item.status === "paid");
  const periodExpenses = periodFilter(snapshot.expenses.filter((item) => !item.archived), (item) => item.spentAt, period);
  const balance = table("Balance general", ["Concepto", "Valor"], rows.flatMap((row) => [[`Efectivo disponible (${row.currency})`, money(row.cash, row.currency)], [`Cuentas por cobrar (${row.currency})`, money(row.receivable, row.currency)], [`Total activos (${row.currency})`, money(row.assets, row.currency)], [`Compromisos (${row.currency})`, money(row.liabilities, row.currency)], [`Posición neta (${row.currency})`, money(row.netPosition, row.currency)]]));
  const income = table("Estado de resultados", ["Concepto", "Valor"], [["Ingresos cobrados", summaryValue(summary.income)], ["Gastos pagados", summaryValue(summary.paidExpenses)], ["Resultado operativo", summaryValue(summary.cashFlow)], ["Gastos comprometidos", summaryValue(summary.committedExpenses)], ["Resultado proyectado", summaryValue(summary.projectedResult)]]);
  const cash = table("Flujo de caja", ["Concepto", "Valor"], [["Entradas de efectivo", summaryValue(summary.income)], ["Salidas de efectivo", summaryValue(summary.paidExpenses)], ["Flujo neto", summaryValue(summary.cashFlow)], ["Pagos pagados", String(paidPayments.length)], ["Gastos registrados", String(periodExpenses.length)]]);
  const paymentDetail = table("Pagos registrados en el período", ["Código · Fecha", "Cliente", "Concepto", "Estado", "Importe"], periodPayments.map((item) => [code("PAG", item.id, item.code) + ` · ${dateText(item.paidAt)}`, item.customerName, item.productName || item.kind || "Pago operativo", label(item.status), money(item.amount, item.currency)]));
  const expenseDetail = table("Gastos registrados en el período", ["Código · Fecha", "Concepto", "Categoría", "Estado", "Importe"], periodExpenses.map((item) => [code("GAS", item.id, item.code) + ` · ${dateText(item.spentAt)}`, item.concept, item.category, item.status, money(item.amount, item.currency)]));
  const receivable = table("Cartera y cuentas por cobrar", ["Reserva", "Cliente", "Valor", "Abonado", "Saldo", "Cuotas"], accounts.map((account) => [code("RES", account.reservation.id, account.reservation.code), account.reservation.customerName, money(account.totalDue, account.currency), money(account.paidTotal, account.currency), money(account.pendingBalance, account.currency), String(account.installmentCount)]));
  if (reportId === "balance-sheet" || reportId === "trial-balance") return [balance, receivable];
  if (reportId === "profit-loss") return [income, paymentDetail, expenseDetail];
  if (reportId === "cash-flow" || reportId === "bank-reconciliation") return [cash, paymentDetail, expenseDetail];
  if (reportId === "tax-summary") return [table("Resumen fiscal operativo", ["Concepto", "Valor"], [["Ingresos cobrados", summaryValue(summary.income)], ["Gastos pagados", summaryValue(summary.paidExpenses)], ["Resultado operativo", summaryValue(summary.cashFlow)], ["Nota", "SIGES no registra tasas ni declaraciones fiscales"]]), paymentDetail, expenseDetail];
  if (reportId === "business-rates") return [table("Indicadores del período", ["Indicador", "Valor"], [["Ingresos cobrados", summaryValue(summary.income)], ["Gastos pagados", summaryValue(summary.paidExpenses)], ["Resultado operativo", summaryValue(summary.cashFlow)], ["Pagos registrados", String(periodPayments.length)], ["Cuentas con saldo", String(accounts.filter((item) => item.pendingBalance > 0).length)]])];
  if (reportId === "capital-movement") return [paymentDetail, expenseDetail, balance];
  return [balance, income, cash, paymentDetail, expenseDetail, receivable];
}

export function buildReport(reportId: string, period: string, snapshot: ReportSnapshot): BuiltReport {
  const report = reportDefinitions.find((item) => item.id === reportId) || reportDefinitions[0];
  const summary = buildFinanceSummary(snapshot.payments, snapshot.expenses, snapshot.reservations, { key: period, label: period });
  const periodPayments = periodFilter(snapshot.payments, (item) => item.paidAt, period);
  const paidPayments = periodPayments.filter((item) => item.status === "paid");
  const periodExpenses = periodFilter(snapshot.expenses.filter((item) => !item.archived), (item) => item.spentAt, period);
  const cutoffPayments = snapshot.payments.filter((item) => { const key = financePeriodKey(item.paidAt); return Boolean(key) && key <= period; });
  const accounts = receivableAccounts(snapshot.reservations, cutoffPayments);
  let sections: ReportSection[];
  switch (reportId) {
    case "sales-customer": sections = [table("Ventas por cliente", ["Cliente", "Moneda", "Cobrado"], groupedRows(paidPayments.map((item) => ({ key: item.customerName, currency: item.currency, amount: item.amount })), "Cliente"))]; break;
    case "sales-item": sections = [table("Ventas por artículo", ["Artículo", "Moneda", "Cobrado"], groupedRows(paidPayments.map((item) => ({ key: item.productName || item.kind || "Pago operativo", currency: item.currency, amount: item.amount })), "Artículo"))]; break;
    case "sales-vendor": sections = [table("Ventas por responsable", ["Responsable", "Moneda", "Cobrado"], groupedRows(paidPayments.map((item) => ({ key: item.createdByName || "Sin responsable", currency: item.currency, amount: item.amount })), "Responsable"))]; break;
    case "sales-summary": sections = [table("Resumen de ventas", ["Código · Fecha", "Cliente", "Concepto", "Importe"], paidPayments.map((item) => [code("PAG", item.id, item.code) + ` · ${dateText(item.paidAt)}`, item.customerName, item.productName || item.kind || "Pago operativo", money(item.amount, item.currency)]))]; break;
    case "payments":
    case "payment-history": sections = [table("Pagos del período", ["Código · Fecha", "Cliente", "Concepto", "Estado", "Método", "Importe"], periodPayments.map((item) => [code("PAG", item.id, item.code) + ` · ${dateText(item.paidAt)}`, item.customerName, item.productName || item.kind || "Pago operativo", label(item.status), label(item.method), money(item.amount, item.currency)]))]; break;
    case "ar-aging-summary": sections = [table("Antigüedad de cuentas por cobrar", ["Reserva", "Cliente", "Moneda", "Saldo", "Cuotas"], accounts.map((item) => [code("RES", item.reservation.id, item.reservation.code), item.reservation.customerName, item.currency, money(item.pendingBalance, item.currency), String(item.installmentCount)]))]; break;
    case "ar-aging-detail":
    case "ar-detail": sections = [table("Detalle de cuentas por cobrar", ["Reserva · Fecha", "Cliente", "Total", "Abonado", "Saldo", "Cuotas"], accounts.map((item) => [code("RES", item.reservation.id, item.reservation.code) + ` · ${dateText(item.reservation.date)}`, item.reservation.customerName, money(item.totalDue, item.currency), money(item.paidTotal, item.currency), money(item.pendingBalance, item.currency), String(item.installmentCount)]))]; break;
    case "invoice-detail": sections = [table("Reservas y facturación operativa", ["Reserva · Fecha", "Cliente", "Servicio", "Total", "Estado"], snapshot.reservations.filter((item) => inFinancePeriod(item.date, period)).map((item) => [code("RES", item.id, item.code) + ` · ${dateText(item.date)}`, item.customerName, item.service, money(item.totalDue || item.productPrice || 0, item.currency), item.status]))]; break;
    case "customer-balance": sections = [table("Saldo por cliente", ["Cliente", "Reserva", "Total", "Abonado", "Saldo"], accounts.map((item) => [item.reservation.customerName, code("RES", item.reservation.id, item.reservation.code), money(item.totalDue, item.currency), money(item.paidTotal, item.currency), money(item.pendingBalance, item.currency)]))]; break;
    case "ar-summary": sections = [table("Resumen de cuentas por cobrar", ["Moneda", "Valor total", "Abonado", "Pendiente", "Cuentas abiertas"], Object.entries(summary.receivables).map(([currency, item]) => [currency, money(item.totalDue, currency), money(item.paidTotal, currency), money(item.pendingBalance, currency), String(item.accounts)]))]; break;
    case "vendor-balance": sections = [table("Saldo por proveedor", ["Proveedor", "Moneda", "Compromiso"], groupedRows(periodExpenses.map((item) => ({ key: item.supplier || "Sin proveedor", currency: item.currency, amount: item.amount })), "Proveedor"))]; break;
    case "payable-summary": sections = [table("Resumen de cuentas por pagar", ["Estado", "Moneda", "Importe"], groupedRows(periodExpenses.map((item) => ({ key: item.status, currency: item.currency, amount: item.amount })), "Estado"))]; break;
    case "payable-detail":
    case "expense-detail": sections = [table("Detalle de gastos", ["Código · Fecha", "Concepto", "Categoría", "Proveedor", "Estado", "Importe"], periodExpenses.map((item) => [code("GAS", item.id, item.code) + ` · ${dateText(item.spentAt)}`, item.concept, item.category, item.supplier || "—", item.status, money(item.amount, item.currency)]))]; break;
    case "expense-category": sections = [table("Gastos por categoría", ["Categoría", "Moneda", "Importe"], groupedRows(periodExpenses.map((item) => ({ key: item.category, currency: item.currency, amount: item.amount })), "Categoría"))]; break;
    case "expense-customer": sections = [table("Gastos por cliente", ["Cliente o reserva", "Moneda", "Importe"], groupedRows(periodExpenses.map((item) => ({ key: item.reservationCode || item.project || "Sin cliente vinculado", currency: item.currency, amount: item.amount })), "Cliente"))]; break;
    case "expense-project": sections = [table("Gastos por proyecto", ["Proyecto", "Moneda", "Importe"], groupedRows(periodExpenses.map((item) => ({ key: item.project || "Sin proyecto", currency: item.currency, amount: item.amount })), "Proyecto"))]; break;
    case "account-transactions": sections = [table("Transacciones financieras", ["Fecha", "Tipo", "Referencia", "Estado", "Moneda", "Importe"], [...periodPayments.map((item) => [dateText(item.paidAt), "Ingreso", code("PAG", item.id, item.code), item.status, item.currency, money(item.amount, item.currency)]), ...periodExpenses.map((item) => [dateText(item.spentAt), "Gasto", code("GAS", item.id, item.code), item.status, item.currency, money(item.amount, item.currency)])])]; break;
    case "account-type": sections = [table("Movimientos por tipo de cuenta", ["Tipo", "Moneda", "Importe"], groupedRows([...periodPayments.map((item) => ({ key: "Ingresos", currency: item.currency, amount: item.amount })), ...periodExpenses.map((item) => ({ key: "Gastos", currency: item.currency, amount: item.amount }))], "Tipo"))]; break;
    case "general-ledger": sections = [table("Libro mayor operativo", ["Cuenta / categoría", "Moneda", "Importe"], groupedRows([...paidPayments.map((item) => ({ key: item.productName || "Ingresos", currency: item.currency, amount: item.amount })), ...periodExpenses.map((item) => ({ key: item.category, currency: item.currency, amount: -item.amount }))], "Cuenta"))]; break;
    case "journal": sections = [table("Diario de movimientos", ["Fecha", "Entidad", "Acción", "Detalle", "Responsable"], (snapshot.activityLogs || []).filter((item) => inFinancePeriod(item.occurredAt, period)).map((item) => [dateText(item.occurredAt), item.entity, item.action, item.summary, item.actorName]))]; break;
    case "currency-gains": sections = [table("Resultado por moneda", ["Moneda", "Ingresos", "Gastos", "Resultado"], Array.from(new Set([...Object.keys(summary.income), ...Object.keys(summary.paidExpenses)])).sort().map((currency) => [currency, money(summary.income[currency] || 0, currency), money(summary.paidExpenses[currency] || 0, currency), money((summary.cashFlow[currency] || 0), currency)]))]; break;
    case "activity-log": sections = [table("Actividad registrada", ["Fecha", "Entidad", "Acción", "Detalle", "Responsable"], (snapshot.activityLogs || []).filter((item) => inFinancePeriod(item.occurredAt, period)).map((item) => [dateText(item.occurredAt), item.entity, item.action, item.summary, item.actorName]))]; break;
    case "automation-rules": sections = [table("Automatizaciones configuradas", ["Nombre", "Disparador", "Acción", "Estado", "Ejecuciones"], (snapshot.automations || []).filter((item) => !item.createdAt || financePeriodKey(item.createdAt) <= period).map((item) => [item.name, item.trigger, item.action, item.status, String(item.runCount || 0)]))]; break;
    case "payroll": sections = [table("Planilla del período", ["Período", "Estado", "Moneda", "Bruto", "Deducciones", "Neto"], (snapshot.payrollRuns || []).filter((item) => item.periodKey === period).map((item) => [item.periodKey, item.status, item.currency, money(item.totalGross, item.currency), money(item.totalDeductions, item.currency), money(item.totalNet, item.currency)]))]; break;
    case "hr-files": sections = [table("Expedientes laborales", ["Empleado", "Cargo", "Departamento", "Área", "Equipo", "Modalidad"], (snapshot.hrProfiles || []).map((item) => [snapshot.employees?.find((employee) => employee.id === item.employeeId)?.displayName || item.employeeId, item.position || "—", item.department || "—", item.area || "—", item.team || "—", item.workMode || "—"]))]; break;
    case "attendance": sections = [table("Asistencia registrada", ["Fecha", "Empleado", "Evento", "Origen", "Nota"], (snapshot.attendanceRecords || []).filter((item) => inFinancePeriod(item.dayKey || item.occurredAt, period)).map((item) => [dateText(item.dayKey || item.occurredAt), item.employeeName, item.type, item.source, item.note || "—"]))]; break;
    case "leaves": sections = [table("Ausencias y permisos", ["Inicio", "Fin", "Empleado", "Tipo", "Días", "Estado"], (snapshot.leaveRequests || []).filter((item) => inFinancePeriod(item.startDate, period) || inFinancePeriod(item.endDate, period)).map((item) => [item.startDate, item.endDate, item.employeeName, item.type, String(item.days), item.status]))]; break;
    case "contracts": sections = [table("Contratos laborales", ["Empleado", "Tipo", "Estado", "Inicio", "Fin", "Modalidad"], (snapshot.employmentContracts || []).map((item) => [item.employeeName, item.contractType, item.status, item.startDate, item.endDate || "—", item.workMode || "—"]))]; break;
    case "hr-documents": sections = [table("Documentos de RR. HH.", ["Empleado", "Documento", "Tipo", "Estado", "Emisión", "Vencimiento"], (snapshot.hrDocuments || []).map((item) => [item.employeeName, item.name, item.type, item.status, item.issuedAt || "—", item.expiresAt || "—"]))]; break;
    case "tasks": sections = [table("Tareas operativas", ["Código", "Título", "Prioridad", "Estado", "Responsable", "Vencimiento"], (snapshot.tasks || []).filter((item) => !item.archived && (!item.dueDate || inFinancePeriod(item.dueDate, period))).map((item) => [code("TAR", item.id, item.code), item.title, item.priority, item.status, item.assignedToName || "—", item.dueDate || "—"]))]; break;
    case "incidents": sections = [table("Incidencias operativas", ["Código", "Título", "Prioridad", "Estado", "Responsable", "Resolución"], (snapshot.incidents || []).filter((item) => !item.archived && (!item.resolvedAt || inFinancePeriod(item.resolvedAt, period))).map((item) => [code("INC", item.id, item.code), item.title, item.priority, item.status, item.assignedToName || "—", dateText(item.resolvedAt)]))]; break;
    case "internal-mail": sections = [table("Correo interno", ["Fecha", "Asunto", "Emisor", "Estado", "Destinatarios"], (snapshot.internalMessages || []).filter((item) => inFinancePeriod(item.createdAt, period)).map((item) => [dateText(item.createdAt), item.subject, item.senderName, item.status, String(item.recipientIds.length)]))]; break;
    default: sections = financialSections(reportId, summary, snapshot, period, accounts); break;
  }
  return { report, period, summary, sections, totalRows: sections.reduce((total, section) => total + section.rows.length, 0) };
}
