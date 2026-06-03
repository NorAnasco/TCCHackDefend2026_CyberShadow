import fs from "fs";
import path from "path";

// Define interfaces representing database relations
export interface Campaign {
  id: string;
  name: string;
  target: string;
  status: "Active" | "Terminated" | "Monitored";
  description: string;
  createdAt: string;
}

export interface Threat {
  id: string;
  type: "domain" | "ip" | "email" | "phone" | "text_pattern";
  value: string; // The indicator (e.g. toggotelecom-tmoney.com, +228 90 12 34 56)
  severity: "Low" | "Medium" | "Critical";
  status: "active" | "validated" | "sandbox" | "whitelist";
  campaignId: string | null; // Belongs to a campaign
  detectedAt: string;
  details: string;
  location: string; // e.g., Lomé, Kara, Sokodé, Cinkassé
}

export interface MobileAgent {
  id: string;
  name: string;
  city: string; // Lomé, Kara, Sokodé, Atakpamé, Kpalimé, Cinkassé
  status: "Online" | "Offline" | "Syncing";
  lastSync: string;
  version: string;
  ipAddress: string;
}

export interface DbSnapshot {
  id: string;
  timestamp: string;
  threatsCount: number;
  threats: Threat[];
  campaigns: Campaign[];
  agents: MobileAgent[];
}

export interface SynchronisationConfig {
  defaultSyncIntervalDays: number; // e.g., 14
  lastFlashUpdateAt: string | null;
  flashUpdateStatus: "Idle" | "Running" | "Success" | "Failed";
  gatewayAddress: string; // Dynamic IP or domain of server distributed to agents
  customApiKey?: string | null;
  aiSelection?: "gemini" | "simulation";
}

export interface AdminAccount {
  username: string;
  password: string;
  role: string;
  createdAt: string;
}

export interface MobileSignal {
  id: string;
  deviceId: string;
  senderPhone: string;
  evidenceText: string;
  location: string;
  timestamp: string;
  status: "pending" | "approved";
  agentName?: string;
}

interface DatabaseSchema {
  campaigns: Campaign[];
  threats: Threat[];
  agents: MobileAgent[];
  config: SynchronisationConfig;
  snapshots?: DbSnapshot[];
  admins?: AdminAccount[];
  mobileSignals?: MobileSignal[];
}

const DB_FILE_PATH = path.join(process.cwd(), "server", "db.json");

