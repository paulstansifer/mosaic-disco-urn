import { initializeApp, type FirebaseApp } from 'firebase/app';

// Not a secret; the security rules in database.rules.json are what protect the data.
const DATABASE_URL = 'https://mosaic-disco-urn-4b5ba-default-rtdb.firebaseio.com/';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: DATABASE_URL,
};

let app: FirebaseApp | null = null;

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
};
