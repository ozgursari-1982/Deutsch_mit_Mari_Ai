
// @ts-ignore
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc,
  deleteDoc,
  getDoc, 
  getDocFromServer, 
  getDocs, 
  getDocsFromServer, 
  serverTimestamp,
  increment
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { Session, LessonDocument, Message, DTBExam } from "../types";

// CONSTANTS
export const ADMIN_EMAIL = 'ozgursari1982@gmail.com';

const firebaseConfig = {
  apiKey: "AIzaSyBDlqPQjERVRqVs5tILxcqyly8mkXR3lI0",
  authDomain: "mari-ai-project.firebaseapp.com",
  projectId: "mari-ai-project",
  storageBucket: "mari-ai-project.firebasestorage.app",
  messagingSenderId: "250460399546",
  appId: "1:250460399546:web:b0da25ae2c93752cee9f83",
  measurementId: "G-Y4C76QNJ58"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- Auth Services ---

export const logoutUser = () => signOut(auth);

// --- Firestore Services ---

// Oturum Listesini Dinle
export const subscribeToSessions = (userId: string, callback: (sessions: Session[]) => void) => {
  const q = query(
    collection(db, "sessions"),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      documents: [] 
    })) as Session[];
    callback(sessions);
  });
};

// --- NEW: Subscribe to Courses (Global Shared Collection) ---
export const subscribeToCourses = (callback: (docs: LessonDocument[]) => void) => {
  // orderBy kullanma, düz collection oku
  const q = query(collection(db, "courses"));
  
  return onSnapshot(q, (snapshot) => {
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LessonDocument[];
    
    // Sort client-side by timestamp to avoid missing index issues
    documents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    callback(documents);
  }, (error) => {
    console.error("Courses subscription error (Permission?):", error);
  });
};

// Deprecated or used for specific session lookups if needed
export const subscribeToDocuments = (sessionId: string, callback: (docs: LessonDocument[]) => void) => {
  const q = query(collection(db, "sessions", sessionId, "documents"));
  
  return onSnapshot(q, (snapshot) => {
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LessonDocument[];
    documents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    callback(documents);
  }, (error) => {
    console.error("Document subscription error:", error);
  });
};

// --- Existing Session Services ---

export const getSessionDataOnce = async (sessionId: string) => {
  const docRef = doc(db, "sessions", sessionId);
  try {
    const docSnap = await getDocFromServer(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
  } catch (e) {
    console.log("Server fetch failed, falling back to cache:", e);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
  }
  return null;
};

// MODIFIED: Fetch from 'courses' without orderBy (client sort)
export const getDocumentsOnce = async (sessionId: string) => {
  const q = query(collection(db, "courses"));
  try {
    const snapshot = await getDocsFromServer(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LessonDocument[];
    return docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  } catch (e) {
    console.log("Server fetch documents failed, falling back to cache:", e);
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LessonDocument[];
    return docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }
};

export const createNewSessionInDb = async (userId: string) => {
  const sessionData = {
    userId,
    title: 'Neue Sitzung',
    createdAt: Date.now(),
    lastActive: Date.now(),
    documentCount: 0,
    messageCount: 0
  };
  const docRef = await addDoc(collection(db, "sessions"), sessionData);
  return docRef.id;
};

export const updateSessionTitleInDb = async (sessionId: string, title: string) => {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, { title });
};

export const updateSessionActiveDoc = async (sessionId: string, docId: string) => {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, { 
    activeDocId: docId, 
    lastActive: Date.now() 
  });
};

export const updateSessionCounts = async (sessionId: string, docCount: number, msgCount: number) => {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, { 
    documentCount: docCount,
    messageCount: msgCount
  });
};

// MODIFIED: Logic split based on Admin status
export const uploadDocumentToDb = async (
  userId: string, 
  sessionId: string, 
  file: File, 
  userEmail: string = '', 
  themeId?: string, 
  subtopicId?: string
) => {
  // Use explicit export constant for consistency
  const isAdmin = userEmail?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  
  const initialMessage: Message = {
    id: 'system-' + Date.now(),
    role: 'model',
    text: `Hallo! Ich habe "${file.name}" hochgeladen und analysiere es gerade...`,
    timestamp: Date.now()
  };

  if (isAdmin) {
    // ADMIN -> Upload to global 'courses'
    const storagePath = `courses/${Date.now()}_${file.name}`; 
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const newDoc: Partial<LessonDocument> = {
      name: file.name,
      displayName: file.name,
      type: file.type,
      imageUrl: downloadURL,
      storagePath: storagePath,
      messages: [initialMessage],
      timestamp: Date.now(),
      // CATEGORIZATION
      themeId: themeId || null,
      subtopicId: subtopicId || null
    };

    const docRef = await addDoc(collection(db, "courses"), newDoc);
    return { downloadURL, storagePath, docId: docRef.id, initialMessage };

  } else {
    // NORMAL USER -> Upload to their session 'sessions/{id}/documents'
    const storagePath = `users/${userId}/sessions/${sessionId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const newDoc: Partial<LessonDocument> = {
      name: file.name,
      displayName: file.name,
      type: file.type,
      imageUrl: downloadURL,
      storagePath: storagePath,
      messages: [initialMessage],
      timestamp: Date.now()
    };

    const docRef = await addDoc(collection(db, "sessions", sessionId, "documents"), newDoc);
    
    // Update session metadata for user
    await updateDoc(doc(db, "sessions", sessionId), { 
      lastActive: Date.now(),
      documentCount: increment(1),
      messageCount: increment(1),
      activeDocId: docRef.id
    });

    return { downloadURL, storagePath, docId: docRef.id, initialMessage };
  }
};

export const deleteDocumentFromDb = async (sessionId: string, docId: string, storagePath?: string) => {
  try {
    if (storagePath) {
      const storageRef = ref(storage, storagePath);
      try {
        await deleteObject(storageRef);
      } catch (e) {
        console.warn("Storage delete failed:", e);
      }
    }

    // Try deleting from courses first
    try {
      await deleteDoc(doc(db, "courses", docId));
      return true;
    } catch(e) {
       // If failed or if we want to support session delete
       if (sessionId) {
          await deleteDoc(doc(db, "sessions", sessionId, "documents", docId));
          await updateDoc(doc(db, "sessions", sessionId), {
            documentCount: increment(-1),
            lastActive: Date.now()
          });
          return true;
       }
    }
    return false;
  } catch (error) {
    console.error("Critical error in deleteDocumentFromDb:", error);
    throw error;
  }
};

export const updateDocumentMessages = async (sessionId: string, docId: string, messages: Message[], newMessagesCount = 0) => {
  // First try updating in courses
  try {
     const docRef = doc(db, "courses", docId);
     await updateDoc(docRef, { messages });
  } catch (e) {
     // If not found in courses, try session
     if (sessionId) {
       const docRef = doc(db, "sessions", sessionId, "documents", docId);
       await updateDoc(docRef, { messages });
       
       const sessionUpdate: any = { lastActive: Date.now() };
       if (newMessagesCount > 0) {
         sessionUpdate.messageCount = increment(newMessagesCount);
       }
       await updateDoc(doc(db, "sessions", sessionId), sessionUpdate);
     }
  }
};

export const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]); 
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- EXAM SERVICES ---

export const saveExamToDb = async (exam: Partial<DTBExam>) => {
  const data = { ...exam, createdAt: Date.now() };
  const docRef = await addDoc(collection(db, "exams"), data);
  return { ...data, id: docRef.id };
};

export const subscribeToExams = (callback: (exams: DTBExam[]) => void) => {
  const q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const exams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DTBExam[];
    callback(exams);
  });
};
