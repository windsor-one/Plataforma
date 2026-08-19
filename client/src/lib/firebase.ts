/**
 * Sala de Operaciones Editorial: una única puerta de entrada al proyecto Firebase.
 * Las variables VITE_ se reemplazan en compilación; no incluyas claves administrativas aquí.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

const safeConfig = isFirebaseConfigured
  ? config
  : {
      apiKey: "firebase-configuration-required",
      authDomain: "firebase-configuration-required.firebaseapp.com",
      projectId: "firebase-configuration-required",
      appId: "1:000000000000:web:configurationrequired",
    };

export const firebaseApp = getApps().length ? getApp() : initializeApp(safeConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/**
 * Storage se mantiene bajo demanda porque el plan gratuito actual no lo tiene activado
 * y SIGES opera el correo sin adjuntos. Así, un módulo deshabilitado no bloquea Auth ni Firestore.
 */
export function getInternalMailStorage(): FirebaseStorage {
  if (!isFirebaseConfigured || !config.storageBucket) {
    throw new Error("Los adjuntos privados no están disponibles mientras Firebase Storage permanezca deshabilitado.");
  }
  return getStorage(firebaseApp);
}
