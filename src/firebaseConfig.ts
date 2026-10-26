import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const LOCAL_STORAGE_FIREBASE_KEY = 'tift_bus_app_firebase_config';

function resolveFirebaseConfig(): FirebaseConfigOptions {
  // 1. Check if user configured credentials via in-app settings
  try {
    const custom = localStorage.getItem(LOCAL_STORAGE_FIREBASE_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.projectId && parsed.apiKey && parsed.apiKey !== 'AIzaSyDemoPlaceholderAPIKey') {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }

  // 2. Check environment variables
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
    };
  }

  // 3. Fallback placeholder (enables graceful local caching & simulation without crashes)
  return {
    apiKey: "AIzaSyDemoPlaceholderAPIKey",
    authDomain: "bus-app-demo.firebaseapp.com",
    projectId: "bus-app-demo",
    storageBucket: "bus-app-demo.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
  };
}

export const activeFirebaseConfig = resolveFirebaseConfig();

export function isFirebaseConfigured(): boolean {
  return (
    Boolean(activeFirebaseConfig.projectId) &&
    Boolean(activeFirebaseConfig.apiKey) &&
    activeFirebaseConfig.apiKey !== "AIzaSyDemoPlaceholderAPIKey" &&
    activeFirebaseConfig.projectId !== "bus-app-demo"
  );
}

export function saveCustomFirebaseConfig(config: Partial<FirebaseConfigOptions>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_FIREBASE_KEY, JSON.stringify(config));
    window.location.reload();
  } catch (err) {
    console.warn('Could not save Firebase config to storage:', err);
  }
}

export function clearCustomFirebaseConfig(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_FIREBASE_KEY);
    window.location.reload();
  } catch (err) {
    console.warn('Could not clear Firebase config from storage:', err);
  }
}

// Initialize Firebase App
const existingApps = getApps();
export const app: FirebaseApp = existingApps.length > 0 ? existingApps[0] : initializeApp(activeFirebaseConfig);
export const db: Firestore = getFirestore(app);
