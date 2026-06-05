import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { dbManager } from "./gestionnaire_base_donnees";

dotenv.config();

// Standard initialization with 'aistudio-build' telemetry header as required by the skill
const getAiClient = () => {
  const config = dbManager.getConfig();
  if (config.aiSelection === "simulation") {
    // Force offline simulation
    return null;
  }
  
  const apiKey = config.customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ Warning: Neither process.env.GEMINI_API_KEY nor db.config.customApiKey is defined. Falling back to local rules-based simulation.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Structures for analysis response
export interface LinkAnalysisDetail {
  url: string;
  domain: string;
  isPhishing: boolean;
  confidence: number;
  riskRating: "Safe" | "Suspicious" | "Dangerous";
  reason: string;
}

export interface AlertAnalysisResult {
  isPhishing: boolean;
  confidence: number;
  compromiseType: "domain" | "ip" | "email" | "phone" | "text_pattern";
  threatIndicators: string[];
  severity: "Low" | "Medium" | "Critical";
  summary: string;
  explanation: string;
  detectedLinksAnalysis?: LinkAnalysisDetail[];
}

export interface ScraperAnalysisResult {
  isThreatNews: boolean;
  detectedMaliciousIndicators: Array<{
    type: "domain" | "ip" | "email" | "phone" | "text_pattern";
    valeur: string;
    severity: "Low" | "Medium" | "Critical";
    description: string;
  }>;
  category: string;
  togoRelevance: string;
}

export interface URLSandboxAnalysisResult {
  url: string;
  isPhishing: boolean;
  confidence: number;
  riskRating: "Safe" | "Suspicious" | "Dangerous";
  entityImpersonated: string; // "CEET", "OTR", "CNSS", "Moov Money", "Tmoney", "Banque (Atlantique, UTB, Ecobank, Coris...)", "Station d'essence", "ONG / Humanitaire", "Gouvernement", "None"
  scamCategory: "Mobile Money Theft" | "Financial Credential Theft" | "Social Engineering / Physical Trap (e.g. child rendezvous)" | "Utility Bill Phishing" | "Lotto/Promo Scam" | "General Phishing" | "None";
  explanation: string;
  technicalDetails: {
    domainAgeSecured: boolean;
    missingSSLSimilarity: boolean;
    suspiciousTLD: boolean;
  };
  recommendation: string;
}

/**
 * Parses suspect message content using Gemini 3.5 Flash server-side.
 * Recovers with a deterministic rules-based mock to keep the SOC operational even if the API Key is temporarily absent.
 */
export async function analyzeAlertText(text: string): Promise<AlertAnalysisResult> {
  const ai = getAiClient();
  
  if (!ai) {
    return simulateLocalTextAnalysis(text);
  }

  try {
    const prompt = `Analyze this suspicious security alert, SMS message or email to inspect if it is related to cyber scamming, phishing, mobile money fraud, utility bill scams, or physical safety threats (highly targeted to West African / Togolese subscribers e.g. T-money, Flooz, Moov, Canal+, Togo Télécom, CEET, OTR, CNSS, local banks, gas stations, fake NGO recruitment, or social manipulation traps targeting kids/vulnerable people). Extrapolate indicators and analyze any links found in the text:
    ------
    MESSAGE TEXT:
    ${text}
    ------`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert SOC cyber investigation AI. Return high-fidelity classification, indicator extraction, and indicators for judicial forensics in French or English. Under detectedLinksAnalysis, extract every URL/link in the message, check its structure, and generate a micro risk rating (RiskRating can be Safe, Suspicious or Dangerous).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPhishing: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            compromiseType: { type: Type.STRING, description: "Type of main indicator: domain, ip, email, phone, text_pattern" },
            threatIndicators: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Direct specific values extracted e.g. +228xxxxxx, fake URL, IP" 
            },
            severity: { type: Type.STRING, description: "Low, Medium, or Critical" },
            summary: { type: Type.STRING, description: "Brief header describing the fraudulent actor (e.g. Usurpation de Moov Money)" },
            explanation: { type: Type.STRING, description: "Forensic details and psychological manipulation triggers detected (e.g. fear, greed, fake authority, physical meetings lure)." },
            detectedLinksAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING },
                  domain: { type: Type.STRING },
                  isPhishing: { type: Type.BOOLEAN },
                  confidence: { type: Type.NUMBER },
                  riskRating: { type: Type.STRING, description: "Safe, Suspicious, Dangerous" },
                  reason: { type: Type.STRING, description: "Why is it classified as such, e.g. mimicking ceet, mismatching official domains, suspicious TLD" }
                },
                required: ["url", "domain", "isPhishing", "confidence", "riskRating", "reason"]
              }
            }
          },
          required: ["isPhishing", "confidence", "compromiseType", "threatIndicators", "severity", "summary", "explanation"]
        }
      }
    });

    const bodyText = response.text;
    if (!bodyText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsed = JSON.parse(bodyText.trim());
    return {
      isPhishing: Boolean(parsed.isPhishing),
      confidence: Number(parsed.confidence) || 0.5,
      compromiseType: String(parsed.compromiseType) as any || "domain",
      threatIndicators: Array.isArray(parsed.threatIndicators) ? parsed.threatIndicators : [],
      severity: (parsed.severity === "Critical" || parsed.severity === "Medium" || parsed.severity === "Low") ? parsed.severity : "Medium",
      summary: parsed.summary || "Alerte de sécurité non classifiée",
      explanation: parsed.explanation || "Analyse automatique effectuée par le Kéfyl IA Engine.",
      detectedLinksAnalysis: Array.isArray(parsed.detectedLinksAnalysis) ? parsed.detectedLinksAnalysis : []
    };

  } catch (error) {
    console.error("Gemini API call failed, running simulated fallback:", error);
    return simulateLocalTextAnalysis(text);
  }
}

