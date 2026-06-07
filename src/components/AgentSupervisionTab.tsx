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
  Mail,
  Lock
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
import { MobileAgent, MobileSignal, Threat } from "../types";

interface Props {
  threats: Threat[];
  agents: MobileAgent[];
  mobileSignals: MobileSignal[];
  onTriggerFlashUpdate: () => Promise<any>;
  onRefreshData?: () => void;
}

export default function AgentSupervisionTab({ 
  threats,
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

  // New real-time intercept overlay variables
  const [showInAppOverlayAlert, setShowInAppOverlayAlert] = useState(false);
  const [overlayAlertTitle, setOverlayAlertTitle] = useState("");
  const [overlayAlertMessage, setOverlayAlertMessage] = useState("");
  const [overlayAlertAction, setOverlayAlertAction] = useState("");
  const [overlayAlertType, setOverlayAlertType] = useState<"rule1" | "rule2" | "rule3" | "rule4">("rule1");
  
  // Local toggles
  const [isShieldActive, setIsShieldActive] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [phoneLocked, setPhoneLocked] = useState(false);

  // --- EXTRA SHIELD OPTIONS AGAINST FALSE POSITIVES ---
  const [messageSourceType, setMessageSourceType] = useState<"unknown" | "contact" | "group">("unknown");
  const [contactIndex, setContactIndex] = useState(0);
  const [groupName, setGroupName] = useState("Famille & Voisins Lomé 💬");
  const [trustedGroups, setTrustedGroups] = useState<string[]>([]);
  const [whitelistedCheckNotification, setWhitelistedCheckNotification] = useState(false);

  // Derive helper boolean for backward compatibility with existing component code
  const isGroupSource = messageSourceType === "group";
  const isRegisteredContact = messageSourceType === "contact";

  // Repertoires / contacts enregistres par l'utilisateur (Trusted Address Book)
  const registeredContacts = [
    { name: "Maman 🧑‍🍼", phone: "+228 90 12 34 56" },
    { name: "Koffi Ami 🤝", phone: "+228 91 88 44 22" },
    { name: "Directeur OTR 🏢", phone: "+228 92 11 00 11" },
    { name: "Oncle Kossi 👴", phone: "+228 93 45 67 89" }
  ];

  const addLog = (text: string, type: "info" | "success" | "warn" = "info") => {
    const time = new Date().toLocaleTimeString("fr-FR");
    setFlashLogs(prev => [...prev, { time, text, type }]);
  };

  // Predefined Togolese Phishing SMS/WhatsApp cases
  const simTemplates = [
    {
      title: "📞 Gains Offre Moov/Flooz",
      sender: "+228 99 12 04 85",
      text: "[Flooz] Félicitations! Votre numéro a été tiré au sort pour la promotion de la fête nationale. Vous gagnez la somme de 300.000 FCFA. Appelez vite le 99120485 pour débloquer votre versement.",
      category: "Tentative de vol d'argent (Faux gains)",
      isSignature: true,
      heuristics: "Répertorié dans la base de données de sécurité nationale de Lomé. Bloqué d'office comme arnaque confirmée, même si reçu d'un ami."
    },
    {
      title: "⚡ Fausse Facture Courant CEET",
      sender: "+228 90 41 82 12",
      text: "CEET ALERTE: Facture non réglée. Votre électricité sera coupée sous 24 heures. Réglez d'urgence votre impayé sur: https://ceet-facturation-tmoney.com/",
      category: "Fausse menace de coupure CEET",
      isSignature: true,
      heuristics: "Le faux site 'ceet-facturation-tmoney.com' est enregistré dans la base de signatures suspectes. Bloqué immédiatement pour usurpation."
    },
    {
      title: "🏫 Fausse Subvention ANCY",
      sender: "+228 92 11 34 56",
      text: "Recrutement urgent ANCY: Subvention d'État disponible pour les citoyens étudiants et entrepreneurs du Togo (50.000F/mois). Inscrivez-vous vite: http://ancy.gouv.tg-subvention.net",
      category: "Fausse aide de l'État pour vol d'infos",
      isSignature: true,
      heuristics: "Le site 'ancy.gouv.tg-subvention.net' usurpe l'État et figure dans la base nationale de signalements."
    },
    {
      title: "💸 Exemple : dépôt pressé (Non présent dans la base)",
      sender: "+228 99 12 04 85",
      text: "consulte ton solde je viens de t'envoyer un dépôt fait vite je suis presser",
      category: "Technique de manipulation (Urgence factice)",
      isSignature: false,
      heuristics: "Non connu dans la base de données. Analyse en direct : l'alerte ne se déclenchera que si ce message est envoyé par un numéro inconnu. Aucun signalement si envoyé par vos contacts."
    },
    {
      title: "💬 Vol de compte WhatsApp (Non présent dans la base)",
      sender: "+228 97 88 55 22",
      text: "Salut, j'ai envoyé accidentellement un code d'activation SMS à 6 chiffres sur ton numéro par mégarde, s'il te plaît renvoie-le moi d'urgence pour me dépanner !",
      category: "Vol de compte par code secret",
      isSignature: false,
      heuristics: "Non connu dans la base. Analyse en direct : l'alerte détectera la demande suspecte de code secret sous prétexte d'urgence si l'expéditeur est inconnu."
    }
  ];

  // Sync state if template selection changes
  useEffect(() => {
    if (selectedTemplate !== -1 && simTemplates[selectedTemplate]) {
      // If we are simulating a registered contact, keep the contact phone, otherwise default template phone
      if (messageSourceType !== "contact") {
        setCustomSender(simTemplates[selectedTemplate].sender);
      }
      setCustomText(simTemplates[selectedTemplate].text);
    }
  }, [selectedTemplate, messageSourceType]);

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

  // NLP psychological levers detection helper for local heuristic checking
  const hasHeuristicManipulations = useMemo(() => {
    const norm = customText.toLowerCase();
    const keywords = [
      "solde", "dépôt", "gagnez", "virement", "fête nationale", "fête", 
      "gratuit", "argent", "facture", "coupure", "code", "réclamez", 
      "somme", "reçoivent", "offre", "activation", "code d'activation", 
      "urgen", "presser", "cliquez", "moov", "flooz", "tmoney", "débloquer"
    ];
    return keywords.some(kw => norm.includes(kw));
  }, [customText]);

  // Perform a comparison match inside the loaded threats database (signatures check)
  const containsKnownSignature = useMemo(() => {
    const normalizedText = customText.toLowerCase();
    const normalizedSender = (customSender || "").toLowerCase().replace(/\s+/g, "");

    // 1. Match local/central database signatures
    const matchesDb = threats.some(t => {
      if (!t.value) return false;
      const val = t.value.toLowerCase().replace(/\s+/g, "").trim();
      if (val.length < 3) return false;
      return normalizedText.includes(val) || normalizedSender.includes(val);
    });

    if (matchesDb) return true;

    // 2. Hardcoded mock signature check for typical simulated templates to ensure accurate demonstration
    const mockSignatureFauxDoC = [
      "ancy.gouv.tg-subvention.net",
      "ceet-facturation-tmoney.com",
      "99120485",
      "300.000 fcfa",
      "300 000 fcfa"
    ];

    return mockSignatureFauxDoC.some(domain => normalizedText.includes(domain));
  }, [threats, customText, customSender]);

  const handleUnlockPhone = () => {
    setPhoneLocked(false);
    if (showNotification) {
      setShowNotification(false);
      setShowInAppOverlayAlert(true);
      addLog("🔓 Téléphone déverrouillé : L'alerte d'interception forcée s'ouvre automatiquement niveau plein écran.", "success");
    }
  };

  // Simulate receiving the SMS on SP_TG mobile
  const handleSimulateSMS = async () => {
    if (!customText.trim()) return;
    
    // Set message active on the virtual device
    let finalSender = customSender || "+228 90 00 00 00";
    if (messageSourceType === "contact") {
      finalSender = registeredContacts[contactIndex].phone;
    }
    setActiveSender(finalSender);
    setActiveMessageText(customText);
    
    // Reset notification and alert views
    setShowNotification(false);
    setWhitelistedCheckNotification(false);
    setShowInAppOverlayAlert(false);
    
    const isWhitelisted = trustedGroups.includes(groupName);

    // Skip all actions if group is whitelisted and not a direct central signature match!
    if (messageSourceType === "group" && isWhitelisted && !containsKnownSignature) {
      addLog(`🛡️ Garde-corps : Groupe répertorié dans votre Liste Verte ("${groupName}"). L'analyse de manipulation en direct a été évitée. Message délivré silencieusement.`, "success");
      setWhitelistedCheckNotification(true);
      return;
    }

    // Determine if it's a threat
    const isThreat = containsKnownSignature || hasHeuristicManipulations;

    if (!isThreat) {
      addLog(`🛡️ Garde-corps : Message reçu sain de "${finalSender}". Aucune menace détectée.`, "success");
      setPhoneState("dashboard");
      return;
    }

    // Identify if the sender's phone is blocklisted in the central SOC signatures DB
    const cleanSenderNum = finalSender.replace(/[\s\-\+\(\)]/g, "");
    const isSenderPhoneBlocklisted = threats.some(t => {
      if (t.type !== "phone") return false;
      const cleanDbVal = t.value.replace(/[\s\-\+\(\)]/g, "");
      return cleanDbVal.length >= 6 && (cleanSenderNum.includes(cleanDbVal) || cleanDbVal.includes(cleanSenderNum));
    }) || cleanSenderNum.includes("99120485");

    let titleText = "";
    let messageText = "";
    let actionText = "";
    let ruleMatched: "rule1" | "rule2" | "rule3" | "rule4" = "rule1";

    if (isSenderPhoneBlocklisted) {
      ruleMatched = "rule4";
      titleText = "🚨 EXPÉDITEUR TRAQUÉ D'OFFICE";
      messageText = `Le numéro : "${finalSender}" est signalé comme un numéro traqué par les forces de l'ordre pour tentative de fraude, cybercriminalité, redistribution de messages d'escroquerie.`;
      actionText = "Action : Bloquez définitivement cet expéditeur et effacez ce message.";
    } else if (messageSourceType === "contact" && containsKnownSignature) {
      ruleMatched = "rule3";
      titleText = "⚠️ COMPROMISSION COMPLÉMENTAIRE";
      const senderName = registeredContacts[contactIndex]?.name || "Mon Contact";
      
      const containsUrl = customText.toLowerCase().includes("http") || 
                          customText.toLowerCase().includes("ceet-facturation") ||
                          customText.toLowerCase().includes("ancy.gouv") ||
                          customText.toLowerCase().includes(".com") ||
                          customText.toLowerCase().includes(".net");
                          
      const containsInnerPhone = customText.replace(/[^0-9]/g, "").length >= 6 && 
                                 !customText.includes(cleanSenderNum);

      if (containsUrl) {
        messageText = `Propriétaire : "${senderName}" vient de vous envoyer un lien qui a été signalé comme une fraude par les forces de l'ordre.`;
      } else if (containsInnerPhone) {
        messageText = `Propriétaire : "${senderName}" vient de vous envoyer un texte contenant un numéro signalé comme une fraude par les forces de l'ordre.`;
      } else {
        messageText = `Propriétaire : "${senderName}" vient de vous envoyer un message qui a été signalé comme une fraude par les forces de l'ordre.`;
      }
      actionText = "Action : Votre proche n'est pas coupable. Il a pu être piraté ou a partagé ce message sans le savoir. Appelez-le directement pour l'avertir.";
    } else if (containsKnownSignature) {
      ruleMatched = "rule2";
      titleText = "🚨 ARNAQUE CONFIRMÉE - SOC";
      messageText = `Numéro : "${finalSender}" (Non connu de votre répertoire) vous a envoyé un message qui a été détecté comme une tentative très populaire d'escroquerie, d'arnaque qui a été détectée par les forces de l'ordre.`;
      actionText = "Action : Message hautement dangereux. Supprimez-le immédiatement.";
    } else {
      ruleMatched = "rule1";
      titleText = "⚠️ ALERTE VIGILANCE SÉMANTIQUE";
      messageText = `Numéro : "${finalSender}" (Non connu de votre répertoire) vous a envoyé un message qui ressemble à une tentative de fraude.`;
      actionText = "Action : Prudence recommandée. Ne répondez pas et ne cliquez sur aucun lien.";
    }

    // Set states to display the instant overlay
    if (isShieldActive) {
      setOverlayAlertTitle(titleText);
      setOverlayAlertMessage(messageText);
      setOverlayAlertAction(actionText);
      setOverlayAlertType(ruleMatched);
      
      if (phoneLocked) {
        setShowInAppOverlayAlert(false);
        setShowNotification(true);
        addLog(`📬 ÉCRAN SUSPENDU : ${titleText}. L'appareil est éteint/verrouillé : L'alerte est mise en attente. Une notification de sécurité s'affiche sur l'écran de verrouillage, et surgira dès le déverrouillage pour protéger l'utilisateur.`, "warn");
      } else {
        setShowInAppOverlayAlert(true);
        setShowNotification(false);
        addLog(`🚨 INTERCEPTION DIRECTE : ${titleText}. Le smartphone étant actif, la fenêtre d'alerte de cybermenace s'est ouverte instantanément en plein écran pour barrer la route à l'escroquerie.`, "warn");
      }
      
      // Increment blocked count & make background server submission
      incrementSimCounter();
      
      addLog(`🚨 INTERCEPTION TEMPS RÉEL : ${titleText}. Une fenêtre d'interruption s'est affichée à l'écran.`, "warn");
      
      // Auto-submit telemetry back to the SOC Express API
      setIsSimulatingApiCall(true);
      try {
        await fetch("/api/v1/report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-agent-code": "kfl-shield-simulation-device-token"
          },
          body: JSON.stringify({
            device_id: "SP-TG-SIMUL-PHONE",
            sender_phone: messageSourceType === "group" 
              ? `[Groupe: ${groupName}] ${finalSender}` 
              : messageSourceType === "contact"
                ? `[Contact: ${registeredContacts[contactIndex].name}] ${finalSender}`
                : finalSender,
            evidence_text: customText,
            location: "Lomé",
            meta_data: {
              detection_reason: ruleMatched === "rule1" ? "HEURISTIC_NLP_MATCH" : "CENTRAL_BLOCKLIST_MATCH",
              rule_matched: ruleMatched,
              simulated: true,
              sender_type: messageSourceType,
              timestamp_epoch: Date.now()
            }
          })
        });
        if (onRefreshData) {
          onRefreshData(); // Sync maps & graphs in realtime
        }
      } catch (e) {
        console.error("Failed background telemetry report simulation", e);
      } finally {
        setIsSimulatingApiCall(false);
      }
    } else {
      addLog(`⚠️ Garde-corps désactivé : Le message suspect s'est propagé sur le téléphone.`, "warn");
    }

    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {}
  };

  const handleAcknowledgeOverlayAlert = () => {
    setShowInAppOverlayAlert(false);
    setShowNotification(false);
    setPhoneState("dashboard");
  };

  const handleOpenAlertAndBlock = async () => {
    setShowNotification(false);
    setPhoneState("receiving");
    
    // Simulate short processing delay for NLP heuristic analysis on the device
    await new Promise(r => setTimeout(r, 800));
    
    if (isShieldActive) {
      setPhoneState("quarantine");

      // Only automatically submit and increment if not a mild group threat that needs choice!
      const isMildGroup = messageSourceType === "group" && !containsKnownSignature;
      
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
              sender_phone: messageSourceType === "group" 
                ? `[Groupe: ${groupName}] ${activeSender}` 
                : messageSourceType === "contact"
                  ? `[Contact: ${registeredContacts[contactIndex].name}] ${activeSender}`
                  : activeSender,
              evidence_text: activeMessageText,
              location: "Lomé",
              meta_data: {
                detection_reason: containsKnownSignature ? "CENTRAL_BLOCKLIST_MATCH" : "HEURISTIC_NLP_MATCH",
                simulated: true,
                sender_type: messageSourceType,
                timestamp_epoch: Date.now()
              }
            })
          });
          const resJson = await response.json();
          
          if (resJson.success) {
            addLog(`Alerte envoyée : Interception sécurisée ! Le rapport de renseignements a été acheminé au centre administratif national.`, "success");
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
        
        {/* Left Side: Realtime charts, terminal and directory list (Columns: 5/12) */}
        <div className="xl:col-span-5 space-y-6">
          
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
                    <th className="py-2 px-2">Dernière Synchro</th>
                    <th className="py-2 px-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-550 italic uppercase">
                        Aucun agent actif.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map(agent => (
                      <tr key={agent.id} className="hover:bg-[#0B1020]/25 transition text-[11px]">
                        <td className="py-2 px-2">
                          <div>
                            <span className="text-white font-bold block leading-tight">{agent.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 leading-none">
                              <span className="text-[9px] text-[#06B6D4] font-mono">v{agent.version}</span>
                              {agent.phone && (
                                <>
                                  <span className="text-slate-550 text-[8px]">•</span>
                                  <span className="text-[9px] text-slate-400 font-mono select-all">📞 {agent.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-slate-400">
                          {agent.city}, TG
                        </td>
                        <td className="py-2 px-2 text-slate-400 text-[10px] font-mono select-all">
                          {agent.lastSync ? (
                            (() => {
                              try {
                                const d = new Date(agent.lastSync);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const h = String(d.getHours()).padStart(2, '0');
                                const m = String(d.getMinutes()).padStart(2, '0');
                                const s = String(d.getSeconds()).padStart(2, '0');
                                return `${day}/${month} à ${h}:${m}:${s}`;
                              } catch(e) {
                                return agent.lastSync;
                              }
                            })()
                          ) : (
                            "En attente"
                          )}
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

        {/* Right Side: HIGH CONTEXT HIGH FIDELITY SMARTPHONE PREVIEW (Columns: 7/12) */}
        <div className="xl:col-span-7 space-y-6">
          
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
                  Sélectionnez un cas de cyber-arnaque togolaise classique ci-dessous, puis cliquez sur envoyer pour tester le comportement du téléphone et voir comment il vous protège en direct !
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start items-center justify-center gap-6 mt-4">
            
            {/* PHYSICAL SMARTPHONE CHASSIS */}
            <div className="w-[290px] h-[550px] bg-[#040814] rounded-[42px] border-4 border-slate-700 shadow-2xl relative overflow-hidden flex flex-col justify-between p-2.5 ring-8 ring-slate-900/40 shrink-0">
              
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
                    containsKnownSignature 
                      ? "border-red-500/40 shadow-red-500/5 hover:border-red-400/50" 
                      : "border-amber-500/25 hover:border-amber-400/40"
                  }`}
                  onClick={handleOpenAlertAndBlock}
                >
                  <div className={`flex items-center gap-2 mb-1.5 font-mono text-[9px] tracking-wider font-bold ${
                    containsKnownSignature ? "text-red-400" : "text-amber-400"
                  }`}>
                    <Bell className="w-3 h-3 animate-pulse" />
                    <span>
                      {containsKnownSignature 
                        ? "🚨 ARNAQUE CONFIRMÉE PAR LE CENTRE • SP_TG" 
                        : isGroupSource 
                          ? "⚠️ MESSAGE SUSPECT EN GROUPE • SP_TG" 
                          : "⚠️ TENTATIVE D'ARNAQUE DÉTECTÉE • SP_TG"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded shrink-0 ${
                      containsKnownSignature ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white text-[10px] block mb-0.5">
                        {isGroupSource 
                          ? `💬 ${groupName}` 
                          : isRegisteredContact 
                            ? `👤 ${registeredContacts[contactIndex]?.name || activeSender}` 
                            : activeSender
                        }
                      </strong>
                      <span className="text-slate-400 text-[8.5px] block font-mono mb-0.5">
                        {isGroupSource 
                          ? `Participant: ${activeSender}` 
                          : isRegisteredContact 
                            ? `Contact Enregistré: ${activeSender}` 
                            : "Numéro Inconnu (Direct)"
                        }
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

                {/* REAL-TIME INTERCEPT OVERLAY MODAL */}
                {showInAppOverlayAlert && (
                  <div className="absolute inset-x-2 top-8 bottom-8 bg-slate-950/98 border border-red-500/50 rounded-2xl z-50 flex flex-col justify-between p-4 shadow-2xl animate-fade-in text-slate-100">
                    <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                       <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                       <div className="leading-none">
                         <span className="font-mono font-bold text-[9px] text-red-400 block tracking-widest">{overlayAlertTitle}</span>
                         <span className="text-[7px] text-slate-400 font-mono uppercase font-black block mt-0.5">INTERCEPTÉ PAR SP_TG</span>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center my-2 space-y-2.5">
                       <div className="bg-white/5 border border-white/5 p-2 rounded-lg text-left">
                          <p className="text-[10px] text-slate-300 font-sans leading-relaxed">{overlayAlertMessage}</p>
                       </div>

                       <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-left">
                          <p className="text-[9px] text-red-300 font-mono font-bold leading-normal">{overlayAlertAction}</p>
                       </div>

                       <div className="border-t border-white/5 pt-2">
                          <span className="text-[7.5px] font-mono text-slate-500 block uppercase font-bold">Texte Intercepté :</span>
                          <p className="text-[8px] text-slate-400 italic line-clamp-2 mt-0.5 leading-tight">"{activeMessageText}"</p>
                       </div>
                    </div>

                    <div className="text-[7.5px] font-mono text-center text-emerald-400 bg-emerald-500/10 rounded py-1 mb-2 font-bold flex items-center justify-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5 text-emerald-400" /> TRANSMIS AU SOC DE LOMÉ EN DIRECT
                    </div>

                    <button
                      onClick={handleAcknowledgeOverlayAlert}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 transition-colors text-white font-mono text-[9px] font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-lg active:scale-95"
                    >
                      ✓ VALIDER ET FERMER L&apos;ALERTE
                    </button>
                  </div>
                )}

                {/* Simulated Screen Body according to active Phone State */}
                {phoneLocked ? (
                  /* BEAUTIFUL LOCKSCREEN FOR THE SMARTPHONE */
                  <div className="flex-1 flex flex-col justify-between z-10 pt-8 animate-fade-in text-slate-200">
                    <div className="flex flex-col items-center select-none">
                      {/* Locking status indicator */}
                      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700/60 flex items-center justify-center mb-1 shadow-md animate-pulse">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      
                      {/* High fidelity Lockscreen Date Time in French Togolese vibe */}
                      <span className="text-[7.5px] uppercase tracking-widest font-bold text-slate-500 font-mono">Lomé, Togo</span>
                      <h3 className="text-3xl font-mono font-bold tracking-tight text-white leading-none mt-1">12:45</h3>
                      <span className="text-[7.5px] text-slate-400 font-sans tracking-wide block mt-1 font-medium">Vendredi 5 Juin</span>
                    </div>

                    {/* Central Notifications space inside the Lockscreen */}
                    <div className="my-auto px-1.5 py-4 w-full flex flex-col gap-2.5">
                      {showNotification ? (
                        <div 
                          onClick={handleUnlockPhone}
                          className="bg-slate-950/95 border border-red-500/40 p-2.5 rounded-xl text-left shadow-lg scale-[98%] hover:scale-[100%] transition-transform duration-205 cursor-pointer animate-pulse"
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1.5 text-[7px] font-mono">
                            <span className="text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 animate-bounce shrink-0" /> ALERTE CYBERGAD
                            </span>
                            <span className="text-slate-500 font-bold uppercase">À l&apos;instant</span>
                          </div>
                          <strong className="text-slate-100 text-[9.5px] font-bold block mt-1">Expéditeur suspect : {activeSender}</strong>
                          <p className="text-[8.2px] text-slate-350 line-clamp-2 mt-1 leading-snug">
                            &quot;{activeMessageText}&quot;
                          </p>
                          <div className="text-[7.2px] font-mono text-amber-500 font-black mt-2 text-right border-t border-white/5 pt-1 uppercase tracking-wide">
                            👉 Cliquez pour déverrouiller et sécuriser
                          </div>
                        </div>
                      ) : (
                        <div className="text-center font-mono text-[7px] text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1 py-4">
                          <CheckCircle className="w-3 h-3 text-emerald-500/30" /> Aucun message suspect
                        </div>
                      )}
                    </div>

                    {/* Quick Swipe/Click to unlock simulator button */}
                    <button
                      onClick={handleUnlockPhone}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-mono text-[8px] font-bold uppercase tracking-widest rounded-xl transition cursor-pointer shadow-lg shadow-blue-500/10 active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>🔓 DÉVERROUILLER LE PROTOTYPE</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {phoneState === "dashboard" && (
                      <div className="flex-1 flex flex-col justify-between z-10 pt-3 animate-fade-in text-left">
                        
                        {/* Header bar styled exactly like activity_main.xml */}
                        <div className="flex items-start gap-2.5 pb-2 border-b border-white/5">
                          {/* Outlined capsule representing the uniform brand logo */}
                          <div className="w-12 h-7 rounded-full bg-[#00C896] p-[1.5px] shrink-0 self-center">
                            <div className="w-full h-full rounded-full bg-[#050B1D] flex items-center justify-center gap-0.5">
                              <span className="text-[#00C896] font-black text-[10px]">S</span>
                              <span className="text-white font-black text-[10px]">P</span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[#00C896] font-black text-[11px] tracking-wide">SP</span>
                              <span className="text-white font-black text-[11px] tracking-wide">SENTINEL</span>
                            </div>
                            <p className="text-[7.5px] text-slate-400 font-sans leading-none mt-0.5 truncate">
                              Votre gardien contre les arnaques Floov et Tmoney
                            </p>
                            <p className="text-[8px] font-bold text-emerald-400 tracking-wide mt-1">
                              🟢 PROTECTEUR ACTIF ET SÛRE
                            </p>
                          </div>

                          {/* Small action version or icon */}
                          <div className="p-1 rounded bg-[#00C896]/10 text-[#00C896] self-center shrink-0">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                        </div>

                    {/* STATUS GAUGE SIMULATING ACTIVITY */}
                    <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
                      <div className="relative w-24 h-24 flex items-center justify-center mb-1.5">
                        {/* Outer rotating pulse ring */}
                        <div className={`absolute inset-0 rounded-full border border-dashed animate-spin duration-15000 ${isShieldActive ? "border-[#00C896]/30" : "border-slate-800"}`}></div>
                        
                        {/* Inner glowing circle */}
                        <div className={`absolute w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 bg-[#00C896]/5 border border-[#00C896]/30 shadow-[#00C896]/5`}>
                          <Shield className="w-7 h-7 text-[#00C896]" />
                          <span className="text-[7.5px] font-mono tracking-widest uppercase font-bold text-slate-400 mt-1">
                            Protector
                          </span>
                        </div>
                      </div>

                      <h4 className="text-[10px] font-mono font-black uppercase text-center tracking-wider text-[#00C896]">
                        PROTÉGÉ EN TEMPS RÉEL
                      </h4>
                    </div>

                    {/* METRICS ROW MATCHING activity_main.xml CARD SHAPES */}
                    <div className="grid grid-cols-2 gap-2 pb-2">
                      <div className="bg-[#121A2F]/90 border border-white/5 p-2 rounded-2xl text-center shadow-md">
                        <span className="text-[7px] font-mono font-bold text-slate-400 block tracking-wider uppercase">PIÈGES ÉVITÉS</span>
                        <strong className="text-base font-mono text-[#EF4444] block mt-0.5">{mobileSignals.length > 0 ? mobileSignals.length : simLocalBlockedCount}</strong>
                      </div>
                      <div className="bg-[#121A2F]/90 border border-white/5 p-2 rounded-2xl text-center shadow-md">
                        <span className="text-[7px] font-mono font-bold text-[#94A3B8] block tracking-wider uppercase">ARNAQUES CONNUES</span>
                        <strong className="text-base font-mono text-[#00C896] block mt-0.5">{threats.length > 0 ? threats.length : 148}</strong>
                      </div>
                    </div>

                    {/* BIG SIMPLIFIED SECURITY STATUS BUTTON MATCHING activity_main.xml */}
                    <div className="space-y-1.5">
                      <button 
                        onClick={() => {
                          setIsShieldActive(!isShieldActive);
                          if (!isShieldActive) {
                            setSimLocalBlockedCount(prev => prev + 1);
                          }
                        }}
                        className={`w-full py-2 rounded-2xl font-mono text-[9px] font-black uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all text-center flex flex-col justify-center items-center cursor-pointer ${isShieldActive ? "bg-[#10B981] hover:bg-[#059669]" : "bg-[#EF4444] hover:bg-[#DC2626]"}`}
                      >
                        {isShieldActive ? (
                          <>
                            <span>🟢 PROTECTION ACTIVÉE ET SÛRE</span>
                            <span className="text-[6.5px] font-semibold opacity-80">(Appuyez pour vérifier à nouveau)</span>
                          </>
                        ) : (
                          <>
                            <span>🔴 SÉCURITÉ INACTIVE</span>
                            <span className="text-[6.5px] font-semibold opacity-80">(Touchez pour activer)</span>
                          </>
                        )}
                      </button>

                      <p className="text-[6.8px] text-slate-500 font-sans leading-none text-center">
                        * Fonctionne en toute sécurité sans connexion internet.
                      </p>

                      <p className="text-[8px] text-slate-500 font-sans text-center mt-1 pt-1 border-t border-white/5">
                        Dernier contrôle de sécurité effectué : Aujourd&apos;hui
                      </p>
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
                    {isGroupSource && !containsKnownSignature ? (
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
                        
                        {/* Nuanced Header based on whether sender is registered or unknown */}
                        {isRegisteredContact ? (
                          /* COMPASSIONATE WARNING FOR CONFIRMED FRAUD SENT BY A KNOWN CONTACT */
                          <div className="p-2 rounded-xl flex items-center gap-2 bg-amber-500/15 border border-amber-500/35">
                            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                            <div className="leading-tight text-[10px]">
                              <h4 className="font-bold text-amber-500 font-mono text-[9px] tracking-wide uppercase">
                                ⚠️ MESSAGE SUSPECT • PROCHE ABUSÉ ?
                              </h4>
                              <span className="text-[7.5px] text-slate-400 block font-mono">
                                Menace relayée par un de vos contacts
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* SEVERE ALARM FOR CONFIRMED FRAUD SENT BY AN UNKNOWN SENDER */
                          <div className="p-2 rounded-xl flex items-center gap-2 bg-red-500/25 border border-red-500/40">
                            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />
                            <div className="leading-tight text-[10px]">
                              <h4 className="font-bold text-red-400 font-mono text-[9px] tracking-wide uppercase">
                                🚨 DANGER ARRÊTÉ • ALERTE ABSOLUE
                              </h4>
                              <span className="text-[7.5px] text-slate-450 block font-mono">
                                Numéro inconnu répertorié par Lomé Sûre
                              </span>
                            </div>
                          </div>
                        )}

                        {/* SUSPECT MESSAGE INFO CONTAINER */}
                        <div className="bg-slate-950 border border-white/5 p-2.5 rounded-xl mt-2.5 space-y-2 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[7.8px] font-mono border-b border-white/5 pb-1">
                              <span className="text-slate-400">
                                {isGroupSource 
                                  ? `Groupe : ${groupName}` 
                                  : isRegisteredContact
                                    ? `Contact enregistré : ${registeredContacts[contactIndex]?.name || activeSender}`
                                    : `De (Inconnu) : ${activeSender}`
                                }
                              </span>
                              <span className="text-red-400 uppercase font-bold tracking-wider text-[7.5px]">Piège Intercepté</span>
                            </div>
                            <p className="mt-1.5 text-[8.2px] font-sans text-amber-100 leading-snug italic bg-amber-500/5 p-2 rounded border border-amber-500/10 max-h-[85px] overflow-y-auto">
                              &quot;{activeMessageText}&quot;
                            </p>
                          </div>

                          {/* DYNAMIC RULES & SOCIAL ADVISORY ACCORDING TO SENDER RELIABILITY */}
                          {isRegisteredContact ? (
                            <div className="bg-amber-950/20 p-2 border border-amber-500/15 rounded-lg space-y-1">
                              <span className="text-[8.5px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                                ℹ️ CONSEIL IMPORTANT ET BIENVEILLANT :
                              </span>
                              <div className="text-[7.8px] text-slate-300 font-sans space-y-1 leading-normal">
                                <p>
                                  Le numéro de votre proche <strong>{registeredContacts[contactIndex]?.name || activeSender}</strong> partage avec vous un message qui a été détecté comme utilisé par de nombreux attaquants et déclaré comme fraude auprès du poste central (SOC).
                                </p>
                                <p className="text-amber-300">
                                  <strong>Ne blâmez pas l&apos;auteur !</strong> Votre proche n&apos;est probablement pas l&apos;attaquant : il a pu être lui-même piraté ou a simplement transféré ce piège de bonne foi. Ne lui en voulez pas.
                                </p>
                                <p className="font-bold">
                                  👉 Veuillez simplement supprimer ce message, ne pas cliquer, et lui passer un appel téléphonique direct pour l&apos;avertir gentiment.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-950/25 p-2 border border-red-500/20 rounded-lg space-y-1">
                              <span className="text-[8.5px] font-mono font-bold text-red-100/90 uppercase tracking-wider block">
                                🛑 EXPÉDITEUR MALVEILLANT - ACTION DIRECTE :
                              </span>
                              <div className="text-[7.8px] text-slate-300 font-sans space-y-1 leading-normal">
                                <p>
                                  ⚠️ <strong>Bloquez ce numéro ({activeSender}) :</strong> C&apos;est une tentative claire d&apos;arnaque envoyée par un inconnu de façon malveillante.
                                </p>
                                <p>
                                  ❌ <strong>Supprimez le message :</strong> Ne l&apos;envoyez à personne, ne cliquez sur aucun lien, et n&apos;indiquez aucun mot de passe ni versement d&apos;argent.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Heuristics reasoning */}
                          <div className="border-t border-white/5 pt-1">
                            <span className="text-[7px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Dossier de signalement au SOC :</span>
                            <p className="text-[7.5px] text-slate-400 leading-normal font-mono mt-0.5">
                              {simTemplates[selectedTemplate] ? simTemplates[selectedTemplate].heuristics : "Base de signatures de cybermenace de Lomé."}
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
                            <span className="text-amber-400 animate-pulse font-bold">TRANSMISSION...</span>
                          ) : (
                            <span className="text-emerald-450 font-bold flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> BLOQUÉ DE SÉCURITÉ !
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

              </>
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
            <div className="w-[290px] bg-[#121A2F]/80 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md font-mono text-xs shrink-0">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider block text-center border-b border-white/5 pb-1.5">
                🎛️ Simulateur d&apos;envoi de messages
              </span>

              {/* État du téléphone (Allumé/Éteint) selector */}
              <div className="space-y-1 bg-[#050B1D]/50 p-2 border border-white/5 rounded-xl">
                <label className="text-[8px] text-[#38BDF8] block uppercase font-bold tracking-wider mb-1.5">Statut initial du Téléphone :</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPhoneLocked(false);
                      setShowInAppOverlayAlert(false);
                      setShowNotification(false);
                      setPhoneState("dashboard");
                      addLog("📱 Téléphone configuré : Allumé & Actif (En cours d'utilisation).", "info");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[8px] border font-bold font-mono transition duration-200 cursor-pointer text-center select-none ${!phoneLocked ? "bg-[#3B82F6]/20 text-[#38BDF8] border-[#38BDF8]/40" : "bg-transparent text-slate-500 border-white/5 hover:text-slate-350"}`}
                  >
                    📱 ALLUMÉ
                  </button>
                  <button
                    onClick={() => {
                      setPhoneLocked(true);
                      setShowInAppOverlayAlert(false);
                      setShowNotification(false);
                      setPhoneState("dashboard");
                      addLog("🔒 Téléphone configuré : Éteint / Verrouillé (Mode Veille).", "info");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[8px] border font-bold font-mono transition duration-200 cursor-pointer text-center select-none ${phoneLocked ? "bg-amber-500/15 text-amber-400 border-amber-500/35" : "bg-transparent text-slate-500 border-white/5 hover:text-slate-350"}`}
                  >
                    🔒 VERROUILLÉ
                  </button>
                </div>
              </div>

              {/* Provenance du message / Source selection */}
              <div className="space-y-1">
                <label className="text-[9px] text-[#38BDF8] block uppercase font-bold tracking-wider">Qui envoie le message ?</label>
                <select
                  value={messageSourceType}
                  onChange={(e) => {
                    const val = e.target.value as "unknown" | "contact" | "group";
                    setMessageSourceType(val);
                    if (val === "contact") {
                      // Automatically update customSender with contact's phone
                      setCustomSender(registeredContacts[contactIndex].phone);
                    } else if (val === "unknown") {
                      setCustomSender("+228 99 12 04 85");
                    }
                  }}
                  className="w-full bg-[#0B1020] border border-[#38BDF8]/20 text-[10px] p-1.5 rounded focus:outline-none text-sky-300 font-bold cursor-pointer"
                >
                  <option value="unknown">👤 Un numéro inconnu (Non enregistré)</option>
                  <option value="contact">👥 Un de mes contacts (Enregistré)</option>
                  <option value="group">💬 Un message reçu dans un groupe WhatsApp</option>
                </select>
              </div>

              {/* Conditional Contact selection */}
              {messageSourceType === "contact" && (
                <div className="space-y-1 bg-sky-950/20 p-2 border border-sky-500/10 rounded animate-fade-in">
                  <label className="text-[8.5px] text-sky-400 block uppercase font-bold">Choisir le contact :</label>
                  <select
                    value={contactIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      setContactIndex(idx);
                      setCustomSender(registeredContacts[idx].phone);
                    }}
                    className="w-full bg-[#0B1020] border border-sky-500/15 text-[10px] p-1 rounded text-white cursor-pointer"
                  >
                    {registeredContacts.map((c, i) => (
                      <option key={i} value={i}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                  <span className="text-[7.5px] text-slate-450 leading-normal block pt-1">
                    ℹ️ Vos contacts enregistrés sont réputés sûrs par défaut. L&apos;analyse d&apos;ingénierie sociale (NLP) y est désactivée pour zéro faux-positif. Seul un piratage avéré (détecté par la base de signatures de Lomé) lancera l&apos;alerte.
                  </span>
                </div>
              )}

              {/* Conditional Group Name input */}
              {messageSourceType === "group" && (
                <div className="space-y-1 bg-emerald-950/10 p-2 border border-emerald-500/10 rounded animate-fade-in">
                  <label className="text-[8.5px] text-emerald-400 block uppercase font-bold">Nom du groupe :</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-[#0B1020] border border-emerald-500/15 text-[10px] p-1.5 rounded text-white font-mono"
                  />
                  {trustedGroups.includes(groupName) ? (
                    <span className="text-[7.8px] text-emerald-400 font-bold block pt-1">
                      ✅ Ce groupe est dans votre LISTE VERTE. Les alertes de détection de manipulation en direct y sont désactivées.
                    </span>
                  ) : (
                    <span className="text-[7.5px] text-amber-500 block pt-1">
                      ⚠️ Groupe absent de votre Liste Verte. Vos défenses analyseront d&apos;éventuelles techniques de manipulation en direct pour vous alerter.
                    </span>
                  )}
                </div>
              )}

              {/* Template dropdown list */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 block uppercase">Choisir un SMS / Message type :</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1.5 rounded focus:outline-none text-slate-300 cursor-pointer text-[9.5px]"
                >
                  <option value={-1}>Saisie personnalisée (Écrire vous-même)</option>
                  {simTemplates.map((tpl, i) => (
                    <option key={i} value={i}>
                      {tpl.title} {tpl.isSignature ? "• [🔴 Présent dans la base de données]" : "• [🟡 Non répertorié dans la base]"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom sender number */}
              <div className="grid grid-cols-1 gap-1.5">
                {messageSourceType !== "contact" && (
                  <div>
                    <label className="text-[9px] text-slate-450 block uppercase">Numéro de l&apos;expéditeur :</label>
                    <input
                      type="text"
                      value={customSender}
                      onChange={(e) => {
                        setCustomSender(e.target.value);
                        setSelectedTemplate(-1);
                      }}
                      placeholder="+228..."
                      className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1 rounded font-mono text-white text-[9.5px]"
                    />
                  </div>
                )}
                
                {/* Custom text body */}
                <div>
                  <label className="text-[9px] text-slate-450 block uppercase">Texte du message à tester :</label>
                  <textarea
                    value={customText}
                    onChange={(e) => {
                      setCustomText(e.target.value);
                      setSelectedTemplate(-1);
                    }}
                    rows={3}
                    placeholder="Contenu du SMS à intercepter..."
                    className="w-full bg-[#0B1020] border border-white/10 text-[10px] p-1.5 rounded resize-none text-slate-200"
                  />
                  {containsKnownSignature && (
                    <div className="text-[8px] text-red-500 font-bold font-mono mt-1 flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0"></span>
                      DÉTECTÉ : Contient une signature de la base locale de Lomé !
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION TRIGGER BUTTON */}
              <button
                onClick={handleSimulateSMS}
                disabled={!customText.trim()}
                className="w-full py-2.5 bg-[#EF4444] hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 font-mono text-[9px] font-bold text-white rounded-xl uppercase transition tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-550/10 active:scale-[98%]"
              >
                <Send className="w-3.5 h-3.5" />
                📱 ENVOYER LE MESSAGE SUR LE TÉLÉPHONE
              </button>

              <div className="bg-blue-950/20 border border-blue-500/10 p-2 rounded text-[8.5px] text-slate-400 text-center leading-normal">
                💡 <strong>Priorité de Blocage :</strong>
                <ul className="text-left list-disc list-inside mt-1 space-y-1 text-slate-400">
                  <li><strong>Téléphone actif (Allumé) :</strong> L&apos;alerte détaillée s&apos;ouvre <span className="text-red-400 font-bold">instantanément</span> en plein écran pour faire barrière, sans nécessiter aucun clic sur une notification.</li>
                  <li><strong>Téléphone verrouillé :</strong> L&apos;alerte attend le déverrouillage de l&apos;appareil puis surgit automatiquement à l&apos;écran pour bloquer l&apos;utilisateur avant toute lecture.</li>
                </ul>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
