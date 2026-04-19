"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { exportToCSV } from "../../../lib/exportUtils";
import { 
  Shield, 
  FileText, 
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  FileSearch,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  X,
  Loader2,
  LogOut
} from "lucide-react";

interface DuplicateCase {
  id: string;
  aadhaar: string;
  name1: string;
  scheme1: string;
  amount1: number;
  name2: string;
  scheme2: string;
  amount2: number;
  district: string;
  status: "flagged" | "investigating" | "confirmed" | "cleared";
}

interface ComplianceStats {
  totalFlagged: number;
  totalRecovered: number;
  scheme: string;
  flagRate: number;
  trend: "up" | "down" | "stable";
}

const StatCard = ({ title, value, change, changeType, icon: Icon, color }: { title: string; value: string; change?: string; changeType?: "up" | "down"; icon: React.ElementType; color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-slate-200"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{value}</p>
        {change && (
          <div className="flex items-center gap-1 mt-2">
            {changeType === "up" ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm ${changeType === "up" ? "text-emerald-500" : "text-red-500"}`}>
              {change}
            </span>
          </div>
        )}
      </div>
      <div className={`p-2.5 rounded-xl ${color === "red" ? "bg-red-100" : color === "emerald" ? "bg-emerald-100" : color === "blue" ? "bg-blue-100" : "bg-purple-100"}`}>
        <Icon className={`h-5 w-5 ${color === "red" ? "text-red-600" : color === "emerald" ? "text-emerald-600" : color === "blue" ? "text-blue-600" : "text-purple-600"}`} />
      </div>
    </div>
  </motion.div>
);

const StatusBadge = ({ status }: { status: DuplicateCase["status"] }) => {
  const styles: Record<string, string> = {
    flagged: "bg-slate-100 text-slate-700",
    investigating: "bg-blue-100 text-blue-700",
    confirmed: "bg-red-100 text-red-700",
    cleared: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<string, string> = {
    flagged: "Flagged",
    investigating: "Investigating",
    confirmed: "Confirmed Fraud",
    cleared: "Cleared",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

const QuickAnalysisItem = ({ 
  title, 
  icon: Icon, 
  children, 
  isExpanded, 
  onToggle 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  isExpanded: boolean; 
  onToggle: () => void 
}) => (
  <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${isExpanded ? "text-emerald-600" : "text-slate-600"}`} />
        <span className={`font-medium ${isExpanded ? "text-slate-900" : "text-slate-700"}`}>{title}</span>
      </div>
      <motion.div
        animate={{ rotate: isExpanded ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronDown className={`h-5 w-5 ${isExpanded ? "text-emerald-600" : "text-slate-400"}`} />
      </motion.div>
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="p-4 pt-0 border-t border-slate-100 bg-white">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const DuplicateCard = ({ caseItem, onClick }: { caseItem: DuplicateCase; onClick?: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    onClick={onClick}
    className="bg-white rounded-xl p-4 shadow ring-1 ring-slate-200 hover:ring-purple-300 transition-all cursor-pointer"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm font-mono font-medium text-slate-600">{caseItem.aadhaar}</span>
      </div>
      <StatusBadge status={caseItem.status} />
    </div>
    
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="p-3 rounded-lg bg-red-50">
        <p className="text-xs text-red-600 mb-1">Scheme 1</p>
        <p className="font-medium text-slate-900">{caseItem.name1}</p>
        <p className="text-sm text-slate-600">{caseItem.scheme1}</p>
        <p className="font-semibold text-red-600">₹{caseItem.amount1.toLocaleString()}</p>
      </div>
      <div className="p-3 rounded-lg bg-orange-50">
        <p className="text-xs text-orange-600 mb-1">Scheme 2</p>
        <p className="font-medium text-slate-900">{caseItem.name2}</p>
        <p className="text-sm text-slate-600">{caseItem.scheme2}</p>
        <p className="font-semibold text-orange-600">₹{caseItem.amount2.toLocaleString()}</p>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
        <span>{caseItem.district}</span>
        <span className="font-bold text-emerald-700">Total: ₹{(caseItem.amount1 + caseItem.amount2).toLocaleString()}</span>
      </div>
      <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
        Investigate
      </button>
    </div>
  </motion.div>
);

const CustomSelect = ({ 
  label, 
  value, 
  options, 
  onChange 
}: { 
  label: string; 
  value: string; 
  options: { label: string; value: string }[]; 
  onChange: (val: string) => void 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1.5 w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
      >
        <span>{selectedOption.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`h-4 w-4 transition-colors duration-200 ${isOpen ? "text-emerald-500" : "text-slate-400"}`} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 right-0 mt-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    opt.value === value 
                      ? "bg-emerald-50 text-emerald-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const QueryBuilder = ({ onSearch }: { onSearch: () => void }) => {
  const [filters, setFilters] = useState({
    aadhaar: "",
    scheme: "all",
    district: "all",
    amountMin: "",
    amountMax: "",
    status: "all",
  });

  const schemeOptions = [
    { label: "All Schemes", value: "all" },
    { label: "SSP (Social Security Pension)", value: "ssp" },
    { label: "IGP (Indira Gandhi Pension)", value: "igp" },
    { label: "FHP (Foster Hip)", value: "fhp" },
  ];

  const districtOptions = [
    { label: "All Districts", value: "all" },
    { label: "Ahmedabad", value: "ahmedabad" },
    { label: "Surat", value: "surat" },
    { label: "Vadodara", value: "vadodara" },
    { label: "Rajkot", value: "rajkot" },
    { label: "Gandhinagar", value: "gandhinagar" },
  ];

  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Flagged", value: "flagged" },
    { label: "Investigating", value: "investigating" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Cleared", value: "cleared" },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Advanced Query Builder</h3>
        <button 
          onClick={onSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-emerald-900 text-white hover:bg-emerald-800 transition-colors"
        >
          <FileSearch className="h-4 w-4" />
          Run Query
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Aadhaar Number</label>
          <input 
            type="text" 
            placeholder="XXXX-XXXX-XXXX"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>
        <CustomSelect 
          label="Scheme" 
          value={filters.scheme} 
          options={schemeOptions} 
          onChange={(val) => setFilters({...filters, scheme: val})} 
        />
        <CustomSelect 
          label="District" 
          value={filters.district} 
          options={districtOptions} 
          onChange={(val) => setFilters({...filters, district: val})} 
        />
        <div>
          <label className="text-sm font-medium text-slate-700">Min Amount (₹)</label>
          <input 
            type="number" 
            placeholder="10000"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Max Amount (₹)</label>
          <input 
            type="number" 
            placeholder="50000"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>
        <CustomSelect 
          label="Status" 
          value={filters.status} 
          options={statusOptions} 
          onChange={(val) => setFilters({...filters, status: val})} 
        />
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500 mb-3">Quick Filters</p>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
            Cross-Scheme Duplicates
          </button>
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
            Same Person Different Name
          </button>
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
            Multiple Schemes Same Aadhaar
          </button>
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
            Amount Anomaly
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AuditDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const [mockDuplicates, setMockDuplicates] = useState<DuplicateCase[]>([]);
  const [stats, setStats] = useState({ totalFlagged: 0, totalAmount: 0, confirmedFraud: 0, recovered: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const { user, logout } = useAuth();

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const [statsData, duplicatesData] = await Promise.all([
        api.get('/audit/stats'),
        api.get('/audit/duplicates')
      ]);
      if (statsData.success) {
        setStats(statsData.data);
      }
      if (duplicatesData.success) {
        setMockDuplicates(duplicatesData.data || []);
      }
    } catch (e) {
      console.error("Audit dashboard fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const filteredDuplicates = mockDuplicates.filter(c => {
    const matchesSearch = c.aadhaar.includes(searchQuery) || 
                        c.name1.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.name2.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || c.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalLeakage = mockDuplicates.reduce((sum, c) => sum + c.amount1 + c.amount2, 0);

  const handleExport = () => {
    const exportData = mockDuplicates.map(d => ({
      ID: d.id,
      Aadhaar: d.aadhaar,
      'Scheme 1': d.scheme1,
      'Name 1': d.name1,
      'Amount 1': d.amount1,
      'Scheme 2': d.scheme2,
      'Name 2': d.name2,
      'Amount 2': d.amount2,
      Status: d.status,
      District: d.district
    }));
    exportToCSV(exportData, "Audit_CrossScheme_Duplicates");
  };

  const selectedCase = mockDuplicates.find(d => d.id === selectedDuplicateId);

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      <nav className="mx-auto mt-4 px-6 py-4 flex w-full max-w-[1180px] items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-lg shadow-slate-200/50 sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">DBT Guard</span>
            <p className="text-xs text-slate-500 -mt-1">Audit Dashboard</p>
          </div>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full">
            <Shield className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Auditor: {user?.name || "Loading..."}</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-emerald-900 text-white hover:bg-emerald-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
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
            <Loader2 className="animate-spin text-purple-600 h-8 w-8 mb-4" />
            <p className="text-sm text-slate-500 font-medium">Computing live audit reports...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard title="Cross-Scheme Flags" value={stats.totalFlagged.toString()} change="+18%" changeType="up" icon={AlertTriangle} color="red" />
              <StatCard title="Total Leakage" value={`₹${(stats.totalAmount / 100000).toFixed(1)}Cr`} change="+12%" changeType="up" icon={DollarSign} color="emerald" />
              <StatCard title="Confirmed Fraud" value={stats.confirmedFraud.toString()} change="+24%" changeType="up" icon={CheckCircle} color="red" />
              <StatCard title="Recovered" value={`₹${(stats.recovered / 100000).toFixed(1)}Cr`} change="+8%" changeType="up" icon={TrendingUp} color="emerald" />
            </div>

            <QueryBuilder onSearch={() => handleSearch()} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Cross-Scheme Duplicates</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by Aadhaar or name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all w-64"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                <button 
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === "all" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  All ({mockDuplicates.length})
                </button>
                <button 
                  onClick={() => setActiveFilter("flagged")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === "flagged" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Flagged ({mockDuplicates.filter(c => c.status === "flagged").length})
                </button>
                <button 
                  onClick={() => setActiveFilter("investigating")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === "investigating" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Investigating ({mockDuplicates.filter(c => c.status === "investigating").length})
                </button>
                <button 
                  onClick={() => setActiveFilter("confirmed")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === "confirmed" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Confirmed ({mockDuplicates.filter(c => c.status === "confirmed").length})
                </button>
                <button 
                  onClick={() => setActiveFilter("cleared")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === "cleared" ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Cleared ({mockDuplicates.filter(c => c.status === "cleared").length})
                </button>
              </div>

              <div className="space-y-3">
                {filteredDuplicates.map((caseItem) => (
                  <DuplicateCard 
                    key={caseItem.id} 
                    caseItem={caseItem} 
                    onClick={() => setSelectedDuplicateId(caseItem.id)} 
                  />
                ))}
              </div>

              <AnimatePresence>
                {selectedCase && (
                  <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="bg-white rounded-[2.5rem] p-8 w-full max-w-4xl shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400" />
                      
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900 group flex items-center gap-3">
                            Duplicate Investigation
                            <span className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-full">High Priority</span>
                          </h3>
                          <p className="text-slate-500 text-sm mt-1">Cross-reference analysis for Aadhaar: <span className="font-mono font-bold text-slate-700">{selectedCase.aadhaar}</span></p>
                        </div>
                        <button 
                          onClick={() => setSelectedDuplicateId(null)}
                          className="p-3 rounded-full hover:bg-slate-100 transition-colors"
                        >
                          <X className="h-6 w-6 text-slate-400" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Scheme 1 Card */}
                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 relative group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                          <div className="absolute top-4 right-4 px-3 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-full">RECORD A</div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary Source</span>
                          <h4 className="text-xl font-bold text-slate-900 mt-1">{selectedCase.name1}</h4>
                          <div className="mt-4 space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                              <span className="text-sm text-slate-500">Scheme Name</span>
                              <span className="text-sm font-bold text-slate-900">{selectedCase.scheme1}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                              <span className="text-sm text-slate-500">Disbursed Amount</span>
                              <span className="text-lg font-bold text-emerald-600">₹{selectedCase.amount1.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm text-slate-500">District Record</span>
                              <span className="text-sm font-medium text-slate-700">{selectedCase.district}</span>
                            </div>
                          </div>
                        </div>

                        {/* Scheme 2 Card */}
                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 relative group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                          <div className="absolute top-4 right-4 px-3 py-1 bg-purple-100 text-purple-600 text-[10px] font-bold rounded-full">RECORD B</div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duplicate Match</span>
                          <h4 className="text-xl font-bold text-slate-900 mt-1">{selectedCase.name2}</h4>
                          <div className="mt-4 space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                              <span className="text-sm text-slate-500">Scheme Name</span>
                              <span className="text-sm font-bold text-slate-900">{selectedCase.scheme2}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                              <span className="text-sm text-slate-500">Disbursed Amount</span>
                              <span className="text-lg font-bold text-emerald-600">₹{selectedCase.amount2.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm text-slate-500">District Record</span>
                              <span className="text-sm font-medium text-slate-700">{selectedCase.district}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 p-6 rounded-3xl bg-red-50 border border-red-100">
                        <div className="flex gap-4">
                          <div className="p-3 rounded-2xl bg-red-100 text-red-600 h-fit">
                            <AlertTriangle className="h-6 w-6" />
                          </div>
                          <div>
                            <h5 className="font-bold text-red-900">Audit Finding: Direct Conflict Detected</h5>
                            <p className="text-sm text-red-700 mt-1">
                              The beneficiary is enrolled in two mutually exclusive schemes ({selectedCase.scheme1} & {selectedCase.scheme2}). 
                              Total potential leakage: <span className="font-bold font-mono">₹{(selectedCase.amount1 + selectedCase.amount2).toLocaleString()}</span>.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex gap-4">
                        <button className="flex-1 py-4 bg-emerald-900 text-white rounded-2xl font-bold hover:bg-emerald-800 transition-all shadow-lg hover:shadow-emerald-900/20">
                          Approve Recovery Process
                        </button>
                        <button className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                          Request Clarification
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-2xl p-6 shadow-lg text-white">
              <h2 className="text-lg font-semibold mb-2">Compliance Summary</h2>
              <p className="text-purple-200 text-sm mb-6">System-wide health metrics</p>
              
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200">SSP Scheme</span>
                    <span className="font-bold">94.2%</span>
                  </div>
                  <div className="mt-2 h-2 bg-purple-700/50 rounded-full overflow-hidden">
                    <div className="h-full w-[94.2%] bg-purple-400 rounded-full" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200">IGP Scheme</span>
                    <span className="font-bold">91.8%</span>
                  </div>
                  <div className="mt-2 h-2 bg-purple-700/50 rounded-full overflow-hidden">
                    <div className="h-full w-[91.8%] bg-purple-400 rounded-full" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200">FHP Scheme</span>
                    <span className="font-bold">89.5%</span>
                  </div>
                  <div className="mt-2 h-2 bg-purple-700/50 rounded-full overflow-hidden">
                    <div className="h-full w-[89.5%] bg-purple-400 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Analysis</h2>
              <div className="space-y-3">
                <QuickAnalysisItem 
                  title="Aadhaar Analysis" 
                  icon={Users} 
                  isExpanded={expandedAnalysis === "aadhaar"}
                  onToggle={() => setExpandedAnalysis(expandedAnalysis === "aadhaar" ? null : "aadhaar")}
                >
                  <div className="space-y-3 py-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Unique IDs Scanned</span>
                      <span className="font-bold text-slate-900">1.2M</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Duplicate Links</span>
                      <span className="font-bold text-red-600">4,281</span>
                    </div>
                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-[10px] text-emerald-800 font-medium">
                      High concentration of duplicates found in Rural Sectors (Zone 4).
                    </div>
                  </div>
                </QuickAnalysisItem>

                <QuickAnalysisItem 
                  title="Amount Distribution" 
                  icon={DollarSign} 
                  isExpanded={expandedAnalysis === "amount"}
                  onToggle={() => setExpandedAnalysis(expandedAnalysis === "amount" ? null : "amount")}
                >
                  <div className="space-y-3 py-2">
                    <div className="h-20 flex items-end gap-1 px-2">
                      {[40, 70, 45, 90, 65, 30, 80].map((h, i) => (
                        <div key={i} className="flex-1 bg-emerald-100 rounded-t-sm relative group cursor-help">
                          <div style={{ height: `${h}%` }} className="bg-emerald-500 rounded-t-sm w-full transition-all group-hover:bg-emerald-600" />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-center text-slate-500">Transaction Value Spectrum (₹0 - ₹50k)</p>
                  </div>
                </QuickAnalysisItem>

                <QuickAnalysisItem 
                  title="Temporal Patterns" 
                  icon={Calendar} 
                  isExpanded={expandedAnalysis === "temporal"}
                  onToggle={() => setExpandedAnalysis(expandedAnalysis === "temporal" ? null : "temporal")}
                >
                  <div className="space-y-3 py-2">
                     <div className="flex items-center gap-2 text-xs">
                       <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                       <span className="text-slate-700 font-medium">Peak Anomaly: 1st-5th of Month</span>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed">
                       Higher detection rates observed during batch processing intervals. Recommend increasing sampling during these dates.
                     </p>
                  </div>
                </QuickAnalysisItem>

                <QuickAnalysisItem 
                  title="District Breakdown" 
                  icon={BarChart3} 
                  isExpanded={expandedAnalysis === "district"}
                  onToggle={() => setExpandedAnalysis(expandedAnalysis === "district" ? null : "district")}
                >
                   <div className="space-y-2 py-2">
                     {["Ahmedabad", "Surat", "Vadodara"].map(d => (
                       <div key={d} className="flex items-center justify-between text-xs">
                         <span className="text-slate-600 font-medium">{d}</span>
                         <span className="text-slate-900 font-bold">{Math.floor(Math.random() * 50) + 10}%</span>
                       </div>
                     ))}
                   </div>
                </QuickAnalysisItem>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-6 text-center text-xs text-slate-400 md:px-0">
        © {new Date().getFullYear()} DBT Guard - Gujarat Leakage Detection System. All rights reserved.
      </footer>
    </div>
  );
}