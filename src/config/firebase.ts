import * as admin from 'firebase-admin';
import { ENV } from '../environments/environment';

// Initialize Firebase Admin with credentials from environment variables
try {
    // Check if we have the required Firebase configuration
    if (!ENV.firebase.projectId) {
        throw new Error('FIREBASE_PROJECT_ID is not defined in environment variables');
    }
    
    // Initialize with explicit credentials from environment variables
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: ENV.firebase.projectId,
            clientEmail: ENV.firebase.clientEmail,
            privateKey: ENV.firebase.privateKey,
        }),
    });
    
    console.log('Firebase initialized with project ID:', ENV.firebase.projectId);
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
}

const db = admin.firestore();

export { admin, db };
