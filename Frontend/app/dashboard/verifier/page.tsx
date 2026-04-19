"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { 
  Shield, 
  FileText, 
  MapPin,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Navigation,
  Clock,
  User,
  Phone,
  Home,
  DollarSign,
  Calendar,
  ChevronRight,
  ChevronDown,
  Flag,
  Send,
  Upload,
  ExternalLink,
  MessageSquare,
  Loader2,
  LogOut
} from "lucide-react";

interface AssignedCase {
  id: string;
  beneficiary: string;
  aadhaar: string;
  scheme: string;
  amount: number;
  anomalyType: string;
  riskScore: number;
  assignedDate: string;
  district: string;
  address: string;
  phone: string;
  assignedBy: string;
  latitude: number;
  longitude: number;
}

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ElementType; color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-slate-200"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${color === "blue" ? "bg-blue-100" : color === "orange" ? "bg-orange-100" : "bg-emerald-100"}`}>
        <Icon className={`h-5 w-5 ${color === "blue" ? "text-blue-600" : color === "orange" ? "text-orange-600" : "text-emerald-600"}`} />
      </div>
    </div>
  </motion.div>
);

export default function VerifierDashboard() {
  const [selectedCase, setSelectedCase] = useState<AssignedCase | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [stats, setStats] = useState({ assigned: 0, pending: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  // Verification form state
  const [checks, setChecks] = useState({
    beneficiaryAlive: false,
    addressVerified: false,
    aadhaarOriginal: false,
    documentsValid: false,
  });
  const [remarks, setRemarks] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allChecked = Object.values(checks).every(Boolean);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, inboxData] = await Promise.all([
        api.get('/verifier/stats'),
        api.get('/verifier/inbox')
      ]);
      if (statsData.success) {
        setStats({
          assigned: statsData.data.assigned || 0,
          pending: statsData.data.pending || 0,
          completed: statsData.data.completed || 0
        });
      }
      if (inboxData.success) {
        setCases(inboxData.data || []);
      }
    } catch (e) {
      console.error("Verifier dashboard fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCases = cases.filter(c => 
    c.beneficiary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.district.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewCase = (caseItem: AssignedCase) => {
    setSelectedCase(caseItem);
    // Reset checklist
    setChecks({ beneficiaryAlive: false, addressVerified: false, aadhaarOriginal: false, documentsValid: false });
    setRemarks("");
    setPhoto(null);
  };

  const handleBackToList = () => {
    setSelectedCase(null);
    setChecks({ beneficiaryAlive: false, addressVerified: false, aadhaarOriginal: false, documentsValid: false });
    setRemarks("");
    setPhoto(null);
  };

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmitVerification = async (result: "legitimate" | "fraud" | "more_docs") => {
    if (!selectedCase) return;
    setIsSubmitting(true);
    
    try {
      // Get GPS coordinates — use beneficiary location from backend
      let latitude = selectedCase.latitude || 23.0225;
      let longitude = selectedCase.longitude || 72.5714;

      // Try to get actual GPS if available
      try {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // Use beneficiary location as fallback
      }

      const payload = {
        isFraud: result === "fraud",
        remarks: remarks || `Field verification result: ${result}. Checklist: all items verified.`,
        latitude,
        longitude,
        photo_url: photo ? photo.name : null,
        verification_status: result === "more_docs" ? "pending_docs" : "completed"
      };

      const res = await api.post(`/cases/${selectedCase.id}/verify`, payload);
      
      if (res.success) {
        // Remove from list, update stats
        setCases(prev => prev.filter(c => c.id !== selectedCase.id));
        setStats(prev => ({ 
          ...prev, 
          pending: Math.max(0, prev.pending - 1), 
          completed: prev.completed + 1 
        }));
        setSelectedCase(null);
        setRemarks("");
        setPhoto(null);
        setChecks({ beneficiaryAlive: false, addressVerified: false, aadhaarOriginal: false, documentsValid: false });
      }
    } catch (e: any) {
      alert("Verification failed: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      <nav className="mx-auto mt-4 px-6 py-4 flex w-full max-w-[1180px] items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-lg shadow-slate-200/50 sticky top-4 z-50">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-700 text-white shadow">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">DBT Guard</span>
            <p className="text-xs text-slate-500 -mt-1">Scheme Verifier</p>
          </div>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
            <User className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{user?.name || "Loading..."}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">{user?.district || "Loading..."}</span>
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
            <Loader2 className="animate-spin text-blue-600 h-8 w-8 mb-4" />
            <p className="text-sm text-slate-500 font-medium">Loading assignments...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard title="Total Assigned" value={stats.assigned.toString()} icon={FileText} color="blue" />
              <StatCard title="Pending Visit" value={stats.pending.toString()} icon={Clock} color="orange" />
              <StatCard title="Completed" value={stats.completed.toString()} icon={CheckCircle} color="emerald" />
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!selectedCase ? (
              /* ─── INBOX LIST ─── */
              <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Case Inbox ({cases.length})</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search cases..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all w-56"
                    />
                  </div>
                </div>

                {filteredCases.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Navigation className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No pending assignments</p>
                    <p className="text-xs text-slate-400 mt-1">New cases will appear here when assigned by DFO</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCases.map((caseItem) => (
                      <motion.div 
                        key={caseItem.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 border border-transparent transition-all cursor-pointer group"
                        onClick={() => handleViewCase(caseItem)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white shadow-sm border border-slate-100">
                              <User className="h-6 w-6 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{caseItem.beneficiary}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-medium text-slate-600">{caseItem.scheme}</span>
                                <span className="text-sm font-bold text-slate-900">₹{caseItem.amount.toLocaleString()}</span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">{caseItem.anomalyType}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
                                <MapPin className="h-4 w-4 text-emerald-600" />
                                {caseItem.district}
                              </div>
                              <p className="text-xs font-medium text-slate-500">Assigned: {caseItem.assignedDate}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ─── VERIFICATION FORM ─── */
              <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Field Verification Checklist</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Complete all checks before submitting</p>
                  </div>
                  <button 
                    onClick={handleBackToList}
                    className="px-4 py-2 rounded-full bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    ← Back to Inbox
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { key: "beneficiaryAlive" as const, label: "Is beneficiary alive and present?", icon: User },
                    { key: "addressVerified" as const, label: "Address verified matching records?", icon: Home },
                    { key: "aadhaarOriginal" as const, label: "Aadhaar card original verified?", icon: FileText },
                    { key: "documentsValid" as const, label: "Supporting documents valid?", icon: FileText },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => toggleCheck(item.key)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                        checks[item.key] 
                          ? "bg-emerald-50 border-2 border-emerald-500" 
                          : "bg-slate-50 border-2 border-transparent hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${checks[item.key] ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-slate-900">{item.label}</span>
                      </div>
                      {checks[item.key] && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                    </button>
                  ))}

                  {/* Evidence upload */}
                  <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                    <label className="block text-xs font-bold text-blue-700 uppercase mb-2">Evidence Photo</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    {photo && <p className="text-xs text-emerald-600 mt-2 font-medium">✓ {photo.name} attached</p>}
                  </div>

                  {/* Remarks */}
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Field Remarks</label>
                    <textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Describe your observations during the field visit..."
                      className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all min-h-[100px]"
                    />
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-4">Verification Verdict</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleSubmitVerification("legitimate")}
                      disabled={!allChecked || isSubmitting}
                      className="flex items-center justify-center gap-2 p-4 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                      Legitimate
                    </button>
                    <button
                      onClick={() => handleSubmitVerification("fraud")}
                      disabled={!allChecked || isSubmitting}
                      className="flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      Fraud Confirmed
                    </button>
                    <button
                      onClick={() => handleSubmitVerification("more_docs")}
                      disabled={!allChecked || isSubmitting}
                      className="flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                      Needs More Docs
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR ─── */}
          <div className="space-y-6">
            {selectedCase && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200"
              >
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Case Details</h2>
                <div className="space-y-3">
                  {[
                    { icon: User, label: "Beneficiary", value: selectedCase.beneficiary },
                    { icon: FileText, label: "Aadhaar", value: selectedCase.aadhaar },
                    { icon: DollarSign, label: "Amount", value: `₹${selectedCase.amount.toLocaleString()}` },
                    { icon: Home, label: "Address", value: selectedCase.address },
                    { icon: Phone, label: "Phone", value: selectedCase.phone },
                    { icon: Calendar, label: "Assigned By", value: selectedCase.assignedBy },
                    { icon: AlertTriangle, label: "Anomaly Type", value: selectedCase.anomalyType },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                      <item.icon className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{item.label}</p>
                        <p className="text-sm font-medium text-slate-900 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {selectedCase && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-6 shadow-lg text-white"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Navigation className="h-6 w-6" />
                  <h2 className="text-lg font-semibold">GPS Location</h2>
                </div>
                <p className="text-blue-200 text-sm mb-4">
                  Beneficiary registered location
                </p>
                <div className="p-4 rounded-xl bg-blue-800/50 font-mono text-sm space-y-1">
                  <p>Lat: {selectedCase.latitude}</p>
                  <p>Lng: {selectedCase.longitude}</p>
                </div>
                <a 
                  href={`https://www.google.com/maps?q=${selectedCase.latitude},${selectedCase.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </motion.div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-lg ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Today&apos;s Summary</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-700 uppercase">Completed Today</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.completed}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                  <p className="text-xs font-bold text-orange-700 uppercase">Pending Visits</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">{stats.pending}</p>
                </div>
                {stats.pending > 0 && (
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000" 
                      style={{ width: `${stats.assigned > 0 ? (stats.completed / stats.assigned) * 100 : 0}%` }} 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-6 text-center text-xs text-slate-400 md:px-0">
        © {new Date().getFullYear()} DBT Guard - Gujarat Leakage Detection System
      </footer>
    </div>
  );
}