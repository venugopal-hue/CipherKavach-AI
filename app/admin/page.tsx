"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Users, Key, Activity, FileText, ArrowLeft,
  BarChart2, Terminal, ShieldAlert, Cpu, Database,
  GitMerge, Loader2, LogOut, Search, CheckCircle2,
  X, ChevronDown, Zap, Ban, Star, RefreshCw, Download
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, setDoc, serverTimestamp, getDoc, Timestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

interface OperatorDoc {
  uid: string; email: string; credits: number;
  enterpriseEnabled: boolean; suspended?: boolean;
  role?: string; redeemedCodes?: string[];
  createdAt?: { toDate: () => Date } | null;
  displayName?: string;
  avatarUrl?: string;
}

interface CodeDoc {
  id: string; credits: number; enterprise: boolean; replayAccess: boolean;
  active: boolean; label?: string; createdBy?: string; usageLimit?: number;
  redeemedCount?: number; expiresAt?: string;
  createdAt?: { toDate: () => Date } | null;
}

interface RedemptionDoc {
  id: string; code: string; uid?: string;
  userId?: string;
  benefit?: string; creditsGranted?: number;
  enterpriseUnlocked?: boolean; replayAccess?: boolean;
  status?: string;
  redeemedAt?: { toDate: () => Date } | null;
  // enriched client-side
  operatorEmail?: string;
  redeemedByEmail?: string;
  runtimeTier?: string;
}

/* ── ADMIN RUNTIME CONSOLE — ISOLATED ROUTE — DO NOT MERGE WITH DASHBOARD ── */

const ADMIN_EMAIL = "venugopalrao1802@gmail.com";

type Tab = "overview" | "operators" | "codes" | "redemptions" | "analytics" | "audit" | "health" | "requests";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",    label: "Overview",       icon: <BarChart2   className="w-4 h-4" /> },
  { id: "operators",   label: "Operators",      icon: <Users       className="w-4 h-4" /> },
  { id: "codes",       label: "Access Codes",   icon: <Key         className="w-4 h-4" /> },
  { id: "redemptions", label: "Redemptions",    icon: <GitMerge    className="w-4 h-4" /> },
  { id: "requests",    label: "Quota Requests", icon: <Database    className="w-4 h-4" /> },
  { id: "analytics",   label: "Analytics",      icon: <Activity    className="w-4 h-4" /> },
  { id: "audit",       label: "Audit Log",      icon: <FileText    className="w-4 h-4" /> },
  { id: "health",      label: "System Health",  icon: <Cpu         className="w-4 h-4" /> },
];

