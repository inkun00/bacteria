import { getApp, getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

let persistencePromise: Promise<void> | null = null;

export function firebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return Object.values(config).every(Boolean) ? config as Record<keyof typeof config, string> : null;
}

export async function getFirebaseClient() {
  const config = firebaseConfig();
  if (!config) throw new Error("Firebase 환경 설정이 없습니다.");
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  persistencePromise ??= setPersistence(auth, browserSessionPersistence);
  await persistencePromise;
  return { app, auth, database: getDatabase(app) };
}
