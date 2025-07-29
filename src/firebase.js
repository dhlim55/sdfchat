// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAfbXvhSZZNkZPtqOXbt9FmzPNMF9qQ-7U",
  authDomain: "sdfchat-ae6c1.firebaseapp.com",
  projectId: "sdfchat-ae6c1",
  storageBucket: "sdfchat-ae6c1.firebasestorage.app",
  messagingSenderId: "709751298324",
  appId: "1:709751298324:web:8c97e8701813cc21bbca01",
  measurementId: "G-8FM63VWXTK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
