import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { completeUpdateRequest, deleteUpdateRequest, saveUpdateRequest, updateUpdateRequest } from "@/lib/firestore";
import type { AccessLog, ActivityLog, Automation, AttendanceRecord, CarbonUsage, Customer, EmploymentContract, Expense, GeneralReminder, HrDocument, HrGoal, HrPolicy, HrProfile, Incident, InternalMessage, LeaveRequest, OrganizationUnit, Payment, PerformanceReview, Product, ProductCategorySetting, Reservation, Task, TrainingRecord, UpdateRequest, UpdateRequestAction, UpdateRequestModule, UserProfile, WorkSchedule } from "@/lib/types";
import { normalizeUpdateRequest } from "@/lib/updateRequests";
import { businessDateTimeInput } from "@/lib/businessDate";
import { requestModuleFieldOptions, requestSubmodules } from "@/lib/requestTargets";

const moduleLabels: Record<UpdateRequestModule, string> = {
  profile: "Información personal", hr: "Recursos Humanos", products: "Productos y paquetes", tasks: "Tareas", reservations: "Reservas", customers: "Clientes", payments: "Pagos", employees: "Personal", calendar: "Calendario", mail: "Correo interno", updates: "Actualizaciones", automations: "Automatizaciones", hr_reports: "Reportes de RR. HH.", performance: "Rendimiento", impact: "Impacto digital", finance: "Finanzas", payroll: "Planilla", history: "Historial", operations: "Operación", access: "Seguridad y actividad", pending: "Pendientes", reminders: "Notificaciones", other: "Otro módulo",
};

