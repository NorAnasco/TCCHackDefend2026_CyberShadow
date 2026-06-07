export interface Threat {
  id: string;
  type: "domain" | "ip" | "email" | "phone" | "text_pattern";
  value: string;
  severity: "Low" | "Medium" | "Critical";
  status: "active" | "validated" | "sandbox" | "whitelist";
  campaignId: string | null;
  detectedAt: string;
  details: string;
  location: string;
}

export interface Campaign {
  id: string;
  name: string;
  target: string;
  status: "Active" | "Terminated" | "Monitored";
  description: string;
  createdAt: string;
}

export interface MobileAgent {
  id: string;
  name: string;
  city: string;
  phone?: string;
  status: "Online" | "Offline" | "Syncing";
  lastSync: string;
  version: string;
  ipAddress: string;
}

export interface DbSnapshot {
  id: string;
  timestamp: string;
  threatsCount: number;
  threats: any[];
  campaigns: any[];
  agents: any[];
}

export interface SyncConfig {
  defaultSyncIntervalDays: number;
  lastFlashUpdateAt: string | null;
  flashUpdateStatus: "Idle" | "Running" | "Success" | "Failed";
  gatewayAddress: string;
  customApiKey?: string | null;
  aiSelection?: "gemini" | "simulation";
}

export interface ScrapedArticle {
  id: string;
  source: "CERT.TG" | "ANCY.GOUV.TG" | "CDA.TG";
  sourceUrl: string;
  title: string;
  date: string;
  snippet: string;
  fullText: string;
  processed: boolean;
  analysis?: {
    isThreatNews: boolean;
    detectedMaliciousIndicators: Array<{
      type: "domain" | "ip" | "email" | "phone" | "text_pattern";
      valeur: string;
      severity: "Low" | "Medium" | "Critical";
      description: string;
    }>;
    category: string;
    togoRelevance: string;
  };
}

export interface ForensicsData {
  topPhones: Array<{ value: string; count: number }>;
  topLinks: Array<{ value: string; count: number }>;
  locations: Array<{ city: string; count: number }>;
  peakHours: Array<{ hour: string; count: number; rating: string }>;
  totalThreats: number;
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
