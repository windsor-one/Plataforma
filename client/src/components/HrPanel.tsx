/**
 * Sistema Heliot — Recursos Humanos: experiencia de escritorio con paneles laterales,
 * datos organizacionales reutilizables y privacidad estricta por titular.
 */
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Landmark,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  acknowledgeHrPolicy,
  assignAttendanceGuard,
  bulkDeleteHrAttendanceRecords,
  bulkUpdateAttendanceRecords,
  createLeaveRequest,
  deleteHrAdminRecord,
  deleteHrAttendanceRecord,
  deleteHrLeaveRequest,
  recordGuardAttendance,
  recordOwnAttendance,
  reviewLeaveRequest,
  saveEmployeeHrProfile,
  saveHrAdminRecord,
  saveHrAttendanceRecord,
  saveHrLeaveRequest,
  updateAttendanceSettings,
  updateOwnHrProfile,
} from "@/lib/firestore";
import type {
  AttendanceGuard,
  AttendanceRecord,
  AttendanceSettings,
  EmploymentContract,
  HrDocument,
  HrGoal,
  HrPolicy,
  HrProfile,
  LeaveRequest,
  LifecycleChecklist,
  OrganizationUnit,
  PerformanceReview,
  PolicyAcknowledgment,
  Recognition,
  TrainingRecord,
  UserProfile,
  WorkSchedule,
} from "@/lib/types";

type Tab =
  | "mine"
  | "people"
  | "organization"
  | "employment"
  | "development"
  | "control";
type EditorType =
  | "profile"
  | "unit"
  | "schedule"
  | "contract"
  | "document"
  | "lifecycle"
  | "goal"
  | "review"
  | "training"
  | "recognition"
  | "policy"
  | "attendance"
  | "leave";
type Editor = { type: EditorType; record?: object } | null;

const readable = (value: unknown) =>
  value &&
  typeof value === "object" &&
  "toDate" in value &&
  typeof (value as { toDate?: unknown }).toDate === "function"
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format((value as { toDate: () => Date }).toDate())
    : "Pendiente de sincronizar";
const dateDays = (from: string, to: string) =>
  Math.max(
    1,
    Math.round(
      (new Date(`${to}T12:00:00`).getTime() -
        new Date(`${from}T12:00:00`).getTime()) /
        86_400_000
    ) + 1
  );
const label: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  vacation: "Vacaciones",
  leave: "Permiso",
  terminated: "Retirado",
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencido",
  draft: "Borrador",
  ended: "Finalizado",
  completed: "Completada",
  in_progress: "En progreso",
  assigned: "Asignada",
  shared: "Compartida",
};
const leaveLabel: Record<LeaveRequest["type"], string> = {
  vacation: "Vacaciones",
  personal: "Permiso personal",
  medical: "Permiso médico",
  academic: "Permiso académico",
  unpaid: "Permiso no remunerado",
  other: "Otra ausencia",
};
const pick = (items: OrganizationUnit[], id: string) =>
  items.find(item => item.id === id);
const asDate = (value: unknown) =>
  value &&
  typeof value === "object" &&
  "toDate" in value &&
  typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date
      ? value
      : new Date();