const scopeLabels: Record<UpdateRequest["scope"], string> = { self: "Información propia", record: "Registro específico", module: "Módulo asignado" };
const actionLabels: Record<UpdateRequestAction, string> = { edit: "Editar", delete: "Eliminar" };
const dateText = (value: string) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin fecha";
const inputDateTime = (value?: string) => businessDateTimeInput(value);
const firstSubmodule = (module: UpdateRequestModule) => requestSubmodules[module]?.[0]?.id || "";
const fullCustomerName = (customer: Customer) => `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName || customer.email || "Cliente";
const safeId = (value: string | undefined, fallback: string) => value?.trim() || fallback;

interface RequestTargetOption { id: string; label: string; detail?: string; }

interface UpdateRequestsPanelProps {
  requests: UpdateRequest[];
  employees: UserProfile[];
  profile: UserProfile;
  isAdmin: boolean;
  onNavigate: (section: Exclude<UpdateRequestModule, "other">) => void;
  customers: Customer[];
  reservations: Reservation[];
  payments: Payment[];
  products: Product[];
  productCategorySettings: ProductCategorySetting[];
  tasks: Task[];
  incidents: Incident[];
  expenses: Expense[];
  profiles: HrProfile[];
  units: OrganizationUnit[];
  contracts: EmploymentContract[];
  documents: HrDocument[];
  schedules: WorkSchedule[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  goals: HrGoal[];
  reviews: PerformanceReview[];
  training: TrainingRecord[];
  policies: HrPolicy[];
  messages: InternalMessage[];
  automations: Automation[];
  activityLogs: ActivityLog[];
  accessLogs: AccessLog[];
  carbonUsage: CarbonUsage[];
  reminders: GeneralReminder[];
}

export default function UpdateRequestsPanel({ requests, employees, profile, isAdmin, onNavigate, customers, reservations, payments, products, productCategorySettings, tasks, incidents, expenses, profiles, units, contracts, documents, schedules, attendance, leaves, goals, reviews, training, policies, messages, automations, activityLogs, accessLogs, carbonUsage, reminders }: UpdateRequestsPanelProps) {
  const [editing, setEditing] = useState<UpdateRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formModule, setFormModule] = useState<UpdateRequestModule>("hr");
  const [formSubmodule, setFormSubmodule] = useState("records");
  const [formScope, setFormScope] = useState<UpdateRequest["scope"]>("record");
  const [targetId, setTargetId] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const visible = useMemo(() => (Array.isArray(requests) ? requests : []).map((item) => normalizeUpdateRequest(item, item?.id)).filter((item) => item.status !== "expired" || isAdmin), [requests, isAdmin]);
  const formOpen = creating || Boolean(editing);
  const submodules = requestSubmodules[formModule] || [];
  const currentSubmodule = submodules.find((item) => item.id === formSubmodule) || submodules[0];
  const fieldOptions = currentSubmodule?.fields || requestModuleFieldOptions(formModule, formSubmodule);
  const selectedTarget = useMemo(() => {
    const options = getTargetOptions(formModule, formSubmodule);
    return options.find((item) => item.id === targetId);
  }, [formModule, formSubmodule, targetId]);

  function getTargetOptions(module: UpdateRequestModule, submodule: string): RequestTargetOption[] {
    const option = (id: string, label: string, detail?: string): RequestTargetOption => ({ id, label, detail });
    if (module === "products") return submodule === "categories" ? productCategorySettings.map((item) => option(item.id, item.label, "Categoría global")) : products.map((item) => option(item.id, item.name, `${item.price} ${item.unit}`));
    if (module === "customers") return customers.map((item) => option(item.id, fullCustomerName(item), `${item.code || "Sin código"} · ${item.email || "Sin correo"}`));
    if (module === "reservations" || (module === "calendar" && submodule === "calendar")) return reservations.map((item) => option(item.id, item.code || `Reserva ${item.customerName}`, `${item.customerName} · ${item.date} ${item.time}`));
    if (module === "payments") return payments.map((item) => option(item.id, item.code || `Pago ${item.customerName}`, `${item.customerName} · ${item.amount} ${item.currency} · ${item.status}`));
    if (module === "tasks" || (module === "operations" && submodule === "tasks")) return tasks.map((item) => option(item.id, item.code || item.title, `${item.title} · ${item.status}`));
    if (module === "operations" && submodule === "reservations") return reservations.map((item) => option(item.id, item.code || `Reserva ${item.customerName}`, `${item.customerName} · ${item.date}`));
    if (module === "operations" && submodule === "tasks") return tasks.map((item) => option(item.id, item.code || item.title, `${item.title} · ${item.status}`));
    if (module === "operations" && submodule === "incidents") return incidents.map((item) => option(item.id, item.code || item.title, `${item.title} · ${item.status}`));
    if (module === "employees" || module === "profile") return employees.map((item) => option(item.id, item.displayName, `${item.email} · ${item.role}`));
    if (module === "hr") {
      if (submodule === "records") return profiles.map((item) => { const employee = employees.find((person) => person.id === item.employeeId); return option(item.id, employee?.displayName || item.employeeCode || item.employeeId, `${item.employeeCode || "Sin código"} · ${item.position || "Sin cargo"}`); });
      if (submodule === "organization") return units.map((item) => option(item.id, item.name, `${item.kind} · ${item.parentName || "Sin superior"}`));
      if (submodule === "contracts") return contracts.map((item) => option(item.id, item.employeeName, `${item.contractType} · ${item.status}`));
      if (submodule === "documents") return documents.map((item) => option(item.id, item.name, `${item.employeeName} · ${item.status}`));
      if (submodule === "schedules") return schedules.map((item) => option(item.id, item.name, item.workMode || "Modalidad no indicada"));
      if (submodule === "attendance") return attendance.map((item) => option(item.id, item.employeeName, `${item.dayKey || "Fecha pendiente"} · ${item.type}`));
      if (submodule === "leaves") return leaves.map((item) => option(item.id, item.employeeName, `${item.startDate} — ${item.endDate} · ${item.status}`));
      if (submodule === "development") return goals.map((item) => option(item.id, item.title, `${item.employeeName} · ${item.progress}%`));
      if (submodule === "policies") return policies.map((item) => option(item.id, item.title, `v${item.version} · ${item.active ? "Activa" : "Inactiva"}`));
    }
    if (module === "mail") return messages.map((item) => option(item.id, item.subject, `${item.senderName} · ${item.status}`));
    if (module === "updates") return visible.map((item) => option(item.id, `${moduleLabels[item.module]} · ${item.targetUserName}`, `${item.status} · ${item.targetRecordLabel || "Sin registro"}`));
    if (module === "automations") return automations.map((item) => option(item.id, item.name, `${item.trigger} · ${item.status}`));
    if (module === "performance") return reviews.map((item) => option(item.id, `${item.employeeName} · ${item.period}`, `${item.score ?? "Sin puntuación"} · ${item.status}`));
    if (module === "impact") return carbonUsage.map((item) => option(item.id, item.displayName || "Uso digital", `${item.departmentName || "Sin departamento"} · ${item.pageViews || 0} vistas · ${item.operationCount || 0} operaciones`));
    if (module === "finance") return submodule === "expenses" ? expenses.map((item) => option(item.id, item.code || item.concept, `${item.amount} ${item.currency} · ${item.status}`)) : payments.map((item) => option(item.id, item.code || `Pago ${item.customerName}`, `${item.amount} ${item.currency} · ${item.status}`));
    if (module === "history") return activityLogs.map((item) => option(item.id, item.summary, `${item.entity} · ${item.action}`));
    if (module === "access") return accessLogs.map((item) => option(item.id, item.summary || item.event, `${item.displayName || item.email || item.userId} · ${item.event}`));
    if (module === "reminders") return reminders.map((item) => option(item.id, item.title, `${item.priority} · ${item.active ? "Activo" : "Inactivo"}`));
    return [];
  }

  const openCreate = () => { setEditing(null); setCreating(true); setFormModule("hr"); setFormSubmodule("records"); setFormScope("record"); setTargetId(""); setSelectedFields(requestSubmodules.hr[0].fields.map((item) => item.id)); };
  const openEdit = (request: UpdateRequest) => {
    const normalized = normalizeUpdateRequest(request, request.id);
    const submodule = normalized.submodule || firstSubmodule(normalized.module);
    const options = requestModuleFieldOptions(normalized.module, submodule);
    setCreating(false); setEditing(normalized); setFormModule(normalized.module); setFormSubmodule(submodule); setFormScope(normalized.scope); setTargetId(normalized.targetRecordId || ""); setSelectedFields(options.filter((item) => normalized.fields.includes(item.id) || normalized.fields.includes(item.label)).map((item) => item.id));
  };
  const closeForm = () => { setEditing(null); setCreating(false); };

  const handleModuleChange = (module: UpdateRequestModule) => { const nextSubmodule = firstSubmodule(module); setFormModule(module); setFormSubmodule(nextSubmodule); setTargetId(""); setSelectedFields(requestModuleFieldOptions(module, nextSubmodule).map((item) => item.id)); };
  const handleSubmoduleChange = (submodule: string) => { setFormSubmodule(submodule); setTargetId(""); setSelectedFields(requestModuleFieldOptions(formModule, submodule).map((item) => item.id)); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = employees.find((item) => item.id === form.get("targetUserId"));
    const allowedActions = (["edit", "delete"] as UpdateRequestAction[]).filter((action) => form.get(`action-${action}`) === "on");
    const deadlineValue = String(form.get("deadline") || "");
    const module = String(form.get("module") || formModule) as UpdateRequestModule;
    const scope = String(form.get("scope") || formScope) as UpdateRequest["scope"];
    const submodule = String(form.get("submodule") || formSubmodule);
    const definition = (requestSubmodules[module] || []).find((item) => item.id === submodule) || requestSubmodules[module]?.[0];
    const targetRecordId = scope === "record" ? String(form.get("targetRecordId") || "").trim() || undefined : undefined;
    const selectedLabels = (definition?.fields || []).filter((item) => selectedFields.includes(item.id)).map((item) => item.label);
    const additionalFields = String(form.get("otherFields") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const fields = Array.from(new Set([...selectedLabels, ...additionalFields]));
    if (!target) { toast.error("Selecciona a la persona responsable."); return; }
    if (!(requestSubmodules[module] || []).length) { toast.error("Selecciona un módulo válido."); return; }
    if (!deadlineValue || Number.isNaN(new Date(deadlineValue).getTime())) { toast.error("Indica una fecha y hora límite válidas."); return; }
    if (new Date(deadlineValue).getTime() <= Date.now()) { toast.error("La fecha límite debe estar en el futuro."); return; }
    if (!allowedActions.length) { toast.error("Autoriza al menos una acción temporal."); return; }
    if (scope === "record" && !targetRecordId) { toast.error("Selecciona el registro específico autorizado."); return; }
    if (!fields.length) { toast.error("Selecciona al menos un campo o resultado esperado."); return; }
    const record: Omit<UpdateRequest, "id" | "createdAt" | "updatedAt" | "assignedBy" | "assignedByName" | "expiresAt"> = {
      targetUserId: target.id,
      targetUserName: target.displayName,
      module,
      scope,
      targetRecordId,
      targetRecordLabel: scope === "record" ? (String(form.get("targetRecordLabel") || "").trim() || selectedTarget?.label || undefined) : undefined,
      submodule: definition?.label || submodule,
      targetCollection: definition?.collection,
      allowedActions,
      fields,
      instructions: String(form.get("instructions") || "").trim() || undefined,
      deadline: new Date(deadlineValue).toISOString(),
      status: (editing ? String(form.get("status")) : "pending") as UpdateRequest["status"],
      decisionReason: String(form.get("decisionReason") || "").trim() || undefined,
      completedAt: editing?.completedAt,
    };
    setSaving(true);
    try {
      if (editing) {
        const result = await updateUpdateRequest(editing.id, record, profile.id);
        toast.success(result.notificationSaved ? "Solicitud actualizada y notificada." : "Solicitud actualizada; la notificación no pudo registrarse.");
      } else {
        const result = await saveUpdateRequest(record, profile.id);
        toast.success(result.notificationSaved ? "Solicitud asignada con permiso temporal y correo interno." : "Solicitud y permiso temporal guardados; la notificación no pudo registrarse.");
      }
      closeForm();
    } catch (error) {
      console.error("No se pudo guardar la solicitud o su permiso temporal", error);
      const code = String((error as { code?: string })?.code || "");
      toast.error(code.includes("permission-denied") ? "Firebase rechazó este permiso. Verifica el rol de Administración o IT y las reglas publicadas." : "No se pudo guardar la solicitud. Revisa la conexión e inténtalo de nuevo.");
    } finally { setSaving(false); }
  };

  const complete = async (request: UpdateRequest) => { try { await completeUpdateRequest(request.id, profile.id); toast.success("Solicitud marcada como completada."); } catch { toast.error("No se pudo cerrar la solicitud."); } };
  const remove = async (request: UpdateRequest) => { if (!window.confirm(`¿Eliminar la solicitud para ${request.targetUserName}? También se revocará el permiso temporal.`)) return; try { await deleteUpdateRequest(request.id, profile.id); toast.success("Solicitud y permiso temporal eliminados."); } catch { toast.error("No se pudo eliminar la solicitud."); } };
  const navigateTarget = (request: UpdateRequest) => { if (request.module !== "other") onNavigate(request.module); };
  const targetOptions = getTargetOptions(formModule, formSubmodule);

  return <>
    <div className="page-title"><div><p className="eyebrow">Coordinación administrativa</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Solicitudes y permisos temporales</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Cada solicitud autoriza únicamente la acción, módulo, submódulo, registro y campos indicados hasta la fecha y hora límite. Administración e IT pueden editar, rechazar, cancelar o eliminar cualquier solicitud.</p></div>{isAdmin && <button className="primary-button" onClick={openCreate}><Plus size={16} />Nueva solicitud</button>}</div>
    {formOpen && isAdmin && <form key={editing?.id || "new-request"} className="panel-card mt-7 grid gap-4 p-5 md:grid-cols-2" onSubmit={submit}>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3"><div><p className="font-extrabold">{editing ? "Editar solicitud" : "Nueva solicitud"}</p><p className="mt-1 text-xs text-muted-foreground">Flujo guiado: persona → módulo → submódulo → registro → campos → acciones → vencimiento.</p></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Cerrar formulario"><XCircle size={18} /></button></div>
      <label>Personal<select className="field" name="targetUserId" required defaultValue={editing?.targetUserId || ""}><option value="">Selecciona persona</option>{employees.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>)}</select></label>
      <label>Módulo<select className="field" name="module" value={formModule} onChange={(event) => handleModuleChange(event.target.value as UpdateRequestModule)}>{Object.entries(moduleLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>Área o submódulo<select className="field" name="submodule" value={formSubmodule} onChange={(event) => handleSubmoduleChange(event.target.value)}>{submodules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="mt-1 block text-xs text-muted-foreground">{currentSubmodule?.description || "Selecciona el área funcional."}</span></label>
      <label>Alcance<select className="field" name="scope" value={formScope} onChange={(event) => { setFormScope(event.target.value as UpdateRequest["scope"]); if (event.target.value !== "record") setTargetId(""); }}><option value="self">Información propia</option><option value="record">Registro específico</option><option value="module">Módulo asignado</option></select></label>
      {formScope === "record" && <label className="md:col-span-2">Registro específico {targetOptions.length > 0 ? <select className="field" name="targetRecordId" value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Selecciona un registro real del sistema</option>{targetOptions.map((item) => <option key={item.id} value={item.id}>{item.label}{item.detail ? ` · ${item.detail}` : ""}</option>)}</select> : <input className="field" name="targetRecordId" value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="ID del registro en Firestore" required />}<span className="mt-1 block text-xs text-muted-foreground">{targetOptions.length ? `${targetOptions.length} registros disponibles; el identificador se guardará automáticamente.` : "No hay registros cargados para este submódulo. Puedes indicar un ID real y validarlo en las indicaciones."}</span>{targetOptions.length > 0 ? <input type="hidden" name="targetRecordLabel" value={selectedTarget?.label || ""} /> : <input className="field mt-2" name="targetRecordLabel" defaultValue={editing?.targetRecordLabel} placeholder="Nombre o referencia del registro" />}</label>}
      <label>Fecha y hora límite<input className="field" name="deadline" type="datetime-local" required defaultValue={inputDateTime(editing?.deadline)} /></label>
      <fieldset className="md:col-span-2 rounded-xl border bg-muted/20 p-4"><legend className="px-1 text-sm font-bold">Campos autorizados en {currentSubmodule?.label || "el submódulo"}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fieldOptions.map((field) => <label className="flex items-center gap-2 text-sm font-semibold" key={field.id}><input type="checkbox" checked={selectedFields.includes(field.id)} onChange={() => setSelectedFields((current) => current.includes(field.id) ? current.filter((item) => item !== field.id) : [...current, field.id])} />{field.label}</label>)}</div><input className="field mt-3" name="otherFields" defaultValue={(Array.isArray(editing?.fields) ? editing.fields : []).filter((field) => !fieldOptions.some((item) => item.label === field || item.id === field)).join(", ")} placeholder="Otro campo o resultado específico (separa por comas)" /></fieldset>
      <fieldset className="md:col-span-2 rounded-xl border bg-muted/20 p-4"><legend className="px-1 text-sm font-bold">Acciones permitidas temporalmente</legend><div className="mt-2 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-semibold"><input name="action-edit" type="checkbox" defaultChecked={editing ? editing.allowedActions.includes("edit") : true} />Editar</label><label className="flex items-center gap-2 text-sm font-semibold"><input name="action-delete" type="checkbox" defaultChecked={editing?.allowedActions.includes("delete")} />Eliminar</label></div></fieldset>
      {editing && <label>Estado<select className="field" name="status" defaultValue={editing.status}><option value="pending">Pendiente y vigente</option><option value="cancelled">Cancelada</option><option value="rejected">Rechazada</option><option value="completed">Completada</option></select></label>}
      <label className="md:col-span-2">Indicaciones<textarea className="field min-h-24" name="instructions" defaultValue={editing?.instructions} placeholder="Describe qué debe actualizarse, la validación esperada y cualquier restricción adicional." /></label>
      {editing && <label className="md:col-span-2">Motivo de cambio, rechazo o cancelación<textarea className="field min-h-20" name="decisionReason" defaultValue={editing.decisionReason} placeholder="El empleado recibirá este motivo por correo interno." /></label>}
      <button className="primary-button w-fit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Asignar solicitud"}<ClipboardList size={16} /></button>
    </form>}
    <section className="panel-card mt-7 overflow-hidden"><div className="divide-y">{visible.length ? visible.map((request) => <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><button className="min-w-0 flex-1 text-left" onClick={() => navigateTarget(request)}><p className="font-extrabold">{moduleLabels[request.module]} · {request.submodule || "Área general"} · {request.targetUserName}</p><p className="mt-1 text-sm text-muted-foreground">{(Array.isArray(request.fields) ? request.fields : []).join(", ") || "Actualización solicitada"}{request.instructions ? ` · ${request.instructions}` : ""}</p><div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground"><span>{scopeLabels[request.scope]}</span><span>·</span><span>{(Array.isArray(request.allowedActions) ? request.allowedActions : []).map((action) => actionLabels[action]).join(" y ") || "Editar"}</span>{request.targetRecordLabel && <><span>·</span><span>{request.targetRecordLabel}</span></>}</div><p className="mt-2 text-xs font-semibold text-muted-foreground">Límite: {dateText(request.deadline)} · Asignó {request.assignedByName || "Administración/IT"}</p>{request.decisionReason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {request.decisionReason}</p>}</button><div className="flex flex-wrap items-center justify-end gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === "completed" ? "bg-[#007AFF]/10 text-[#007AFF]" : request.status === "expired" || request.status === "rejected" || request.status === "cancelled" ? "bg-[#C53B53]/10 text-[#C53B53]" : "bg-[#FFC72C]/15 text-[#9A6A00]"}`}>{request.status === "completed" ? "Completada" : request.status === "expired" ? "Vencida" : request.status === "rejected" ? "Rechazada" : request.status === "cancelled" ? "Cancelada" : "Pendiente"}</span>{isAdmin ? <><button className="icon-button" title="Editar solicitud" onClick={() => openEdit(request)}><Pencil size={16} /></button><button className="icon-button danger" title="Eliminar solicitud" onClick={() => void remove(request)}><Trash2 size={16} /></button></> : request.status === "pending" && <button className="secondary-button" onClick={() => void complete(request)}><CheckCircle2 size={16} />Completar</button>}</div></article>) : <div className="grid min-h-36 place-items-center p-6 text-center"><div><UserRound className="mx-auto text-[#007AFF]" size={24} /><p className="mt-3 font-extrabold">Sin solicitudes pendientes</p><p className="mt-1 text-sm text-muted-foreground">Las actualizaciones y permisos temporales asignados aparecerán aquí.</p></div></div>}</div></section>
  </>;
}
