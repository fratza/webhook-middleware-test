import * as admin from 'firebase-admin';

// Initialize Firebase Admin with default application credentials
// This will use the credentials set in the cloud environment
try {
    // For cloud environments, we can initialize without parameters
    // Firebase will use the default credentials from the environment
    admin.initializeApp();
    console.log('Firebase initialized with cloud environment credentials');
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
}

const db = admin.firestore();

export { admin, db };
