import * as admin from 'firebase-admin';

// Initialize Firebase Admin with cloud-provided credentials
// This assumes environment variables are properly set in the cloud environment
try {
    // Initialize with no explicit parameters
    // In cloud environments, this will automatically use the default credentials
    admin.initializeApp();
    console.log('Firebase initialized with cloud environment credentials');
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
}

const db = admin.firestore();

export { admin, db };
