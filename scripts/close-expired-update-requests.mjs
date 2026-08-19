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

async function closeExpiredRequests() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = await db.collection("updateRequests").where("status", "==", "pending").get();
  const expired = snapshot.docs.filter(item => typeof item.data().deadline === "string" && item.data().deadline < today);
  for (let start = 0; start < expired.length; start += 450) {
    const batch = db.batch();
    expired.slice(start, start + 450).forEach(item => batch.update(item.ref, { status: "expired", expiredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), closedBy: "github-actions" }));
    await batch.commit();
  }
  console.log(JSON.stringify({ ok: true, closed: expired.length, checkedAt: today }));
}

closeExpiredRequests().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
