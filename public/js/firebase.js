import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, getDocs,
  doc, setDoc, getDoc, serverTimestamp, updateDoc,
  onSnapshot, orderBy, addDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcTGIrOtn-xT-mtXGptP4rCRsFC-eHK68",
  authDomain: "store-directory-3.firebaseapp.com",
  projectId: "store-directory-3",
  storageBucket: "store-directory-3.firebasestorage.app",
  messagingSenderId: "536813676503",
  appId: "1:536813676503:web:d096f92f90821c6ec84d92",
  measurementId: "G-X2RXD1M90B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Auth ---
const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export { onAuthStateChanged };

// --- Users ---
export const getUserDoc = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error('getUserDoc error:', e);
    return null;
  }
};

export const createUserDoc = (uid, data) =>
  setDoc(doc(db, 'users', uid), { ...data, timestamp: serverTimestamp() });

export const setUserDisplayName = async (name) => {
  const user = auth.currentUser;
  if (user) await updateDoc(doc(db, 'users', user.uid), { displayName: name });
};

export const saveRosterInfo = async (uid, data) =>
  updateDoc(doc(db, 'users', uid), data);

export const subscribeToUnapprovedUsers = (callback) => {
  const q = query(collection(db, 'users'), where('approved', '==', false));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !u.denied);
    callback(users);
  });
};

export const subscribeToRosterUsers = (callback) => {
  const q = query(collection(db, 'users'), where('rosterOptIn', '==', true));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const approveUser = (uid) => updateDoc(doc(db, 'users', uid), { approved: true });
export const denyUser = (uid) => updateDoc(doc(db, 'users', uid), { denied: true });

// --- Shifts ---
export const postShiftToDb = (data) =>
  addDoc(collection(db, 'shifts'), { ...data, timestamp: serverTimestamp() });

export const claimShift = async (shiftId) => {
  const user = auth.currentUser;
  if (!user) return;
  const userDoc = await getUserDoc(user.uid);
  const displayName = userDoc?.displayName || user.email;
  await updateDoc(doc(db, 'shifts', shiftId), {
    status: 'claimed',
    claimerId: user.uid,
    claimerName: displayName
  });
};

export const deleteShift = (shiftId) => deleteDoc(doc(db, 'shifts', shiftId));

export const subscribeToShifts = (callback) => {
  const q = query(collection(db, 'shifts'), orderBy('date', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

// --- Feed (colophonPosts collection) ---
export const postToFeed = (content) => {
  const user = auth.currentUser;
  if (!user) return;
  return addDoc(collection(db, 'colophonPosts'), {
    content,
    authorId: user.uid,
    timestamp: serverTimestamp(),
    replyTo: null,
  });
};

export const replyToFeed = (content, parentId) => {
  const user = auth.currentUser;
  if (!user) return;
  return addDoc(collection(db, 'colophonPosts'), {
    content,
    authorId: user.uid,
    timestamp: serverTimestamp(),
    replyTo: parentId,
  });
};

export const updateFeedPost = (postId, content) =>
  updateDoc(doc(db, 'colophonPosts', postId), { content, edited: true });

export const deleteFeedPost = async (postId) => {
  const batch = writeBatch(db);
  const q = query(collection(db, 'colophonPosts'), where('replyTo', '==', postId));
  const replies = await getDocs(q);
  replies.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'colophonPosts', postId));
  return batch.commit();
};

// --- Hour Entries ---
export const addHourEntry = (uid, data) =>
  addDoc(collection(db, 'hourEntries'), { ...data, uid, timestamp: serverTimestamp() });

export const deleteHourEntry = (entryId) => deleteDoc(doc(db, 'hourEntries', entryId));

export const subscribeToHourEntries = (uid, callback) => {
  const q = query(collection(db, 'hourEntries'), where('uid', '==', uid));
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.date.localeCompare(a.date));
    callback(entries);
  });
};

export const saveHourlyRate = (uid, rate) =>
  updateDoc(doc(db, 'users', uid), { hourlyRate: rate });

// --- Feed (colophonPosts collection) ---
export const subscribeToFeed = (callback) => {
  const q = query(collection(db, 'colophonPosts'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })), null),
    (error) => { console.error('Feed snapshot error:', error); callback([], error); }
  );
};
