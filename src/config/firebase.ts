import * as admin from 'firebase-admin';
import { ENV } from '../environments/environment';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: ENV.firebase.projectId,
    clientEmail: ENV.firebase.clientEmail,
    privateKey: ENV.firebase.privateKey,
  }),
});

const db = admin.firestore();

export { admin, db };
