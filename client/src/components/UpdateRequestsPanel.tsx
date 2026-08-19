import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { completeUpdateRequest, deleteUpdateRequest, saveUpdateRequest, updateUpdateRequest } from "@/lib/firestore";
import type { UpdateRequest, UpdateRequestAction, UpdateRequestModule, UserProfile } from "@/lib/types";
import { normalizeUpdateRequest } from "@/lib/updateRequests";

const moduleLabels: Record<UpdateRequestModule, string> = {
  profile: "Información personal",
  hr: "Recursos Humanos",
  products: "Productos y paquetes",
  tasks: "Tareas",
  reservations: "Reservas",
  customers: "Clientes",
  payments: "Pagos",
  employees: "Personal",
  calendar: "Calendario",
  mail: "Correo interno",
  updates: "Actualizaciones",
  automations: "Automatizaciones",
  hr_reports: "Reportes de RR. HH.",
  performance: "Rendimiento",
  impact: "Impacto digital",
  finance: "Finanzas",
  history: "Historial",
  operations: "Operación",
  access: "Seguridad y actividad",
  pending: "Pendientes",
  reminders: "Notificaciones",
  other: "Otro módulo",
};

const scopeLabels: Record<UpdateRequest["scope"], string> = { self: "Información propia", record: "Registro específico", module: "Módulo asignado" };
const actionLabels: Record<UpdateRequestAction, string> = { edit: "Editar", delete: "Eliminar" };
const dateText = (value: string) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin fecha";
const inputDateTime = (value?: string) => value ? new Date(value).toISOString().slice(0, 16) : "";

type RequestNavigation = Exclude<UpdateRequestModule, "other">;

