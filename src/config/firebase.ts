import * as admin from 'firebase-admin';
import { ENV } from '../environments/environment.dev';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: ENV.firebase.projectId,
    clientEmail: ENV.firebase.clientEmail,
    privateKey: ENV.firebase.privateKey,
  }),
});

// Initialize default Firestore instance
const db = admin.firestore();

// If a database ID is specified in the environment, configure the Firestore instance
if (ENV.firebase.databaseId) {
  db.settings({
    databaseId: ENV.firebase.databaseId
  });
}

/**
 * Get a Firestore instance configured with the specified database ID
 * @param databaseId Optional database ID to use
 * @returns Firestore instance
 */
const getFirestore = (databaseId?: string) => {
  const firestoreInstance = admin.firestore();
  
  if (databaseId) {
    firestoreInstance.settings({
      databaseId: databaseId
    });
  }
  
  return firestoreInstance;
};

export { admin, db, getFirestore };
