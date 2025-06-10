import * as admin from 'firebase-admin';

// Initialize Firebase Admin without explicit credentials
// This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
// or the default service account when deployed to Google Cloud
admin.initializeApp();

const db = admin.firestore();

export { admin, db };