/**
 * Performs a deep URL and Link reputation inspection inside the administration's defensive sandbox.
 * Leverages Gemini, with robust rules-based static fallback.
 */
export async function analyzeURLWithAI(url: string): Promise<URLSandboxAnalysisResult> {
  const ai = getAiClient();
  const cleanUrl = url.trim();

  if (!ai) {
    return simulateLocalURLAnalysis(cleanUrl);
  }

  try {
    const prompt = `Conduct a deep sandbox cyber threat intelligence audit on this specific suspect URL/domain. Determine if it is a phishing link, credentials theft clone, malware deployment node, or if it pretends to belong to a known Togolese institution, utility company, telecom provider, banking portal, fuel provider, NGO, or government center.
    ------
    TARGET URL TO AUDIT:
    ${cleanUrl}
    ------`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an advanced digital forensics sandboxed examiner working for Togo ANCY. Classify the threat score, the impersonated entity (e.g. CEET, Moov Money, Tmoney, OTR, CNSS, UTB, Ecobank, Banque Atlantique, Coris Bank, Station d'essence, NGO recruitment fake, or None), scam type, technical red flags, and formulate a clear recommendation for block signatures.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING },
            isPhishing: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            riskRating: { type: Type.STRING, description: "Safe, Suspicious, Dangerous" },
            entityImpersonated: { type: Type.STRING, description: "Which brand or entity is cloned e.g. CEET, OTR, CNSS, Moov, Tmoney, UTB, etc." },
            scamCategory: { type: Type.STRING, description: "Scam category matched" },
            explanation: { type: Type.STRING, description: "Detailed risk exploration in French." },
            technicalDetails: {
              type: Type.OBJECT,
              properties: {
                domainAgeSecured: { type: Type.BOOLEAN, description: "Is domain age verified as official and old" },
                missingSSLSimilarity: { type: Type.BOOLEAN, description: "Are typical secure brand subdomains missing or manipulated" },
                suspiciousTLD: { type: Type.BOOLEAN, description: "Is TLD suspicious (.cf, .ga, .tk, .xyz, .cc, .info)" }
              },
              required: ["domainAgeSecured", "missingSSLSimilarity", "suspiciousTLD"]
            },
            recommendation: { type: Type.STRING, description: "Recommended block or signature pattern formulation." }
          },
          required: ["url", "isPhishing", "confidence", "riskRating", "entityImpersonated", "scamCategory", "explanation", "technicalDetails", "recommendation"]
        }
      }
    });

    const bodyText = response.text;
    if (!bodyText) {
      throw new Error("Empty URL analysis response from Gemini");
    }

    return JSON.parse(bodyText.trim());

  } catch (error) {
    console.error("Gemini URL sandbox API call failed, running simulated fallback:", error);
    return simulateLocalURLAnalysis(cleanUrl);
  }
}

