import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const config = firebaseConfig as any;
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use (default) database if firestoreDatabaseId is not provided
export const db = config.firestoreDatabaseId 
  ? getFirestore(app, config.firestoreDatabaseId) 
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Error handling types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    // Attempt to read a document to verify Firestore is reachable
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Permission denied'))) {
      console.error("Firebase Connection Error: ", error.message);
      console.warn("Please ensure that:\n1. Firestore is ENABLED in your Firebase Console (https://console.firebase.google.com/project/smart-todo-list-8eb1e/firestore)\n2. You have created a '(default)' database.\n3. Your Security Rules allow access.");
    }
  }
}
testConnection();

export { signInWithPopup, signOut, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy };
