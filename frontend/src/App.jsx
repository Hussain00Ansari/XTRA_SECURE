import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { checkPhishingText, checkPhishingFile } from "./api";
import {
  ShieldAlert,
  ShieldCheck,
  Mail,
  Bug,
  PlayCircle,
  AlertTriangle,
  Link2,
  BarChart2,
  RotateCcw,
  Shield,
} from "lucide-react";
import AuthForm from "./AuthForm.jsx";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

/* -------------------------
   Small spinner component
   ------------------------- */
const Spinner = () => (
  <div className="flex flex-col items-center gap-3">
    <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
    <div className="text-sm text-slate-300">Analyzing…</div>
  </div>
);

/* -------------------------
   Demo email and stat card
   ------------------------- */
const DEMO_EMAIL = `Subject: Urgent – Verify your account now!

Dear user,

We noticed unusual login activity on your account. For your security, please verify your password within 24 hours or your account will be suspended.

Click here to verify: http://secure-login-update.verify-account-support.com

Regards,
Support Team`;

const StatCard = ({ icon: Icon, label, value, subtitle }) => (
  <div className="bg-slate-900/70 backdrop-blur rounded-2xl p-4 ring-1 ring-white/5 shadow-lg">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30">
        <Icon className="h-5 w-5 text-fuchsia-300" />
      </div>
      <div>
        <div className="text-slate-200 text-sm">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  </div>
);

/* -------------------------
   App component
   ------------------------- */
