import type { UpdateRequestModule } from "./types";

export interface RequestFieldOption {
  id: string;
  label: string;
}

export interface RequestSubmoduleDefinition {
  id: string;
  label: string;
  description: string;
  collection?: string;
  fields: RequestFieldOption[];
}

const fields = (...items: Array<[string, string]>): RequestFieldOption[] => items.map(([id, label]) => ({ id, label }));

const definitions = (items: Array<Omit<RequestSubmoduleDefinition, "fields"> & { fields?: RequestFieldOption[] }>) =>
  items.map((item) => ({ ...item, fields: item.fields || fields(["general", "Información indicada en las instrucciones"]) }));

export const requestSubmodules: Record<UpdateRequestModule, RequestSubmoduleDefinition[]> = {
  profile: definitions([
    { id: "account", label: "Datos de mi cuenta", description: "Nombre, correo y datos básicos del perfil de acceso.", collection: "users", fields: fields(["displayName", "Nombre visible"], ["email", "Correo"], ["status", "Estado de la cuenta"]) },
  ]),
  hr: definitions([
    { id: "records", label: "Expedientes del Personal", description: "Datos laborales, código, cargo, unidad y supervisor.", collection: "hrProfiles", fields: fields(["employeeCode", "Código EMP"], ["position", "Cargo"], ["department", "Departamento"], ["area", "Área"], ["team", "Equipo"], ["supervisorId", "Supervisor"], ["scheduleId", "Horario"], ["workMode", "Modalidad de trabajo"]) },
    { id: "organization", label: "Organización", description: "Departamentos, áreas, equipos, cargos y sedes.", collection: "organizationUnits", fields: fields(["name", "Nombre de unidad"], ["kind", "Categoría organizacional"], ["parentId", "Unidad superior"], ["leaderId", "Responsable"], ["active", "Estado"]) },
    { id: "contracts", label: "Contratos", description: "Vigencia, modalidad, jornada y remuneración contractual.", collection: "employmentContracts", fields: fields(["contractType", "Tipo de contrato"], ["status", "Estado"], ["startDate", "Inicio"], ["endDate", "Fin"], ["workMode", "Modalidad"], ["salaryAmount", "Salario"], ["hourlyRate", "Tarifa por hora"]) },
    { id: "documents", label: "Documentos de expedientes", description: "Documentos, certificados y vigencias del Personal.", collection: "hrDocuments", fields: fields(["name", "Nombre del documento"], ["type", "Tipo"], ["status", "Estado"], ["issuedAt", "Fecha de emisión"], ["expiresAt", "Fecha de vencimiento"], ["referenceUrl", "Referencia"]) },
    { id: "schedules", label: "Horarios y jornadas", description: "Horarios presenciales, home office, recesos y turnos.", collection: "workSchedules", fields: fields(["name", "Nombre del horario"], ["days", "Días"], ["startTime", "Hora de inicio"], ["endTime", "Hora de salida"], ["breakMinutes", "Receso"], ["workMode", "Modalidad"]) },
    { id: "attendance", label: "Asistencia y marcaciones", description: "Entradas, salidas, recesos y correcciones administrativas.", collection: "attendanceRecords", fields: fields(["type", "Tipo de marcación"], ["occurredAt", "Fecha y hora"], ["dayKey", "Día laboral"], ["note", "Nota"], ["correctionReason", "Motivo de corrección"]) },
    { id: "leaves", label: "Ausencias y permisos", description: "Vacaciones, permisos, incapacidades y ausencias.", collection: "leaveRequests", fields: fields(["type", "Tipo de ausencia"], ["startDate", "Inicio"], ["endDate", "Fin"], ["days", "Días"], ["status", "Estado"], ["reason", "Motivo"]) },
    { id: "development", label: "Desarrollo del Personal", description: "Objetivos, evaluaciones, capacitación y reconocimientos.", collection: "hrGoals", fields: fields(["progress", "Progreso"], ["status", "Estado"], ["title", "Título"], ["notes", "Notas"]) },
    { id: "policies", label: "Políticas y acuses", description: "Políticas internas y confirmaciones de lectura.", collection: "hrPolicies", fields: fields(["title", "Título"], ["content", "Contenido"], ["status", "Estado"], ["acknowledgedAt", "Fecha de acuse"]) },
  ]),
  products: definitions([
    { id: "catalog", label: "Paquetes y productos", description: "Nombre, precio, categoría, unidad e inclusiones.", collection: "products", fields: fields(["name", "Nombre"], ["price", "Precio"], ["category", "Categoría"], ["unit", "Unidad"], ["details", "Inclusiones"], ["active", "Activo"]) },
    { id: "categories", label: "Categorías de productos", description: "Etiquetas globales de las categorías del catálogo.", collection: "productCategorySettings", fields: fields(["label", "Nombre de categoría"], ["description", "Descripción"], ["active", "Estado"]) },
  ]),
  tasks: definitions([{ id: "tasks", label: "Tareas", description: "Tareas operativas y su avance.", collection: "tasks", fields: fields(["title", "Título"], ["description", "Descripción"], ["priority", "Prioridad"], ["status", "Estado"], ["dueDate", "Fecha límite"], ["assignedToId", "Responsable"]) }]),
  reservations: definitions([{ id: "reservations", label: "Reservas", description: "Reserva, cliente, paquete, fecha y estado.", collection: "reservations", fields: fields(["customerId", "Cliente"], ["productId", "Paquete"], ["date", "Fecha"], ["time", "Hora"], ["status", "Estado"], ["notes", "Notas"]) }]),
  customers: definitions([{ id: "customers", label: "Clientes", description: "Datos de contacto y seguimiento del cliente.", collection: "customers", fields: fields(["firstName", "Nombre"], ["lastName", "Apellido"], ["email", "Correo"], ["phone", "Teléfono"], ["notes", "Notas"]) }]),
  payments: definitions([{ id: "payments", label: "Pagos y cuotas", description: "Cuotas, importes, moneda, método y estado.", collection: "payments", fields: fields(["amount", "Importe"], ["currency", "Moneda"], ["kind", "Tipo de cuota"], ["method", "Método"], ["status", "Estado"], ["paidAt", "Fecha de pago"], ["notes", "Notas"]) }]),
  employees: definitions([{ id: "employees", label: "Personal y cuentas", description: "Directorio, estado y rol de acceso.", collection: "users", fields: fields(["displayName", "Nombre"], ["email", "Correo"], ["role", "Rol"], ["status", "Estado"]) }]),
  calendar: definitions([{ id: "calendar", label: "Calendario operativo", description: "Eventos y agenda compartida del equipo.", collection: "reservations", fields: fields(["date", "Fecha"], ["time", "Hora"], ["status", "Estado"], ["notes", "Notas"]) }]),
  mail: definitions([{ id: "mail", label: "Correo interno", description: "Mensajes enviados, recibidos y programados.", collection: "internalMessages", fields: fields(["subject", "Asunto"], ["body", "Contenido"], ["recipientIds", "Destinatarios"], ["status", "Estado"], ["scheduledFor", "Programación"]) }]),
  updates: definitions([{ id: "updates", label: "Solicitudes y permisos", description: "Solicitudes, alcance, acciones y vencimientos.", collection: "updateRequests", fields: fields(["module", "Módulo"], ["submodule", "Submódulo"], ["scope", "Alcance"], ["allowedActions", "Acciones"], ["fields", "Campos autorizados"], ["deadline", "Fecha límite"], ["status", "Estado"]) }]),
  automations: definitions([{ id: "automations", label: "Automatizaciones", description: "Reglas automáticas de operación y alertas.", collection: "automations", fields: fields(["name", "Nombre"], ["trigger", "Disparador"], ["action", "Acción"], ["status", "Estado"]) }]),
  hr_reports: definitions([{ id: "hr-reports", label: "Informes de RR. HH.", description: "Reportes de expedientes, asistencia y ausencias.", collection: "attendanceRecords", fields: fields(["from", "Período inicial"], ["to", "Período final"], ["employeeId", "Personal"], ["department", "Departamento"]) }]),
  performance: definitions([{ id: "performance", label: "Rendimiento y desarrollo", description: "Objetivos, tareas, evaluaciones y capacitación.", collection: "performanceReviews", fields: fields(["score", "Puntuación"], ["status", "Estado"], ["comments", "Comentarios"], ["sharedAt", "Fecha compartida"]) }]),
  impact: definitions([{ id: "impact", label: "Impacto digital", description: "Uso digital registrado por sesión y módulo.", collection: "carbonUsage", fields: fields(["module", "Módulo"], ["durationSeconds", "Duración"], ["interactions", "Interacciones"], ["pageViews", "Vistas"]) }]),
  finance: definitions([
    { id: "expenses", label: "Gastos y compromisos", description: "Gastos, proveedores, categorías, importes y estados.", collection: "expenses", fields: fields(["concept", "Concepto"], ["category", "Categoría"], ["amount", "Importe"], ["currency", "Moneda"], ["status", "Estado"], ["spentAt", "Fecha"]) },
    { id: "payments", label: "Cobros y cartera", description: "Pagos registrados, cuotas y saldos de reservas.", collection: "payments", fields: fields(["amount", "Importe"], ["currency", "Moneda"], ["status", "Estado"], ["paidAt", "Fecha de pago"]) },
  ]),
  history: definitions([{ id: "history", label: "Historial de actividad", description: "Eventos inmutables de trazabilidad del sistema.", collection: "activityLogs", fields: fields(["action", "Acción"], ["entity", "Entidad"], ["summary", "Resumen"]) }]),
  operations: definitions([
    { id: "reservations", label: "Operación de reservas", description: "Reservas y agenda de servicios.", collection: "reservations", fields: fields(["status", "Estado"], ["assignedToId", "Responsable"], ["date", "Fecha"], ["time", "Hora"]) },
    { id: "tasks", label: "Operación de tareas", description: "Trabajo pendiente y responsables.", collection: "tasks", fields: fields(["status", "Estado"], ["priority", "Prioridad"], ["assignedToId", "Responsable"], ["dueDate", "Fecha límite"]) },
  ]),
  access: definitions([{ id: "access", label: "Seguridad y accesos", description: "Registros de acceso y actividad técnica.", collection: "accessLogs", fields: fields(["action", "Acción"], ["ip", "Dirección de red"], ["userAgent", "Dispositivo"], ["createdAt", "Fecha y hora"]) }]),
  pending: definitions([{ id: "pending", label: "Panel de pendientes", description: "Indicadores administrativos derivados de datos conectados.", fields: fields(["count", "Cantidad"], ["source", "Origen"], ["status", "Estado"]) }]),
  reminders: definitions([{ id: "reminders", label: "Notificaciones", description: "Avisos generales y recordatorios internos.", collection: "generalReminders", fields: fields(["title", "Título"], ["detail", "Detalle"], ["priority", "Prioridad"], ["active", "Activo"], ["dueAt", "Vencimiento"]) }]),
  other: definitions([{ id: "other", label: "Otro módulo", description: "Solicitud que requiere instrucciones administrativas adicionales.", fields: fields(["general", "Resultado esperado"]) }]),
};

export const requestModuleFieldOptions = (module: UpdateRequestModule, submoduleId?: string) => {
  const submodule = requestSubmodules[module]?.find((item) => item.id === submoduleId) || requestSubmodules[module]?.[0];
  return submodule?.fields || [];
};

export const requestModuleLabel = (module: UpdateRequestModule) => requestSubmodules[module]?.[0]?.label || "Módulo";
