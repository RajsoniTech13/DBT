"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { exportToCSV } from "../../../lib/exportUtils";
import { 
  Shield, 
  Users, 
  Search, 
  Filter, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin,
  ChevronRight,
  ChevronDown,
  Eye,
  ArrowUpRight,
  FileBarChart,
  FileText,
  MessageSquare,
  History,
  Loader2,
  LogOut
} from "lucide-react";

interface Case {
  id: string;
  beneficiary: string;
  aadhaar: string;
  scheme: string;
  amount: number;
  anomalyType: string;
  riskScore: number;
  district: string;
  status: "unassigned" | "assigned" | "completed";
  assignedTo?: string;
  date: string;
}

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-slate-200"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {change && (
          <p className={`text-xs font-medium mt-2 ${change.startsWith('+') ? 'text-emerald-600' : 'text-slate-500'}`}>
            {change} <span className="text-slate-400 font-normal">vs last month</span>
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

const PriorityQueueItem = ({ caseItem, onAssign }: { caseItem: Case, onAssign: (id: string) => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="group relative flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
  >
    <div className="flex items-center gap-4">
      <div className={`flex-shrink-0 w-12 h-12 rounded-xl grid place-items-center font-bold text-lg ${
        caseItem.riskScore > 80 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
      }`}>
        {caseItem.riskScore}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-900">{caseItem.beneficiary}</h4>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            {caseItem.anomalyType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {caseItem.district}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {caseItem.date}</span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-6">
      <div className="text-right hidden md:block">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span>{caseItem.scheme}</span>
          <span className="font-bold text-slate-900">₹{caseItem.amount.toLocaleString()}</span>
        </div>
        {caseItem.status === "unassigned" ? (
          <button 
            onClick={() => onAssign(caseItem.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-900 text-white hover:bg-emerald-800 transition-colors"
          >
            <Users className="h-3 w-3" />
            Assign
          </button>
        ) : (
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            <Eye className="h-3 w-3" />
            View
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

const QuickActionItem = ({ title, icon: Icon, children, isExpanded, onToggle, color = "emerald" }: any) => (
  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-bold text-slate-900">{title}</span>
      </div>
      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const AssignmentModal = ({ activeCaseId, setActiveCaseId, verifiers, onConfirm }: any) => (
  <AnimatePresence>
    {activeCaseId && (
      <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">Assign Investigator</h3>
            <button 
              onClick={() => setActiveCaseId(null)}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <History className="h-5 w-5 text-slate-400 rotate-45" /> 
            </button>
          </div>
          
          <p className="text-sm text-slate-500 mb-6"> Select a Scheme Verifier to conduct physical field verification for this high-risk case.</p>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {verifiers.map((v: any) => (
              <button
                key={v.id}
                onClick={() => onConfirm(String(v.id))}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-transparent hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
              >
                <div className="text-left">
                  <p className="font-bold text-slate-900 group-hover:text-emerald-900">{v.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{v.district}</p>
                </div>
                <Users className="h-5 w-5 text-slate-300 group-hover:text-emerald-500" />
              </button>
            ))}
            {verifiers.length === 0 && (
              <p className="text-center py-4 text-xs text-slate-400">No verifiers found in your district.</p>
            )}
          </div>
          
          <button 
            onClick={() => setActiveCaseId(null)}
            className="w-full mt-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function DFODashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<Case["status"] | "all">("all");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  
  const [mockCases, setMockCases] = useState<Case[]>([]);
  const [stats, setStats] = useState({ totalCases: 0, highRisk: 0, inProgress: 0, resolved: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [verifiers, setVerifiers] = useState<any[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, casesData] = await Promise.all([
          api.get('/dfo/stats'),
          api.get('/dfo/cases')
        ]);
        if (statsData.success) {
          setStats({
            totalCases: statsData.data.totalCases || 0,
            highRisk: statsData.data.highRisk || 0,
            inProgress: statsData.data.inProgress || 0,
            resolved: statsData.data.resolved || 0
          });
        }
        if (casesData.success) setMockCases(casesData.data || []);

        const verifiersRes = await api.get('/dfo/verifiers');
        if (verifiersRes.success) setVerifiers(verifiersRes.data || []);
      } catch (e) {
        console.error("DFO Dashboard fetch error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredCases = mockCases.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = c.beneficiary.toLowerCase().includes(query) || 
                          c.aadhaar.includes(query) ||
                          c.scheme.toLowerCase().includes(query);
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAssignClick = (id: string) => {
    setActiveCaseId(id);
  };

  const handleConfirmAssign = async (verifierId: string) => {
    if (!activeCaseId) return;
    try {
      const res = await api.post(`/cases/${activeCaseId}/assign`, {
        verifierId
      });
      if (res.success) {
        setMockCases(prev => prev.map(c => 
          c.id === activeCaseId ? { ...c, status: "assigned", assignedTo: res.case?.assignedTo || "Verifier" } : c
        ));
        setActiveCaseId(null);
      }
    } catch (err: any) {
      alert("Failed to assign case: " + err.message);
    }
  };

  const handleExport = () => {
    const exportData = mockCases.map(c => ({
      ID: c.id,
      Beneficiary: c.beneficiary,
      Aadhaar: c.aadhaar,
      Scheme: c.scheme,
      Amount: c.amount,
      Risk: c.riskScore,
      Status: c.status,
      District: c.district,
      Date: c.date
    }));
    exportToCSV(exportData, "DFO_Investigation_Queue");
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      <AssignmentModal 
        activeCaseId={activeCaseId} 
        setActiveCaseId={setActiveCaseId} 
        verifiers={verifiers} 
        onConfirm={handleConfirmAssign} 
      />

      <nav className="mx-auto mt-4 px-6 py-4 flex w-full max-w-[1180px] items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-lg shadow-slate-200/50 sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">DBT Guard</span>
            <p className="text-xs text-slate-500 -mt-1">DFO Dashboard</p>
          </div>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">District: {user?.district || "Loading..."}</span>
          </div>
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
            <p className="text-sm text-slate-500 font-medium">Loading DFO pipeline...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard title="Total Cases" value={stats.totalCases.toString()} change="" icon={FileText} color="emerald" />
              <StatCard title="High Risk" value={stats.highRisk.toString()} change="" icon={AlertTriangle} color="red" />
              <StatCard title="In Progress" value={stats.inProgress.toString()} icon={Clock} color="orange" />
              <StatCard title="Resolved" value={stats.resolved.toString()} change="" icon={CheckCircle} color="emerald" />
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Investigation Queue</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search cases..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all w-56"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all">
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                <button 
                  onClick={() => setFilterStatus("all")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === "all" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  All ({mockCases.length})
                </button>
                <button 
                  onClick={() => setFilterStatus("unassigned")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === "unassigned" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Unassigned ({mockCases.filter(c => c.status === "unassigned").length})
                </button>
                <button 
                  onClick={() => setFilterStatus("assigned")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === "assigned" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Assigned ({mockCases.filter(c => c.status === "assigned").length})
                </button>
                <button 
                  onClick={() => setFilterStatus("completed")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === "completed" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Completed ({mockCases.filter(c => c.status === "completed").length})
                </button>
              </div>

              <div className="space-y-3">
                {filteredCases.map((caseItem) => (
                  <PriorityQueueItem key={caseItem.id} caseItem={caseItem} onAssign={handleAssignClick} />
                ))}
                {filteredCases.length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-500 font-medium">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <QuickActionItem 
                  title="Assign Cases" 
                  icon={Users} 
                  isExpanded={expandedAction === "assign"}
                  onToggle={() => setExpandedAction(expandedAction === "assign" ? null : "assign")}
                >
                  <div className="space-y-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Unassigned High Risk</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                        <span className="text-xs font-bold text-slate-900">R. Patel (SSP)</span>
                        <span className="text-[10px] bg-red-200 text-red-700 px-2 py-0.5 rounded-full">Score: 95</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100">
                        <span className="text-xs font-bold text-slate-900">A. Joshi (IGP)</span>
                        <span className="text-[10px] bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full">Score: 58</span>
                      </div>
                    </div>
                    <button className="w-full py-2 bg-emerald-900 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors mt-2">
                      Open Bulk Assigner
                    </button>
                  </div>
                </QuickActionItem>

                <QuickActionItem 
                  title="Export Report" 
                  icon={Download} 
                  isExpanded={expandedAction === "export"}
                  onToggle={() => setExpandedAction(expandedAction === "export" ? null : "export")}
                  color="slate"
                >
                  <div className="space-y-2 py-2">
                    <button 
                      onClick={handleExport}
                      className="w-full flex items-center gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex-shrink-0 h-10 w-10 grid place-items-center bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-700 font-bold tracking-tighter shadow-sm group-hover:bg-red-100 group-hover:scale-105 transition-all">
                        PDF
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">Detailed Audit Report</p>
                        <p className="text-[10px] text-slate-500">Portable Document Format (.pdf)</p>
                      </div>
                    </button>
                    <button 
                      onClick={handleExport}
                      className="w-full flex items-center gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex-shrink-0 h-10 w-10 grid place-items-center bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-700 font-bold tracking-tighter shadow-sm group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                        XLS
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">Beneficiary List</p>
                        <p className="text-[10px] text-slate-500">Excel Spreadsheet (.xlsx)</p>
                      </div>
                    </button>
                  </div>
                </QuickActionItem>

                <QuickActionItem 
                  title="View History" 
                  icon={History} 
                  isExpanded={expandedAction === "history"}
                  onToggle={() => setExpandedAction(expandedAction === "history" ? null : "history")}
                  color="slate"
                >
                  <div className="space-y-3 py-2">
                    <div className="border-l-2 border-emerald-500 pl-3 space-y-1">
                      <p className="text-[10px] font-bold text-slate-900">Weekly Target: 85%</p>
                      <p className="text-[10px] text-slate-500 font-medium">Last synced: 12 mins ago</p>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full w-[85%] bg-emerald-500" />
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed italic">
                      "Historical data shows 15% increase in efficiency since Jan 2024."
                    </p>
                  </div>
                </QuickActionItem>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-2xl p-6 shadow-lg text-white">
              <h2 className="text-lg font-semibold mb-2">Leakage Prevented</h2>
              <p className="text-3xl font-bold">₹2.4Cr</p>
              <p className="text-emerald-200 text-sm mt-2">This fiscal year</p>
              <div className="mt-4 h-2 bg-emerald-700 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-emerald-400 rounded-full" />
              </div>
              <div className="flex justify-between mt-2 text-xs text-emerald-200">
                <span>75% of target</span>
                <span>Target: ₹3.2Cr</span>
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