import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT.");
  const candidates = [value.trim()];
  try { candidates.push(Buffer.from(value.trim(), "base64").toString("utf8")); } catch { /* Se conserva el intento con JSON directo. */ }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const account = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      if (account?.type === "service_account" && account?.project_id && account?.private_key) return account;
    } catch { /* Se intenta el siguiente formato aceptado. */ }
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT debe contener el JSON completo de una cuenta de servicio de Firebase.");
}

async function processScheduledInternalMail() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const now = new Date().toISOString();
  const scheduled = await db.collection("internalMessages")
    .where("status", "==", "scheduled")
    .get();
  const dueMessages = scheduled.docs.filter((message) => {
    const scheduledFor = message.data().scheduledFor;
    return typeof scheduledFor === "string" && scheduledFor <= now;
  });

  if (!dueMessages.length) {
    console.log(JSON.stringify({ ok: true, processed: 0, checkedAt: now }));
    return;
  }

  const batches = [];
  for (let start = 0; start < dueMessages.length; start += 450) {
    const batch = db.batch();
    dueMessages.slice(start, start + 450).forEach((message) => {
      batch.update(message.ref, {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        deliveredBy: "github-actions",
        deliveredAt: FieldValue.serverTimestamp(),
      });
    });
    batches.push(batch.commit());
  }
  await Promise.all(batches);
  console.log(JSON.stringify({ ok: true, processed: dueMessages.length, checkedAt: now }));
}

processScheduledInternalMail().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
