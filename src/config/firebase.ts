import * as admin from 'firebase-admin';
import { ENV } from '../environments/environment';

// Initialize Firebase Admin with explicit project ID
try {
    // For development, we need to explicitly set the project ID
    admin.initializeApp({
        projectId: ENV.firebase.projectId || 'default-project-id',
    });

    console.log(`Firebase initialized with project ID: ${ENV.firebase.projectId || 'default-project-id'}`);

    // Verify that we have a project ID
    if (!ENV.firebase.projectId) {
        console.warn('WARNING: FIREBASE_PROJECT_ID environment variable is not set');
    }
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
}

const db = admin.firestore();

export { admin, db };
