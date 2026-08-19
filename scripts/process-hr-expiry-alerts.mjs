import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function account() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT.");
  for (const candidate of [raw.trim(), Buffer.from(raw.trim(), "base64").toString("utf8")]) {
    try { const parsed = JSON.parse(candidate); const item = typeof parsed === "string" ? JSON.parse(parsed) : parsed; if (item?.type === "service_account" && item?.private_key) return item; } catch { /* siguiente */ }
  }
  throw new Error("Cuenta de servicio inválida.");
}

const day = (date) => new Date(`${date}T00:00:00Z`).getTime();
const today = new Date().toISOString().slice(0, 10);
const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const serviceAccount = account();
const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore(app);

async function run() {
  const automationSnapshot = await db.collection("automations").get();
  const contractAutomations = automationSnapshot.docs.filter(item => item.data().trigger === "contract_expiry" && item.data().status === "active");
  const documentAutomations = automationSnapshot.docs.filter(item => item.data().trigger === "document_expiry" && item.data().status === "active");
  const writes = [];
  const activeReminderIds = new Set();
  let notices = 0;
  if (contractAutomations.length) {
    const contracts = await db.collection("employmentContracts").get();
    contracts.docs.filter(item => { const data = item.data(); const end = data.endDate; return typeof end === "string" && data.status !== "ended" && day(end) >= day(today) && day(end) <= day(horizon); }).forEach(item => {
      const data = item.data(); const id = `automation-contract-${item.id}`; activeReminderIds.add(id);
      writes.push({ type: "set", ref: db.collection("generalReminders").doc(id), data: { id, title: `Contrato próximo a vencer: ${data.employeeName || "Personal"}`, message: `El contrato finaliza el ${data.endDate}. Revísalo o actualízalo antes del vencimiento.`, priority: "important", active: true, createdBy: "system", createdByName: "Automatización", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() } }); notices += 1;
    });
    contractAutomations.forEach(item => writes.push({ type: "update", ref: item.ref, data: { lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() } }));
  }
  if (documentAutomations.length) {
    const documents = await db.collection("hrDocuments").get();
    documents.docs.filter(item => { const data = item.data(); const expires = data.expiresAt; return typeof expires === "string" && !["expired"].includes(data.status) && day(expires) >= day(today) && day(expires) <= day(horizon); }).forEach(item => {
      const data = item.data(); const id = `automation-document-${item.id}`; activeReminderIds.add(id);
      writes.push({ type: "set", ref: db.collection("generalReminders").doc(id), data: { id, title: `Documento próximo a vencer: ${data.name || "Documento RR. HH."}`, message: `El documento de ${data.employeeName || "Personal"} vence el ${data.expiresAt}. Revisa su renovación.`, priority: "important", active: true, createdBy: "system", createdByName: "Automatización", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() } }); notices += 1;
    });
    documentAutomations.forEach(item => writes.push({ type: "update", ref: item.ref, data: { lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() } }));
  }
  const existingReminders = await db.collection("generalReminders").where("createdBy", "==", "system").get();
  existingReminders.docs.filter(item => item.id.startsWith("automation-") && !activeReminderIds.has(item.id) && item.data().active !== false).forEach(item => writes.push({ type: "update", ref: item.ref, data: { active: false, updatedAt: FieldValue.serverTimestamp() } }));
  for (let start = 0; start < writes.length; start += 400) {
    const batch = db.batch();
    writes.slice(start, start + 400).forEach(write => write.type === "set" ? batch.set(write.ref, write.data, { merge: true }) : batch.update(write.ref, write.data));
    await batch.commit();
  }
  console.log(JSON.stringify({ ok: true, notices, deactivated: existingReminders.docs.filter(item => item.id.startsWith("automation-") && !activeReminderIds.has(item.id) && item.data().active !== false).length, checkedAt: today }));
}
run().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