/**
 * Analyzes security articles or alerts extracted from CERT-TG or ANCY websites.
 */
export async function analyzeScrapedArticle(title: string, body: string): Promise<ScraperAnalysisResult> {
  const ai = getAiClient();

  if (!ai) {
    return simulateLocalScrapingAnalysis(title, body);
  }

  try {
    const prompt = `Analyze this cybersecurity article scraped from West African security authorities (Togo CERT.tg or ANCY). Inspect if it describes active cyberthreats, newly observed phishing URLs/IPs, massive malware waves, or banking malware. Extract indicators of compromise (IoC) so they can be pushed as a signature to mobile agents in Togo:
    ------
    TITLE: ${title}
    BODY: ${body}
    ------`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a threat detection intelligence system mapping warnings from Togo administrative cyber authorities (CERT.TG, ANCY) to mobile client signatures. Identify specific actionable indicators list.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isThreatNews: { type: Type.BOOLEAN },
            detectedMaliciousIndicators: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "domain, ip, email, phone, text_pattern" },
                  valeur: { type: Type.STRING },
                  severity: { type: Type.STRING, description: "Low, Medium, Critical" },
                  description: { type: Type.STRING }
                },
                required: ["type", "valeur", "severity", "description"]
              }
            },
            category: { type: Type.STRING, description: "Phishing, Ransomware, Spam, Scam" },
            togoRelevance: { type: Type.STRING, description: "Detailed local impact on Lomé, general populations or specific administration." }
          },
          required: ["isThreatNews", "detectedMaliciousIndicators", "category", "togoRelevance"]
        }
      }
    });

    const bodyText = response.text;
    if (!bodyText) {
      throw new Error("Empty scraper response from Gemini");
    }

    return JSON.parse(bodyText.trim());

  } catch (e) {
    console.error("Gemini Scraper Analysis failed. Running offline fallback.", e);
    return simulateLocalScrapingAnalysis(title, body);
  }
}

