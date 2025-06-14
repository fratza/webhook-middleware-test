import * as dotenv from 'dotenv';
dotenv.config();

// Base environment configuration that can be extended by specific environment files
export const ENV = {
    // Add any environment-specific configuration here
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'production',
    webhook: process.env.WEBHOOK || '',

    // Firebase configuration
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    },
};
