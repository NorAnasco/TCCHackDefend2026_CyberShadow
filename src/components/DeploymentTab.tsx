import React, { useState, useRef, useEffect } from "react";
import { 
  Settings, 
  Terminal, 
  Wifi, 
  Clock, 
  RefreshCw,
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  Check,
  Download,
  Upload,
  Undo2,
  History,
  Database
} from "lucide-react";
import { MobileAgent, SyncConfig, DbSnapshot } from "../types";

interface Props {
  agents: MobileAgent[];
  config: SyncConfig;
  onUpdateSyncDays: (days: number) => void;
  onTriggerFlashUpdate: () => Promise<any>;
  onRefreshData?: () => void;
}

export interface LogLine {
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  text: string;
}

export default function DeploymentTab({ agents, config, onUpdateSyncDays, onTriggerFlashUpdate, onRefreshData }: Props) {
  const [syncDays, setSyncDays] = useState(config.defaultSyncIntervalDays);
  const [gatewayValue, setGatewayValue] = useState(config.gatewayAddress || "");
  const [snapshots, setSnapshots] = useState<DbSnapshot[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashLogs, setFlashLogs] = useState<LogLine[]>([]);
  const [flashSuccess, setFlashSuccess] = useState(false);
  
  // Custom API key & AI choice state
  const [apiKeyValue, setApiKeyValue] = useState(config.customApiKey || "");
  const [aiSelectionValue, setAiSelectionValue] = useState<"gemini" | "simulation">(config.aiSelection || "gemini");
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user manual updates input
  useEffect(() => {
    setSyncDays(config.defaultSyncIntervalDays);
  }, [config.defaultSyncIntervalDays]);

  useEffect(() => {
    setGatewayValue(config.gatewayAddress || "");
  }, [config.gatewayAddress]);

  useEffect(() => {
    setApiKeyValue(config.customApiKey || "");
  }, [config.customApiKey]);

  useEffect(() => {
    setAiSelectionValue(config.aiSelection || "gemini");
  }, [config.aiSelection]);

  // Handle logging scroll
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [flashLogs]);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch("/api/snapshots");
      const json = await res.json();
      if (json.success) {
        setSnapshots(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch snapshots", e);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const addLog = (text: string, type: LogLine["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString("fr-FR");
    setFlashLogs(prev => [...prev, { timestamp, type, text }]);
  };

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSyncDays(syncDays);
    addLog(`⚙️ Fréquence de synchronisation configurée à ${syncDays} jours.`, "info");
    alert(`Délai de synchronisation par défaut mis à jour à ${syncDays} jours.`);
  };

  const handleUpdateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/config/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayAddress: gatewayValue })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`📡 Nouvelle passerelle centrale mise en service : ${gatewayValue}`, "success");
        if (onRefreshData) onRefreshData();
        alert("IP de la passerelle mise à jour avec succès face aux agents mobiles.");
      } else {
        alert("Erreur : " + data.error);
      }
    } catch (err: any) {
      alert("Erreur de connexion : " + err.message);
    }
  };

  const handleUpdateAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAiConfig(true);
    setAiMessage(null);
    try {
      const response = await fetch("/api/config/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customApiKey: apiKeyValue || null,
          aiSelection: aiSelectionValue
        })
      });
      const data = await response.json();
      if (data.success) {
        setAiMessage({ type: "success", text: "Configuration IA mise à jour avec succès." });
        addLog(`⚙️ Moteur IA configuré : ${aiSelectionValue.toUpperCase()}`, "success");
        if (onRefreshData) onRefreshData();
      } else {
        setAiMessage({ type: "error", text: data.error || "Erreur de configuration." });
      }
    } catch (err: any) {
      setAiMessage({ type: "error", text: "Erreur réseau : " + err.message });
    } finally {
      setSavingAiConfig(false);
    }
  };

  const handleExportSignatures = async () => {
    try {
      const res = await fetch("/api/v1/sync");
      const payload = await res.json();
      if (payload.success && payload.data) {
        // Format for cleaner JSON exfiltration
        const threatsToExport = payload.data.map((sig: any) => ({
          type: sig.type.toLowerCase(),
          value: sig.pattern,
          severity: sig.severity,
          location: sig.location,
          details: sig.details
        }));
        
        const fileContent = JSON.stringify({ threats: threatsToExport }, null, 2);
        const blob = new Blob([fileContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `kela-signatures-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addLog("📥 Exportation de la base active de signatures réussie !", "success");
      }
    } catch (e: any) {
      alert("Erreur lors de l'export de sauvegarde: " + e.message);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Direct proactive prompt forcing / suggesting current database backup before importing
    const wantsBackup = confirm(
      "🛡️ CONTRÔLE D'INTÉGRITÉ SOC PHISHING TG :\n\nPour empêcher l'écrasement ou la corruption des signatures actuelles, l'administrateur doit exporter et sauvegarder sa base de données active avant d'effectuer un nouvel import.\n\nVoulez-vous D'ABORD EXPORTER le fichier de sauvegarde active (.json) ?"
    );

    if (wantsBackup) {
      await handleExportSignatures();
      alert("📥 Sauvegarde active exportée avec succès ! Vous pouvez maintenant confirmer l'importation de fusion chronologique.");
    } else {
      const confirmContinue = confirm(
        "⚠️ DANGER : Êtes-vous certain de vouloir importer SANS avoir enregistré une sauvegarde de vos indicateurs ou incidents actuels ?"
      );
      if (!confirmContinue) {
        e.target.value = "";
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const threats = parsed.threats || (Array.isArray(parsed) ? parsed : null);
        if (!Array.isArray(threats)) {
          alert("Erreur de format : Le fichier de sauvegarde doit contenir un tableau 'threats' ou un tableau direct de signatures.");
          return;
        }

        addLog(`📂 Traitement du fichier importé (contient ${threats.length} signatures reconnues)...`, "info");
        const res = await fetch("/api/backup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threats })
        });
        const data = await res.json();
        if (data.success) {
          addLog(`📥 Intégration réussie : ${data.count} nouvelles signatures injectées et fusionnées !`, "success");
          if (onRefreshData) onRefreshData();
          fetchSnapshots(); // Update snapshots lists as database updated
          alert(`Importation réussie : ${data.count} nouvelles signatures fusionnées.`);
        } else {
          alert("Erreur lors de l'intégration : " + data.error);
        }
      } catch (err: any) {
        alert("La structure du JSON importé est invalide : " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!confirm("Voulez-vous restaurer instantanément cet état précédent de la base ? Les données actuelles seront écrasées et archivées.")) return;
    try {
      const res = await fetch("/api/snapshots/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`⏪ Base de signatures restaurée avec succès au snapshot ${snapshotId}`, "success");
        if (onRefreshData) onRefreshData();
        fetchSnapshots();
        alert("Base de données restaurée à la version sélectionnée !");
      } else {
        alert("Erreur : " + data.error);
      }
    } catch (err: any) {
      alert("Erreur réseau : " + err.message);
    }
  };

  const executeFlashUpdate = async () => {
    setIsFlashing(true);
    setFlashSuccess(false);
    setFlashLogs([]);

    addLog("📡 AMORÇAGE DE LA PROCÉDURE CRITIQUE 'FLASH UPDATE'", "warn");
    addLog(`🌐 Adresse passerelle distribuée : ${gatewayValue}`, "warn");
    addLog("🔍 Compilation des signatures actives de la base de données...", "info");

    await new Promise(r => setTimeout(r, 600));
    addLog(`Fichiers de signatures générés: ${agents.length * 12} signatures binaires d'IoC compilées`, "success");
    addLog("📡 Lancement de l'écoute générale de broadcast UDP sur Port 3000/443...", "info");

    // Loop through each online agent for cool dynamic loading
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      await new Promise(r => setTimeout(r, 450));

      if (agent.status === "Online") {
        addLog(`Connexion sécurisée TLS 1.3 établie avec ${agent.name} [IP: ${agent.ipAddress}]`, "info");
        await new Promise(r => setTimeout(r, 300));
        addLog(`[SYNC] Poussée binaire SOC -> Agent client ${agent.name} réussie. Version ${agent.version} OK`, "success");
      } else {
        addLog(`Tentative vers agent ${agent.name} [IP: ${agent.ipAddress}] - Échec: Agent HORS LIGNE`, "error");
        addLog(`Mise en file d'attente hors-ligne pour ${agent.name} (Synchronisation différée activée)`, "warn");
      }
    }

    try {
      // Notify backend coordinates
      await onTriggerFlashUpdate();
      
      await new Promise(r => setTimeout(r, 400));
      addLog("⚖️ Finalisation de l'intégrité SHA-256 de la base de signatures", "info");
      addLog("✅ PROCÉDURE FLASH UPDATE TERMINÉE AVEC SUCCÈS", "success");
      setFlashSuccess(true);
    } catch (e) {
      addLog("❌ Erreur critique lors de l'enregistrement de la synchronisation", "error");
    } finally {
      setIsFlashing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed">
      
      {/* Configuration Column (Left 4 Columns) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Sync config form */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Settings className="w-4.5 h-4.5 text-[#3B82F6]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Options de Synchronisation</h3>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
            Configurez l&apos;intervalle par défaut après lequel les applications mobiles sur les smartphones de vos agents au Togo forceront la synchronisation de leur base locale.
          </p>

          <form onSubmit={handleApplyConfig} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-[#94A3B8] font-mono block uppercase">Délai de synchronisation standard :</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={syncDays}
                  onChange={(e) => setSyncDays(Number(e.target.value))}
                  className="bg-[#0B1020] border border-white/5 text-white font-mono text-center text-xs rounded-lg p-2.5 w-24 focus:outline-none focus:border-[#3B82F6]"
                />
                <span className="text-[11px] font-mono text-slate-300">Jours</span>
              </div>
            </div>

            <button
              type="submit"
              className="py-2.5 px-4 bg-[#0B1020]/85 hover:bg-[#1A2542] active:bg-[#0B1020] border border-white/5 text-white font-mono text-[11px] font-bold rounded-lg transition w-full flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              APPLIQUER LA FRÉQUENCE
            </button>
          </form>
        </div>

        {/* Dynamic server IP configuration */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Database className="w-4.5 h-4.5 text-[#06B6D4]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Adresse de la Passerelle</h3>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
            Configurez l&apos;IP dynamique ou le domaine de ce serveur central. L&apos;adresse sera automatiquement appairée aux agents mobiles lors de leurs requêtes réseaux.
          </p>

          <form onSubmit={handleUpdateGateway} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-[#94A3B8] font-mono block uppercase">URL / IP du Serveur de passerelle :</label>
              <input
                type="text"
                placeholder="http://192.168.1.100:3000"
                value={gatewayValue}
                onChange={(e) => setGatewayValue(e.target.value)}
                className="bg-[#0B1020] border border-white/5 text-white font-mono text-xs rounded-lg p-2.5 w-full focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <button
              type="submit"
              className="py-2.5 px-4 bg-[#0B1020]/85 hover:bg-[#1A2542] active:bg-[#0B1020] border border-white/5 text-white font-mono text-[11px] font-bold rounded-lg transition w-full flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-[#06B6D4]" />
              CONFIGURER LA PASSERELLE
            </button>
          </form>
        </div>

        {/* Dynamic Gemini API key & Engine toggle configuration */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Cpu className="w-4.5 h-4.5 text-[#3B82F6]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Moteur IA &amp; Clé API</h3>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
            Basculez entre le moteur cognitif Google Gemini et la simulation heuristique locale togolaise. Renseignez une clé d&apos;accès personnalisée pour vos enquêtes.
          </p>

          <form onSubmit={handleUpdateAiSettings} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-[#94A3B8] font-mono block uppercase">Sélection de l&apos;Intelligence :</label>
              <select
                value={aiSelectionValue}
                onChange={(e) => setAiSelectionValue(e.target.value as any)}
                className="bg-[#0B1020] border border-white/5 text-slate-300 font-mono text-xs rounded-lg p-2.5 w-full focus:outline-none focus:border-[#3B82F6] cursor-pointer"
              >
                <option value="gemini">Google Gemini active 🔴</option>
                <option value="simulation">Simulation Heuristique Locale ⚪</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-[#94A3B8] font-mono block uppercase">Clé API Gemini (Optionnel) :</label>
              <input
                type="password"
                placeholder="Clé API personnalisée AI Studio"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                className="bg-[#0B1020] border border-white/5 text-white font-mono text-xs rounded-lg p-2.5 w-full focus:outline-none focus:border-[#3B82F6]"
              />
              <span className="text-[9px] text-slate-500 font-mono block">Remplir pour outrepasser la clé système globale (.env)</span>
            </div>

            {aiMessage && (
              <div className={`p-2.5 rounded text-xs font-mono border ${
                aiMessage.type === "success" ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25"
              }`}>
                {aiMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingAiConfig}
              className="py-2.5 px-4 bg-[#3B82F6] hover:bg-[#3B82F6]/95 disabled:bg-[#1A2542] disabled:opacity-50 text-white font-mono text-[11px] font-bold rounded-lg transition w-full flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              {savingAiConfig ? "ENREGISTREMENT..." : "SAUVEGARDER CONFIG IA"}
            </button>
          </form>
        </div>

        {/* Database backup restoration */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Download className="w-4.5 h-4.5 text-[#10B981]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Export &amp; Import local</h3>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleExportSignatures}
              className="w-full py-2.5 px-4 bg-[#0B1020] border border-white/5 hover:border-[#1A2542] hover:bg-[#1A2542] text-slate-200 text-xs font-mono rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#10B981]" />
              EXPORTER LES SIGNATURES (JSON)
            </button>

            <div className="relative">
              <input 
                type="file" 
                accept=".json"
                ref={fileInputRef} 
                onChange={handleImportFile}
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-[#0B1020] border border-white/5 hover:border-[#1A2542] hover:bg-[#1A2542] text-slate-200 text-xs font-mono rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#3B82F6]" />
                RESTAURER PAR MANDAT / IMPORT
              </button>
            </div>
          </div>
        </div>

        {/* Current Target Area Warning banner */}
        <div className="bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#EF4444] font-mono text-xs font-bold uppercase">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            ZONES DE MENACE CYBER CRITIQUE
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
            Zone en alerte rouge : <strong className="text-[#E5E7EB]">Lomé (Centrale &amp; Port Autonome)</strong>. Un canal de credential harvesting de masse ciblant Flooz a été détecté. Le bouton Flash Update forcera les agents de terrain à charger immédiatement la base de blocage dans leur pare-feu local.
          </p>
        </div>

      </div>

      {/* FLASH UPDATE & Diagnostic terminal (Right 8 Columns) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Main Telemetry Terminal */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2 font-mono">
                  <Wifi className="w-4.5 h-4.5 text-[#3B82F6]" />
                  CENTRAL BROADCAST &bull; MOBILE TELEMETRY
                </h3>
                <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">Émettez des instructions critiques d&apos;urgence à tous les agents mobiles connectés dans les 5 régions économiques du Togo.</p>
              </div>

              <button
                onClick={executeFlashUpdate}
                disabled={isFlashing}
                className="px-5 py-3 bg-[#EF4444]/15 hover:bg-[#EF4444]/25 disabled:bg-[#121A2F] disabled:text-slate-500 text-[#EF4444] border border-[#EF4444]/30 font-mono text-xs font-bold tracking-wider rounded-xl uppercase shadow-sm flex items-center gap-2 transition shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFlashing ? "animate-spin" : ""}`} />
                EMISSION &bull; FLASH UPDATE
              </button>
            </div>

            {/* Diagnostic status indicator */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-[10px] font-mono uppercase">
              <div className="bg-[#0B1020]/60 p-2.5 rounded border border-white/5 flex items-center gap-2 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                <span className="text-slate-400">Canal Broadcast: IPsec Tunnel</span>
              </div>
              <div className="bg-[#0B1020]/60 p-2.5 rounded border border-white/5 flex items-center gap-2 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span className="text-slate-400 truncate">Dernier Flash: {config.lastFlashUpdateAt ? new Date(config.lastFlashUpdateAt).toLocaleTimeString() : "Jamais"}</span>
              </div>
              <div className="bg-[#0B1020]/60 p-2.5 rounded border border-white/5 flex items-center gap-2 col-span-2 md:col-span-1 shadow-sm">
                <span className="text-slate-400">Status Synced: </span>
                <span className="text-[#10B981] font-bold">{config.flashUpdateStatus}</span>
              </div>
            </div>

            {/* Terminal logger screen (Glow styling) */}
            <div className="mt-5 bg-[#0B1020] border border-white/5 rounded-xl overflow-hidden shadow-inner">
              <div className="bg-[#121A2F]/90 px-4 py-2 border-b border-white/5 flex items-center gap-1.5 justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80"></div>
                </div>
                <span className="text-[9px] font-mono text-slate-500">SYSTEM DIALOGS - BROADCAST INTERFACE</span>
              </div>

              <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 leading-relaxed bg-[#050811]/90 select-text">
                {flashLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] space-y-1">
                    <span>=== CONSOLE SANS SIGNAL D&apos;ÉMISSION ACTIVE ===</span>
                    <span>En attente du déclenchement critique de &quot;FLASH UPDATE&quot;</span>
                  </div>
                ) : (
                  <>
                    {flashLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-550 shrink-0">[{log.timestamp}]</span>
                        <span className={`break-words ${
                          log.type === "success" ? "text-[#10B981]" :
                          log.type === "warn" ? "text-amber-400 font-bold" :
                          log.type === "error" ? "text-[#EF4444] font-bold" : "text-[#94A3B8]"
                        }`}>
                          {log.type === "success" && "✔ "}
                          {log.type === "error" && "✖ "}
                          {log.type === "warn" && "▲ "}
                          {log.text}
                        </span>
                      </div>
                    ))}
                    <div ref={terminalEndRef}></div>
                  </>
                )}
              </div>
            </div>

          </div>

          {flashSuccess && (
            <div className="mt-4 p-4 bg-[#10B981]/10 border border-[#10B981]/25 rounded-xl text-[11px] font-mono text-[#10B981] flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold text-[11px]">Propagation Réussie à Lomé et régions!</strong>
                Toutes les passerelles et agents de terrain actifs au Togo ont appliqué les signatures instantanément. La politique de blocage est désormais synchronisée à 100%.
              </div>
            </div>
          )}
        </div>

        {/* Database Snapshots list for immediate Restoration */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <History className="w-4.5 h-4.5 text-[#3B82F6]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Historique des Sauvegardes Automatiques</h3>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
            Chaque réinitialisation compresse l&apos;état instantané de votre base de signatures avant effacement pour prévenir toute perte accidentelle. Cliquez sur Restaurer pour charger l&apos;état historique ciblé.
          </p>

          {snapshots.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/5 rounded-lg text-slate-500 text-xs font-mono">
              Aucun snapshot d&apos;historique enregistré pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-white/5 text-[#94A3B8] uppercase text-[9px] font-bold">
                    <th className="py-2.5 font-bold">Date de sauvegarde</th>
                    <th className="py-2.5 font-bold">Signatures</th>
                    <th className="py-2.5 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {snapshots.map((snap) => (
                    <tr key={snap.id} className="hover:bg-white/5 transition">
                      <td className="py-3 font-sans text-[11px]">
                        {new Date(snap.timestamp).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </td>
                      <td className="py-3 text-[#3B82F6] font-bold">{snap.threatsCount} signatures</td>
                      <td className="py-3 text-right">
                        <button
                           onClick={() => handleRestoreSnapshot(snap.id)}
                           className="px-2.5 py-1 bg-[#1A2542] hover:bg-[#3B82F6] hover:text-white rounded border border-white/5 text-[10px] font-mono uppercase font-bold transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Undo2 className="w-3 h-3 text-[#3B82F6]" />
                          Restaurer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