export default function UpdateRequestsPanel({ requests, employees, profile, isAdmin, onNavigate }: { requests: UpdateRequest[]; employees: UserProfile[]; profile: UserProfile; isAdmin: boolean; onNavigate: (section: RequestNavigation) => void }) {
  const [editing, setEditing] = useState<UpdateRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => requests.map((item) => normalizeUpdateRequest(item, item.id)).filter((item) => item.status !== "expired" || isAdmin), [requests, isAdmin]);
  const formOpen = creating || Boolean(editing);
  const openCreate = () => { setEditing(null); setCreating(true); };
  const closeForm = () => { setEditing(null); setCreating(false); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = employees.find((item) => item.id === form.get("targetUserId"));
    const allowedActions = (["edit", "delete"] as UpdateRequestAction[]).filter((action) => form.get(`action-${action}`) === "on");
    const deadlineValue = String(form.get("deadline") || "");
    if (!target) { toast.error("Selecciona a la persona responsable."); return; }
    if (!deadlineValue || Number.isNaN(new Date(deadlineValue).getTime())) { toast.error("Indica una fecha y hora límite válidas."); return; }
    if (new Date(deadlineValue).getTime() <= Date.now()) { toast.error("La fecha límite debe estar en el futuro."); return; }
    if (!allowedActions.length) { toast.error("Autoriza al menos una acción temporal."); return; }
    const module = String(form.get("module")) as UpdateRequestModule;
    const scope = String(form.get("scope")) as UpdateRequest["scope"];
    const targetRecordId = String(form.get("targetRecordId") || "").trim() || undefined;
    if (scope === "record" && !targetRecordId) { toast.error("Indica el identificador del registro específico autorizado."); return; }
    const record: Omit<UpdateRequest, "id" | "createdAt" | "updatedAt" | "assignedBy" | "assignedByName" | "expiresAt"> = {
      targetUserId: target.id,
      targetUserName: target.displayName,
      module,
      scope,
      targetRecordId,
      targetRecordLabel: String(form.get("targetRecordLabel") || "").trim() || undefined,
      allowedActions,
      fields: String(form.get("fields") || "").split(",").map((item) => item.trim()).filter(Boolean),
      instructions: String(form.get("instructions") || "").trim() || undefined,
      deadline: new Date(deadlineValue).toISOString(),
      status: (editing ? String(form.get("status")) : "pending") as UpdateRequest["status"],
      decisionReason: String(form.get("decisionReason") || "").trim() || undefined,
      completedAt: editing?.completedAt,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateUpdateRequest(editing.id, record, profile.id);
        toast.success("Solicitud actualizada y notificada.");
      } else {
        await saveUpdateRequest(record, profile.id);
        toast.success("Solicitud asignada con permiso temporal y correo interno.");
      }
      closeForm();
    } catch { toast.error("No se pudo guardar la solicitud. Comprueba las reglas de Firebase."); }
    finally { setSaving(false); }
  };

  const complete = async (request: UpdateRequest) => {
    try { await completeUpdateRequest(request.id, profile.id); toast.success("Solicitud marcada como completada."); }
    catch { toast.error("No se pudo cerrar la solicitud."); }
  };

  const remove = async (request: UpdateRequest) => {
    if (!window.confirm(`¿Eliminar la solicitud para ${request.targetUserName}? También se revocará el permiso temporal.`)) return;
    try { await deleteUpdateRequest(request.id, profile.id); toast.success("Solicitud y permiso temporal eliminados."); }
    catch { toast.error("No se pudo eliminar la solicitud."); }
  };

  const navigateTarget = (request: UpdateRequest) => {
    if (request.module !== "other") onNavigate(request.module);
  };

  return <><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Coordinación administrativa</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Solicitudes y permisos temporales</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Cada solicitud autoriza únicamente la acción, módulo y alcance indicados hasta la fecha y hora límite. Administración e IT pueden editar, rechazar, cancelar o eliminar cualquier solicitud.</p></div>{isAdmin && <button className="primary-button" onClick={openCreate}><Plus size={16} />Nueva solicitud</button>}</div>{formOpen && isAdmin && <form className="panel-card mt-7 grid gap-4 p-5 md:grid-cols-2" onSubmit={submit}><div className="md:col-span-2 flex items-center justify-between gap-3"><div><p className="font-extrabold">{editing ? "Editar solicitud" : "Nueva solicitud"}</p><p className="mt-1 text-xs text-muted-foreground">El permiso desaparece al vencer, cancelarse, rechazarse, completarse o eliminarse.</p></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Cerrar formulario"><XCircle size={18} /></button></div><label>Personal<select className="field" name="targetUserId" required defaultValue={editing?.targetUserId || ""}><option value="">Selecciona persona</option>{employees.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Módulo<select className="field" name="module" defaultValue={editing?.module || "profile"}>{Object.entries(moduleLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>Alcance<select className="field" name="scope" defaultValue={editing?.scope || "self"}><option value="self">Información propia</option><option value="record">Registro específico</option><option value="module">Módulo asignado</option></select></label><label>Fecha y hora límite<input className="field" name="deadline" type="datetime-local" required defaultValue={inputDateTime(editing?.deadline)} /></label><label>Identificador de registro <span className="font-normal text-muted-foreground">(obligatorio si es específico)</span><input className="field" name="targetRecordId" defaultValue={editing?.targetRecordId} placeholder="Ej. ID del paquete o cliente" /></label><label>Nombre del registro <span className="font-normal text-muted-foreground">(referencia)</span><input className="field" name="targetRecordLabel" defaultValue={editing?.targetRecordLabel} placeholder="Ej. Paquete Premium" /></label><fieldset className="md:col-span-2 rounded-xl border bg-muted/20 p-4"><legend className="px-1 text-sm font-bold">Acciones permitidas temporalmente</legend><div className="mt-2 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-semibold"><input name="action-edit" type="checkbox" defaultChecked={editing ? editing.allowedActions.includes("edit") : true} />Editar</label><label className="flex items-center gap-2 text-sm font-semibold"><input name="action-delete" type="checkbox" defaultChecked={editing?.allowedActions.includes("delete")} />Eliminar</label></div></fieldset><label>Campos o resultado esperado<input className="field" name="fields" defaultValue={editing?.fields.join(", ")} placeholder="Ej. nombre, precio, información de contacto" /></label>{editing && <label>Estado<select className="field" name="status" defaultValue={editing.status}><option value="pending">Pendiente y vigente</option><option value="cancelled">Cancelada</option><option value="rejected">Rechazada</option><option value="completed">Completada</option></select></label>}<label className="md:col-span-2">Indicaciones<textarea className="field min-h-24" name="instructions" defaultValue={editing?.instructions} placeholder="Describe qué debe actualizarse y cómo validar el resultado." /></label>{editing && <label className="md:col-span-2">Motivo de cambio, rechazo o cancelación<textarea className="field min-h-20" name="decisionReason" defaultValue={editing.decisionReason} placeholder="El empleado recibirá este motivo por correo interno." /></label>}<button className="primary-button w-fit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Asignar solicitud"}<ClipboardList size={16} /></button></form>}<section className="panel-card mt-7 overflow-hidden"><div className="divide-y">{visible.length ? visible.map((request) => <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><button className="min-w-0 flex-1 text-left" onClick={() => navigateTarget(request)}><p className="font-extrabold">{moduleLabels[request.module]} · {request.targetUserName}</p><p className="mt-1 text-sm text-muted-foreground">{request.fields.join(", ") || "Actualización solicitada"}{request.instructions ? ` · ${request.instructions}` : ""}</p><div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground"><span>{scopeLabels[request.scope]}</span><span>·</span><span>{request.allowedActions.map((action) => actionLabels[action]).join(" y ")}</span>{request.targetRecordLabel && <><span>·</span><span>{request.targetRecordLabel}</span></>}</div><p className="mt-2 text-xs font-semibold text-muted-foreground">Límite: {dateText(request.deadline)} · Asignó {request.assignedByName || "Administración/IT"}</p>{request.decisionReason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {request.decisionReason}</p>}</button><div className="flex flex-wrap items-center justify-end gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === "completed" ? "bg-[#007AFF]/10 text-[#007AFF]" : request.status === "expired" || request.status === "rejected" || request.status === "cancelled" ? "bg-[#C53B53]/10 text-[#C53B53]" : "bg-[#FFC72C]/15 text-[#9A6A00]"}`}>{request.status === "completed" ? "Completada" : request.status === "expired" ? "Vencida" : request.status === "rejected" ? "Rechazada" : request.status === "cancelled" ? "Cancelada" : "Pendiente"}</span>{isAdmin ? <><button className="icon-button" title="Editar solicitud" onClick={() => { setCreating(false); setEditing(request); }}><Pencil size={16} /></button><button className="icon-button danger" title="Eliminar solicitud" onClick={() => void remove(request)}><Trash2 size={16} /></button></> : request.status === "pending" && <button className="secondary-button" onClick={() => void complete(request)}><CheckCircle2 size={16} />Completar</button>}</div></article>) : <div className="grid min-h-36 place-items-center p-6 text-center"><div><UserRound className="mx-auto text-[#007AFF]" size={24} /><p className="mt-3 font-extrabold">Sin solicitudes pendientes</p><p className="mt-1 text-sm text-muted-foreground">Las actualizaciones y permisos temporales asignados aparecerán aquí.</p></div></div>}</div></section></>;
}
