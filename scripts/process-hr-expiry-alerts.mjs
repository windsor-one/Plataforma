import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function account() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT.");
  for (const candidate of [raw.trim(), Buffer.from(raw.trim(), "base64").toString("utf8")]) { try { const parsed = JSON.parse(candidate); const item = typeof parsed === "string" ? JSON.parse(parsed) : parsed; if (item?.type === "service_account" && item?.private_key) return item; } catch { /* siguiente */ } }
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
  let notices = 0;
  const batch = db.batch();
  if (contractAutomations.length) {
    const contracts = await db.collection("employmentContracts").get();
    contracts.docs.filter(item => { const end = item.data().endDate; return typeof end === "string" && day(end) >= day(today) && day(end) <= day(horizon) && item.data().status !== "ended"; }).forEach(item => {
      const data = item.data(); const reference = db.collection("generalReminders").doc(`automation-contract-${item.id}`);
      batch.set(reference, { id: reference.id, title: `Contrato próximo a vencer: ${data.employeeName || "Personal"}`, message: `El contrato finaliza el ${data.endDate}. Revísalo o actualízalo antes del vencimiento.`, priority: "important", active: true, createdBy: "system", createdByName: "Automatización", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); notices += 1;
    });
    contractAutomations.forEach(item => batch.update(item.ref, { lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }));
  }
  if (documentAutomations.length) {
    const documents = await db.collection("hrDocuments").get();
    documents.docs.filter(item => { const expires = item.data().expiresAt; return typeof expires === "string" && day(expires) >= day(today) && day(expires) <= day(horizon); }).forEach(item => {
      const data = item.data(); const reference = db.collection("generalReminders").doc(`automation-document-${item.id}`);
      batch.set(reference, { id: reference.id, title: `Documento próximo a vencer: ${data.name || "Documento RR. HH."}`, message: `El documento de ${data.employeeName || "Personal"} vence el ${data.expiresAt}. Revisa su renovación.`, priority: "important", active: true, createdBy: "system", createdByName: "Automatización", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }); notices += 1;
    });
    documentAutomations.forEach(item => batch.update(item.ref, { lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }));
  }
  await batch.commit();
  console.log(JSON.stringify({ ok: true, notices, checkedAt: today }));
}
run().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
