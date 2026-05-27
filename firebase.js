import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  runTransaction,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { SB_CONFIG } from "./config.js";

const app = initializeApp(SB_CONFIG.firebase);

export const db = getFirestore(app);
export const auth = getAuth(app);

export const fb = {
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  runTransaction,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};