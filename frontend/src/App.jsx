import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
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
import { auth } from "./firebase"; // make sure you export firebase auth from firebase.js
import { onAuthStateChanged, signOut } from "firebase/auth";

// Function to get color based on verdict
const getScoreColor = (verdict) => {
  if (verdict === "Phishing") return "#f43f5e"; // red
  if (verdict === "Suspicious") return "#facc15"; // yellow
  return "#22c55e"; // green
};

const DEMO_EMAIL = `Subject: Urgent – Verify your account now!

Dear user,

We noticed unusual login activity on your account. For your security, please verify your password within 24 hours or your account will be suspended.

Click here to verify: http://secure-login-update.verify-account-support.com

Regards,
Support Team`;

const SUSPICIOUS_KEYWORDS = [
  "verify",
  "password",
  "urgent",
  "immediately",
  "click",
  "suspend",
  "confirm",
  "bank",
  "invoice",
  "lottery",
  "win",
  "gift",
  "account",
  "unlock",
  "security",
];

const URGENCY_PHRASES = [
  "24 hours",
  "immediately",
  "act now",
  "last chance",
  "final notice",
  "asap",
  "urgent",
];

const KNOWN_GOOD_DOMAINS = [
  "google.com",
  "microsoft.com",
  "github.com",
  "amazon.in",
  "amazon.com",
  "example.com",
];

function extractUrls(text) {
  const urlRegex = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;
  return text.match(urlRegex) || [];
}

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function looksShadyDomain(domain) {
  if (!domain) return false;
  const redFlags = [
    /-secure|verify|update|login|support|account/i,
    /\.ru$|\.cn$|\.tk$|\.zip$|\.top$/i,
    /[0-9]{3,}/, // too many digits
  ];
  return redFlags.some((r) => r.test(domain));
}

function isPunycodeLike(domain) {
  if (!domain) return false;
  return /[^\x00-\x7F]/.test(domain) || /xn--/.test(domain);
}

function keywordHits(text) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const k of SUSPICIOUS_KEYWORDS) {
    if (lower.includes(k)) hits.push(k);
  }
  for (const p of URGENCY_PHRASES) {
    if (lower.includes(p)) hits.push(p);
  }
  return hits;
}

function heuristicScore(text) {
  const urls = extractUrls(text);
  const hits = keywordHits(text);
  let score = 0;

  score += Math.min(hits.length * 8, 40);
  if (urls.length > 0) score += 10 + Math.min(urls.length * 3, 10);

  let domainFindings = [];
  for (const url of urls) {
    const d = getDomain(url);
    if (!d) continue;
    if (!KNOWN_GOOD_DOMAINS.some((g) => d.endsWith(g))) score += 10;
    if (looksShadyDomain(d)) {
      score += 15;
      domainFindings.push(`${d} looks suspicious`);
    }
    if (isPunycodeLike(d)) {
      score += 8;
      domainFindings.push(`${d} may be using look-alike characters`);
    }
  }

  if (URGENCY_PHRASES.some((p) => text.toLowerCase().includes(p))) score += 10;

  score = Math.max(0, Math.min(95, score));

  const reasons = [];
  if (hits.length)
    reasons.push(
      `Suspicious terms: ${Array.from(new Set(hits))
        .slice(0, 8)
        .join(", ")}${hits.length > 8 ? "…" : ""}`
    );
  if (urls.length) reasons.push(`${urls.length} link(s) detected`);
  reasons.push(...domainFindings);
  if (score >= 70) reasons.push("Strong phishing indicators detected");
  else if (score >= 40) reasons.push("Multiple risk signals present");
  else reasons.push("Low risk, but stay cautious");

  return { score, urls, reasons, hits: Array.from(new Set(hits)) };
}