export default function App() {
  const [emailText, setEmailText] = useState("");
  const [result, setResult] = useState(null);
  const [banner, setBanner] = useState(null);
  const [history, setHistory] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [user, setUser] = useState(null);

  // loading state for network calls
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const aggregate = useMemo(() => {
    const total = history.length;
    const phish = history.filter((h) => h.verdict === "Phishing").length;
    return {
      total,
      phish,
      safe: total - phish,
      rate: total ? Math.round((phish / total) * 100) : 0,
    };
  }, [history]);

  /* -------------------------
     analyze text (calls backend)
     - shows result area immediately,
     - shows spinner while waiting
     ------------------------- */
  async function analyze(text) {
    if (!text || !text.trim()) {
      setBanner({ type: "warn", msg: "Please paste email content first." });
      return;
    }

    console.log("[analyze] called", text.slice(0, 120));
    setBanner(null);
    setShowResult(true);
    setLoading(true);

    try {
      const data = await checkPhishingText(text);
      console.log("[analyze] backend response:", data);

      // expect { verdict, score } from backend
      setResult(data);
      setHistory((list) => [...list, { score: data.score, verdict: data.verdict }]);

      if (data.verdict === "Phishing") {
        setBanner({ type: "danger", msg: "⚠️ Potential phishing detected!" });
      } else if (data.verdict === "Suspicious") {
        setBanner({ type: "warn", msg: "⚠️ Suspicious elements found." });
      } else {
        setBanner({ type: "ok", msg: "✅ Looks safe, but always double-check links." });
      }
    } catch (err) {
      console.error("[analyze] error:", err);
      setBanner({ type: "warn", msg: "Backend not reachable. See console/network tab." });

      // fallback: simple local heuristic so user sees something (optional)
      const fallbackScore = fallbackHeuristicScore(text);
      const fallbackVerdict = fallbackScore >= 60 ? "Phishing" : fallbackScore >= 40 ? "Suspicious" : "Safe";
      setResult({ score: fallbackScore, verdict: fallbackVerdict, urls: extractUrls(text) });
      setHistory((list) => [...list, { score: fallbackScore, verdict: fallbackVerdict }]);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------
     analyze file (.eml/.txt)
     - set loading & show result area
     ------------------------- */
  async function analyzeFile(file) {
    if (!file) return;
    console.log("[analyzeFile] selected", file.name);
    setBanner(null);
    setShowResult(true);
    setLoading(true);

    try {
      const data = await checkPhishingFile(file);
      console.log("[analyzeFile] backend response:", data);
      setResult(data);
      setHistory((list) => [...list, { score: data.score, verdict: data.verdict }]);

      if (data.verdict === "Phishing") {
        setBanner({ type: "danger", msg: "⚠️ Potential phishing detected!" });
      } else if (data.verdict === "Suspicious") {
        setBanner({ type: "warn", msg: "⚠️ Suspicious elements found." });
      } else {
        setBanner({ type: "ok", msg: "✅ File seems safe." });
      }
    } catch (err) {
      console.error("[analyzeFile] error:", err);
      setBanner({ type: "warn", msg: "Backend not reachable for file." });

      // fallback: try to read the file locally and run a small heuristic
      try {
        const text = await file.text();
        const fallbackScore = fallbackHeuristicScore(text);
        const fallbackVerdict = fallbackScore >= 60 ? "Phishing" : fallbackScore >= 40 ? "Suspicious" : "Safe";
        setResult({ score: fallbackScore, verdict: fallbackVerdict, urls: extractUrls(text) });
        setHistory((list) => [...list, { score: fallbackScore, verdict: fallbackVerdict }]);
      } catch (e2) {
        console.error("[analyzeFile] fallback failed:", e2);
      }
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------
     Demo handler — fills textarea AND runs analyze
     ------------------------- */
  function handleDemo() {
    setEmailText(DEMO_EMAIL);
    analyze(DEMO_EMAIL);
  }

  /* -------------------------
     small helper: reset banner timeout
     ------------------------- */
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  /* ------------------------------------------------
     Simple local fallback heuristic (safe, tiny)
     This runs only when backend is unreachable.
     ------------------------------------------------ */
  function extractUrls(text = "") {
    const urlRegex = /https?:\/\/[^\s)]+/gi;
    return text.match(urlRegex) || [];
  }
  function fallbackHeuristicScore(text = "") {
    const lower = text.toLowerCase();
    let score = 0;
    const suspicious = ["verify", "password", "urgent", "click", "suspend", "confirm", "bank", "invoice"];
    suspicious.forEach((k) => { if (lower.includes(k)) score += 12; });
    if (extractUrls(text).length) score += 20;
    return Math.max(0, Math.min(100, score));
  }

  const bg = "bg-slate-950 min-h-screen text-slate-100 relative";

  if (!user) {
    return (
      <div className={bg + " flex items-center justify-center"}>
        <AuthForm />
      </div>
    );
  }

  return (
    <div className={bg}>
      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className={
                "px-4 py-2 rounded-xl shadow-2xl ring-1 backdrop-blur flex items-center gap-2 " +
                (banner.type === "danger"
                  ? "bg-rose-600/20 ring-rose-500/40 text-rose-100"
                  : banner.type === "warn"
                  ? "bg-amber-500/20 ring-amber-400/40 text-amber-100"
                  : "bg-emerald-600/20 ring-emerald-500/40 text-emerald-100")
              }
            >
              {banner.type === "danger" ? <ShieldAlert className="h-5 w-5" /> : banner.type === "warn" ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              <span className="text-sm font-medium">{banner.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur bg-slate-950/60 border-b border-white/5">
        <div className="w-full px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-fuchsia-400" />
            <span className="font-semibold tracking-wide text-xl md:text-4xl">Xtra-Secure</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-slate-300">{user.email}</span>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-semibold transition">Logout</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="w-full px-8 pt-20 pb-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Spot phishing emails in seconds</h1>
            <p className="mt-4 text-lg text-slate-300 max-w-xl">Xtra Secure helps you identify phishing attempts before they reach you. Upload or paste any email, and we’ll estimate how safe or risky it is with an instant phishing score.</p>
            <div className="mt-6 flex gap-4">
              <button onClick={handleDemo} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 focus:outline-none ring-2 ring-fuchsia-400/50 text-base md:text-lg">
                <PlayCircle className="h-6 w-6" /> Demo Mail
              </button>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="bg-slate-900/60 rounded-3xl p-6 ring-1 ring-white/5">
            <div className="grid grid-cols-2 gap-6">
              <StatCard icon={BarChart2} label="Analyzed (session)" value={history.length} />
              <StatCard icon={Bug} label="Phishing caught" value={aggregate.phish} subtitle={`${aggregate.rate}% rate`} />
              <StatCard icon={Link2} label="Links scanned" value={result?.urls?.length || 0} />
              <StatCard icon={ShieldCheck} label="Confidence" value={result ? `${result.score}%` : "—"} />
            </div>
          </motion.div>
        </div>
      </header>

      {/* Analyzer */}
      <section id="analyzer" className="mx-auto max-w-6xl px-4 pb-10">
        {!showResult ? (
          <div className="flex flex-col">
            <label className="text-sm text-slate-300 mb-2 flex items-center gap-2"><Mail className="h-4 w-4" /> Enter email content here</label>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} placeholder="Paste the email text or URL here..." className="h-64 w-full resize-none overflow-y-auto rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4 focus:outline-none focus:ring-fuchsia-500/50 focus:ring-2 placeholder-slate-500" />
            <div className="mt-3 flex items-center gap-3">
              <button disabled={loading} onClick={() => analyze(emailText)} className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 ring-2 ring-fuchsia-400/50">
                <ShieldCheck className="h-5 w-5" /> Analyze Email
                {loading && <span className="ml-2 text-sm text-slate-200">…</span>}
              </button>

              {/* File upload (linked by htmlFor) */}
              <label htmlFor="file-upload-phish" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10 cursor-pointer">
                <Mail className="h-5 w-5" /> Choose File
              </label>
              <input
                id="file-upload-phish"
                type="file"
                accept=".txt,.eml"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) analyzeFile(file);
                  // reset so same file can be selected again
                  e.target.value = "";
                }}
              />

              <button onClick={() => { setEmailText(""); setResult(null); setShowResult(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10">
                <RotateCcw className="h-5 w-5" /> Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-screen">
            {loading ? (
              <Spinner />
            ) : result ? (
              <>
                <RadialBarChart width={280} height={280} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={18} data={[{ name: "Phishing Score", value: result.score, fill: result.verdict === "Phishing" ? "#f43f5e" : result.verdict === "Suspicious" ? "#facc15" : "#22c55e" }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={10} clockWise angleAxisId={0} />
                  <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-bold text-2xl">{result.score}%</text>
                  <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-base">{result.verdict}</text>
                </RadialBarChart>

                <button onClick={() => setShowResult(false)} className="mt-6 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10">← Return to Analyzer</button>
              </>
            ) : (
              <div className="text-slate-300">No result yet</div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950/80 mt-12">
        <div className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-3 gap-8 items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-fuchsia-400" />
              <span className="font-semibold text-slate-200">Xtra Secure</span>
            </div>
            <p className="text-slate-400 text-sm">AI-driven phishing detection, helping you stay safe online.</p>
          </div>
          <div className="md:col-span-2 flex justify-end gap-6">
            <a href="#" className="text-slate-400 hover:text-fuchsia-300 transition">Privacy</a>
            <a href="#" className="text-slate-400 hover:text-fuchsia-300 transition">Terms</a>
            <a href="#" className="text-slate-400 hover:text-fuchsia-300 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
