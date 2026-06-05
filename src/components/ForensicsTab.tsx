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
  ChevronRight,
  HardDrive,
  Trash2,
  Check,
  AlertCircle
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

export default function ForensicsTab({ forensicsData, threats, campaigns, agents, mobileSignals = [], onRefreshData }: Props) {
  const [showDocModal, setShowDocModal] = useState(false);
  const [correlationReportSignal, setCorrelationReportSignal] = useState<MobileSignal | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Investigation optimization states (judicial multi-agent filters & anti-DDoS observation)
  const [onlyShowCoordinated, setOnlyShowCoordinated] = useState(true);
  const [rogueAgentBlocked, setRogueAgentBlocked] = useState(false);
  const [activeObservationRate, setActiveObservationRate] = useState(58);

  const filteredMobileSignals = useMemo(() => {
    return mobileSignals.filter(sig => {
      // Check if this senderPhone is repeated in other mobiles
      const otherMobilesSharing = sig.senderPhone 
        ? mobileSignals.filter(s => s.senderPhone === sig.senderPhone && s.deviceId !== sig.deviceId) 
        : [];
      const isRepeated = otherMobilesSharing.length > 0;

      if (onlyShowCoordinated) {
        return isRepeated;
      }
      return true;
    });
  }, [mobileSignals, onlyShowCoordinated]);

  const handleApproveSignal = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/signals/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (onRefreshData) onRefreshData();
      } else {
        alert(data.error || "Une erreur est survenue lors de l'approbation.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSignal = async (id: string) => {
    if (!confirm("Voulez-vous vraiment rejeter et supprimer ce rapport d'attaque mobile ?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/signals/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (onRefreshData) onRefreshData();
      } else {
        alert(data.error || "Une erreur est survenue lors du rejet.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const relatedSignals = useMemo(() => {
    if (!correlationReportSignal) return [];
    const val = correlationReportSignal.senderPhone;
    if (!val) {
      return mobileSignals.filter(s => s.evidenceText === correlationReportSignal.evidenceText);
    }
    return mobileSignals.filter(s => s.senderPhone === val || s.evidenceText.includes(val));
  }, [mobileSignals, correlationReportSignal]);
  
  // Selected signature for the active tracing & tracking station ("Pister")
  const [selectedTraceKey, setSelectedTraceKey] = useState<string>("");

  // Forensics sub-tabs and suspect details tracking "one-by-one"
  const [forensicsTab, setForensicsTab] = useState<"correlations" | "profiling" | "antiflood">("correlations");
  const [suspectTypeFilter, setSuspectTypeFilter] = useState<"all" | "phone" | "domain">("all");
  const [suspectIndex, setSuspectIndex] = useState(0);

  const combinedSuspects = useMemo(() => {
    const list: Array<{ value: string; count: number; type: "phone" | "domain"; description: string }> = [];
    
    if (forensicsData?.topPhones) {
      forensicsData.topPhones.forEach(p => {
        list.push({
          value: p.value,
          count: p.count,
          type: "phone",
          description: "Numéro de téléphone surveillé actif suspecté d'infractions d'argent mobile (Moov Africa / T-money) à Lomé ou en région."
        });
      });
    }
    
    if (forensicsData?.topLinks) {
      forensicsData.topLinks.forEach(l => {
        list.push({
          value: l.value,
          count: l.count,
          type: "domain",
          description: "Nom de domaine ou URL de phishing usurpant des administrations publiques ou opérateurs du Togo."
        });
      });
    }

    return list.filter(item => {
      if (suspectTypeFilter === "all") return true;
      return item.type === suspectTypeFilter;
    });
  }, [forensicsData, suspectTypeFilter]);

  // Adjust suspectIndex if it goes out of bounds when changing filters
  useEffect(() => {
    setSuspectIndex(0);
  }, [suspectTypeFilter]);

  // Custom judicial report form configuration
  const [magistrateName, setMagistrateName] = useState("M. le Procureur de la République près le Tribunal de Lomé");
  const [opjName, setOpjName] = useState("Commandant de la Brigade de Recherche de la Cybergendarmerie de Lomé");
  const [legalReference, setLegalReference] = useState("Loi n° 2018-026 du 07 décembre 2018 sur la cybersécurité au Togo (Code Numérique)");

  // Clustering Engine - Groups identical threat signatures detected across different times/agents/locations
  const signatureClusters = useMemo(() => {
    const list: Record<string, {
      value: string;
      type: "domain" | "ip" | "email" | "phone" | "text_pattern";
      severity: "Low" | "Medium" | "Critical";
      firstSeen: string;
      lastSeen: string;
      locations: string[];
      associatedAgents: string[];
      occurrences: number;
      rawThreats: Threat[];
    }> = {};

    threats.forEach(t => {
      const key = t.value.trim();
      if (!list[key]) {
        list[key] = {
          value: t.value,
          type: t.type,
          severity: t.severity,
          firstSeen: t.detectedAt,
          lastSeen: t.detectedAt,
          locations: [t.location],
          associatedAgents: [],
          occurrences: 1,
          rawThreats: [t]
        };
      } else {
        list[key].occurrences += 1;
        list[key].rawThreats.push(t);
        
        if (new Date(t.detectedAt) < new Date(list[key].firstSeen)) {
          list[key].firstSeen = t.detectedAt;
        }
        if (new Date(t.detectedAt) > new Date(list[key].lastSeen)) {
          list[key].lastSeen = t.detectedAt;
        }
        if (!list[key].locations.includes(t.location)) {
          list[key].locations.push(t.location);
        }
      }
    });

    // Map connected mobile agents dynamically by city matching or location overlap
    Object.values(list).forEach(c => {
      const agentsInCities = agents
        .filter(a => c.locations.includes(a.city))
        .map(a => `${a.name} (${a.city})`);
      c.associatedAgents = Array.from(new Set(agentsInCities));
    });

    return Object.values(list).sort((a, b) => b.occurrences - a.occurrences);
  }, [threats, agents]);

  // Set the default trace key to the most prolific cluster if none exists
  useMemo(() => {
    if (!selectedTraceKey && signatureClusters.length > 0) {
      setSelectedTraceKey(signatureClusters[0].value);
    }
  }, [signatureClusters, selectedTraceKey]);

  // Retrieve details of the threat target selected for "Pister" investigation
  const activeTrace = useMemo(() => {
    if (!selectedTraceKey) return null;
    return signatureClusters.find(c => c.value === selectedTraceKey) || null;
  }, [signatureClusters, selectedTraceKey]);

  // Pre-formatted Incident stats for general overview
  const coreStats = useMemo(() => {
    const totalCount = threats.length;
    
    // Group campaigns and check count
    const campaignStats = campaigns.map(c => {
      const matchThreats = threats.filter(t => t.campaignId === c.id);
      return {
        name: c.name,
        count: matchThreats.length,
        criticalCount: matchThreats.filter(t => t.severity === "Critical").length
      };
    }).sort((a, b) => b.count - a.count);

    return {
      totalCount,
      campaignStats,
      activeCampaigns: campaigns.filter(c => c.status === "Active").length
    };
  }, [threats, campaigns]);

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
              <Scale className="w-5 h-5 text-[#3B82F6]" />
              Intelligence Forensique &amp; Corrélateur Judiciaire
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1 font-mono">
              Agrégation des signatures d&apos;attaques redondantes interceptées sur différents agents mobiles à travers le Togo et configuration de faisceaux de preuves pour les parquets.
            </p>
          </div>

          <button
            onClick={() => setShowDocModal(true)}
            disabled={!activeTrace}
            className="px-4 py-2.5 bg-[#3B82F6] hover:bg-[#3B82F6]/80 disabled:bg-[#1A2542] disabled:text-[#94A3B8]/30 cursor-pointer text-white rounded-lg text-[11px] font-mono font-bold tracking-wider flex items-center gap-2 transition uppercase shrink-0"
          >
            <FileText className="w-4 h-4 text-white" />
            ÉDITER LE RAPPORT JUDICIAIRE PDF
          </button>
        </div>
      </div>

      {/* Sub-tabs menu for forensics zone */}
      <div className="flex border-b border-white/5 w-full bg-[#121A2F]/40 rounded-t-xl overflow-hidden">
        <button 
          onClick={() => setForensicsTab("correlations")}
          className={`flex-1 py-3.5 font-mono text-[10px] font-bold flex items-center justify-center gap-2 border-b-2 transition-all duration-200 cursor-pointer ${forensicsTab === "correlations" ? "border-[#3B82F6] text-white bg-[#3B82F6]/5 font-extrabold" : "border-transparent text-[#94A3B8] hover:text-[#E5E7EB]"}`}
        >
          <Scale className="w-4 h-4 text-[#3B82F6]" />
          1. RECOUPEMENTS DE SIGNATURES
        </button>
        <button 
          onClick={() => setForensicsTab("profiling")}
          className={`flex-1 py-3.5 font-mono text-[10px] font-bold flex items-center justify-center gap-2 border-b-2 transition-all duration-200 cursor-pointer ${forensicsTab === "profiling" ? "border-[#3B82F6] text-white bg-[#3B82F6]/5 font-extrabold" : "border-transparent text-[#94A3B8] hover:text-[#E5E7EB]"}`}
        >
          <Users className="w-4 h-4 text-[#06B6D4]" />
          2. AUDIT UNIT (PROFILAGE SUSPECTS)
        </button>
        <button 
          onClick={() => setForensicsTab("antiflood")}
          className={`flex-1 py-3.5 font-mono text-[10px] font-bold flex items-center justify-center gap-2 border-b-2 transition-all duration-200 cursor-pointer ${forensicsTab === "antiflood" ? "border-[#3B82F6] text-white bg-[#3B82F6]/5 font-extrabold" : "border-transparent text-[#94A3B8] hover:text-[#E5E7EB]"}`}
        >
          <Activity className="w-4 h-4 text-[#EF4444] animate-pulse" />
          3. STATION ANTI-FLOOD DDOS
        </button>
      </div>

      {/* SUB-TAB 1: CORRELATIONS (RECOUPEMENTS ET CORRELATIONS) */}
      {forensicsTab === "correlations" && (
        <div className="space-y-6 animate-fade-in text-xs">
          
          {/* Quick Explanatory Guide Banner */}
          <div className="bg-[#121A2F]/70 border border-white/5 p-5 rounded-xl space-y-1.5 shadow-sm">
            <span className="text-[10px] font-mono text-[#3B82F6] uppercase font-extrabold tracking-widest block font-sans">GUIDE DE RECOUPEMENT ET PREUVES</span>
            <p className="text-[#94A3B8] leading-relaxed font-sans text-xs">
              Cette sous-session regroupe les IoC (Indicateurs de Compromission) similaires détectés par différents agents de renseignement sur le territoire togolais. En cliquant sur <strong>&quot;PISTER&quot;</strong>, vous ciblez un suspect pour inspecter sa géographie de propagation et générez un rapport d&apos;infraction formel prêt à être imprimé ou exporté au format PDF pour les procureurs ou l&apos;ANCY.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Left Side: Clustering table (7 columns) */}
            <div className="xl:col-span-7 bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-md">
              <div>
                <h4 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                  <HardDrive className="w-4 h-4 text-[#3B82F6]" />
                  EMPREINTES EN RECOUPEMENT MULTI-AGENTS
                </h4>
                <p className="text-xs text-[#94A3B8] mt-1 font-mono">Signatures identiques interceptées par différents terminaux ou à plusieurs repères géographiques.</p>
              </div>

              <div className="overflow-x-auto border border-white/5 rounded-lg bg-[#0B1020]/25">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0B1020]/45 border-b border-[#1A2542] text-[10px] text-slate-500 uppercase">
                      <th className="py-3 px-3">Valeur de l&apos;IoC</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3 text-center">Interceptions</th>
                      <th className="py-3 px-3">Territoires touchés</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {signatureClusters.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-mono italic">
                          Aucune signature disponible pour des recoupements forensiques.
                        </td>
                      </tr>
                    ) : (
                      signatureClusters.map((cluster, idx) => (
                        <tr 
                          key={idx} 
                          className={`hover:bg-[#1A2542]/45 transition cursor-pointer ${selectedTraceKey === cluster.value ? "bg-[#1A2542] text-white font-bold" : ""}`}
                          onClick={() => setSelectedTraceKey(cluster.value)}
                        >
                          <td className="py-3 px-3 font-semibold break-all max-w-[170px]">{cluster.value}</td>
                          <td className="py-3 px-3 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-[#1A2542] text-[#94A3B8] uppercase border border-white/5">
                              {cluster.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-[#3B82F6]">{cluster.occurrences}</td>
                          <td className="py-3 px-3 text-[10px] text-[#94A3B8]">
                            {cluster.locations.join(", ")}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button 
                              onClick={() => setSelectedTraceKey(cluster.value)}
                              className="px-2.5 py-1 bg-[#1A2542] hover:bg-[#1A2542]/75 border border-white/5 hover:border-[#3B82F6] rounded text-[9px] text-slate-300 hover:text-white uppercase transition inline-flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <Eye className="w-3 h-3 text-[#3B82F6]" /> PISTER
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Side: "Pister" Active station details (5 columns) */}
            <div className="xl:col-span-5 bg-[#121A2F] border border-white/5 rounded-xl p-6 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex items-start gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-widest uppercase font-mono">
                      PISTAGE DE SUSPECT CIBLÉ
                    </h4>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Focaliser la géolocalisation et le diagramme de propagation d&apos;un suspect.</p>
                  </div>
                </div>

                {activeTrace ? (
                  <div className="space-y-5 animate-fade-in text-xs font-mono">
                    
                    {/* Visual Target Pill */}
                    <div className="bg-[#0B1020]/45 p-4 border border-white/5 rounded-xl space-y-2">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">IDENTIFICATEUR REGROUPÉ CC</span>
                      <p className="text-xs font-bold text-[#3B82F6] break-all">{activeTrace.value}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-white/5 text-slate-400">
                        <div>
                          <span>Première interception :</span>
                          <strong className="block text-slate-300 mt-0.5">{new Date(activeTrace.firstSeen).toLocaleDateString("fr-FR")}</strong>
                        </div>
                        <div>
                          <span>Dernière interception :</span>
                          <strong className="block text-slate-300 mt-0.5">{new Date(activeTrace.lastSeen).toLocaleDateString("fr-FR")}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Geographical spread */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">VILLES ET RÉGIONS TOUCHÉES :</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeTrace.locations.map((loc, i) => (
                          <span key={i} className="px-2.5 py-1 bg-[#1A2542] border border-white/5 text-slate-200 rounded text-[10px] flex items-center gap-1 font-mono uppercase font-bold">
                            <MapPin className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                            {loc}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Intercepting devices */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">AGENTS DE CAPTURE CONNECTÉS :</span>
                      {activeTrace.associatedAgents.length === 0 ? (
                        <span className="text-slate-600 italic block text-[11px]">Pas d&apos;agent assignable en ligne.</span>
                      ) : (
                        <div className="space-y-1.5">
                          {activeTrace.associatedAgents.map((agentStr, i) => (
                            <div key={i} className="p-2 bg-[#0B1020]/45 border border-white/5 rounded flex items-center justify-between text-[11px]">
                              <span className="text-slate-300 font-sans">{agentStr}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-[#10B981] font-mono uppercase font-bold border border-[#10B981]/15">Acteurs Heuristiques</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Crime Target warning tags */}
                    <div className="p-3.5 bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-lg space-y-1 text-slate-300">
                      <span className="font-bold block text-[#EF4444] uppercase text-[10px] flex items-center gap-1 font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Évaluation du risque criminel :
                      </span>
                      {activeTrace.type === "phone" && (
                        <p className="leading-normal font-sans text-xs text-[#94A3B8]">
                          Ce numéro de téléphone présente des schémas de compromission d&apos;argent mobile. Au Togo, il est actif sur plusieurs portefeuilles Yas/Moov Africa. Possibilité de réseaux de mules en bande organisée.
                        </p>
                      )}
                      {activeTrace.type === "domain" && (
                        <p className="leading-normal font-sans text-xs text-[#94A3B8]">
                          Hébergement malveillant cloné. Il usurpe directement des organisations d&apos;utilité publique (CEET, OTR, CNSS, Banques) pour détourner des fonds et des identifiants d&apos;administrateurs.
                        </p>
                      )}
                      {activeTrace.type === "text_pattern" && (
                        <p className="leading-normal font-sans text-xs text-[#94A3B8]">
                          <strong>URGENT - RISQUE PHYSIQUE MINEUR / ADULTE :</strong> Ce motif sémantique d&apos;ingénierie sociale utilise des incitations affectives, rendez-vous secrets de détresse ou promesse d&apos;offre d&apos;emplois douteuses. Risque d&apos;embuscades physiques et de traite d&apos;individus sur Lomé.
                        </p>
                      )}
                      {!["phone", "domain", "text_pattern"].includes(activeTrace.type) && (
                        <p className="leading-normal font-sans text-xs text-[#94A3B8]">
                          Anomalie réseau globale. L&apos;indicateur alimente des flux de ransomwares ou Phishing d&apos;identités administratives togolaises.
                        </p>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="p-10 border border-dashed border-white/5 rounded-xl text-center text-slate-600 min-h-[300px] flex flex-col items-center justify-center bg-[#0B1020]/20">
                    <HelpCircle className="w-10 h-10 mb-2 text-slate-700" />
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#94A3B8] font-mono">Abonné en attente de ciblage</span>
                    <p className="text-[11px] mt-2 font-sans max-w-xs leading-relaxed text-[#94A3B8]/60">Cliquez sur un recoupement d&apos;empreintes à gauche pour déployer la station de pistage.</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 mt-4">
                <button
                  onClick={() => setShowDocModal(true)}
                  disabled={!activeTrace}
                  className="w-full py-2.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] font-bold rounded-lg border border-[#EF4444]/20 text-xs font-mono uppercase tracking-wide transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <FileBadge className="w-4 h-4 text-[#EF4444]" />
                  Générer Procès-Verbal Judiciaire (Officiel)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* SUB-TAB 3: PROFILING SUSPECTS (SENSITIVE DATA) */}
      {forensicsTab === "profiling" && (
        <div className="space-y-6 animate-fade-in text-xs">
          
          {/* Quick Guide */}
          <div className="bg-[#121A2F]/70 border border-white/5 p-5 rounded-xl space-y-1.5 shadow-sm">
            <span className="text-[10px] font-mono text-[#06B6D4] uppercase font-extrabold tracking-widest block">UNITE INTERACTIVE DE PROFILING DE SUSPECTS</span>
            <p className="text-[#94A3B8] leading-relaxed font-sans text-xs">
              Pour éviter d&apos;encombrer le poste de commandement et de surcharger l&apos;attention de l&apos;opérateur SOC, cette division de sécurité isole et affiche les suspects les plus importants <strong>un par un</strong> dans un format épuré et hautement contrasté. Utilisez les filtres d&apos;urgence pour basculer entre vecteurs de fraude mobile (téléphone) ou vecteurs web (liens de phishing).
            </p>
          </div>

          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-6 shadow-md">
            
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase font-bold tracking-wider">FILTRER LES SÉQUENCES :</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSuspectTypeFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition cursor-pointer font-bold ${suspectTypeFilter === "all" ? "bg-[#3B82F6] text-white" : "bg-[#0B1020] text-[#94A3B8] border border-white/5"}`}
                >
                  TOUS ({forensicsData?.topPhones?.length + (forensicsData?.topLinks?.length || 0)})
                </button>
                <button
                  onClick={() => setSuspectTypeFilter("phone")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition cursor-pointer font-bold ${suspectTypeFilter === "phone" ? "bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30" : "bg-[#0B1020] text-[#94A3B8] border border-white/5"}`}
                >
                  NUMÉROS DE TÉLÉPHONE ({forensicsData?.topPhones?.length || 0})
                </button>
                <button
                  onClick={() => setSuspectTypeFilter("domain")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition cursor-pointer font-bold ${suspectTypeFilter === "domain" ? "bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30" : "bg-[#0B1020] text-[#94A3B8] border border-white/5"}`}
                >
                  DONNÉES WEB / NOM DE DOMAINES ({forensicsData?.topLinks?.length || 0})
                </button>
              </div>
            </div>

            {/* Suspect individual slider display */}
            {combinedSuspects.length > 0 ? (
              <div className="space-y-6">
                
                {(() => {
                  const suspect = combinedSuspects[suspectIndex];
                  if (!suspect) return null;
                  return (
                    <div className="bg-[#0B1020]/45 border border-white/5 rounded-xl p-8 space-y-6 transition duration-300">
                      
                      {/* Sub-header inside item without unnecessary icons */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 text-xs">
                        <span className="font-mono text-slate-500 uppercase font-bold">
                          PROFIL SUSPECT {suspectIndex + 1} SUR {combinedSuspects.length}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase ${
                          suspect.type === "phone" ? "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20" : "bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/20"
                        } border`}>
                          {suspect.type === "phone" ? "Vecteur Téléphonique / Flooz" : "Vecteur Internet / Phishing"}
                        </span>
                      </div>

                      {/* Giant sus value - clean typography, NO unneeded icons */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-widest block">IDENTIFICATEUR SPECTRE CENTRAL :</span>
                        <div className="text-xl md:text-2xl font-bold font-mono tracking-wide text-white select-all break-all border-l-4 border-[#3B82F6] pl-4 bg-[#0B1020]/80 py-3.5 rounded-r-lg">
                          {suspect.value}
                        </div>
                      </div>

                      {/* Stat Metrics & Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-slate-550 uppercase block">RÉCURRENCE GLOBALE :</span>
                          <span className="text-base font-bold text-[#E5E7EB] font-mono">
                            <span className="text-[#EF4444] font-extrabold">{suspect.count}</span> attaques identifiées
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-slate-550 uppercase block">AVIS DE SÉCURITÉ DU SOC :</span>
                          <span className="text-[11px] font-bold font-mono text-[#EF4444] block mt-0.5">PRIORITÉ ABSOLUE / MENACE DISPONIBLE POUR RETRAIT DNS</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 p-4 bg-[#0B1020]/60 border border-white/5 rounded-lg text-xs leading-relaxed text-slate-300">
                        <span className="font-bold text-[#94A3B8] font-mono text-[9px] uppercase block mb-1">COMPORTEMENT DÉNOTÉ :</span>
                        {suspect.description}
                      </div>

                    </div>
                  );
                })()}

                {/* Progress dot list and next/prev controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <button
                    onClick={() => setSuspectIndex(prev => (prev - 1 + combinedSuspects.length) % combinedSuspects.length)}
                    disabled={combinedSuspects.length <= 1}
                    className="w-full sm:w-auto py-2.5 px-5 bg-[#1A2542] hover:bg-[#1A2542]/80 disabled:opacity-30 disabled:hover:bg-[#1A2542] text-slate-300 font-mono text-xs font-bold border border-white/5 rounded-lg transition uppercase cursor-pointer"
                  >
                    &larr; Suspect Précédent
                  </button>

                  <div className="flex flex-wrap gap-1.5 justify-center max-w-xs sm:max-w-md">
                    {combinedSuspects.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSuspectIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-200 cursor-pointer ${suspectIndex === idx ? "bg-[#3B82F6] scale-125" : "bg-[#1A2542] hover:bg-[#94A3B8]"}`}
                        title={`Aller au suspect ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setSuspectIndex(prev => (prev + 1) % combinedSuspects.length)}
                    disabled={combinedSuspects.length <= 1}
                    className="w-full sm:w-auto py-2.5 px-5 bg-[#3B82F6] hover:bg-[#3B82F6]/80 disabled:opacity-30 disabled:hover:bg-[#3B82F6] text-white font-mono text-xs font-bold rounded-lg transition uppercase cursor-pointer"
                  >
                    Suspect Suivant &rarr;
                  </button>
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-[#94A3B8] font-mono text-xs">
                Aucun suspect correspondant au filtre de profiling configuré n&apos;est répertorié à ce jour.
              </div>
            )}

          </div>

        </div>
      )}

      {/* SUB-TAB 4: DDOS & RADIO OBSERVATION STATE */}
      {forensicsTab === "antiflood" && (
        <div className="space-y-6 animate-fade-in text-xs">
          
          {/* Quick Guide */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h4 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                  <Activity className="w-4 h-4 text-[#EF4444] animate-pulse" />
                  STATION D&apos;OBSERVATION DE REQUÊTES EN DIRECT &amp; SÉCURISATION DDOS
                </h4>
                <p className="text-xs text-[#94A3B8] mt-1 font-mono">
                  Surveillance active du débit radio des agents connectés. Détecte et neutralise les tentatives d&apos;inondation de requêtes malveillantes (spoofing) pour protéger l&apos;intégrité forensique du SOC.
                </p>
              </div>
              
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                  MODULE ANTI-FLOOD ACTIF
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Active monitoring status */}
              <div className="lg:col-span-8 space-y-3 font-mono">
                <div className="p-4 rounded-xl border bg-[#0B1020]/45 space-y-3 border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#94A3B8] uppercase">FLUX D&apos;OBSERVATION RADIO ACTIF (TEMPS RÉEL)</span>
                    <span className="text-[9px] font-mono font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25 px-1.5 py-0.5 rounded animate-pulse">
                      ALERTE SATURATION SECTEUR KARA
                    </span>
                  </div>

                  {/* Rogue agent listing */}
                  <div className="p-3 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping"></span>
                        <strong className="text-white text-xs">SimulatedAgent-Kara-Rogue (Port: 3042)</strong>
                      </div>
                      <p className="text-[10px] text-slate-300 font-sans leading-normal">
                        L&apos;agent envoie des signatures redondantes à haute fréquence. Risque de fausser le répertoire de notre enquête judiciaire.
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-[11px] font-bold text-[#EF4444] font-mono">DÉBIT : {rogueAgentBlocked ? "0" : activeObservationRate} req/sec</span>
                      <span className="text-[9px] text-[#94A3B8] block uppercase font-bold">{rogueAgentBlocked ? "QUARANTAINE ACQUISE" : "Seuil dépassé (>10/s)"}</span>
                    </div>
                  </div>

                  {/* Status information warning */}
                  <div className="text-[11px] text-[#94A3B8] leading-relaxed p-3 bg-[#0B1020]/80 border border-white/5 rounded-lg">
                    <strong>📝 NOTE SÉCURITÉ INTÉGRITÉ :</strong> Le routeur de corrélation SOC **n&apos;intègre pas** les alertes de cet agent suspect dans les regroupements judiciaires ci-dessus alors qu&apos;il est sous observation. Ceci évite toute confusion entre une tentative de DDoS et une signature légitime.
                  </div>
                </div>
              </div>

              {/* Action container on suspect */}
              <div className="lg:col-span-4 bg-[#0B1020]/45 border border-white/5 rounded-xl p-4 space-y-4 shadow-sm">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500 block">Actions de Mitigation</span>
                
                <div className="space-y-2">
                  <div className="text-[10px] text-[#94A3B8] font-mono uppercase">
                    Statut de l&apos;Agent:
                  </div>
                  <div className="p-2 rounded bg-[#0B1020] border border-white/5 text-[11px] font-mono flex items-center justify-between">
                    <span>Rogue-Kara-Agent :</span>
                    {rogueAgentBlocked ? (
                      <span className="text-[#EF4444] font-bold uppercase">REVOQUÉ &amp; QUARANTAINE</span>
                    ) : (
                      <span className="text-amber-400 font-bold uppercase animate-pulse">SUSPECT FLOOD</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRogueAgentBlocked(true);
                    setActiveObservationRate(0);
                    alert("Incident de flood / DDoS maîtrisé ! Le certificat de l'agent a été révoqué d'urgence.");
                  }}
                  disabled={rogueAgentBlocked}
                  className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold transition uppercase cursor-pointer ${rogueAgentBlocked ? "bg-[#1A2542] text-slate-550 border border-[#1A2542] cursor-not-allowed" : "bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/20"}`}
                >
                  {rogueAgentBlocked ? "🔒 CERTIFICAT RÉVOQUÉ" : "🚫 EXCLURE L'AGENT"}
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* 5. Judicial Report Personalisation Modal frame (Renders the actual PDF report for printing) */}
      {showDocModal && activeTrace && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#121A2F] border border-white/5 rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col justify-between shadow-2xl overflow-hidden">
            
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0B1020]/60">
              <div className="flex items-center gap-2">
                <FileBadge className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">CONFIGURATEUR DU RAPPORT JUDICIAIRE CENTRAL</h3>
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
                <span className="text-[10px] text-[#94A3B8] tracking-widest block uppercase font-bold">Paramètres officiels :</span>

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
                    Le module convertit automatiquement la mise en page en un format de réquisition judiciaire officiel. Choisissez <strong>&quot;Enregistrer au format PDF&quot;</strong> dans la fenêtre d&apos;impression.
                  </p>
                </div>
              </div>

              {/* Printable Document Preview (Right 8 columns) */}
              <div className="md:col-span-8 bg-white text-slate-900 p-8 rounded-lg shadow-xl overflow-y-auto max-h-[500px] font-sans printable-area border border-slate-200 text-left">
                
                {/* Official Togo Letterhead */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div className="text-center font-serif text-[10px] space-y-0.5 uppercase tracking-wide">
                    <strong className="block text-xs font-bold font-sans">RÉPUBLIQUE TOGOLAISE</strong>
                    <span className="block text-[9px] text-slate-600 tracking-widest font-sans font-bold">Travail - Liberté - Patrie</span>
                    <span className="block font-sans lowercase text-[8px] text-slate-500">-----</span>
                    <strong className="block font-sans text-[9px]">MINISTÈRE DE LA SÉCURITÉ ET DE LA PROTECTION CIVILE</strong>
                    <span className="block text-[9px] font-sans font-extrabold text-slate-700">CENTRE NATIONAL DU PLAN DE RECOUPEMENT DES FRAUDES (SOC PHISHING TG)</span>
                    <span className="block text-slate-500 font-mono text-[8px]">Ref: TG-SOC-FORENSIC-{Math.floor(1000 + Math.random() * 9000)}</span>
                  </div>

                  <div className="text-right text-[10px] space-y-0.5 font-sans whitespace-nowrap">
                    <span className="block font-bold">LOMÉ, le {new Date().toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    <span className="block text-rose-600 font-extrabold text-[8px] border border-rose-300 px-1 rounded inline-block bg-rose-50 text-right">DIFFUSION RESTREINTE / JUSTICE</span>
                    <span className="block text-slate-600 block mt-1">Zone Chronologie: Togo GMT Network</span>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center my-6 space-y-1">
                  <h2 className="text-sm font-extrabold uppercase tracking-widest font-serif border-y-2 border-double border-slate-400 py-3">
                    PROCÈS-VERBAL D&apos;EXPERTISE CYBER-FORENSIQUE COMPLÈTE
                  </h2>
                  <span className="text-[10px] font-mono text-slate-600 block">Attribution d&apos;ingénierie sociale criminelle et de menaces par recoupement multi-agents</span>
                </div>

                {/* Addressees */}
                <div className="space-y-2 text-[11px] mb-6">
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
                <div className="space-y-4 text-xs font-sans">
                  <h3 className="text-[11px] font-extrabold uppercase border-b border-slate-900 pb-1">I. Établissement technique de la menace</h3>
                  
                  <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold w-40">Identificateur inspecté :</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-900 break-all">{activeTrace.value}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Type d’IoC enregistré :</td>
                        <td className="py-2 px-3 font-mono uppercase">{activeTrace.type}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Volume d’occurrences :</td>
                        <td className="py-2 px-3 font-bold text-rose-600">{activeTrace.occurrences} signalements coordonnés</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="py-2 px-3 bg-slate-100 font-bold">Localisations d’impact :</td>
                        <td className="py-2 px-3 font-semibold">{activeTrace.locations.join(", ")}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 bg-slate-100 font-bold">Agents mobiles intercepteurs :</td>
                        <td className="py-2 px-3 font-mono break-all">{activeTrace.associatedAgents.join(" // ") || "Réseau Intercepteur National"}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="text-[11px] font-extrabold uppercase border-b border-slate-900 pb-1 mt-6">II. Chronologie de propagation (Togo GMT Network Clock)</h3>
                  <div className="space-y-2 bg-slate-50 p-4 border border-slate-200 rounded text-[11px]">
                    <p className="leading-relaxed">
                      L&apos;analyseur d&apos;empreintes cybernétiques du SOC PHISHING TG atteste que le premier signal a été détecté le <strong>{new Date(activeTrace.firstSeen).toLocaleString("fr-FR")} GMT</strong> et le plus récent le <strong>{new Date(activeTrace.lastSeen).toLocaleString("fr-FR")} GMT</strong>.
                    </p>
                    <p className="mt-1 font-semibold text-rose-700">
                      Vecteur de propagation d&apos;usurpation ou piège de contact physique identifié :
                    </p>
                    <p className="text-slate-700 font-serif leading-relaxed italic bg-white p-3 border border-slate-200 rounded mt-1">
                      {activeTrace.type === "text_pattern" ? (
                        "Alerte sociétale critique : Tentative d'ingénierie physique et de manipulation par ruse visant la jeunesse et les enfants. Le motif textuel décèle un modus operandi de détournement et de rendez-vous d'embuscades à l'intérieur du territoire togolais."
                      ) : activeTrace.type === "phone" ? (
                        "Vol financier de fonds et d'avoirs mobiles (usurpation de Moov Africa Money ou Yas Mobile) ciblant les citoyens togolais par des faux gains de loterie ou lotto énergétiques."
                      ) : (
                        "Vecteur de phishing administratif usurpant l'identité d'acteurs reconnus (CEET, OTR ou CNSS) à des d'extorsion de paiements ou d'authentification."
                      )}
                    </p>
                  </div>

                  <h3 className="text-[11px] font-extrabold uppercase border-b border-slate-900 pb-1 mt-6">III. Recommandation administrative &amp; Mandat technique</h3>
                  <p className="text-[11px] leading-relaxed text-slate-700 font-serif font-sans">
                    Vu les éléments de recoupement techniques collectés par le pare-feu central du SOC PHISHING TG, l&apos;officier rapporteur requiert :
                    <br />
                    1. Le gel et blocage DNS d&apos;urgence de tous les serveurs et sous-réseaux rattachés à la signature <strong>{activeTrace.value}</strong>.
                    <br />
                    2. La saisine immédiate des opérateurs de télécommunication togolais aux fins de gel et suspension de toutes les transactions mobiles impliquant le portier suspect.
                    <br />
                    3. La transmission de ces faisceaux de preuves numériques à la brigade compétente pour enquête de flagrance physique criminelle.
                  </p>
                </div>

                {/* Signatures block */}
                <div className="flex justify-between items-center pt-8 border-t border-slate-400 mt-8 text-[11px]">
                  <div className="text-center font-mono">
                    <span className="block text-slate-500 text-[10px]">L&apos;ADMINISTRATEUR SOC PHISHING TG</span>
                    <strong className="block text-slate-800 mt-6">[SIGNATURE NUMÉRIQUE VALIDE]</strong>
                    <span className="block text-slate-500 text-[9px]">Sceau d&apos;intégrité forensique #KFL</span>
                  </div>

                  <div className="text-center font-mono">
                    <span className="block text-slate-500 text-[10px]">L&apos;OFFICIER OPJ RAPPORTETTE</span>
                    <strong className="block text-slate-800 mt-6">________________________</strong>
                    <span className="block text-slate-500 text-[9px]">Visa officiel ANCY / Gendarmerie</span>
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

      {/* 4.5 CORRELATION REPORT MODAL */}
      {correlationReportSignal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121A2F] border border-white/5 rounded-xl max-w-2xl w-full col-span-1 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 bg-[#0B1020]/60 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#3B82F6]" />
                <span className="font-mono font-bold text-xs text-slate-300 uppercase tracking-widest">
                  RAPPORT SYNTHÉTIQUE DE CORRÉLATION MULTI-AGENT
                </span>
              </div>
              <button 
                onClick={() => setCorrelationReportSignal(null)}
                className="p-1 px-2 rounded-md hover:bg-white/5 text-[#94A3B8] hover:text-white text-xs transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable/Readable Rapport Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-white text-slate-900 text-left">
              <div className="text-center font-serif text-[10px] space-y-0.5 uppercase tracking-wide border-b-2 border-slate-900 pb-3">
                <strong className="block text-xs font-bold font-sans">RÉPUBLIQUE TOGOLAISE</strong>
                <span className="block text-[8px] text-slate-600 tracking-widest font-sans font-bold">Travail - Liberté - Patrie</span>
                <span className="block font-sans lowercase text-[8px] text-slate-500">-----</span>
                <strong className="block font-semibold text-[9px] font-sans">CENTRE SOC PHISHING TG &bull; BRIGADE CYBERCRIMINALITÉ LOMÉ</strong>
                <span className="block text-[8px] font-mono text-slate-500">REF APPEL D&apos;AGENTS : TG-SOC-CORR-{correlationReportSignal.senderPhone}</span>
              </div>

              <div className="my-4 text-center">
                <h4 className="font-sans font-black uppercase text-xs text-rose-600 tracking-wider">
                  &bull; ALERTE MULTI-AGENT : VECTEUR ÉLECTRONIQUE SÉCURISÉ REBONDISSANT &bull;
                </h4>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">Indicateur de compromission récurrent détecté sur plusieurs terminaux</p>
              </div>

              <div className="text-xs space-y-2 border-l-2 border-indigo-600 pl-3">
                <p>
                  <strong>Indicateur suspect repéré :</strong> <span className="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-rose-700">{correlationReportSignal.senderPhone}</span>
                </p>
                <p>
                  <strong>Type d&apos;IoC :</strong> <span className="uppercase font-semibold text-slate-700">Canal Phishing Mobile (SMS/WhatsApp)</span>
                </p>
                <p>
                  <strong>Modus Operandi identifié :</strong> Saisie de spams transactionnels sémantiques ou tentative d&apos;arnaque visant l&apos;obtention de codes T-Money/Flooz ou d&apos;incitations frauduleuses de contact physique.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase border-b border-slate-200 pb-1 text-slate-800 font-sans mb-2 font-bold">I. ÉNUMÉRATION ET GÉOLOCALISATION DES AGENTS CYBER-VICTIMES ({relatedSignals.length})</strong>
                <table className="w-full text-left font-mono text-[10px] border">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="py-2 px-2 border-r">Terminal Agent</th>
                      <th className="py-2 px-2 border-r">Région / Ville</th>
                      <th className="py-2 px-2 border-r">Message Capté</th>
                      <th className="py-2 px-2">Heure d&apos;interception</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedSignals.map((rel, rIdx) => (
                      <tr key={rel.id || rIdx} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-2 border-r font-bold text-slate-700">{rel.deviceId}</td>
                        <td className="py-2 px-2 border-r">{rel.location}</td>
                        <td className="py-2 px-2 border-r italic text-slate-600 text-[9px] font-sans max-w-xs">&ldquo;{rel.evidenceText}&rdquo;</td>
                        <td className="py-2 px-2 text-slate-500">{new Date(rel.timestamp).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <strong className="block text-[11px] uppercase border-b border-slate-200 pb-1 text-slate-800 font-sans mb-1 font-bold">II. ÉQUATIONS DE CORRÉLATION ET ANALYSE D&apos;URGENT-PLAN</strong>
                <p className="font-serif leading-relaxed text-slate-700 text-[11px]">
                  L&apos;occurrence répétée de ce porteur de fraude ({correlationReportSignal.senderPhone}) sur un total de <strong>{relatedSignals.length}</strong> terminaux différents atteste formellement d&apos;une campagne d&apos;ingénierie sociale active et distribuée sur le territoire national togolais.
                  <br />
                  Le regroupement sémantique indique une tentative organisée visant la suspension des canaux officiels togolais ou le détournement financier.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase border-b border-slate-200 pb-1 text-slate-800 font-sans mb-1 font-bold">III. MANDAT TECHNIQUE ADMINISTRATIF</strong>
                <p className="font-sans leading-relaxed text-slate-700 text-[10px]">
                  1. <strong>Bloquer immédiatement</strong> cet identifiant suspect national sur toute la flotte mobile gérée par le SOC Kéfyl.
                  <br />
                  2. <strong>Faire opposition</strong> d&apos;urgence auprès de l&apos;ANCY pour suspension de ligne téléphonique.
                  <br />
                  3. <strong>Sceaux d&apos;intégrité forensique certifiés</strong> transmis aux autorités judiciaires togolaises.
                </p>
              </div>

              <div className="flex items-center justify-between font-mono text-[9px] text-slate-500 pt-4 border-t border-slate-100 mt-4">
                <span className="text-center font-bold block">REPRÉSENTANT SOC TG</span>
                <span className="text-center font-bold block">[VÉRIFICATION DE SÉCURITÉ CONFORME]</span>
              </div>

            </div>

            {/* Modal actions */}
            <div className="px-6 py-4 bg-[#0B1020]/60 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase">SOC SP &bull; PHISHING TOGO</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="py-1.5 px-3 bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white text-xs font-bold font-mono uppercase rounded transition cursor-pointer"
                >
                  Imprimer en PDF
                </button>
                <button
                  onClick={() => setCorrelationReportSignal(null)}
                  className="py-1.5 px-3 bg-[#1A2542] hover:bg-[#1A2542]/80 text-[#94A3B8] text-xs font-mono uppercase rounded transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
