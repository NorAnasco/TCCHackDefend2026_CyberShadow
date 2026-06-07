import React, { useState, useMemo, useEffect } from "react";
import { 
  FileText, 
  Printer, 
  Globe, 
  Phone, 
  Clock, 
  MapPin, 
  ShieldAlert, 
  FileBadge, 
  Users, 
  TrendingUp, 
  Scale, 
  X,
  Eye,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  Activity,
  HardDrive,
  Trash2,
  Check,
  AlertCircle,
  Smartphone,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { ForensicsData, Threat, Campaign, MobileAgent, MobileSignal } from "../types";

interface Props {
  forensicsData: ForensicsData | null;
  threats: Threat[];
  campaigns: Campaign[];
  agents: MobileAgent[];
  mobileSignals?: MobileSignal[];
  onRefreshData?: () => void;
}

interface GroupedVector {
  value: string;
  type: "phone" | "domain" | "text_pattern";
  occurrences: number;
  locations: string[];
  associatedAgents: string[];
  timestampFirst: string;
  timestampLast: string;
  subSignals: MobileSignal[];
  isAlreadyInGlobalSignatures: boolean;
}

export default function ForensicsTab({ 
  forensicsData, 
  threats, 
  campaigns, 
  agents, 
  mobileSignals = [], 
  onRefreshData 
}: Props) {
  
  const [selectedVector, setSelectedVector] = useState<GroupedVector | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  // Manual override states
  const [overrideType, setOverrideType] = useState<"phone" | "domain" | "text_pattern">("phone");
  const [overrideSeverity, setOverrideSeverity] = useState<"Low" | "Medium" | "Critical">("Critical");
  const [overrideDetails, setOverrideDetails] = useState("");
  const [overrideLocation, setOverrideLocation] = useState("Lomé");

  // Judicial report personalization states
  const [magistrateName, setMagistrateName] = useState("M. le Procureur de la République près le Tribunal de Lomé");
  const [opjName, setOpjName] = useState("Commandant de la Brigade de Recherche de la Cybergendarmerie de Lomé");
  const [legalReference, setLegalReference] = useState("Loi n° 2018-026 du 07 décembre 2018 sur la cybersécurité au Togo (Code Numérique)");

  // 1. Group the pending signals by unique threat vector (senderPhone or URLs)
  const groupedVectors = useMemo(() => {
    const list: Record<string, GroupedVector> = {};

    // Filter pending signals
    const pendingSignals = mobileSignals.filter(sig => sig.status === "pending");

    pendingSignals.forEach(sig => {
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9-]{2,4}[^\s]*)/ig;
      const match = sig.evidenceText.match(urlRegex);
      const isPhone = sig.senderPhone && sig.senderPhone.trim().length > 3;
      
      const value = isPhone 
        ? sig.senderPhone.trim() 
        : (match ? match[0].trim() : sig.evidenceText.trim());
      
      const type: "phone" | "domain" | "text_pattern" = isPhone 
        ? "phone" 
        : (match ? "domain" : "text_pattern");

      // Check if this vector value is already enrolled in signature threats database
      const isAlreadyInGlobalSignatures = threats.some(t => t.value.trim().toLowerCase() === value.toLowerCase());

      if (!list[value]) {
        list[value] = {
          value,
          type,
          occurrences: 1,
          locations: [sig.location],
          associatedAgents: [sig.agentName || sig.deviceId],
          timestampFirst: sig.timestamp,
          timestampLast: sig.timestamp,
          subSignals: [sig],
          isAlreadyInGlobalSignatures
        };
      } else {
        list[value].occurrences += 1;
        list[value].subSignals.push(sig);
        if (!list[value].locations.includes(sig.location)) {
          list[value].locations.push(sig.location);
        }
        if (!list[value].associatedAgents.includes(sig.agentName || sig.deviceId)) {
          list[value].associatedAgents.push(sig.agentName || sig.deviceId);
        }
        if (new Date(sig.timestamp) < new Date(list[value].timestampFirst)) {
          list[value].timestampFirst = sig.timestamp;
        }
        if (new Date(sig.timestamp) > new Date(list[value].timestampLast)) {
          list[value].timestampLast = sig.timestamp;
        }
      }
    });

    return Object.values(list).sort((a, b) => b.occurrences - a.occurrences);
  }, [mobileSignals, threats]);

  // Sync details input when selecting a vector
  useEffect(() => {
    if (selectedVector) {
      setOverrideType(selectedVector.type);
      setOverrideSeverity(selectedVector.occurrences >= 2 ? "Critical" : "Medium");
      setOverrideLocation(selectedVector.locations[0] || "Lomé");
      setOverrideDetails(
        selectedVector.occurrences >= 2
          ? `Ajout automatique sécurisé. Seuil de confirmation multi-agent atteint (${selectedVector.occurrences} détections).`
          : `Ajout manuel expert. Surpassement de sécurité malgré 1 seule détection d'alarme.`
      );
    }
  }, [selectedVector]);

  // Keep select state up-to-date or select first on load if none selected
  useEffect(() => {
    if (groupedVectors.length > 0) {
      const currentSelectedExists = selectedVector && groupedVectors.some(v => v.value === selectedVector.value);
      if (!currentSelectedExists) {
        setSelectedVector(groupedVectors[0]);
      } else if (selectedVector) {
        // update instance content
        const fresh = groupedVectors.find(v => v.value === selectedVector.value);
        if (fresh) setSelectedVector(fresh);
      }
    } else {
      setSelectedVector(null);
    }
  }, [groupedVectors]);

  // Actions: Automated / Expert Promotes
  const handleDeploySignature = async (vector: GroupedVector, automode: boolean = false) => {
    setActionLoading(vector.value);
    try {
      // Post to /api/threats to insert it into global signatures
      const res = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: automode ? vector.type : overrideType,
          value: vector.value,
          severity: automode ? (vector.occurrences >= 2 ? "Critical" : "Medium") : overrideSeverity,
          details: automode 
            ? `Seuil de recoupement automatique atteint (${vector.occurrences} occurrences territoriales).`
            : overrideDetails,
          location: automode ? (vector.locations[0] || "Lomé") : overrideLocation,
          status: "active"
        })
      });

      const threatData = await res.json();
      if (threatData.success) {
        // Approve associated mobile signals in the backend db so they disappear from incoming pending list
        for (const sig of vector.subSignals) {
          await fetch(`/api/signals/${sig.id}/approve`, { method: "POST" });
        }

        alert(`[SUCCÈS] Le vecteur suspect "${vector.value}" a été validé et injecté dans le pare-feu global de signatures.`);
        setSelectedVector(null);
        if (onRefreshData) onRefreshData();
      } else {
        alert(threatData.error || "Une erreur est survenue lors du déploiement de l'indicateur.");
      }
    } catch (e) {
      console.error(e);
      alert("Une erreur de communication est survenue.");
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Discard / Classification sans suite (False Positive)
  const handleDiscardAsFalsePositive = async (vector: GroupedVector) => {
    const isCoordinated = vector.occurrences >= 2;
    const confirmMsg = isCoordinated 
      ? `ATTENTION: Ce vecteur a reçu ${vector.occurrences} signalements concordants d'agents mobiles. Êtes-vous certain de vouloir l'ignorer et le classer comme FAU-POSITIF ?`
      : `Voulez-vous classer ce signalement de "${vector.value}" sans suite et le supprimer des alertes d'agents mobiles ?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(vector.value);
    try {
      // Delete the pending signals from backend
      for (const sig of vector.subSignals) {
        await fetch(`/api/signals/${sig.id}`, { method: "DELETE" });
      }

      alert(`Le vecteur "${vector.value}" a été classé comme FAUX POSITIF. Les notifications correspondantes ont été nettoyées.`);
      setSelectedVector(null);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error(e);
      alert("Erreur de suppression.");
    } finally {
      setActionLoading(null);
    }
  };

  // Heuristic scam words matcher for Togolese contexts
  const heuristicScore = useMemo(() => {
    if (!selectedVector) return 0;
    
    // Joint texts
    const textSample = selectedVector.subSignals.map(s => s.evidenceText.toLowerCase()).join(" ");
    let points = 25; // baseline threat probability
    
    const highRiskKeywords = [
      "gagné", "gagner", "lotto", "félicitation", "félicitations", "million", 
      "moov", "tmoney", "togocom", "flooz", "yas", "portefeuille", "suspendu", 
      "bloqué", "confirmez", "transfert", "crédit", "suspension", "code secret"
    ];

    highRiskKeywords.forEach(word => {
      if (textSample.includes(word)) {
        points += 15;
      }
    });

    if (selectedVector.occurrences >= 2) {
      points += 30; // severe confirmation boost
    }

    return Math.min(points, 99);
  }, [selectedVector]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Information */}
      <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-mono uppercase">
              <Scale className="w-5 h-5 text-[#EF4444]" />
              Centre d&apos;Investigation &bull; Régulateur Anti-Faux Positifs
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1 font-sans">
              Évite le blocage d&apos;abonnés légitimes (amis non enregistrés, messages de civils) en obligeant à un recoupement d&apos;au moins 2 signalements d&apos;agents mobiles indépendants ou à un surpassement manuel par l&apos;administrateur après audit sémantique.
            </p>
          </div>
          
          <button
            onClick={() => {
              if (selectedVector) {
                setShowDocModal(true);
              } else {
                alert("Veuillez sélectionner un vecteur dans le panneau pour éditer un rapport.");
              }
            }}
            disabled={!selectedVector}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#1A2542] disabled:text-[#94A3B8]/30 cursor-pointer text-white rounded-lg text-xs font-mono font-bold tracking-wider flex items-center gap-2 transition uppercase shrink-0"
          >
            <FileText className="w-4 h-4 text-white" />
            ÉDITER LE RAPPORT PDF
          </button>
        </div>
      </div>

      {/* TWO SECTIONS LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start leading-relaxed text-xs">
        
        {/* =========================================================================
            SECTION 1: VECTEURS DÉTECTÉS PAR LES AGENTS (SYSTEME DE CONFIRMATION)
            ========================================================================= */}
        <div className="xl:col-span-5 bg-[#121A2F] border border-white/5 rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2 font-mono">
                <HardDrive className="w-4 h-4 text-[#3B82F6]" />
                1. Vecteurs Détectés par les Agents
              </h4>
              <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">Boite de réception des alertes agents filtrées.</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] uppercase font-bold border border-blue-500/20">
              {groupedVectors.length} En attente
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {groupedVectors.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono italic flex flex-col items-center justify-center space-y-2 border border-dashed border-white/5 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-emerald-500/40" />
                <span className="text-[11px]">Aucun signalement suspect en attente de traitement.</span>
                <p className="text-[10px] text-slate-600 max-w-xs font-sans">Tous les réseaux mobiles togolais coopèrent dans un canal sain.</p>
              </div>
            ) : (
              groupedVectors.map((vector, index) => {
                const isConfirmed = vector.occurrences >= 2;
                const isSelected = selectedVector?.value === vector.value;

                return (
                  <div 
                    key={index}
                    onClick={() => setSelectedVector(vector)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-3 ${
                      isSelected 
                        ? "bg-[#1E293B]/90 border-blue-500/60 shadow-lg text-white" 
                        : "bg-[#0B1020]/50 border-white/5 hover:border-slate-700 hover:bg-[#0B1020]/90 text-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 max-w-[70%]">
                        {vector.type === "phone" ? (
                          <Smartphone className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-400"}`} />
                        ) : vector.type === "domain" ? (
                          <Globe className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-400"}`} />
                        ) : (
                          <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-400"}`} />
                        )}
                        <span className="font-mono font-bold break-all text-[11.5px] tracking-wide select-all">
                          {vector.value}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono uppercase">
                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                            CONFIRMÉ ({vector.occurrences})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono uppercase">
                            SUSPECT (1)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span className="font-mono">
                        Villes: <strong className="text-slate-300 uppercase">{vector.locations.join(", ")}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-blue-400 group hover:underline">
                        Ouvrir le dossier <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                      </span>
                    </div>

                    {/* Highly dynamic automated prompt to deployment */}
                    {isConfirmed && !vector.isAlreadyInGlobalSignatures && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeploySignature(vector, true);
                        }}
                        disabled={actionLoading !== null}
                        className="w-full mt-1.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/90 hover:text-white text-emerald-400 border border-emerald-500/30 font-bold rounded-lg text-[10px] font-mono uppercase transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Déployer automatiquement
                      </button>
                    )}

                    {vector.isAlreadyInGlobalSignatures && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-500 font-mono italic">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Déjà deployé dans la base nationale
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: ANALYSE MANUELLE EXPRESS & EXPERT OVERRULE
            ========================================================================= */}
        <div className="xl:col-span-7 bg-[#121A2F] border border-white/5 rounded-xl p-5 space-y-5 shadow-md">
          
          {selectedVector ? (
            <div className="space-y-5 animate-fade-in">
              
              {/* Suspect Identification Sheet Header */}
              <div className="border-b border-white/5 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] text-[#94A3B8] uppercase font-mono font-bold tracking-widest block">DOSSIER INTERACTIVE FORENSIQUE</span>
                    <h3 className="text-sm font-black font-mono tracking-wider text-white break-all flex items-center gap-2 mt-0.5">
                      <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                      {selectedVector.value}
                    </h3>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDocModal(true)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-lg text-[10px] font-mono text-slate-300 font-bold flex items-center gap-1 uppercase tracking-wide cursor-pointer transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleDiscardAsFalsePositive(selectedVector)}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 uppercase tracking-wide cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Classer / Faux Positif
                    </button>
                  </div>
                </div>
              </div>

              {/* Layout for evaluation and form validation */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Visual Gauge on Fraud Probability / Risk estimation (Left 5 cols) */}
                <div className="md:col-span-5 space-y-4 font-mono">
                  <div className="bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-3">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">INDICE DE CONFIANCE FRAUDE</span>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold font-mono">
                        <span className="text-slate-300 font-bold">Probabilité d&apos;arnaque :</span>
                        <span className={`text-base font-extrabold ${heuristicScore > 80 ? "text-rose-500" : "text-amber-500 animate-pulse"}`}>
                          {heuristicScore}%
                        </span>
                      </div>
                      
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${heuristicScore > 80 ? "bg-rose-500" : "bg-amber-500"}`}
                          style={{ width: `${heuristicScore}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-[#94A3B8] font-sans leading-relaxed">
                      {selectedVector.occurrences >= 2 
                        ? "🚨 VALIDATION CONFIRMÉE : Détecté auprès de multiples agents à Lomé et/ou des provinces du Togo. Risque sociétal confirmé."
                        : "⚠️ RISQUE DE FAUX POSITIF : L'indicateur n'a été intercepté qu'une fois. Pour garantir que ce ne soit pas un envoi valide de portefeuille ou une mauvaise saisie de l'alarme, un audit méticuleux est recommandé."
                      }
                    </p>
                  </div>

                  <div className="space-y-1 bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl text-[10px] text-slate-300">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider mb-2">TRAÇABILITÉ CHRONO</span>
                    <div className="space-y-1 leading-normal font-sans">
                      <div>Premier dépôt: <strong className="font-mono text-slate-400 block">{new Date(selectedVector.timestampFirst).toLocaleString("fr-FR")}</strong></div>
                      <div className="pt-1.5 border-t border-white/5 mt-1.5">Dernier dépôt: <strong className="font-mono text-slate-400 block">{new Date(selectedVector.timestampLast).toLocaleString("fr-FR")}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Live intercepts messages (Right 7 cols) */}
                <div className="md:col-span-7 bg-[#0B1020]/45 border border-white/5 p-4 rounded-xl space-y-3 max-h-[280px] overflow-y-auto">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">
                    TEXTES CAPTÉS AUX CITOYENS ({selectedVector.subSignals.length}) :
                  </span>
                  
                  <div className="space-y-3">
                    {selectedVector.subSignals.map((sig, sIndex) => (
                      <div key={sig.id || sIndex} className="p-2.5 bg-slate-900/50 border border-white/5 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                          <span className="text-slate-300 font-bold">{sig.agentName || sig.deviceId}</span>
                          <span>{sig.location} &bull; {new Date(sig.timestamp).toLocaleTimeString("fr-FR")}</span>
                        </div>
                        <p className="text-[11px] font-sans italic text-slate-200 leading-normal">
                          &ldquo;{sig.evidenceText}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Validation panel (with manual customizable configuration) */}
              <div className="bg-[#0B1020]/30 border border-indigo-500/10 p-5 rounded-xl space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block font-mono">
                  SÉCURISATION &amp; CONFIGURATION DE LA SIGNATURE NATIONALE
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1 font-mono">
                    <label className="text-[10.5px] text-[#94A3B8]">Type de menace : label</label>
                    <select
                      value={overrideType}
                      onChange={(e) => setOverrideType(e.target.value as any)}
                      className="w-full bg-[#0B1020] border border-white/5 p-2 rounded text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="phone">Vecteur Fraude Mobile (Phone)</option>
                      <option value="domain">Vecteur Internet Hack (Domain)</option>
                      <option value="text_pattern">Sémantique Spams (Text Pattern)</option>
                    </select>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[10.5px] text-[#94A3B8]">Sévérité du blocage :</label>
                    <select
                      value={overrideSeverity}
                      onChange={(e) => setOverrideSeverity(e.target.value as any)}
                      className="w-full bg-[#0B1020] border border-white/5 p-2 rounded text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Low">Faible (Warning)</option>
                      <option value="Medium">Moyenne (Moderated)</option>
                      <option value="Critical">Critique (Immediate Block)</option>
                    </select>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[10.5px] text-[#94A3B8]">Focalisation Territoire :</label>
                    <input
                      type="text"
                      value={overrideLocation}
                      onChange={(e) => setOverrideLocation(e.target.value)}
                      className="w-full bg-[#0B1020] border border-white/5 p-2 rounded text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-[10.5px] text-[#94A3B8]">Commentaires administratifs d&apos;inscription :</label>
                  <textarea
                    value={overrideDetails}
                    onChange={(e) => setOverrideDetails(e.target.value)}
                    rows={2}
                    className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                {/* Combined Actions block */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleDiscardAsFalsePositive(selectedVector)}
                    className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 hover:text-white text-slate-300 font-mono text-xs font-bold border border-white/5 rounded-lg transition uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    Rejeter &bull; Faux Positif
                  </button>

                  <button
                    onClick={() => handleDeploySignature(selectedVector, false)}
                    disabled={actionLoading !== null}
                    className="w-full sm:w-auto py-2.5 px-6 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-mono text-xs font-bold rounded-lg tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                    {selectedVector.occurrences >= 2 
                      ? "Valider & Déployer la menace" 
                      : "Forcer l'Inscription Manuelle (Surpassement)"
                    }
                  </button>
                </div>

              </div>

            </div>
          ) : (
            <div className="py-24 border border-dashed border-white/5 rounded-xl text-center text-slate-600 min-h-[450px] flex flex-col items-center justify-center bg-[#0B1020]/15">
              <Activity className="w-12 h-12 mb-3 text-slate-700 animate-pulse" />
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#94A3B8] font-mono">
                En attente de Ciblage Forensique
              </span>
              <p className="text-[11px] mt-2 font-sans max-w-xs leading-relaxed text-[#94A3B8]/60">
                La zone de recoupement automatique lutte contre les faux positifs. Veuillez sélectionner une alerte d&apos;agent à gauche pour déployer l&apos;interface d&apos;investigation.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* =========================================================================
          JUDICIAL REPORT PERSONALISATION MODAL
          ========================================================================= */}
      {showDocModal && selectedVector && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#121A2F] border border-white/5 rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col justify-between shadow-2xl overflow-hidden animate-fade-in">
            
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0B1020]/60">
              <div className="flex items-center gap-2">
                <FileBadge className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">RÉQUISITION &bull; CONFIGURATEUR JURIDIQUE OFFICIEL</h3>
              </div>
              <button 
                onClick={() => setShowDocModal(false)}
                className="text-[#94A3B8] hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Config Form and Preview Section */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed text-xs">
              
              {/* Form Input (Left 4 columns) */}
              <div className="md:col-span-4 space-y-4 font-mono">
                <span className="text-[10px] text-[#94A3B8] tracking-widest block uppercase font-bold">Autorité du District de Lomé :</span>

                <div className="space-y-1">
                  <label className="text-[#94A3B8] block text-[10px]">Magistrat Destinataire :</label>
                  <input
                    type="text"
                    value={magistrateName}
                    onChange={(e) => setMagistrateName(e.target.value)}
                    className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded text-[#E5E7EB] text-xs focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#94A3B8] block text-[10px]">Autorité de Police (OPJ) :</label>
                  <input
                    type="text"
                    value={opjName}
                    onChange={(e) => setOpjName(e.target.value)}
                    className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded text-[#E5E7EB] text-xs focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#94A3B8] block text-[10px]">Vecteur Juridique (Togo) :</label>
                  <textarea
                    value={legalReference}
                    onChange={(e) => setLegalReference(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0B1020] border border-white/5 p-2 rounded text-[#E5E7EB] text-xs focus:outline-none focus:border-[#3B82F6]"
                  ></textarea>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-2">
                  <button
                    onClick={handlePrint}
                    className="w-full py-3 bg-[#10B981] hover:bg-[#10B981]/90 active:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold tracking-wide transition uppercase text-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    IMPRIMER / SAUVER EN PDF
                  </button>
                  <p className="text-[10px] text-slate-500 leading-normal font-sans">
                    Le module convertit automatiquement la mise en page en un format de réquisition judiciaire officiel. Sélectionnez <strong>&quot;Enregistrer au format PDF&quot;</strong> dans la fenêtre d&apos;impression.
                  </p>
                </div>
              </div>

              {/* Printable Document Preview (Right 8 columns) */}
              <div className="md:col-span-8 bg-white text-slate-900 p-8 rounded-lg shadow-xl overflow-y-auto max-h-[500px] font-sans printable-area border border-slate-200 text-left">
                
                {/* Official Togo Letterhead */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div className="text-center font-serif text-[10px] space-y-0.5 uppercase tracking-wide">
                    <strong className="block text-xs font-bold font-sans text-stone-900">RÉPUBLIQUE TOGOLAISE</strong>
                    <span className="block text-[8px] text-slate-600 tracking-widest font-sans font-bold">Travail - Liberté - Patrie</span>
                    <span className="block font-sans lowercase text-[8px] text-slate-500">-----</span>
                    <strong className="block font-sans text-[8px] text-stone-850">MINISTÈRE DE LA SÉCURITÉ ET DE LA PROTECTION CIVILE</strong>
                    <span className="block text-[8px] font-sans font-extrabold text-slate-700">CENTRE NATIONAL DU PLAN DE RECOUPEMENT DES FRAUDES (SOC PHISHING TG)</span>
                    <span className="block text-slate-500 font-mono text-[8px]">Ref: TG-SOC-FORENSIC-{Math.floor(1000 + Math.random() * 9000)}</span>
                  </div>

                  <div className="text-right text-[10px] space-y-0.5 font-sans whitespace-nowrap">
                    <span className="block font-bold">LOMÉ, le {new Date().toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    <span className="block text-rose-600 font-extrabold text-[8px] border border-rose-300 px-1 rounded inline-block bg-rose-50 text-right">DIFFUSION RESTREINTE / JUSTICE</span>
                    <span className="block text-slate-600 mt-1">Zone Chronologie: Togo GMT Network</span>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center my-6 space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-widest border-y-2 border-double border-slate-400 py-2.5">
                    RECOUPEMENT FORENSIQUE ET MANDAT ENQUÊTEUR TG
                  </h2>
                  <span className="text-[9px] font-mono text-slate-600 block">Attribution d&apos;ingénierie sociale criminelle et de menaces par recoupement multi-agents</span>
                </div>

                {/* Addressees */}
                <div className="space-y-2 text-[10px] mb-6">
                  <div>
                    <span className="font-bold underline">Pour :</span>
                    <span className="block mt-0.5 font-semibold text-slate-800">{magistrateName}</span>
                  </div>
                  <div>
                    <span className="font-bold underline">Rapporteur / Enquêteur principal :</span>
                    <span className="block mt-0.5 font-semibold text-slate-800">{opjName}</span>
                  </div>
                  <div>
                    <span className="font-bold underline">Régime juridique d&apos;attribution :</span>
                    <span className="block mt-0.5 text-slate-700">{legalReference}</span>
                  </div>
                </div>

                {/* Core forensic facts of selected cluster */}
                <div className="space-y-4 text-[11px] font-sans">
                  <h3 className="text-[10px] font-extrabold uppercase border-b border-slate-900 pb-1">I. Établissement technique de la menace</h3>
                  
                  <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold w-40">Identificateur inspecté :</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-900 break-all">{selectedVector.value}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Type d’IoC enregistré :</td>
                        <td className="py-2 px-3 font-mono uppercase">{selectedVector.type}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Volume d’occurrences :</td>
                        <td className="py-2 px-3 font-bold text-rose-600">{selectedVector.occurrences} signalements coordonnés</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Localisations d’impact :</td>
                        <td className="py-2 px-3 font-semibold">{selectedVector.locations.join(", ")}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 bg-slate-100 font-bold">Agents mobiles intercepteurs :</td>
                        <td className="py-2 px-3 font-mono break-all">{selectedVector.associatedAgents.join(" // ") || "Réseau Intercepteur National"}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="text-[10px] font-extrabold uppercase border-b border-slate-900 pb-1 mt-6">II. Chronologie de propagation (Togo GMT Network Clock)</h3>
                  <div className="space-y-2 bg-slate-50 p-4 border border-slate-200 rounded text-[10.5px]">
                    <p className="leading-relaxed">
                      L&apos;analyseur d&apos;empreintes cybernétiques du SOC PHISHING TG atteste que le premier signal a été détecté le <strong>{new Date(selectedVector.timestampFirst).toLocaleString("fr-FR")} GMT</strong> et le plus récent le <strong>{new Date(selectedVector.timestampLast).toLocaleString("fr-FR")} GMT</strong>.
                    </p>
                    <p className="mt-1 font-semibold text-rose-700">
                      Vecteur de propagation d&apos;usurpation ou piège de contact identifié :
                    </p>
                    <p className="text-slate-700 font-serif leading-relaxed italic bg-white p-3 border border-slate-200 rounded mt-1">
                      {selectedVector.type === "text_pattern" ? (
                        "Alerte sociétale critique : Tentative d'ingénierie physique et de manipulation par ruse visant les abonnés. Le motif textuel décèle un modus operandi de détournement ou d'embuscades à l'intérieur du territoire togolais."
                      ) : selectedVector.type === "phone" ? (
                        "Vol financier de fonds et d'avoirs mobiles (usurpation de Moov Africa Money / Flooz ou Tmoney) ciblant les citoyens togolais par des faux gains de loterie ou lotto énergétiques."
                      ) : (
                        "Vecteur de phishing cloné usurpant l'identité d'acteurs reconnus (CEET, OTR ou CNSS) à des fin d'extorsion de paiements ou d'authentification."
                      )}
                    </p>
                  </div>

                  <h3 className="text-[10px] font-extrabold uppercase border-b border-slate-900 pb-1 mt-6">III. Recommandation administrative &amp; Mandat technique</h3>
                  <p className="text-[10.5px] leading-relaxed text-slate-700 font-serif">
                    Vu les éléments de recoupement techniques collectés par le pare-feu central du SOC PHISHING TG, l&apos;officier rapporteur requiert :
                    <br />
                    1. Le blocage d&apos;urgence de tous les serveurs et sous-réseaux rattachés à la signature <strong>{selectedVector.value}</strong>.
                    <br />
                    2. La saisine immédiate des opérateurs de télécommunication togolais aux fins de gel et suspension de toutes les transactions mobiles impliquant le numéro suspect.
                    <br />
                    3. La transmission de ces faisceaux de preuves numériques à la brigade compétente pour flagrant délit.
                  </p>
                </div>

                {/* Signatures block */}
                <div className="flex justify-between items-center pt-8 border-t border-slate-400 mt-8 text-[10px]">
                  <div className="text-center font-mono">
                    <span className="block text-slate-500 text-[9px]">L&apos;ADMINISTRATEUR SOC PHISHING TG</span>
                    <strong className="block text-slate-800 mt-6">[SIGNATURE NUMÉRIQUE VALIDE]</strong>
                    <span className="block text-slate-500 text-[8px]">Sceau d&apos;intégrité forensique #KFL</span>
                  </div>

                  <div className="text-center font-mono">
                    <span className="block text-slate-500 text-[9px]">L&apos;OFFICIER OPJ RAPPORTETTE</span>
                    <strong className="block text-slate-800 mt-6 md:mt-8">________________________</strong>
                    <span className="block text-slate-500 text-[8px]">Visa officiel ANCY / Gendarmerie</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex justify-end bg-[#0B1020]/40">
              <button
                onClick={() => setShowDocModal(false)}
                className="py-2 px-4 bg-[#1A2542] hover:bg-[#1A2542]/80 font-mono text-xs text-white rounded-lg uppercase tracking-wider transition cursor-pointer"
              >
                Fermer l&apos;Éditeur de Rapport
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
