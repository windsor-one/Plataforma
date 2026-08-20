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

function isoDate(date) { return date.toISOString().slice(0, 10); }
function startOfIsoWeek(date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy;
}
function thursdayForOffset(offset) {
  const date = startOfIsoWeek(new Date());
  date.setUTCDate(date.getUTCDate() + (offset * 7) + 3);
  return date;
}
function isApprovedAbsence(employeeId, targetDate, leaves) {
  const day = isoDate(targetDate);
  return leaves.some((leave) => leave.employeeId === employeeId && leave.status === "approved" && String(leave.startDate) <= day && String(leave.endDate) >= day);
}

async function ensureAttendanceGuard() {
  const serviceAccount = serviceAccountFromEnvironment();
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  const automationSnapshot = await db.collection("automations").get();
  const activeAutomations = automationSnapshot.docs.filter((item) => item.data().trigger === "weekly_attendance" && item.data().status === "active");
  if (!activeAutomations.length) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "automation_paused_or_removed" }));
    return;
  }

  const [usersSnapshot, leaveSnapshot, guardsSnapshot, debtsSnapshot] = await Promise.all([
    db.collection("users").where("status", "==", "active").get(),
    db.collection("leaveRequests").get(),
    db.collection("attendanceGuards").get(),
    db.collection("attendanceGuardDebts").get(),
  ]);
  const candidates = usersSnapshot.docs.map((item) => ({ id: item.id, displayName: String(item.data().displayName || "Personal") })).sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  if (!candidates.length) throw new Error("No hay Personal activo para asignar la guardia semanal.");
  const leaves = leaveSnapshot.docs.map((item) => item.data());
  const debts = new Map(debtsSnapshot.docs.map((item) => [item.id, Number(item.data().pendingTurns || 0)]));
  const existingByWeek = new Map(guardsSnapshot.docs.map((item) => [String(item.data().weekKey || item.id), { ref: item.ref, ...item.data() }]));
  const created = []; const reassigned = []; const deferred = [];
  const historical = guardsSnapshot.docs.map((item) => item.data()).filter((item) => typeof item.weekKey === "string").sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)));
  let previousId = historical.length ? historical[historical.length - 1].guardUserId : undefined;

  const recordDeferral = async (weekKey, employee) => {
    const deferralRef = db.collection("attendanceGuardDeferrals").doc(`${weekKey}__${employee.id}`);
    const prior = await deferralRef.get();
    if (prior.exists) return;
    await db.runTransaction(async (transaction) => {
      const check = await transaction.get(deferralRef);
      if (check.exists) return;
      const debtRef = db.collection("attendanceGuardDebts").doc(employee.id);
      transaction.set(deferralRef, { id: deferralRef.id, weekKey, employeeId: employee.id, employeeName: employee.displayName, reason: "approved_leave", createdAt: FieldValue.serverTimestamp() });
      transaction.set(debtRef, { id: employee.id, employeeId: employee.id, employeeName: employee.displayName, pendingTurns: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    debts.set(employee.id, (debts.get(employee.id) || 0) + 1);
    deferred.push({ weekKey, employeeId: employee.id, employeeName: employee.displayName });
  };

  const selectForWeek = async (weekKey, targetDate, anchorId) => {
    const anchorIndex = Math.max(0, candidates.findIndex((item) => item.id === anchorId));
    const rotation = Array.from({ length: candidates.length }, (_, index) => candidates[(anchorIndex + 1 + index) % candidates.length]);
    let nominal = null;
    for (const candidate of rotation) {
      if (isApprovedAbsence(candidate.id, targetDate, leaves)) await recordDeferral(weekKey, candidate);
      else { nominal = candidate; break; }
    }
    if (!nominal) throw new Error(`No hay Personal disponible para cubrir la guardia ${weekKey}; todas las personas activas tienen ausencia aprobada.`);
    const owed = rotation.filter((candidate) => (debts.get(candidate.id) || 0) > 0 && !isApprovedAbsence(candidate.id, targetDate, leaves));
    const selected = owed.find((candidate) => candidate.id !== anchorId && candidate.id !== previousId) || (nominal.id !== previousId ? nominal : rotation.find((candidate) => candidate.id !== previousId && !isApprovedAbsence(candidate.id, targetDate, leaves))) || nominal;
    if ((debts.get(selected.id) || 0) > 0) {
      const nextDebt = Math.max(0, (debts.get(selected.id) || 0) - 1);
      debts.set(selected.id, nextDebt);
      await db.collection("attendanceGuardDebts").doc(selected.id).set({ pendingTurns: nextDebt, fulfilledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return selected;
  };

  for (let offset = 0; offset < 4; offset += 1) {
    const targetDate = thursdayForOffset(offset);
    const weekKey = isoWeekKey(targetDate);
    const guard = existingByWeek.get(weekKey);
    const assignedEmployee = guard ? candidates.find((item) => item.id === guard.guardUserId) : undefined;
    const absent = assignedEmployee && isApprovedAbsence(assignedEmployee.id, targetDate, leaves);
    if (guard && !absent) { previousId = guard.guardUserId; continue; }
    if (assignedEmployee && absent) await recordDeferral(weekKey, assignedEmployee);
    const selected = await selectForWeek(weekKey, targetDate, guard?.guardUserId || previousId);
    const reference = guard?.ref || db.collection("attendanceGuards").doc(weekKey);
    const payload = {
      id: weekKey,
      weekKey,
      guardUserId: selected.id,
      guardUserName: selected.displayName,
      assignedBy: "system",
      assignedByName: "Rotación automática",
      assignedAt: guard?.assignedAt || FieldValue.serverTimestamp(),
      plannedFor: isoDate(targetDate),
      ...(assignedEmployee && absent ? { replacedGuardUserId: assignedEmployee.id, replacedGuardUserName: assignedEmployee.displayName, reassignedReason: "approved_leave", reassignedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await reference.set(payload, { merge: true });
    if (guard) reassigned.push({ weekKey, guardUserId: selected.id, guardUserName: selected.displayName }); else created.push({ weekKey, guardUserId: selected.id, guardUserName: selected.displayName });
    previousId = selected.id;
  }

  await Promise.all(activeAutomations.map((item) => item.ref.update({ lastRunAt: FieldValue.serverTimestamp(), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })));
  console.log(JSON.stringify({ ok: true, created, reassigned, deferred, plannedWeeks: 4 }));
}

ensureAttendanceGuard().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
