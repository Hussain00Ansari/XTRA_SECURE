// src/AuthForm.js
import React, { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const AuthForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="bg-[#12122a] p-8 rounded-2xl shadow-xl w-96 text-center">
      <h2 className="text-2xl font-bold text-purple-400 mb-6">
        {isRegistering ? "Create Account" : "Login"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-3 rounded-lg bg-[#1c1c3c] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-3 rounded-lg bg-[#1c1c3c] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition"
        >
          {isRegistering ? "Sign Up" : "Login"}
        </button>
      </form>

      {error && <p className="text-red-400 mt-3 text-sm">{error}</p>}

      <p className="mt-4 text-gray-400">
        {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
        <button
          type="button"
          className="text-purple-400 hover:underline"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? "Login" : "Sign Up"}
        </button>
      </p>
    </div>
  );
};

export default AuthForm;
