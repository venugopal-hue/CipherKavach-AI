"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, ArrowLeft, CheckCircle2, Zap, LayoutGrid, MessageSquare, GitBranch, ShieldAlert, FileText } from "lucide-react";

export default function EnterprisePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] selection:bg-primary/30">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] pointer-events-none" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-white/5 bg-black/10 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/30 group-hover:border-blue-400/60 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] overflow-hidden">
            <Shield className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform duration-300" strokeWidth={2} />
            <div className="absolute inset-0 bg-blue-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight glow-text text-white">CipherKavach AI</span>
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-bold uppercase tracking-widest border rounded-full text-purple-400 border-purple-500/30 bg-purple-500/10">
            <Zap className="w-3.5 h-3.5" /> Coming Soon
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Scale Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Security</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-gray-400 text-lg max-w-2xl mx-auto">
            Get ready for team workspaces, continuous pipeline monitoring, and advanced compliance reporting. Enterprise features are launching soon.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass-card p-8 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
               <ShieldAlert className="w-32 h-32 text-blue-500" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2">Professional</h3>
             <p className="text-gray-400 text-sm mb-6">For small engineering teams and startups.</p>
             <div className="text-4xl font-bold text-white mb-8">$49<span className="text-lg text-gray-500 font-normal">/mo</span></div>
             <ul className="space-y-4 mb-8">
               {["Up to 5 Team Members", "Unlimited Manual Scans", "50 GitHub Repo Analyses/mo", "Basic Slack Alerts", "Standard Email Support"].map((f, i) => (
                 <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                   <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> {f}
                 </li>
               ))}
             </ul>
             <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 font-semibold cursor-not-allowed">Waitlist Full</button>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="glass-card p-8 rounded-3xl border border-purple-500/30 bg-purple-900/10 relative overflow-hidden group shadow-[0_0_50px_rgba(168,85,247,0.1)]">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
               <LayoutGrid className="w-32 h-32 text-purple-500" />
             </div>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
             <h3 className="text-2xl font-bold text-white mb-2">Enterprise SOC</h3>
             <p className="text-purple-300 text-sm mb-6">For organizations requiring compliance & scale.</p>
             <div className="text-4xl font-bold text-white mb-8">Custom</div>
             <ul className="space-y-4 mb-8">
               {["Unlimited Team Members", "Continuous CI/CD Monitoring", "Automated GitHub PR Scanning", "SOC2 / HIPAA Compliance Reports", "Dedicated Success Manager"].map((f, i) => (
                 <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                   <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" /> {f}
                 </li>
               ))}
             </ul>
             <button className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors shadow-[0_0_20px_rgba(168,85,247,0.4)]">Contact Sales</button>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">Enterprise Integrations</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 opacity-50 hover:opacity-100 transition-opacity">
              <GitBranch className="w-8 h-8 text-white" />
              <span className="text-sm font-semibold text-white">GitHub Actions</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 opacity-50 hover:opacity-100 transition-opacity">
              <MessageSquare className="w-8 h-8 text-[#E01E5A]" />
              <span className="text-sm font-semibold text-white">Slack Alerts</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 opacity-50 hover:opacity-100 transition-opacity">
              <FileText className="w-8 h-8 text-blue-400" />
              <span className="text-sm font-semibold text-white">Jira Sync</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 opacity-50 hover:opacity-100 transition-opacity">
              <Shield className="w-8 h-8 text-green-400" />
              <span className="text-sm font-semibold text-white">Datadog</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
