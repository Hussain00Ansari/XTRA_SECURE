// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";  // 👈 add this for authentication

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAt-LuPY6f-kIGlBlBIpYnpAyShRnO2ZAc",
  authDomain: "phishing-detector-7d6e2.firebaseapp.com",
  projectId: "phishing-detector-7d6e2",
  storageBucket: "phishing-detector-7d6e2.appspot.com",
  messagingSenderId: "747066519745",
  appId: "1:747066519745:web:7258819739b9e81ff61f40"
};

// initialize Firebase
const app = initializeApp(firebaseConfig);

// export the auth instance so you can use it in components
export const auth = getAuth(app);
