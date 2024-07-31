import { getApps, cert, initializeApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

let app: App;

export const initFirebase = (): App => {
  if (!app && getApps().length === 0) {
    const { privateKey } = JSON.parse(process.env.FIREBASE_PRIVATE_KEY!);

    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      }),
    });
  }
  return app || getApps()[0];
};

// Get Firestore instance
export const getFirestoreInstance = () => getFirestore(initFirebase());

// Get Auth instance
export const getAuthInstance = () => getAuth(initFirebase());

// Export initialized instances for convenience
export const firestore = getFirestoreInstance();
export const adminAuth = getAuthInstance();

export const firebaseAdmin = {
  app: initFirebase(),
  firestore,
  auth: adminAuth,
};