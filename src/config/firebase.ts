import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

// Initialize Firestore
const db = admin.firestore();

export { admin, db };
