import React, { useState, useMemo, useRef } from "react";
import { 
  Database, 
  Search, 
  Trash2, 
  Edit2, 
  Plus, 
  Check, 
  X, 
  AlertTriangle, 
  MapPin, 
  Filter, 
  FileText,
  Activity,
  User,
  AlertCircle,
  Download,
  Upload,
  Cpu,
  Sparkles,
  Send,
  ShieldCheck,
  AlertOctagon,
  Terminal
} from "lucide-react";
import { Threat } from "../types";

interface Props {
  threats: Threat[];
  onRefreshData: () => Promise<void>;
}

export default function SignaturesTab({ threats, onRefreshData }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null);

  // Import / Export refs or states
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dual form mode states for addition of signatures
  const [formMode, setFormMode] = useState<"direct" | "ai_analysis">("direct");
  const [selectedModel, setSelectedModel] = useState<"gemini" | "claude" | "gpt" | "grok">("gemini");
  const [suspectText, setSuspectText] = useState("");
  const [analyzingManual, setAnalyzingManual] = useState(false);
  const [manualResult, setManualResult] = useState<any | null>(null);

  // Non-blocking visual notifications state
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error" | "warning", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 8000);
  };

  // New Threat form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<"domain" | "ip" | "email" | "phone" | "text_pattern">("domain");
  const [newSeverity, setNewSeverity] = useState<"Low" | "Medium" | "Critical">("Medium");
  const [newLocation, setNewLocation] = useState("Lomé");
  const [newDetails, setNewDetails] = useState("");

  // Togolese samples for rapid testing
  const suspectSamples = [
    {
      title: "Phishing SMS Moov Africa",
      text: "Félicitations! Moov Africa vous offre un bonus de 250.000F CFA pour la fidélité de 5 ans. Pour recevoir l'argent composez immédiatement la syntaxe secu *155*4*1*500000# et entrez votre code PIN secrete pour valider l'enregistrement de la Banque Centrale de Lomé."
    },
    {
      title: "Portail Clone de la CEET",
      text: "Cher client, votre facture d'électricité n'849102-TG est impayée. Une coupure de courant générale interviendra sous 12h. Veuillez régulariser d'urgence via notre site sécurisé de facturation togolais: https://ceet-facturation-pay.cf/billing/?id=92. Ne partagez pas vos codes."
    },
    {
      title: "Arnaque de faux dépôts Yas / Moov Africa",
      text: "URGENT T-Money: Vous venez de recevoir un dépôt par erreur de +350.000F CFA depuis la succursale du Grand Marché de Lomé. Nous vous prions de renvoyer le même montant au numéro du superviseur financier +228 92 12 45 61 pour corriger les livres comptables."
    }
  ];

  // Helper check if target value exists in database
  const getSimulatedCheckStatus = (val: string) => {
    const clean = val.trim().toLowerCase();
    if (!clean) return null;
    const found = threats.find(t => t.value.trim().toLowerCase() === clean);
    if (found) {
      return { registered: true, threat: found };
    }
    return { registered: false };
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
        
        showFeedback("success", "Exportation de la base active de signatures réussie !");
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
      alert("📥 Sauvegarde active exportée avec succès ! Vous pouvez maintenant confirmer l'importation de fusion.");
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
        const importedThreats = parsed.threats || (Array.isArray(parsed) ? parsed : null);
        if (!Array.isArray(importedThreats)) {
          alert("Erreur de format : Le fichier de sauvegarde doit contenir un tableau 'threats' ou un tableau direct de signatures.");
          return;
        }

        const res = await fetch("/api/backup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threats: importedThreats })
        });
        const data = await res.json();
        if (data.success) {
          showFeedback("success", `Intégration réussie : ${data.count} nouvelles signatures injectées et fusionnées !`);
          await onRefreshData();
          alert(`Importation réussie : ${data.count} nouvelles signatures fusionnées.`);
        } else {
          alert("Erreur lors de l'intégration : " + data.error);
        }
      } catch (err: any) {
        alert("Erreur de décodage JSON : " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleManualAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectText || suspectText.trim().length === 0) return;

    setAnalyzingManual(true);
    setManualResult(null);

    try {
      const response = await fetch("/api/threats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: suspectText })
      });
      const resData = await response.json();
      if (resData.success) {
        setManualResult(resData.analysis);
      } else {
        alert("Erreur lors de l'analyse IA : " + resData.error);
      }
    } catch (e) {
      console.error("Manual analysis failed", e);
    } finally {
      setAnalyzingManual(false);
    }
  };

  const addExtractedIndicatorDirectly = async (type: string, value: string, severity: string, description: string) => {
    const cleanValue = value.trim();
    const exists = threats.some(
      t => t.value.toLowerCase().trim() === cleanValue.toLowerCase()
    );
    if (exists) {
      showFeedback("warning", `La signature "${cleanValue}" est déjà enregistrée.`);
      return;
    }

    try {
      const response = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: cleanValue,
          type,
          severity,
          location: "Lomé",
          details: description,
          status: "active"
        })
      });

      const data = await response.json();
      if (data.success) {
        showFeedback("success", `Signature "${cleanValue}" ajoutée et synchronisée avec succès.`);
        await onRefreshData();
      } else {
        showFeedback("error", "Erreur lors de l'ajout : " + data.error);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erreur de communication.");
    }
  };

  // Edit Threat states
  const [editValue, setEditValue] = useState("");
  const [editType, setEditType] = useState<"domain" | "ip" | "email" | "phone" | "text_pattern">("domain");
  const [editSeverity, setEditSeverity] = useState<"Low" | "Medium" | "Critical">("Medium");
  const [editLocation, setEditLocation] = useState("");
  const [editDetails, setEditDetails] = useState("");

  const filteredThreats = useMemo(() => {
    return threats.filter(t => {
      const matchSearch = 
        t.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.details || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchSeverity = severityFilter === "all" || t.severity === severityFilter;
      return matchSearch && matchType && matchSeverity;
    });
  }, [threats, searchTerm, typeFilter, severityFilter]);

  const handleStartEdit = (threat: Threat) => {
    setEditingThreat(threat);
    setEditValue(threat.value);
    setEditType(threat.type);
    setEditSeverity(threat.severity);
    setEditLocation(threat.location);
    setEditDetails(threat.details || "");
  };

  const handleCancelEdit = () => {
    setEditingThreat(null);
  };

  const handleDeleteThreat = async (id: string, value: string) => {
    if (!window.confirm(`Voulez-vous définitivement supprimer la signature "${value}" de la base de données SOC ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/threats/${id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        showFeedback("success", `La signature "${value}" a été supprimée définitivement.`);
        await onRefreshData();
      } else {
        showFeedback("error", "Erreur lors de la suppression : " + data.error);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erreur de connexion lors de la suppression.");
    }
  };

  const handleUpdateThreat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThreat) return;

    try {
      const response = await fetch(`/api/threats/${editingThreat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: editValue,
          type: editType,
          severity: editSeverity,
          location: editLocation,
          details: editDetails
        })
      });

      const data = await response.json();
      if (data.success) {
        setEditingThreat(null);
        showFeedback("success", "Signature mise à jour avec succès.");
        await onRefreshData();
      } else {
        showFeedback("error", "Erreur lors de la mise à jour : " + data.error);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erreur réseau lors de l'enregistrement.");
    }
  };

  const handleAddThreatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanValue = newValue.trim();
    if (!cleanValue) {
      showFeedback("error", "Veuillez saisir une valeur pour la signature.");
      return;
    }

    const exists = threats.some(
      t => t.value.toLowerCase().trim() === cleanValue.toLowerCase()
    );
    if (exists) {
      showFeedback("warning", `La signature "${cleanValue}" est déjà enregistrée dans la base active du SOC.`);
      return;
    }

    try {
      const response = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: cleanValue,
          type: newType,
          severity: newSeverity,
          location: newLocation,
          details: newDetails,
          status: "active"
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewValue("");
        setNewDetails("");
        setShowAddForm(false);
        showFeedback("success", `Nouvelle signature "${cleanValue}" ajoutée et synchronisée avec succès.`);
        await onRefreshData();
      } else {
        showFeedback("error", "Erreur lors de l'ajout : " + data.error);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erreur de communication avec le serveur.");
    }
  };

  return (
    <div className="space-y-6 leading-relaxed">

      {/* Non-blocking feedback notification banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border font-mono text-xs flex items-start gap-3 animate-fade-in ${
          feedback.type === "success" 
            ? "bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]" 
            : feedback.type === "warning"
            ? "bg-amber-500/10 border-amber-500/25 text-amber-500"
            : "bg-[#EF4444]/10 border-[#EF4444]/25 text-[#EF4444]"
        }`}>
          {feedback.type === "success" ? (
            <Check className="w-5 h-5 shrink-0 text-[#10B981]" />
          ) : feedback.type === "warning" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
          )}
          <div className="flex-1">
            <span className="font-extrabold uppercase block text-[10px] tracking-widest mb-0.5">
              {feedback.type === "success" ? "OPÉRATION CONFIRMÉE" : feedback.type === "warning" ? "CONTRÔLE / DOUBLON ÉVITÉ" : "REJET SYSTEME"}
            </span>
            <p className="text-[#94A3B8] leading-relaxed">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[#94A3B8] hover:text-white transition p-0.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121A2F] border border-white/5 rounded-xl p-6 shadow-md">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Database className="w-4.5 h-4.5 text-[#3B82F6]" />
            Console d&apos;Administration et d&apos;Édition de la Base Active
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-1 font-sans">
            Recherchez, modifiez, exportez et analysez les signatures de phishing et d&apos;ingénierie sociale sur le territoire togolais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportSignatures}
            className="px-3 py-2 bg-[#0B1020] border border-white/5 hover:border-[#1A2542] hover:bg-[#1A2542] text-slate-200 text-[10px] font-mono font-bold rounded-lg uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Exporter la base de données au format JSON"
          >
            <Download className="w-3.5 h-3.5 text-[#10B981]" />
            EXPORTER
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
              className="px-3 py-2 bg-[#0B1020] border border-white/5 hover:border-[#1A2542] hover:bg-[#1A2542] text-slate-200 text-[10px] font-mono font-bold rounded-lg uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Importer et fusionner un lot de signatures (.json)"
            >
              <Upload className="w-3.5 h-3.5 text-[#3B82F6]" />
              IMPORTER
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-mono text-xs font-bold rounded-xl uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? "Fermer" : "Ajouter une Signature"}
          </button>
        </div>
      </div>

      {/* Add Signature Panel Form with Tabs */}
      {showAddForm && (
        <div className="bg-[#121A2F] border border-white/5 p-6 rounded-xl space-y-5 animate-fade-in shadow-md">
          {/* Sub tabs inside additive form */}
          <div className="flex border-b border-white/5 w-full bg-[#0B1020]/45 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setFormMode("direct")}
              className={`flex-1 py-2 font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-md transition-all cursor-pointer ${formMode === "direct" ? "bg-[#3B82F6] text-white shadow" : "text-[#94A3B8] hover:text-[#E5E7EB]"}`}
            >
              <Plus className="w-3.5 h-3.5" />
              SAISIE MANUELLE DIRECTE
            </button>
            <button
              type="button"
              onClick={() => setFormMode("ai_analysis")}
              className={`flex-1 py-2 font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-md transition-all cursor-pointer ${formMode === "ai_analysis" ? "bg-[#3B82F6] text-white shadow" : "text-[#94A3B8] hover:text-[#E5E7EB]"}`}
            >
              <Cpu className="w-3.5 h-3.5" />
              ANALYSE COGNITIVE PAR IA (SMS / WEB)
            </button>
          </div>

          {formMode === "direct" ? (
            <form onSubmit={handleAddThreatSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 font-mono text-xs">
              <div className="md:col-span-4 space-y-1">
                <label className="text-slate-500 font-bold block uppercase text-[10px]">Valeur / Signature :</label>
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Ex. +228 99 88 77 66 ou ceet-pay.xyz"
                  className="w-full bg-[#0B1020] border border-white/5 focus:border-[#3B82F6] p-2.5 rounded-lg text-white outline-none"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-slate-500 font-bold block uppercase text-[10px]">Type d&apos;IoC :</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 outline-none cursor-pointer"
                >
                  <option value="domain">Domaine URL</option>
                  <option value="phone">Téléphone</option>
                  <option value="ip">IP Server</option>
                  <option value="email">Email</option>
                  <option value="text_pattern">Message sémantique</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-slate-500 font-bold block uppercase text-[10px]">Niveau d&apos;Urgence :</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as any)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 outline-none cursor-pointer"
                >
                  <option value="Low">Low (Faible)</option>
                  <option value="Medium">Medium (Moyen)</option>
                  <option value="Critical">Critical (Critique)</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-slate-500 font-bold block uppercase text-[10px]">Région / Localisation :</label>
                <select
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 outline-none cursor-pointer"
                >
                  <option value="Lomé">Lomé (Maritime)</option>
                  <option value="Sokodé">Sokodé (Centrale)</option>
                  <option value="Kara">Kara (Nord)</option>
                  <option value="Atakpamé">Atakpamé (Plateaux)</option>
                  <option value="Kpalimé">Kpalimé (Plateaux Ouest)</option>
                  <option value="Cinkassé">Cinkassé (Savanes)</option>
                  <option value="Aného">Aného (Est Littoral)</option>
                </select>
              </div>

              <div className="md:col-span-12 space-y-1 mt-2">
                <label className="text-slate-500 font-bold block uppercase text-[10px]">Description / Allégations :</label>
                <textarea
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="Ex. Tentative d'imposture et usurpation du service d'électricité CEET pour extorquer de l'argent..."
                  rows={2}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-white outline-none"
                />
              </div>

              <div className="md:col-span-12 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/5 text-[#94A3B8] hover:text-white rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Sauvegarder et Déployer
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-xs font-mono">
              {/* Left pane: input */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-extrabold tracking-wider">
                    SÉLECTIONNEZ UN ÉCHANTILLON TOGOLAIS POUR TESTER :
                  </span>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {suspectSamples.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSuspectText(sample.text)}
                        className="text-left text-[11px] bg-[#0B1020]/50 hover:bg-[#3B82F6]/10 p-2 rounded-lg border border-white/5 text-[#94A3B8] hover:text-white transition block truncate cursor-pointer font-bold"
                      >
                        💡 {sample.title}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleManualAnalyze} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 block uppercase font-bold">Moteur cognitif actif :</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as any)}
                      className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 focus:outline-none focus:border-[#3B82F6] font-mono text-xs cursor-pointer"
                    >
                      <option value="gemini">✨ Gemini Flash Enterprise (Défaut SOC)</option>
                      <option value="claude">Anthropic Claude 3.5 Sonnet</option>
                      <option value="gpt">OpenAI ChatGPT-4o Pro</option>
                      <option value="grok">xAI Grok Ultra Agent</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block font-bold uppercase">Texte suspect à auditer / comparer :</label>
                    <textarea
                      value={suspectText}
                      onChange={(e) => setSuspectText(e.target.value)}
                      rows={4}
                      placeholder="Collez ici le SMS ou le lien à tester avant son inscription dans le registre d'immunisation..."
                      className="w-full bg-[#0B1020] border border-white/5 p-3 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-[#3B82F6] leading-relaxed"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={analyzingManual || suspectText.trim().length === 0}
                    className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#3B82F6]/90 font-mono text-xs font-bold uppercase rounded-lg text-white flex items-center justify-center gap-2 disabled:bg-[#121A2F] disabled:text-slate-650 transition cursor-pointer"
                  >
                    {analyzingManual ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Analyse cognitive en cours...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
                        Analyse et Vérification par l&apos;IA
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right pane: output & database registry matching (Sandbox capabilities) */}
              <div className="lg:col-span-7 bg-[#0B1020]/25 rounded-xl border border-white/5 p-4 flex flex-col justify-between">
                {analyzingManual ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 min-h-[220px]">
                    <Cpu className="w-9 h-9 text-[#06B6D4] animate-spin" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">Décodage Cognitive Heuristique</h4>
                      <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">Comparaison en temps réel avec le registre d&apos;immunisation mobile...</p>
                    </div>
                  </div>
                ) : manualResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-wide uppercase">{manualResult.summary}</h4>
                        <p className="text-[9px] text-[#3B82F6] font-bold uppercase">Verdict IA : {manualResult.isPhishing ? "🔴 INTRUSION DÉTECTÉE" : "🟢 CONFORME / SAIN"}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold ${manualResult.severity === "Critical" ? "bg-red-500/10 text-red-400 border border-red-500/10" : "bg-amber-500/10 text-amber-500"}`}>
                        {manualResult.severity}
                      </span>
                    </div>

                    <div className="bg-[#3B82F6]/5 border border-[#3B82F6]/10 p-3 rounded-lg text-[11px] text-slate-350 leading-relaxed font-sans">
                      <strong className="text-[#3B82F6] font-mono uppercase text-[9px] block mb-1">MÉCANISME D&apos;ATTENTION FRAUDULEUX IDENTIFIÉ :</strong>
                      {manualResult.explanation}
                    </div>

                    {/* Threat indicator extracted lists with internal registry comparisons (Sandbox check) */}
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold mb-2">
                        Signatures extraites &amp; État du Registre de Lomé :
                      </span>
                      <div className="space-y-2">
                        {manualResult.threatIndicators && manualResult.threatIndicators.map((ioc: string, idx: number) => {
                          const status = getSimulatedCheckStatus(ioc);
                          return (
                            <div key={idx} className="bg-[#0B1020] border border-white/5 p-2 rounded flex items-center justify-between text-xs font-mono">
                              <div className="flex flex-col">
                                <span className="font-bold text-white truncate max-w-xs">{ioc}</span>
                                {status?.registered ? (
                                  <span className="text-amber-500 text-[8px] font-bold uppercase mt-0.5">⚠️ Déjà enregistré dans le registre</span>
                                ) : (
                                  <span className="text-[#10B981] text-[8px] font-bold uppercase mt-0.5">✅ Nouvelle immunisation disponible</span>
                                )}
                              </div>

                              {!status?.registered ? (
                                <button
                                  type="button"
                                  onClick={() => addExtractedIndicatorDirectly(manualResult.compromiseType, ioc, manualResult.severity, "Extrait après analyse IA: " + manualResult.explanation.slice(0, 100))}
                                  className="px-2 py-1 bg-[#10B981] hover:bg-[#10B981]/95 text-white rounded text-[9px] font-bold uppercase font-mono transition cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  PUSH BD
                                </button>
                              ) : (
                                <span className="text-slate-550 text-[9px] uppercase font-bold">Synchronisé</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[220px]">
                    <Terminal className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                    <h4 className="text-xs font-bold text-slate-550 uppercase">Analyseur de Payload Phishing Moov/Flooz</h4>
                    <p className="text-[10px] text-slate-600 max-w-xs mt-1 uppercase">Saisissez un message suspect ou chargez un échantillon à gauche pour tester la base d&apos;immunisation.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Database Listing Panel */}
      <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 space-y-4 shadow-md">
        
        {/* Filter controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher par valeur, emplacement, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B1020] border border-white/5 focus:border-[#3B82F6] pl-10 pr-4 py-2 rounded-xl text-xs font-mono text-slate-200 outline-none transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0B1020] px-3 py-1.5 rounded-lg border border-white/5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-mono text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">Tous les types</option>
                <option value="domain">Domaines</option>
                <option value="phone">Téléphones</option>
                <option value="ip">IP Servers</option>
                <option value="email">E-mails</option>
                <option value="text_pattern">Textes sémantiques</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#0B1020] px-3 py-1.5 rounded-lg border border-white/5">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-xs font-mono text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">Toutes les urgences</option>
                <option value="Critical">Critique 🔴</option>
                <option value="Medium">Moyen 🟡</option>
                <option value="Low">Faible ⚪</option>
              </select>
            </div>
          </div>
        </div>

        {/* Edit Threat Form Modal / Bar (Displays inline if a row is selected for modification) */}
        {editingThreat && (
          <div className="bg-amber-950/10 border border-amber-500/25 p-6 rounded-xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-amber-500/15">
              <span className="text-xs font-bold text-amber-500 font-mono tracking-wider uppercase block flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Modification de Signature : &quot;{editingThreat.value}&quot;
              </span>
              <button onClick={handleCancelEdit} className="text-[#94A3B8] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateThreat} className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Valeur / Signature :</label>
                <input
                  type="text"
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Type d&apos;IoC :</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 outline-none cursor-pointer"
                >
                  <option value="domain">Domaine URL</option>
                  <option value="phone">Téléphone</option>
                  <option value="ip">IP Server</option>
                  <option value="email">Email</option>
                  <option value="text_pattern">Message sémantique</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Urgence :</label>
                <select
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value as any)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-slate-300 outline-none cursor-pointer"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Localisation :</label>
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-white outline-none"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-slate-400 font-bold block uppercase text-[10px]">Détails de l&apos;enquête :</label>
                <textarea
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0B1020] border border-white/5 p-2.5 rounded-lg text-white outline-none"
                />
              </div>

              <div className="md:col-span-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-white/5 text-[#94A3B8] hover:text-white rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Database Grid-Table representation */}
        <div className="overflow-x-auto border border-white/5 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1020]/80 border-b border-white/5 text-[10px] font-mono text-slate-500 uppercase">
                <th className="py-3 px-4 font-bold">Signature Value</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Priorité</th>
                <th className="py-3 px-4 font-bold">Région / Ville</th>
                <th className="py-3 px-4 font-bold">Dossier / Preuves</th>
                <th className="py-3 px-4 font-bold">Actions d&apos;Équipe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs text-slate-300">
              {filteredThreats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    Aucune signature concordante enregistrée dans la base de données.
                  </td>
                </tr>
              ) : (
                filteredThreats.map((threat) => (
                  <tr key={threat.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-bold text-white break-all">{threat.value}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#0B1020] text-slate-300 border border-white/5 uppercase font-medium">
                        {threat.type === "domain" ? "🌐 Domaine" :
                         threat.type === "phone" ? "📞 Téléphone" :
                         threat.type === "ip" ? "🖥️ IP server" :
                         threat.type === "email" ? "✉️ Email" : "📝 Motif"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        threat.severity === "Critical" ? "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25" :
                        threat.severity === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-[#0B1020] text-slate-400 border border-white/5"
                      }`}>
                        {threat.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{threat.location}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-sm truncate" title={threat.details}>
                      {threat.details || "Vide."}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(threat)}
                          className="p-1 px-2.5 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 transition flex items-center gap-1 font-bold text-[10px] uppercase font-mono cursor-pointer"
                          title="Modifier cette signature"
                        >
                          <Edit2 className="w-3" />
                          Éditer
                        </button>
                        <button
                          onClick={() => handleDeleteThreat(threat.id, threat.value)}
                          className="p-1 px-2.5 rounded bg-[#EF4444]/10 hover:bg-[#EF4444] text-[#EF4444] hover:text-white transition flex items-center gap-1 font-bold text-[10px] uppercase font-mono cursor-pointer"
                          title="Supprimer définitivement la signature"
                        >
                          <Trash2 className="w-3" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footing info count */}
        <div className="flex items-center justify-between text-[10px] text-slate-550 pt-2 font-mono uppercase">
          <span>Affichage de {filteredThreats.length} sur {threats.length} signatures nationales</span>
          <span>Secteurs du Togo protégés par synchronisation cellulaire</span>
        </div>
      </div>

    </div>
  );
}