const StatCard = ({ icon: Icon, label, value, subtitle }) => (
  <div className="bg-slate-900/70 backdrop-blur rounded-2xl p-4 ring-1 ring-white/5 shadow-lg shadow-fuchsia-900/20">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30">
        <Icon className="h-5 w-5 text-fuchsia-300" />
      </div>
      <div>
        <div className="text-slate-200 text-sm">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
        {subtitle && (
          <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  </div>
);

export default function App() {
  const [emailText, setEmailText] = useState("");
  const [result, setResult] = useState(null);
  const [banner, setBanner] = useState(null);
  const [history, setHistory] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [user, setUser] = useState(null);

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

  function analyze(text, fromDemo = false) {
    const h = heuristicScore(text);
    const verdict = h.score >= 60 ? "Phishing" : h.score >= 40 ? "Suspicious" : "Safe";
    setResult({ ...h, verdict, text });
    setHistory((list) => [...list, { score: h.score, verdict }]);

    if (verdict === "Phishing") {
      setBanner({ type: "danger", msg: "Potential phishing detected. Do NOT click links." });
    } else if (verdict === "Suspicious") {
      setBanner({ type: "warn", msg: "Some red flags found. Verify sender carefully." });
    } else if (!fromDemo) {
      setBanner({ type: "ok", msg: "Looks safe, but always double-check sender and URL." });
    } else {
      setBanner(null);
    }
  }

  function handleDemo() {
    setEmailText(DEMO_EMAIL);
  }

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const handleLogout = async () => {
    await signOut(auth);
  };

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
      {/* Glow accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 h-72 w-72 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-sky-600/30 blur-3xl" />
      </div>

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
              {banner.type === "danger" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : banner.type === "warn" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{banner.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 backdrop-blur bg-slate-950/60 border-b border-white/5">
        <div className="w-full px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-fuchsia-400" />
            <span className="font-semibold tracking-wide text-xl md:text-4xl">
              Xtra-Secure
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-slate-300">{user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="w-full px-8 pt-20 pb-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              Spot phishing emails in seconds
            </h1>
            <p className="mt-4 text-lg text-slate-300 max-w-xl">
              Xtra Secure helps you identify phishing attempts before they reach
              you. Upload or paste any email, and we’ll estimate how safe or
              risky it is with an instant phishing score.
            </p>
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleDemo}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 focus:outline-none ring-2 ring-fuchsia-400/50 shadow-[0_0_20px_rgba(217,70,239,0.35)] text-base md:text-lg"
              >
                <PlayCircle className="h-6 w-6" /> Demo Mail
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-slate-900/60 rounded-3xl p-6 ring-1 ring-white/5"
          >
            <div className="grid grid-cols-2 gap-6">
              <StatCard
                icon={BarChart2}
                label="Analyzed (session)"
                value={history.length}
              />
              <StatCard
                icon={Bug}
                label="Phishing caught"
                value={aggregate.phish}
                subtitle={`${aggregate.rate}% rate`}
              />
              <StatCard
                icon={Link2}
                label="Links scanned"
                value={result?.urls?.length || 0}
              />
              <StatCard
                icon={ShieldCheck}
                label="Confidence"
                value={result ? `${result.score}%` : "—"}
              />
            </div>
          </motion.div>
        </div>
      </header>

      {/* Analyzer */}
      <section id="analyzer" className="mx-auto max-w-6xl px-4 pb-10">
        {!showResult ? (
          <div className="flex flex-col">
            <label className="text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Enter email content here
            </label>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the email text or URL here..."
              className="h-64 w-full resize-none overflow-y-auto rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4 focus:outline-none focus:ring-fuchsia-500/50 focus:ring-2 placeholder-slate-500"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => {
                  analyze(emailText);
                  setShowResult(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 ring-2 ring-fuchsia-400/50"
              >
                <ShieldCheck className="h-5 w-5" /> Analyze Email
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10 cursor-pointer">
                <Mail className="h-5 w-5" /> Choose File
                <input
                  type="file"
                  accept=".txt,.eml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) =>
                        setEmailText(event.target.result);
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <button
                onClick={() => {
                  setEmailText("");
                  setResult(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10"
              >
                <RotateCcw className="h-5 w-5" /> Reset
              </button>
            </div>
          </div>
        ) : (
          result && (
            <div className="flex flex-col justify-center items-center h-screen">
              <RadialBarChart
                width={280}
                height={280}
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={18}
                data={[
                  {
                    name: "Phishing Score",
                    value: result.score,
                    fill: getScoreColor(result.verdict),
                  },
                ]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  clockWise
                  angleAxisId={0}
                />
                <text
                  x="50%"
                  y="48%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-bold text-2xl"
                >
                  {result.score}%
                </text>
                <text
                  x="50%"
                  y="65%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-300 text-base"
                >
                  {result.verdict}
                </text>
              </RadialBarChart>

              <button
                onClick={() => setShowResult(false)}
                className="mt-6 px-4 py-2 rounded-2xl bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-white/10"
              >
                ← Return to Analyzer
              </button>
            </div>
          )
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
            <p className="text-slate-400 text-sm">
              AI-driven phishing detection, helping you stay safe online.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end gap-6">
            <a
              href="#"
              className="text-slate-400 hover:text-fuchsia-300 transition"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-fuchsia-300 transition"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-fuchsia-300 transition"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
