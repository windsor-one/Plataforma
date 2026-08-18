/**
 * Sala de Operaciones Editorial: acceso sobrio y directo; la invitación es la puerta
 * de seguridad que evita crear empleados fuera del control del administrador.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { ArrowRight, CalendarDays, CircleDollarSign, Database, Eye, EyeOff, LockKeyhole, Settings2, ShieldCheck, Sparkles, UsersRound, Wifi } from "lucide-react";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { completeInvitationOnboarding, recordAccess } from "@/lib/firestore";
import type { UserProfile } from "@/lib/types";

type Mode = "login" | "register";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;

function FriendlyError({ error }: { error: string }) {
  return error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">{error}</p> : null;
}

function readableAccessError(caught: unknown, fallback: string) {
  const code = (caught as { code?: string })?.code || "";
  const message = caught instanceof Error ? caught.message : "";
  const known: Record<string, string> = {
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/user-disabled": "Esta cuenta está deshabilitada en Firebase Authentication.",
    "auth/too-many-requests": "Se bloquearon temporalmente los intentos. Espera unos minutos o restablece la contraseña.",
    "auth/network-request-failed": "No fue posible conectar con Firebase. Comprueba tu conexión e inténtalo otra vez.",
    "permission-denied": "Firebase rechazó la lectura de tu perfil. El administrador debe revisar las reglas de Firestore.",
    "firestore/permission-denied": "Firebase rechazó la lectura de tu perfil. El administrador debe revisar las reglas de Firestore.",
  };
  return `${known[code] || message || fallback}${code ? ` [${code}]` : ""}`;
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}

function SetupPending() {
  const items = [
    { label: "Resumen", icon: Settings2 }, { label: "Reservas", icon: CalendarDays }, { label: "Clientes", icon: UsersRound }, { label: "Pagos", icon: CircleDollarSign },
  ];
  const checks = [
    ["Identidad", "Firebase Authentication", "Pendiente"], ["Datos", "Cloud Firestore", "Pendiente"], ["Sincronización", "Listeners en tiempo real", "Bloqueado"], ["Acceso", "Reglas por rol y estado", "Bloqueado"],
  ];
  return <main className="min-h-screen bg-background text-foreground"><div className="grid min-h-screen lg:grid-cols-[17.5rem_minmax(0,1fr)]"><aside className="hidden border-r bg-card p-5 lg:flex lg:flex-col"><div className="flex items-center gap-3 px-2"><BrandMark /><div><b className="text-lg tracking-tight">Gestion<span className="text-[#0F8F73]">Pro</span></b><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Operaciones</p></div></div><nav className="mt-10 space-y-1">{items.map(({ label, icon: Icon }, index) => <div className={`side-link ${index === 0 ? "active" : "opacity-50"}`} key={label}><Icon size={18} />{label}<LockKeyhole className="ml-auto" size={13} /></div>)}</nav><div className="mt-auto rounded-xl border border-[#0F8F73]/15 bg-[#0F8F73]/5 p-3"><p className="text-xs font-extrabold text-[#08745D] dark:text-[#5DDBC0]">ESTADO DEL ESPACIO</p><p className="mt-2 text-sm font-bold">0 de 4 conexiones activas</p><p className="mt-1 text-xs leading-5 text-muted-foreground">La agenda y los permisos se activarán al conectar Firebase.</p></div></aside><section className="min-w-0 p-5 sm:p-8 lg:p-10"><header className="mb-10 flex items-center justify-between border-b pb-5"><div className="flex items-center gap-2 lg:hidden"><BrandMark /><b>GestionPro</b></div><div className="ml-auto flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.1em] text-amber-700 dark:text-amber-300"><Wifi size={14} />Sin conexión</div></header><div className="max-w-5xl"><p className="eyebrow">Sistema · Preparación inicial</p><h1 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Configuración pendiente: conecta Firebase para activar agenda, pagos y equipo.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">GestionPro está listo para operar, pero todavía no tiene una fuente de identidad ni una base de datos vinculadas. Completa las variables de Firebase y publica las reglas de acceso.</p><section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{checks.map(([label, detail, status], index) => <article className="metric-card !min-h-0" key={label}><div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-3 font-extrabold">{detail}</p><span className={`mt-3 inline-flex rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${index < 2 ? "bg-amber-400/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>{status}</span></div><span className={`h-9 w-1 rounded-full ${index < 2 ? "bg-amber-400" : "bg-muted"}`} /></article>)}</section><section className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><article className="panel-card overflow-hidden"><div className="border-b px-5 py-4"><p className="font-extrabold">Ruta de activación</p><p className="mt-0.5 text-xs text-muted-foreground">Tres acciones para poner el sistema en marcha</p></div><ol className="divide-y">{[["01", "Registra la aplicación web", "Copia los seis valores de configuración de Firebase a tus variables VITE_FIREBASE_* ."], ["02", "Habilita identidad y base de datos", "Activa Email/Password, crea Cloud Firestore y publica el archivo firestore.rules."], ["03", "Crea el primer administrador", "Añade el perfil de administrador con su UID en la colección users; la guía explica el proceso." ]].map(([number, title, text]) => <li className="flex gap-4 px-5 py-5" key={number}><span className="time-code text-sm font-semibold text-[#0F8F73]">{number}</span><div><p className="font-extrabold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></li>)}</ol></article><article className="relative overflow-hidden rounded-2xl bg-[#102B35] p-6 text-white"><div className="absolute inset-0 auth-pattern opacity-40" /><div className="relative"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F8F73] text-white"><Database size={20} /></div><p className="mt-12 text-xs font-extrabold uppercase tracking-[.14em] text-[#9FE9D6]">Documentación incluida</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Tu operación comienza con una base segura.</h2><p className="mt-4 max-w-md text-sm leading-6 text-white/75">Abre <code className="rounded bg-white/10 px-1.5 py-0.5 text-[#B5EFE0]">README.md</code> para seguir el procedimiento exacto de Firebase y GitHub Pages.</p></div></article></section></div></section></div></main>;
}

export default function AuthGate({ children }: { children: (user: User, profile: UserProfile) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [activityCycle, setActivityCycle] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError("");
      try {
        if (!currentUser) {
          setUser(null);
          setProfile(null);
          return;
        }
        const completed = await completeInvitationOnboarding(currentUser);
        if (completed.status !== "active") {
          await signOut(auth);
          throw new Error("Tu cuenta se encuentra suspendida. Contacta al administrador.");
        }
        await recordAccess(currentUser.uid, completed, "login");
        setUser(currentUser);
        setProfile(completed);
      } catch (caught) {
        setUser(null);
        setProfile(null);
        setError(readableAccessError(caught, "No fue posible validar tu acceso."));
        if (currentUser) await signOut(auth);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !profile) return;
    let warningTimer: number | undefined;
    let timeoutTimer: number | undefined;
    let lastInteraction = Date.now();
    let endingSession = false;

    const endForInactivity = async () => {
      if (endingSession) return;
      endingSession = true;
      setIdleWarning(false);
      setNotice("Tu sesión se cerró por 15 minutos de inactividad. Inicia sesión nuevamente para continuar.");
      await recordAccess(user.uid, profile, "logout");
      await signOut(auth);
    };

    const schedule = () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(timeoutTimer);
      const elapsed = Date.now() - lastInteraction;
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed);
      warningTimer = window.setTimeout(() => setIdleWarning(true), Math.max(0, remaining - INACTIVITY_WARNING_MS));
      timeoutTimer = window.setTimeout(() => { void endForInactivity(); }, remaining);
    };

    const registerActivity = () => {
      lastInteraction = Date.now();
      setIdleWarning(false);
      schedule();
    };

    const checkAfterPause = () => {
      if (Date.now() - lastInteraction >= INACTIVITY_TIMEOUT_MS) void endForInactivity();
      else schedule();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart", "focus"];
    events.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkAfterPause);
    schedule();

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(timeoutTimer);
      events.forEach((event) => window.removeEventListener(event, registerActivity));
      document.removeEventListener("visibilitychange", checkAfterPause);
    };
  }, [user, profile, activityCycle]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      }
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      const message = code === "auth/email-already-in-use"
        ? "Ya existe una cuenta con este correo. Inicia sesión."
        : code === "auth/weak-password"
          ? "La contraseña debe tener al menos 6 caracteres."
          : readableAccessError(caught, "No se pudo procesar el acceso. Revisa los datos e inténtalo de nuevo.");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Escribe tu correo para recibir el enlace de recuperación.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice("Si ese correo pertenece a una cuenta, recibirás un enlace seguro para restablecer la contraseña. Revisa también Spam.");
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      setError(code === "auth/invalid-email"
        ? "Escribe un correo válido para solicitar el enlace."
        : code === "auth/too-many-requests"
          ? "Se solicitaron demasiados enlaces. Espera unos minutos e inténtalo de nuevo."
          : code === "auth/operation-not-allowed"
            ? "La recuperación por correo no está habilitada en Firebase Authentication."
            : "No se pudo enviar el enlace. Comprueba el correo e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 font-semibold"><span className="h-3 w-3 animate-pulse rounded-full bg-[#0F8F73]" />Preparando tu espacio de trabajo…</div></div>;
  }

  if (user && profile) return <>{children(user, profile)}{idleWarning && <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-[#FFC72C]/45 bg-card p-4 shadow-2xl sm:bottom-6"><p className="text-sm font-extrabold">Tu sesión está por cerrarse</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Por seguridad, se cerrará en menos de un minuto si no continúas trabajando.</p><button className="primary-button mt-4 w-full" onClick={() => { setIdleWarning(false); setActivityCycle((cycle) => cycle + 1); }}>Continuar sesión</button></div>}</>;
  if (!isFirebaseConfigured) return <SetupPending />;

  return (
    <main className="min-h-screen bg-[#132A32] p-3 sm:p-6 lg:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[1.75rem] bg-[#F6F4EE] shadow-2xl shadow-black/25 lg:grid-cols-[1.1fr_.9fr] dark:bg-[#17242A]">
        <div className="relative hidden overflow-hidden bg-[#102B35] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 auth-pattern opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B2027]/55 via-[#0B2027]/35 to-[#0B2027]/80" />
          <div className="relative flex items-center gap-3"><BrandMark /><span className="text-xl font-extrabold tracking-tight">Heliot <span className="text-[#5DDBC0]">Media</span></span></div>
          <div className="relative mt-auto max-w-md">
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[.12em] text-[#B5EFE0] uppercase"><Sparkles size={14} /> Centro de operaciones</div>
            <h1 className="text-5xl font-extrabold leading-[.96] tracking-[-.055em]">La jornada bajo control.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-white/75">Gestiona clientes, agenda, pagos y tu equipo desde una fuente de datos compartida en tiempo real.</p>
            <p className="mt-6 text-xs font-semibold tracking-wide text-white/55">Con tecnología de Windsor</p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="mb-10 flex items-center justify-between lg:hidden"><div className="flex items-center gap-2"><BrandMark /><span className="text-lg font-extrabold">Heliot Media</span></div><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acceso seguro</span></div>
          <div className="max-w-sm">
            <>
                <span className="inline-flex rounded-full bg-[#0F8F73]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.12em] text-[#08745D] dark:text-[#5DDBC0]">Heliot Media · Acceso del equipo</span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{mode === "login" ? "Vuelve a tu operación." : "Activa tu invitación."}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Inicia sesión con tus credenciales de empleado." : "Solo puedes registrarte si un administrador autorizó previamente tu correo."}</p>
                <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                  {mode === "register" && <label className="block text-sm font-bold">Nombre completo<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="field mt-1.5" /></label>}
                  <label className="block text-sm font-bold">Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" className="field mt-1.5" /></label>
                  <label className="block text-sm font-bold">Contraseña<div className="relative mt-1.5"><input required minLength={6} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" className="field pr-12" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
                  <FriendlyError error={error} />
                  {notice && <p className="rounded-lg bg-[#0F8F73]/10 px-3 py-2 text-sm font-medium text-[#08745D] dark:text-[#8BE3CB]">{notice}</p>}
                  <button disabled={submitting} className="primary-button w-full" type="submit">{submitting ? "Validando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}<ArrowRight size={17} /></button>
                </form>
                {mode === "login" && <button type="button" disabled={submitting} onClick={handlePasswordReset} className="mt-5 w-full text-center text-sm font-bold text-[#0C58C7] hover:underline dark:text-[#87A9FF]">¿Olvidaste tu contraseña? Restablécela por correo</button>}
                <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }} className="mt-5 w-full text-center text-sm font-bold text-[#08745D] hover:underline dark:text-[#5DDBC0]">{mode === "login" ? "¿Tienes una invitación? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}</button>
                <div className="mt-8 grid grid-cols-2 gap-3 border-t pt-6 text-xs text-muted-foreground"><div className="flex items-start gap-2"><LockKeyhole className="mt-0.5 text-[#0F8F73]" size={15} />Tus permisos se validan en cada sesión.</div><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 text-[#0F8F73]" size={15} />Datos protegidos por reglas de acceso.</div></div><p className="mt-5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">Heliot Media · Con tecnología de Windsor</p>
            </>
          </div>
        </div>
      </section>
    </main>
  );
}
