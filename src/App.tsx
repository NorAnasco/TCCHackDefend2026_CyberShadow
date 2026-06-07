import React, { useState, useEffect } from "react";
import { 
  Database,
  ShieldAlert, 
  LayoutDashboard, 
  Rss, 
  Settings, 
  Search, 
  FileText, 
  AlertTriangle,
  Server,
  Terminal,
  Cpu,
  RefreshCw,
  LogOut,
  MapPin,
  X,
  Menu,
  KeyRound,
  Users,
  Lock,
  Shield
} from "lucide-react";
import DashboardTab from "./components/DashboardTab";
import ThreatIntelTab from "./components/ThreatIntelTab";
import DeploymentTab from "./components/DeploymentTab";
import ForensicsTab from "./components/ForensicsTab";
import AdminsTab from "./components/AdminsTab";
import SignaturesTab from "./components/SignaturesTab";
import AgentSupervisionTab from "./components/AgentSupervisionTab";
import { Threat, Campaign, MobileAgent, SyncConfig, ScrapedArticle, ForensicsData, MobileSignal } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "intel" | "deployment" | "forensics" | "admins" | "signatures" | "agent_supervision">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authenticated administration session states
  const [currentAdmin, setCurrentAdmin] = useState<{ username: string; role: string } | null>(() => {
    try {
      const saved = localStorage.getItem("kelashield_admin_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Login form inputs
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // States
  const [threats, setThreats] = useState<Threat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<MobileAgent[]>([]);
  const [mobileSignals, setMobileSignals] = useState<MobileSignal[]>([]);
  const [config, setConfig] = useState<SyncConfig>({
    defaultSyncIntervalDays: 14,
    lastFlashUpdateAt: null,
    flashUpdateStatus: "Idle"
  });
  const [scrapedArticles, setScrapedArticles] = useState<ScrapedArticle[]>([]);
  const [deletedArticleIds, setDeletedArticleIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("kelashield_deleted_articles");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [forensicsData, setForensicsData] = useState<ForensicsData | null>(null);

  // Loading indicator states
  const [loadingData, setLoadingData] = useState(true);
  const [fetchingFeed, setFetchingFeed] = useState(false);

  // Fetch all endpoints
  const fetchAllData = async (silent = false) => {
    if (!silent) setLoadingData(true);
    try {
      // 1. Fetch Threats
      const threatRes = await fetch("/api/threats");
      if (threatRes.ok) {
        const threatObj = await threatRes.json();
        if (threatObj && threatObj.success) setThreats(threatObj.data);
      }

      // 2. Fetch Campaigns
      const campaignRes = await fetch("/api/campaigns");
      if (campaignRes.ok) {
        const campaignObj = await campaignRes.json();
        if (campaignObj && campaignObj.success) setCampaigns(campaignObj.data);
      }

      // 3. Fetch Mobile Agents
      const agentRes = await fetch("/api/agents");
      if (agentRes.ok) {
        const agentObj = await agentRes.json();
        if (agentObj && agentObj.success) setAgents(agentObj.data);
      }

      // 4. Fetch Sync Config
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const configObj = await configRes.json();
        if (configObj && configObj.success) setConfig(configObj.data);
      }

      // 5. Fetch Forensics
      const forensicsRes = await fetch("/api/forensics/data");
      if (forensicsRes.ok) {
        const forensicsObj = await forensicsRes.json();
        if (forensicsObj && forensicsObj.success) setForensicsData(forensicsObj.analytics);
      }

      // 6. Fetch Feed articles (We fetch on load dynamically)
      const feedRes = await fetch("/api/threats/scrape-feeds");
      if (feedRes.ok) {
        const feedObj = await feedRes.json();
        if (feedObj && feedObj.success) setScrapedArticles(feedObj.data);
      }

      // 7. Fetch Mobile Signals
      const sigRes = await fetch("/api/signals");
      if (sigRes.ok) {
        const sigObj = await sigRes.json();
        if (sigObj && sigObj.success) setMobileSignals(sigObj.data);
      }

    } catch (e: any) {
      console.warn("Central Kéfyl server synchronization status: Under initialization or temporarily offline.", e?.message || e);
    } finally {
      if (!silent) setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Auto polling every 12 seconds to mock live mobile sync events
    const timer = setInterval(() => {
      fetchAllData(true);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Reset the database to absolute zero state
  const handleResetToZero = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir vider TOUTES les données (menaces, agents, campagnes) ?")) {
      return;
    }
    setLoadingData(true);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const resData = await response.json();
      if (resData.success) {
        alert(resData.message);
        fetchAllData(false);
      }
    } catch (e) {
      console.error("Failed to reset database", e);
    } finally {
      setLoadingData(false);
    }
  };

  // Recharge Togo-specific mocks
  const handleLoadDemodata = async () => {
    setLoadingData(true);
    try {
      const response = await fetch("/api/load-mocks", { method: "POST" });
      const resData = await response.json();
      if (resData.success) {
        alert(resData.message);
        fetchAllData(false);
      }
    } catch (e) {
      console.error("Failed to load demo data", e);
    } finally {
      setLoadingData(false);
    }
  };

  // API Call: Quick Add Threat
  const handleQuickAddThreat = async (type: "domain" | "ip" | "email" | "phone", value: string, severity = "Medium", details = "") => {
    try {
      const response = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value,
          severity,
          details,
          location: "Lomé",
          status: "active"
        })
      });
      const data = await response.json();
      if (data.success) {
        fetchAllData(true);
      }
    } catch (e) {
      console.error("Failed to add signature", e);
    }
  };

  // API Call: Update sync delayed interval
  const handleUpdateSyncDays = async (days: number) => {
    try {
      const response = await fetch("/api/config/interval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days })
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // API Call: Emergency FLASH UPDATE trigger broadcast
  const handleTriggerFlashUpdate = async () => {
    try {
      const response = await fetch("/api/agents/flash-update", {
        method: "POST"
      });
      const data = await response.json();
      if (data.success) {
        fetchAllData(true);
        return data;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // API Call: Threat intelligence AI analyzer processing (cert.tg / ancy feeds)
  const handleAIAnalyzeArticle = async (articleId: string) => {
    try {
      const response = await fetch("/api/threats/process-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId })
      });
      const data = await response.json();
      if (data.success) {
        // Update local article instance state with analyzed keys
        setScrapedArticles(prev => 
          prev.map(art => art.id === articleId ? data.data : art)
        );
        return data.data;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // API Call: Sandbox Threat registration
  const handleSandboxThreatAdd = async (payload: {
    type: "domain" | "ip" | "email" | "phone";
    value: string;
    severity: "Low" | "Medium" | "Critical";
    location: string;
    details: string;
    addImmediate: boolean;
  }) => {
    try {
      const response = await fetch("/api/sandbox/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        fetchAllData(true);
      }
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // Administrator login and logout handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Tous les champs sont requis.");
      return;
    }
    setLoginLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim().toUpperCase(),
          password: loginPassword.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        const session = { username: data.admin.username, role: data.admin.role };
        setCurrentAdmin(session);
        localStorage.setItem("kelashield_admin_session", JSON.stringify(session));
        setLoginUsername("");
        setLoginPassword("");
      } else {
        setLoginError(data.error || "Identifiants d'administration incorrects.");
      }
    } catch (err) {
      setLoginError("Erreur réseau: Impossible de joindre le serveur SOC PHISHING TG.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentAdmin(null);
    localStorage.removeItem("kelashield_admin_session");
    setActiveTab("dashboard");
  };

  const handleDeleteArticle = (id: string) => {
    setDeletedArticleIds(prev => {
      const updated = [...prev, id];
      localStorage.setItem("kelashield_deleted_articles", JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetDeletedArticles = () => {
    setDeletedArticleIds([]);
    localStorage.removeItem("kelashield_deleted_articles");
  };

  // Trigger manual scrap scan refresh
  const triggerScrapeRefresh = async () => {
    setFetchingFeed(true);
    try {
      const response = await fetch("/api/threats/scrape-feeds");
      const obj = await response.json();
      if (obj.success) {
        setScrapedArticles(obj.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingFeed(false);
    }
  };

  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#051026] via-[#09224E] to-[#010612] text-[#E5E7EB] flex items-center justify-center font-sans overflow-x-hidden relative p-4 login-wrapper">
        {/* Subtle dot pattern grid matching Palo Alto Dashboard */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
        
        {/* Crisp professional accent highlights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0F1E3D]/75 border border-white/10 rounded-2xl shadow-2xl p-8 backdrop-blur-md relative z-10 login-panel">
          <div className="text-center mb-8">
            {/* Custom high-tech logo similar to DriveNets custom emblem cuts representing safe streaming */}
            <div className="flex justify-center mb-4">
              <div className="relative flex flex-col items-center">
                <div className="absolute w-24 h-24 bg-[#06B6D4]/20 rounded-full blur-2xl animate-pulse"></div>
                <svg className="w-28 h-14 relative z-10" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Left part of capsule: Cyan */}
                  <path d="M48 10 H32 C20 10 20 40 32 40 H48" stroke="#06B6D4" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Right part of capsule: White */}
                  <path d="M52 10 H68 C80 10 80 40 68 40 H52" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  
                  {/* S in Cyan */}
                  <text x="28" y="31" fill="#06B6D4" fontSize="16" fontWeight="900" fontFamily="sans-serif" letterSpacing="0">S</text>
                  {/* P in White */}
                  <text x="50" y="31" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="sans-serif" letterSpacing="0">P</text>
                </svg>
              </div>
            </div>
            <strong className="text-white text-xl font-bold tracking-widest block uppercase font-display">
              <span className="text-[#06B6D4]">SP</span> SENTINEL
            </strong>
            <span className="text-[10px] text-[#94A3B8] font-mono tracking-widest uppercase block mt-1.5">PORTAIL NATIONAL DE SÉCURITÉ CONTRÔLE ET SUPERVISION</span>
          </div>

          {loginError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs font-mono mb-6 flex items-start gap-2.5 animate-fade-in font-sans">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 font-sans text-xs">
            <div>
              <label className="text-[#94A3B8] block mb-1.5 font-bold tracking-wider uppercase text-[10px]">IDENTIFIANT OPÉRATEUR :</label>
              <div className="relative">
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="NOM D'ACCÈS (EX: ANANIVI)"
                  className="w-full bg-[#050D1C]/80 border border-white/10 rounded-xl py-3 px-4 pl-10 text-slate-100 placeholder-slate-600 font-bold focus:outline-none focus:border-[#2563EB] transition uppercase tracking-wider font-mono text-xs"
                  required
                />
                <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="text-[#94A3B8] block mb-1.5 font-bold tracking-wider uppercase text-[10px]">CLÉ SÉCURISÉE :</label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#050D1C]/80 border border-white/10 rounded-xl py-3 px-4 pl-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#2563EB] transition tracking-widest font-mono text-xs"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#2563EB] hover:bg-[#2563EB]/90 active:scale-[0.99] text-white font-extrabold rounded-xl transition-all shadow-md font-mono text-xs flex items-center justify-center gap-2 mt-2 uppercase tracking-widest cursor-pointer"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                "AUTHENTIFICATION CONSOLE"
              )}
            </button>
          </form>

          {/* Directives and hints */}
          <div className="mt-8 pt-6 border-t border-white/5 text-[10px] font-mono text-slate-500 text-center space-y-2">
            <div>
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Membres d'Accès :</span>
              <span className="text-[#94A3B8] block font-semibold">RADJI &bull; ANANIVI &bull; EHE &bull; KPETO</span>
            </div>
            <div>
              <span className="text-slate-500 block">Identifiants standard : <strong className="text-slate-400">ANANIVI</strong>, <strong className="text-slate-400">RADJI</strong>, etc.</span>
              <span className="bg-[#050D1C]/60 px-2 py-0.5 mt-1 rounded border border-white/5 text-[#94A3B8] inline-block font-sans">Mot de passe initial : admin12345</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E5E7EB] flex font-sans overflow-x-hidden relative">
      
      {/* Subtle modern background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>

      {/* Sidebar background overlay backdrop for mobile click-off */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR NAVIGATION BAR (Ultra-structured Cyber Drawer) --- */}
      <aside className={`fixed inset-y-0 left-0 bg-[#121A2F] border-r border-white/5 w-64 z-40 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 flex flex-col justify-between shadow-lg`}>
        
        <div>
          {/* Brand/Logo Section (SP SENTINEL) */}
          <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between bg-[#040B1D]">
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 relative">
                <svg className="w-10 h-7 relative z-10" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Left part of capsule: Cyan */}
                  <path d="M48 10 H32 C20 10 20 40 32 40 H48" stroke="#06B6D4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Right part of capsule: White */}
                  <path d="M52 10 H68 C80 10 80 40 68 40 H52" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  
                  {/* S in Cyan */}
                  <text x="28" y="32" fill="#06B6D4" fontSize="16" fontWeight="900" fontFamily="sans-serif" letterSpacing="0">S</text>
                  {/* P in White */}
                  <text x="50" y="32" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="sans-serif" letterSpacing="0">P</text>
                </svg>
              </div>
              <div>
                <strong className="text-white font-bold tracking-wider text-xs block font-display">
                  <span className="text-[#06B6D4]">SP</span> SENTINEL
                </strong>
                <span className="text-[8px] text-[#0ea5e9] font-mono tracking-widest uppercase block font-semibold">SOC &amp; SUPERVISION</span>
              </div>
            </div>

            {/* Close button for Mobile drawers */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-[#1A2542] rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav menu links with elegant grouped structure */}
          <nav className="p-4 space-y-4 font-mono text-xs">
            
            {/* Group 1: Surveillance & Supervision */}
            <div className="space-y-1">
              <div className="px-3 py-1 text-[8px] font-bold text-[#94A3B8]/60 uppercase tracking-widest">
                Surveillance Active
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => { setActiveTab("dashboard"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "dashboard" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <LayoutDashboard className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span>DASHBOARD GLOBAL</span>
                </button>

                <button
                  onClick={() => { setActiveTab("agent_supervision"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "agent_supervision" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <Server className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  <span>SUPERVISION AGENTS</span>
                </button>
              </div>
            </div>

            {/* Group 2: Analyse Intel */}
            <div className="space-y-1">
              <div className="px-3 py-1 text-[8px] font-bold text-[#94A3B8]/60 uppercase tracking-widest">
                Analyse &amp; Menaces
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => { setActiveTab("intel"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "intel" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <Rss className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  <span>THREAT INTEL (IA)</span>
                </button>

                <button
                  onClick={() => { setActiveTab("signatures"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "signatures" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <Database className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  <span>BASE DE SIGNATURES</span>
                </button>
              </div>
            </div>

            {/* Group 3: Enquêtes Judiciaires */}
            <div className="space-y-1">
              <div className="px-3 py-1 text-[8px] font-bold text-[#94A3B8]/60 uppercase tracking-widest">
                Enquêtes &amp; Réponses
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => { setActiveTab("forensics"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "forensics" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <FileText className="w-4 h-4 text-[#EF4444] shrink-0" />
                  <span>ENQUÊTE JUDICIAIRE</span>
                </button>
              </div>
            </div>

            {/* Group 4: Administration du SOC */}
            <div className="space-y-1">
              <div className="px-3 py-1 text-[8px] font-bold text-[#94A3B8]/60 uppercase tracking-widest">
                Configuration du SOC
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => { setActiveTab("deployment"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "deployment" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <Settings className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  <span>FLUX DE SYNCHRO AGENTS</span>
                </button>

                <button
                  onClick={() => { setActiveTab("admins"); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold border ${activeTab === "admins" ? "bg-[#1A2542] border-white/5 text-white shadow-sm" : "border-transparent text-[#94A3B8] hover:bg-[#1A2542] hover:text-white"}`}
                >
                  <KeyRound className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span>CONTRÔLE DES ACCÈS</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition font-semibold text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-rose-400 border border-transparent hover:border-[#EF4444]/25 mt-6 cursor-pointer"
              title="Déconnecter la session centrale de surveillance"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>DÉCONNEXION</span>
            </button>

          </nav>
        </div>

        {/* Footer Brand Info with author credits */}
        <div className="p-4 border-t border-white/5 bg-[#0B1020]/20 text-[10px] font-mono text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Server className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Serveur: Lomé Central (TG)</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block mt-1 uppercase text-[8px] tracking-wider">Auteurs du SOC (SP) :</span>
            <span className="text-slate-300 block font-semibold text-[10px]">RADJI, ANANIVI, EHE, KPETO</span>
          </div>
          <div className="text-[9px] pt-1.5 border-t border-white/5 text-[#3B82F6]">
            SOC PHISHING TOGO &bull; Cyberdéfense
          </div>
        </div>

      </aside>

      {/* --- MAIN WORKSPACE INTERFACE --- */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen relative">
        
        {/* Central TOP NAVIGATION Header */}
        <header className="px-6 py-4 bg-[#121A2F]/45 border-b border-white/5 sticky top-0 backdrop-blur-md flex items-center justify-between z-30">
          
          <div className="flex items-center gap-3">
            {/* Burger toggle for smaller screens */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white bg-[#121A2F] border border-white/5 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-mono bg-[#3B82F6]/10 text-[#3B82F6] font-semibold tracking-wider border border-white/5 uppercase">
              REPUBLIQUE DU TOGO &bull; SP CONSOLE
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-mono">
            {/* Realtime threat alert banner indicator */}
            <div className="hidden lg:flex items-center gap-2 bg-[#121A2F] px-3 py-1.5 rounded-lg border border-white/5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <span className="text-[#94A3B8]">Moteur Threat Intel:</span>
              <span className="text-white font-bold">ACTIF</span>
            </div>

            {/* Reset to absolute Zero data */}
            <button
              onClick={handleResetToZero}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/15 rounded-lg transition font-medium cursor-pointer"
              title="Vider la base de données SOC pour des tests propres (à Zéro)"
            >
              Réinitialiser à Zéro
            </button>

            <button 
              onClick={() => fetchAllData()}
              disabled={loadingData}
              className="p-2 bg-[#121A2F] hover:bg-[#1A2542] text-slate-300 hover:text-white border border-white/5 rounded-lg transition cursor-pointer"
              title="Rafraîchir les données de la base"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
            </button>
          </div>

        </header>

        {/* --- DYNAMIC BODY VIEWS CONTAINER --- */}
        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
          
          {loadingData ? (
            // Big Beautiful loading status
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
              <div className="text-center">
                <h4 className="text-xs font-mono uppercase tracking-widest text-indigo-400">LIAISON SOC CRITIQUE ACTIVÉE</h4>
                <p className="text-xs text-slate-500 font-mono mt-1">Récupération des indicateurs, des géolocalisations et des rapports d&apos;enquêtes...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <DashboardTab 
                  threats={threats} 
                  agents={agents} 
                  onQuickAddThreat={handleQuickAddThreat}
                  onResetToZero={handleResetToZero}
                  onLoadDemoData={handleLoadDemodata}
                  currentUsername={currentAdmin.username}
                />
              )}

              {activeTab === "agent_supervision" && (
                <AgentSupervisionTab 
                  threats={threats}
                  agents={agents}
                  mobileSignals={mobileSignals}
                  onTriggerFlashUpdate={handleTriggerFlashUpdate}
                  onRefreshData={() => fetchAllData(true)}
                />
              )}

              {activeTab === "intel" && (
                <ThreatIntelTab 
                  scrapedArticles={scrapedArticles.filter(art => !deletedArticleIds.includes(art.id))}
                  fetchingFeed={fetchingFeed}
                  onRefreshFeeds={triggerScrapeRefresh}
                  onAIAnalyzeArticle={handleAIAnalyzeArticle}
                  onAddIoCToDatabase={handleQuickAddThreat}
                  onDeleteArticle={handleDeleteArticle}
                  totalDeletedCount={deletedArticleIds.length}
                  onResetDeleted={handleResetDeletedArticles}
                />
              )}

              {activeTab === "deployment" && (
                <DeploymentTab 
                  agents={agents} 
                  config={config} 
                  onUpdateSyncDays={handleUpdateSyncDays} 
                  onTriggerFlashUpdate={handleTriggerFlashUpdate}
                  onRefreshData={() => fetchAllData(true)}
                />
              )}

              {activeTab === "forensics" && (
                <ForensicsTab 
                  forensicsData={forensicsData} 
                  threats={threats} 
                  campaigns={campaigns}
                  agents={agents} 
                  mobileSignals={mobileSignals}
                  onRefreshData={() => fetchAllData(true)}
                />
              )}

              {activeTab === "admins" && (
                <AdminsTab 
                  currentUsername={currentAdmin.username} 
                  onRefreshData={() => fetchAllData(true)}
                />
              )}

              {activeTab === "signatures" && (
                <SignaturesTab 
                  threats={threats} 
                  onRefreshData={() => fetchAllData(true)}
                />
              )}
            </>
          )}

        </div>

        {/* Outer Global CSS/JS style print configurations so the generated PDF report renders exactly right when window.print() is called */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-area, .printable-area * {
              visibility: visible;
            }
            .printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}} />

      </main>
    </div>
  );
}
