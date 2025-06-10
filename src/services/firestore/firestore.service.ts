import { Firestore, WriteBatch } from 'firebase-admin/firestore';

// Define error response type
type ErrorResponse = {
    error: string;
};

// Service for handling Firestore operations
class FirestoreService {
    private db: Firestore;

    // Constructor for FirestoreService
    constructor(db: Firestore) {
        this.db = db;
    }

    // Fetches all document IDs from a collection
    async fetchFromCollection(collection: string): Promise<string[] | ErrorResponse> {
        try {
            const snapshot = await this.db.collection(collection).get();
            const documentIds = snapshot.docs.map((doc) => doc.id);
            return documentIds;
        } catch (error) {
            console.error(`Error fetching documents from Firestore: ${error}`);
            return { error: `Failed to fetch documents: ${error}` };
        }
    }

    // Fetches a document by ID and unwraps the data structure
    async fetchDocumentById(collection: string, documentId: string): Promise<any | ErrorResponse> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return { error: 'Document not found' };
            }

            const docData = doc.data();
            

            if (docData && docData.data) {

                const dataKeys = Object.keys(docData.data);
                for (const key of dataKeys) {
                    if (Array.isArray(docData.data[key])) {
                        return docData.data[key];
                    }
                }
                

                return docData.data;
            }


            return docData;
        } catch (error) {
            console.error(`Error fetching document from Firestore: ${error}`);
            return { error: `Failed to fetch document: ${error}` };
        }
    }

    // Deletes a document by ID
    async deleteDocumentById(
        collection: string,
        documentId: string,
    ): Promise<{ success: true; message: string } | ErrorResponse> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);


            const doc = await docRef.get();
            if (!doc.exists) {
                return { error: 'Document not found' };
            }

            await docRef.delete();
            return { success: true, message: 'Document deleted successfully' };
        } catch (error) {
            console.error(`Error deleting document from Firestore: ${error}`);
            return { error: `Failed to delete document: ${error}` };
        }
    }

    // Fetches category names from a document
    async fetchCategoriesFromDocument(
        collection: string,
        documentId: string,
    ): Promise<{ documentId: string; categories: string[] }> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Document not found');
            }

            const data = doc.data();
            if (!data) {
                throw new Error('Document has no data');
            }

            // Get the data object which contains the arrays
            const docData = data.data || {};

            // Find all keys that are arrays
            const categories = Object.keys(docData).filter((key) => Array.isArray(docData[key]));

            return {
                documentId,
                categories,
            };
        } catch (error) {
            console.error(`Error fetching categories from Firestore: ${error}`);
            throw error;
        }
    }

    // Fetches data from a specific category in a document
    async fetchCategoryData(collection: string, documentId: string, categoryName: string): Promise<object[]> {
        try {
            const docRef = this.db.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Document not found');
            }

            const data = doc.data();
            if (!data) {
                throw new Error('Document has no data');
            }

            const docData = data.data || {};


            if (!docData[categoryName] || !Array.isArray(docData[categoryName])) {
                throw new Error(`Category '${categoryName}' not found or is not an array`);
            }


            return this.sortCategoryData(docData[categoryName]);
        } catch (error) {
            console.error(`Error fetching category data from Firestore: ${error}`);
            throw error;
        }
    }

    // Sorts category data by date fields (newest first)
    private sortCategoryData(items: any[]): any[] {
        return [...items].sort((a, b) => {

            const dateA = a.publishedDate || a.createdAt || a.createdAtFormatted || 0;
            const dateB = b.publishedDate || b.createdAt || b.createdAtFormatted || 0;


            const timeA = dateA && typeof dateA.toMillis === 'function' ? dateA.toMillis() : dateA;
            const timeB = dateB && typeof dateB.toMillis === 'function' ? dateB.toMillis() : dateB;


            return timeB - timeA;
        });
    }

    // Updates the imageURL field for a document with specific uid
    async updateImageURL(
        collection: string,
        uid: string,
        imageURL: string
    ): Promise<{ success: true; message: string } | ErrorResponse> {
        try {

            const querySnapshot = await this.db.collection(collection)
                .where('uid', '==', uid)
                .limit(1)
                .get();

            if (querySnapshot.empty) {
                return { error: `No document found with uid: ${uid}` };
            }


            const docRef = querySnapshot.docs[0].ref;
            await docRef.update({ imageURL });

            return { 
                success: true, 
                message: `Successfully updated imageURL for document with uid: ${uid}` 
            };
        } catch (error) {
            console.error(`Error updating imageURL in Firestore: ${error}`);
            return { error: `Failed to update imageURL: ${error}` };
        }
    }
}

export default FirestoreService;
