"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { 
  Shield, 
  Settings, 
  Globe, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  Map as MapIcon,
  ChevronRight,
  Plus,
  RefreshCw,
  BarChart3,
  Layers,
  Loader2,
  LogOut,
  X,
  Activity
} from "lucide-react";

interface Rule {
  id: string;
  name: string;
  description: string;
  threshold: string;
  enabled: boolean;
  severity: "high" | "medium" | "low";
}

const StatCard = ({ title, value, change, icon: Icon, color }: { title: string; value: string; change?: string; icon: React.ElementType; color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-slate-200"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{value}</p>
        <span className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {change}
        </span>
      </div>
      <div className={`p-2.5 rounded-xl ${color === "red" ? "bg-red-100" : "bg-emerald-100"}`}>
        <Icon className={`h-5 w-5 ${color === "red" ? "text-red-600" : "text-emerald-600"}`} />
      </div>
    </div>
  </motion.div>
);

const RuleCard = ({ rule, onToggle }: { rule: Rule, onToggle: (id: string, enabled: boolean) => void }) => (
  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between group hover:border-emerald-300 hover:bg-white transition-all">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded-lg ${rule.enabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
        <Zap className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm">{rule.name}</h4>
        <p className="text-xs text-slate-500">{rule.description}</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
        rule.severity === 'high' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
      }`}>
        {rule.severity}
      </span>
      <button 
        onClick={() => onToggle(rule.id, !rule.enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ globalFlags: 0, activeRules: 0, syncHealth: "0%", detectionRate: "0%", totalSavings: 0, accuracyScore: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, rulesRes, heatmapRes] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/rules'),
        api.get('/admin/heatmap')
      ]);

      if (summaryRes.success) setStats(summaryRes.data);
      if (rulesRes.success) setRules(rulesRes.data || []);
      if (heatmapRes.success) setHeatmapData(heatmapRes.data || {});
    } catch (error) {
      console.error("Admin dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleToggleRule = async (id: string, enabled: boolean) => {
    try {
      const res = await api.patch(`/admin/rules/${id}`, { enabled });
      if (res.success) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
      }
    } catch (err) {
      alert("Failed to update rule");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7] font-jakarta">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      <nav className="mx-auto mt-4 px-6 py-4 flex w-full max-w-[1180px] items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-lg shadow-slate-200/50 sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-900 text-white shadow">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">DBT Guard</span>
            <p className="text-xs font-bold text-emerald-600 -mt-1 uppercase tracking-widest">State Admin Control</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button onClick={loadDashboard} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Rules
          </button>
          <button className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold bg-emerald-900 text-white hover:bg-emerald-800 shadow-md transition-all">
            <Plus className="h-4 w-4" />
            New Detector
          </button>
          <button 
            onClick={() => logout()}
            className="p-2 rounded-full hover:bg-red-50 group transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5 text-slate-600 group-hover:text-red-600" />
          </button>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 mt-12 bg-white/50 rounded-2xl border border-slate-100">
            <Loader2 className="animate-spin text-emerald-600 h-8 w-8 mb-4" />
            <p className="text-sm text-slate-500 font-medium">Synchronizing Admin Configs...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <StatCard title="Global Flags" value={stats.globalFlags.toString()} change="+4.2%" icon={AlertTriangle} color="red" />
              <StatCard title="Active Rules" value={stats.activeRules.toString()} change="Stable" icon={Zap} color="emerald" />
              <StatCard title="Sync Health" value={stats.syncHealth} change="Optimal" icon={RefreshCw} color="emerald" />
              <StatCard title="Detection Rate" value={stats.detectionRate} change="+2.1%" icon={TrendingUp} color="emerald" />
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">State-Level Risk Heatmap</h2>
                  <p className="text-xs text-slate-500 mt-0.5">District-wise average risk intensity (AI Analytics)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 px-2 py-1 bg-emerald-50 rounded-lg">Low Risk</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 px-2 py-1 bg-red-50 rounded-lg">High Risk</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {Object.entries(heatmapData).length > 0 ? (
                  Object.entries(heatmapData).map(([district, risk]) => (
                    <div key={district} className="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-10 w-10 rounded-lg grid place-items-center font-bold text-xs" 
                          style={{ 
                            backgroundColor: risk > 0.7 ? '#FEE2E2' : risk > 0.4 ? '#FEF3C7' : '#DCFCE7',
                            color: risk > 0.7 ? '#991B1B' : risk > 0.4 ? '#92400E' : '#166534'
                          }}
                        >
                          {Math.round(risk * 100)}%
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{district}</p>
                          <p className="text-[10px] text-slate-500 font-medium uppercase">Intensity Score</p>
                        </div>
                      </div>
                      <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full mx-4 overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ 
                            width: `${risk * 100}%`,
                            backgroundColor: risk > 0.7 ? '#EF4444' : risk > 0.4 ? '#F59E0B' : '#10B981'
                          }} 
                        />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm font-medium">No heatmap data available yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Run AI Analysis Pipeline</p>
                    <div className="mt-4 flex gap-2">
                       <Activity className="h-5 w-5 text-emerald-600 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl ring-1 ring-slate-200">
               <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Detector Rule Config</h2>
                <button className="text-emerald-700 text-sm font-bold hover:underline">View All Rules</button>
              </div>
              <div className="space-y-4">
                {rules.map(rule => <RuleCard key={rule.id} rule={rule} onToggle={handleToggleRule} />)}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-900 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-40 w-40 bg-emerald-800 rounded-full blur-3xl opacity-50" />
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-emerald-400" />
                  System Overview
                </h2>
                <div className="space-y-4 relative z-10">
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                    <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-1">Total Savings</p>
                    <p className="text-3xl font-bold">₹{(stats.totalSavings / 10000000).toFixed(1)} Cr</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-800/50 border border-white/5">
                    <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-1">Accuracy Score</p>
                    <p className="text-3xl font-bold">{stats.accuracyScore}%</p>
                  </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Admin Quick Tools</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                   <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-slate-600 group-hover:text-emerald-600 transition-colors" />
                    <span className="font-bold text-slate-900">Audit Logs</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-all" />
                </button>
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                   <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-slate-600 group-hover:text-emerald-600 transition-colors" />
                    <span className="font-bold text-slate-900">Detector API</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-all" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
