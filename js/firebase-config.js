// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDBvItgoY-MZWZ34ZNbNcZ5wiKGiYH8PJw",
  authDomain: "snugglewpaw.firebaseapp.com",
  databaseURL: "https://snugglewpaw-default-rtdb.firebaseio.com",
  projectId: "snugglewpaw",
  storageBucket: "snugglewpaw.firebasestorage.app",
  messagingSenderId: "10176980140",
  appId: "1:10176980140:web:dd7a917f7ecebfe6b22b09",
  measurementId: "G-XDVDED7EYM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);