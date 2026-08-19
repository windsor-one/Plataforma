import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT.");
  const candidates = [value.trim()];
  try { candidates.push(Buffer.from(value.trim(), "base64").toString("utf8")); } catch { /* JSON directo sigue disponible. */ }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const account = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      if (account?.type === "service_account" && account?.project_id && account?.private_key) return account;
    } catch { /* se intenta el siguiente formato */ }
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT debe contener el JSON completo de una cuenta de servicio de Firebase.");
}

function isoWeekKey(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function ensureAttendanceGuard() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const automationSnapshot = await db.collection("automations").get();
  const activeAutomations = automationSnapshot.docs.filter(item => item.data().trigger === "weekly_attendance" && item.data().status === "active");
  if (!activeAutomations.length) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "automation_paused_or_removed" }));
    return;
  }
  const weekKey = isoWeekKey();
  const guardRef = db.collection("attendanceGuards").doc(weekKey);
  const current = await guardRef.get();
  if (current.exists) {
    await Promise.all(activeAutomations.map(item => item.ref.update({ lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })));
    console.log(JSON.stringify({ ok: true, weekKey, created: false, guardUserId: current.data()?.guardUserId }));
    return;
  }

  const users = await db.collection("users").where("status", "==", "active").get();
  const candidates = users.docs.map(item => ({ id: item.id, displayName: String(item.data().displayName || "Personal") })).sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  if (!candidates.length) throw new Error("No hay Personal activo para asignar la guardia semanal.");

  const recentGuards = await db.collection("attendanceGuards").orderBy("weekKey", "desc").limit(1).get();
  const previousId = recentGuards.docs[0]?.data().guardUserId;
  const previousIndex = candidates.findIndex(item => item.id === previousId);
  const selected = candidates[(previousIndex + 1 + candidates.length) % candidates.length];

  await guardRef.create({
    id: weekKey,
    weekKey,
    guardUserId: selected.id,
    guardUserName: selected.displayName,
    assignedBy: "system",
    assignedByName: "Rotación automática",
    assignedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await Promise.all(activeAutomations.map(item => item.ref.update({ lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })));
  console.log(JSON.stringify({ ok: true, weekKey, created: true, guardUserId: selected.id, guardUserName: selected.displayName }));
}

ensureAttendanceGuard().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