const dateInput = (value: unknown) => {
  const date = asDate(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const timeInput = (value: unknown) => {
  const date = asDate(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const isoWeekKey = (date = new Date()) => {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

function Title({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
      {action}
    </div>
  );
}

function Metric({
  label: title,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <article className="metric-card">
      <div>
        <p className="font-mono text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">
          {title}
        </p>
        <p className="metric-number mt-4 text-3xl font-semibold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="metric-icon jade">
        <Icon size={19} />
      </div>
    </article>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-44 place-items-center p-6 text-center">
      <div>
        <ShieldCheck className="mx-auto text-[#0F8F73]" size={27} />
        <p className="mt-3 font-extrabold">{title}</p>
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#07151A]/30 backdrop-blur-[2px]"
      >
        <motion.section
          initial={{ x: 48, opacity: 0.92 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 48, opacity: 0.92 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="floating-surface ml-auto flex h-full w-full max-w-2xl flex-col border-l"
        >
          <header className="flex items-center justify-between border-b px-6 py-5">
            <div>
              <p className="eyebrow">Recursos Humanos</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                {title}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <X size={19} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button className="icon-button" title="Editar" onClick={onEdit}>
        <Pencil size={16} />
      </button>
      <button
        className="icon-button danger"
        title="Eliminar"
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function ContactForm({
  userId,
  profile,
  onDone,
}: {
  userId: string;
  profile: HrProfile | null;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await updateOwnHrProfile(userId, {
        personalEmail: String(form.get("personalEmail")).trim(),
        personalPhone: String(form.get("personalPhone")).trim(),
        address: String(form.get("address")).trim(),
        emergencyContactName: String(form.get("emergencyContactName")).trim(),
        emergencyContactPhone: String(form.get("emergencyContactPhone")).trim(),
      });
      toast.success("Tus datos de contacto se actualizaron.");
      onDone();
    } catch {
      toast.error("No se pudieron actualizar tus datos de contacto.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
        <strong className="text-foreground">Datos privados:</strong> tú y
        Administración/IT son las únicas personas que pueden ver esta
        información.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Correo personal
          <input
            className="field"
            type="email"
            name="personalEmail"
            defaultValue={profile?.personalEmail}
          />
        </label>
        <label>
          Teléfono personal
          <input
            className="field"
            name="personalPhone"
            defaultValue={profile?.personalPhone}
          />
        </label>
      </div>
      <label>
        Dirección
        <textarea
          className="field min-h-20"
          name="address"
          defaultValue={profile?.address}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Contacto de emergencia
          <input
            className="field"
            name="emergencyContactName"
            defaultValue={profile?.emergencyContactName}
          />
        </label>
        <label>
          Teléfono de emergencia
          <input
            className="field"
            name="emergencyContactPhone"
            defaultValue={profile?.emergencyContactPhone}
          />
        </label>
      </div>
      <button className="primary-button" disabled={saving}>
        {saving ? "Guardando…" : "Guardar datos"}
        <ChevronRight size={16} />
      </button>
    </form>
  );
}

function LeaveForm({
  user,
  profile,
  onDone,
}: {
  user: UserProfile;
  profile: HrProfile | null;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate"));
    const endDate = String(form.get("endDate"));
    try {
      await createLeaveRequest(
        {
          employeeId: user.id,
          employeeName: user.displayName,
          type: String(form.get("type")) as LeaveRequest["type"],
          startDate,
          endDate,
          days: dateDays(startDate, endDate),
          reason: String(form.get("reason")).trim(),
          status: "pending",
          reviewerId: profile?.supervisorId,
          reviewerName: profile?.supervisorName,
        },
        user.id
      );
      toast.success("Solicitud enviada para revisión.");
      onDone();
    } catch {
      toast.error("No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="rounded-xl border border-[#FFC72C]/35 bg-[#FFC72C]/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
        Tu solicitud se envía a Administración/IT. No escribas diagnósticos
        médicos ni información confidencial en el motivo.
      </p>
      <label>
        Tipo
        <select className="field" name="type">
          {Object.entries(leaveLabel).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Inicio
          <input className="field" type="date" name="startDate" required />
        </label>
        <label>
          Fin
          <input className="field" type="date" name="endDate" required />
        </label>
      </div>
      <label>
        Motivo{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
        <textarea className="field min-h-24" name="reason" />
      </label>
      <button className="primary-button" disabled={saving}>
        {saving ? "Enviando…" : "Enviar solicitud"}
        <ChevronRight size={16} />
      </button>
    </form>
  );
}

function GuardAttendanceForm({ guard, employees, onDone }: { guard: AttendanceGuard; employees: UserProfile[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employee = employees.find(item => item.id === form.get("employeeId"));
    if (!employee) return;
    setSaving(true);
    try {
      await recordGuardAttendance(guard, employee, String(form.get("type")) as AttendanceRecord["type"], String(form.get("note")).trim());
      toast.success(`Marcación de ${employee.displayName} registrada.`);
      onDone();
    } catch { toast.error("No se pudo registrar la asistencia. Comprueba tu asignación de guardia."); } finally { setSaving(false); }
  };
  return <form className="form-stack" onSubmit={submit}><p className="rounded-xl border border-[#007AFF]/25 bg-[#007AFF]/5 px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Guardia {guard.weekKey}:</strong> esta acción queda auditada con tu nombre y solo está disponible para la persona asignada.</p><label>Personal<select className="field" name="employeeId" required><option value="">Selecciona persona</option>{employees.filter(item => item.status === "active").map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Evento<select className="field" name="type"><option value="clock_in">Entrada</option><option value="clock_out">Salida</option><option value="break_start">Inicio de descanso</option><option value="break_end">Fin de descanso</option></select></label><label>Nota <span className="font-normal text-muted-foreground">(opcional)</span><textarea className="field min-h-20" name="note" /></label><button className="primary-button" disabled={saving}>{saving ? "Registrando…" : "Registrar asistencia"}<ChevronRight size={16} /></button></form>;
}

function AdminEditor({
  editor,
  userId,
  employees,
  units,
  schedules,
  onDone,
}: {
  editor: Exclude<Editor, null>;
  userId: string;
  employees: UserProfile[];
  units: OrganizationUnit[];
  schedules: WorkSchedule[];
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [contextual, setContextual] = useState<{
    kind: OrganizationUnit["kind"] | "schedule";
    field: string;
  } | null>(null);
  const [contextName, setContextName] = useState("");
  const [contextDays, setContextDays] = useState("Jueves");
  const [contextStart, setContextStart] = useState("07:00");
  const [contextEnd, setContextEnd] = useState("12:00");
  const [createdUnits, setCreatedUnits] = useState<OrganizationUnit[]>([]);
  const [createdSchedules, setCreatedSchedules] = useState<WorkSchedule[]>([]);
  const record = (editor.record || {}) as Record<string, unknown>;
  const value = (key: string) => String(record[key] ?? "");
  const allUnits = [
    ...units,
    ...createdUnits.filter(item => !units.some(unit => unit.id === item.id)),
  ];
  const allSchedules = [
    ...schedules,
    ...createdSchedules.filter(
      item => !schedules.some(schedule => schedule.id === item.id)
    ),
  ];
  const employeeOptions = (
    <>
      <option value="">Selecciona Personal</option>
      {employees
        .filter(item => item.status === "active")
        .map(item => (
          <option value={item.id} key={item.id}>
            {item.displayName}
          </option>
        ))}
    </>
  );
  const unitOptions = (kind: OrganizationUnit["kind"], placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {allUnits
        .filter(unit => unit.kind === kind && unit.active)
        .map(unit => (
          <option value={unit.id} key={unit.id}>
            {unit.name}
          </option>
        ))}
    </>
  );
  const startContextual = (
    kind: OrganizationUnit["kind"] | "schedule",
    field: string
  ) => {
    setContextual({ kind, field });
    setContextName("");
    setContextDays("Jueves");
    setContextStart("07:00");
    setContextEnd("12:00");
  };
  const saveContextual = async () => {
    if (!contextual || !contextName.trim()) {
      toast.error("Escribe un nombre para continuar.");
      return;
    }
    setSaving(true);
    try {
      if (contextual.kind === "schedule") {
        const id = await saveHrAdminRecord(
          "workSchedules",
          {
            id: "",
            name: contextName.trim(),
            days: contextDays
              .split(",")
              .map(item => item.trim())
              .filter(Boolean),
            startTime: contextStart,
            endTime: contextEnd,
            breakMinutes: 0,
            active: true,
            createdBy: userId,
          } as WorkSchedule,
          userId,
          `Creó el horario contextual «${contextName.trim()}»`
        );
        setCreatedSchedules(current => [
          ...current,
          {
            id,
            name: contextName.trim(),
            days: contextDays
              .split(",")
              .map(item => item.trim())
              .filter(Boolean),
            startTime: contextStart,
            endTime: contextEnd,
            breakMinutes: 0,
            active: true,
            createdBy: userId,
          },
        ]);
        window.requestAnimationFrame(() => {
          const select = document.querySelector<HTMLSelectElement>(
            `select[name="${contextual.field}"]`
          );
          if (select) select.value = id;
        });
      } else {
        const id = await saveHrAdminRecord(
          "organizationUnits",
          {
            id: "",
            name: contextName.trim(),
            kind: contextual.kind,
            active: true,
            createdBy: userId,
          } as OrganizationUnit,
          userId,
          `Creó la unidad contextual «${contextName.trim()}»`
        );
        setCreatedUnits(current => [
          ...current,
          {
            id,
            name: contextName.trim(),
            kind: contextual.kind as OrganizationUnit["kind"],
            active: true,
            createdBy: userId,
          },
        ]);
        window.requestAnimationFrame(() => {
          const select = document.querySelector<HTMLSelectElement>(
            `select[name="${contextual.field}"]`
          );
          if (select) select.value = id;
        });
      }
      toast.success("Elemento creado y seleccionado en el expediente.");
      setContextual(null);
    } catch {
      toast.error(
        "No se pudo crear el elemento. Revisa las reglas de Firebase."
      );
    } finally {
      setSaving(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const id = value("id");
    const employee = employees.find(item => item.id === form.get("employeeId"));
    const organization = (field: string) =>
      pick(allUnits, String(form.get(field) || ""));
    try {
      if (editor.type === "profile" && employee) {
        const department = organization("departmentId"),
          area = organization("areaId"),
          team = organization("teamId"),
          position = organization("positionId"),
          site = organization("siteId");
        const schedule = allSchedules.find(
          item => item.id === form.get("scheduleId")
        );
        await saveEmployeeHrProfile(
          employee.id,
          {
            departmentId: department?.id,
            department: department?.name,
            areaId: area?.id,
            area: area?.name,
            teamId: team?.id,
            team: team?.name,
            positionId: position?.id,
            position: position?.name,
            siteId: site?.id,
            site: site?.name,
            scheduleId: schedule?.id,
            scheduleName: schedule?.name,
            startDate: String(form.get("startDate")) || undefined,
            contractType: String(
              form.get("contractType")
            ) as HrProfile["contractType"],
            workDay: schedule
              ? `${schedule.days.join(", ")} · ${schedule.startTime}–${schedule.endTime}`
              : String(form.get("workDay")).trim(),
            workMode: String(form.get("workMode")) as HrProfile["workMode"],
            employmentStatus: String(
              form.get("employmentStatus")
            ) as HrProfile["employmentStatus"],
            vacationAllowanceDays:
              Number(form.get("vacationAllowanceDays")) || 0,
            vacationUsedDays: Number(form.get("vacationUsedDays")) || 0,
            supervisorId: String(form.get("supervisorId")) || undefined,
            supervisorName: employees.find(
              item => item.id === form.get("supervisorId")
            )?.displayName,
          },
          userId
        );
      }
      if (editor.type === "unit") {
        const parent = allUnits.find(item => item.id === form.get("parentId"));
        await saveHrAdminRecord(
          "organizationUnits",
          {
            id,
            name: String(form.get("name")).trim(),
            kind: String(form.get("kind")) as OrganizationUnit["kind"],
            parentId: parent?.id,
            parentName: parent?.name,
            active: form.get("active") === "on",
            createdBy: userId,
          } as OrganizationUnit,
          userId,
          `${id ? "Actualizó" : "Creó"} la unidad «${String(form.get("name")).trim()}»`
        );
      }
      if (editor.type === "schedule")
        await saveHrAdminRecord(
          "workSchedules",
          {
            id,
            name: String(form.get("name")).trim(),
            days: String(form.get("days"))
              .split(",")
              .map(item => item.trim())
              .filter(Boolean),
            startTime: String(form.get("startTime")),
            endTime: String(form.get("endTime")),
            breakMinutes: Number(form.get("breakMinutes")) || 0,
            active: form.get("active") === "on",
            createdBy: userId,
          } as WorkSchedule,
          userId,
          `${id ? "Actualizó" : "Creó"} el horario «${String(form.get("name")).trim()}»`
        );
      if (editor.type === "contract" && employee)
        await saveHrAdminRecord(
          "employmentContracts",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            contractType: String(
              form.get("contractType")
            ) as EmploymentContract["contractType"],
            status: String(form.get("status")) as EmploymentContract["status"],
            startDate: String(form.get("startDate")),
            endDate: String(form.get("endDate")) || undefined,
            position: String(form.get("position")).trim(),
            workDay: String(form.get("workDay")).trim(),
            workMode: String(
              form.get("workMode")
            ) as EmploymentContract["workMode"],
            salaryAmount: Number(form.get("salaryAmount")) || undefined,
            currency: String(form.get("currency")) || "USD",
            notes: String(form.get("notes")).trim(),
            createdBy: userId,
          } as EmploymentContract,
          userId,
          `${id ? "Actualizó" : "Registró"} un contrato de ${employee.displayName}`
        );
      if (editor.type === "document" && employee)
        await saveHrAdminRecord(
          "hrDocuments",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            name: String(form.get("name")).trim(),
            type: String(form.get("documentType")) as HrDocument["type"],
            status: String(form.get("status")) as HrDocument["status"],
            issuedAt: String(form.get("issuedAt")) || undefined,
            expiresAt: String(form.get("expiresAt")) || undefined,
            private: form.get("private") === "on",
            referenceUrl: String(form.get("referenceUrl")).trim() || undefined,
            notes: String(form.get("notes")).trim(),
            createdBy: userId,
          } as HrDocument,
          userId,
          `${id ? "Actualizó" : "Registró"} el documento «${String(form.get("name")).trim()}»`
        );
      if (editor.type === "lifecycle" && employee)
        await saveHrAdminRecord(
          "lifecycleChecklists",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            stage: String(form.get("stage")) as LifecycleChecklist["stage"],
            title: String(form.get("title")).trim(),
            status: String(form.get("status")) as LifecycleChecklist["status"],
            dueDate: String(form.get("dueDate")) || undefined,
            notes: String(form.get("notes")).trim(),
            createdBy: userId,
          } as LifecycleChecklist,
          userId,
          `${id ? "Actualizó" : "Añadió"} un paso del ciclo laboral`
        );
      if (editor.type === "goal" && employee)
        await saveHrAdminRecord(
          "hrGoals",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            title: String(form.get("title")).trim(),
            target: String(form.get("target")).trim(),
            progress: Number(form.get("progress")) || 0,
            dueDate: String(form.get("dueDate")) || undefined,
            status: String(form.get("status")) as HrGoal["status"],
            createdBy: userId,
          } as HrGoal,
          userId,
          `${id ? "Actualizó" : "Asignó"} un objetivo`
        );
      if (editor.type === "review" && employee)
        await saveHrAdminRecord(
          "performanceReviews",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            period: String(form.get("period")).trim(),
            score: Number(form.get("score")) || undefined,
            strengths: String(form.get("strengths")).trim(),
            improvements: String(form.get("improvements")).trim(),
            comments: String(form.get("comments")).trim(),
            status: String(form.get("status")) as PerformanceReview["status"],
            createdBy: userId,
          } as PerformanceReview,
          userId,
          `${id ? "Actualizó" : "Registró"} una evaluación`
        );
      if (editor.type === "training" && employee)
        await saveHrAdminRecord(
          "trainingRecords",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            title: String(form.get("title")).trim(),
            provider: String(form.get("provider")).trim(),
            completedAt: String(form.get("completedAt")) || undefined,
            expiresAt: String(form.get("expiresAt")) || undefined,
            cost: Number(form.get("cost")) || undefined,
            status: String(form.get("status")) as TrainingRecord["status"],
            createdBy: userId,
          } as TrainingRecord,
          userId,
          `${id ? "Actualizó" : "Registró"} una capacitación`
        );
      if (editor.type === "recognition" && employee)
        await saveHrAdminRecord(
          "recognitions",
          {
            id,
            employeeId: employee.id,
            employeeName: employee.displayName,
            title: String(form.get("title")).trim(),
            message: String(form.get("message")).trim(),
            visibility: String(
              form.get("visibility")
            ) as Recognition["visibility"],
            createdBy: userId,
          } as Recognition,
          userId,
          `${id ? "Actualizó" : "Reconoció"} a ${employee.displayName}`
        );
      if (editor.type === "policy")
        await saveHrAdminRecord(
          "hrPolicies",
          {
            id,
            title: String(form.get("title")).trim(),
            version: String(form.get("version")).trim(),
            content: String(form.get("content")).trim(),
            active: form.get("active") === "on",
            createdBy: userId,
          } as HrPolicy,
          userId,
          `${id ? "Actualizó" : "Publicó"} la política «${String(form.get("title")).trim()}»`
        );
      if (editor.type === "attendance" && employee) {
        const date = String(form.get("date"));
        const time = String(form.get("time"));
        await saveHrAttendanceRecord(
          {
            id: id || undefined,
            employeeId: employee.id,
            employeeName: employee.displayName,
            type: String(
              form.get("attendanceType")
            ) as AttendanceRecord["type"],
            occurredAt: new Date(`${date}T${time || "00:00"}:00`),
            source: (record.source as AttendanceRecord["source"]) || "manual",
            note: String(form.get("note")).trim() || undefined,
            correctionReason:
              String(form.get("correctionReason")).trim() || undefined,
            createdBy: String(record.createdBy || userId),
            createdByName: String(record.createdByName || ""),
            createdByEmail: String(record.createdByEmail || ""),
          },
          userId
        );
      }
      if (editor.type === "leave" && employee) {
        const startDate = String(form.get("startDate"));
        const endDate = String(form.get("endDate"));
        await saveHrLeaveRequest(
          {
            id: id || undefined,
            employeeId: employee.id,
            employeeName: employee.displayName,
            type: String(form.get("leaveType")) as LeaveRequest["type"],
            startDate,
            endDate,
            days: dateDays(startDate, endDate),
            reason: String(form.get("reason")).trim() || undefined,
            status: String(form.get("status")) as LeaveRequest["status"],
            reviewerComment:
              String(form.get("reviewerComment")).trim() || undefined,
            reviewerId: userId,
            reviewerName: "Administración/IT",
            createdBy: String(record.createdBy || userId),
            createdByName: String(record.createdByName || ""),
            createdByEmail: String(record.createdByEmail || ""),
          },
          userId
        );
      }
      toast.success("Registro de Recursos Humanos guardado.");
      onDone();
    } catch {
      toast.error(
        "No se pudo guardar. Revisa los campos y las reglas de Firebase."
      );
    } finally {
      setSaving(false);
    }
  };
  const needsEmployee = [
    "profile",
    "contract",
    "document",
    "lifecycle",
    "goal",
    "review",
    "training",
    "recognition",
    "attendance",
    "leave",
  ].includes(editor.type);
  return (
    <form className="form-stack" onSubmit={submit}>
      {needsEmployee && (
        <label>
          Personal
          <select
            className="field"
            name="employeeId"
            required
            defaultValue={value("employeeId")}
          >
            {employeeOptions}
          </select>
        </label>
      )}
      {editor.type === "profile" && (
        <>
          <p className="rounded-xl border border-[#0F8F73]/20 bg-[#0F8F73]/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
            <strong className="text-foreground">Código automático:</strong> el
            sistema asigna <code>EMP-xxxxx</code> una sola vez cuando se crea el
            expediente. Los campos siguientes provienen del catálogo de
            Organización.
          </p>
          {contextual && (
            <div className="rounded-xl border border-[#007AFF]/25 bg-[#007AFF]/5 p-4">
              <p className="text-sm font-bold text-foreground">
                Crear {contextual.kind === "schedule" ? "horario" : contextual.kind} sin salir del expediente
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  Nombre
                  <input className="field" value={contextName} onChange={event => setContextName(event.target.value)} autoFocus placeholder="Nombre" />
                </label>
                {contextual.kind === "schedule" && <>
                  <label>Días<input className="field" value={contextDays} onChange={event => setContextDays(event.target.value)} /></label>
                  <label>Inicio<input className="field" type="time" value={contextStart} onChange={event => setContextStart(event.target.value)} /></label>
                  <label>Fin<input className="field" type="time" value={contextEnd} onChange={event => setContextEnd(event.target.value)} /></label>
                </>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="primary-button" disabled={saving} onClick={() => void saveContextual()}>{saving ? "Creando…" : "Crear y seleccionar"}</button>
                <button type="button" className="secondary-button" onClick={() => setContextual(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Departamento
              <span className="flex gap-2"><select className="field flex-1" name="departmentId" defaultValue={value("departmentId")}>{unitOptions("department", "Selecciona departamento")}</select><button type="button" className="icon-button shrink-0" aria-label="Crear departamento" title="Crear departamento" onClick={() => startContextual("department", "departmentId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Área
              <span className="flex gap-2"><select className="field flex-1" name="areaId" defaultValue={value("areaId")}>{unitOptions("area", "Selecciona área")}</select><button type="button" className="icon-button shrink-0" aria-label="Crear área" title="Crear área" onClick={() => startContextual("area", "areaId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Equipo
              <span className="flex gap-2"><select className="field flex-1" name="teamId" defaultValue={value("teamId")}>{unitOptions("team", "Selecciona equipo")}</select><button type="button" className="icon-button shrink-0" aria-label="Crear equipo" title="Crear equipo" onClick={() => startContextual("team", "teamId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Cargo
              <span className="flex gap-2"><select className="field flex-1" name="positionId" defaultValue={value("positionId")}>{unitOptions("position", "Selecciona cargo")}</select><button type="button" className="icon-button shrink-0" aria-label="Crear cargo" title="Crear cargo" onClick={() => startContextual("position", "positionId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Sede
              <span className="flex gap-2"><select className="field flex-1" name="siteId" defaultValue={value("siteId")}>{unitOptions("site", "Selecciona sede")}</select><button type="button" className="icon-button shrink-0" aria-label="Crear sede" title="Crear sede" onClick={() => startContextual("site", "siteId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Horario
              <span className="flex gap-2"><select className="field flex-1" name="scheduleId" defaultValue={value("scheduleId")}>
                <option value="">Selecciona horario</option>
                {allSchedules
                  .filter(item => item.active)
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select><button type="button" className="icon-button shrink-0" aria-label="Crear horario" title="Crear horario" onClick={() => startContextual("schedule", "scheduleId")}><Plus size={16} /></button></span>
            </label>
            <label>
              Supervisa
              <select
                className="field"
                name="supervisorId"
                defaultValue={value("supervisorId")}
              >
                <option value="">Sin supervisor asignado</option>
                {employees
                  .filter(item => item.status === "active")
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Fecha de ingreso
              <input
                className="field"
                type="date"
                name="startDate"
                defaultValue={value("startDate")}
              />
            </label>
            <label>
              Modalidad
              <select
                className="field"
                name="workMode"
                defaultValue={value("workMode") || "onsite"}
              >
                <option value="onsite">Presencial</option>
                <option value="remote">Remoto</option>
                <option value="hybrid">Híbrido</option>
              </select>
            </label>
            <label>
              Tipo de contrato
              <select
                className="field"
                name="contractType"
                defaultValue={value("contractType") || "indefinite"}
              >
                <option value="indefinite">Indefinido</option>
                <option value="fixed_term">Plazo fijo</option>
                <option value="temporary">Temporal</option>
                <option value="internship">Práctica</option>
                <option value="service">Servicios</option>
              </select>
            </label>
            <label>
              Estado laboral
              <select
                className="field"
                name="employmentStatus"
                defaultValue={value("employmentStatus") || "active"}
              >
                <option value="active">Activo</option>
                <option value="vacation">Vacaciones</option>
                <option value="leave">Permiso</option>
                <option value="suspended">Suspendido</option>
                <option value="terminated">Retirado</option>
              </select>
            </label>
            <label>
              Jornada alternativa
              <input
                className="field"
                name="workDay"
                defaultValue={value("workDay")}
                placeholder="Si no seleccionas horario"
              />
            </label>
            <label>
              Vacaciones anuales
              <input
                className="field"
                type="number"
                min="0"
                name="vacationAllowanceDays"
                defaultValue={value("vacationAllowanceDays")}
              />
            </label>
            <label>
              Vacaciones usadas
              <input
                className="field"
                type="number"
                min="0"
                name="vacationUsedDays"
                defaultValue={value("vacationUsedDays")}
              />
            </label>
          </div>
        </>
      )}
      {editor.type === "unit" && (
        <>
          <label>
            Nombre
            <input
              required
              className="field"
              name="name"
              defaultValue={value("name")}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Tipo
              <select
                className="field"
                name="kind"
                defaultValue={value("kind") || "department"}
              >
                <option value="department">Departamento</option>
                <option value="area">Área</option>
                <option value="team">Equipo</option>
                <option value="position">Cargo</option>
                <option value="site">Sede</option>
              </select>
            </label>
            <label>
              Unidad superior
              <select
                className="field"
                name="parentId"
                defaultValue={value("parentId")}
              >
                <option value="">Sin unidad superior</option>
                {units
                  .filter(item => item.id !== value("id"))
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={record.active !== false}
            />{" "}
            Unidad activa
          </label>
        </>
      )}
      {editor.type === "schedule" && (
        <>
          <label>
            Nombre del horario
            <input
              required
              className="field"
              name="name"
              defaultValue={value("name")}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Días{" "}
              <span className="font-normal text-muted-foreground">
                (separados por coma)
              </span>
              <input
                className="field"
                name="days"
                defaultValue={
                  Array.isArray(record.days)
                    ? record.days.join(", ")
                    : value("days") ||
                      "Lunes, Martes, Miércoles, Jueves, Viernes"
                }
              />
            </label>
            <label>
              Descanso (min)
              <input
                className="field"
                type="number"
                name="breakMinutes"
                defaultValue={value("breakMinutes") || "60"}
              />
            </label>
            <label>
              Inicio
              <input
                className="field"
                type="time"
                name="startTime"
                required
                defaultValue={value("startTime")}
              />
            </label>
            <label>
              Fin
              <input
                className="field"
                type="time"
                name="endTime"
                required
                defaultValue={value("endTime")}
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={record.active !== false}
            />{" "}
            Horario activo
          </label>
        </>
      )}
      {editor.type === "contract" && <ContractFields value={value} />}
      {editor.type === "document" && (
        <DocumentFields value={value} record={record} />
      )}
      {editor.type === "lifecycle" && <LifecycleFields value={value} />}
      {editor.type === "goal" && <GoalFields value={value} />}
      {editor.type === "review" && <ReviewFields value={value} />}
      {editor.type === "training" && <TrainingFields value={value} />}
      {editor.type === "recognition" && <RecognitionFields value={value} />}
      {editor.type === "policy" && (
        <PolicyFields value={value} record={record} />
      )}
      {editor.type === "attendance" && (
        <AttendanceFields value={value} record={record} />
      )}
      {editor.type === "leave" && <LeaveAdminFields value={value} />}
      <button className="primary-button" disabled={saving}>
        {saving ? "Guardando…" : "Guardar registro"}
        <ChevronRight size={16} />
      </button>
    </form>
  );
}

const ContractFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Tipo
        <select
          className="field"
          name="contractType"
          defaultValue={value("contractType") || "indefinite"}
        >
          <option value="indefinite">Indefinido</option>
          <option value="fixed_term">Plazo fijo</option>
          <option value="temporary">Temporal</option>
          <option value="internship">Práctica</option>
          <option value="service">Servicios</option>
        </select>
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "draft"}
        >
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="expiring">Por vencer</option>
          <option value="ended">Finalizado</option>
        </select>
      </label>
      <label>
        Inicio
        <input
          className="field"
          type="date"
          name="startDate"
          required
          defaultValue={value("startDate")}
        />
      </label>
      <label>
        Fin
        <input
          className="field"
          type="date"
          name="endDate"
          defaultValue={value("endDate")}
        />
      </label>
      <label>
        Cargo
        <input
          className="field"
          name="position"
          defaultValue={value("position")}
        />
      </label>
      <label>
        Modalidad
        <select
          className="field"
          name="workMode"
          defaultValue={value("workMode") || "onsite"}
        >
          <option value="onsite">Presencial</option>
          <option value="remote">Remoto</option>
          <option value="hybrid">Híbrido</option>
        </select>
      </label>
      <label>
        Jornada
        <input
          className="field"
          name="workDay"
          defaultValue={value("workDay")}
        />
      </label>
      <label>
        Salario
        <input
          className="field"
          type="number"
          min="0"
          step=".01"
          name="salaryAmount"
          defaultValue={value("salaryAmount")}
        />
      </label>
      <label>
        Moneda
        <input
          className="field"
          name="currency"
          defaultValue={value("currency") || "USD"}
        />
      </label>
    </div>
    <label>
      Notas
      <textarea
        className="field min-h-20"
        name="notes"
        defaultValue={value("notes")}
      />
    </label>
  </>
);
const DocumentFields = ({
  value,
  record,
}: {
  value: (key: string) => string;
  record: Record<string, unknown>;
}) => (
  <>
    <label>
      Nombre del documento
      <input
        required
        className="field"
        name="name"
        defaultValue={value("name")}
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Tipo
        <select
          className="field"
          name="documentType"
          defaultValue={value("type") || "identity"}
        >
          <option value="identity">Identidad</option>
          <option value="contract">Contrato</option>
          <option value="cv">CV</option>
          <option value="certificate">Certificación</option>
          <option value="training">Capacitación</option>
          <option value="evaluation">Evaluación</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "valid"}
        >
          <option value="valid">Vigente</option>
          <option value="pending">Pendiente</option>
          <option value="expiring">Por vencer</option>
          <option value="expired">Vencido</option>
        </select>
      </label>
      <label>
        Emisión
        <input
          className="field"
          type="date"
          name="issuedAt"
          defaultValue={value("issuedAt")}
        />
      </label>
      <label>
        Vencimiento
        <input
          className="field"
          type="date"
          name="expiresAt"
          defaultValue={value("expiresAt")}
        />
      </label>
    </div>
    <label>
      Referencia segura{" "}
      <span className="font-normal text-muted-foreground">(URL opcional)</span>
      <input
        className="field"
        type="url"
        name="referenceUrl"
        defaultValue={value("referenceUrl")}
      />
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name="private"
        defaultChecked={record.private !== false}
      />{" "}
      Documento privado
    </label>
    <label>
      Notas
      <textarea
        className="field min-h-20"
        name="notes"
        defaultValue={value("notes")}
      />
    </label>
  </>
);
const LifecycleFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <label>
      Paso
      <input
        className="field"
        name="title"
        required
        defaultValue={value("title")}
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Etapa
        <select
          className="field"
          name="stage"
          defaultValue={value("stage") || "onboarding"}
        >
          <option value="onboarding">Onboarding</option>
          <option value="offboarding">Offboarding</option>
        </select>
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "pending"}
        >
          <option value="pending">Pendiente</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completado</option>
        </select>
      </label>
      <label>
        Fecha límite
        <input
          className="field"
          type="date"
          name="dueDate"
          defaultValue={value("dueDate")}
        />
      </label>
    </div>
    <label>
      Notas
      <textarea
        className="field min-h-20"
        name="notes"
        defaultValue={value("notes")}
      />
    </label>
  </>
);
const GoalFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <label>
      Objetivo
      <input
        className="field"
        name="title"
        required
        defaultValue={value("title")}
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Meta
        <input className="field" name="target" defaultValue={value("target")} />
      </label>
      <label>
        Progreso %
        <input
          className="field"
          type="number"
          min="0"
          max="100"
          name="progress"
          defaultValue={value("progress") || "0"}
        />
      </label>
      <label>
        Fecha objetivo
        <input
          className="field"
          type="date"
          name="dueDate"
          defaultValue={value("dueDate")}
        />
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "active"}
        >
          <option value="active">Activo</option>
          <option value="paused">Pausado</option>
          <option value="completed">Completado</option>
        </select>
      </label>
    </div>
  </>
);
const ReviewFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <label>
      Período
      <input
        className="field"
        name="period"
        required
        defaultValue={value("period")}
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Calificación (0–100)
        <input
          className="field"
          type="number"
          name="score"
          min="0"
          max="100"
          defaultValue={value("score")}
        />
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "shared"}
        >
          <option value="draft">Borrador</option>
          <option value="shared">Compartida</option>
          <option value="acknowledged">Confirmada</option>
        </select>
      </label>
    </div>
    <label>
      Fortalezas
      <textarea
        className="field min-h-20"
        name="strengths"
        defaultValue={value("strengths")}
      />
    </label>
    <label>
      Áreas de mejora
      <textarea
        className="field min-h-20"
        name="improvements"
        defaultValue={value("improvements")}
      />
    </label>
    <label>
      Comentarios
      <textarea
        className="field min-h-20"
        name="comments"
        defaultValue={value("comments")}
      />
    </label>
  </>
);
const TrainingFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <label>
      Capacitación
      <input
        className="field"
        name="title"
        required
        defaultValue={value("title")}
      />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Proveedor
        <input
          className="field"
          name="provider"
          defaultValue={value("provider")}
        />
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "assigned"}
        >
          <option value="assigned">Asignada</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completada</option>
          <option value="expired">Vencida</option>
        </select>
      </label>
      <label>
        Finalización
        <input
          className="field"
          type="date"
          name="completedAt"
          defaultValue={value("completedAt")}
        />
      </label>
      <label>
        Vencimiento
        <input
          className="field"
          type="date"
          name="expiresAt"
          defaultValue={value("expiresAt")}
        />
      </label>
      <label>
        Costo
        <input
          className="field"
          type="number"
          min="0"
          step=".01"
          name="cost"
          defaultValue={value("cost")}
        />
      </label>
    </div>
  </>
);
const RecognitionFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <label>
      Título
      <input
        className="field"
        name="title"
        required
        defaultValue={value("title")}
      />
    </label>
    <label>
      Mensaje
      <textarea
        className="field min-h-24"
        name="message"
        required
        defaultValue={value("message")}
      />
    </label>
    <label>
      Visibilidad
      <select
        className="field"
        name="visibility"
        defaultValue={value("visibility") || "company"}
      >
        <option value="company">Toda la empresa</option>
        <option value="private">Solo la persona</option>
      </select>
    </label>
  </>
);
const PolicyFields = ({
  value,
  record,
}: {
  value: (key: string) => string;
  record: Record<string, unknown>;
}) => (
  <>
    <label>
      Política
      <input
        className="field"
        name="title"
        required
        defaultValue={value("title")}
      />
    </label>
    <label>
      Versión
      <input
        className="field"
        name="version"
        required
        defaultValue={value("version")}
      />
    </label>
    <label>
      Contenido
      <textarea
        className="field min-h-40"
        name="content"
        required
        defaultValue={value("content")}
      />
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name="active"
        defaultChecked={record.active !== false}
      />{" "}
      Publicar versión activa
    </label>
  </>
);
const AttendanceFields = ({
  value,
  record,
}: {
  value: (key: string) => string;
  record: Record<string, unknown>;
}) => (
  <>
    <p className="rounded-xl border border-[#FFC72C]/35 bg-[#FFC72C]/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
      <strong className="text-foreground">Corrección administrativa:</strong>{" "}
      use este formulario cuando deba ajustar una marcación tardía o errónea. La
      modificación conserva el historial de quién la realizó y el motivo.
    </p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Evento
        <select
          className="field"
          name="attendanceType"
          defaultValue={value("type") || "clock_in"}
        >
          <option value="clock_in">Entrada</option>
          <option value="clock_out">Salida</option>
          <option value="break_start">Inicio de descanso</option>
          <option value="break_end">Fin de descanso</option>
        </select>
      </label>
      <label>
        Fecha
        <input
          className="field"
          type="date"
          name="date"
          required
          defaultValue={dateInput(record.occurredAt)}
        />
      </label>
      <label>
        Hora
        <input
          className="field"
          type="time"
          name="time"
          required
          defaultValue={timeInput(record.occurredAt)}
        />
      </label>
      <label>
        Origen
        <select
          className="field"
          disabled
          defaultValue={value("source") || "manual"}
        >
          <option value="manual">Administración/IT</option>
          <option value="self_service">Autoregistro original</option>
        </select>
      </label>
    </div>
    <label>
      Nota operativa
      <textarea
        className="field min-h-20"
        name="note"
        defaultValue={value("note")}
      />
    </label>
    <label>
      Motivo de la corrección
      <textarea
        className="field min-h-20"
        name="correctionReason"
        defaultValue={value("correctionReason")}
        placeholder="Ej. Ajuste autorizado por llegada sin conexión"
      />
    </label>
  </>
);
const LeaveAdminFields = ({ value }: { value: (key: string) => string }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        Tipo
        <select
          className="field"
          name="leaveType"
          defaultValue={value("type") || "vacation"}
        >
          {Object.entries(leaveLabel).map(([key, item]) => (
            <option key={key} value={key}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado
        <select
          className="field"
          name="status"
          defaultValue={value("status") || "pending"}
        >
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobada</option>
          <option value="rejected">Rechazada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </label>
      <label>
        Inicio
        <input
          className="field"
          type="date"
          name="startDate"
          required
          defaultValue={value("startDate")}
        />
      </label>
      <label>
        Fin
        <input
          className="field"
          type="date"
          name="endDate"
          required
          defaultValue={value("endDate")}
        />
      </label>
    </div>
    <label>
      Motivo de la solicitud
      <textarea
        className="field min-h-20"
        name="reason"
        defaultValue={value("reason")}
      />
    </label>
    <label>
      Comentario administrativo
      <textarea
        className="field min-h-20"
        name="reviewerComment"
        defaultValue={value("reviewerComment")}
      />
    </label>
  </>
);

export default function HrPanel({
  user,
  isAdmin,
  employees,
  hrProfile,
  profiles,
  units,
  contracts,
  documents,
  schedules,
  attendance,
  guards,
  attendanceSettings,
  leaves,
  lifecycle,
  goals,
  reviews,
  training,
  recognitions,
  policies,
  acknowledgments,
}: {
  user: UserProfile;
  isAdmin: boolean;
  employees: UserProfile[];
  hrProfile: HrProfile | null;
  profiles: HrProfile[];
  units: OrganizationUnit[];
  contracts: EmploymentContract[];
  documents: HrDocument[];
  schedules: WorkSchedule[];
  attendance: AttendanceRecord[];
  guards: AttendanceGuard[];
  attendanceSettings: AttendanceSettings;
  leaves: LeaveRequest[];
  lifecycle: LifecycleChecklist[];
  goals: HrGoal[];
  reviews: PerformanceReview[];
  training: TrainingRecord[];
  recognitions: Recognition[];
  policies: HrPolicy[];
  acknowledgments: PolicyAcknowledgment[];
}) {
  const [tab, setTab] = useState<Tab>("mine");
  const [editor, setEditor] = useState<Editor>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const own = useMemo(
    () => ({
      attendance: attendance.filter(
        item => isAdmin || item.employeeId === user.id
      ),
      leaves: leaves.filter(item => isAdmin || item.employeeId === user.id),
      goals: goals.filter(item => isAdmin || item.employeeId === user.id),
      reviews: reviews.filter(item => isAdmin || item.employeeId === user.id),
      training: training.filter(item => isAdmin || item.employeeId === user.id),
      recognitions: recognitions.filter(
        item => isAdmin || item.employeeId === user.id
      ),
    }),
    [
      attendance,
      leaves,
      goals,
      reviews,
      training,
      recognitions,
      isAdmin,
      user.id,
    ]
  );
  const activeEmployees = employees.filter(item => item.status === "active");
  const activeGuard = guards.find(item => item.weekKey === isoWeekKey());
  const isCurrentGuard = activeGuard?.guardUserId === user.id;
  const ownPolicyIds = new Set(
    acknowledgments
      .filter(item => item.employeeId === user.id)
      .map(item => item.policyId)
  );
  const remove = async (
    collection:
      | "organizationUnits"
      | "workSchedules"
      | "employmentContracts"
      | "hrDocuments"
      | "lifecycleChecklists"
      | "hrGoals"
      | "performanceReviews"
      | "trainingRecords"
      | "recognitions"
      | "hrPolicies",
    item: { id: string },
    summary: string
  ) => {
    if (
      !window.confirm(
        "¿Eliminar este registro? Esta acción quedará anotada en Historial."
      )
    )
      return;
    try {
      await deleteHrAdminRecord(collection, item.id, user.id, summary);
      toast.success("Registro eliminado.");
    } catch {
      toast.error("No se pudo eliminar el registro.");
    }
  };
  const removeAttendance = async (item: AttendanceRecord) => {
    if (
      !window.confirm(
        "¿Eliminar esta marcación? La acción se conservará en Historial."
      )
    )
      return;
    try {
      await deleteHrAttendanceRecord(item.id, user.id);
      toast.success("Marcación eliminada.");
    } catch {
      toast.error("No se pudo eliminar la marcación.");
    }
  };
  const removeLeave = async (item: LeaveRequest) => {
    if (
      !window.confirm(
        "¿Eliminar esta ausencia? La acción se conservará en Historial."
      )
    )
      return;
    try {
      await deleteHrLeaveRequest(item.id, user.id);
      toast.success("Ausencia eliminada.");
    } catch {
      toast.error("No se pudo eliminar la ausencia.");
    }
  };
  const mark = async (type: AttendanceRecord["type"]) => {
    try {
      await recordOwnAttendance(user.id, user.displayName, type);
      toast.success("Marcación registrada.");
    } catch {
      toast.error(
        "No se pudo registrar la marcación. Revisa el horario permitido."
      );
    }
  };
  const tabs: Array<{
    id: Tab;
    label: string;
    icon: typeof UserRound;
    admin?: boolean;
  }> = [
    { id: "mine", label: "Mi espacio", icon: UserRound },
    { id: "people", label: "Expedientes", icon: UsersRound, admin: true },
    { id: "organization", label: "Organización", icon: Landmark, admin: true },
    {
      id: "employment",
      label: "Vida laboral",
      icon: BriefcaseBusiness,
      admin: true,
    },
    {
      id: "development",
      label: "Desarrollo",
      icon: GraduationCap,
      admin: true,
    },
    { id: "control", label: "Control", icon: ClipboardCheck, admin: true },
  ];
  return (
    <>
      <Title
        eyebrow="Gestión de Personal"
        title={isAdmin ? "Recursos Humanos" : "Mi espacio laboral"}
        detail={
          isAdmin
            ? "Expedientes, estructura, contratos y desarrollo conectados. Los códigos y unidades organizacionales son trazables y reutilizables."
            : "Consulta tu expediente, registra tu jornada, solicita ausencias y revisa tus objetivos y políticas."
        }
      />
      <div className="mt-6 flex gap-2 overflow-x-auto border-b pb-3">
        {tabs
          .filter(item => !item.admin || isAdmin)
          .map(({ id, label: text, icon: Icon }) => (
            <button
              key={id}
              className={`secondary-button shrink-0 ${tab === id ? "border-[#0F8F73] bg-[#0F8F73]/8 text-[#08745D]" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {text}
            </button>
          ))}
      </div>
      {tab === "mine" && (
        <MineSpace
          profile={hrProfile}
          user={user}
          own={own}
          policies={policies}
          ownPolicyIds={ownPolicyIds}
          onContact={() => setContactOpen(true)}
          onLeave={() => setLeaveOpen(true)}
          onMark={mark}
          onAcknowledge={async policy => {
            try {
              await acknowledgeHrPolicy(policy, user.id, user.displayName);
              toast.success("Política confirmada.");
            } catch {
              toast.error("No se pudo confirmar la política.");
            }
          }}
        />
      )}
      {tab === "mine" && isCurrentGuard && <section className="panel-card mt-7 border-[#007AFF]/25 bg-[#007AFF]/5 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Guardia semanal</p><h2 className="mt-1 text-lg font-extrabold">Te corresponde registrar la asistencia del equipo</h2><p className="mt-1 text-sm text-muted-foreground">La asignación de {activeGuard?.weekKey} queda registrada y tus marcaciones son auditables.</p></div><button className="primary-button" onClick={() => setGuardOpen(true)}>Registrar equipo<ClipboardCheck size={16} /></button></div></section>}
      {tab === "people" && isAdmin && (
        <People
          employees={employees}
          profiles={profiles}
          contracts={contracts}
          documents={documents}
          onEditor={setEditor}
        />
      )}
      {tab === "organization" && isAdmin && (
        <Organization
          units={units}
          schedules={schedules}
          onEditor={setEditor}
          onDelete={remove}
        />
      )}
      {tab === "employment" && isAdmin && (
        <Employment
          contracts={contracts}
          documents={documents}
          lifecycle={lifecycle}
          onEditor={setEditor}
          onDelete={remove}
        />
      )}
      {tab === "development" && isAdmin && (
        <Development
          goals={goals}
          reviews={reviews}
          training={training}
          recognitions={recognitions}
          policies={policies}
          onEditor={setEditor}
          onDelete={remove}
        />
      )}
      {tab === "control" && isAdmin && (
        <Control
          attendance={attendance}
          guards={guards}
          employees={employees}
          leaves={leaves}
          activeEmployees={activeEmployees.length}
          settings={attendanceSettings}
          userId={user.id}
          onEditor={setEditor}
          onDeleteAttendance={removeAttendance}
          onDeleteLeave={removeLeave}
          onReview={async (leave, status) => {
            try {
              await reviewLeaveRequest(leave.id, status, user.id);
              toast.success(
                status === "approved"
                  ? "Solicitud aprobada."
                  : "Solicitud rechazada."
              );
            } catch {
              toast.error("No se pudo actualizar la solicitud.");
            }
          }}
        />
      )}
      {contactOpen && (
        <Sheet
          title="Actualizar mis datos de contacto"
          onClose={() => setContactOpen(false)}
        >
          <ContactForm
            userId={user.id}
            profile={hrProfile}
            onDone={() => setContactOpen(false)}
          />
        </Sheet>
      )}
      {leaveOpen && (
        <Sheet
          title="Solicitar ausencia o vacaciones"
          onClose={() => setLeaveOpen(false)}
        >
          <LeaveForm
            user={user}
            profile={hrProfile}
            onDone={() => setLeaveOpen(false)}
          />
        </Sheet>
      )}
      {guardOpen && activeGuard && (
        <Sheet title="Registrar asistencia del equipo" onClose={() => setGuardOpen(false)}>
          <GuardAttendanceForm guard={activeGuard} employees={employees} onDone={() => setGuardOpen(false)} />
        </Sheet>
      )}
      {editor && (
        <Sheet
          title={
            editor.type === "profile"
              ? "Expediente laboral"
              : editor.type === "attendance"
                ? "Corregir marcación"
                : editor.type === "leave"
                  ? "Gestionar ausencia"
                  : editor.type === "unit"
                    ? "Unidad organizacional"
                    : editor.type === "schedule"
                      ? "Horario"
                      : `Gestionar ${editor.type}`
          }
          onClose={() => setEditor(null)}
        >
          <AdminEditor
            editor={editor}
            userId={user.id}
            employees={employees}
            units={units}
            schedules={schedules}
            onDone={() => setEditor(null)}
          />
        </Sheet>
      )}
    </>
  );
}

function MineSpace({
  profile,
  user,
  own,
  policies,
  ownPolicyIds,
  onContact,
  onLeave,
  onMark,
  onAcknowledge,
}: {
  profile: HrProfile | null;
  user: UserProfile;
  own: {
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
    goals: HrGoal[];
    reviews: PerformanceReview[];
    training: TrainingRecord[];
    recognitions: Recognition[];
  };
  policies: HrPolicy[];
  ownPolicyIds: Set<string>;
  onContact: () => void;
  onLeave: () => void;
  onMark: (type: AttendanceRecord["type"]) => void;
  onAcknowledge: (policy: HrPolicy) => void;
}) {
  return (
    <>
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Estado laboral"
          value={label[profile?.employmentStatus || "active"]}
          detail={profile?.position || "Sin cargo registrado"}
          icon={UserRound}
        />
        <Metric
          label="Vacaciones disponibles"
          value={`${Math.max(0, (profile?.vacationAllowanceDays || 0) - (profile?.vacationUsedDays || 0))} d`}
          detail="Según tu expediente"
          icon={CalendarCheck}
        />
        <Metric
          label="Objetivos activos"
          value={own.goals.filter(item => item.status === "active").length}
          detail="En seguimiento"
          icon={ClipboardCheck}
        />
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Mi expediente laboral</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Código y estructura asignados por Administración/IT.
            </p>
          </div>
          <button className="secondary-button" onClick={onContact}>
            Actualizar contacto
          </button>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Código", profile?.employeeCode || "Pendiente"],
            ["Cargo", profile?.position || "Pendiente"],
            [
              "Organización",
              [profile?.department, profile?.area, profile?.team]
                .filter(Boolean)
                .join(" · ") || "Pendiente",
            ],
            [
              "Horario",
              profile?.scheduleName || profile?.workDay || "Pendiente",
            ],
          ].map(([heading, value]) => (
            <div className="bg-card p-4" key={heading}>
              <p className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                {heading}
              </p>
              <p className="mt-2 font-extrabold">{value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-7 grid gap-7 xl:grid-cols-2">
        <div className="panel-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-extrabold">Asistencia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Las marcaciones se validan con la ventana configurada.
              </p>
            </div>
            <Clock3 className="text-[#0F8F73]" size={20} />
          </div>
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {[
              ["clock_in", "Registrar entrada"],
              ["clock_out", "Registrar salida"],
              ["break_start", "Iniciar descanso"],
              ["break_end", "Finalizar descanso"],
            ].map(([type, text]) => (
              <button
                key={type}
                className="secondary-button justify-start"
                onClick={() => onMark(type as AttendanceRecord["type"])}
              >
                <Clock3 size={16} />
                {text}
              </button>
            ))}
          </div>
          <div className="border-t px-5 py-4">
            {own.attendance.length ? (
              own.attendance.slice(0, 5).map(item => (
                <div
                  className="flex justify-between gap-3 border-b py-2 text-sm last:border-0"
                  key={item.id}
                >
                  <span className="font-semibold">
                    {item.type === "clock_in"
                      ? "Entrada"
                      : item.type === "clock_out"
                        ? "Salida"
                        : item.type === "break_start"
                          ? "Inicio de descanso"
                          : "Fin de descanso"}
                  </span>
                  <span className="text-muted-foreground">
                    {readable(item.occurredAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay marcaciones.
              </p>
            )}
          </div>
        </div>
        <div className="panel-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <p className="font-extrabold">Ausencias y vacaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solicita y sigue tus permisos.
              </p>
            </div>
            <button className="primary-button" onClick={onLeave}>
              <Plus size={16} />
              Solicitar
            </button>
          </div>
          {own.leaves.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Periodo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {own.leaves.slice(0, 6).map(item => (
                    <tr key={item.id}>
                      <td className="font-semibold">{leaveLabel[item.type]}</td>
                      <td>
                        {item.startDate} — {item.endDate}
                      </td>
                      <td>{label[item.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Sin solicitudes"
              detail="Las solicitudes que envíes aparecerán aquí."
            />
          )}
        </div>
      </section>
      <section className="mt-7 grid gap-7 xl:grid-cols-2">
        <div className="panel-card overflow-hidden">
          <div className="border-b px-5 py-4">
            <p className="font-extrabold">Objetivos, desempeño y formación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Información compartida por Administración/IT.
            </p>
          </div>
          {[
            ...own.goals.map(item => ({
              title: item.title,
              detail: `${item.progress}% · ${label[item.status]}`,
            })),
            ...own.reviews.map(item => ({
              title: `Evaluación · ${item.period}`,
              detail:
                item.score !== undefined
                  ? `${item.score}/100`
                  : "Sin calificación",
            })),
            ...own.training.map(item => ({
              title: item.title,
              detail: `Capacitación · ${label[item.status]}`,
            })),
          ].length ? (
            <div className="divide-y">
              {[
                ...own.goals.map(item => ({
                  title: item.title,
                  detail: `${item.progress}% · ${label[item.status]}`,
                })),
                ...own.reviews.map(item => ({
                  title: `Evaluación · ${item.period}`,
                  detail:
                    item.score !== undefined
                      ? `${item.score}/100`
                      : "Sin calificación",
                })),
                ...own.training.map(item => ({
                  title: item.title,
                  detail: `Capacitación · ${label[item.status]}`,
                })),
              ]
                .slice(0, 8)
                .map((item, index) => (
                  <div className="px-5 py-3" key={`${item.title}-${index}`}>
                    <p className="font-semibold">{item.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="Sin registros de desarrollo"
              detail="Los objetivos, evaluaciones y capacitaciones aparecerán aquí."
            />
          )}
        </div>
        <div className="panel-card overflow-hidden">
          <div className="border-b px-5 py-4">
            <p className="font-extrabold">Reconocimientos y políticas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulta y confirma las políticas vigentes.
            </p>
          </div>
          <div className="divide-y">
            {own.recognitions.map(item => (
              <div className="px-5 py-3" key={item.id}>
                <p className="font-semibold">{item.title}</p>
                <span className="text-xs text-muted-foreground">
                  {item.message}
                </span>
              </div>
            ))}
            {policies
              .filter(item => item.active)
              .map(policy => (
                <div
                  className="flex items-center justify-between gap-3 px-5 py-3"
                  key={policy.id}
                >
                  <div>
                    <p className="font-semibold">
                      {policy.title}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        v{policy.version}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {ownPolicyIds.has(policy.id)
                        ? "Confirmada"
                        : "Pendiente de lectura"}
                    </span>
                  </div>
                  {!ownPolicyIds.has(policy.id) && (
                    <button
                      className="secondary-button shrink-0"
                      onClick={() => onAcknowledge(policy)}
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              ))}
            {!own.recognitions.length && !policies.length && (
              <Empty
                title="Sin comunicaciones de RR. HH."
                detail="Las políticas y reconocimientos publicados aparecerán aquí."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function People({
  employees,
  profiles,
  contracts,
  documents,
  onEditor,
}: {
  employees: UserProfile[];
  profiles: HrProfile[];
  contracts: EmploymentContract[];
  documents: HrDocument[];
  onEditor: (editor: Editor) => void;
}) {
  const active = employees.filter(item => item.status === "active").length;
  return (
    <>
      <section className="mt-7 grid gap-4 sm:grid-cols-4">
        <Metric
          label="Personal activo"
          value={active}
          detail="Cuentas habilitadas"
          icon={UsersRound}
        />
        <Metric
          label="Expedientes"
          value={profiles.length}
          detail="Con información laboral"
          icon={FileText}
        />
        <Metric
          label="Contratos"
          value={contracts.length}
          detail="Con vigencia registrada"
          icon={BriefcaseBusiness}
        />
        <Metric
          label="Documentos"
          value={documents.length}
          detail="En expediente"
          icon={ShieldCheck}
        />
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Expedientes del Personal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Elige un integrante para crear o actualizar su expediente
              conectado a Organización.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => onEditor({ type: "profile" })}
          >
            <Plus size={16} />
            Completar expediente
          </button>
        </div>
        {employees.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Personal</th>
                  <th>Código / cargo</th>
                  <th>Organización</th>
                  <th>Horario</th>
                  <th aria-label="Editar" />
                </tr>
              </thead>
              <tbody>
                {employees.map(employee => {
                  const detail = profiles.find(
                    item => item.employeeId === employee.id
                  );
                  return (
                    <tr key={employee.id}>
                      <td>
                        <p className="font-bold">{employee.displayName}</p>
                        <span>{employee.email}</span>
                      </td>
                      <td>
                        <p className="font-mono font-bold">
                          {detail?.employeeCode || "Pendiente"}
                        </p>
                        <span>{detail?.position || "Sin cargo"}</span>
                      </td>
                      <td>
                        {[detail?.department, detail?.area, detail?.team]
                          .filter(Boolean)
                          .join(" · ") || "Sin asignar"}
                      </td>
                      <td>
                        {detail?.scheduleName ||
                          detail?.workDay ||
                          "Sin asignar"}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          title="Editar expediente"
                          onClick={() =>
                            onEditor({
                              type: "profile",
                              record: { ...detail, employeeId: employee.id },
                            })
                          }
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sin Personal registrado"
            detail="Invita o activa Personal antes de crear expedientes."
          />
        )}
      </section>
    </>
  );
}

function Organization({
  units,
  schedules,
  onEditor,
  onDelete,
}: {
  units: OrganizationUnit[];
  schedules: WorkSchedule[];
  onEditor: (editor: Editor) => void;
  onDelete: (
    collection: "organizationUnits" | "workSchedules",
    item: { id: string },
    summary: string
  ) => void;
}) {
  return (
    <section className="mt-7 grid gap-7 xl:grid-cols-2">
      <div className="panel-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Estructura organizacional</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Departamentos, áreas, equipos, cargos y sedes reutilizables en
              Expedientes.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => onEditor({ type: "unit" })}
          >
            <Plus size={16} />
            Nueva unidad
          </button>
        </div>
        {units.length ? (
          <div className="divide-y">
            {units.map(unit => (
              <div
                className="flex items-center justify-between gap-3 px-5 py-3"
                key={unit.id}
              >
                <div>
                  <p className="font-semibold">{unit.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {unit.kind} {unit.parentName ? `· ${unit.parentName}` : ""}
                  </span>
                </div>
                <ActionButtons
                  onEdit={() => onEditor({ type: "unit", record: unit })}
                  onDelete={() =>
                    onDelete(
                      "organizationUnits",
                      unit,
                      `Eliminó la unidad «${unit.name}»`
                    )
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Estructura pendiente"
            detail="Crea las unidades aquí; después estarán disponibles en Expedientes."
          />
        )}
      </div>
      <div className="panel-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Horarios y turnos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Catálogo de jornadas aplicable a cada expediente.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => onEditor({ type: "schedule" })}
          >
            <Plus size={16} />
            Nuevo horario
          </button>
        </div>
        {schedules.length ? (
          <div className="divide-y">
            {schedules.map(schedule => (
              <div
                className="flex items-center justify-between gap-3 px-5 py-3"
                key={schedule.id}
              >
                <div>
                  <p className="font-semibold">{schedule.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {schedule.days.join(", ")} · {schedule.startTime}–
                    {schedule.endTime} · descanso {schedule.breakMinutes || 0}{" "}
                    min
                  </span>
                </div>
                <ActionButtons
                  onEdit={() =>
                    onEditor({ type: "schedule", record: schedule })
                  }
                  onDelete={() =>
                    onDelete(
                      "workSchedules",
                      schedule,
                      `Eliminó el horario «${schedule.name}»`
                    )
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Sin horarios definidos"
            detail="Registra jornadas antes de asignarlas a los expedientes."
          />
        )}
      </div>
    </section>
  );
}

function Employment({
  contracts,
  documents,
  lifecycle,
  onEditor,
  onDelete,
}: {
  contracts: EmploymentContract[];
  documents: HrDocument[];
  lifecycle: LifecycleChecklist[];
  onEditor: (editor: Editor) => void;
  onDelete: (
    collection: "employmentContracts" | "hrDocuments" | "lifecycleChecklists",
    item: { id: string },
    summary: string
  ) => void;
}) {
  return (
    <>
      <section className="mt-7 grid gap-7 xl:grid-cols-2">
        <RecordTable
          title="Contratos"
          detail="Vigencias y condiciones de acceso exclusivo administrativo."
          button="Registrar contrato"
          rows={contracts}
          empty="Sin contratos registrados"
          onCreate={() => onEditor({ type: "contract" })}
          onEdit={item => onEditor({ type: "contract", record: item })}
          onDelete={item =>
            onDelete("employmentContracts", item, "Eliminó un contrato laboral")
          }
          render={item => (
            <>
              <td>
                <p className="font-semibold">{item.employeeName}</p>
                <span>{item.position || "Sin cargo"}</span>
              </td>
              <td>{item.contractType}</td>
              <td>
                {item.startDate} {item.endDate ? `— ${item.endDate}` : ""}
              </td>
              <td>{label[item.status] || item.status}</td>
            </>
          )}
          headers={["Personal", "Tipo", "Vigencia", "Estado"]}
        />
        <RecordTable
          title="Documentos del expediente"
          detail="Referencias y vigencias; los archivos sensibles permanecen restringidos."
          button="Registrar documento"
          rows={documents}
          empty="Sin documentos registrados"
          onCreate={() => onEditor({ type: "document" })}
          onEdit={item => onEditor({ type: "document", record: item })}
          onDelete={item =>
            onDelete("hrDocuments", item, `Eliminó el documento «${item.name}»`)
          }
          render={item => (
            <>
              <td>
                <p className="font-semibold">{item.name}</p>
                <span>{item.employeeName}</span>
              </td>
              <td>{item.type}</td>
              <td>{item.expiresAt || "Sin vencimiento"}</td>
              <td>{label[item.status] || item.status}</td>
            </>
          )}
          headers={["Documento", "Tipo", "Vencimiento", "Estado"]}
        />
      </section>
      <RecordTable
        title="Onboarding y offboarding"
        detail="Pasos que permiten ordenar incorporaciones y salidas."
        button="Nuevo paso"
        rows={lifecycle}
        empty="Sin pasos de ciclo laboral"
        onCreate={() => onEditor({ type: "lifecycle" })}
        onEdit={item => onEditor({ type: "lifecycle", record: item })}
        onDelete={item =>
          onDelete(
            "lifecycleChecklists",
            item,
            "Eliminó un paso del ciclo laboral"
          )
        }
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.title}</p>
              <span>{item.employeeName}</span>
            </td>
            <td>{item.stage}</td>
            <td>{item.dueDate || "Sin fecha"}</td>
            <td>{label[item.status] || item.status}</td>
          </>
        )}
        headers={["Paso", "Etapa", "Vencimiento", "Estado"]}
      />
    </>
  );
}

function Development({
  goals,
  reviews,
  training,
  recognitions,
  policies,
  onEditor,
  onDelete,
}: {
  goals: HrGoal[];
  reviews: PerformanceReview[];
  training: TrainingRecord[];
  recognitions: Recognition[];
  policies: HrPolicy[];
  onEditor: (editor: Editor) => void;
  onDelete: (
    collection:
      | "hrGoals"
      | "performanceReviews"
      | "trainingRecords"
      | "recognitions"
      | "hrPolicies",
    item: { id: string },
    summary: string
  ) => void;
}) {
  return (
    <section className="mt-7 grid gap-7 xl:grid-cols-2">
      <RecordTable
        title="Objetivos"
        detail="Metas individuales y progreso."
        button="Nuevo objetivo"
        rows={goals}
        empty="Sin objetivos"
        onCreate={() => onEditor({ type: "goal" })}
        onEdit={item => onEditor({ type: "goal", record: item })}
        onDelete={item => onDelete("hrGoals", item, "Eliminó un objetivo")}
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.title}</p>
              <span>{item.employeeName}</span>
            </td>
            <td>{item.progress}%</td>
            <td>{item.dueDate || "Sin fecha"}</td>
            <td>{label[item.status] || item.status}</td>
          </>
        )}
        headers={["Objetivo", "Progreso", "Fecha", "Estado"]}
      />
      <RecordTable
        title="Evaluaciones"
        detail="Registro privado del desempeño compartido."
        button="Nueva evaluación"
        rows={reviews}
        empty="Sin evaluaciones"
        onCreate={() => onEditor({ type: "review" })}
        onEdit={item => onEditor({ type: "review", record: item })}
        onDelete={item =>
          onDelete("performanceReviews", item, "Eliminó una evaluación")
        }
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.employeeName}</p>
              <span>{item.period}</span>
            </td>
            <td>{item.score ?? "—"}</td>
            <td>{label[item.status] || item.status}</td>
            <td>{readable(item.updatedAt)}</td>
          </>
        )}
        headers={["Personal", "Puntaje", "Estado", "Actualización"]}
      />
      <RecordTable
        title="Capacitaciones"
        detail="Seguimiento de formación, proveedor y vigencia."
        button="Nueva capacitación"
        rows={training}
        empty="Sin capacitaciones"
        onCreate={() => onEditor({ type: "training" })}
        onEdit={item => onEditor({ type: "training", record: item })}
        onDelete={item =>
          onDelete("trainingRecords", item, "Eliminó una capacitación")
        }
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.title}</p>
              <span>{item.employeeName}</span>
            </td>
            <td>{item.provider || "—"}</td>
            <td>{item.expiresAt || "—"}</td>
            <td>{label[item.status] || item.status}</td>
          </>
        )}
        headers={["Capacitación", "Proveedor", "Vencimiento", "Estado"]}
      />
      <RecordTable
        title="Reconocimientos"
        detail="Reconocimientos privados o visibles para la empresa."
        button="Nuevo reconocimiento"
        rows={recognitions}
        empty="Sin reconocimientos"
        onCreate={() => onEditor({ type: "recognition" })}
        onEdit={item => onEditor({ type: "recognition", record: item })}
        onDelete={item =>
          onDelete("recognitions", item, "Eliminó un reconocimiento")
        }
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.title}</p>
              <span>{item.employeeName}</span>
            </td>
            <td>{item.visibility === "company" ? "Empresa" : "Privado"}</td>
            <td colSpan={2}>{item.message}</td>
          </>
        )}
        headers={["Reconocimiento", "Visibilidad", "Mensaje", ""]}
      />
      <RecordTable
        title="Políticas"
        detail="Versiones activas disponibles para confirmación del Personal."
        button="Nueva política"
        rows={policies}
        empty="Sin políticas"
        onCreate={() => onEditor({ type: "policy" })}
        onEdit={item => onEditor({ type: "policy", record: item })}
        onDelete={item => onDelete("hrPolicies", item, "Eliminó una política")}
        render={item => (
          <>
            <td>
              <p className="font-semibold">{item.title}</p>
              <span>v{item.version}</span>
            </td>
            <td>{item.active ? "Activa" : "Borrador"}</td>
            <td colSpan={2}>{readable(item.updatedAt)}</td>
          </>
        )}
        headers={["Política", "Estado", "Actualización", ""]}
      />
    </section>
  );
}

function RecordTable<T extends { id: string }>({
  title,
  detail,
  button,
  rows,
  empty,
  onCreate,
  onEdit,
  onDelete,
  render,
  headers,
}: {
  title: string;
  detail: string;
  button: string;
  rows: T[];
  empty: string;
  onCreate: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  render: (item: T) => ReactNode;
  headers: string[];
}) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="font-extrabold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={16} />
          {button}
        </button>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((heading, index) => (
                  <th key={`${heading}-${index}`}>{heading}</th>
                ))}
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rows.map(item => (
                <tr key={item.id}>
                  {render(item)}
                  <td>
                    <ActionButtons
                      onEdit={() => onEdit(item)}
                      onDelete={() => onDelete(item)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={empty}
          detail="Crea el primer registro desde este panel; podrás editarlo o eliminarlo posteriormente."
        />
      )}
    </section>
  );
}

function Control({
  attendance,
  guards,
  employees,
  leaves,
  activeEmployees,
  settings,
  userId,
  onReview,
  onEditor,
  onDeleteAttendance,
  onDeleteLeave,
}: {
  attendance: AttendanceRecord[];
  guards: AttendanceGuard[];
  employees: UserProfile[];
  leaves: LeaveRequest[];
  activeEmployees: number;
  settings: AttendanceSettings;
  userId: string;
  onReview: (leave: LeaveRequest, status: LeaveRequest["status"]) => void;
  onEditor: (editor: Editor) => void;
  onDeleteAttendance: (item: AttendanceRecord) => void;
  onDeleteLeave: (item: LeaveRequest) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<string[]>(
    []
  );
  const [bulkAttendanceType, setBulkAttendanceType] =
    useState<AttendanceRecord["type"]>("clock_in");
  const [bulkAttendanceReason, setBulkAttendanceReason] = useState("");
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const rules: Array<{
    key: keyof Pick<
      AttendanceSettings,
      "clockIn" | "clockOut" | "breakStart" | "breakEnd"
    >;
    title: string;
  }> = [
    { key: "clockIn", title: "Entrada" },
    { key: "clockOut", title: "Salida" },
    { key: "breakStart", title: "Inicio de descanso" },
    { key: "breakEnd", title: "Fin de descanso" },
  ];
  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const get = (key: (typeof rules)[number]["key"]) => ({
      startTime: String(form.get(`${key}-start`)),
      endTime: String(form.get(`${key}-end`)),
      maxPerDay: Number(form.get(`${key}-max`)) || 1,
    });
    try {
      await updateAttendanceSettings(
        {
          ...settings,
          clockIn: get("clockIn"),
          clockOut: get("clockOut"),
          breakStart: get("breakStart"),
          breakEnd: get("breakEnd"),
        },
        userId
      );
      toast.success(
        "Política de asistencia actualizada para todo el Personal."
      );
    } catch {
      toast.error("No se pudo actualizar la política de asistencia.");
    } finally {
      setSaving(false);
    }
  };
  const recentAttendance = attendance.slice(0, 50);
  const currentWeekKey = isoWeekKey();
  const nextWeekKey = isoWeekKey(new Date(Date.now() + 7 * 86_400_000));
  const currentGuard = guards.find(item => item.weekKey === currentWeekKey);
  const activeGuardCandidates = employees.filter(item => item.status === "active");
  const saveGuard = async (weekKey: string, override = false) => {
    const previousGuard = guards.filter(item => String(item.weekKey).localeCompare(weekKey) < 0).sort((left, right) => String(right.weekKey).localeCompare(String(left.weekKey)))[0] || guards.find(item => item.weekKey === currentWeekKey);
    const previousIndex = activeGuardCandidates.findIndex(item => item.id === previousGuard?.guardUserId);
    const rotated = activeGuardCandidates[(previousIndex + 1 + activeGuardCandidates.length) % activeGuardCandidates.length];
    const selected = activeGuardCandidates.find(item => item.id === selectedGuardId) || (override ? undefined : rotated);
    if (!selected) { toast.error("Selecciona a la persona responsable de la guardia."); return; }
    try { await assignAttendanceGuard(weekKey, selected, userId, override || Boolean(guards.find(item => item.weekKey === weekKey))); setSelectedGuardId(""); toast.success(`Guardia de ${weekKey} asignada a ${selected.displayName}.`); }
    catch (error) {
      const code = (error as { code?: string })?.code || "";
      toast.error(code.includes("permission-denied") ? "Firebase rechazó la guardia: publica las reglas actuales de Firestore y vuelve a intentarlo." : "No se pudo guardar la guardia semanal. Comprueba la conexión e inténtalo nuevamente.");
    }
  };
  const toggleAttendance = (id: string) =>
    setSelectedAttendanceIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  const toggleAllAttendance = () =>
    setSelectedAttendanceIds(current =>
      recentAttendance.length &&
      recentAttendance.every(item => current.includes(item.id))
        ? current.filter(id => !recentAttendance.some(item => item.id === id))
        : Array.from(
            new Set([...current, ...recentAttendance.map(item => item.id)])
          )
    );
  const applyBulkAttendance = async () => {
    if (!selectedAttendanceIds.length) return;
    if (
      !window.confirm(
        `¿Corregir ${selectedAttendanceIds.length} marcación${selectedAttendanceIds.length === 1 ? "" : "es"} con el evento seleccionado?`
      )
    )
      return;
    try {
      await bulkUpdateAttendanceRecords(
        selectedAttendanceIds,
        {
          type: bulkAttendanceType,
          correctionReason:
            bulkAttendanceReason.trim() || "Corrección administrativa masiva",
        },
        userId
      );
      setSelectedAttendanceIds([]);
      setBulkAttendanceReason("");
      toast.success("Marcaciones corregidas y anotadas en Historial.");
    } catch {
      toast.error(
        "No se pudieron corregir todas las marcaciones seleccionadas."
      );
    }
  };
  const deleteBulkAttendance = async () => {
    if (
      !selectedAttendanceIds.length ||
      !window.confirm(
        `¿Eliminar ${selectedAttendanceIds.length} marcación${selectedAttendanceIds.length === 1 ? "" : "es"} seleccionada${selectedAttendanceIds.length === 1 ? "" : "s"}? Esta acción quedará anotada en Historial.`
      )
    )
      return;
    try {
      await bulkDeleteHrAttendanceRecords(selectedAttendanceIds, userId);
      setSelectedAttendanceIds([]);
      toast.success("Marcaciones eliminadas y anotadas en Historial.");
    } catch {
      toast.error(
        "No se pudieron eliminar todas las marcaciones seleccionadas."
      );
    }
  };
  return (
    <>
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Personal activo"
          value={activeEmployees}
          detail="Con acceso habilitado"
          icon={UsersRound}
        />
        <Metric
          label="Solicitudes pendientes"
          value={leaves.filter(item => item.status === "pending").length}
          detail="Por revisar"
          icon={CalendarCheck}
        />
        <Metric
          label="Marcaciones"
          value={attendance.length}
          detail="Registros sincronizados"
          icon={Clock3}
        />
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4"><div><p className="font-extrabold">Guardia semanal de asistencia</p><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Cada jueves, la persona asignada registra la asistencia del equipo. La rotación propone a una persona diferente de la última guardia; Administración/IT puede corregirla en cualquier momento.</p></div><span className="rounded-full bg-[#007AFF]/10 px-3 py-1 text-xs font-bold text-[#007AFF]">{currentWeekKey}</span></div>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end"><div>{currentGuard ? <><p className="text-sm text-muted-foreground">Responsable de esta semana</p><p className="mt-1 text-lg font-extrabold">{currentGuard.guardUserName}</p><p className="mt-1 text-xs text-muted-foreground">Asignada por {currentGuard.assignedByName || "Administración/IT"}{currentGuard.overriddenBy ? " · reasignación registrada" : ""}</p></> : <><p className="text-sm font-bold text-[#C53B53]">Sin guardia asignada</p><p className="mt-1 text-xs text-muted-foreground">Asigna la primera persona disponible usando la rotación.</p></>}</div><div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" onClick={() => void saveGuard(currentGuard ? nextWeekKey : currentWeekKey)}>{currentGuard ? `Asignar ${nextWeekKey}` : "Asignar por rotación"}</button><select className="field !mt-0 !w-auto !py-2" value={selectedGuardId} onChange={event => setSelectedGuardId(event.target.value)}><option value="">Reasignar manualmente…</option>{activeGuardCandidates.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><button type="button" className="primary-button" disabled={!selectedGuardId} onClick={() => void saveGuard(currentWeekKey, true)}>Guardar reasignación</button></div></div>
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="border-b px-5 py-4">
          <p className="font-extrabold">Ventanas de marcación</p>
          <p className="mt-1 text-xs text-muted-foreground">
            La hora local del dispositivo se valida antes de crear una entrada,
            salida o descanso. El límite se aplica por persona, tipo y día.
          </p>
        </div>
        <form className="p-5" onSubmit={savePolicy}>
          <div className="grid gap-4 md:grid-cols-2">
            {rules.map(({ key, title }) => (
              <fieldset className="rounded-xl border bg-muted/25 p-4" key={key}>
                <legend className="px-1 text-sm font-extrabold">{title}</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="text-xs font-bold">
                    Desde
                    <input
                      className="field mt-1"
                      type="time"
                      name={`${key}-start`}
                      defaultValue={settings[key].startTime}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Hasta
                    <input
                      className="field mt-1"
                      type="time"
                      name={`${key}-end`}
                      defaultValue={settings[key].endTime}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Límite/día
                    <input
                      className="field mt-1"
                      type="number"
                      min="1"
                      max="12"
                      name={`${key}-max`}
                      defaultValue={settings[key].maxPerDay}
                    />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
          <button className="primary-button mt-5" disabled={saving}>
            {saving ? "Guardando…" : "Guardar política de asistencia"}
            <ChevronRight size={16} />
          </button>
        </form>
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Solicitudes de ausencia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Administración/IT puede corregir fechas, estado, motivo y
              comentarios; cada cambio queda en Historial.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => onEditor({ type: "leave" })}
          >
            <Plus size={16} />
            Registrar ausencia
          </button>
        </div>
        {leaves.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Personal</th>
                  <th>Tipo</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {leaves.map(leave => (
                  <tr key={leave.id}>
                    <td className="font-semibold">{leave.employeeName}</td>
                    <td>{leaveLabel[leave.type]}</td>
                    <td>
                      {leave.startDate} — {leave.endDate}
                    </td>
                    <td>{label[leave.status]}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {leave.status === "pending" && (
                          <>
                            <button
                              className="secondary-button"
                              onClick={() => onReview(leave, "rejected")}
                            >
                              Rechazar
                            </button>
                            <button
                              className="primary-button"
                              onClick={() => onReview(leave, "approved")}
                            >
                              Aprobar
                            </button>
                          </>
                        )}
                        <button
                          className="icon-button"
                          title="Editar ausencia"
                          onClick={() =>
                            onEditor({ type: "leave", record: leave })
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Eliminar ausencia"
                          onClick={() => onDeleteLeave(leave)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sin solicitudes pendientes"
            detail="Las solicitudes del Personal se mostrarán aquí."
          />
        )}
      </section>
      <section className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-extrabold">Marcaciones recientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecciona varias para corregir el evento o eliminarlas con
              trazabilidad administrativa.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => onEditor({ type: "attendance" })}
          >
            <Plus size={16} />
            Registrar marcación
          </button>
        </div>
        {selectedAttendanceIds.length > 0 && (
          <div className="bulk-action-bar">
            <div>
              <p className="text-sm font-extrabold">
                {selectedAttendanceIds.length} marcación
                {selectedAttendanceIds.length === 1 ? "" : "es"} seleccionada
                {selectedAttendanceIds.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                La corrección conserva el motivo y el responsable
                administrativo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="field !mt-0 !w-auto !py-2"
                value={bulkAttendanceType}
                onChange={event =>
                  setBulkAttendanceType(
                    event.target.value as AttendanceRecord["type"]
                  )
                }
              >
                <option value="clock_in">Entrada</option>
                <option value="clock_out">Salida</option>
                <option value="break_start">Inicio de descanso</option>
                <option value="break_end">Fin de descanso</option>
              </select>
              <input
                className="field !mt-0 min-w-52 !py-2"
                value={bulkAttendanceReason}
                onChange={event => setBulkAttendanceReason(event.target.value)}
                placeholder="Motivo de corrección"
              />
              <button
                className="secondary-button"
                onClick={() => void applyBulkAttendance()}
              >
                Corregir
              </button>
              <button
                className="secondary-button text-destructive"
                onClick={() => void deleteBulkAttendance()}
              >
                <Trash2 size={16} />
                Eliminar
              </button>
              <button
                className="secondary-button"
                onClick={() => setSelectedAttendanceIds([])}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
        {attendance.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      aria-label="Seleccionar todas las marcaciones recientes"
                      type="checkbox"
                      checked={
                        recentAttendance.length > 0 &&
                        recentAttendance.every(item =>
                          selectedAttendanceIds.includes(item.id)
                        )
                      }
                      onChange={toggleAllAttendance}
                    />
                  </th>
                  <th>Personal</th>
                  <th>Evento</th>
                  <th>Hora</th>
                  <th>Origen</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map(item => (
                  <tr key={item.id}>
                    <td>
                      <input
                        aria-label={`Seleccionar marcación de ${item.employeeName}`}
                        type="checkbox"
                        checked={selectedAttendanceIds.includes(item.id)}
                        onChange={() => toggleAttendance(item.id)}
                      />
                    </td>
                    <td className="font-semibold">{item.employeeName}</td>
                    <td>{item.type}</td>
                    <td>{readable(item.occurredAt)}</td>
                    <td>
                      {item.source === "self_service"
                        ? "Personal"
                        : "Administración/IT"}
                      {item.adjustedByName
                        ? ` · corregido por ${item.adjustedByName}`
                        : ""}
                    </td>
                    <td>
                      <ActionButtons
                        onEdit={() =>
                          onEditor({ type: "attendance", record: item })
                        }
                        onDelete={() => onDeleteAttendance(item)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sin marcaciones"
            detail="Las entradas, salidas y descansos registrados aparecerán aquí."
          />
        )}
      </section>
    </>
  );
}
