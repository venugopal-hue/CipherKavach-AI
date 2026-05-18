"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Lock, FileSearch, Zap, ArrowRight, Activity, Terminal, ShieldAlert, Cpu, GitBranch, Network, Layers, Clock, CheckCircle2, TrendingUp, History, Database, Target, FileText, BrainCircuit, ShieldCheck, X, Loader2 } from "lucide-react";
import { auth, db, googleProvider, githubProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function LandingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Live simulated telemetry stream for preview panel
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    "INIT: Core supply chain orchestrator established.",
    "SCAN: package.json dependency tree initialized.",
    "CHECK: Syncing with OSV.dev global database...",
    "CRITICAL: lodash @ 4.17.20 (CVE-2020-8203) detected.",
    "Groq AI: Formulating zero-trust security briefs...",
    "RESOLVED: Upgraded to lodash@4.17.21. Posture secure."
  ]);

  const [activeScanPackage, setActiveScanPackage] = useState("axios");
  const [activeScanStatus, setActiveScanStatus] = useState("SCANNING");
  const [scanProgress, setScanProgress] = useState(45);

  useEffect(() => {
    const packages = ["lodash", "express", "react-dom", "axios", "next", "ip", "async", "minimist"];
    const statuses = ["ANALYZING", "OSV_SYNC", "MITIGATING", "SECURED"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % packages.length;
      setActiveScanPackage(packages[idx] || "axios");
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)] || "ANALYZING";
      setActiveScanStatus(randomStatus);
      setScanProgress(Math.floor(Math.random() * 60) + 40);
      
      setTelemetryLogs(prev => {
        const next = [...prev];
        next.shift();
        next.push(`AUDIT [${packages[idx]}]: Status flagged as [${randomStatus}].`);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const DEMO_EMAIL = "demo@cipherkavach.ai";
  const DEMO_PASSWORD = "Cipher123";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (isAuthLoading) return;
    if (currentUser) {
      router.push("/dashboard");
    } else {
      setShowAuthModal(true);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsSigningIn(true);
    const ADMIN_EMAIL = "venugopalrao1802@gmail.com";

    // 1. Email Normalization & Validation
    const normalizedEmail = authEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError("Email address is required.");
      setIsSigningIn(false);
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      setAuthError("Please enter a valid email address (e.g. user@example.com).");
      setIsSigningIn(false);
      return;
    }
    const parts = normalizedEmail.split("@");
    const domain = parts[1] || "";
    if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
      setAuthError("Invalid email domain structure.");
      setIsSigningIn(false);
      return;
    }

    // 2. Password Validation
    if (!authPassword) {
      setAuthError("Password is required.");
      setIsSigningIn(false);
      return;
    }
    if (authPassword.length < 8) {
      setAuthError("Password must be at least 8 characters long.");
      setIsSigningIn(false);
      return;
    }
    const hasUpper = /[A-Z]/.test(authPassword);
    const hasLower = /[a-z]/.test(authPassword);
    const hasNumber = /[0-9]/.test(authPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
      setAuthError("Password must include at least: 1 uppercase letter, 1 lowercase letter, and 1 number.");
      setIsSigningIn(false);
      return;
    }
    const weakPasswords = ["123456", "12345678", "password", "qwerty", "admin", "12345", "abc123", "password123", "cipherkavach", "123456789"];
    if (weakPasswords.includes(authPassword.toLowerCase())) {
      setAuthError("Password is too weak or commonly used. Please choose a more secure password.");
      setIsSigningIn(false);
      return;
    }

    try {
      if (authMode === "signup") {
        // 3. Signup Full Name Validation
        if (!authFullName.trim()) {
          setAuthError("Full name is required.");
          setIsSigningIn(false);
          return;
        }
        const nameRegex = /^[a-zA-Z\s]{2,50}$/;
        if (!nameRegex.test(authFullName.trim())) {
          setAuthError("Please enter a valid full name (letters and spaces only, 2-50 characters).");
          setIsSigningIn(false);
          return;
        }

        // Register the new user
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, authPassword);
        const user = credential.user;
        
        // Save profile in Firebase auth
        await updateProfile(user, { displayName: authFullName.trim() });
        
        // Save initial user doc in Firestore
        const nowStr = new Date().toISOString();
        const calculateResetDate = () => {
          const d = new Date();
          d.setDate(d.getDate() + 31);
          return d.toISOString();
        };
        const isAdminUser = normalizedEmail === ADMIN_EMAIL;
        
        const defaultDoc = {
          uid: user.uid,
          email: normalizedEmail,
          displayName: authFullName.trim(),
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(authFullName.trim())}&background=0f1219&color=60a5fa&size=128`,
          role: isAdminUser ? "ADMIN" : "operator",
          credits: isAdminUser ? 9999 : 50,
          enterpriseEnabled: isAdminUser,
          redeemedCodes: [],
          registeredAt: nowStr,
          createdAt: nowStr,
          nextResetAt: calculateResetDate(),
          demoScansUsed: 0,
          totalScans: 0,
          lastScanAt: null,
          plan: isAdminUser ? "ENTERPRISE" : "FREE"
        };
        
        try {
          await setDoc(doc(db, "users", user.uid), defaultDoc);
        } catch (setErr) {
          console.warn("Initial signup Firestore save failed:", setErr);
        }
        
        setShowAuthModal(false);
        router.push("/dashboard");
      } else {
        // Log in
        await signInWithEmailAndPassword(auth, normalizedEmail, authPassword);
        setShowAuthModal(false);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const code = (err as {code?: string}).code;
      console.warn("Authentication warning:", err);
      if (code === "auth/email-already-in-use") {
        setAuthError("Email already registered. Try signing in.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/user-not-found") {
        setAuthError("Account not found. Create a new account to continue.");
      } else if (code === "auth/weak-password") {
        setAuthError("Password must be at least 8 characters long and meet secure standards.");
      } else if (code === "auth/invalid-email") {
        setAuthError("Invalid email address format.");
      } else {
        setAuthError((err as {message?: string}).message || "Authentication failed. Try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02050c] selection:bg-blue-500/30" suppressHydrationWarning>
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-900/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-900/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#02050c_100%)] z-[1]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 z-0" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push("/")}>
          <div className="relative flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/30 group-hover:border-blue-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] overflow-hidden">
            <Shield className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform duration-300" strokeWidth={2} />
            <div className="absolute inset-0 bg-blue-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight glow-text text-white">CipherKavach AI</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <a href="#features" className="hover:text-white transition-colors relative group py-1">
            Features
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-500 transition-all group-hover:w-full opacity-50" />
          </a>
          <a href="#pipeline" className="hover:text-white transition-colors relative group py-1">
            How It Works
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-500 transition-all group-hover:w-full opacity-50" />
          </a>
          <button onClick={handleGetStarted} className="hover:text-white transition-colors relative group py-1">
            GitHub Analyzer
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-500 transition-all group-hover:w-full opacity-50" />
          </button>
          <Link href="/enterprise" className="flex items-center gap-1 hover:text-purple-300 text-purple-400/80 transition-colors relative group py-1">
            Enterprise <Zap className="w-3 h-3" />
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-purple-500 transition-all group-hover:w-full opacity-50" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleGetStarted} className="px-5 py-2.5 text-xs font-bold text-white uppercase tracking-wider transition-all bg-blue-600 rounded-lg hover:bg-blue-500 glow-box hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            Get Started
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-bold uppercase tracking-widest border rounded-full text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
        >
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>Vulnerability Scanner MVP</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-5xl mb-6 text-5xl font-black tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-white font-sans leading-none"
        >
          Secure Your Code with <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 relative">
            AI Intelligence
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mb-12 text-base sm:text-lg text-gray-400/90 leading-relaxed font-sans"
        >
          Upload your package.json, scan dependencies against OSV.dev, and get AI-powered remediation advice in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mb-2"
        >
          <button 
            onClick={handleGetStarted} 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 glow-box hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(37,99,235,0.4)] relative group overflow-hidden"
          >
            Start Scanning
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <a href="#features" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white transition-all border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 hover:scale-105 active:scale-95">
            Learn More
          </a>
        </motion.div>

        {/* PREMIUM RUNTIME INTELLIGENCE PREVIEW PANEL */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full max-w-5xl mx-auto mt-16 p-[1px] rounded-3xl bg-gradient-to-b from-blue-500/20 via-purple-500/10 to-transparent shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden group hover:from-blue-500/30 hover:via-purple-500/20 transition-all duration-500"
        >
          {/* Grid effect and ambient glows inside container */}
          <div className="absolute inset-0 bg-[#070b13] opacity-90 rounded-[23px] -z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(59,130,246,0.08),transparent_100%)] pointer-events-none" />
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

          {/* Header Console Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
                SECURE EXECUTION ENGINE ACTIVE
              </span>
              <span className="hidden sm:inline text-[9px] font-mono text-gray-500 px-2 py-0.5 rounded border border-white/5 bg-white/[0.01]">
                VER: v1.0.4-LTS
              </span>
            </div>
            
            <div className="flex items-center gap-4 mt-2 sm:mt-0 text-[10px] font-mono text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>LATENCY: <strong className="text-blue-300">12ms</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>SCORES: <strong className="text-purple-300">COMPUTED</strong></span>
              </div>
            </div>
          </div>

          {/* Body Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            
            {/* Panel 1: Live Vulnerability Audits */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[230px] relative overflow-hidden group/panel">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 blur-2xl rounded-full" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" strokeWidth={2} />
                    <h4 className="text-xs font-black font-sans uppercase tracking-wider text-white">Live Scanner Audits</h4>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 px-1.5 py-0.5 rounded bg-white/5">ENGINE.FLOW</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-gray-300">Active Scan: <strong className="text-blue-400">{activeScanPackage}</strong></span>
                      <span className="text-blue-400 font-bold">{scanProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        animate={{ width: `${scanProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg font-mono text-[9px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target package:</span>
                      <span className="text-white">package.json</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Database connection:</span>
                      <span className="text-emerald-400">OSV.dev REST [OK]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Engine execution status:</span>
                      <span className="text-yellow-400 font-bold animate-pulse">{activeScanStatus}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-gray-500">
                <span>PARSING PIPELINE</span>
                <span className="text-blue-400">SECURE_CHANNEL</span>
              </div>
            </div>

            {/* Panel 2: Telemetry Exploit Vectors */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[230px] relative overflow-hidden group/panel">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 blur-2xl rounded-full" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" strokeWidth={2} />
                    <h4 className="text-xs font-black font-sans uppercase tracking-wider text-white">Active Exploit Vectors</h4>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 px-1.5 py-0.5 rounded bg-white/5">THREATS.SIM</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl text-center">
                    <span className="block text-[8px] font-mono text-gray-500 uppercase tracking-widest">THREAT EXPOSURE</span>
                    <span className="text-lg font-black font-sans text-red-400 animate-pulse">9.8/10</span>
                  </div>
                  <div className="p-2.5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-center">
                    <span className="block text-[8px] font-mono text-gray-500 uppercase tracking-widest">IMPACT RADIUS</span>
                    <span className="text-lg font-black font-sans text-yellow-400">CRITICAL</span>
                  </div>
                </div>

                <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded-lg flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping shrink-0" />
                  <span className="text-[9px] font-mono text-purple-300 truncate">AI Contextual threat score formulated.</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-gray-500">
                <span>AI PROPAGATION INDEX</span>
                <span className="text-purple-400">SYNCED</span>
              </div>
            </div>

            {/* Panel 3: AI Threat Decisions Terminal */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[230px] relative overflow-hidden group/panel">
              <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 blur-2xl rounded-full" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" strokeWidth={2} />
                    <h4 className="text-xs font-black font-sans uppercase tracking-wider text-white">Mitigation Telemetry Logs</h4>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 px-1.5 py-0.5 rounded bg-white/5">SECURE.SHELL</span>
                </div>

                <div className="bg-black/40 border border-white/5 p-3 rounded-lg font-mono text-[9px] text-gray-400 space-y-1 h-[115px] overflow-hidden leading-relaxed">
                  {telemetryLogs.map((log, i) => {
                    let textClass = "text-gray-400";
                    if (log.includes("CRITICAL")) textClass = "text-red-400 font-bold";
                    else if (log.includes("RESOLVED") || log.includes("secure")) textClass = "text-emerald-400 font-bold";
                    else if (log.includes("Groq")) textClass = "text-cyan-400";
                    return (
                      <div key={i} className={`truncate ${textClass}`}>
                        &gt; {log}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-gray-500">
                <span>ORCHESTRATION CONSOLE</span>
                <span className="text-cyan-400">ACTIVE</span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* LOCKED HERO SECTION — DO NOT MODIFY */}
        {/* Everything above is locked. Below are the new sections. */}

        {/* SECTION 1: PROBLEM STATEMENT */}
        <section id="features" className="w-full mt-24 max-w-5xl mx-auto text-left relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 text-white leading-tight font-sans">Why Modern Dependency Security <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Fails</span></h2>
              <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-6">
                Traditional vulnerability scanners dump hundreds of static CVEs on your lap without any deployment context. Developers ignore them, critical supply chain risks slip through, and manual remediation takes weeks.
              </p>
              <ul className="space-y-4">
                {[
                  "Overwhelming vulnerability reports with false positives.",
                  "Zero context on actual runtime threat impact.",
                  "Lack of AI-driven remediation prioritization.",
                  "Slow manual response times to emerging dependency exploits."
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm sm:text-base leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-8 rounded-2xl border border-red-500/20 bg-black/40 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-red-500/40 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-100" />
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-500/20 via-transparent to-transparent" />
              
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/60 animate-ping" />
                <Terminal className="w-5 h-5 text-red-400" />
                <span className="text-[10px] font-mono text-red-500/80 uppercase tracking-widest font-black">CRITICAL TELEMETRY AUDIT</span>
              </div>
              
              <div className="space-y-4 font-mono text-[11px] text-gray-400/90 leading-relaxed">
                <p className="text-red-400/80 font-bold">{`$ npm audit --summary`}</p>
                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-1">
                  <p className="text-red-400 font-bold">☠️ 1,402 SUPPLY CHAIN VULNERABILITIES DETECTED</p>
                  <p className="text-gray-500 font-mono text-[10px]">↳ 20 critical, 180 high, 1,200 low severity packages</p>
                </div>
                <p className="text-gray-500">Executing static parsing heuristics...</p>
                <p className="text-yellow-400/80">{`$ Developer: "Excluding logs. Checking production later..."`}</p>
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-red-500 font-black animate-pulse uppercase tracking-widest text-xs">[ SYSTEM COMPROMISED ]</span>
                  <span className="text-[9px] text-gray-600 font-mono font-bold">PORT: 8083</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 2: CAPABILITIES */}
        <section className="w-full mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6 font-sans">Platform Capabilities</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">An enterprise-grade orchestration engine that turns raw CVE data into actionable, context-aware cybersecurity intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<BrainCircuit className="w-5 h-5" />} title="AI Vulnerability Analysis" description="Groq-powered LLMs contextualize risks and generate mitigation strategies instantly." delay={0.1} />
            <FeatureCard icon={<Activity className="w-5 h-5" />} title="CascadeFlow Intelligence" description="Runtime telemetry orchestration for secure, transparent dependency processing." delay={0.2} />
            <FeatureCard icon={<GitBranch className="w-5 h-5" />} title="GitHub Integration" description="Analyze public repositories directly via instant repo URL ingestion." delay={0.3} />
            <FeatureCard icon={<Terminal className="w-5 h-5" />} title="Threat Simulation" description="Mock exploit telemetry generation to verify and prove theoretical vulnerabilities." delay={0.4} />
            <FeatureCard icon={<Network className="w-5 h-5" />} title="Attack Intelligence Graph" description="Visualize active dependency chains and trace their exact exposure paths." delay={0.5} />
            <FeatureCard icon={<ShieldCheck className="w-5 h-5" />} title="Executive Briefings" description="C-suite ready organizational risk scores and briefs generated on demand." delay={0.6} />
          </div>
        </section>

        {/* SECTION 3: HOW IT WORKS */}
        <section id="pipeline" className="w-full mt-24 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6 font-sans">The Orchestration Pipeline</h2>
            <p className="text-gray-400 text-base sm:text-lg">A fully automated, zero-trust vulnerability processing timeline.</p>
          </div>
          <div className="relative border-l border-white/10 pl-8 ml-4 md:ml-0 md:pl-0 md:border-l-0 space-y-12">
            <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-transparent -translate-x-1/2" />

            {[
              { title: "Target Acquisition", desc: "Upload package.json or link a GitHub Repository.", icon: <Target className="w-5 h-5" />, colorClass: "text-blue-400 border-blue-500/20 bg-blue-500/5", glowColor: "group-hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]" },
              { title: "Dependency Graphing", desc: "Deep extraction of all nested dependencies.", icon: <Network className="w-5 h-5" />, colorClass: "text-purple-400 border-purple-500/20 bg-purple-500/5", glowColor: "group-hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]" },
              { title: "OSV Synchronization", desc: "Cross-referencing with the global OSV.dev database.", icon: <Database className="w-5 h-5" />, colorClass: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5", glowColor: "group-hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]" },
              { title: "CascadeFlow Routing", desc: "Intelligent delegation to Groq AI models.", icon: <Cpu className="w-5 h-5" />, colorClass: "text-yellow-400 border-yellow-500/20 bg-yellow-500/5", glowColor: "group-hover:border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]" },
              { title: "Executive Output", desc: "Generation of remediation scripts and threat briefs.", icon: <FileText className="w-5 h-5" />, colorClass: "text-green-400 border-green-500/20 bg-green-500/5", glowColor: "group-hover:border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]" }
            ].map((step, i) => (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} key={i} className={`relative flex flex-col md:flex-row items-start md:items-center justify-between group ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                <div className="hidden md:block w-[45%]" />
                <div className={`absolute left-[-52px] md:static md:left-auto w-12 h-12 rounded-full border flex items-center justify-center z-10 transition-all duration-300 ${step.colorClass} ${step.glowColor} group-hover:scale-110`}>
                  {step.icon}
                </div>
                <div className={`w-full md:w-[45%] p-6 rounded-2xl border border-white/5 bg-white/[0.01] group-hover:bg-white/[0.03] group-hover:border-white/10 transition-all duration-300 text-left shadow-xl ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                  <div className="flex items-center gap-2 mb-2 justify-start md:justify-normal">
                    <span className="text-[10px] font-mono bg-white/5 text-gray-400 px-2 py-0.5 rounded border border-white/10">STAGE 0{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight mb-2 font-sans group-hover:text-blue-400 transition-colors duration-300">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 4: TECH STACK */}
        <section className="w-full mt-24">
          <div className="text-center mb-12">
            <p className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-4">Powered By Enterprise-Grade Technology</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {["Next.js", "TypeScript", "Firebase", "Groq AI", "CascadeFlow", "OSV.dev API", "TailwindCSS", "Framer Motion"].map(tech => (
              <div key={tech} className="px-6 py-3 rounded-xl glass-card border border-white/5 text-gray-300 font-medium hover:text-white hover:border-white/20 transition-all cursor-default shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                {tech}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: ROADMAP */}
        <section className="w-full mt-24 max-w-6xl mx-auto text-left">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-white/5 pb-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 font-sans">Enterprise Roadmap</h2>
              <p className="text-gray-400 text-base">The future of autonomous SOC orchestration.</p>
            </div>
            <div className="px-4 py-2 mt-4 md:mt-0 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3" /> Coming Soon
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {["Continuous Monitoring", "CI/CD Pipeline Integration", "Slack Threat Alerts", "Enterprise Team Workspaces", "AI Threat Correlation", "GitHub PR Analysis", "Real-Time Risk Feeds", "Compliance Reporting"].map((feature, i) => (
              <div key={i} className="p-6 bg-white/[0.01] hover:bg-white/[0.03] rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between h-36 group shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">TASK 0{i + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40 animate-pulse" />
                </div>
                <h4 className="font-bold text-white text-sm tracking-tight mb-2 font-sans group-hover:text-blue-300 transition-colors">{feature}</h4>
                <div>
                  <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-1">
                    <span>DEVELOPMENT</span>
                    <span>33%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 w-1/3 group-hover:w-1/2 transition-all duration-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 6: PRODUCT REALISM (HISTORY PREVIEW) */}
        <section className="w-full mt-24 max-w-5xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6">Persistent Intelligence</h2>
          <p className="text-gray-400 mb-12 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">Log in to track your organizational exposure over time with cloud-synced Firebase history and real-time posture analytics.</p>
 
          <div className="glass-card p-4 rounded-3xl border border-white/10 max-w-3xl mx-auto shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-black/40 to-transparent z-10 flex flex-col items-center justify-end pb-12">
              <button onClick={handleGetStarted} className="px-6 py-3 bg-blue-600/90 hover:bg-blue-500 backdrop-blur-md border border-blue-400/30 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                <Lock className="w-3.5 h-3.5" /> Authenticate Operator Console
              </button>
            </div>
            
            {/* Interactive Wireframe Dashboard Mock */}
            <div className="grid grid-cols-3 gap-3 opacity-25 p-4 pointer-events-none font-mono text-[9px] text-gray-500 text-left">
              <div className="col-span-1 space-y-3">
                <div className="h-8 bg-white/5 border border-white/10 rounded-lg w-full flex items-center px-2">⚡ SYSTEM STATUS</div>
                <div className="h-28 bg-white/5 border border-white/10 rounded-xl w-full p-2 space-y-1">
                  <div className="w-1/2 h-2 bg-blue-500/20 rounded" />
                  <div className="w-3/4 h-2 bg-white/10 rounded" />
                  <div className="w-2/3 h-2 bg-white/10 rounded" />
                  <div className="w-full h-10 bg-white/5 rounded mt-2 border border-white/5" />
                </div>
                <div className="h-28 bg-white/5 border border-white/10 rounded-xl w-full p-2 space-y-1">
                  <div className="w-2/3 h-2 bg-purple-500/20 rounded" />
                  <div className="w-1/2 h-2 bg-white/10 rounded" />
                  <div className="w-4/5 h-2 bg-white/10 rounded" />
                  <div className="w-full h-10 bg-white/5 rounded mt-2 border border-white/5" />
                </div>
              </div>
              <div className="col-span-2 space-y-3">
                <div className="h-36 bg-white/5 border border-white/10 rounded-xl w-full p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white font-bold">POSTURE INDEX</span>
                    <span>STABLE</span>
                  </div>
                  <div className="h-16 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-lg">94.8% IMMUNITY</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded" />
                </div>
                <div className="h-28 bg-white/5 border border-white/10 rounded-xl w-full p-3 space-y-1">
                  <div className="w-1/3 h-2 bg-white/20 rounded" />
                  <div className="w-full h-1 bg-white/10 rounded" />
                  <div className="w-full h-1 bg-white/10 rounded" />
                  <div className="w-full h-1 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: FINAL CTA */}
        <section className="w-full mt-24 mb-20 text-center">
          <div className="glass-card p-12 md:p-20 rounded-[3rem] border border-blue-500/20 relative overflow-hidden group shadow-[0_0_50px_rgba(37,99,235,0.1)]">
            <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors duration-700" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

            <Shield className="w-16 h-16 text-blue-400 mx-auto mb-8 animate-pulse relative z-10" />
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 relative z-10 font-sans leading-tight">Secure Your Software <br className="hidden sm:inline" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Supply Chain</span></h2>
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto relative z-10 font-sans leading-relaxed">Join elite engineering teams proactively eliminating vulnerabilities before they reach production.</p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
              <button onClick={handleGetStarted} className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white transition-all bg-blue-600 rounded-xl hover:bg-blue-500 glow-box hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                Start Scanning
                <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={handleGetStarted} className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white transition-all border border-white/10 rounded-xl bg-black/40 backdrop-blur-md hover:bg-white/10 hover:scale-105 active:scale-95">
                <GitBranch className="w-5 h-5 text-gray-400" />
                Analyze GitHub Repository
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* PREMIUM FOOTER */}
      <footer className="relative z-10 w-full border-t border-white/5 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 mb-4 opacity-60 hover:opacity-100 transition-opacity">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-bold tracking-widest uppercase text-white">CipherKavach AI</span>
          </div>
          <p className="text-xs font-mono text-gray-500 mb-2">Runtime Intelligence Platform</p>
          <div className="w-12 h-px bg-white/10 my-4" />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-xs text-gray-600">
            <span>Built by Venugopal Rao</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>Karma Enterprises</span>
            <span className="hidden sm:inline">&middot;</span>
            <span className="font-mono">17-05-2026</span>
          </div>
        </div>
      </footer>

      {/* AUTH-GATED DASHBOARD ACCESS */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" suppressHydrationWarning>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#0f1219] border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden" suppressHydrationWarning>
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />
              <button onClick={() => { setShowAuthModal(false); setAuthError(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
 
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-1">CipherKavach AI</h3>
                <p className="text-gray-500 text-xs mb-5">Access the autonomous intelligence platform.</p>
 
                {/* Mode Select Tabs */}
                <div className="flex w-full bg-white/5 border border-white/10 p-1 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${authMode === "login" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${authMode === "signup" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* OAuth Buttons */}
                <div className="w-full space-y-2.5 mb-5">
                  <button onClick={() => { setIsSigningIn(true); signInWithPopup(auth, googleProvider).then(() => { setShowAuthModal(false); router.push('/dashboard'); }).finally(() => setIsSigningIn(false)); }} disabled={isSigningIn} className="w-full py-2.5 px-4 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors text-sm disabled:opacity-60">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Continue with Google
                  </button>
                  <button onClick={() => { setIsSigningIn(true); signInWithPopup(auth, githubProvider).then(() => { setShowAuthModal(false); router.push('/dashboard'); }).finally(() => setIsSigningIn(false)); }} disabled={isSigningIn} className="w-full py-2.5 px-4 bg-[#24292e] text-white font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-[#2c3238] transition-colors border border-white/5 text-sm disabled:opacity-60">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    Continue with GitHub
                  </button>
                </div>
 
                {/* Divider */}
                <div className="w-full flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
 
                {/* Email / Password Form */}
                <form onSubmit={handleEmailAuth} className="w-full space-y-2.5">
                  {authMode === "signup" && (
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={authFullName}
                      onChange={e => { setAuthFullName(e.target.value); setAuthError(""); }}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all"
                      required
                    />
                  )}
                  <input type="email" placeholder="Email address" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthError(""); }} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all" required />
                  <input type="password" placeholder="Password" value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthError(""); }} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all" required />
                  {authError && (
                    <div className="text-left bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 w-full">
                      <p className="text-xs text-red-400 font-mono leading-relaxed">{authError}</p>
                      {authError.includes("Account not found") && (
                        <button
                          type="button"
                          onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                          className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider underline block text-left"
                        >
                          👉 Create a new account now
                        </button>
                      )}
                    </div>
                  )}
                  <button type="submit" disabled={isSigningIn} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {isSigningIn ? "Authenticating..." : authMode === "signup" ? "Create Account" : "Sign In"}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="group relative p-8 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-blue-500/30 transition-all duration-300 text-left shadow-xl hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] overflow-hidden"
    >
      {/* Interactive Hover Background Pulse */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-3xl" />
      <div className="absolute -inset-px bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-[1px]" />
      
      <div className="flex items-center justify-center w-12 h-12 mb-6 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:scale-110 group-hover:border-blue-400/50 group-hover:text-blue-300 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
        {icon}
      </div>
      <h3 className="mb-3 text-lg font-bold text-white tracking-tight font-sans group-hover:text-blue-300 transition-colors duration-300">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm group-hover:text-gray-300 transition-colors duration-300">{description}</p>
    </motion.div>
  );
}
