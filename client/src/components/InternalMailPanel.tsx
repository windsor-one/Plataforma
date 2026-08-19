import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { moveInternalMessageToTrash, permanentlyDeleteInternalMessage, restoreInternalMessage, saveInternalMessage, updateInternalMessageDelivery } from "@/lib/firestore";
import { filterInternalMessages, isMailUnread, isSentBy, type MailFolder } from "@/lib/internalMail";
import type { InternalMessage, UserProfile } from "@/lib/types";

const stamp = (value: unknown) => {
  if (!value) return "Pendiente de sincronizar";
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format((value as { toDate: () => Date }).toDate());
  }
  return new Date(String(value)).toString() === "Invalid Date" ? "Pendiente de sincronizar" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
};

const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function InternalMailPanel({ messages, employees, profile, onRead }: { messages: InternalMessage[]; employees: UserProfile[]; profile: UserProfile; onRead: (message: InternalMessage) => void }) {
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<InternalMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const visible = useMemo(() => filterInternalMessages(messages, folder, profile.id), [messages, folder, profile.id]);
  const selected = visible.find(message => message.id === selectedId) || visible[0] || null;
  const unread = messages.filter(message => isMailUnread(message, profile.id)).length;

  useEffect(() => {
    if (selected && isMailUnread(selected, profile.id)) onRead(selected);
  }, [onRead, profile.id, selected]);

  const closeComposer = () => { setComposing(false); setEditing(null); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipientIds = form.getAll("recipientIds").map(String).filter(Boolean);
    const requestedDelivery = String(form.get("delivery") || "sent");
    const scheduledLocal = String(form.get("scheduledFor") || "");
    const scheduledTime = scheduledLocal ? new Date(scheduledLocal).getTime() : 0;
    const status: InternalMessage["status"] = requestedDelivery === "draft" ? "draft" : requestedDelivery === "scheduled" ? "scheduled" : "sent";
    if (!recipientIds.length) { toast.error("Selecciona al menos una persona destinataria."); return; }
    if (status === "scheduled" && (!scheduledTime || scheduledTime <= Date.now())) { toast.error("Indica una fecha y hora futura para programar el envío."); return; }
    setSubmitting(true);
    try {
      const id = editing?.id;
      const payload = {
        ...(id ? { id } : {}),
        senderId: profile.id,
        senderName: profile.displayName,
        senderEmail: profile.email,
        recipientIds,
        participantIds: Array.from(new Set([profile.id, ...recipientIds])),
        subject: String(form.get("subject") || "").trim() || "(Sin asunto)",
        body: String(form.get("body") || "").trim(),
        status,
        ...(status === "scheduled" ? { scheduledFor: new Date(scheduledTime).toISOString() } : {}),
        ...(status === "sent" ? { sentAt: new Date() } : {}),
        readByIds: editing?.readByIds || [profile.id],
      };
      const savedId = await saveInternalMessage(payload);
      toast.success(status === "draft" ? "Borrador guardado." : status === "scheduled" ? "Correo programado correctamente." : "Correo interno enviado.");
      closeComposer();
      setFolder(status === "draft" ? "draft" : status === "scheduled" ? "scheduled" : "sent");
      setSelectedId(savedId);
    } catch (error) {
      console.error("No se pudo guardar el correo interno", error);
      toast.error("No fue posible guardar el correo. Comprueba tu conexión y las reglas de Firebase.");
    } finally {
      setSubmitting(false);
    }
  };

  const folderForMessage = (message: InternalMessage): MailFolder => isSentBy(message, profile.id) ? message.status === "draft" ? "draft" : message.status === "scheduled" ? "scheduled" : "sent" : "inbox";
  const moveToTrash = async (message: InternalMessage) => {
    if (!window.confirm("¿Mover este mensaje a la papelera? Podrás restaurarlo o eliminarlo definitivamente después.")) return;
    try { await moveInternalMessageToTrash(message.id, profile.id); toast.success("Mensaje enviado a la papelera."); setFolder("trash"); setSelectedId(message.id); }
    catch { toast.error("No fue posible mover el mensaje a la papelera."); }
  };
  const restoreFromTrash = async (message: InternalMessage) => {
    try { await restoreInternalMessage(message.id, profile.id); toast.success("Mensaje restaurado."); setFolder(folderForMessage(message)); setSelectedId(message.id); }
    catch { toast.error("No fue posible restaurar el mensaje."); }
  };
  const permanentlyDelete = async (message: InternalMessage) => {
    if (!window.confirm("¿Eliminar definitivamente este mensaje de tu buzón? Esta acción no se puede deshacer.")) return;
    try { await permanentlyDeleteInternalMessage(message.id, profile.id); toast.success("Mensaje eliminado definitivamente de tu buzón."); setSelectedId(null); }
    catch { toast.error("No fue posible eliminar definitivamente el mensaje."); }
  };
  const pauseScheduled = async (message: InternalMessage) => {
    try { await updateInternalMessageDelivery(message.id, "draft"); toast.success("Envío pausado y guardado como borrador."); setFolder("draft"); }
    catch { toast.error("No fue posible pausar el envío."); }
  };

  const folders: Array<{ id: MailFolder; label: string; count?: number }> = [
    { id: "inbox", label: "Bandeja de entrada", count: unread },
    { id: "sent", label: "Enviados" },
    { id: "draft", label: "Borradores" },
    { id: "scheduled", label: "Programados" },
    { id: "trash", label: "Papelera" },
  ];

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">Comunicación interna</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Correo</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Mensajes privados entre integrantes activos. Puedes enviar, programar o guardar correos internos sin adjuntos.</p></div>
      <button className="primary-button" onClick={() => { setEditing(null); setComposing(true); }}><Mail size={17} />Redactar</button>
    </div>
    {composing && <section className="panel-card mt-6 p-5">
      <div className="flex items-center justify-between"><div><p className="font-extrabold">{editing ? "Editar mensaje pendiente" : "Redactar correo interno"}</p><p className="mt-1 text-xs text-muted-foreground">Selecciona uno o varios destinatarios con Ctrl o Cmd.</p></div><button type="button" className="icon-button" onClick={closeComposer} aria-label="Cerrar redacción">×</button></div>
      <form className="form-stack mt-5" onSubmit={submit}>
        <label>Para<select className="field min-h-32" name="recipientIds" multiple required defaultValue={editing?.recipientIds || []}>{employees.filter(employee => employee.status === "active" && employee.id !== profile.id).map(employee => <option key={employee.id} value={employee.id}>{employee.displayName} · {employee.email}</option>)}</select></label>
        <label>Asunto<input className="field" name="subject" maxLength={160} defaultValue={editing?.subject} placeholder="Asunto del mensaje" /></label>
        <label>Mensaje<textarea className="field min-h-40" name="body" required defaultValue={editing?.body} placeholder="Escribe tu mensaje…" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label>Entrega<select className="field" name="delivery" defaultValue={editing?.status || "sent"}><option value="sent">Enviar ahora</option><option value="scheduled">Programar envío</option><option value="draft">Guardar borrador</option></select></label><label>Fecha y hora programada<input className="field" name="scheduledFor" type="datetime-local" defaultValue={localDateTime(editing?.scheduledFor)} /></label></div>
        <p className="text-xs leading-5 text-muted-foreground">Los envíos programados se procesan aproximadamente cada hora desde GitHub Actions.</p>
        <button disabled={submitting} className="primary-button">{submitting ? "Guardando…" : "Guardar mensaje"}<ChevronRight size={16} /></button>
      </form>
    </section>}
    <div className="panel-card mt-6 grid min-h-[520px] overflow-hidden md:grid-cols-[220px_320px_minmax(0,1fr)]">
      <aside className="border-b bg-muted/20 p-3 md:border-b-0 md:border-r"><button className="primary-button w-full justify-center" onClick={() => { setEditing(null); setComposing(true); }}><Plus size={16} />Redactar</button><div className="mt-4 space-y-1">{folders.map(item => <button type="button" key={item.id} onClick={() => { setFolder(item.id); setSelectedId(null); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${folder === item.id ? "bg-[#007AFF] text-white" : "hover:bg-muted"}`}><span>{item.label}</span>{item.count ? <span className={`rounded-full px-2 py-0.5 text-xs ${folder === item.id ? "bg-white/20" : "bg-[#007AFF]/10 text-[#007AFF]"}`}>{item.count}</span> : null}</button>)}</div></aside>
      <div className="border-b md:border-b-0 md:border-r"><div className="border-b px-4 py-4"><p className="font-extrabold">{folders.find(item => item.id === folder)?.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{visible.length} mensaje{visible.length === 1 ? "" : "s"}</p></div><div className="max-h-[440px] divide-y overflow-y-auto">{visible.map(message => { const unreadMessage = isMailUnread(message, profile.id); return <button type="button" key={message.id} onClick={() => setSelectedId(message.id)} className={`w-full px-4 py-4 text-left hover:bg-muted/50 ${selected?.id === message.id ? "bg-[#007AFF]/8" : ""}`}><div className="flex items-center justify-between gap-3"><p className={`truncate text-sm ${unreadMessage ? "font-extrabold" : "font-semibold"}`}>{isSentBy(message, profile.id) ? `Para: ${message.recipientIds.length} destinatario(s)` : message.senderName}</p><span className="text-[11px] text-muted-foreground">{message.status === "scheduled" && message.scheduledFor ? stamp(message.scheduledFor) : stamp(message.sentAt || message.createdAt)}</span></div><p className="mt-1 truncate text-sm font-bold">{message.subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{message.body || "Sin contenido"}</p></button>; })}</div>{!visible.length && <div className="grid min-h-52 place-items-center px-6 text-center text-sm text-muted-foreground">No hay mensajes en esta carpeta.</div>}</div>
      <article className="min-w-0">{selected ? <div className="p-5"><p className="eyebrow">{selected.status === "scheduled" ? "Envío programado" : isSentBy(selected, profile.id) ? "Enviado por ti" : "Mensaje recibido"}</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">{selected.subject}</h2><div className="mt-5 border-y py-4 text-sm"><p><strong>De:</strong> {selected.senderName} <span className="text-muted-foreground">&lt;{selected.senderEmail}&gt;</span></p><p className="mt-1"><strong>Para:</strong> {selected.recipientIds.length} integrante{selected.recipientIds.length === 1 ? "" : "s"}</p><p className="mt-1 text-muted-foreground">{selected.status === "scheduled" && selected.scheduledFor ? `Programado para ${stamp(selected.scheduledFor)}` : stamp(selected.sentAt || selected.createdAt)}</p></div><p className="mt-6 whitespace-pre-wrap text-sm leading-7">{selected.body || "(Sin contenido)"}</p>{folder === "trash" ? <div className="mt-6 flex flex-wrap gap-2"><button type="button" className="secondary-button" onClick={() => void restoreFromTrash(selected)}>Restaurar</button><button type="button" className="secondary-button text-destructive" onClick={() => void permanentlyDelete(selected)}>Eliminar definitivamente</button></div> : <div className="mt-6 flex flex-wrap gap-2">{isSentBy(selected, profile.id) && (selected.status === "scheduled" || selected.status === "draft") ? <><button type="button" className="secondary-button" onClick={() => { setEditing(selected); setComposing(true); }}>Editar</button>{selected.status === "scheduled" ? <button type="button" className="secondary-button" onClick={() => void pauseScheduled(selected)}>Pausar y guardar como borrador</button> : null}</> : null}<button type="button" className="secondary-button text-destructive" onClick={() => void moveToTrash(selected)}>Enviar a papelera</button></div>}</div> : <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">Selecciona un mensaje para leerlo.</div>}</article>
    </div>
  </section>;
}