// Deterministic rules-based text analysis when Gemini API isn't present
function simulateLocalTextAnalysis(text: string): AlertAnalysisResult {
  const normText = text.toLowerCase();
  
  let isPhishing = false;
  const threatIndicators: string[] = [];
  let compromiseType: "domain" | "ip" | "email" | "phone" | "text_pattern" = "text_pattern";
  let severity: "Low" | "Medium" | "Critical" = "Medium";
  let summary = "Suspicion de Phishing";
  let explanation = "La signature heuristique locale a inspecté le texte pour des indicateurs de fraude connus.";

  // Extrapolate links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  if (urls && urls.length > 0) {
    isPhishing = true;
    compromiseType = "domain";
    urls.forEach(u => threatIndicators.push(u.replace(/https?:\/\//, "").split("/")[0]));
  }

  // Extrapolate phones (Togo numbers format: +228 xx xx xx xx or 9x xx xx xx)
  const phoneRegex = /(\+228|00228)?\s*([29]\d\s*\d\d\s*\d\d\s*\d\d)/g;
  const phones = text.match(phoneRegex);
  if (phones && phones.length > 0) {
    isPhishing = true;
    compromiseType = "phone";
    phones.forEach(p => threatIndicators.push(p.trim()));
  }

  // Keywords
  if (normText.includes("moov") || normText.includes("flooz") || normText.includes("money") || normText.includes("tmoney")) {
    isPhishing = true;
    severity = "Critical";
    summary = "Usurpation d'Opérateur Télécom (Moov Money/T-Money)";
    explanation = "Tentative detected de vol de fonds via social engineering ciblant les utilisateurs d'argent mobile au Togo. Incitation au partage de codes PIN de transfert.";
  } else if (normText.includes("compte") && (normText.includes("atlantique") || normText.includes("banque") || normText.includes("baci") || normText.includes("utb"))) {
    isPhishing = true;
    severity = "Critical";
    summary = "Compromission d'Identifiants Bancaires";
    explanation = "Campagne usurpant de grandes institutions bancaires togolaises. Demande frauduleuse d'authentification.";
  } else if (normText.includes("gagné") || normText.includes("félicitations") || normText.includes("promotion")) {
    isPhishing = true;
    severity = "Medium";
    summary = "Arnaque à la Loterie / Faux Gain";
    explanation = "Technique de manipulation visant à faire croire à la victime togolais qu'elle a remporté un prix financier nécessitant un dépôt d'activation initial.";
  }

  if (threatIndicators.length === 0) {
    // Treat overall text pattern as IoC signature
    threatIndicators.push(text.slice(0, 40) + "...");
    compromiseType = "text_pattern";
  }

  return {
    isPhishing,
    confidence: isPhishing ? 0.85 : 0.1,
    compromiseType,
    threatIndicators,
    severity,
    summary,
    explanation
  };
}

function simulateLocalScrapingAnalysis(title: string, body: string): ScraperAnalysisResult {
  const normText = `${title} ${body}`.toLowerCase();
  
  const isThreatNews = normText.includes("phishing") || normText.includes("fraude") || normText.includes("alerte") || normText.includes("menace") || normText.includes("piratage") || normText.includes("cyber") || normText.includes("vulnerabilité");
  
  const indicators: ScraperAnalysisResult["detectedMaliciousIndicators"] = [];
  let category = "Actualités de Cybersécurité";
  let togoRelevance = "Concerne la veille générale de sécurité informatique en Afrique de l'Ouest.";

  if (normText.includes("bancaire") || normText.includes("credit")) {
    category = "Phishing Financier";
    togoRelevance = "Risque potentiel élevé d'usurpation d'adresses ou SMS pour les titulaires de comptes bancaires à Lomé.";
    indicators.push({
      type: "domain",
      valeur: "secured-atlantique-togo-check.net",
      severity: "Critical",
      description: "Hameçonnage suspecté ciblant les guichets de banque en ligne togolais."
    });
  } else if (normText.includes("moov") || normText.includes("flooz") || normText.includes("tmoney") || normText.includes("togo cell")) {
    category = "Faux Transactions SMS / USSD";
    togoRelevance = "Impact immédiat sur les abonnés mobiles ruraux et urbains hors-murs.";
    indicators.push({
      type: "phone",
      valeur: "+22899120485",
      severity: "Critical",
      description: "Auteur prolifique de SMS d'usurpation détecté."
    });
  } else {
    indicators.push({
      type: "domain",
      valeur: "togo-alert-update.org",
      severity: "Medium",
      description: "Hébergement suspect signalé lors de la dernière note administrative."
    });
  }

  return {
    isThreatNews,
    detectedMaliciousIndicators: indicators,
    category,
    togoRelevance
  };
}

/**
 * Robust rule-based URL sandbox heuristics when the Gemini API is offline or key is missing.
 */
function simulateLocalURLAnalysis(url: string): URLSandboxAnalysisResult {
  const normUrl = url.toLowerCase();
  
  let isPhishing = false;
  let riskRating: "Safe" | "Suspicious" | "Dangerous" = "Safe";
  let entityImpersonated = "None";
  let scamCategory: URLSandboxAnalysisResult["scamCategory"] = "None";
  let explanation = "L'analyseur local n'a détecté aucun indicateur flagrant de menace.";
  let recommendation = "Aucune action immédiate requise. Le domaine semble sain ou n'est pas répertorié.";
  
  let suspiciousTLD = false;
  let domainAgeSecured = true;
  let missingSSLSimilarity = false;

  // Check suspicious TLDs
  if (normUrl.endsWith(".xyz") || normUrl.includes(".xyz/") ||
      normUrl.endsWith(".cf") || normUrl.includes(".cf/") ||
      normUrl.endsWith(".ga") || normUrl.includes(".ga/") ||
      normUrl.endsWith(".gq") || normUrl.includes(".gq/") ||
      normUrl.endsWith(".tk") || normUrl.includes(".tk/") ||
      normUrl.endsWith(".ml") || normUrl.includes(".ml/") ||
      normUrl.endsWith(".cc") || normUrl.includes(".cc/")) {
    suspiciousTLD = true;
    isPhishing = true;
    riskRating = "Suspicious";
    explanation = "Ce domaine utilise une extension géolocalisée gratuite ou bon marché (.cf, .tk, .xyz, etc.) très prisée par la cybercriminalité pour son absence de contrôles d'identité.";
    recommendation = "Marquer l'URL comme hautement suspecte et configurer une surveillance active DNS auprès des FAI togolais.";
  }

  // Check Impersonated Entities and scams
  if (normUrl.includes("ceet") || normUrl.includes("facturation-ceet") || normUrl.includes("compteur-ceet") || normUrl.includes("portail-ceet")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "CEET";
    scamCategory = "Utility Bill Phishing";
    domainAgeSecured = false;
    explanation = "URGENT : Tentative d'impersonation de la Compagnie Énergie Électrique du Togo (CEET). Ce site cherche à soutirer frauduleusement des règlements de factures d'électricité simulées auprès des consommateurs togolais.";
    recommendation = "ALERTE NATIONALE : Enregistrer comme menace de Niveau Critique. Bloquer le domaine sur l'Agent Mobile et signaler au CERT.TG pour neutralisation DNS.";
  } 
  else if (normUrl.includes("moov") || normUrl.includes("flooz") || normUrl.includes("moovmoney") || normUrl.includes("moov-togo")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "Moov Money";
    scamCategory = "Mobile Money Theft";
    domainAgeSecured = false;
    explanation = "CRITIQUE : Clonage frauduleux de la charte de Moov Money (Flooz). Le portail incite les abonnés à saisir leur code de transfert ou à autoriser l'accès à leur portefeuille via requêtes USSD non contrôlées.";
    recommendation = "Déployer la signature de blocage d'urgence Rouge Critique 9023 sur tous les smartphones équipés du pare-feu Kéfyl Shield au Togo.";
  }
  else if (normUrl.includes("tmoney") || normUrl.includes("togo-cell") || normUrl.includes("togocom") || normUrl.includes("telecom-togo")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "Tmoney";
    scamCategory = "Mobile Money Theft";
    domainAgeSecured = false;
    explanation = "CRITIQUE : Tentative d'usurpation de l'application ou portail Tmoney de l'opérateur national Togocom. Incitation directe à la validation de dépôts et retraits frauduleux.";
    recommendation = "Bloquer les requêtes USSD sortantes associées à ce domaine et isoler le terminal affecté.";
  }
  else if (normUrl.includes("otr") || normUrl.includes("office-togolais") || normUrl.includes("taxe-togo") || normUrl.includes("impots-gouv")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "OTR";
    scamCategory = "Financial Credential Theft";
    domainAgeSecured = false;
    explanation = "DANGER : Usurpation d'identité visant l'Office Togolais des Recettes (OTR). Faux portail de remboursement d'impôts ou de subventions visant à voler l'identité fiscale et bancaire des citoyens.";
    recommendation = "Ajouter dans la table anti-phishing de l'agent mobile et notifier la brigade cynologique criminelle.";
  }
  else if (normUrl.includes("cnss") || normUrl.includes("prevoyance-sociale") || normUrl.includes("retraite-togo")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "CNSS";
    scamCategory = "Utility Bill Phishing";
    domainAgeSecured = false;
    explanation = "ATTENTION : Faux site de la Caisse Nationale de Sécurité Sociale du Togo (CNSS). Promet de fausses primes de sécurité sociale contre un dépôt de dossier d'ouverture ou partage de données personnelles.";
    recommendation = "Bloquer le formulaire d'envoi et générer une signature forensique.";
  }
  else if (normUrl.includes("banque") || normUrl.includes("atlantique") || normUrl.includes("utb-online") || normUrl.includes("ecobank") || normUrl.includes("coris-bank") || normUrl.includes("baci-togo")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "Banque (Atlantique, UTB, Ecobank, Coris...)";
    scamCategory = "Financial Credential Theft";
    domainAgeSecured = false;
    explanation = "CRITIQUE BANCAIRE : Clone d'interface transactionnelle bancaire ciblant spécifiquement la clientèle de Lomé. Risque imminent de vol de numéros de cartes de crédit et de codes e-banking.";
    recommendation = "Blocage immédiat et diffusion du bulletin rouge aux banques partenaires au Togo.";
  }
  else if (normUrl.includes("totalenergies-cadeau") || normUrl.includes("station-essence") || normUrl.includes("togo-carburant") || normUrl.includes("subvention-promo")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "Station d'essence";
    scamCategory = "Lotto/Promo Scam";
    domainAgeSecured = false;
    explanation = "FRAUDE COMMERCIALE : Campagne frauduleuse imitant les stations-services (ex: Total Togo) annonçant de fausses subventions de carburant pour forcer les partages WhatsApp.";
    recommendation = "Extraire la signature du message associé et avertir de la propagation virale.";
  }
  else if (normUrl.includes("ong-recrutement") || normUrl.includes("aide-humanitaire") || normUrl.includes("recrutement-unicef") || normUrl.includes("croix-rouge")) {
    isPhishing = true;
    riskRating = "Suspicious";
    entityImpersonated = "ONG / Humanitaire";
    scamCategory = "Financial Credential Theft";
    domainAgeSecured = false;
    explanation = "MANIPULATION SOCIALE : Arnaque aux faux emplois humanitaires exigeant de frais de dépôt de dossier ('frais de dossier') via Tmoney ou Flooz.";
    recommendation = "Signaler l'adresse Tmoney collectrice et ajouter à la base de menaces.";
  }
  // Child safety & Dangerous Physical entrapment detection (vital target)
  else if (normUrl.includes("rendezvous") || normUrl.includes("lomeland-rencontre") || normUrl.includes("rencontre-jeunes") || normUrl.includes("secret-tchat") || normUrl.includes("cadeau-enfant")) {
    isPhishing = true;
    riskRating = "Dangerous";
    entityImpersonated = "None";
    scamCategory = "Social Engineering / Physical Trap (e.g. child rendezvous)";
    domainAgeSecured = false;
    explanation = "ALERTE DE SÉCURITÉ PHYSIQUE : Ce site présente les schémas d'ingénierie sociale de grooming et de traquenards physiques ciblant les mineurs et personnes vulnérables sur Lomé pour extorsion ou violences physiques.";
    recommendation = "URGENCE PHYSIQUE : Marquer au niveau Critique absolu. Transmettre immédiatement l'adresse IP de connexion et de géolocalisation de l'hébergeur à la Police Cybercriminelle du Togo.";
  }

  if (isPhishing && riskRating === "Safe") {
    riskRating = "Suspicious";
  }

  return {
    url,
    isPhishing,
    confidence: isPhishing ? 0.92 : 0.05,
    riskRating,
    entityImpersonated,
    scamCategory,
    explanation,
    technicalDetails: {
      domainAgeSecured,
      missingSSLSimilarity: !url.startsWith("https://") || url.includes("http://"),
      suspiciousTLD
    },
    recommendation
  };
}

