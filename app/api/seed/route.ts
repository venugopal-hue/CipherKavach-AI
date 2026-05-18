import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, addDoc, Timestamp } from "firebase/firestore";

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { error: "API seeder endpoint is permanently disabled in this release to prevent cluttering or repopulation." },
    { status: 403 }
  );

  const reset = req.nextUrl.searchParams.get("reset") === "true";
  const now = new Date();
  
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

  const report: any = {
    resetPerformed: reset,
    deletedCounts: {},
    seededCounts: {},
    errors: []
  };

  // 1. DELETE EXISTING DATA IF RESET REQUESTED
  if (reset) {
    console.log("[Firestore Reset] Initializing absolute database reset...");
    for (const colName of targetCollections) {
      try {
        const snap = await getDocs(collection(db, colName));
        let deleted = 0;
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
          deleted++;
        }
        console.log(`[Firestore Reset] Deleted ${deleted} documents from '${colName}'`);
        report.deletedCounts[colName] = deleted;
      } catch (err: any) {
        console.error(`[Firestore Reset] Failed to delete '${colName}':`, err);
        report.errors.push(`Reset failed for ${colName}: ${err.message || String(err)}`);
      }
    }
  }

  // 2. GENERATE NEW OPERATIONS DATA
  const ADMIN_UID = "Mu2hYM65AxOOffisPtdGygMGtDf1";
  const DEMO_UID = "MurI5Mj6eheVRPdExIQByVlAYUx2";

  const seedDoc = async (colName: string, data: any, docId?: string) => {
    try {
      if (docId) {
        await setDoc(doc(db, colName, docId), data);
      } else {
        await addDoc(collection(db, colName), data);
      }
      report.seededCounts[colName] = (report.seededCounts[colName] || 0) + 1;
    } catch (err: any) {
      console.error(`[Seeder Error] Failed to write in '${colName}':`, err);
      report.errors.push(`Seeding failed for ${colName}: ${err.message || String(err)}`);
    }
  };

  // A. UPDATE USERS PROFILE IN FIRESTORE TO ENSURE SYNCED AUTH MAPPING
  try {
    // Admin profile
    await setDoc(doc(db, "users", ADMIN_UID), {
      uid: ADMIN_UID,
      email: "venugopalrao1802@gmail.com",
      displayName: "Venugopal Rao",
      role: "ADMIN",
      plan: "ENTERPRISE",
      credits: 9999,
      totalScans: 85,
      createdAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
      registeredAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
      suspended: false,
      enterpriseEnabled: true
    }, { merge: true });

    // Demo profile
    await setDoc(doc(db, "users", DEMO_UID), {
      uid: DEMO_UID,
      email: "demo@cipherkavach.ai",
      displayName: "Demo Operator",
      role: "operator",
      plan: "ENTERPRISE",
      credits: 220,
      totalScans: 48,
      createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
      registeredAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
      suspended: false,
      enterpriseEnabled: true
    }, { merge: true });

    report.seededCounts["users"] = 2;
  } catch (err: any) {
    report.errors.push(`Users update failed: ${err.message || String(err)}`);
  }

  // B. SCANS DATA
  const packages = ["lodash", "axios", "minimist", "ws", "express", "react", "next", "socket.io", "async", "ip"];
  const cves = [
    { cve: "CVE-2020-8203", score: 9.8, pkg: "lodash", severity: "CRITICAL" },
    { cve: "CVE-2020-28168", score: 8.4, pkg: "axios", severity: "HIGH" },
    { cve: "CVE-2021-3918", score: 7.5, pkg: "minimist", severity: "HIGH" },
    { cve: "CVE-2021-32803", score: 5.6, pkg: "ws", severity: "MEDIUM" },
    { cve: "CVE-2022-24999", score: 2.4, pkg: "express", severity: "LOW" },
    { cve: "CVE-2023-42282", score: 8.9, pkg: "socket.io", severity: "HIGH" }
  ];

  const createScans = async (uid: string, totalCount: number) => {
    for (let i = 0; i < totalCount; i++) {
      const scanDate = new Date(now.getTime() - (totalCount - i) * 1.2 * 86400000 - Math.random() * 12 * 3600000);
      const cveIndex = i % cves.length;
      const cveData = cves[cveIndex];
      
      await seedDoc("scans", {
        userId: uid,
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

  await createScans(ADMIN_UID, 24);
  await createScans(DEMO_UID, 20);

  // C. NOTIFICATIONS DATA
  const notifTemplates = [
    { title: "Low Credits Alert", message: "Operator runtime resources are approaching quota threshold. Extend limits.", severity: "warning" },
    { title: "Exploit Escalation Blocked", message: "CascadeFlow security gateway blocked a critical buffer escalation attack vector.", severity: "critical" },
    { title: "SOC Platform Configured", message: "CipherKavach security operations center setup completed successfully.", severity: "info" },
    { title: "AI Remediation Ready", message: "Optimized threat remediation manifest successfully compiled for express-app container.", severity: "info" },
    { title: "Threat Database Synced", message: "Global vulnerability tracking database synchronized successfully.", severity: "info" }
  ];

  const createNotifications = async (uid: string) => {
    for (let i = 0; i < 8; i++) {
      const notifDate = new Date(now.getTime() - i * 2 * 86400000 - Math.random() * 3600000);
      const template = notifTemplates[i % notifTemplates.length];
      await seedDoc("notifications", {
        userId: uid,
        title: template.title,
        message: template.message,
        severity: template.severity,
        timestamp: notifDate.toISOString(),
        read: i > 2
      });
    }
  };

  await createNotifications(ADMIN_UID);
  await createNotifications(DEMO_UID);

  // D. SAVED REPORTS DATA
  const reportTemplates = [
    { name: "production-build-scan", type: "JSON", count: 18, critical: 1, high: 4 },
    { name: "stage-auth-middleware", type: "PDF", count: 8, critical: 0, high: 2 },
    { name: "express-container-audit", type: "JSON", count: 24, critical: 3, high: 8 }
  ];

  const createReports = async (uid: string) => {
    for (let i = 0; i < reportTemplates.length; i++) {
      const rDate = new Date(now.getTime() - (i + 1) * 3 * 86400000);
      const template = reportTemplates[i];
      await seedDoc("savedReports", {
        userId: uid,
        fileName: `${template.name}_remediation.${template.type.toLowerCase()}`,
        fileType: template.type,
        summary: `Vulnerability resolution roadmap for manifest: ${template.count} dependencies tracked. Remediated ${template.critical} Critical and ${template.high} High-severity risks.`,
        timestamp: rDate.toISOString()
      });
    }
  };

  await createReports(ADMIN_UID);
  await createReports(DEMO_UID);

  // E. REPLAY HISTORY
  const replayTemplates = [
    { target: "express-auth-payload", status: "BLOCKED", threat: "CVE-2020-8203 Buffer Exploit" },
    { target: "axios-stream-handler", status: "RESOLVED", threat: "CVE-2020-28168 SSRF Inject" },
    { target: "node-dependency-manager", status: "SIMULATED", threat: "CVE-2021-3918 Prototype Pollution" }
  ];

  const createReplay = async (uid: string) => {
    for (let i = 0; i < replayTemplates.length; i++) {
      const repDate = new Date(now.getTime() - (i + 1) * 2.5 * 86400000);
      const rep = replayTemplates[i];
      await seedDoc("replayHistory", {
        userId: uid,
        targetContainer: rep.target,
        simulatedThreat: rep.threat,
        status: rep.status,
        timestamp: repDate.toISOString(),
        durationSeconds: Math.floor(45 + Math.random() * 90)
      });
    }
  };

  await createReplay(ADMIN_UID);
  await createReplay(DEMO_UID);

  // F. AUDIT LOGS
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

    await seedDoc("auditLogs", {
      actor: i % 3 === 0 ? "Venugopal Rao" : i % 2 === 0 ? "Demo Operator" : "System Core",
      target: i % 4 === 0 ? "express-app" : "production-build",
      action: actionTemplate.action,
      category: actionTemplate.cat,
      severity: actionTemplate.sev,
      detail: actionTemplate.desc,
      timestamp: Timestamp.fromDate(logDate)
    });
  }

  // G. RUNTIME CODES
  const runtimeCodes = [
    { code: "CIPHER-100", credits: 100, enterprise: false, replayAccess: false, usageLimit: 50, redeemedCount: 14, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
    { code: "ENTERPRISE-PRO", credits: 250, enterprise: true, replayAccess: true, usageLimit: 10, redeemedCount: 4, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
    { code: "CASCADEFLOW-VIP", credits: 150, enterprise: true, replayAccess: true, usageLimit: 25, redeemedCount: 18, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
    { code: "HACKATHON-2026", credits: 200, enterprise: true, replayAccess: true, usageLimit: 100, redeemedCount: 65, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() },
    { code: "CIPHER-STARTER", credits: 50, enterprise: false, replayAccess: false, usageLimit: 200, redeemedCount: 145, status: "active", expiry: new Date(now.getTime() + 90 * 86400000).toISOString() }
  ];

  for (const rc of runtimeCodes) {
    await seedDoc("runtimeCodes", rc, rc.code);
  }

  // H. REDEMPTIONS
  for (let i = 0; i < 10; i++) {
    const redemptionDate = new Date(now.getTime() - i * 2.5 * 86400000);
    await seedDoc("redemptions", {
      userId: i % 2 === 0 ? ADMIN_UID : DEMO_UID,
      email: i % 2 === 0 ? "venugopalrao1802@gmail.com" : "demo@cipherkavach.ai",
      code: i % 2 === 0 ? "CIPHER-100" : "CIPHER-STARTER",
      creditsGranted: i % 2 === 0 ? 100 : 50,
      enterpriseUnlocked: false,
      timestamp: Timestamp.fromDate(redemptionDate),
      status: "success"
    });
  }

  // I. TELEMETRY LOGS
  const telemetryTemplates = [
    { type: "CPU", val: "45%", details: "Dynamic security sandbox container usage normal" },
    { type: "MEM", val: "1.2 GB", details: "Remediation compile node memory synchronized" },
    { type: "SYS", val: "ONLINE", details: "CascadeFlow socket listening on active secure proxy" }
  ];

  const createTelemetry = async (uid: string) => {
    for (let i = 0; i < 12; i++) {
      const telDate = new Date(now.getTime() - i * 6 * 3600000);
      const tel = telemetryTemplates[i % telemetryTemplates.length];
      await seedDoc("telemetryLogs", {
        userId: uid,
        logType: tel.type,
        metricValue: tel.val,
        description: tel.details,
        timestamp: telDate.toISOString()
      });
    }
  };

  await createTelemetry(ADMIN_UID);
  await createTelemetry(DEMO_UID);

  console.log("=== Clean Firestore Seed & Repopulate Complete ===");
  return NextResponse.json(report);
}
