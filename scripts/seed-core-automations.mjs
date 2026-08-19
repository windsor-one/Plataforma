import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function account() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT.");
  for (const candidate of [value.trim(), Buffer.from(value.trim(), "base64").toString("utf8")]) {
    try { const parsed = JSON.parse(candidate); const item = typeof parsed === "string" ? JSON.parse(parsed) : parsed; if (item?.type === "service_account" && item?.private_key) return item; } catch { /* siguiente formato */ }
  }
  throw new Error("El secreto no es una cuenta de servicio válida.");
}

const serviceAccount = account();
const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore(app);
const defaults = [
  { id: "weekly-attendance-guard", name: "Rotación semanal de asistencia", trigger: "weekly_attendance", action: "assign_guard", description: "Asigna la guardia semanal sin repetir a la persona anterior.", status: "active" },
  { id: "close-expired-update-requests", name: "Cierre de solicitudes vencidas", trigger: "update_deadline", action: "close_request", description: "Cierra las solicitudes que superaron su fecha límite.", status: "active" },
  { id: "contract-expiry-alerts", name: "Alertas de vencimiento de contratos", trigger: "contract_expiry", action: "send_notification", description: "Publica un aviso cuando un contrato vence en los próximos 30 días.", status: "active" },
  { id: "document-expiry-alerts", name: "Alertas de vencimiento de documentos", trigger: "document_expiry", action: "send_notification", description: "Publica un aviso cuando un documento vence en los próximos 30 días.", status: "active" },
];
for (const item of defaults) {
  const reference = db.collection("automations").doc(item.id);
  if (!(await reference.get()).exists) await reference.set({ ...item, createdBy: "system", createdByName: "Configuración inicial", runCount: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
console.log(JSON.stringify({ ok: true, seeded: defaults.map(item => item.id) }));
