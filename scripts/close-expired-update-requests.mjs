import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT.");
  const candidates = [value.trim()];
  try { candidates.push(Buffer.from(value.trim(), "base64").toString("utf8")); } catch { /* se conserva JSON directo */ }
  for (const candidate of candidates) {
    try { const parsed = JSON.parse(candidate); const account = typeof parsed === "string" ? JSON.parse(parsed) : parsed; if (account?.type === "service_account" && account?.project_id && account?.private_key) return account; } catch { /* siguiente formato */ }
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT debe contener el JSON de una cuenta de servicio de Firebase.");
}

const deadlineDate = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function closeExpiredRequests() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const automationSnapshot = await db.collection("automations").get();
  const activeAutomations = automationSnapshot.docs.filter(item => item.data().trigger === "update_deadline" && item.data().status === "active");
  if (!activeAutomations.length) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "automation_paused_or_removed" }));
    return;
  }
  const now = Date.now();
  const snapshot = await db.collection("updateRequests").where("status", "==", "pending").get();
  const expired = snapshot.docs.filter(item => {
    const deadline = deadlineDate(item.data().deadline);
    return deadline && deadline.getTime() <= now;
  });
  for (let start = 0; start < expired.length; start += 220) {
    const batch = db.batch();
    expired.slice(start, start + 220).forEach(item => {
      const data = item.data();
      batch.update(item.ref, { status: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), closedBy: "github-actions" });
      if (data.permissionId) batch.set(db.collection("temporaryPermissions").doc(data.permissionId), { status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  await Promise.all(activeAutomations.map(item => item.ref.update({ lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })));
  console.log(JSON.stringify({ ok: true, closed: expired.length, checkedAt: new Date(now).toISOString() }));
}

closeExpiredRequests().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