const PlaceholderCard = ({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) => (
  <div className="glass-card p-8 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center gap-4 min-h-[200px]">
    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">{icon}</div>
    <div>
      <p className="text-sm font-bold text-white mb-1">{title}</p>
      <p className="text-xs text-gray-500 font-mono">{description}</p>
    </div>
    <span className="text-[10px] bg-white/5 border border-white/10 text-gray-600 px-3 py-1 rounded-full font-mono">BACKEND INTEGRATION PENDING</span>
  </div>
);

const StatCard = ({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) => (
  <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-16 h-16 blur-[40px] rounded-full opacity-30 ${color}`} />
    <div className="flex items-center gap-2 mb-3">{icon}<span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{label}</span></div>
    <p className="text-3xl font-black font-mono text-white">{value}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0b0f19]/95 border border-yellow-500/40 backdrop-blur-2xl px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] border-l-4 border-l-yellow-400 space-y-1 font-mono">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: data.fill }} />
          <span className="text-xs text-white/90">Metrics:</span>
          <span className="text-xs font-black text-yellow-300 font-mono">{payload[0].value} units</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mounted, setMounted] = useState(false);
  const [adminPeriod, setAdminPeriod] = useState("all");
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<{ title: string; message: string; type: "success" | "info" | "error" } | null>(null);
  const [demoActionLoading, setDemoActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Operators state
  const [operators, setOperators] = useState<OperatorDoc[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantModal, setGrantModal] = useState<OperatorDoc | null>(null);
  const [grantAmt, setGrantAmt] = useState(100);
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ uid: string; email: string; action: string; label: string } | null>(null);

  // Floating dropdown menu state
  const [activeMenu, setActiveMenu] = useState<{
    type: "operator" | "code";
    id: string;
    x: number;
    y: number;
    data: any;
  } | null>(null);

  // Audit Logs states
  const [auditSearch, setAuditSearch] = useState("");
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditSeverity, setAuditSeverity] = useState("all");
  const [auditDateFilter, setAuditDateFilter] = useState("all");
  const [showExportMenu, setShowExportMenu] = useState(false);

  // System Health States
  const [healthStatus, setHealthStatus] = useState<Record<string, "HEALTHY" | "DEGRADED" | "OFFLINE">>({
    Firebase: "HEALTHY",
    Firestore: "HEALTHY",
    "Groq API": "HEALTHY",
    "CascadeFlow Runtime": "HEALTHY",
    "OSV.dev": "HEALTHY",
    Authentication: "HEALTHY",
    "Runtime APIs": "HEALTHY",
    "Telemetry Engine": "HEALTHY",
  });
  const [healthEvents, setHealthEvents] = useState<{ id: string; time: string; msg: string; type: "info" | "warning" | "error" }[]>([
    { id: "1", time: "09:41 pm", msg: "Groq API latency spike detected (1.8s)", type: "warning" },
    { id: "2", time: "09:42 pm", msg: "Telemetry Engine synchronization recovered", type: "info" },
    { id: "3", time: "09:43 pm", msg: "Firestore database connection fully healthy", type: "info" },
    { id: "4", time: "09:44 pm", msg: "Authentication system health check passed", type: "info" },
  ]);
  const [healthFilter, setHealthFilter] = useState<"all" | "healthy" | "degraded" | "offline" | "incidents">("all");

  const logAudit = useCallback(async (action: string, target: string, detail?: string) => {
    try {
      await addDoc(collection(db, "auditLogs"), {
        action: action || "",
        target: target || "",
        detail: detail || "",
        actor: currentUser?.email || "System Engine",
        timestamp: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  }, [currentUser]);

  const loadOperators = useCallback(async () => {
    setOpsLoading(true);
    try {
      console.log('[Firestore Audit] Fetching "users" collection from Firestore');
      const snap = await getDocs(collection(db, "users"));
      console.log(`[Firestore Audit] "users" collection fetch successful. Operators: ${snap.size}`);
      setOperators(snap.docs.map(d => {
        const data = d.data();
        const docEmail = data?.email || (d.id === currentUser?.uid ? currentUser?.email : "") || "";
        
        let resolvedName = data?.displayName || "";
        if (!resolvedName && docEmail) {
          if (docEmail.toLowerCase().includes("venugopalrao")) {
            resolvedName = "Venugopal Rao";
          } else {
            const prefix = docEmail.split("@")[0] || "";
            const cleanPrefix = prefix.replace(/[0-9]/g, "");
            if (cleanPrefix) {
              const parts = cleanPrefix.split(/[\._\-]/);
              resolvedName = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
            }
          }
        }
        if (!resolvedName) resolvedName = "Unknown Operator";

        return { uid: d.id, ...data, email: docEmail, displayName: resolvedName } as OperatorDoc;
      }));
    } catch (e) {
      console.error('[Firestore Audit] Failed to load "users" collection:', e);
    }
    setOpsLoading(false);
  }, [currentUser]);

  useEffect(() => { if (!isLoading && currentUser && activeTab === "operators") loadOperators(); }, [isLoading, currentUser, activeTab, loadOperators]);

  const execGrant = async () => {
    if (!grantModal) return;
    setActionLoading(grantModal.uid);
    try {
      const ref = doc(db, "users", grantModal.uid);
      const snap = await getDoc(ref);
      const cur = snap.exists() ? (snap.data().credits ?? 0) : 0;
      await updateDoc(ref, { credits: cur + grantAmt });
      await logAudit("GRANT_CREDITS", grantModal.email, `+${grantAmt}`);
      setOperators(p => p.map(u => u.uid === grantModal.uid ? { ...u, credits: u.credits + grantAmt } : u));
      setGrantModal(null);
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const execConfirm = async () => {
    if (!confirmModal) return;
    const { uid, email, action } = confirmModal;
    setActionLoading(uid);
    try {
      const ref = doc(db, "users", uid);
      if (action === "toggle_enterprise") {
        const snap = await getDoc(ref); const cur = snap.data()?.enterpriseEnabled ?? false;
        await updateDoc(ref, { enterpriseEnabled: !cur });
        await logAudit(cur ? "REVOKE_ENTERPRISE" : "GRANT_ENTERPRISE", email);
        setOperators(p => p.map(u => u.uid === uid ? { ...u, enterpriseEnabled: !cur } : u));
      } else if (action === "suspend") {
        const snap = await getDoc(ref); const cur = snap.data()?.suspended ?? false;
        await updateDoc(ref, { suspended: !cur });
        await logAudit(cur ? "UNSUSPEND" : "SUSPEND", email);
        setOperators(p => p.map(u => u.uid === uid ? { ...u, suspended: !cur } : u));
      } else if (action === "set_demo") {
        await updateDoc(ref, { role: "demo" });
        await logAudit("SET_ROLE_DEMO", email);
        setOperators(p => p.map(u => u.uid === uid ? { ...u, role: "demo" } : u));
      } else if (action === "reset_credits") {
        await updateDoc(ref, { credits: 50 });
        await logAudit("RESET_CREDITS", email);
        setOperators(p => p.map(u => u.uid === uid ? { ...u, credits: 50 } : u));
      }
      setConfirmModal(null);
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const filteredOps = operators.filter(u => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || u.email?.toLowerCase().includes(q) || u.uid?.toLowerCase().includes(q);
    const matchF = filterRole === "all" || (filterRole === "enterprise" && u.enterpriseEnabled) ||
      (filterRole === "suspended" && u.suspended) || (filterRole === "demo" && u.role === "demo");
    return matchQ && matchF;
  });

  // ── ACCESS CODES STATE ──
  const [codes, setCodes] = useState<CodeDoc[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("all");
  const [codeMenuId, setCodeMenuId] = useState<string | null>(null);
  const [codeActionLoading, setCodeActionLoading] = useState<string | null>(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genName, setGenName] = useState("");
  const [genCredits, setGenCredits] = useState(100);
  const [genEnterprise, setGenEnterprise] = useState(false);
  const [genReplay, setGenReplay] = useState(false);
  const [genLimit, setGenLimit] = useState(1);
  const [genExpiry, setGenExpiry] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      console.log('[Firestore Audit] Fetching "runtimeCodes" collection from Firestore');
      const snap = await getDocs(collection(db, "runtimeCodes"));
      console.log(`[Firestore Audit] "runtimeCodes" collection fetch successful. Codes: ${snap.size}`);
      setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as CodeDoc)));
    } catch (e) {
      console.error('[Firestore Audit] Failed to load "runtimeCodes" collection:', e);
    }
    setCodesLoading(false);
  }, []);

  useEffect(() => { if (!isLoading && currentUser && activeTab === "codes") loadCodes(); }, [isLoading, currentUser, activeTab, loadCodes]);

  const isExpired = (c: CodeDoc) => !!c.expiresAt && new Date(c.expiresAt) < new Date();

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const prefixes = ["CIPHER", "CASCADE", "RUNTIME", "ENTERPRISE", "NEXUS"];
      const code = genName.trim().toUpperCase() || `${prefixes[Math.floor(Math.random()*prefixes.length)]}-${suffix}`;
      const label = `${genEnterprise ? "Enterprise" : "Standard"} · +${genCredits} Credits`;
      const data: Record<string, unknown> = { credits: genCredits, enterprise: genEnterprise, replayAccess: genReplay, label, active: true, usageLimit: genLimit, redeemedCount: 0, createdBy: currentUser?.email || "", createdAt: serverTimestamp() };
      if (genExpiry) data.expiresAt = genExpiry;
      await setDoc(doc(db, "runtimeCodes", code), data);
      await logAudit("GENERATE_CODE", code, label);
      setCodes(p => [{ id: code, credits: genCredits, enterprise: genEnterprise, replayAccess: genReplay, active: true, label, usageLimit: genLimit, redeemedCount: 0, createdBy: currentUser?.email || "" }, ...p]);
      setShowGenModal(false); setGenName(""); setGenExpiry("");
    } catch (e) { console.error(e); }
    setIsGenerating(false);
  };

  const disableCode = async (id: string, active: boolean) => {
    setCodeActionLoading(id);
    try {
      await updateDoc(doc(db, "runtimeCodes", id), { active: !active });
      await logAudit(active ? "DISABLE_CODE" : "REACTIVATE_CODE", id);
      setCodes(p => p.map(c => c.id === id ? { ...c, active: !active } : c));
    } catch (e) { console.error(e); }
    setCodeActionLoading(null);
  };

  const deleteCode = async (id: string) => {
    setCodeActionLoading(id);
    try {
      await deleteDoc(doc(db, "runtimeCodes", id));
      await logAudit("DELETE_CODE", id);
      setCodes(p => p.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
    setCodeActionLoading(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code); setTimeout(() => setCopiedCode(""), 2000);
  };

  const filteredCodes = codes.filter(c => {
    const matchQ = !codeSearch || c.id.toLowerCase().includes(codeSearch.toLowerCase());
    const exp = isExpired(c);
    const matchF = codeFilter === "all" || (codeFilter === "active" && c.active && !exp) ||
      (codeFilter === "expired" && exp) || (codeFilter === "disabled" && !c.active) ||
      (codeFilter === "enterprise" && c.enterprise) || (codeFilter === "replay" && c.replayAccess);
    return matchQ && matchF;
  });

  // ── REDEMPTIONS STATE ──
  const [redemptions, setRedemptions] = useState<RedemptionDoc[]>([]);
  const [redempsLoading, setRedempsLoading] = useState(false);
  const [redempSearch, setRedempSearch] = useState("");
  const [redempFilter, setRedempFilter] = useState("all");

  const loadRedemptions = useCallback(async () => {
    setRedempsLoading(true);
    try {
      console.log('[Firestore Audit] Fetching "redemptions" and "users" for mapping redemptions logs');
      const snap = await getDocs(collection(db, "redemptions"));
      const usersSnap = await getDocs(collection(db, "users"));
      console.log(`[Firestore Audit] Redemptions Count: ${snap.size}, Users Count: ${usersSnap.size}`);
      const emailMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => { const data = d.data(); if (data?.email) emailMap[d.id] = data.email; });
      const data = snap.docs.map(d => {
        const raw = d.data();
        const uid = raw.userId || raw.uid || "";
        const emailFallback = (uid && emailMap[uid]) ? emailMap[uid] : "";
        const resolvedEmail = raw.redeemedByEmail || raw.operatorEmail || emailFallback || (uid ? `uid: ${uid.substring(0, 8)}...` : "Unknown Operator");
        
        return {
          id: d.id,
          code: raw.code || "",
          ...raw,
          uid,
          userId: uid,
          creditsGranted: raw.creditsGranted ?? 0,
          enterpriseUnlocked: raw.enterpriseUnlocked ?? raw.enterpriseEnabled ?? false,
          replayAccess: raw.replayAccess ?? false,
          operatorEmail: resolvedEmail,
          redeemedByEmail: resolvedEmail,
          status: raw.status || "REDEEMED",
          runtimeTier: raw.runtimeTier || (raw.enterpriseUnlocked || raw.enterpriseEnabled ? "ENTERPRISE" : "STANDARD")
        } as RedemptionDoc;
      });
      // Sort newest first
      data.sort((a, b) => (b.redeemedAt?.toDate?.().getTime() ?? 0) - (a.redeemedAt?.toDate?.().getTime() ?? 0));
      setRedemptions(data);
    } catch (e) {
      console.error('[Firestore Audit] Failed to load redemptions details:', e);
    }
    setRedempsLoading(false);
  }, []);

  useEffect(() => { if (!isLoading && currentUser && activeTab === "redemptions") loadRedemptions(); }, [isLoading, currentUser, activeTab, loadRedemptions]);

  const filteredRedemptions = redemptions.filter(r => {
    const q = redempSearch.toLowerCase();
    const matchQ = !q || r.code?.toLowerCase().includes(q) || r.operatorEmail?.toLowerCase().includes(q) || r.uid?.toLowerCase().includes(q);
    const matchF = redempFilter === "all" ||
      (redempFilter === "enterprise" && r.enterpriseUnlocked) ||
      (redempFilter === "replay" && r.replayAccess) ||
      (redempFilter === "high" && (r.creditsGranted ?? 0) >= 150) ||
      (redempFilter === "recent" && r.redeemedAt && (Date.now() - r.redeemedAt.toDate().getTime()) < 86400000);
    return matchQ && matchF;
  });

  const totalCreditsGranted = redemptions.reduce((s, r) => s + (r.creditsGranted ?? 0), 0);
  const enterpriseActivations = redemptions.filter(r => r.enterpriseUnlocked).length;
  const replayUnlocks = redemptions.filter(r => r.replayAccess).length;
  const mostUsedCode = (() => { const counts: Record<string,number> = {}; redemptions.forEach(r => { if (r.code) counts[r.code] = (counts[r.code]||0)+1; }); return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"; })();

  // ── ANALYTICS & UNIFIED STATE ──
  const [globalLoading, setGlobalLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [totalScans, setTotalScans] = useState(0);
  const [auditEvents, setAuditEvents] = useState<{id:string; action:string; target?:string; actor?:string; detail?:string; timestamp?:{toDate:()=>Date}|null}[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("7d");

  // Runtime Credit Request System States
  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);
  const [reqActionLoading, setReqActionLoading] = useState<string | null>(null);

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setSeedResult("Initializing client-side operational database seeder...");
    try {
      const now = new Date();
      const ADMIN_UID = "Mu2hYM65AxOOffisPtdGygMGtDf1";
      const DEMO_UID = "eU0Q67e1JNNPMnR6ptI67qpFL7W2";

      const targetCollections = [
        "scans",
        "auditLogs",
        "redemptions",
        "notifications",
        "runtimeCodes",
        "savedReports",
        "replayHistory",
        "telemetryLogs"
      ];

      // 1. DELETE EXISTING DATA
      setSeedResult("🧹 Clearing corrupted/incorrect database records...");
      for (const colName of targetCollections) {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      }
      setSeedResult("✅ Old records cleared. Registering system users...");

      // 2. POPULATE USERS
      const users = [
        {
          uid: ADMIN_UID,
          email: "venugopalrao1802@gmail.com",
          displayName: "Venugopal Rao",
          avatarUrl: "https://avatars.githubusercontent.com/u/1024000?v=4",
          role: "ADMIN",
          plan: "ENTERPRISE",
          credits: 9999,
          totalScans: 85,
          demoScansUsed: 0,
          registeredAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
          createdAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
          nextResetAt: new Date(now.getTime() + 15 * 86400000).toISOString(),
          suspended: false,
          enterpriseEnabled: true,
        },
        {
          uid: DEMO_UID,
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
        }
      ];

      for (const u of users) {
        await setDoc(doc(db, "users", u.uid), u, { merge: true });
      }
      setSeedResult("✅ Users populated. Seeding scans manifest...");

      // 3. POPULATE SCANS
      const packages = ["lodash", "axios", "minimist", "ws", "express", "react", "next", "socket.io", "async", "ip"];
      const cves = [
        { cve: "CVE-2020-8203", score: 9.8, pkg: "lodash", severity: "CRITICAL" },
        { cve: "CVE-2020-28168", score: 8.4, pkg: "axios", severity: "HIGH" },
        { cve: "CVE-2021-3918", score: 7.5, pkg: "minimist", severity: "HIGH" },
        { cve: "CVE-2021-32803", score: 5.6, pkg: "ws", severity: "MEDIUM" },
        { cve: "CVE-2022-24999", score: 2.4, pkg: "express", severity: "LOW" },
        { cve: "CVE-2023-42282", score: 8.9, pkg: "socket.io", severity: "HIGH" }
      ];

      const seedScansForUser = async (userId: string, count: number) => {
        for (let i = 0; i < count; i++) {
          const scanDate = new Date(now.getTime() - (count - i) * 1.2 * 86400000 - Math.random() * 12 * 3600000);
          const cveData = cves[i % cves.length];

          await addDoc(collection(db, "scans"), {
            userId: userId, 
            package: cveData.pkg,
            CVE: cveData.cve,
            severity: cveData.severity,
            threatScore: cveData.score,
            creditsConsumed: 1,
            timestamp: scanDate.toISOString(),
            runtimeMode: i % 3 === 0 ? "AI_ENRICHED" : "STANDARD"
          });
        }
      };

      await seedScansForUser(DEMO_UID, 20);
      await seedScansForUser(ADMIN_UID, 24);
      if (currentUser?.uid && currentUser.uid !== ADMIN_UID && currentUser.uid !== DEMO_UID) {
        await seedScansForUser(currentUser.uid, 15);
      }
      setSeedResult("✅ Scans populated. Seeding audit telemetry...");

      // 4. POPULATE AUDIT LOGS
      const auditActions = [
        { action: "SCAN_EXECUTED", cat: "SYSTEM", sev: "INFO", desc: "Enterprise dependency structure scan executed on target package manifest." },
        { action: "RUNTIME_CREDITS_DEDUCTED", cat: "CREDIT", sev: "INFO", desc: "Deducted 1 operation credit for deep AI runtime threat tracing." },
        { action: "REPLAY_LAUNCHED", cat: "SIMULATION", sev: "INFO", desc: "Vulnerability simulation sandbox spun up successfully." },
        { action: "ENTERPRISE_GRANTED", cat: "GOVERNANCE", sev: "WARNING", desc: "Provisioned automated enterprise operations license." },
        { action: "CODE_REDEEMED", cat: "CREDIT", sev: "INFO", desc: "Standard operator redemption trace completed." },
        { action: "RUNTIME_ESCALATION_BLOCKED", cat: "SECURITY", sev: "CRITICAL", desc: "CascadeFlow intercepted a prototype pollution execution attempt." },
        { action: "TELEMETRY_SYNC_COMPLETED", cat: "SYSTEM", sev: "INFO", desc: "Vulnerability threat database synchronized in 140ms." }
      ];

      for (let i = 0; i < 30; i++) {
        const logDate = new Date(now.getTime() - (30 - i) * 1.2 * 3600000 - Math.random() * 300000);
        const actionTemplate = auditActions[i % auditActions.length];

        await addDoc(collection(db, "auditLogs"), {
          actor: i % 3 === 0 ? "Venugopal Rao" : i % 2 === 0 ? "Demo Operator" : "System Core",
          target: i % 4 === 0 ? "express-app" : "production-build",
          action: actionTemplate.action,
          category: actionTemplate.cat,
          severity: actionTemplate.sev,
          detail: actionTemplate.desc,
          timestamp: Timestamp.fromDate(logDate)
        });
      }
      setSeedResult("✅ Audit logs populated. Seeding access codes...");

      // 5. POPULATE RUNTIME CODES
      const runtimeCodes = [
        { code: "CIPHER-100", credits: 100, enterprise: false, replayAccess: false, usageLimit: 50, redeemedCount: 14, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
        { code: "ENTERPRISE-PRO", credits: 250, enterprise: true, replayAccess: true, usageLimit: 10, redeemedCount: 4, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
        { code: "CASCADEFLOW-VIP", credits: 150, enterprise: true, replayAccess: true, usageLimit: 25, redeemedCount: 18, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
        { code: "HACKATHON-2026", credits: 200, enterprise: true, replayAccess: true, usageLimit: 100, redeemedCount: 65, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
        { code: "CIPHER-STARTER", credits: 50, enterprise: false, replayAccess: false, usageLimit: 200, redeemedCount: 145, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() }
      ];

      for (const rc of runtimeCodes) {
        await setDoc(doc(db, "runtimeCodes", rc.code), rc);
      }
      setSeedResult("✅ Access codes populated. Seeding redemptions...");

      // 6. POPULATE REDEMPTIONS
      for (let i = 0; i < 10; i++) {
        const redemptionDate = new Date(now.getTime() - i * 2.5 * 86400000);
        await addDoc(collection(db, "redemptions"), {
          userId: i % 2 === 0 ? ADMIN_UID : DEMO_UID,
          email: i % 2 === 0 ? "venugopalrao1802@gmail.com" : "demo@cipherkavach.ai",
          code: i % 2 === 0 ? "CIPHER-100" : "CIPHER-STARTER",
          creditsGranted: i % 2 === 0 ? 100 : 50,
          enterpriseUnlocked: false,
          timestamp: Timestamp.fromDate(redemptionDate),
          status: "success"
        });
      }
      setSeedResult("✅ Redemptions populated. Seeding saved reports...");

      // 7. POPULATE SAVED REPORTS
      const reportTemplates = [
        { name: "production-build-scan", type: "JSON", count: 18, critical: 1, high: 4 },
        { name: "stage-auth-middleware", type: "PDF", count: 8, critical: 0, high: 2 },
        { name: "express-container-audit", type: "JSON", count: 24, critical: 3, high: 8 }
      ];

      const seedReportsForUser = async (userId: string) => {
        for (let i = 0; i < reportTemplates.length; i++) {
          const rDate = new Date(now.getTime() - (i + 1) * 3 * 86400000);
          const template = reportTemplates[i];
          await addDoc(collection(db, "savedReports"), {
            userId: userId,
            fileName: `${template.name}_remediation.${template.type.toLowerCase()}`,
            fileType: template.type,
            summary: `Vulnerability resolution roadmap for manifest: ${template.count} dependencies tracked. Remediated ${template.critical} Critical and ${template.high} High-severity risks.`,
            timestamp: rDate.toISOString()
          });
        }
      };

      await seedReportsForUser(ADMIN_UID);
      await seedReportsForUser(DEMO_UID);
      if (currentUser?.uid && currentUser.uid !== ADMIN_UID && currentUser.uid !== DEMO_UID) {
        await seedReportsForUser(currentUser.uid);
      }
      setSeedResult("✅ Reports populated. Seeding replay sandbox logs...");

      // 8. POPULATE REPLAY HISTORY
      const replayTemplates = [
        { target: "express-auth-payload", status: "BLOCKED", threat: "CVE-2020-8203 Buffer Exploit" },
        { target: "axios-stream-handler", status: "RESOLVED", threat: "CVE-2020-28168 SSRF Inject" },
        { target: "node-dependency-manager", status: "SIMULATED", threat: "CVE-2021-3918 Prototype Pollution" }
      ];

      const seedReplayForUser = async (userId: string) => {
        for (let i = 0; i < replayTemplates.length; i++) {
          const repDate = new Date(now.getTime() - (i + 1) * 2.5 * 86400000);
          const rep = replayTemplates[i];
          await addDoc(collection(db, "replayHistory"), {
            userId: userId,
            targetContainer: rep.target,
            simulatedThreat: rep.threat,
            status: rep.status,
            timestamp: repDate.toISOString(),
            durationSeconds: Math.floor(45 + Math.random() * 90)
          });
        }
      };

      await seedReplayForUser(ADMIN_UID);
      await seedReplayForUser(DEMO_UID);
      if (currentUser?.uid && currentUser.uid !== ADMIN_UID && currentUser.uid !== DEMO_UID) {
        await seedReplayForUser(currentUser.uid);
      }
      setSeedResult("✅ Replays populated. Seeding telemetry health metrics...");

      // 9. POPULATE TELEMETRY LOGS
      const telemetryTemplates = [
        { type: "CPU", val: "45%", details: "Dynamic security sandbox container usage normal" },
        { type: "MEM", val: "1.2 GB", details: "Remediation compile node memory synchronized" },
        { type: "SYS", val: "ONLINE", details: "CascadeFlow socket listening on active secure proxy" }
      ];

      const seedTelemetryForUser = async (userId: string) => {
        for (let i = 0; i < 12; i++) {
          const telDate = new Date(now.getTime() - i * 6 * 3600000);
          const tel = telemetryTemplates[i % telemetryTemplates.length];
          await addDoc(collection(db, "telemetryLogs"), {
            userId: userId,
            logType: tel.type,
            metricValue: tel.val,
            description: tel.details,
            timestamp: telDate.toISOString()
          });
        }
      };

      await seedTelemetryForUser(ADMIN_UID);
      await seedTelemetryForUser(DEMO_UID);
      if (currentUser?.uid && currentUser.uid !== ADMIN_UID && currentUser.uid !== DEMO_UID) {
        await seedTelemetryForUser(currentUser.uid);
      }
      setSeedResult("✅ Telemetry metrics seeded. Generating user notifications...");

      // 10. POPULATE NOTIFICATIONS
      const notificationsTemplates = [
        { title: "Low Credits Alert", message: "Operator runtime resources are approaching quota threshold. Extend limits.", severity: "warning" },
        { title: "Exploit Escalation Blocked", message: "CascadeFlow security gateway blocked a critical buffer escalation attack vector.", severity: "critical" },
        { title: "SOC Platform Configured", message: "CipherKavach security operations center setup completed successfully.", severity: "info" },
        { title: "AI Remediation Ready", message: "Optimized threat remediation manifest successfully compiled for express-app container.", severity: "info" },
        { title: "Threat Database Synced", message: "Global vulnerability tracking database synchronized successfully.", severity: "info" }
      ];

      const seedNotificationsForUser = async (userId: string) => {
        for (let i = 0; i < 8; i++) {
          const notifDate = new Date(now.getTime() - i * 2 * 86400000 - Math.random() * 3600000);
          const template = notificationsTemplates[i % notificationsTemplates.length];

          await addDoc(collection(db, "notifications"), {
            userId: userId, 
            title: template.title,
            message: template.message,
            severity: template.severity,
            timestamp: notifDate.toISOString(),
            read: i > 2
          });
        }
      };

      await seedNotificationsForUser(DEMO_UID);
      await seedNotificationsForUser(ADMIN_UID);
      if (currentUser?.uid && currentUser.uid !== ADMIN_UID && currentUser.uid !== DEMO_UID) {
        await seedNotificationsForUser(currentUser.uid);
      }

      setSeedResult("🎉 Database clean reset and operational seeding completed successfully!");
      setTimeout(() => {
        setSeedResult(null);
        loadAllAdminData();
      }, 3000);
    } catch (err: any) {
      setSeedResult(`❌ Seeding failed: ${err.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCleanDatabase = async () => {
    setIsSeeding(true);
    setSeedResult("Initializing client-side database cleanup...");
    try {
      const ADMIN_UID = "Mu2hYM65AxOOffisPtdGygMGtDf1";
      const DEMO_UID = "eU0Q67e1JNNPMnR6ptI67qpFL7W2";
      const preservedUids = [ADMIN_UID, DEMO_UID];

      // 1. Clean users collection
      setSeedResult("🧹 Sweeping users collection...");
      const usersSnap = await getDocs(collection(db, "users"));
      let usersDeleted = 0;
      for (const d of usersSnap.docs) {
        if (!preservedUids.includes(d.id)) {
          await deleteDoc(doc(db, "users", d.id));
          usersDeleted++;
        }
      }
      console.log(`Cleaned ${usersDeleted} unrelated users.`);

      // 2. Clean scans, redemptions, notifications, savedReports, replayHistory, telemetryLogs
      const userLinkedCollections = [
        "scans",
        "redemptions",
        "notifications",
        "savedReports",
        "replayHistory",
        "telemetryLogs"
      ];

      for (const colName of userLinkedCollections) {
        setSeedResult(`🧹 Purging unrelated documents in ${colName}...`);
        const snap = await getDocs(collection(db, colName));
        let colDeleted = 0;
        for (const d of snap.docs) {
          const data = d.data();
          const userId = data.userId;
          if (userId && !preservedUids.includes(userId)) {
            await deleteDoc(doc(db, colName, d.id));
            colDeleted++;
          }
        }
        console.log(`Cleaned ${colDeleted} documents from ${colName}.`);
      }

      // 3. Clean auditLogs
      setSeedResult("🧹 Cleaning audit log traces...");
      const auditSnap = await getDocs(collection(db, "auditLogs"));
      let auditDeleted = 0;
      const preservedActors = ["Venugopal Rao", "Demo Operator", "System Core"];
      for (const d of auditSnap.docs) {
        const data = d.data();
        const actor = data.actor;
        if (actor && !preservedActors.includes(actor)) {
          await deleteDoc(doc(db, "auditLogs", d.id));
          auditDeleted++;
        }
      }
      console.log(`Cleaned ${auditDeleted} unrelated audit logs.`);

      setSeedResult("🎉 Database cleanup successfully completed!");
      setTimeout(() => {
        setSeedResult(null);
        loadAllAdminData();
      }, 3000);
    } catch (err: any) {
      setSeedResult(`❌ Cleanup failed: ${err.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        console.log("[Secret Trigger] Ctrl+Shift+S caught. Initializing authenticated clean seeder...");
        handleSeedDatabase();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        console.log("[Secret Trigger] Ctrl+Shift+C caught. Initializing authenticated database cleanup...");
        handleCleanDatabase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const triggerAdminToast = (title: string, message: string, type: "success" | "info" | "error" = "success") => {
    setAdminToast({ title, message, type });
    setTimeout(() => {
      setAdminToast(null);
    }, 4000);
  };

  const handleDemoAction = async (action: "reset" | "grant", amount?: number) => {
    if (!currentUser) return;

    // Safety check: only allow ADMIN role users to proceed
    try {
      const adminRef = doc(db, "users", currentUser.uid);
      const adminSnap = await getDoc(adminRef);
      const rawRole = adminSnap.exists() ? (adminSnap.data().role || "") : "";
      if (rawRole.toUpperCase() !== "ADMIN" && currentUser.email !== ADMIN_EMAIL) {
        triggerAdminToast("Security Alert 🚨", "Unauthorized governance request blocked.", "error");
        return;
      }
    } catch (err) {
      console.warn("Security role validation warning, proceeding on credential bypass:", err);
    }

    setDemoActionLoading(action);
    const demoUserRef = doc(db, "users", "eU0Q67e1JNNPMnR6ptI67qpFL7W2");

    try {
      if (action === "reset") {
        await setDoc(demoUserRef, {
          credits: 220,
          demoScansUsed: 0
        }, { merge: true });

        await logAudit("RESET_DEMO_ACCOUNT", "demo@cipherkavach.ai", "Reset credits to 220 and demoScansUsed to 0");
        triggerAdminToast("Demo Account Reset", "Demo usage reset successfully.", "success");
      } else if (action === "grant" && amount) {
        const demoSnap = await getDoc(demoUserRef);
        const currentCredits = demoSnap.exists() ? (demoSnap.data().credits ?? 0) : 0;
        const newCredits = currentCredits + amount;

        await setDoc(demoUserRef, {
          credits: newCredits
        }, { merge: true });

        await logAudit("GRANT_DEMO_CREDITS", "demo@cipherkavach.ai", `Granted +${amount} credits. New balance: ${newCredits}`);
        triggerAdminToast("Demo Credits Granted", "Demo credits updated successfully.", "success");
      }
      
      loadAllAdminData();
    } catch (err: any) {
      console.error("Demo action failed: ", err);
      triggerAdminToast("Action Failed", err.message || "Failed to update demo account.", "error");
    } finally {
      setDemoActionLoading(null);
    }
  };

  const loadAllAdminData = useCallback(async () => {
    if (!currentUser) return;
    setGlobalLoading(true);
    setAnalyticsLoading(true);
    try {
      console.log('[Firestore Audit] Performing batch load of administrative data collections (users, runtimeCodes, redemptions, scans, auditLogs, creditRequests)');
      const [usersSnap, codesSnap, redempsSnap, scansSnap, auditSnap, requestsSnap] = await Promise.allSettled([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "runtimeCodes")),
        getDocs(collection(db, "redemptions")),
        getDocs(collection(db, "scans")),
        getDocs(collection(db, "auditLogs")),
        getDocs(collection(db, "creditRequests")),
      ]);

      console.log('[Firestore Audit] Batch load status results:', {
        users: usersSnap.status,
        runtimeCodes: codesSnap.status,
        redemptions: redempsSnap.status,
        scans: scansSnap.status,
        auditLogs: auditSnap.status,
        creditRequests: requestsSnap.status
      });

      if (usersSnap.status === "fulfilled") {
        setOperators(usersSnap.value.docs.map(d => {
          const data = d.data();
          const docEmail = data?.email || (d.id === currentUser?.uid ? currentUser?.email : "") || "";
          
          let resolvedName = data?.displayName || "";
          if (!resolvedName && docEmail) {
            if (docEmail.toLowerCase().includes("venugopalrao")) {
              resolvedName = "Venugopal Rao";
            } else {
              const prefix = docEmail.split("@")[0] || "";
              const cleanPrefix = prefix.replace(/[0-9]/g, "");
              if (cleanPrefix) {
                const parts = cleanPrefix.split(/[\._\-]/);
                resolvedName = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
              }
            }
          }
          if (!resolvedName) resolvedName = "Unknown Operator";

          return { uid: d.id, ...data, email: docEmail, displayName: resolvedName } as OperatorDoc;
        }));
      }
      if (codesSnap.status === "fulfilled") {
        setCodes(codesSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as CodeDoc)));
      }
      if (redempsSnap.status === "fulfilled") {
        const usersDocs = usersSnap.status === "fulfilled" ? usersSnap.value.docs : [];
        const emailMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        usersDocs.forEach(d => {
          const data = d.data();
          if (data?.email) emailMap[d.id] = data.email;
          
          let resolvedName = data?.displayName || "";
          if (!resolvedName && data?.email) {
            if (data.email.toLowerCase().includes("venugopalrao")) {
              resolvedName = "Venugopal Rao";
            } else {
              const prefix = data.email.split("@")[0] || "";
              const cleanPrefix = prefix.replace(/[0-9]/g, "");
              if (cleanPrefix) {
                const parts = cleanPrefix.split(/[\._\-]/);
                resolvedName = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
              }
            }
          }
          if (resolvedName) nameMap[d.id] = resolvedName;
        });

        const data = redempsSnap.value.docs.map(d => {
          const raw = d.data();
          const uid = raw.userId || raw.uid || "";
          const emailFallback = (uid && emailMap[uid]) ? emailMap[uid] : "";
          const resolvedEmail = raw.redeemedByEmail || raw.operatorEmail || emailFallback || (uid ? `uid: ${uid.substring(0, 8)}...` : "Unknown Operator");
          
          let displayNameVal = "";
          if (uid && nameMap[uid]) {
            displayNameVal = nameMap[uid];
          } else if (resolvedEmail && resolvedEmail.includes("@")) {
            if (resolvedEmail.toLowerCase().includes("venugopalrao")) {
              displayNameVal = "Venugopal Rao";
            } else {
              const prefix = resolvedEmail.split("@")[0] || "";
              const cleanPrefix = prefix.replace(/[0-9]/g, "");
              if (cleanPrefix) {
                const parts = cleanPrefix.split(/[\._\-]/);
                displayNameVal = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
              }
            }
          }
          if (!displayNameVal) displayNameVal = resolvedEmail;
          
          return {
            id: d.id,
            code: raw.code || "",
            ...raw,
            uid,
            userId: uid,
            creditsGranted: raw.creditsGranted ?? 0,
            enterpriseUnlocked: raw.enterpriseUnlocked ?? raw.enterpriseEnabled ?? false,
            replayAccess: raw.replayAccess ?? false,
            operatorEmail: resolvedEmail,
            redeemedByEmail: displayNameVal,
            status: raw.status || "REDEEMED",
            runtimeTier: raw.runtimeTier || (raw.enterpriseUnlocked || raw.enterpriseEnabled ? "ENTERPRISE" : "STANDARD")
          } as RedemptionDoc;
        });
        data.sort((a, b) => (b.redeemedAt?.toDate?.().getTime() ?? 0) - (a.redeemedAt?.toDate?.().getTime() ?? 0));
        setRedemptions(data);
      }
      if (scansSnap.status === "fulfilled") {
        setTotalScans(scansSnap.value.size);
      }
      if (auditSnap.status === "fulfilled") {
        const usersDocs = usersSnap.status === "fulfilled" ? usersSnap.value.docs : [];
        const nameMap: Record<string, string> = {};
        usersDocs.forEach(d => {
          const data = d.data();
          let resolvedName = data?.displayName || "";
          if (!resolvedName && data?.email) {
            if (data.email.toLowerCase().includes("venugopalrao")) {
              resolvedName = "Venugopal Rao";
            } else {
              const prefix = data.email.split("@")[0] || "";
              const cleanPrefix = prefix.replace(/[0-9]/g, "");
              if (cleanPrefix) {
                const parts = cleanPrefix.split(/[\._\-]/);
                resolvedName = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
              }
            }
          }
          if (resolvedName && data?.email) nameMap[data.email.toLowerCase()] = resolvedName;
        });

        const logs = auditSnap.value.docs.map(d => {
          const raw = d.data();
          const actorEmail = raw.actor || "";
          let actorDisplayName = actorEmail;
          if (actorEmail && nameMap[actorEmail.toLowerCase()]) {
            actorDisplayName = nameMap[actorEmail.toLowerCase()];
          } else if (actorEmail && actorEmail.includes("@")) {
            if (actorEmail.toLowerCase().includes("venugopalrao")) {
              actorDisplayName = "Venugopal Rao";
            } else {
              const prefix = actorEmail.split("@")[0] || "";
              const cleanPrefix = prefix.replace(/[0-9]/g, "");
              if (cleanPrefix) {
                const parts = cleanPrefix.split(/[\._\-]/);
                actorDisplayName = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
              }
            }
          }
          
          return {
            id: d.id,
            action: raw.action || "",
            target: raw.target || "",
            timestamp: raw.timestamp || null,
            ...raw,
            actor: actorDisplayName || actorEmail || "System Engine"
          };
        });
        logs.sort((a, b) => (b.timestamp?.toDate?.().getTime() ?? 0) - (a.timestamp?.toDate?.().getTime() ?? 0));
        setAuditEvents(logs);
      }
      if (requestsSnap.status === "fulfilled") {
        const reqs = requestsSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as any));
        reqs.sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0));
        setCreditRequests(reqs);
      }
    } catch (e) {
      console.error("Firestore aggregation failed: ", e);
    } finally {
      setGlobalLoading(false);
      setAnalyticsLoading(false);
    }
  }, [currentUser]);

  const loadAnalytics = loadAllAdminData;

  const handleRequestAction = async (requestId: string, userId: string, requestedCredits: number, email: string, actionType: "approve" | "reject" | "grant_approve") => {
    setReqActionLoading(requestId);
    try {
      const reqRef = doc(db, "creditRequests", requestId);
      
      if (actionType === "reject") {
        await updateDoc(reqRef, { status: "REJECTED" });
        await logAudit("QUOTA_REJECTED", email, `Rejected allocation of +${requestedCredits} Credits`);
      } else if (actionType === "approve") {
        await updateDoc(reqRef, { status: "APPROVED" });
        await logAudit("QUOTA_APPROVED", email, `Approved +${requestedCredits} Credits (Pending Grant)`);
      } else if (actionType === "grant_approve") {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const currentCredits = userSnap.exists() ? (userSnap.data().credits ?? 0) : 0;
        const newCredits = currentCredits + requestedCredits;
        
        await setDoc(userRef, { credits: newCredits }, { merge: true });
        await updateDoc(reqRef, { status: "FULFILLED" });
        await logAudit("QUOTA_GRANTED", email, `Granted +${requestedCredits} credits. New Balance: ${newCredits} cr.`);
      }
      
      loadAllAdminData();
    } catch (e) {
      console.error("Failed to execute request action:", e);
    } finally {
      setReqActionLoading(null);
    }
  };

  useEffect(() => {
    if (!isLoading && currentUser) {
      loadAllAdminData();
    }
  }, [isLoading, currentUser, loadAllAdminData]);

  // Audit Logs Helpers
  const getCategory = (e: any) => {
    if (e.category) return e.category;
    const act = e.action?.toUpperCase() || "";
    if (act.includes("AUTH") || act.includes("LOGIN") || act.includes("SIGN")) return "AUTH";
    if (act.includes("SCAN")) return "SCAN";
    if (act.includes("CODE") || act.includes("REDEMPT")) return "REDEMPTION";
    if (act.includes("ENTERPRISE")) return "ENTERPRISE";
    if (act.includes("CREDIT") || act.includes("ROLE") || act.includes("SUSPEND") || act.includes("UNSUSPEND") || act.includes("DEMO")) return "ADMIN";
    return "RUNTIME";
  };

  const getSeverity = (e: any) => {
    if (e.severity) return e.severity;
    const act = e.action?.toUpperCase() || "";
    if (act.includes("DELETE") || act.includes("SUSPEND") || act.includes("REVOKE")) return "CRITICAL";
    if (act.includes("DISABLE")) return "WARNING";
    return "INFO";
  };

  const filteredAudits = auditEvents.filter(a => {
    const q = auditSearch.toLowerCase();
    const matchQ = !q || 
      (a.action?.toLowerCase().includes(q)) || 
      (a.actor?.toLowerCase().includes(q)) || 
      (a.target?.toLowerCase().includes(q));

    const cat = getCategory(a);
    const matchCat = auditCategory === "all" || cat === auditCategory;

    const sev = getSeverity(a);
    const matchSev = auditSeverity === "all" || sev === auditSeverity;

    let matchDate = true;
    if (a.timestamp && auditDateFilter !== "all") {
      const ms = Date.now() - a.timestamp.toDate().getTime();
      if (auditDateFilter === "today") matchDate = ms < 86400000;
      else if (auditDateFilter === "7d") matchDate = ms < 86400000 * 7;
      else if (auditDateFilter === "30d") matchDate = ms < 86400000 * 30;
    }

    return matchQ && matchCat && matchSev && matchDate;
  });

  const exportAuditLogs = (format: "json" | "md") => {
    let content = "";
    let filename = `audit_logs_${Date.now()}`;
    if (format === "json") {
      content = JSON.stringify(filteredAudits, null, 2);
      filename += ".json";
    } else {
      content = "# CipherKavach Admin Runtime Audit Logs\n\n" +
        "| Timestamp | Action | Category | Severity | Actor | Target | Detail |\n" +
        "| --- | --- | --- | --- | --- | --- | --- |\n" +
        filteredAudits.map(a => {
          const timeStr = a.timestamp ? a.timestamp.toDate().toLocaleString() : "—";
          const cat = getCategory(a);
          const sev = getSeverity(a);
          return `| ${timeStr} | ${a.action} | ${cat} | ${sev} | ${a.actor || "System"} | ${a.target || "—"} | ${a.detail || "—"} |`;
        }).join("\n");
      filename += ".md";
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  /* AUTH-GATED ADMIN ACCESS — SECURE ROLE-BASED ACCESS CONTROL WITH AUTO-REPAIR & EMERGENCY FALLBACK */
  useEffect(() => {
    if (!mounted) return;

    const checkAdminAccess = async (user: FirebaseUser) => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        let hasAdminRole = false;
        let needsAutoHeal = false;

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const rawRole = userData.role || "";
          // Support multiple role casing styles (ADMIN, admin, Admin)
          hasAdminRole = rawRole.toUpperCase() === "ADMIN";
          
          if (!hasAdminRole && user.email === ADMIN_EMAIL) {
            needsAutoHeal = true;
          }
        } else {
          // If document doesn't exist but is the emergency admin email
          if (user.email === ADMIN_EMAIL) {
            hasAdminRole = true;
            needsAutoHeal = true;
          }
        }

        // Emergency email override validation
        if (user.email === ADMIN_EMAIL) {
          hasAdminRole = true;
        }

        // Auto-heal missing or mismatched role in Firestore
        if (needsAutoHeal && user.email === ADMIN_EMAIL) {
          try {
            await setDoc(userRef, {
              role: "ADMIN",
              email: user.email,
              displayName: user.displayName || "Admin Operator",
              avatarUrl: user.photoURL || `https://ui-avatars.com/api/?name=Admin+Operator&background=0f1219&color=60a5fa&size=128`,
              credits: 9999,
              enterpriseEnabled: true,
              lastHealedAt: serverTimestamp()
            }, { merge: true });
            console.log("Auto-healed user document role in Firestore for admin.");
          } catch (repairErr) {
            console.error("Auto-heal failed but proceeding as authenticated admin:", repairErr);
          }
        }

        if (hasAdminRole) {
          setCurrentUser(user);
          setIsLoading(false);
        } else {
          setUnauthorized(true);
          setTimeout(() => {
            router.push("/dashboard");
          }, 3000);
        }
      } catch (err) {
        // If Firestore query fails, but user is emergency email, do NOT lock them out!
        if (user.email === ADMIN_EMAIL) {
          console.warn("Firestore query failed, but emergency email allowed bypass:", err);
          setCurrentUser(user);
          setIsLoading(false);
        } else {
          console.error("Secure admin guard validation failed:", err);
          setUnauthorized(true);
          setTimeout(() => {
            router.push("/");
          }, 3000);
        }
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUnauthorized(true);
        setTimeout(() => {
          router.push("/");
        }, 2000);
        return;
      }
      checkAdminAccess(user);
    });
    return () => unsub();
  }, [router, mounted]);

  // Initial client mount loader to prevent layout / auth flashing
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
          <p className="text-gray-500 font-mono text-xs tracking-widest uppercase">Initializing command bridge...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center border border-red-500/20">
        <div className="text-center space-y-4 max-w-md p-6 glass-card border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse mx-auto" />
          <h2 className="text-lg font-black text-red-400 uppercase tracking-widest font-mono">Unauthorized Access</h2>
          <p className="text-gray-400 font-mono text-xs leading-relaxed">
            SYSTEM governance protocols active. Unauthorized runtime access to admin segment is blocked.
          </p>
          <p className="text-gray-600 font-mono text-xs tracking-widest uppercase">
            Redirecting to secure segment...
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
          <p className="text-gray-500 font-mono text-xs tracking-widest uppercase">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none z-0" />
      <div className="fixed top-0 left-0 w-1/3 h-1/2 bg-yellow-900/10 blur-[150px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-1/3 h-1/2 bg-purple-900/10 blur-[150px] pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-20 sticky top-0 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        
        {/* ROW 1: Period Selector, Title & Core Actions */}
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 bg-black/20">
          
          {/* Left: Console Title & Navigation Link */}
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors border border-white/10 bg-white/5 px-3 py-1.5 rounded-lg font-bold shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <div className="w-px h-4 bg-white/10 hidden sm:block shrink-0" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-yellow-300 font-mono">Admin Runtime Console</span>
              <span className="text-[9px] font-black bg-yellow-500 text-black px-2 py-0.5 rounded-full shrink-0">FULL AUTHORITY</span>
            </div>
          </div>

          {/* Center: Period Selector (Row 1) */}
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2 self-start lg:self-auto shrink-0">
            <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-extrabold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-yellow-400" /> Platform Filter:
            </label>
            <select
              value={adminPeriod}
              onChange={(e) => setAdminPeriod(e.target.value)}
              className="bg-black border border-white/10 rounded-lg px-3 py-1 text-xs font-mono text-yellow-300 focus:border-yellow-500/50 outline-none cursor-pointer hover:bg-white/5 transition-all font-bold"
            >
              <option value="24h">LAST 24 HOURS</option>
              <option value="7d">LAST 7 DAYS</option>
              <option value="30d">LAST 30 DAYS</option>
              <option value="all">ALL TIME</option>
            </select>
          </div>

          {/* Right: Admin Controls (Row 1) */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs text-gray-300 font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hidden sm:inline-block">
              {currentUser?.email}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  setHealthEvents(prev => [
                    { id: String(Date.now()), time: ts, msg: "Manual system diagnostic refresh initiated.", type: "info" },
                    ...prev
                  ]);
                  loadAllAdminData();
                }}
                className="flex items-center gap-1.5 text-xs text-cyan-400 border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition-colors font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={() => signOut(auth).then(() => router.push("/"))} className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors font-bold">
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

        </div>

        {/* Dynamic Seeder Progress Banner */}
        {seedResult && (
          <div className="bg-yellow-950/40 border-y border-yellow-500/30 px-6 py-2.5 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-2.5 font-mono text-xs text-yellow-300">
              <Database className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>[SYSTEM SEEDER STATUS] {seedResult}</span>
            </div>
            <button onClick={() => setSeedResult(null)} className="text-yellow-500/50 hover:text-yellow-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ROW 2: Standalone Horizontal Navigation Tabs with Scrollability */}
        <div className="max-w-[1600px] mx-auto px-6 overflow-x-auto flex items-center gap-1.5 scrollbar-hide py-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-px rounded-t-xl shrink-0 ${
                activeTab === tab.id
                  ? "text-yellow-300 border-yellow-400 bg-yellow-500/10 shadow-[0_0_12px_rgba(234,179,8,0.05)]"
                  : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <span className={`${activeTab === tab.id ? "text-yellow-300 scale-110" : "text-gray-500"} transition-all`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-6 pt-10 pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Operators" value={globalLoading ? "..." : String(operators.length)} icon={<Users className="w-4 h-4 text-blue-400" />} color="bg-blue-500" />
                  <StatCard label="Enterprise Users" value={globalLoading ? "..." : String(operators.filter(u => u.enterpriseEnabled).length)} icon={<Shield className="w-4 h-4 text-purple-400" />} color="bg-purple-500" />
                  <StatCard label="Total Scans" value={globalLoading ? "..." : String(totalScans)} icon={<Activity className="w-4 h-4 text-green-400" />} color="bg-green-500" />
                  <StatCard label="Credits Issued" value={globalLoading ? "..." : String(redemptions.reduce((s, r) => s + (r.creditsGranted ?? 0), 0))} icon={<Key className="w-4 h-4 text-yellow-400" />} color="bg-yellow-500" />
                  <StatCard label="Active Codes" value={globalLoading ? "..." : String(codes.filter(c => c.active && (!c.expiresAt || new Date(c.expiresAt) >= new Date())).length)} icon={<Key className="w-4 h-4 text-cyan-400" />} color="bg-cyan-500" />
                  <StatCard label="Redemptions" value={globalLoading ? "..." : String(redemptions.length)} icon={<GitMerge className="w-4 h-4 text-orange-400" />} color="bg-orange-500" />
                  <StatCard label="Audit Events" value={globalLoading ? "..." : String(auditEvents.length)} icon={<FileText className="w-4 h-4 text-pink-400" />} color="bg-pink-500" />
                  <StatCard label="Total Codes" value={globalLoading ? "..." : String(codes.length)} icon={<Database className="w-4 h-4 text-indigo-400" />} color="bg-indigo-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Recharts Intelligence Volume Bar Chart */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 space-y-4 bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white font-mono">Platform Entity Metrics Comparison</span>
                      </div>
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-black font-mono">ACTIVE INTELLIGENCE</span>
                    </div>

                    <div className="h-[190px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: "Scans", value: totalScans || 0, fill: "#22c55e" },
                            { name: "Audit Logs", value: auditEvents.length || 0, fill: "#ec4899" },
                            { name: "Redemptions", value: redemptions.length || 0, fill: "#f97316" },
                            { name: "Runtime Codes", value: codes.length || 0, fill: "#06b6d4" },
                            { name: "Operators", value: operators.length || 0, fill: "#3b82f6" },
                          ]}
                          margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={44} isAnimationActive={true} animationDuration={700} animationEasing="ease-out">
                            {
                              [
                                { fill: "rgba(34,197,94,0.8)" },
                                { fill: "rgba(236,72,153,0.8)" },
                                { fill: "rgba(249,115,22,0.8)" },
                                { fill: "rgba(6,182,212,0.8)" },
                                { fill: "rgba(59,130,246,0.8)" }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} className="transition-all duration-300 hover:opacity-100 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* System Telemetry Rate Info */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white font-mono">Platform Health Index</span>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                        <span className="text-gray-400">Telemetry Engine</span>
                        <span className="text-green-400 font-bold">100% ONLINE</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                        <span className="text-gray-400">Database Streams</span>
                        <span className="text-green-400 font-bold">STABLE</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                        <span className="text-gray-400">Active Sync Interval</span>
                        <span className="text-yellow-400">5.0s</span>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-gray-400">Security Verdict</span>
                        <span className="text-cyan-400 font-bold">IMMUNE</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-gray-500 leading-relaxed italic">
                      "All active runtime code tokens undergo validation via CascadeFlow route middleware automatically prior to authentication handshake sequence initiation."
                    </div>
                  </div>

                  {/* Demo account controls */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white font-mono">Demo Operator Controls</span>
                    </div>

                    <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                      <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider font-mono">Target Agent: demo@cipherkavach.ai</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
                        Quick sandbox tuning for live hackathon presentations and evaluator reviews.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Action 1: Reset */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">Reset Quota & Balance</span>
                        <button
                          disabled={demoActionLoading !== null}
                          onClick={() => handleDemoAction("reset")}
                          className="w-full py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                        >
                          {demoActionLoading === "reset" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Reset Demo Usage
                        </button>
                      </div>

                      {/* Action 2: Grant */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">Grant Credits</span>
                        <div className="grid grid-cols-3 gap-2">
                          {[50, 100, 500].map(amt => (
                            <button
                              key={amt}
                              disabled={demoActionLoading !== null}
                              onClick={() => handleDemoAction("grant", amt)}
                              className="py-1.5 border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-400 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1 font-mono"
                            >
                              +{amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* OPERATORS */}
            {activeTab === "operators" && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search email or UID..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-yellow-500/40 transition-all font-mono" />
                  </div>
                  <div className="flex gap-1.5">
                    {["all","enterprise","demo","suspended"].map(f => (
                      <button key={f} onClick={() => setFilterRole(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${ filterRole === f ? "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.2)]" : "bg-white/5 text-gray-400 hover:text-gray-200" }`}>{f}</button>
                    ))}
                  </div>
                  <button onClick={loadOperators} disabled={opsLoading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${opsLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                  <span className="text-xs text-gray-400 font-mono font-semibold">{filteredOps.length} operators</span>
                </div>

                {/* Table */}
                <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                  {opsLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /></div>
                  ) : filteredOps.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-mono text-sm">No operators found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {["Operator","Credits","Role / Status","Redeemed","Actions"].map(h => (
                              <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-300 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOps.map(u => (
                            <tr key={u.uid} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${ u.suspended ? "opacity-40" : "" }`}>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5 group">
                                  {/* Avatar Initials Fallback */}
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-white/10 flex items-center justify-center text-xs font-black text-blue-400 shrink-0 group-hover:border-blue-500/30 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all font-mono">
                                    {(u.displayName || u.email || "Unknown").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white font-black tracking-wide text-xs truncate max-w-[220px] group-hover:text-blue-300 transition-colors">
                                      {u.displayName || "Unknown Operator"}
                                    </p>
                                    {u.displayName && u.email && (
                                      <p className="text-xs text-gray-400 font-mono truncate max-w-[220px] mt-0.5">
                                        {u.email}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-mono font-black text-yellow-400 text-sm">{u.credits ?? 0}</td>
                              <td className="px-4 py-3.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {u.enterpriseEnabled && <span className="text-[10px] font-black bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">ENTERPRISE</span>}
                                  {u.suspended && <span className="text-[10px] font-black bg-red-600/30 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                                  {u.role === "demo" && <span className="text-[10px] font-black bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">DEMO</span>}
                                  {u.email === "venugopalrao1802@gmail.com" && <span className="text-[10px] font-black bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">ADMIN</span>}
                                  {!u.enterpriseEnabled && !u.suspended && u.role !== "demo" && u.email !== "venugopalrao1802@gmail.com" && <span className="text-[10px] font-black bg-white/5 text-gray-400 border border-white/5 px-2 py-0.5 rounded-full">FREE</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-gray-300 font-mono text-xs font-semibold">{u.redeemedCodes?.length ?? 0}</td>
                              <td className="px-4 py-3.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveMenu(activeMenu?.type === "operator" && activeMenu?.id === u.uid ? null : {
                                      type: "operator",
                                      id: u.uid,
                                      x: rect.right - 250 + window.scrollX,
                                      y: rect.bottom + window.scrollY + 4,
                                      data: u
                                    });
                                  }}
                                  className="flex items-center gap-1.5 text-gray-300 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-semibold"
                                >
                                  Actions <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Grant Credits Modal */}
                <AnimatePresence>
                  {grantModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGrantModal(null)}>
                      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Grant Credits</h3>
                          <button onClick={() => setGrantModal(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-xs text-gray-400 mb-4 font-mono truncate">{grantModal.email}</p>
                        <div className="flex gap-2 mb-4 flex-wrap">
                          {[50, 100, 150, 200, 500].map(c => (
                            <button key={c} onClick={() => setGrantAmt(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${ grantAmt === c ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10" }`}>{c}</button>
                          ))}
                          <input type="number" value={grantAmt} onChange={e => setGrantAmt(Number(e.target.value))} className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white outline-none focus:border-yellow-500/40" />
                        </div>
                        <button onClick={execGrant} disabled={!!actionLoading} className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2">
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Grant {grantAmt} Credits
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confirm Action Modal */}
                <AnimatePresence>
                  {confirmModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
                      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-white mb-2">Confirm Action</h3>
                        <p className="text-xs text-gray-400 mb-1">{confirmModal.label}</p>
                        <p className="text-xs text-gray-600 font-mono mb-5 truncate">{confirmModal.email}</p>
                        <div className="flex gap-3">
                          <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 border border-white/10 text-gray-400 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
                          <button onClick={execConfirm} disabled={!!actionLoading} className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-300 font-bold rounded-xl text-sm hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ACCESS CODES */}
            {activeTab === "codes" && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={codeSearch} onChange={e => setCodeSearch(e.target.value)} placeholder="Search code..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-500/40 transition-all font-mono" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {["all","active","expired","disabled","enterprise","replay"].map(f => (
                      <button key={f} onClick={() => setCodeFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${ codeFilter === f ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.2)]" : "bg-white/5 text-gray-400 hover:text-gray-200" }`}>{f}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={loadCodes} disabled={codesLoading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
                      <RefreshCw className={`w-3.5 h-3.5 ${codesLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                    <button onClick={() => setShowGenModal(true)} className="flex items-center gap-1.5 text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded-lg transition-colors shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                      <Key className="w-3.5 h-3.5" /> Generate Code
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                  {codesLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
                  ) : filteredCodes.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-mono text-sm">No codes found. Generate one above.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {["Code","Credits","Flags","Usage","Expiry","Status","Actions"].map(h => (
                              <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-300 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCodes.map(c => {
                            const exp = isExpired(c);
                            const statusColor = !c.active ? "text-red-400" : exp ? "text-orange-400" : "text-green-400";
                            const statusLabel = !c.active ? "DISABLED" : exp ? "EXPIRED" : "ACTIVE";
                            const statusDot = !c.active ? "bg-red-400" : exp ? "bg-orange-400" : "bg-green-400";
                            return (
                              <tr key={c.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${!c.active || exp ? "opacity-50" : ""}`}>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-cyan-400 tracking-widest text-sm">{c.id}</span>
                                    <button onClick={() => copyCode(c.id)} className="text-gray-500 hover:text-cyan-400 transition-colors">
                                      {copiedCode === c.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <span className="text-xs">⧉</span>}
                                    </button>
                                  </div>
                                  {c.createdBy && <p className="text-gray-400 text-xs font-mono mt-1">{c.createdBy}</p>}
                                </td>
                                <td className="px-4 py-3.5 font-mono font-black text-yellow-400 text-sm">{c.credits}</td>
                                <td className="px-4 py-3.5">
                                  <div className="flex gap-1.5">
                                    {c.enterprise && <span className="text-[10px] font-black bg-purple-600/30 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">ENT</span>}
                                    {c.replayAccess && <span className="text-[10px] font-black bg-orange-600/30 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full">REPLAY</span>}
                                    {!c.enterprise && !c.replayAccess && <span className="text-xs text-gray-400">—</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 font-mono text-gray-300 text-xs font-semibold">{c.redeemedCount ?? 0} / {c.usageLimit ?? "∞"}</td>
                                <td className="px-4 py-3.5 font-mono text-gray-400 text-xs">{c.expiresAt || "No expiry"}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`flex items-center gap-1.5 text-xs font-black ${statusColor}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse`} />{statusLabel}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActiveMenu(activeMenu?.type === "code" && activeMenu?.id === c.id ? null : {
                                        type: "code",
                                        id: c.id,
                                        x: rect.right - 180 + window.scrollX,
                                        y: rect.bottom + window.scrollY + 4,
                                        data: c
                                      });
                                    }}
                                    className="flex items-center gap-1.5 text-gray-300 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-semibold"
                                  >
                                    Actions <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Generate Modal */}
                <AnimatePresence>
                  {showGenModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGenModal(false)}>
                      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#0f1219] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="font-bold text-white flex items-center gap-2"><Key className="w-4 h-4 text-cyan-400" /> Generate Runtime Code</h3>
                          <button onClick={() => setShowGenModal(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Code Name (blank = auto)</label>
                            <input value={genName} onChange={e => setGenName(e.target.value.toUpperCase())} placeholder="e.g. JUDGE-2026" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/40 tracking-widest" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Credits</label>
                            <div className="flex gap-2 flex-wrap">
                              {[50,100,150,200,500].map(c => (
                                <button key={c} onClick={() => setGenCredits(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${ genCredits === c ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10" }`}>{c}</button>
                              ))}
                              <input type="number" value={genCredits} onChange={e => setGenCredits(Number(e.target.value))} className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white outline-none" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Usage Limit</label>
                              <input type="number" value={genLimit} onChange={e => setGenLimit(Number(e.target.value))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 block">Expiry Date</label>
                              <input type="date" value={genExpiry} onChange={e => setGenExpiry(e.target.value)} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 outline-none" />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setGenEnterprise(p => !p)} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${ genEnterprise ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "border-white/5 text-gray-500 hover:text-gray-300" }`}>
                              Enterprise Unlock <span className={`w-2 h-2 rounded-full ${ genEnterprise ? "bg-purple-400" : "bg-gray-600" }`} />
                            </button>
                            <button onClick={() => setGenReplay(p => !p)} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${ genReplay ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "border-white/5 text-gray-500 hover:text-gray-300" }`}>
                              Replay Access <span className={`w-2 h-2 rounded-full ${ genReplay ? "bg-orange-400" : "bg-gray-600" }`} />
                            </button>
                          </div>
                          <button onClick={generateCode} disabled={isGenerating} className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            {isGenerating ? "Generating..." : "Generate & Save to Firestore"}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* REDEMPTIONS */}
            {activeTab === "redemptions" && (
              <div className="space-y-5">
                {/* Analytics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                  {[{ label: "Total Redemptions", val: String(redemptions.length), color: "text-cyan-400" },
                    { label: "Credits Granted", val: String(totalCreditsGranted), color: "text-yellow-400" },
                    { label: "Enterprise Activations", val: String(enterpriseActivations), color: "text-purple-400" },
                    { label: "Most Used Code", val: mostUsedCode, color: "text-green-400" },
                  ].map(s => (
                    <div key={s.label} className="glass-card p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">{s.label}</p>
                      <p className={`text-2xl font-black ${s.color} truncate`}>{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Recent Activity Timeline */}
                {redemptions.length > 0 && (
                  <div className="glass-card p-5 rounded-2xl border border-white/5">
                    <p className="text-xs text-gray-300 uppercase font-bold tracking-wider mb-3 flex items-center gap-2 font-mono"><Terminal className="w-3.5 h-3.5 text-cyan-400" /> Recent Runtime Activity</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-3">
                      {redemptions.slice(0, 10).map((r, i) => {
                        const ts = r.redeemedAt ? r.redeemedAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "—";
                        return (
                          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-gray-400 shrink-0 w-16">[{ts}]</span>
                            <span className="text-cyan-400 font-black shrink-0">{r.code}</span>
                            <span className="text-gray-300">redeemed</span>
                            {r.creditsGranted && <span className="text-yellow-400 ml-1 font-bold">+{r.creditsGranted} cr</span>}
                            {r.enterpriseUnlocked && <span className="text-[10px] bg-purple-600/30 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-black">ENT</span>}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={redempSearch} onChange={e => setRedempSearch(e.target.value)} placeholder="Search code or email..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-orange-500/40 transition-all font-mono" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {["all","enterprise","replay","high","recent"].map(f => (
                      <button key={f} onClick={() => setRedempFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${ redempFilter === f ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.2)]" : "bg-white/5 text-gray-400 hover:text-gray-200" }`}>{f === "high" ? "High Credit" : f}</button>
                    ))}
                  </div>
                  <button onClick={loadRedemptions} disabled={redempsLoading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${redempsLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                  <span className="text-xs text-gray-400 font-mono font-semibold">{filteredRedemptions.length} records</span>
                </div>

                {/* Table */}
                <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                  {redempsLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div>
                  ) : filteredRedemptions.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-mono text-sm">No redemptions recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {["Code","Operator","Credits","Flags","Timestamp","Status"].map(h => (
                              <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-300 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRedemptions.map(r => (
                            <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3.5 font-mono font-black text-cyan-400 tracking-widest text-sm">{r.code}</td>
                              <td className="px-4 py-3.5">
                                <p className="text-white font-black text-xs truncate max-w-[200px]">{r.redeemedByEmail || r.operatorEmail || "Unknown Operator"}</p>
                              </td>
                              <td className="px-4 py-3.5 font-mono font-black text-yellow-400 text-sm">+{r.creditsGranted ?? 0}</td>
                              <td className="px-4 py-3.5">
                                <div className="flex gap-1.5">
                                  {r.enterpriseUnlocked && <span className="text-[10px] font-black bg-purple-600/30 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.2)]">ENT</span>}
                                  {r.replayAccess && <span className="text-[10px] font-black bg-orange-600/30 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.2)]">REPLAY</span>}
                                  {!r.enterpriseUnlocked && !r.replayAccess && <span className="text-xs text-gray-400 font-mono">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-gray-300 font-mono text-xs whitespace-nowrap">
                                {r.redeemedAt ? r.redeemedAt.toDate().toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="flex items-center gap-1.5 text-xs font-black text-green-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />REDEEMED
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ANALYTICS */}
            {activeTab === "analytics" && (
              <div className="space-y-5">
                {/* Period Filter */}
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-xs text-gray-300 uppercase tracking-wider">Period:</span>
                  <div className="flex gap-1.5">
                    {[{v:"1d",l:"Today"},{v:"7d",l:"7 Days"},{v:"30d",l:"30 Days"},{v:"all",l:"All Time"}].map(p => (
                      <button key={p.v} onClick={() => setAnalyticsPeriod(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${ analyticsPeriod === p.v ? "bg-blue-500 text-black shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-white/5 text-gray-400 hover:text-gray-200" }`}>{p.l}</button>
                    ))}
                  </div>
                  <button onClick={loadAnalytics} disabled={analyticsLoading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 bg-white/5 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Operators",    val: operators.length,           color: "text-blue-400",   glow: "rgba(96,165,250,0.15)" },
                    { label: "Enterprise Operators", val: operators.filter(u=>u.enterpriseEnabled).length, color: "text-purple-400", glow: "rgba(168,85,247,0.15)" },
                    { label: "Total Scans",        val: totalScans,             color: "text-green-400",  glow: "rgba(74,222,128,0.15)" },
                    { label: "Credits Consumed",   val: totalCreditsGranted,    color: "text-yellow-400", glow: "rgba(250,204,21,0.15)" },
                    { label: "Replay Executions",  val: replayUnlocks,          color: "text-orange-400", glow: "rgba(251,146,60,0.15)" },
                    { label: "Active Codes",       val: codes.filter(c=>c.active).length, color: "text-cyan-400", glow: "rgba(34,211,238,0.15)" },
                    { label: "Redemptions",        val: redemptions.length,     color: "text-pink-400",   glow: "rgba(244,114,182,0.15)" },
                    { label: "Audit Events",       val: auditEvents.length,     color: "text-indigo-400", glow: "rgba(129,140,248,0.15)" },
                  ].map(s => (
                    <div key={s.label} className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden font-mono">
                      <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle at top right, ${s.glow}, transparent 70%)` }} />
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3 relative z-10">{s.label}</p>
                      <p className={`text-3xl font-black ${s.color} relative z-10`}>{analyticsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Two-column: Model Usage + Runtime Efficiency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* AI Model Usage */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-5"><BarChart2 className="w-4 h-4 text-blue-400" /><span className="text-xs font-bold uppercase tracking-widest">AI Model Runtime Usage</span></div>
                    <div className="space-y-4">
                      {[{ model: "Groq Fast",          pct: 68, color: "from-orange-500 to-yellow-500",  glow: "rgba(251,146,60,0.4)" },
                        { model: "Claude Deep",         pct: 22, color: "from-purple-500 to-pink-500",   glow: "rgba(168,85,247,0.4)" },
                        { model: "Gemini Review",        pct: 8,  color: "from-blue-500 to-cyan-500",    glow: "rgba(59,130,246,0.4)" },
                        { model: "Multi-Model Consensus",pct: 2,  color: "from-green-500 to-teal-500",   glow: "rgba(74,222,128,0.4)" },
                      ].map(m => (
                        <div key={m.model}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-gray-300">{m.model}</span>
                            <span className="text-xs font-mono font-bold text-white">{m.pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`h-full bg-gradient-to-r ${m.color} rounded-full`} style={{ boxShadow: `0 0 8px ${m.glow}` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Runtime Efficiency */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-5"><Activity className="w-4 h-4 text-green-400" /><span className="text-xs font-bold uppercase tracking-widest">Runtime Efficiency</span></div>
                    <div className="space-y-3">
                      {[{ label: "Avg Orchestration Latency", val: "1.4s",     color: "text-green-400" },
                        { label: "Tokens Processed (est.)",   val: `${(redemptions.length*18).toLocaleString()}k`, color: "text-blue-300" },
                        { label: "Replay Execution Load",     val: `${replayUnlocks} sessions`, color: "text-orange-400" },
                        { label: "AI Request Volume",         val: `${totalScans + redemptions.length} req`,      color: "text-cyan-400" },
                        { label: "Telemetry Throughput",      val: `${(auditEvents.length * 3)} events`,          color: "text-purple-400" },
                        { label: "Enterprise Runtime Share",  val: `${operators.length ? Math.round((operators.filter(u=>u.enterpriseEnabled).length/operators.length)*100) : 0}%`, color: "text-yellow-400" },
                      ].map(m => (
                        <div key={m.label} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
                          <span className="text-xs text-gray-400">{m.label}</span>
                          <span className={`text-xs font-mono font-bold ${m.color}`}>{m.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Runtime Events Feed */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-cyan-400" /><span className="text-xs font-bold uppercase tracking-widest">Live Runtime Events</span></div>
                    <span className="text-[10px] font-mono text-gray-600">{auditEvents.length} total events</span>
                  </div>
                  {analyticsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
                  ) : auditEvents.length === 0 ? (
                    <p className="text-gray-600 font-mono text-xs">No events yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-3">
                      {auditEvents.slice(0, 20).map((e, i) => {
                        const ts = e.timestamp ? e.timestamp.toDate().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}) : "—";
                        const col = e.action?.includes("GRANT") ? "text-green-400" : e.action?.includes("DELETE") || e.action?.includes("SUSPEND") ? "text-red-400" : e.action?.includes("DISABLE") ? "text-orange-400" : "text-cyan-400";
                        return (
                          <motion.div key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 font-mono text-[11px] py-1 border-b border-white/[0.03] last:border-0">
                            <span className="text-gray-600 shrink-0">[{ts}]</span>
                            <span className={`font-black shrink-0 ${col}`}>{e.action}</span>
                            {e.target && <span className="text-gray-400 truncate">{e.target}</span>}
                            {e.actor && <span className="text-gray-600 ml-auto mr-2 shrink-0 hidden md:block truncate max-w-[160px]">{e.actor}</span>}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AUDIT LOG */}
            {activeTab === "audit" && (
              <div className="space-y-5">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                  {[
                    { label: "Total Events", val: filteredAudits.length, color: "text-cyan-400" },
                    { label: "Critical Severity", val: auditEvents.filter(a => getSeverity(a) === "CRITICAL").length, color: "text-red-400" },
                    { label: "Admin Operations", val: auditEvents.filter(a => getCategory(a) === "ADMIN").length, color: "text-yellow-400" },
                    { label: "Security & Redemption", val: auditEvents.filter(a => getCategory(a) === "REDEMPTION" || getCategory(a) === "SECURITY").length, color: "text-purple-400" },
                  ].map(s => (
                    <div key={s.label} className="glass-card p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">{s.label}</p>
                      <p className={`text-2xl font-black ${s.color}`}>{analyticsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search actor, target, or action..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-500/40 transition-all font-mono" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-300 uppercase outline-none focus:border-cyan-500/40 transition-colors">
                      <option value="all" className="bg-[#0f1219]">All Categories</option>
                      {["AUTH", "SCAN", "REDEMPTION", "ADMIN", "RUNTIME", "ENTERPRISE", "SECURITY"].map(c => (
                        <option key={c} value={c} className="bg-[#0f1219]">{c}</option>
                      ))}
                    </select>

                    <select value={auditSeverity} onChange={e => setAuditSeverity(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-300 uppercase outline-none focus:border-cyan-500/40 transition-colors">
                      <option value="all" className="bg-[#0f1219]">All Severities</option>
                      {["INFO", "WARNING", "CRITICAL"].map(s => (
                        <option key={s} value={s} className="bg-[#0f1219]">{s}</option>
                      ))}
                    </select>

                    <select value={auditDateFilter} onChange={e => setAuditDateFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-300 uppercase outline-none focus:border-cyan-500/40 transition-colors">
                      <option value="all" className="bg-[#0f1219]">All Time</option>
                      <option value="today" className="bg-[#0f1219]">Today</option>
                      <option value="7d" className="bg-[#0f1219]">Last 7 Days</option>
                      <option value="30d" className="bg-[#0f1219]">Last 30 Days</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={loadAnalytics} disabled={analyticsLoading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
                      <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                    
                    <div className="relative">
                      <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-1.5 text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded-lg transition-colors shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                        <Download className="w-3.5 h-3.5" /> Export Logs <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 top-9 z-50 bg-[#0f1219] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[150px]">
                          <button onClick={() => exportAuditLogs("json")} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">Export as JSON</button>
                          <button onClick={() => exportAuditLogs("md")} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">Export as Markdown</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Logs Table */}
                <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
                  ) : filteredAudits.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-mono text-sm">No audit logs found matching current criteria.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {["Timestamp", "Category", "Severity", "Action", "Actor", "Target", "Details"].map(h => (
                              <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-300 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAudits.map(a => {
                            const cat = getCategory(a);
                            const sev = getSeverity(a);
                            
                            const catColors: Record<string, string> = {
                              AUTH: "bg-blue-600/30 text-blue-300 border border-blue-500/30",
                              SCAN: "bg-green-600/30 text-green-300 border border-green-500/30",
                              REDEMPTION: "bg-cyan-600/30 text-cyan-300 border border-cyan-500/30",
                              ADMIN: "bg-yellow-600/30 text-yellow-300 border border-yellow-500/30",
                              RUNTIME: "bg-gray-600/30 text-gray-300 border border-gray-500/30",
                              ENTERPRISE: "bg-purple-600/30 text-purple-300 border border-purple-500/30",
                              SECURITY: "bg-red-600/30 text-red-300 border border-red-500/30"
                            };
                            
                            const sevColors: Record<string, string> = {
                              INFO: "text-cyan-400 border border-cyan-500/30 bg-cyan-950/20",
                              WARNING: "text-orange-400 border border-orange-500/30 bg-orange-950/20",
                              CRITICAL: "text-red-400 border border-red-500/30 bg-red-950/20"
                            };

                            return (
                              <tr key={a.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors font-mono">
                                <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                                  {a.timestamp ? a.timestamp.toDate().toLocaleString() : "—"}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${catColors[cat] || catColors.RUNTIME}`}>
                                    {cat}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sevColors[sev] || sevColors.INFO}`}>
                                    {sev}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-white font-black text-xs">{a.action}</td>
                                <td className="px-4 py-3.5 text-gray-200 font-semibold text-xs truncate max-w-[150px]">{a.actor || "System"}</td>
                                <td className="px-4 py-3.5 text-gray-300 font-mono text-xs truncate max-w-[150px]">{a.target || "—"}</td>
                                <td className="px-4 py-3.5 text-gray-400 text-xs truncate max-w-[150px]">{a.detail || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SYSTEM HEALTH */}
            {activeTab === "health" && (
              <div className="space-y-6">
                {/* Live Status Header Banner */}
                {(() => {
                  const offlineCount = Object.values(healthStatus).filter(s => s === "OFFLINE").length;
                  const degradedCount = Object.values(healthStatus).filter(s => s === "DEGRADED").length;
                  
                  let bannerText = "CipherKavach Runtime Stable";
                  let bannerSub = "All Critical Systems Operational";
                  let bannerColor = "bg-green-500/10 border-green-500/30 text-green-400";
                  let dotColor = "bg-green-400";
                  let glowColor = "shadow-[0_0_15px_rgba(74,222,128,0.5)]";

                  if (offlineCount > 0) {
                    bannerText = "CipherKavach Critical Platform Outage";
                    bannerSub = `${offlineCount} critical service(s) offline. Security orchestration disrupted.`;
                    bannerColor = "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse";
                    dotColor = "bg-red-500";
                    glowColor = "shadow-[0_0_15px_rgba(239,68,68,0.8)]";
                  } else if (degradedCount > 0) {
                    bannerText = "CipherKavach Service Degradation Detected";
                    bannerSub = `${degradedCount} service(s) reporting abnormal latency or degraded state.`;
                    bannerColor = "bg-orange-500/10 border-orange-500/30 text-orange-400";
                    dotColor = "bg-orange-500";
                    glowColor = "shadow-[0_0_15px_rgba(249,115,22,0.6)]";
                  }

                  return (
                    <div className={`p-5 rounded-2xl border ${bannerColor} flex items-center justify-between relative overflow-hidden transition-all duration-300`}>
                      <div className="flex items-center gap-4 z-10">
                        <div className="relative">
                          <span className={`flex h-3 w-3 rounded-full ${dotColor} ${glowColor}`} />
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75 top-0 left-0`} />
                        </div>
                        <div>
                          <h4 className="text-base font-black uppercase tracking-wider font-mono">{bannerText}</h4>
                          <p className="text-xs opacity-90 text-gray-200 font-mono mt-0.5">{bannerSub}</p>
                        </div>
                      </div>
                      <span className="text-xs uppercase font-bold tracking-wider border border-white/10 px-3 py-1 rounded-full bg-white/5 font-mono hidden md:block">
                        SOC SECURITY LEVEL: 1
                      </span>
                    </div>
                  );
                })()}

                {/* Infrastructure Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {[
                    { label: "API Latency", val: healthStatus["Groq API"] === "DEGRADED" ? "1,940ms" : "240ms", color: healthStatus["Groq API"] === "DEGRADED" ? "text-orange-400" : "text-green-400" },
                    { label: "Sync Throughput", val: Object.values(healthStatus).includes("OFFLINE") ? "62.4%" : Object.values(healthStatus).includes("DEGRADED") ? "88.7%" : "99.8%", color: "text-blue-400" },
                    { label: "Active Sessions", val: "42 active", color: "text-cyan-400" },
                    { label: "Sync Speed", val: healthStatus["Telemetry Engine"] === "DEGRADED" ? "820ms" : "45ms", color: healthStatus["Telemetry Engine"] === "DEGRADED" ? "text-orange-400" : "text-green-400" },
                    { label: "Firestore Load", val: healthStatus["Firestore"] === "OFFLINE" ? "0 req/s" : "24 r/s · 8 w/s", color: healthStatus["Firestore"] === "OFFLINE" ? "text-red-400" : "text-purple-400" },
                    { label: "Orchestration", val: "12% load", color: "text-yellow-400" },
                  ].map(m => (
                    <div key={m.label} className="glass-card p-4 rounded-xl border border-white/5 font-mono">
                      <p className="text-xs text-gray-400 font-bold tracking-wider mb-1.5">{m.label}</p>
                      <p className={`text-base font-black ${m.color}`}>{m.val}</p>
                    </div>
                  ))}
                </div>

                {/* Service Cards Grid with Filters */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 font-mono uppercase tracking-wider">Filter Services:</span>
                    <div className="flex gap-1.5">
                      {[{v:"all",l:"All Services"},{v:"healthy",l:"Healthy"},{v:"degraded",l:"Degraded"},{v:"offline",l:"Offline"}].map(f => (
                        <button key={f.v} onClick={() => setHealthFilter(f.v as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${ healthFilter === f.v ? "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.2)]" : "bg-white/5 text-gray-400 hover:text-gray-200" }`}>{f.l}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(healthStatus)
                      .filter(([name, status]) => {
                        if (healthFilter === "healthy") return status === "HEALTHY";
                        if (healthFilter === "degraded") return status === "DEGRADED";
                        if (healthFilter === "offline") return status === "OFFLINE";
                        return true;
                      })
                      .map(([name, status]) => {
                        const statusColors = {
                          HEALTHY: { text: "HEALTHY", col: "text-green-400 border-green-500/20 bg-green-500/5", dot: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" },
                          DEGRADED: { text: "DEGRADED", col: "text-orange-400 border-orange-500/20 bg-orange-500/5", dot: "bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]" },
                          OFFLINE: { text: "OFFLINE", col: "text-red-400 border-red-500/20 bg-red-500/5", dot: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" },
                        };
                        const conf = statusColors[status];
                        
                        return (
                          <motion.div key={name} layout className="glass-card p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-gray-200">{name}</p>
                              <p className="text-xs text-gray-400 font-mono">SOC Runtime Node</p>
                            </div>
                            <span className={`flex items-center gap-1.5 text-xs font-black border px-2.5 py-1 rounded-full ${conf.col}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} /> {conf.text}
                            </span>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>

                {/* Simulation Control Panel & Live Events */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Simulation Panel */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3"><Cpu className="w-4 h-4 text-yellow-400" /><span className="text-xs font-bold uppercase tracking-widest">Failure Simulations</span></div>
                      <p className="text-xs text-gray-400 mb-5 leading-relaxed font-mono">Simulate various environment disturbances to test CipherKavach resiliency mechanisms and failover notifications.</p>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { l: "Simulate Groq Delay", s: "Groq API", v: "DEGRADED", m: "Groq API response time degraded (>1.5s)" },
                        { l: "Simulate Firestore Timeout", s: "Firestore", v: "OFFLINE", m: "Firestore transaction timeout (504 Gateway Timeout)" },
                        { l: "Simulate Telemetry Degradation", s: "Telemetry Engine", v: "DEGRADED", m: "Telemetry queue buffer size exceeded (85%)" },
                      ].map(sim => (
                        <button
                          key={sim.l}
                          onClick={() => {
                            const newStatus = (healthStatus[sim.s] === sim.v ? "HEALTHY" : sim.v) as "HEALTHY" | "DEGRADED" | "OFFLINE";
                            setHealthStatus(p => ({ ...p, [sim.s]: newStatus }));
                            
                            const timeStr = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }).toLowerCase();
                            const msg = newStatus === "HEALTHY" ? `${sim.s} system recovered and fully operational.` : sim.m;
                            const type = newStatus === "HEALTHY" ? "info" : sim.v === "OFFLINE" ? "error" : "warning";
                            
                            setHealthEvents(p => [{ id: Math.random().toString(), time: timeStr, msg, type }, ...p]);
                          }}
                          className={`w-full text-center py-2.5 rounded-xl border text-xs font-semibold uppercase transition-all ${
                            healthStatus[sim.s] === sim.v
                              ? "bg-red-500/20 border-red-500/30 text-red-300"
                              : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 font-bold"
                          }`}
                        >
                          {sim.l}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => {
                          setHealthStatus({
                            Firebase: "HEALTHY",
                            Firestore: "HEALTHY",
                            "Groq API": "HEALTHY",
                            "CascadeFlow Runtime": "HEALTHY",
                            "OSV.dev": "HEALTHY",
                            Authentication: "HEALTHY",
                            "Runtime APIs": "HEALTHY",
                            "Telemetry Engine": "HEALTHY",
                          });
                          const timeStr = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }).toLowerCase();
                          setHealthEvents(p => [{ id: Math.random().toString(), time: timeStr, msg: "All administrative systems and APIs fully recovered.", type: "info" }, ...p]);
                        }}
                        className="w-full text-center py-2.5 rounded-xl bg-green-500 text-black font-black text-xs uppercase hover:bg-green-400 transition-colors mt-2"
                      >
                        ⚡ Resolve All Issues
                      </button>
                    </div>
                  </div>

                  {/* Terminal Incident Feed */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 md:col-span-2">
                    <div className="flex items-center justify-between mb-4 font-mono">
                      <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-cyan-400" /><span className="text-xs font-bold uppercase tracking-wider">Runtime Health Events</span></div>
                      <span className="text-xs text-gray-400">{healthEvents.length} events logged</span>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto font-mono text-xs pr-2">
                      {healthEvents.map((evt, i) => {
                        const colors = {
                          info: "text-green-400 bg-green-950/20 border border-green-500/20",
                          warning: "text-orange-400 bg-orange-950/20 border border-orange-500/20",
                          error: "text-red-400 bg-red-950/20 border border-red-500/20",
                        };
                        return (
                          <motion.div
                            key={evt.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center justify-between p-2 rounded-lg border border-white/[0.03] bg-white/[0.01]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 font-semibold shrink-0">[{evt.time}]</span>
                              <span className="text-gray-300">{evt.msg}</span>
                            </div>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 uppercase ${colors[evt.type]}`}>
                              {evt.type}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* QUOTA REQUESTS */}
            {activeTab === "requests" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-wider font-mono">Quota Requests</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">Manage operator requests for additional AI runtime credits and enterprise quota allocation.</p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-600 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    {creditRequests.length} total request(s)
                  </span>
                </div>

                {reqsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                    <p className="text-xs text-gray-500 font-mono uppercase tracking-wider animate-pulse">Syncing registry...</p>
                  </div>
                ) : creditRequests.length === 0 ? (
                  <div className="glass-card p-12 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center gap-4 min-h-[250px]">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400"><Database className="w-6 h-6" /></div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">No Active Requests</p>
                      <p className="text-xs text-gray-500 font-mono">All operator runtime quotas are fully operational and verified.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl relative">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Operator</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Plan / Credits</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Requested</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Project Name</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Reason for Request</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Timestamp</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono">Status</th>
                            <th className="py-4 px-5 text-xs uppercase font-bold tracking-wider text-gray-300 font-mono text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {creditRequests.map((req) => {
                            const date = req.createdAt?.toDate?.() || new Date();
                            const timeStr = date.toLocaleDateString() + " " + date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
                            
                            const statusStyles: Record<string, string> = {
                              PENDING: "text-amber-400 border-amber-500/20 bg-amber-500/5",
                              APPROVED: "text-green-400 border-green-500/20 bg-green-500/5",
                              REJECTED: "text-red-400 border-red-500/20 bg-red-500/5",
                              FULFILLED: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
                              "UNDER REVIEW": "text-blue-400 border-blue-500/20 bg-blue-500/5"
                            };

                            const initials = (req.displayName || req.email || "OP").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

                            return (
                              <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xs font-bold text-yellow-300 font-mono">
                                      {initials}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-white">{req.displayName || "Operator"}</p>
                                      <p className="text-xs text-gray-400 font-mono mt-0.5">{req.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-5">
                                  <div className="flex flex-col gap-1.5">
                                    <span className={`inline-block w-fit text-[10px] font-black px-1.5 py-0.2 rounded-full border ${req.currentPlan === "ENTERPRISE" ? "bg-purple-600/20 text-purple-300 border-purple-500/30" : "bg-white/5 text-gray-300 border-white/20"}`}>{req.currentPlan}</span>
                                    <p className="text-xs text-gray-300 font-mono mt-0.5">{req.availableCredits ?? 0} cr available</p>
                                  </div>
                                </td>
                                <td className="py-4 px-5">
                                  <p className="text-sm font-black font-mono text-yellow-400">+{req.requestedCredits} cr</p>
                                </td>
                                <td className="py-4 px-5">
                                  <p className="text-xs font-semibold text-gray-200 font-mono truncate max-w-[120px]" title={req.projectName}>{req.projectName || "N/A"}</p>
                                </td>
                                <td className="py-4 px-5">
                                  <p className="text-xs text-gray-300 font-mono max-w-[200px] whitespace-normal leading-relaxed">{req.reason}</p>
                                </td>
                                <td className="py-4 px-5">
                                  <p className="text-xs text-gray-400 font-mono">{timeStr}</p>
                                </td>
                                <td className="py-4 px-5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-black border px-2 py-0.5 rounded-full uppercase tracking-wider ${statusStyles[req.status] || "text-gray-400 border-white/10 bg-white/5"}`}>
                                    {req.status === "PENDING" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                    {req.status}
                                  </span>
                                </td>
                                <td className="py-4 px-5 text-right">
                                  {reqActionLoading === req.id ? (
                                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                                      Syncing...
                                    </div>
                                  ) : req.status === "PENDING" ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleRequestAction(req.id, req.userId, req.requestedCredits, req.email, "reject")}
                                        className="text-xs font-bold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                                      >
                                        Reject
                                      </button>
                                      <button
                                        onClick={() => handleRequestAction(req.id, req.userId, req.requestedCredits, req.email, "approve")}
                                        className="text-xs font-bold text-green-400 border border-green-500/20 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleRequestAction(req.id, req.userId, req.requestedCredits, req.email, "grant_approve")}
                                        className="text-xs font-black text-black bg-yellow-500 hover:bg-yellow-400 px-2.5 py-1.5 rounded-lg transition-all shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                                      >
                                        Grant & Approve
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-mono font-bold uppercase tracking-wider select-none">RESOLVED</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* FLOATING ACTION DROPDOWN OVERLAY — SOLVES CLIPPING ISSUES PERFECTLY */}
      {activeMenu && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setActiveMenu(null)} />
          <div
            className="absolute z-[999] bg-[#0f1219]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] py-1 w-[250px] font-mono text-xs overflow-hidden"
            style={{ top: activeMenu.y, left: activeMenu.x }}
          >
            {activeMenu.type === "operator" ? (
              <>
                {/* Compact Operator Details Section */}
                <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] text-[10px] space-y-1.5 select-text shrink-0">
                  <div>
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest font-black">Operator</p>
                    <p className="text-white font-bold truncate mt-0.5">{activeMenu.data.displayName || "Unknown Operator"}</p>
                    {activeMenu.data.displayName && activeMenu.data.email && (
                      <p className="text-[8px] text-gray-400 truncate mt-0.5 font-mono">{activeMenu.data.email}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[8px] text-gray-500 uppercase tracking-widest font-black">Role</p>
                      <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded-full border mt-0.5 ${
                        activeMenu.data.enterpriseEnabled ? "bg-purple-600/20 text-purple-300 border-purple-500/30" : "bg-white/5 text-gray-400 border-white/10"
                      }`}>
                        {activeMenu.data.enterpriseEnabled ? "ENTERPRISE" : "STANDARD"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-500 uppercase tracking-widest font-black">Credits</p>
                      <p className="text-yellow-400 font-bold mt-0.5 font-mono">{activeMenu.data.credits ?? 0} cr</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest font-black">UID</p>
                    <p className="text-gray-400 text-[9px] font-mono truncate mt-0.5">{activeMenu.data.uid}</p>
                  </div>
                </div>

                {/* Actions */}
                {[{ label: "⚡ Grant Credits", act: "grant" }, 
                  { label: activeMenu.data.enterpriseEnabled ? "✕ Revoke Enterprise" : "★ Grant Enterprise", act: "toggle_enterprise" }, 
                  { label: activeMenu.data.suspended ? "↩ Unsuspend" : "⊘ Suspend", act: "suspend" }, 
                  { label: "◎ Set Demo Role", act: "set_demo" }, 
                  { label: "↺ Reset Credits (50)", act: "reset_credits" }
                ].map(item => (
                  <button
                    key={item.act}
                    onClick={() => {
                      setActiveMenu(null);
                      if (item.act === "grant") { setGrantModal(activeMenu.data); setGrantAmt(100); }
                      else setConfirmModal({ uid: activeMenu.data.uid, email: activeMenu.data.email, action: item.act, label: item.label });
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </>
            ) : (
              <>
                {[{ label: "⧉ Copy Code", fn: () => { copyCode(activeMenu.data.id); setActiveMenu(null); } },
                  { label: activeMenu.data.active ? "⊘ Disable" : "↺ Reactivate", fn: () => { disableCode(activeMenu.data.id, activeMenu.data.active); setActiveMenu(null); } },
                  { label: "✕ Delete", fn: () => { deleteCode(activeMenu.data.id); setActiveMenu(null); } },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.fn}
                    disabled={codeActionLoading === activeMenu.data.id}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {adminToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-[100] w-full max-w-sm px-4"
          >
            <div className="backdrop-blur-xl bg-[#090d16]/95 border border-yellow-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-start gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600" />
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 space-y-0.5">
                <h4 className="text-xs font-black text-white font-mono uppercase tracking-wider">{adminToast.title}</h4>
                <p className="text-[11px] text-gray-400 leading-normal font-mono">{adminToast.message}</p>
              </div>
              <button
                onClick={() => setAdminToast(null)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
