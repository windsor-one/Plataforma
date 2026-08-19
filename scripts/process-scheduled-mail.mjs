import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT.");
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT debe contener el JSON completo de una cuenta de servicio de Firebase.");
  }
}

async function processScheduledInternalMail() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const now = new Date().toISOString();
  const snapshot = await db.collection("internalMessages")
    .where("status", "==", "scheduled")
    .where("scheduledFor", "<=", now)
    .get();

  if (snapshot.empty) {
    console.log(JSON.stringify({ ok: true, processed: 0, checkedAt: now }));
    return;
  }

  const batches = [];
  for (let start = 0; start < snapshot.docs.length; start += 450) {
    const batch = db.batch();
    snapshot.docs.slice(start, start + 450).forEach((message) => {
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
  console.log(JSON.stringify({ ok: true, processed: snapshot.docs.length, checkedAt: now }));
}

processScheduledInternalMail().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
