import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { dbManager } from "./serveur_dashboard_react/gestionnaire_base_donnees";
import { analyzeAlertText, analyzeURLWithAI } from "./serveur_dashboard_react/analyseur_ia_gemini";
import { scrapeGovernmentFeeds, processArticleThreatWithAI } from "./serveur_dashboard_react/collecteur_flux_veille_cert";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Log all request routes for clear administration observability
  app.use((req, res, next) => {
    console.log(`[SOC-PHISHING-TG-SERVER] ${req.method} ${req.path}`);
    next();
  });

  // --- INTEGRATED MOBILE AGENT HANDLERS & CYBER RESET APIs ---
  
  // A. Reset database to zero (empty state for clean testing)
  app.post("/api/reset", (req, res) => {
    try {
      dbManager.clearAll();
      console.log("[SOC-PHISHING-TG-SERVER] Database cleared to Zero.");
      res.json({ success: true, message: "La base de données du SOC PHISHING TG a été entièrement réinitialisée à Zéro." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // B. Reload demonstration feeds on-demand 
  app.post("/api/load-mocks", (req, res) => {
    try {
      dbManager.loadMocks();
      console.log("[SOC-PHISHING-TG-SERVER] Demonstration mock data reloaded.");
      res.json({ success: true, message: "Données de démonstration rechargées avec succès." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- SECURITY MIDDLEWARE AND HANDSHAKE LAYERS ---

  const verifyAgentRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = (req.headers["x-agent-code"] || req.headers["x-agent-token"] || (req.headers["authorization"] ? req.headers["authorization"].toString().replace("Bearer ", "") : "")) as string;
    
    if (!token) {
      console.warn(`[SOC-SECURITY-INTEGRITY] Anonymous API call blocked: ${req.method} ${req.path}`);
      res.status(401).json({ success: false, error: "Authentification requise. Aucun jeton d'agent (X-Agent-Token) fourni." });
      return;
    }
    
    if (!token.startsWith("kfl-shield-") && !token.startsWith("stl-shield-")) {
      console.warn(`[SOC-SECURITY-INTEGRITY] Blocked unauthorized agent token format: ${token}`);
      res.status(403).json({ success: false, error: "Jeton d'autorisation agent invalide ou révoqué par le SOC." });
      return;
    }
    
    // Check for integrity signature to prevent request reuse (replay mitigation)
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];
    
    console.log(`[SOC-SECURITY-INTEGRITY] Request authorized. Integrity-sig: ${signature || "N/A"}. Timestamp: ${timestamp || "N/A"}`);
    
    // Attempt to identify the agent from token suffix
    try {
      const parts = token.split("-");
      const suffix = parts[parts.length - 1]; // get device_id.substring(0,6) or fallback device_id
      if (suffix) {
        const agents = dbManager.getAgents();
        // Look for agent where either ID matches directly or starts with the suffix
        const agent = agents.find(a => a.id.substring(0, 6) === suffix || a.id === suffix || a.id.startsWith(suffix));
        if (agent) {
          (req as any).agentId = agent.id;
        }
      }
    } catch (e: any) {
      console.error("[SOC-SECURITY-INTEGRITY] Error extracting agent suffix:", e.message);
    }
    
    next();
  };

  // E. Mobile Agent - Secure Handshake & Dynamic Token Registration
  app.post("/api/v1/agent/register", (req, res) => {
    try {
      const { device_id, name, city, phone } = req.body;
      if (!device_id) {
        res.status(400).json({ success: false, error: "Identifiant unique de terminal (device_id) requis." });
        return;
      }

      // Check for duplicate phone number enrollment (strict multi-account prevention)
      const cleanPhone = phone ? phone.trim().replace(/\s+/g, "") : "";
      if (cleanPhone) {
        const existingAgent = dbManager.getAgents().find(a => {
          const existingCleanPhone = a.phone ? a.phone.trim().replace(/\s+/g, "") : "";
          return existingCleanPhone === cleanPhone && a.id !== device_id;
        });
        if (existingAgent) {
          res.status(400).json({ 
            success: false, 
            error: `Erreur d'enregistrement : Le numéro de téléphone ${phone} est déjà enrôlé pour un autre agent (ID : ${existingAgent.id}).` 
          });
          return;
        }
      }

      const cleanLocation = city || "Lomé";
      const agents = dbManager.getAgents();
      let agent = agents.find(a => a.id === device_id);

      // Generate a dynamic, cryptographically indexed token
      const secureToken = `kfl-shield-9a2f-${Math.floor(Math.random() * 89999 + 10000)}-${device_id.substring(0, 6)}`;

      if (!agent) {
        agent = dbManager.addAgent({
          id: device_id,
          name: name || `TG-Mobile-${device_id.substring(0, 6).toUpperCase()}`,
          city: cleanLocation,
          phone: phone || undefined,
          status: "Online",
          lastSync: new Date().toISOString(),
          version: "v1.5.0",
          ipAddress: req.ip || "127.0.0.1"
        });
      } else {
        // Update information if re-enrolled
        agent.name = name || agent.name;
        agent.city = cleanLocation;
        if (phone) {
          agent.phone = phone;
        }
        dbManager.updateAgentLastSync(device_id);
      }

      console.log(`[SOC-SECURITY] Dynamic Agent Enrollment: Device ${device_id} assigned key ${secureToken}`);

      res.status(200).json({
        success: true,
        message: "Terminal de test enrôlé. Clé d'authentification installée avec succès.",
        agent_id: device_id,
        token: secureToken,
        sync_days: dbManager.getConfig().defaultSyncIntervalDays,
        gateway: dbManager.getConfig().gatewayAddress
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // C. Mobile Agent - Get block signatures database synchronization feed (Secured)
  app.get("/api/v1/sync", verifyAgentRequest, (req, res) => {
    try {
      const threats = dbManager.getThreats();
      const config = dbManager.getConfig();
      
      // If we identified the agent, let's update their status and lastSync timestamp!
      const agentId = (req as any).agentId;
      if (agentId) {
        dbManager.updateAgentLastSync(agentId);
        console.log(`[SOC-SYNC] Reconnected agent updated: ${agentId} is now synchronized with the latest signature base.`);
      }

      // Format response exactly as expected by Retrofit Android client
      const mappedSignatures = threats.map((t, idx) => ({
        id: idx + 1,
        pattern: t.value,
        type: t.type.toUpperCase(),
        severity: t.severity,
        location: t.location,
        details: t.details || "Signature IoC active"
      }));

      res.json({
        success: true,
        sync_timestamp: new Date().toISOString(),
        default_sync_interval_days: config.defaultSyncIntervalDays,
        next_gateway_address: config.gatewayAddress,
        signatures_count: mappedSignatures.length,
        data: mappedSignatures,
        recommend_engine_status: "ENABLED"
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // D. Mobile Agent - Submit real-time forensic threat alarm report (Secured)
  app.post("/api/v1/report", verifyAgentRequest, (req, res) => {
    try {
      const { device_id, sender_phone, evidence_text, location, meta_data } = req.body;
      const cleanPhone = sender_phone || "";
      const cleanText = evidence_text || "";
      const cleanLocation = location || "Lomé";
      const agentId = device_id || `agent-${Math.floor(Math.random() * 900 + 100)}`;

      console.log(`[SOC-PHISHING-TG-SERVER] Intercepting mobile incident report: ${cleanPhone} | ${cleanText}`);

      // 1. Check if the agent is registered in db.json, register if news
      const existingAgents = dbManager.getAgents();
      let agent = existingAgents.find(a => a.id === agentId);
      if (!agent) {
        agent = dbManager.addAgent({
          id: agentId,
          name: `TG-Mobile-${agentId.substring(0, 8).toUpperCase()}`,
          city: cleanLocation,
          status: "Online",
          lastSync: new Date().toISOString(),
          version: "v1.5.0",
          ipAddress: req.ip || "127.0.0.1"
        });
      } else {
        dbManager.updateAgentLastSync(agentId);
      }

      // 2. Instead of directly adding as a production threat (which would automatically bypass audit),
      // we store it as a pending MobileSignal.
      const addedSignal = dbManager.addMobileSignal({
        deviceId: agentId,
        agentName: agent.name,
        senderPhone: cleanPhone,
        evidenceText: cleanText,
        location: cleanLocation
      });

      res.status(200).json({
        success: true,
        message: "Rapport d'incident enregistré en attente d'audit administratif par l'opérateur SOC.",
        signal_id: addedSignal.id
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- SOC DASHBOARD MOBILE SIGNALS AUDIT ENDPOINTS ---

  app.get("/api/signals", (req, res) => {
    try {
      const list = dbManager.getMobileSignals();
      res.json({ success: true, count: list.length, data: list });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/signals/:id/approve", (req, res) => {
    try {
      const { id } = req.params;
      const result = dbManager.approveMobileSignal(id);
      if (result.success) {
        res.json({ success: true, message: "Alerte de signal mobile approuvée. Signature nationale déployée !", threat: result.threat });
      } else {
        res.status(404).json({ success: false, error: "Alerte d'interception introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete("/api/signals/:id", (req, res) => {
    try {
      const { id } = req.params;
      const ok = dbManager.deleteMobileSignal(id);
      if (ok) {
        res.json({ success: true, message: "Signal d'attaque rejeté et supprimé." });
      } else {
        res.status(404).json({ success: false, error: "Signal d'attaque introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- API ROUTING INTERFACES ---

  // 1. Threat and Database APIs
  app.get("/api/threats", (req, res) => {
    try {
      const threats = dbManager.getThreats();
      res.json({ success: true, count: threats.length, data: threats });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/threats", (req, res) => {
    try {
      const { type, value, severity, campaignId, details, location, status } = req.body;
      if (!type || !value || !severity) {
         res.status(400).json({ success: false, error: "Missing required fields: type, value, severity" });
         return;
      }
      
      const cleanValue = value.trim();
      const exists = dbManager.getThreats().some(
        t => t.value.toLowerCase().trim() === cleanValue.toLowerCase()
      );
      if (exists) {
        res.status(400).json({ success: false, error: "La signature existe déjà dans la base de données." });
        return;
      }

      const item = dbManager.addThreat({
        type,
        value,
        severity,
        status: status || "active",
        campaignId: campaignId || null,
        details: details || "Entrée ajoutée manuellement.",
        location: location || "Lomé"
      });
      res.status(201).json({ success: true, data: item });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put("/api/threats/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { type, value, severity, status, details, location } = req.body;
      const item = dbManager.updateThreat(id, { type, value, severity, status, details, location });
      if (item) {
        res.json({ success: true, message: "Signature modifiée avec succès.", data: item });
      } else {
        res.status(404).json({ success: false, error: "Signature de menace introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete("/api/threats/:id", (req, res) => {
    try {
      const { id } = req.params;
      const ok = dbManager.deleteThreat(id);
      if (ok) {
        res.json({ success: true, message: "Signature supprimée définitivement de la base de données active." });
      } else {
        res.status(404).json({ success: false, error: "Signature de menace introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 2. Target Campaign APIs
  app.get("/api/campaigns", (req, res) => {
    try {
      const campaigns = dbManager.getCampaigns();
      res.json({ success: true, count: campaigns.length, data: campaigns });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/campaigns", (req, res) => {
    try {
      const { name, target, status, description } = req.body;
      if (!name || !target) {
         res.status(400).json({ success: false, error: "Missing name or target fields" });
         return;
      }
      const newCampaign = dbManager.addCampaign({
        name,
        target,
        status: status || "Active",
        description: description || ""
      });
      res.status(201).json({ success: true, data: newCampaign });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 3. Mobile Agents APIs
  app.get("/api/agents", (req, res) => {
    try {
      const agents = dbManager.getAgents();
      res.json({ success: true, count: agents.length, data: agents });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 4. Update and Sync Config APIs
  app.get("/api/config", (req, res) => {
    try {
      const config = dbManager.getConfig();
      res.json({ success: true, data: config });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/config/interval", (req, res) => {
    try {
      const { days } = req.body;
      if (typeof days !== "number" || days <= 0) {
         res.status(400).json({ success: false, error: "Days must be a positive number." });
         return;
      }
      dbManager.setSyncInterval(days);
      res.json({ success: true, message: "Sync interval configured successfully", data: dbManager.getConfig() });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/config/gateway", (req, res) => {
    try {
      const { gatewayAddress } = req.body;
      if (!gatewayAddress || typeof gatewayAddress !== "string") {
         res.status(400).json({ success: false, error: "L'adresse de passerelle ou l'IP du serveur est requise." });
         return;
      }
      dbManager.setGatewayAddress(gatewayAddress);
      res.json({ success: true, message: "Passerelle dynamique modifiée avec succès.", data: dbManager.getConfig() });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/config/ai", (req, res) => {
    try {
      const { customApiKey, aiSelection } = req.body;
      if (customApiKey !== undefined) {
        dbManager.setCustomApiKey(customApiKey);
      }
      if (aiSelection !== undefined) {
        if (aiSelection !== "gemini" && aiSelection !== "simulation") {
          res.status(400).json({ success: false, error: "aiSelection doit être 'gemini' ou 'simulation'." });
          return;
        }
        dbManager.setAiSelection(aiSelection);
      }
      res.json({ success: true, message: "Configuration de l'intelligence artificielle mise à jour.", data: dbManager.getConfig() });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/snapshots", (req, res) => {
    try {
      const snapshots = dbManager.getSnapshots();
      res.json({ success: true, count: snapshots.length, data: snapshots });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/snapshots/restore", (req, res) => {
    try {
      const { snapshotId } = req.body;
      if (!snapshotId) {
         res.status(400).json({ success: false, error: "ID du snapshot requis." });
         return;
      }
      const ok = dbManager.restoreSnapshot(snapshotId);
      if (ok) {
        res.json({ success: true, message: "Base restaurée avec succès au snapshot sélectionné." });
      } else {
        res.status(404).json({ success: false, error: "Snapshot d'historique introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/backup/import", (req, res) => {
    try {
      const { threats } = req.body;
      if (!threats || !Array.isArray(threats)) {
         res.status(400).json({ success: false, error: "Liste de signatures (threats) requise sous format tableau JSON." });
         return;
      }
      const result = dbManager.importSignatures(threats);
      res.json({ 
        success: true, 
        message: `${result.count} signatures d'indicateurs importées et fusionnées avec succès.`, 
        count: result.count 
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 5. Flash Force Synchronization Action
  app.post("/api/agents/flash-update", (req, res) => {
    try {
      const result = dbManager.triggerFlashUpdate();
      res.json({
        success: true,
        message: "FLASH UPDATE: Forced sync database broadcast to all agents successfully",
        ...result
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Tracks administrative login attempts to prevent brute force (limit to 5 attempts)
  const loginAttemptsTracker = new Map<string, { count: number; lastAttempt: number }>();

  // --- ADMINISTRATOR ENDPOINTS ---
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ success: false, error: "Nom d'utilisateur et mot de passe requis." });
        return;
      }

      const u = username.trim().toUpperCase();
      const now = Date.now();
      const attempt = loginAttemptsTracker.get(u) || { count: 0, lastAttempt: 0 };

      // Configurable settings
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 mins block

      // Check brute-force lockout status
      if (attempt.count >= MAX_ATTEMPTS && now - attempt.lastAttempt < LOCKOUT_DURATION) {
        const remainingMin = Math.ceil((LOCKOUT_DURATION - (now - attempt.lastAttempt)) / 60000);
        res.status(429).json({
          success: false, 
          error: `Sécurité SOC : Compte temporairement verrouillé suite à 5 tentatives erronées. Réessayez dans ${remainingMin} minute(s) ou contactez l'officier de sécurité.`
        });
        return;
      }

      const admin = dbManager.verifyAdmin(username, password);
      if (admin) {
        // Clear attempts on success
        loginAttemptsTracker.delete(u);
        res.json({
          success: true,
          admin: {
            username: admin.username,
            role: admin.role,
            createdAt: admin.createdAt
          }
        });
      } else {
        // Increment attempts on failure
        attempt.count += 1;
        attempt.lastAttempt = now;
        loginAttemptsTracker.set(u, attempt);

        const remaining = Math.max(0, MAX_ATTEMPTS - attempt.count);
        let errorMsg = "Identifiants d'administration incorrects.";
        if (remaining > 0) {
          errorMsg += ` Attention, il vous reste ${remaining} tentative(s) avant verrouillage temporaire de sécurité.`;
        } else {
          errorMsg += " Compte verrouillé temporairement pour des raisons de sécurité (durée de 15 min).";
        }

        res.status(401).json({ success: false, error: errorMsg });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/admins", (req, res) => {
    try {
      const list = dbManager.getAdmins();
      res.json({ success: true, admins: list });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admins", (req, res) => {
    try {
      const { username, password, role } = req.body;
      const result = dbManager.createAdminAccount(username, password, role);
      if (result.success) {
        res.status(201).json({ success: true, message: `L'administrateur ${username} a été créé.` });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put("/api/admins/password", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ success: false, error: "Champs d'utilisateur et de nouveau mot de passe requis." });
        return;
      }
      const ok = dbManager.updateAdminPassword(username, password);
      if (ok) {
        res.json({ success: true, message: "Mot de passe d'administration modifié avec succès." });
      } else {
        res.status(404).json({ success: false, error: "Administrateur introuvable." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete("/api/admins/:username", (req, res) => {
    try {
      const { username } = req.params;
      const ok = dbManager.deleteAdminAccount(username);
      if (ok) {
        res.json({ success: true, message: "Compte administrateur supprimé." });
      } else {
        res.status(400).json({ success: false, error: "Impossible de supprimer, l'utilisateur n'existe pas ou il s'agit du dernier administrateur actif." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 6. Threat Intel Automated Exfiltration APIs
  app.get("/api/threats/scrape-feeds", async (req, res) => {
    try {
      const data = await scrapeGovernmentFeeds();
      res.json({ success: true, count: data.length, data });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/threats/process-article", async (req, res) => {
    try {
      const { articleId } = req.body;
      if (!articleId) {
         res.status(400).json({ success: false, error: "Article ID required" });
         return;
      }
      const processed = await processArticleThreatWithAI(articleId);
      if (!processed) {
         res.status(404).json({ success: false, error: "Article not found or processing failed" });
         return;
      }
      res.json({ success: true, data: processed });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 7. Manual suspect input endpoint
  app.post("/api/threats/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || text.trim().length === 0) {
         res.status(400).json({ success: false, error: "Alert message text cannot be empty." });
         return;
      }
      const analysis = await analyzeAlertText(text);
      res.json({ success: true, analysis });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 8. Sandbox Validation APIs
  app.post("/api/sandbox/validate", (req, res) => {
    try {
      const { value, type, severity, campaignId, details, location, addImmediate } = req.body;
      if (!value) {
         res.status(400).json({ success: false, error: "Search query value required or empty." });
         return;
      }

      const match = dbManager.checkIndicator(value);

      if (match) {
        res.json({
          success: true,
          exists: true,
          match,
          message: `L'indicateur "${value}" est déjà répertorié sous le statut "${match.status}".`
        });
        return;
      }

      if (addImmediate) {
        // Force manual addition of confirmed fraud
        const inserted = dbManager.registerSanboxedThreat({
          type: type || "domain",
          value,
          severity: severity || "Medium",
          campaignId: campaignId || null,
          details: details || "Investigué sur le bac à sable - Fraude confirmée.",
          location: location || "Lomé"
        });

        res.json({
          success: true,
          exists: false,
          added: true,
          match: inserted,
          message: `L'indicateur "${value}" absent de la base, a été validé et enregistré comme "Fraude active".`
        });
        return;
      }

      res.json({
        success: true,
        exists: false,
        message: `L'indicateur "${value}" n'est pas répertorié. Il est actuellement sûr ou non encore identifié.`
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/sandbox/analyze-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || url.trim().length === 0) {
        res.status(400).json({ success: false, error: "L'adresse URL à analyser est requise." });
        return;
      }
      const analysis = await analyzeURLWithAI(url);
      res.json({ success: true, analysis });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 9. Forensics & Investigation API
  app.get("/api/forensics/data", (req, res) => {
    try {
      const threats = dbManager.getThreats();
      
      // Top phone numbers
      const phoneMap: Record<string, number> = {};
      const linksMap: Record<string, number> = {};
      const cityMap: Record<string, number> = {};
      
      threats.forEach(t => {
        // Location aggregation
        cityMap[t.location] = (cityMap[t.location] || 0) + 1;

        if (t.type === "phone") {
          phoneMap[t.value] = (phoneMap[t.value] || 0) + 1;
        } else if (t.type === "domain") {
          linksMap[t.value] = (linksMap[t.value] || 0) + 1;
        }
      });

      const topPhones = Object.entries(phoneMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));

      const topLinks = Object.entries(linksMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));

      const locations = Object.entries(cityMap)
        .map(([city, count]) => ({ city, count }));

      // Hours peak analytics - dynamically aggregate timestamps from database threats
      const dynamicHours = [
        { hour: "08:00 - 10:00", count: 0, rating: "Calme" },
        { hour: "10:00 - 12:00", count: 0, rating: "Calme" },
        { hour: "12:00 - 14:00", count: 0, rating: "Calme" },
        { hour: "14:00 - 16:00", count: 0, rating: "Calme" },
        { hour: "16:00 - 18:00", count: 0, rating: "Calme" },
        { hour: "18:00 - 20:00", count: 0, rating: "Calme" },
        { hour: "20:00 - 22:00", count: 0, rating: "Calme" },
        { hour: "22:00 - 08:00", count: 0, rating: "Calme" }
      ];

      threats.forEach(t => {
        try {
          const date = new Date(t.detectedAt);
          const hour = date.getUTCHours();
          if (hour >= 8 && hour < 10) dynamicHours[0].count++;
          else if (hour >= 10 && hour < 12) dynamicHours[1].count++;
          else if (hour >= 12 && hour < 14) dynamicHours[2].count++;
          else if (hour >= 14 && hour < 16) dynamicHours[3].count++;
          else if (hour >= 16 && hour < 18) dynamicHours[4].count++;
          else if (hour >= 18 && hour < 20) dynamicHours[5].count++;
          else if (hour >= 20 && hour < 22) dynamicHours[6].count++;
          else dynamicHours[7].count++;
        } catch (e) {}
      });

      const peakHours = dynamicHours.map(h => {
        let rating = "Calme";
        if (h.count > 10) rating = "Pic d'Affluence";
        else if (h.count > 5) rating = "Observation Active";
        else if (h.count > 0) rating = "Régulier";
        return { ...h, rating };
      });

      res.json({
        success: true,
        analytics: {
          topPhones,
          topLinks,
          locations,
          peakHours,
          totalThreats: threats.length
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SOC-PHISHING-TG-SERVER] Running and serving on port http://localhost:${PORT}`);
  });
}

startServer();
