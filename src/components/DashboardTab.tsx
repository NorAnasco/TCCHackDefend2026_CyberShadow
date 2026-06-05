import React, { useState, useMemo, useEffect } from "react";
import { 
  Shield, 
  Activity, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  TrendingUp,
  Server,
  Fingerprint,
  RefreshCw,
  Search,
  Database,
  BookOpen,
  MapPin,
  Flame,
  Globe,
  Settings,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from "recharts";
import { Threat, MobileAgent } from "../types";

interface Props {
  threats: Threat[];
  agents: MobileAgent[];
  onQuickAddThreat: (type: "domain" | "ip" | "email" | "phone", value: string) => void;
  onResetToZero?: () => Promise<void>;
  onLoadDemoData?: () => Promise<void>;
  currentUsername: string;
}

export default function DashboardTab({ 
  threats, 
  agents, 
  onQuickAddThreat,
  onResetToZero,
  onLoadDemoData,
  currentUsername
}: Props) {
  // Chart & Filter stats
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(["Low", "Medium", "Critical"]);

  // Real-time Togo Network Clock (GMT+0, Greenwich Mean Time timezone)
  const [togoClock, setTogoClock] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const gmtDate = new Date();
      // Togo is in GMT / UTC+0, so hours, minutes, seconds match UTC exactly
      const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const dayName = days[gmtDate.getUTCDay()];
      const day = String(gmtDate.getUTCDate()).padStart(2, "0");
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      const monthName = months[gmtDate.getUTCMonth()];
      const year = gmtDate.getUTCFullYear();
      
      const hours = String(gmtDate.getUTCHours()).padStart(2, "0");
      const minutes = String(gmtDate.getUTCMinutes()).padStart(2, "0");
      const seconds = String(gmtDate.getUTCSeconds()).padStart(2, "0");
      
      setTogoClock(`${dayName} ${day} ${monthName} ${year} • ${hours}:${minutes}:${seconds} GMT`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Server health metrics - Initializes to absolute zero when there are no connected agents or threats
  const systemMetrics = useMemo(() => {
    const hasLiveActivity = agents.length > 0;
    
    if (!hasLiveActivity) {
      return {
        cpu: "0.0%",
        ram: "0.0 GB / 4.0 GB",
        uptime: "0m (Base Vide)",
        engineStatus: "Inactif",
        latency: "0ms",
        statusColor: "bg-slate-500 text-slate-400 border-slate-700/60"
      };
    }

    // Dynamic but realistic performance indexing showing CPU/Latency fluctuation when simulated devices are connected
    const baseCpu = 12.4 + (threats.length * 0.4);
    const cpuValue = Math.min(95, baseCpu).toFixed(1);
    const calculatedLatency = Math.min(180, 24 + Math.floor(Math.sin(Date.now() / 15000) * 8));
    
    return {
      cpu: `${cpuValue}%`,
      ram: "2.1 GB / 4.0 GB",
      uptime: "12h 44m",
      engineStatus: "Opérationnel",
      latency: `~${calculatedLatency}ms`,
      statusColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    };
  }, [agents, threats]);

  // Format chart data dynamically, ensuring empty baselines when the database is initialized to zero
  const chartData = useMemo(() => {
    const grouped: Record<string, { date: string; Low: number; Medium: number; Critical: number; Total: number }> = {};
    
    // Fallback static days to ensure visual graphs render beautifully
    const baseDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    baseDays.forEach(day => {
      const formatted = day.split("-").slice(1).join("/"); // e.g. "05/22"
      grouped[day] = { date: formatted, Low: 0, Medium: 0, Critical: 0, Total: 0 };
    });

    if (threats.length > 0) {
      threats.forEach(t => {
        const dayRaw = t.detectedAt.split("T")[0];
        if (!grouped[dayRaw]) {
          const formatted = dayRaw.split("-").slice(1).join("/");
          grouped[dayRaw] = { date: formatted, Low: 0, Medium: 0, Critical: 0, Total: 0 };
        }
        
        const sev = t.severity;
        if (selectedSeverities.includes(sev)) {
          grouped[dayRaw][sev] += 1;
          grouped[dayRaw].Total += 1;
        }
      });
    } else {
      // If zero threats, force zero levels
      baseDays.forEach(day => {
        grouped[day] = { date: day.split("-").slice(1).join("/"), Low: 0, Medium: 0, Critical: 0, Total: 0 };
      });
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [threats, selectedSeverities]);

  const severityCounts = useMemo(() => {
    return {
      total: threats.length,
      critical: threats.filter(t => t.severity === "Critical").length,
      medium: threats.filter(t => t.severity === "Medium").length,
      low: threats.filter(t => t.severity === "Low").length,
    };
  }, [threats]);

  // Abstract Togo vector map plotting
  const mapHotspots = useMemo(() => {
    if (agents.length === 0) return [];
    
    // Mapping agents dynamically to Togo's geographic coordinate points
    const points: Record<string, { lat: number; lng: number; color: string }> = {
      "Lomé": { lat: 310, lng: 120, color: "stroke-emerald-400 bg-emerald-500" },
      "Aného": { lat: 300, lng: 145, color: "stroke-emerald-400 bg-emerald-500" },
      "Kpalimé": { lat: 240, lng: 95, color: "stroke-emerald-400 bg-emerald-500" },
      "Atakpamé": { lat: 195, lng: 115, color: "stroke-emerald-400 bg-emerald-500" },
      "Sokodé": { lat: 130, lng: 110, color: "stroke-teal-400 bg-teal-500" },
      "Kara": { lat: 80, lng: 135, color: "stroke-emerald-400 bg-emerald-500" },
      "Cinkassé": { lat: 20, lng: 105, color: "stroke-amber-400 bg-amber-500" },
    };

    return agents.map(agent => {
      const loc = points[agent.city] || { lat: 310, lng: 120, color: "stroke-slate-400 bg-slate-500" };
      return {
        name: agent.name,
        city: agent.city,
        lat: loc.lat,
        lng: loc.lng,
        color: loc.color,
        status: agent.status
      };
    });
  }, [agents]);

  const handleSeverityToggle = (sev: string) => {
    setSelectedSeverities(prev => 
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Premium DriveNets-inspired Royal Blue Cyber Hero Banner */}
      <div className="relative bg-gradient-to-r from-[#0F296D] via-[#1C4ED8] to-[#0D1F4D] border border-blue-500/20 shadow-xl rounded-2xl p-6 md:p-8 text-white overflow-hidden select-none">
        {/* Subtle decorative security grid background inside hero */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-400/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Vector custom vertical glowing bars representing network stream intelligence - DIRECTLY matches the DriveNets design */}
        <div className="absolute right-0 bottom-0 top-0 w-2/5 hidden md:flex items-end justify-between px-10 pb-0 opacity-90 select-none pointer-events-none gap-2">
          <div className="w-4 bg-gradient-to-t from-[#2563EB]/40 to-[#06B6D4] rounded-t-md animate-pulse" style={{ height: '35%', animationDuration: '3s' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#2563EB]/50 to-white rounded-t-md animate-pulse" style={{ height: '60%', animationDuration: '4.5s' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#2563EB] to-[#06B6D4] rounded-t-md" style={{ height: '85%' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#2563EB]/30 to-white rounded-t-md animate-pulse" style={{ height: '45%', animationDuration: '3.5s' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#06B6D4] to-white rounded-t-md" style={{ height: '95%' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#2563EB]/60 to-[#06B6D4] rounded-t-md animate-pulse" style={{ height: '70%', animationDuration: '5s' }}></div>
          <div className="w-4 bg-gradient-to-t from-[#2563EB]/40 to-white rounded-t-md" style={{ height: '50%' }}></div>
        </div>

        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping"></span>
            SP SENTINEL NETWORK COGNITIVE
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
            Supervision Bivalente &amp; Renseignements Cyber en Temps Réel
          </h1>
          <p className="text-sm text-blue-100 font-sans leading-relaxed max-w-lg opacity-90">
            Plateforme souveraine d'échange de signatures de menaces (COI) et de détection automatique d'ingénierie sociale par modèle IA cognitif pour la République du Togo.
          </p>
        </div>
      </div>

      {/* 0. Real-time synchronised TOGO Network Time zone bar */}
      <div className="bg-[#121A2F] border border-white/5 rounded-xl px-5 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#3B82F6] animate-pulse" />
          <span className="text-xs font-mono font-bold text-[#E5E7EB] uppercase tracking-widest">
            SYNCHRONISATION RENSEIGNEMENT TOGO (GMT NETWORK)
          </span>
        </div>
        
        <div className="text-xs font-mono font-bold text-white bg-[#0B1020]/45 border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
          {togoClock || "Synchronisation..."}
        </div>
      </div>

      {/* 1. Header Admin Profile & System health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Admin Card */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between shadow-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold">SOC NATIONAL</h2>
                <h1 className="text-base font-extrabold text-white tracking-tight">{currentUsername}</h1>
              </div>
            </div>
            
            <p className="mt-4 text-xs text-[#E5E7EB] font-mono flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${agents.length > 0 ? "bg-[#10B981] animate-pulse" : "bg-slate-500"}`}></span>
              Rôle: Administrateur Cyber-Menaces
            </p>
            <p className="text-[11px] text-[#06B6D4] font-mono mt-1">
              Région de Supervision: Centrale / Lomé
            </p>
          </div>

          {/* SECURITY LEVEL AND COMPLIANCE INDICATOR */}
          <div className="pt-4 border-t border-white/5 mt-6 font-mono text-[10px] text-[#94A3B8] space-y-1">
            <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">STATUT DE SÉCURITÉ :</span>
            <p className="leading-normal">
              Opérateur habilité. Terminal SOC chiffré. Renseignements soumis aux exigences de la réglementation nationale ANCY / CERT.TG.
            </p>
          </div>
        </div>

        {/* Server Health Status */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 relative overflow-hidden lg:col-span-2 shadow-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[#E5E7EB] tracking-wider font-mono flex items-center gap-2 uppercase">
              <Server className="w-4 h-4 text-[#10B981]" />
              CONTRÔLE DE SÉCURITÉ CONSOLE CENTRAL
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${systemMetrics.statusColor}`}>
              {systemMetrics.engineStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#0B1020]/45 p-3 rounded-lg border border-white/5">
              <span className="text-[#94A3B8] text-[9px] font-mono block">CPU UTILISATION</span>
              <span className="text-base font-bold text-white font-mono">{systemMetrics.cpu}</span>
              <div className="w-full bg-[#1A2542] h-1 mt-2 rounded overflow-hidden">
                <div className={`h-full rounded transition-all duration-500 ${agents.length > 0 ? "bg-[#10B981]" : "bg-[#1A2542]"}`} style={{ width: systemMetrics.cpu }}></div>
              </div>
            </div>

            <div className="bg-[#0B1020]/45 p-3 rounded-lg border border-white/5">
              <span className="text-[#94A3B8] text-[9px] font-mono block">ALLOCATION RAM</span>
              <span className="text-base font-bold text-[#06B6D4] font-mono">{systemMetrics.ram}</span>
              <div className="w-full bg-[#1A2542] h-1 mt-2 rounded overflow-hidden">
                <div className={`h-full rounded ${agents.length > 0 ? "bg-[#06B6D4]" : "bg-[#1A2542]"}`} style={{ width: agents.length > 0 ? "52%" : "0%" }}></div>
              </div>
            </div>

            <div className="bg-[#0B1020]/45 p-3 rounded-lg border border-white/5">
              <span className="text-[#94A3B8] text-[9px] font-mono block">MOTEUR GEMINI SOC IA</span>
              <span className="text-xs font-bold text-[#10B981] font-mono block truncate mt-1">gemini-3.5-flash</span>
              <span className="font-mono text-[9px] text-[#94A3B8]/60 block leading-tight">Passerelle API active</span>
            </div>

            <div className="bg-[#0B1020]/45 p-3 rounded-lg border border-white/5">
              <span className="text-[#94A3B8] text-[9px] font-mono block">TEMPS DE FONCTIONNEMENT</span>
              <span className="text-xs font-bold text-[#E5E7EB] font-mono pt-1 block truncate">{systemMetrics.uptime}</span>
              <span className="font-mono text-[9px] text-[#94A3B8]/60 leading-tight block">Synchro continue</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Key Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[9px] font-mono text-[#94A3B8] uppercase font-bold">MENACES REPERTORIEES</span>
            <h4 className="text-xl mt-1 font-bold text-white font-mono">{severityCounts.total}</h4>
          </div>
          <div className="p-2.5 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] border border-white/5">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[9px] font-mono text-[#94A3B8] uppercase font-bold">INSIGNES CRITIQUES</span>
            <h4 className="text-xl mt-1 font-bold text-[#EF4444] font-mono">{severityCounts.critical}</h4>
          </div>
          <div className="p-2.5 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-white/5">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[9px] font-mono text-[#94A3B8] uppercase font-bold">INTERCEPTEURS EN RESEAU</span>
            <h4 className="text-xl mt-1 font-bold text-[#10B981] font-mono">
              {agents.filter(a => a.status === "Online").length} <span className="text-xs text-slate-500 font-mono">/ {agents.length}</span>
            </h4>
          </div>
          <div className="p-2.5 rounded-lg bg-[#10B981]/10 text-[#10B981] border border-white/5">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-[9px] font-mono text-[#94A3B8] uppercase font-bold">LATENCE TRANSIT USSD/SMS</span>
            <h4 className="text-xl mt-1 font-bold text-[#3B82F6] font-mono">{systemMetrics.latency}</h4>
          </div>
          <div className="p-2.5 rounded-lg bg-[#3B82F6]/10 text-[#06B6D4] border border-white/5">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Interactive Chart (Full width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recharts interactive Phishing Chart (Full 12 columns) */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 flex flex-col justify-between lg:col-span-12 shadow-md">
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xs font-bold text-white tracking-wider flex items-center gap-2 font-mono uppercase">
                  <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
                  VISUALISATION CHRONOLOGIQUE DES COMPORTEMENTS DE FRAUDE
                </h3>
                <p className="text-xs text-[#94A3B8]">Courbe de débits des menaces synchronisées sur le territoire national.</p>
              </div>

              {/* Severity checkboxes */}
              <div className="flex items-center gap-3 bg-[#0B1020]/45 px-3 py-1.5 rounded-lg border border-white/5">
                <span className="text-[10px] font-mono text-[#94A3B8] flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filtrer:
                </span>
                
                <label className="flex items-center gap-1.5 text-[10px] text-[#EF4444] font-mono cursor-pointer font-bold uppercase">
                  <input 
                    type="checkbox" 
                    checked={selectedSeverities.includes("Critical")}
                    onChange={() => handleSeverityToggle("Critical")}
                    className="accent-red-500 rounded" 
                  />
                  Critique
                </label>

                <label className="flex items-center gap-1.5 text-[10px] text-[#F59E0B] font-mono cursor-pointer font-bold uppercase">
                  <input 
                    type="checkbox" 
                    checked={selectedSeverities.includes("Medium")}
                    onChange={() => handleSeverityToggle("Medium")}
                    className="accent-amber-500 rounded" 
                  />
                  Moyen
                </label>

                <label className="flex items-center gap-1.5 text-[10px] text-[#E5E7EB] font-mono cursor-pointer font-bold uppercase">
                  <input 
                    type="checkbox" 
                    checked={selectedSeverities.includes("Low")}
                    onChange={() => handleSeverityToggle("Low")}
                    className="accent-slate-400 rounded" 
                  />
                  Faible
                </label>
              </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -10, top: 10, right: 10 }}>
                  <defs>
                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 9, fontFamily: "monospace" }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 9, fontFamily: "monospace" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#121A2F", borderColor: "rgba(255,255,255,0.05)", color: "#E5E7EB" }}
                    labelStyle={{ fontFamily: "monospace", color: "#94A3B8" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                  {selectedSeverities.includes("Critical") && (
                    <Area type="monotone" dataKey="Critical" stroke="#EF4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCritical)" name="Critique" />
                  )}
                  {selectedSeverities.includes("Medium") && (
                    <Area type="monotone" dataKey="Medium" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMedium)" name="Moyen" />
                  )}
                  {selectedSeverities.includes("Low") && (
                    <Area type="monotone" dataKey="Low" stroke="#3B82F6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorLow)" name="Faible" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="text-[9px] text-slate-500 mt-4 border-t border-white/5 pt-3 flex justify-between items-center font-mono">
            <span>Graphique de détection national mis à jour en temps réel</span>
            <span>Heure de supervision: Lomé (GMT+0)</span>
          </div>
        </div>

      </div>

      {/* 5. MANUAL TECHNIQUE DE L&apos;UTILISATEUR ET DOCUMENTATION DES MODULES */}
      <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-md">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#3B82F6]" />
          <h3 className="text-xs font-bold text-white tracking-wider font-mono uppercase">
            MANUEL DE COMPRÉHENSION DES MODULES : SOC PHISHING TOGO
          </h3>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed font-sans max-w-4xl">
          Bienvenue sur la plateforme nationale de cybersécurité <strong>SOC PHISHING TOGO</strong>. Développée pour la résilience numérique du Togo de concert avec les autorités compétentes, cette console dynamique fusionne l&apos;intelligence artificielle (Gemini) et la synchronisation décentralisée avec des terminaux mobiles pour bloquer au plus près de l&apos;abonné les menaces d&apos;ingénierie sociale.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          
          <div className="bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-2">
            <span className="text-xs text-[#3B82F6] font-mono font-bold block flex items-center gap-1">
              <span>&bull;</span>
              Registre National
            </span>
            <p className="text-[11px] text-[#94A3B8] font-sans leading-normal">
              La base centrale du SOC stocke les indicateurs d&apos;attaques (IoC) ciblant les services togolais (CEET, OTR, CNSS, Moov Africa, Yas, UTB). En les marquant comme fraudes, l&apos;information est poussée vers tous les terminaux mobiles partenaires, les immunisant instantanément.
            </p>
          </div>

          <div className="bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-2">
            <span className="text-xs text-[#3B82F6] font-mono font-bold block flex items-center gap-1">
              <span>&bull;</span>
              Bac à Sable (Sandbox)
            </span>
            <p className="text-[11px] text-[#94A3B8] font-sans leading-normal">
              Ce module permet de tester des liens suspects saisis manuellement. L&apos;intelligence artificielle dissèque la structure de l&apos;URL, calcule la ressemblance (SSL, TLD, typographie) avec les marques authentiques du Togo, et formule une recommandation de blocage DNS/Mobile immédiate.
            </p>
          </div>

          <div className="bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-2">
            <span className="text-xs text-[#3B82F6] font-mono font-bold block flex items-center gap-1">
              <span>&bull;</span>
              Intercepteur Heuristique
            </span>
            <p className="text-[11px] text-[#94A3B8] font-sans leading-normal">
              Installés sur les téléphones, les agents captent les messages et alertes suspectes. À l&apos;aide d&apos;analyse sémantique et de règles de compromission, ils détectent les spams financiers, mais aussi les manipulations de grooming ciblant les mineurs et renvoient ces signatures au SOC.
            </p>
          </div>

          <div className="bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-2">
            <span className="text-xs text-[#3B82F6] font-mono font-bold block flex items-center gap-1">
              <span>&bull;</span>
              Rapports Forensiques
            </span>
            <p className="text-[11px] text-[#94A3B8] font-sans leading-normal">
              Cet onglet agrège les signatures d&apos;attaques redondantes sur plusieurs agents à Lomé ou à l&apos;intérieur du Togo. L&apos;algorithme de corrélation automatique matérialise cela sous forme de rapports PDF formels prêts pour le CERT.TG ou la cybercriminalité.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
