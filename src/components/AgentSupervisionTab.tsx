import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, 
  Server, 
  Activity, 
  TrendingUp, 
  Search, 
  Filter, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  CornerDownRight, 
  Cpu, 
  Send, 
  Radio, 
  Zap,
  Terminal,
  Clock,
  Smartphone,
  Shield,
  Bell,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Battery,
  AlertCircle,
  Info,
  Mail
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
} from "recharts";
import { MobileAgent, MobileSignal } from "../types";

interface Props {
  agents: MobileAgent[];
  mobileSignals: MobileSignal[];
  onTriggerFlashUpdate: () => Promise<any>;
  onRefreshData?: () => void;
}

export default function AgentSupervisionTab({ 
  agents, 
  mobileSignals, 
  onTriggerFlashUpdate,
  onRefreshData 
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Online" | "Offline">("All");
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashLogs, setFlashLogs] = useState<Array<{ time: string; text: string; type: "info" | "success" | "warn" }>>([]);

  // --- MOBILE SIMULATOR STATE ---
  const [simLocalBlockedCount, setSimLocalBlockedCount] = useState(() => {
    try {
      const stored = localStorage.getItem("sp_tg_sim_blocked_count");
      return stored ? parseInt(stored, 10) : 12;
    } catch {
      return 12;
    }
  });
  
  const [phoneState, setPhoneState] = useState<"dashboard" | "receiving" | "quarantine">("dashboard");
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customSender, setCustomSender] = useState("+228 99 12 04 85");
  const [customText, setCustomText] = useState("");
  const [activeMessageText, setActiveMessageText] = useState("");
  const [activeSender, setActiveSender] = useState("");
  const [isSimulatingApiCall, setIsSimulatingApiCall] = useState(false);
  
  // Local toggles
  const [isShieldActive, setIsShieldActive] = useState(true);
  const [showNotification, setShowNotification] = useState(false);

  // --- EXTRA SHIELD OPTIONS AGAINST FALSE POSITIVES ---
  const [isGroupSource, setIsGroupSource] = useState(false);
  const [groupName, setGroupName] = useState("Famille & Voisins Lomé 💬");
  const [threatSeverity, setThreatSeverity] = useState<"heuristic_mild" | "central_critical">("heuristic_mild");
  const [trustedGroups, setTrustedGroups] = useState<string[]>([]);
  const [whitelistedCheckNotification, setWhitelistedCheckNotification] = useState(false);

  const addLog = (text: string, type: "info" | "success" | "warn" = "info") => {
    const time = new Date().toLocaleTimeString("fr-FR");
    setFlashLogs(prev => [...prev, { time, text, type }]);
  };

  // Predefined Togolese Phishing SMS/WhatsApp cases
  const simTemplates = [
    {
      title: "📞 Arnaque Gains Moov Flooz",
      sender: "+228 99 12 04 85",
      text: "[Flooz] Félicitations! Votre numéro a été tiré au sort pour la promotion de la fête nationale. Vous gagnez la somme de 300.000 FCFA. Appelez vite le 99120485 pour débloquer votre versement.",
      category: "Tentative de vol d'argent (Flooz)",
      heuristics: "On vous promet beaucoup d'argent gratuit (300 000F) sans aucune raison pour vous pousser à appeler d'urgence un numéro inconnu. C'est un mensonge !"
    },
    {
      title: "⚡ Fausse Facture électricité CEET",
      sender: "+228 90 41 82 12",
      text: "CEET ALERTE: Facture non réglée. Votre électricité sera coupée sous 24 heures. Réglez d'urgence votre impayé sur: https://ceet-facturation-tmoney.com/",
      category: "Faux chantage à la coupure",
      heuristics: "On vous fait peur en vous menaçant de couper votre courant en 24h, et on vous donne un faux lien internet imitant la CEET pour voler votre compte T-Money."
    },
    {
      title: "🏫 Fausse Aide de l'État (Usurpation ANCY)",
      sender: "+228 92 11 34 56",
      text: "Recrutement urgent ANCY: Subvention d'État disponible pour les citoyens étudiants et entrepreneurs du Togo (50.000F/mois). Inscrivez-vous vite: http://ancy.gouv.tg-subvention.net",
      category: "Piège au faux recrutement",
      heuristics: "Les menteurs utilisent le nom rassurant de l'État (l'ANCY) pour vous proposer une aide financière, mais l'adresse du site internet finit bizarrement par '.net' au lieu de '.gouv.tg'."
    },
    {
      title: "💬 Vol de Compte WhatsApp",
      sender: "+228 97 88 55 22",
      text: "Salut, j'ai envoyé accidentellement un code d'activation SMS à 6 chiffres sur ton numéro par mégarde, s'il te plaît renvoie-le moi d'urgence pour me dépanner !",
      category: "Piratage de compte (Code secret)",
      heuristics: "Un pirate invente une fausse histoire d'erreur humaine pour vous inciter à lui donner votre code secret. Si vous lui donnez, il prendra le contrôle total de votre compte WhatsApp !"
    }
  ];

  // Sync state if template selection changes
  useEffect(() => {
    if (selectedTemplate !== -1 && simTemplates[selectedTemplate]) {
      setCustomSender(simTemplates[selectedTemplate].sender);
      setCustomText(simTemplates[selectedTemplate].text);
    }
  }, [selectedTemplate]);

  // Handle local counter store
  const incrementSimCounter = () => {
    setSimLocalBlockedCount(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem("sp_tg_sim_blocked_count", next.toString());
      } catch (e) {}
      return next;
    });
  };

  // Simulate receiving the SMS on SP_TG mobile
  const handleSimulateSMS = async () => {
    if (!customText.trim()) return;
    
    // Set message active on the virtual device
    setActiveSender(customSender || "+228 90 00 00 00");
    setActiveMessageText(customText);
    
    // Reset notification views
    setShowNotification(false);
    setWhitelistedCheckNotification(false);
    setPhoneState("dashboard");

    const isWhitelisted = trustedGroups.includes(groupName);

    if (isGroupSource) {
      if (isWhitelisted) {
        if (threatSeverity === "central_critical") {
          // Central signature bypasses the whitelist!
          setShowNotification(true);
          addLog(`DANGER DE MORT : Bien que le groupe "${groupName}" soit sur Liste Verte, le serveur national a sonné l'alarme : ce message précis contient un piège d'argent formellement identifié !`, "warn");
        } else {
          // Regular mild heuristic is completely ignored!
          setWhitelistedCheckNotification(true);
          addLog(`Garde-corps : Message suspect détecté dans le groupe de confiance "${groupName}". L'alerte a été AUTOMATIQUEMENT ÉVITÉE grâce à votre Liste Verte locale. Aucun dérangement !`, "success");
        }
      } else {
        // Group not whitelisted: alert to offer whitelist or report
        setShowNotification(true);
        addLog(`Alerte Groupe : Un de vos contacts dans le groupe "${groupName}" a partagé un message bizarre. Cliquez sur l'alerte pour choisir.`, "info");
      }
    } else {
      // Direct message (Unknown number)
      setShowNotification(true);
      if (threatSeverity === "central_critical") {
        addLog(`URGENCE : Un numéro inconnu (${customSender}) vous envoie une arnaque confirmée et blacklistée par Lomé central. C'est un piège absolu !`, "warn");
      } else {
        addLog(`Garde-corps : Un inconnu (${customSender}) vous a envoyé un message ressemblant à un piège d'argent.`, "info");
      }
    }
    
    // Play alert vibration effect via sound/CSS if possible
    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {}
  };

  const handleOpenAlertAndBlock = async () => {
    setShowNotification(false);
    setPhoneState("receiving");
    
    // Simulate short processing delay for NLP heuristic analysis on the device
    await new Promise(r => setTimeout(r, 800));
    
    if (isShieldActive) {
      setPhoneState("quarantine");

      // Only automatically submit and increment if not a mild group threat that needs choice!
      const isMildGroup = isGroupSource && threatSeverity === "heuristic_mild";
      
      if (!isMildGroup) {
        incrementSimCounter();
        
        // Phase 2: Transmit live telemetry packet to the Express server SOC (Real-time Integration!)
        setIsSimulatingApiCall(true);
        try {
          const response = await fetch("/api/v1/report", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-agent-code": "kfl-shield-simulation-device-token"
            },
            body: JSON.stringify({
              device_id: "SP-TG-SIMUL-PHONE",
              sender_phone: isGroupSource ? `[Groupe: ${groupName}] ${activeSender}` : activeSender,
              evidence_text: activeMessageText,
              location: "Lomé",
              meta_data: {
                detection_reason: threatSeverity === "central_critical" ? "CENTRAL_BLOCKLIST_MATCH" : "HEURISTIC_NLP_MATCH",
                simulated: true,
                timestamp_epoch: Date.now()
              }
            })
          });
          const resJson = await response.json();
          
          if (resJson.success) {
            addLog(`Alerte envoyée : Le message suspect a été bloqué et signalé directement au poste central !`, "success");
            if (onRefreshData) {
              onRefreshData(); // Trigger React refresh so the tables/graphs of the SOC update immediately!
            }
          }
        } catch (e) {
          console.error("Telemetry simulation error", e);
          addLog(`Simulation : Impossible d'envoyer l'alerte au poste central. Est-il connecté ?`, "warn");
        } finally {
          setIsSimulatingApiCall(false);
        }
      } else {
        addLog(`Garde-corps : Analyse d'un groupe en cours. Souhaitez-vous faire confiance à ce groupe pour arrêter les alertes de ce genre ?`, "info");
      }
    } else {
      setPhoneState("dashboard");
      addLog(`Danger : La protection du téléphone est coupée. Le message dangereux est arrivé sans être vérifié !`, "warn");
    }
  };

  const handleTrustGroup = () => {
    if (!trustedGroups.includes(groupName)) {
      setTrustedGroups(prev => [...prev, groupName]);
    }
    setPhoneState("dashboard");
    addLog(`Liste Verte : Vous avez ajouté le groupe "${groupName}" à votre liste verte locale. Les fausses alertes y sont désormais éteintes !`, "success");
  };

  const handleReportGroup = async () => {
    incrementSimCounter();
    setIsSimulatingApiCall(true);
    try {
      const response = await fetch("/api/v1/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-code": "kfl-shield-simulation-device-token"
        },
        body: JSON.stringify({
          device_id: "SP-TG-SIMUL-PHONE",
          sender_phone: `[Groupe: ${groupName}] ${activeSender}`,
          evidence_text: activeMessageText,
          location: "Lomé",
          meta_data: {
            detection_reason: "USER_GROUP_REPORTED",
            simulated: true,
            timestamp_epoch: Date.now()
          }
        })
      });
      const resJson = await response.json();
      if (resJson.success) {
        addLog(`Signalement Groupe : Le message suspect dans "${groupName}" a été bloqué et signalé directement au poste central !`, "success");
        if (onRefreshData) {
          onRefreshData();
        }
      }
    } catch (e) {
      console.error("Telemetry simulation error", e);
      addLog(`Simulation : Erreur de transmission du signalement au poste central.`, "warn");
    } finally {
      setIsSimulatingApiCall(false);
      setPhoneState("dashboard");
    }
  };

  // Filter agents list
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.ipAddress.includes(searchTerm);
      const matchesStatus = 
        statusFilter === "All" || 
        (statusFilter === "Online" && agent.status === "Online") ||
        (statusFilter === "Offline" && agent.status === "Offline");
      return matchesSearch && matchesStatus;
    });
  }, [agents, searchTerm, statusFilter]);

  // Counts
  const stats = useMemo(() => {
    const total = agents.length;
    const online = agents.filter(a => a.status === "Online").length;
    const offline = total - online;
    const totalSignals = mobileSignals.length;
    return { total, online, offline, totalSignals };
  }, [agents, mobileSignals]);

  // Curve data: Compute simulated daily incoming signals timeline
  const timelineData = useMemo(() => {
    const data: Record<string, { date: string; Signatures: number; ActiveAgents: number }> = {};
    
    const baseDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    baseDays.forEach(day => {
      const formatted = day.split("-").slice(1).join("/");
      data[day] = { 
        date: formatted, 
        Signatures: 0, 
        ActiveAgents: agents.filter(a => a.status === "Online").length 
      };
    });

    if (mobileSignals.length > 0) {
      mobileSignals.forEach(sig => {
        const dayRaw = sig.timestamp.split("T")[0];
        if (data[dayRaw]) {
          data[dayRaw].Signatures += 1;
        }
      });
    } else {
      baseDays.forEach((day, idx) => {
        data[day].Signatures = Math.floor(Math.sin((idx + 1) * 0.8) * 4) + 6;
      });
    }

    return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
  }, [mobileSignals, agents]);

  // Execute flashing sequence
  const handleFlashUpdateClick = async () => {
    if (isFlashing) return;
    setIsFlashing(true);
    setFlashLogs([]);
    addLog("Initiation de la mise à jour d'urgence (FLASH BROADCAST)", "info");
    
    try {
      addLog("Analyse du parc de terminaux disponibles...", "info");
      await new Promise(r => setTimeout(r, 1000));
      addLog(`Réseau centralisé prêt. Ciblage de ${stats.online} agents en ligne.`, "success");
      
      const res = await onTriggerFlashUpdate();
      await new Promise(r => setTimeout(r, 1000));
      addLog("Génération des payloads de signatures de blocage cryptées...", "info");
      await new Promise(r => setTimeout(r, 1200));
      addLog("Broadcast de l'alerte hertzienne achevée avec succès.", "success");
      addLog("Les terminaux de l'appli SP_TG mobile forcent la mise à jour hertzienne.", "success");
      
      if (onRefreshData) onRefreshData();
    } catch (e) {
      addLog("Erreur de synchronisation radio de la passerelle.", "warn");
    } finally {
      setIsFlashing(false);
    }
  };

  return (
    <div className="space-y-6 leading-relaxed">
      
      {/* 1. Header Grid Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#3B82F6] animate-pulse" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
              SUPERVISION ET CONFORMITÉ DE L&apos;APPLI MOBILE &laquo; SP_TG mobile &raquo;
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1 font-mono">
            Contrôlez l&apos;état global des boucliers citoyens, suivez les signatures activées et testez l&apos;intercepteur heuristique.
          </p>
        </div>
        
        {/* Real-time sync button */}
        <button
          onClick={handleFlashUpdateClick}
          disabled={isFlashing}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border transition duration-300 cursor-pointer ${isFlashing ? "bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/25" : "bg-[#3B82F6] hover:bg-[#3B82F6]/30 text-white border-transparent"}`}
        >
          <Zap className={`w-4 h-4 ${isFlashing ? "animate-spin" : ""}`} />
          {isFlashing ? "BROADCAST EN COURS..." : "DIFFUSION DE SÉCURITÉ EN DIRECT (FLASH)"}
        </button>
      </div>

      {/* 2. Visual Enterprise Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Agents */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 relative overflow-hidden group shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none transition duration-300"></div>
          <span className="text-[10px] font-mono font-bold text-[#94A3B8] block uppercase tracking-wider">Citoyens Enrôlés</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-white font-mono tracking-tight">{stats.total}</span>
            <span className="text-xs text-[#94A3B8] font-sans">mobiles actifs</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <Server className="w-3.5 h-3.5" />
            <span>Base synchronisée Lomé SP</span>
          </div>
        </div>

        {/* Online State */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 relative overflow-hidden group shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none transition duration-300"></div>
          <span className="text-[10px] font-mono font-bold text-[#10B981] block uppercase tracking-wider">Agents en écoute active</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-[#10B981] font-mono tracking-tight">{stats.online}</span>
            <span className="text-xs text-[#10B981]/80 font-mono">({stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%)</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-[#10B981]/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>Canaux radio connectés</span>
          </div>
        </div>

        {/* Offline State */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 relative overflow-hidden group shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider">En veille locale (sans Net)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-[#E5E7EB] font-mono tracking-tight">{stats.offline}</span>
            <span className="text-xs text-[#94A3B8] font-sans">protection locale OK</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            <span>Toujours protégés par l&apos;heuristique</span>
          </div>
        </div>

        {/* Received Signals count */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 relative overflow-hidden group shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none transition duration-300"></div>
          <span className="text-[10px] font-mono font-bold text-[#06B6D4] block uppercase tracking-wider">Incidents Bloqués à l&apos;échelle</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-[#06B6D4] font-mono tracking-tight">{stats.totalSignals}</span>
            <span className="text-xs text-[#06B6D4]/80 font-mono">alertes SOC</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-[#06B6D4]/80">
            <Activity className="w-3.5 h-3.5 text-[#06B6D4] animate-pulse" />
            <span>Moteur d&apos;analyse de Lomé en ligne</span>
          </div>
        </div>

      </div>

      {/* 3. MAIN WORKPLACE LAYOUT with integrated Live Mobile Simulator on the Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Realtime charts, terminal and directory list (Columns: 7/12) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Curve Visualization & Terminal Log Pair */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Courbe chronologique de flux
                </h4>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  Signatures d&apos;ingénierie active interceptées d&apos;urgence.
                </p>
              </div>
              <span className="text-[9px] font-mono text-[#06B6D4] font-bold uppercase py-0.5 px-2 bg-[#06B6D4]/10 border border-[#06B6D4]/25 rounded">
                Live Feed
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ left: -25, top: 10, right: 10 }}>
                  <defs>
                    <linearGradient id="colorSignatures" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 9, fontFamily: "monospace" }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 9, fontFamily: "monospace" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0B1226", borderColor: "rgba(59,130,246,0.2)", color: "#FFFFFF" }}
                    labelStyle={{ fontFamily: "monospace", color: "#64748b" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Signatures" 
                    stroke="#06B6D4" 
                    strokeWidth={1.5} 
                    fillOpacity={1} 
                    fill="url(#colorSignatures)" 
                    name="Alertes Bloquées" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Flash Logs Mini Terminal */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-white/5 pb-3 mb-3">
              <Terminal className="w-3.5 h-3.5 text-[#06B6D4]" />
              Console Hertzienne (Poste de Contrôle Lomé)
            </h4>

            <div className="space-y-2 bg-[#0B1020]/75 border border-white/5 p-3 rounded-lg h-36 overflow-y-auto font-mono text-[10px] leading-relaxed">
              {flashLogs.length === 0 ? (
                <div className="text-slate-550 italic p-1 uppercase">
                  📡 Prêt pour réception. Déclenchez le broadcast flash ou simulez un message sur le smartphone à droite pour charger des données réelles.
                </div>
              ) : (
                flashLogs.map((log, index) => (
                  <div key={index} className="flex gap-1.5 items-start">
                    <span className="text-slate-650 shrink-0 select-none">[{log.time}]</span>
                    <span className={log.type === "success" ? "text-emerald-400 font-bold" : log.type === "warn" ? "text-rose-450" : "text-[#CBD5E1]"}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 text-[9px] text-slate-500 font-mono uppercase tracking-wide">
              * La transmission télémetrique s&apos;effectue de façon cryptée via protocole sécurisé.
            </div>
          </div>

          {/* Deployed Agents Directory */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5 font-mono">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                RÉSEAU DES AGENTS ACTIFS ({filteredAgents.length})
              </h4>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filtrer..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-[#0B1020] border border-white/5 rounded-lg pl-7 pr-3 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-[#3B82F6]"
                  />
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0B1020]/50 border-b border-[#1A2542] text-[9px] text-slate-500 uppercase">
                    <th className="py-2 px-2">Terminal</th>
                    <th className="py-2 px-2">Localisation</th>
                    <th className="py-2 px-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-550 italic uppercase">
                        Aucun agent actif.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.slice(0, 5).map(agent => (
                      <tr key={agent.id} className="hover:bg-[#0B1020]/25 transition text-[11px]">
                        <td className="py-2 px-2">
                          <div>
                            <span className="text-white font-bold block leading-tight">{agent.name}</span>
                            <span className="text-[9px] text-[#06B6D4] font-mono">v{agent.version}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-slate-400">
                          {agent.city}, TG
                        </td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#10B981]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side: HIGH CONTEXT HIGH FIDELITY SMARTPHONE PREVIEW (Columns: 5/12) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* SIMULATION EXPLANATORY CARD */}
          <div className="bg-[#121A2F] border border-[#3B82F6]/25 rounded-xl p-5 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex gap-3">
              <Smartphone className="w-8 h-8 text-[#3B82F6] shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Démonstration Live Citoyenne
                </h3>
                <p className="text-[11px] text-[#94A3B8] mt-1 font-sans">
                  Voici le simulateur officiel de l&apos;application mobile citoyenne <strong className="text-white font-mono uppercase">SP_TG mobile</strong>. 
                  Sélectionnez un cas de cyber-arnaque togolaise classique ci-dessous, puis cliquez sur envoyer pour voir comment le moteur NLP intercepte et signale la menace au SOC en direct !
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            
            {/* PHYSICAL SMARTPHONE CHASSIS */}
            <div className="w-[290px] h-[550px] bg-[#040814] rounded-[42px] border-4 border-slate-700 shadow-2xl relative overflow-hidden flex flex-col justify-between p-2.5 ring-8 ring-slate-900/40">
              
              {/* Speaker & notch cutout */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
                <div className="w-12 h-1 bg-neutral-800 rounded-full"></div>
              </div>

              {/* Status bar (Mock Android UI) */}
              <div className="h-6 w-full px-4 pt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 z-20 bg-black/60 font-medium">
                <span>13:37</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] bg-sky-500/10 text-[#38BDF8] px-1 rounded uppercase tracking-widest leading-none font-bold">SP_TG Net</span>
                  <Wifi className="w-2.5 h-2.5 text-[#38BDF8]" />
                  <Battery className="w-3.5 h-3.5 text-[#38BDF8]" />
                </div>
              </div>

              {/* LIVE SIMULATIVE PUSH NOTIFICATION POPUP */}
              {showNotification && (
                <div 
                  className={`absolute top-7 left-2 right-2 p-3 bg-slate-950/95 border rounded-xl text-[11px] text-white shadow-xl z-50 animate-bounce cursor-pointer ${
                    threatSeverity === "central_critical" 
                      ? "border-red-500/40 shadow-red-500/5 hover:border-red-400/50" 
                      : "border-amber-500/25 hover:border-amber-400/40"
                  }`}
                  onClick={handleOpenAlertAndBlock}
                >
                  <div className={`flex items-center gap-2 mb-1.5 font-mono text-[9px] tracking-wider font-bold ${
                    threatSeverity === "central_critical" ? "text-red-400" : "text-amber-400"
                  }`}>
                    <Bell className="w-3 h-3 animate-pulse" />
                    <span>
                      {threatSeverity === "central_critical" 
                        ? "🚨 ARNAQUE CONFIRMÉE PAR LE CENTRE • SP_TG" 
                        : isGroupSource 
                          ? "⚠️ MESSAGE SUSPECT EN GROUPE • SP_TG" 
                          : "⚠️ TENTATIVE D'ARNAQUE DÉTECTÉE • SP_TG"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded shrink-0 ${
                      threatSeverity === "central_critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white text-[10px] block mb-0.5">
                        {isGroupSource ? `💬 ${groupName}` : activeSender}
                      </strong>
                      <span className="text-slate-400 text-[8.5px] block font-mono mb-0.5">
                        {isGroupSource ? `Participant: ${activeSender}` : "Message Direct"}
                      </span>
                      <p className="text-slate-300 font-sans line-clamp-2 text-[10px] leading-snug">{activeMessageText}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-center text-sky-400 border-t border-white/5 pt-1.5 font-bold uppercase tracking-wider flex items-center justify-center gap-1 animate-pulse">
                    <span>Cliquez ici pour vérifier et vous protéger !</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              )}

              {/* LIVE GREEN INFO POPUP FOR WHITELISTED GROUPS */}
              {whitelistedCheckNotification && (
                <div 
                  className="absolute top-7 left-2 right-2 p-3 bg-slate-950/95 border border-emerald-500/45 rounded-xl text-[11px] text-white shadow-xl z-50 cursor-pointer hover:border-emerald-450/60"
                  onClick={() => setWhitelistedCheckNotification(false)}
                >
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-400 font-mono text-[9px] tracking-wider font-bold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>💬 GROUPE AUTORISÉ (LISTE VERTE) • SP_TG</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white text-[10px] block mb-0.5">💬 {groupName}</strong>
                      <p className="text-slate-300 font-sans leading-relaxed text-[9.5px]">
                        L&apos;alerte d&apos;arnaque pour ce groupe a été bloquée car il est marqué comme fiable à 100%. Aucun faux positif généré !
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-[8px] font-mono text-center text-slate-500 border-t border-white/5 pt-1.5 uppercase font-bold tracking-wider">
                    Cliquez pour masquer cette notification
                  </div>
                </div>
              )}

              {/* SMARTPHONE VIRTUAL SCREEN */}
              <div className="flex-1 bg-[#050B1D] rounded-[32px] overflow-hidden flex flex-col justify-between relative p-4 text-xs select-none">
                
                {/* Visual backdrop watermark style */}
                <div className="absolute inset-0 bg-radial-[circle_at_top] from-blue-500/5 to-transparent pointer-events-none z-0"></div>

                {/* Simulated Screen Body according to active Phone State */}
                {phoneState === "dashboard" && (
                  <div className="flex-1 flex flex-col justify-between z-10 pt-4 animate-fade-in">
                    
                    {/* Header bar within the app */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30">
                          <Shield className="w-3.5 h-3.5 text-[#38BDF8]" />
                        </div>
                        <div>
                          <span className="font-bold text-[10px] text-white tracking-widest block font-mono">SP_TG MOBILE</span>
                          <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-widest font-mono">Mon Garde du Corps</span>
                        </div>
                      </div>
                      
                      {/* Live version */}
                      <span className="text-[8px] bg-slate-900 border border-white/5 text-slate-400 py-0.5 px-1.5 rounded font-mono">
                        v1.5.0
                      </span>
                    </div>

                    {/* STATUS GAUGE */}
                    <div className="my-auto py-3 flex flex-col items-center justify-center text-center">
                      <div className="relative w-28 h-28 flex items-center justify-center mb-2.5">
                        {/* Outer rotating pulse ring */}
                        <div className={`absolute inset-0 rounded-full border border-dashed animate-spin duration-15000 ${isShieldActive ? "border-[#10B981]/20" : "border-slate-800"}`}></div>
                        
                        {/* Inner glowing circle */}
                        <div className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${isShieldActive ? "bg-[#10B981]/5 border border-[#10B981]/35 shadow-[#10B981]/5" : "bg-slate-900 border border-slate-800"}`}>
                          <Shield className={`w-8 h-8 transition-transform ${isShieldActive ? "text-[#10B981] scale-100" : "text-slate-600 scale-90"}`} />
                          <span className="text-[8px] font-mono tracking-widest uppercase font-bold text-slate-400 mt-1">
                            {isShieldActive ? "Garde-corps" : "Désactivé"}
                          </span>
                        </div>
                      </div>

                      <h4 className={`text-xs font-mono font-black uppercase text-center tracking-wider transition-colors ${isShieldActive ? "text-[#10B981]" : "text-slate-500"}`}>
                        {isShieldActive ? "🟢 SÉCURISÉ & PROTÉGÉ" : "⚫ PROTECTION ARRÊTÉE"}
                      </h4>
                      <p className="text-[8.5px] font-sans text-slate-400 max-w-[190px] mt-1 text-center">
                        {isShieldActive 
                          ? "L'application surveille vos SMS pour vous alerter immédiatement face aux menteurs et aux voleurs." 
                          : "Activez votre garde du corps pour bloquer les voleurs d'argent."}
                      </p>
                    </div>

                    {/* METRICS ROW */}
                    <div className="grid grid-cols-2 gap-2 pb-3 pt-1">
                      <div className="bg-[#0B1226]/85 border border-white/5 p-2 rounded-xl text-center">
                        <span className="text-[7.5px] font-mono font-bold text-slate-500 uppercase block tracking-wider">Pièges Évités</span>
                        <strong className="text-sm font-mono text-[#EF4444] block mt-0.5">{simLocalBlockedCount}</strong>
                      </div>
                      <div className="bg-[#0B1226]/85 border border-white/5 p-2 rounded-xl text-center">
                        <span className="text-[7.5px] font-mono font-bold text-slate-500 uppercase block tracking-wider">Arnaques Connues</span>
                        <strong className="text-sm font-mono text-[#38BDF8] block mt-0.5">148</strong>
                      </div>
                    </div>

                    {/* QUICK APP CONTROL */}
                    <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] font-mono text-slate-400 font-bold uppercase">Activer le protecteur</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isShieldActive} 
                            onChange={(e) => setIsShieldActive(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#10B981]"></div>
                        </label>
                      </div>
                      <div className="text-[8.2px] text-slate-500 font-sans leading-tight font-medium">
                        * Fonctionne en toute sécurité sans consommer votre connexion internet.
                      </div>
                    </div>

                  </div>
                )}

                {phoneState === "receiving" && (
                  <div className="flex-1 flex flex-col justify-between z-10 pt-6 animate-pulse">
                    <div className="text-center my-auto space-y-3">
                      <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-amber-500" />
                      </div>
                      <h4 className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest text-center">
                        RECHERCHE DE PIÈGES EN COURS...
                      </h4>
                      <p className="text-[9px] text-slate-400 font-sans max-w-[180px] mx-auto leading-normal">
                        Votre garde du corps examine attentivement s&apos;il s&apos;agit d&apos;une tentative de vol ou d&apos;un mensonge.
                      </p>
                    </div>
                  </div>
                )}

                {phoneState === "quarantine" && (
                  <div className="flex-1 flex flex-col justify-between z-10 pt-4 animate-fade-in text-slate-200">
                    
                    {/* Specialized view for Mild Group Warning to keep it soft and less scary */}
                    {isGroupSource && threatSeverity === "heuristic_mild" ? (
                      <div className="flex flex-col justify-between flex-1">
                        
                        {/* Soft Yellow warning Header */}
                        <div className="bg-amber-500/10 border border-amber-500/25 p-2 rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
                          <div className="leading-tight text-[10px]">
                            <h4 className="font-bold text-amber-400 font-mono uppercase text-[9px] tracking-wide">
                              💬 GROUPE SUSPECT (Vérification)
                            </h4>
                            <span className="text-[7.5px] text-slate-400 block font-mono">
                              Vérification par précaution
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="bg-slate-950 border border-white/5 p-2.5 rounded-xl mt-2 space-y-1 rounded-b-none flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-[8px] font-mono text-slate-400 block border-b border-white/5 pb-1">
                              Dans le groupe : <strong className="text-white font-bold">{groupName}</strong>
                            </span>
                            <span className="text-[7.5px] text-slate-500 block font-mono mt-0.5">
                              Expéditeur : {activeSender}
                            </span>
                            <p className="mt-1 text-[8.2px] text-slate-300 leading-tight italic bg-white/5 p-2 rounded">
                              &quot;{activeMessageText}&quot;
                            </p>
                          </div>

                          <div className="bg-slate-900/50 p-2 rounded border border-white/5 space-y-1">
                            <h5 className="text-[8.5px] font-bold text-amber-400 font-mono">
                              💡 EST-CE UNE FAUSSE ALERTE ?
                            </h5>
                            <p className="text-[7.8px] text-slate-400 leading-tight">
                              Si vous faites confiance à 100% à ce groupe pour de vrai, mettez-le dans votre Liste Verte. Le garde-corps n&apos;analysera plus ses messages pour éviter de vous déranger !
                            </p>
                          </div>
                        </div>

                        {/* Interactive Action Choice for user */}
                        <div className="space-y-1.5 mt-2 bg-slate-950/40 border border-white/5 p-2.5 rounded-b-xl border-t-0">
                          <button
                            onClick={handleTrustGroup}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-mono text-[8.5px] font-bold uppercase tracking-wide rounded-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            💚 Faire confiance à ce groupe (Liste Verte)
                          </button>
                          
                          <button
                            onClick={handleReportGroup}
                            className="w-full py-1 bg-red-650 hover:bg-red-700 text-white font-mono text-[8px] font-bold uppercase tracking-wide rounded-lg cursor-pointer transition-colors"
                          >
                            🚫 Signaler & Bloquer ce piège
                          </button>
                        </div>

                      </div>
                    ) : (
                      // STANDARD OR CRITICAL SCAM BLOCK SCREEN
                      <div className="flex flex-col justify-between flex-1">
                        
                        {/* Critical Red warning Header */}
                        <div className={`p-2 rounded-xl flex items-center gap-2 ${
                          threatSeverity === "central_critical"
                            ? "bg-red-500/15 border border-red-500/35"
                            : "bg-[#EF4444]/10 border border-[#EF4444]/25"
                        }`}>
                          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />
                          <div className="leading-tight text-[10px]">
                            <h4 className="font-bold text-red-500 font-mono uppercase text-[9px] tracking-wide">
                              {threatSeverity === "central_critical" 
                                ? "🚨 ARNAQUE TRÈS CRITIQUE ET CONFIRMÉE" 
                                : "⚠️ TENTATIVE D&apos;ARNAQUE COMPLÈTE"}
                            </h4>
                            <span className="text-[7.5px] text-slate-400 block font-mono">
                              {threatSeverity === "central_critical" 
                                ? "Identifié par le Poste Central" 
                                : "Neutralisé par le garde-corps local"}
                            </span>
                          </div>
                        </div>

                        {/* SUSPECT MESSAGE INFO CONTAINER */}
                        <div className="bg-slate-950 border border-red-500/10 p-2.5 rounded-xl mt-2.5 space-y-2 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[7.8px] font-mono border-b border-white/5 pb-1">
                              <span className="text-slate-400">
                                {isGroupSource ? `Groupe: ${groupName}` : `De: ${activeSender}`}
                              </span>
                              <span className="text-red-400 uppercase font-bold tracking-wider text-[7.5px]">PIÈGE NEUTRALISÉ</span>
                            </div>
                            <p className="mt-1.5 text-[8.2px] font-sans text-amber-100 leading-snug italic bg-amber-500/5 p-2 rounded border border-amber-500/10 max-h-[100px] overflow-y-auto">
                              &quot;{activeMessageText}&quot;
                            </p>
                          </div>

                          {/* SIMPLE IMPERATIVE USER INSTRUCTIONS (Clear to all targets) */}
                          <div className="bg-red-950/20 p-2 border border-red-500/15 rounded-lg space-y-1">
                            <span className="text-[8.5px] font-mono font-bold text-red-400 uppercase tracking-wider block">
                              🚨 CONSIGNES DE SÉCURITÉ :
                            </span>
                            <ul className="text-[7.8px] text-slate-300 font-sans space-y-1 leading-tight list-none pl-0">
                              <li className="flex items-start gap-1">
                                <span className="text-red-500 shrink-0 font-bold">X</span>
                                <span><strong>Ne communiquez en aucun cas vos données</strong> (code Flooz, T-Money ou WhatsApp).</span>
                              </li>
                              <li className="flex items-start gap-1">
                                <span className="text-red-500 shrink-0 font-bold">X</span>
                                <span><strong>N&apos;ouvrez jamais le lien</strong> internet reçu !</span>
                              </li>
                              <li className="flex items-start gap-1">
                                <span className="text-red-500 shrink-0 font-bold">X</span>
                                <span><strong>Ne répondez pas</strong> sans avoir cliqué ici pour en savoir plus.</span>
                              </li>
                            </ul>
                          </div>

                          {/* Heuristics reasoning */}
                          <div className="border-t border-white/5 pt-1">
                            <span className="text-[7px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Pourquoi c&apos;est bizarre ?</span>
                            <p className="text-[7.5px] text-slate-400 leading-normal font-mono mt-0.5">
                              {simTemplates[selectedTemplate] ? simTemplates[selectedTemplate].heuristics : "Détecté grâce aux mots trompeurs typiques des opportunités trop belles pour être vraies."}
                            </p>
                          </div>
                        </div>

                        {/* Central remote sync status */}
                        <div className="bg-[#06B6D4]/5 border border-[#06B6D4]/25 p-1.5 rounded-lg mt-2 flex items-center justify-between text-[7.5px] font-mono">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 text-[#06B6D4] animate-pulse" />
                            SIGNALÉ AU CENTRE
                          </span>
                          {isSimulatingApiCall ? (
                            <span className="text-amber-400 animate-pulse font-bold">ENVOI DU RAPPORT...</span>
                          ) : (
                            <span className="text-emerald-450 font-bold flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> SIGNALÉ ET BLOQUÉ !
                            </span>
                          )}
                        </div>

                        {/* Reset Button */}
                        <button
                          onClick={() => setPhoneState("dashboard")}
                          className="mt-2 w-full py-1.5 bg-[#10B981] hover:bg-emerald-650 transition-colors text-white font-mono text-[8px] font-bold uppercase tracking-widest rounded-lg cursor-pointer"
                        >
                          Tout va bien, retourner à l&apos;accueil
                        </button>

                      </div>
                    )}

                  </div>
                )}

                {/* Simulated physical Android Home / back button row */}
                <div className="h-6 w-full flex items-center justify-center gap-6 mt-4 pt-1.5 border-t border-white/5 bg-black/40 text-slate-600">
                  <span className="w-2.5 h-2.5 border border-slate-700 rounded-sm cursor-pointer rotate-45 hover:border-[#38BDF8]"></span>
                  <span className="w-2.5 h-2.5 border border-slate-700 rounded-full cursor-pointer hover:border-[#38BDF8]" onClick={() => setPhoneState("dashboard")}></span>
                  <span className="w-3 h-2 border border-slate-700 rounded-lg cursor-pointer hover:border-[#38BDF8]"></span>
                </div>

              </div>
            </div>

            {/* CONTROL PANEL FOR JURY AND DEVELOPER DEMONSTRATION */}
            <div className="w-[290px] mt-4 bg-[#121A2F]/80 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md font-mono text-xs">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider block text-center border-b border-white/5 pb-1.5">
                🎛️ Panneau de Contrôle de simulation
              </span>

              {/* Template dropdown list */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-555 block uppercase">Modèles d&apos;arnaque :</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1.5 rounded focus:outline-none"
                >
                  <option value={-1}>Saisie libre (Personnalisé)</option>
                  {simTemplates.map((tpl, i) => (
                    <option key={i} value={i}>{tpl.title}</option>
                  ))}
                </select>
              </div>

              {/* Custom sender number */}
              <div className="grid grid-cols-1 gap-1.5">
                <div>
                  <label className="text-[9px] text-slate-555 block uppercase">Expéditeur suspect :</label>
                  <input
                    type="text"
                    value={customSender}
                    onChange={(e) => {
                      setCustomSender(e.target.value);
                      setSelectedTemplate(-1);
                    }}
                    placeholder="+228..."
                    className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1 rounded font-mono"
                  />
                </div>
                
                {/* Custom text body */}
                <div>
                  <label className="text-[9px] text-slate-555 block uppercase">Contenu du message :</label>
                  <textarea
                    value={customText}
                    onChange={(e) => {
                      setCustomText(e.target.value);
                      setSelectedTemplate(-1);
                    }}
                    rows={3}
                    placeholder="Contenu du SMS à intercepter..."
                    className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1.5 rounded resize-none"
                  />
                </div>
              </div>

              {/* ACTION TRIGGER BUTTON */}
              <button
                onClick={handleSimulateSMS}
                disabled={!customText.trim()}
                className="w-full py-2 bg-[#EF4444] hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-655 font-mono text-[9px] font-bold text-white rounded-xl uppercase transition tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                DÉPLOYER LE SMS PHYSIQUE
              </button>

              <div className="bg-blue-950/20 border border-blue-500/10 p-2 rounded text-[8.5px] text-slate-400 text-center leading-normal">
                💡 <strong>Effet de Démonstration :</strong> En simulant l&apos;envoi du SMS, une alerte apparaît en temps réel sur l&apos;écran virtuel. Cliquez dessus pour voir comment votre garde du corps désarme le piège et transmet instantanément l&apos;alerte de sécurité !
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