// Define demo database with high-fidelity, Togo-specific threat feeds
const demoDatabase: DatabaseSchema = {
  campaigns: [
    {
      id: "c-001",
      name: "Arnaque Support Togo-Télécom",
      target: "Fournisseurs Internet au Togo",
      status: "Active",
      description: "Usurpation d'identité du support technique pour dérober les accès abonnés.",
      createdAt: "2026-05-10T08:00:00Z"
    },
    {
      id: "c-002",
      name: "SMS Phishing Yas / Moov Africa Money",
      target: "Abonnés Mobile Money Togo",
      status: "Active",
      description: "Campagnes massives de SMS malveillants usurpant Moov Africa et Yas pour voler les codes USSD confidentiels.",
      createdAt: "2026-05-15T10:15:00Z"
    },
    {
      id: "c-003",
      name: "Clonage Portail Banque Atlantique",
      target: "Clients Bancaires Lomé",
      status: "Monitored",
      description: "Copies conformes de la page de connexion bancaire destinées à voler les identifiants.",
      createdAt: "2026-05-18T14:30:00Z"
    },
    {
      id: "c-004",
      name: "Hameçonnage Facturations CEET",
      target: "Consommateurs d'Électricité (CEET)",
      status: "Active",
      description: "Fausse alerte d'impayé redirigeant vers de faux sites de paiement mobile Yas / Moov Africa.",
      createdAt: "2026-05-20T09:00:00Z"
    }
  ],
  threats: [
    {
      id: "t-001",
      type: "domain",
      value: "togotelecom-support-update.com",
      severity: "Medium",
      status: "active",
      campaignId: "c-001",
      detectedAt: "2026-05-11T09:30:00Z",
      details: "Serveur malveillant hébergeant un kit de pêche d'identifiants.",
      location: "Lomé"
    },
    {
      id: "t-002",
      type: "phone",
      value: "+22899014523",
      severity: "Critical",
      status: "active",
      campaignId: "c-002",
      detectedAt: "2026-05-16T11:45:00Z",
      details: "Transmetteur de fraudes SMS usurpant le service client Moov Africa.",
      location: "Lomé"
    },
    {
      id: "t-003",
      type: "domain",
      value: "banque-atlantique-togo-secure.net",
      severity: "Critical",
      status: "active",
      campaignId: "c-003",
      detectedAt: "2026-05-18T15:00:00Z",
      details: "Faux relais web capturant les codes secrets d'authentification bancaire.",
      location: "Kpalimé"
    },
    {
      id: "t-004",
      type: "email",
      value: "ceet-support@gmx.com",
      severity: "Low",
      status: "active",
      campaignId: "c-004",
      detectedAt: "2026-05-20T11:20:00Z",
      details: "Spam ciblant les entreprises de Kara avec de fausses relances de règlement.",
      location: "Kara"
    },
    {
      id: "t-005",
      type: "ip",
      value: "192.241.132.44",
      severity: "Medium",
      status: "active",
      campaignId: "c-001",
      detectedAt: "2026-05-12T13:40:00Z",
      details: "Relais de commande lié au kit d'hameçonnage.",
      location: "Sokodé"
    },
    {
      id: "t-006",
      type: "phone",
      value: "+22890558412",
      severity: "Critical",
      status: "active",
      campaignId: "c-002",
      detectedAt: "2026-05-21T08:12:00Z",
      details: "Émetteur d'hameçonnage visant les abonnés Yas Mobile.",
      location: "Sokodé"
    },
    {
      id: "t-007",
      type: "domain",
      value: "ceet-facturation-togo.org",
      severity: "Critical",
      status: "active",
      campaignId: "c-004",
      detectedAt: "2026-05-22T16:00:00Z",
      details: "Clonage d'interface redirigeant vers un faux guichet de paiement Yas.",
      location: "Lomé"
    },
    {
      id: "t-008",
      type: "text_pattern",
      value: "Alerte Moov Africa : Votre portefeuille est suspendu. Confirmez via Yas/Moov...",
      severity: "Critical",
      status: "active",
      campaignId: "c-002",
      detectedAt: "2026-05-23T04:20:00Z",
      details: "Signature textuelle de chantage financier interceptée sur le réseau.",
      location: "Atakpamé"
    }
  ],
  agents: [
    { id: "agent-01", name: "SOC-Agent-Lome-Centre", city: "Lomé", status: "Online", lastSync: "2026-05-22T21:45:00Z", version: "v1.4.2", ipAddress: "102.64.21.34" },
    { id: "agent-02", name: "SOC-Agent-Lome-Port", city: "Lomé", status: "Online", lastSync: "2026-05-23T06:12:00Z", version: "v1.4.2", ipAddress: "102.64.22.41" },
    { id: "agent-03", name: "SOC-Agent-Kara-Univ", city: "Kara", status: "Online", lastSync: "2026-05-21T18:30:00Z", version: "v1.4.1", ipAddress: "102.65.10.22" },
    { id: "agent-04", name: "SOC-Agent-Sokode-Regia", city: "Sokodé", status: "Online", lastSync: "2026-05-22T10:15:00Z", version: "v1.4.2", ipAddress: "102.65.40.11" },
    { id: "agent-05", name: "SOC-Agent-Atakpame-Plateau", city: "Atakpamé", status: "Online", lastSync: "2026-05-20T14:40:00Z", version: "v1.4.0", ipAddress: "102.65.60.98" },
    { id: "agent-06", name: "SOC-Agent-Kpalime-West", city: "Kpalimé", status: "Online", lastSync: "2026-05-23T01:30:00Z", version: "v1.4.2", ipAddress: "102.64.99.12" },
    { id: "agent-07", name: "SOC-Agent-Cinkasse-Border", city: "Cinkassé", status: "Online", lastSync: "2026-05-19T11:00:00Z", version: "v1.4.0", ipAddress: "102.66.12.44" },
    { id: "agent-08", name: "SOC-Agent-Aneho-Littoral", city: "Aného", status: "Offline", lastSync: "2026-05-15T09:25:00Z", version: "v1.3.9", ipAddress: "102.64.88.75" }
  ],
  config: {
    defaultSyncIntervalDays: 14,
    lastFlashUpdateAt: "2026-05-20T11:00:00Z",
    flashUpdateStatus: "Idle",
    gatewayAddress: "http://102.64.21.30:3000"
  },
  snapshots: [],
  admins: [
    { username: "ANANIVI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "RADJI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "KPETO", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "EHEY", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" }
  ],
  mobileSignals: [
    {
      id: "sig-1",
      deviceId: "agent-01",
      agentName: "SOC-Agent-Lome-Centre",
      senderPhone: "+22899014523",
      evidenceText: "[WhatsApp SMS] Lotto Moov Partner : Félicitations, vous avez gagné la somme d'un demi million (500 000F CFA) Moov Money. Veuillez confirmer votre identité.",
      location: "Lomé",
      timestamp: "2026-05-27T10:00:00Z",
      status: "pending"
    },
    {
      id: "sig-2",
      deviceId: "agent-03",
      agentName: "SOC-Agent-Kara-Univ",
      senderPhone: "+22890558412",
      evidenceText: "[SMS] Togocom Tmoney : Avis d'urgence. Votre compte Tmoney fait l'objet d'une suspension. Contactez notre support.",
      location: "Kara",
      timestamp: "2026-05-27T12:30:00Z",
      status: "pending"
    },
    {
      id: "sig-3",
      deviceId: "agent-04",
      agentName: "SOC-Agent-Sokode-Regia",
      senderPhone: "+22899014523",
      evidenceText: "[WhatsApp SMS] Félicitations Moov : Vous avez reçu un virement d'un gain officiel. Recevez-le sur votre compte.",
      location: "Sokodé",
      timestamp: "2026-05-27T14:15:00Z",
      status: "pending"
    },
    {
      id: "sig-4",
      deviceId: "agent-05",
      agentName: "SOC-Agent-Atakpame-Plateau",
      senderPhone: "+22891122334",
      evidenceText: "[Moov Money] Votre solde est temporairement bloqué. Confirmez pour débloquer.",
      location: "Atakpamé",
      timestamp: "2026-05-27T16:45:00Z",
      status: "pending"
    }
  ]
};

const initialDatabase: DatabaseSchema = {
  campaigns: [],
  threats: [],
  agents: [],
  config: {
    defaultSyncIntervalDays: 14,
    lastFlashUpdateAt: null,
    flashUpdateStatus: "Idle",
    gatewayAddress: "http://102.64.21.30:3000"
  },
  snapshots: [],
  admins: [
    { username: "ANANIVI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "RADJI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "KPETO", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
    { username: "EHEY", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" }
  ],
  mobileSignals: []
};

class DBManager {
  private db: DatabaseSchema;

  constructor() {
    this.db = initialDatabase;
    this.initDatabaseFile();
    // Enforce default properties for backwards compatibility
    if (!this.db.config) {
      this.db.config = { ...initialDatabase.config };
    }
    if (this.db.config.gatewayAddress === undefined) {
      this.db.config.gatewayAddress = "http://102.64.21.30:3000";
    }
    if (this.db.config.customApiKey === undefined) {
      this.db.config.customApiKey = null;
    }
    if (this.db.config.aiSelection === undefined) {
      this.db.config.aiSelection = "gemini";
    }
    if (!this.db.snapshots) {
      this.db.snapshots = [];
    }
    if (!this.db.mobileSignals) {
      this.db.mobileSignals = [];
    }
    if (!this.db.admins || this.db.admins.length === 0) {
      this.db.admins = [
        { username: "ANANIVI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
        { username: "RADJI", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
        { username: "KPETO", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" },
        { username: "EHEY", password: "admin12345", role: "Administrateur", createdAt: "2026-05-27T12:00:00Z" }
      ];
    }
    this.save();
  }

  private initDatabaseFile() {
    try {
      // Ensure directory exists
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
        this.db = JSON.parse(raw);
        console.log("Database successfully loaded from file.");
      } else {
        this.db = initialDatabase; // Start empty by default!
        this.save();
        console.log("Initiated new file-based empty local database.");
      }
    } catch (e) {
      console.error("Failed to load local database, using in-memory state.", e);
      this.db = initialDatabase;
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.db, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write to database file.", e);
    }
  }

  // Clear data completely for live testing, saving snapshot history!
  public clearAll() {
    if (!this.db.snapshots) {
      this.db.snapshots = [];
    }

    if (this.db.threats.length > 0 || this.db.agents.length > 0) {
      const snapshot: DbSnapshot = {
        id: `snap-${Date.now()}`,
        timestamp: new Date().toISOString(),
        threatsCount: this.db.threats.length,
        threats: [...this.db.threats],
        campaigns: [...this.db.campaigns],
        agents: [...this.db.agents]
      };
      this.db.snapshots.unshift(snapshot);
      // Keep up to 6 historical snapshots
      if (this.db.snapshots.length > 6) {
        this.db.snapshots.pop();
      }
    }

    this.db.campaigns = [];
    this.db.threats = [];
    this.db.agents = [];
    this.db.mobileSignals = [];
    this.db.config.lastFlashUpdateAt = null;
    this.db.config.flashUpdateStatus = "Idle";
    this.save();
  }

  // Restore snapshot by ID
  public restoreSnapshot(snapshotId: string): boolean {
    if (!this.db.snapshots) return false;
    const found = this.db.snapshots.find(s => s.id === snapshotId);
    if (found) {
      this.db.threats = [...found.threats];
      this.db.campaigns = [...found.campaigns];
      this.db.agents = [...found.agents];
      this.save();
      return true;
    }
    return false;
  }

  // Get list of historical snapshots
  public getSnapshots(): DbSnapshot[] {
    return this.db.snapshots || [];
  }

  // Restore signature inputs directly through file upload
  public importSignatures(importedThreats: Threat[]): { success: boolean, count: number } {
    if (!Array.isArray(importedThreats)) return { success: false, count: 0 };
    
    let added = 0;
    importedThreats.forEach(t => {
      // Ensure it has required properties and avoid duplicate values
      if (t && t.value && t.type) {
        const exist = this.db.threats.some(existing => existing.value === t.value);
        if (!exist) {
          this.db.threats.push({
            id: t.id || `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: t.type,
            value: t.value,
            severity: t.severity || "Medium",
            status: t.status || "active",
            campaignId: t.campaignId || null,
            detectedAt: t.detectedAt || new Date().toISOString(),
            details: t.details || "Signature importée de sauvegarde",
            location: t.location || "Lomé"
          });
          added++;
        }
      }
    });

    if (added > 0) {
      this.db.threats.sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
      this.save();
    }
    return { success: true, count: added };
  }

  // Reload Togo-specific demonstration mocks
  public loadMocks() {
    this.db.campaigns = [...demoDatabase.campaigns];
    this.db.threats = [...demoDatabase.threats];
    this.db.agents = [...demoDatabase.agents];
    this.db.mobileSignals = [...(demoDatabase.mobileSignals || [])];
    this.db.config.lastFlashUpdateAt = demoDatabase.config.lastFlashUpdateAt;
    this.db.config.flashUpdateStatus = demoDatabase.config.flashUpdateStatus;
    this.db.config.gatewayAddress = demoDatabase.config.gatewayAddress || "http://102.64.21.30:3000";
    this.save();
  }

  // Threats
  public getThreats(): Threat[] {
    return this.db.threats;
  }

  public addThreat(threat: Omit<Threat, "id" | "detectedAt">): Threat {
    const newThreat: Threat = {
      ...threat,
      id: `t-${Date.now()}`,
      detectedAt: new Date().toISOString()
    };
    this.db.threats.push(newThreat);
    this.save();
    return newThreat;
  }

  public deleteThreat(id: string): boolean {
    const idx = this.db.threats.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.db.threats.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public updateThreat(id: string, updatedFields: Partial<Omit<Threat, "id">>): Threat | null {
    const item = this.db.threats.find(t => t.id === id);
    if (item) {
      Object.assign(item, updatedFields);
      this.save();
      return item;
    }
    return null;
  }

  public registerSanboxedThreat(threat: Omit<Threat, "id" | "detectedAt" | "status">): Threat {
    const newThreat: Threat = {
      ...threat,
      id: `t-${Date.now()}`,
      status: "validated", // confirmed threat
      detectedAt: new Date().toISOString()
    };
    this.db.threats.push(newThreat);
    this.save();
    return newThreat;
  }

  public checkIndicator(value: string): Threat | null {
    const v = value.trim().toLowerCase();
    const found = this.db.threats.find(t => t.value.trim().toLowerCase() === v);
    return found || null;
  }

  // Campaigns
  public getCampaigns(): Campaign[] {
    return this.db.campaigns;
  }

  public addCampaign(campaign: Omit<Campaign, "id" | "createdAt">): Campaign {
    const newCampaign: Campaign = {
      ...campaign,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.db.campaigns.push(newCampaign);
    this.save();
    return newCampaign;
  }

  // Agents
  public getAgents(): MobileAgent[] {
    return this.db.agents;
  }

  public addAgent(agent: MobileAgent): MobileAgent {
    this.db.agents.push(agent);
    this.save();
    return agent;
  }

  public updateAgentLastSync(agentId: string) {
    const agent = this.db.agents.find(a => a.id === agentId);
    if (agent) {
      agent.lastSync = new Date().toISOString();
      agent.status = "Online";
      this.save();
    }
  }

  // Sync config
  public getConfig(): SynchronisationConfig {
    return this.db.config;
  }

  public setSyncInterval(days: number) {
    this.db.config.defaultSyncIntervalDays = days;
    this.save();
  }

  public setGatewayAddress(addr: string) {
    this.db.config.gatewayAddress = addr;
    this.save();
  }

  public setCustomApiKey(key: string | null) {
    this.db.config.customApiKey = key ? key.trim() : null;
    this.save();
  }

  public setAiSelection(selection: "gemini" | "simulation") {
    this.db.config.aiSelection = selection;
    this.save();
  }

  public triggerFlashUpdate(): { success: boolean, lastFlashUpdateAt: string, syncedAgents: number } {
    this.db.config.lastFlashUpdateAt = new Date().toISOString();
    this.db.config.flashUpdateStatus = "Success";
    
    // Simulate updating all online mobile agents lastSync times
    let count = 0;
    this.db.agents.forEach(agent => {
      if (agent.status === "Online") {
        agent.lastSync = new Date().toISOString();
        count++;
      }
    });

    this.save();
    return {
      success: true,
      lastFlashUpdateAt: this.db.config.lastFlashUpdateAt,
      syncedAgents: count
    };
  }

  // --- ADMIN ACCOUNTS MANAGEMENT ---
  public getAdmins(): Omit<AdminAccount, "password">[] {
    return (this.db.admins || []).map(a => ({
      username: a.username,
      role: a.role,
      createdAt: a.createdAt
    }));
  }

  public verifyAdmin(username: string, envPass: string): AdminAccount | null {
    const u = username.trim().toUpperCase();
    const found = (this.db.admins || []).find(a => a.username.toUpperCase() === u);
    if (found && found.password === envPass) {
      return found;
    }
    return null;
  }

  public updateAdminPassword(username: string, newPass: string): boolean {
    const u = username.trim().toUpperCase();
    const found = (this.db.admins || []).find(a => a.username.toUpperCase() === u);
    if (found) {
      found.password = newPass;
      this.save();
      return true;
    }
    return false;
  }

  public createAdminAccount(username: string, pass: string, role: string = "Administrateur"): { success: boolean, error?: string } {
    const u = username.trim().toUpperCase();
    if (!u || u.length < 3) return { success: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
    if (!pass || pass.length < 5) return { success: false, error: "Le mot de passe doit contenir au moins 5 caractères." };
    
    if (!this.db.admins) this.db.admins = [];
    const alreadyExists = this.db.admins.some(a => a.username.toUpperCase() === u);
    if (alreadyExists) return { success: false, error: `L'administrateur ${username} existe déjà.` };

    this.db.admins.push({
      username: username.trim(),
      password: pass,
      role: role || "Administrateur",
      createdAt: new Date().toISOString()
    });
    this.save();
    return { success: true };
  }

  public deleteAdminAccount(username: string): boolean {
    const u = username.trim().toUpperCase();
    if (!this.db.admins) return false;
    const initialLen = this.db.admins.length;
    
    // Empêcher de supprimer le dernier administrateur
    if (initialLen <= 1) return false;

    this.db.admins = this.db.admins.filter(a => a.username.toUpperCase() !== u);
    if (this.db.admins.length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- MOBILE SIGNALS FROM MOBILE AGENTS ---
  public getMobileSignals(): MobileSignal[] {
    if (!this.db.mobileSignals) {
      this.db.mobileSignals = [];
    }
    return this.db.mobileSignals;
  }

  public addMobileSignal(signal: Omit<MobileSignal, "id" | "timestamp" | "status">): MobileSignal {
    if (!this.db.mobileSignals) {
      this.db.mobileSignals = [];
    }
    const newSignal: MobileSignal = {
      ...signal,
      id: `sig-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      status: "pending"
    };
    this.db.mobileSignals.push(newSignal);
    this.save();
    return newSignal;
  }

  public deleteMobileSignal(id: string): boolean {
    if (!this.db.mobileSignals) return false;
    const idx = this.db.mobileSignals.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.db.mobileSignals.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public approveMobileSignal(id: string): { success: boolean; threat?: Threat } {
    if (!this.db.mobileSignals) return { success: false };
    const signal = this.db.mobileSignals.find(s => s.id === id);
    if (signal) {
      signal.status = "approved";
      
      // Push to threats if not already exists!
      const existing = this.checkIndicator(signal.senderPhone || signal.evidenceText);
      if (!existing) {
        let threatType: "domain" | "ip" | "email" | "phone" | "text_pattern" = "phone";
        let value = signal.senderPhone || "";
        
        if (!value) {
          value = signal.evidenceText;
          if (value.startsWith("http://") || value.startsWith("https://") || value.includes(".com") || value.includes(".net") || value.includes(".tg")) {
            threatType = "domain";
          } else {
            threatType = "text_pattern";
          }
        }
        
        const added = this.addThreat({
          type: threatType,
          value: value,
          severity: "Critical",
          status: "active",
          campaignId: null,
          details: `Approuvé depuis l'alerte mobile: ${signal.evidenceText.substring(0, 100)}`,
          location: signal.location || "Lomé"
        });
        this.save();
        return { success: true, threat: added };
      }
      this.save();
      return { success: true };
    }
    return { success: false };
  }
}

export const dbManager = new DBManager();
