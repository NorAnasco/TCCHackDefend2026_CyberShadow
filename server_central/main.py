from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# Importations relatives
from models import Base, Campaign, ThreatSignature, AttackReport, SyncConfigSetting
from scrapers import scrape_cert_tg, scrape_ancy_tg, extract_signatures_from_text
from correlation import run_forensic_correlation

app = FastAPI(
    title="KEFYL SOC - Serveur Central",
    description="Interface de l'API de commandement et de synchronisation des agents mobiles de cybersécurité au Togo.",
    version="1.0.0"
)

# Configuration CORS pour autoriser l'accès depuis le Dashboard centralisé
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- MODÈLES PYDANTIC POUR LA VALIDATION DES FLUX -----------------

class ReportSubmission(BaseModel):
    """
    Rapport d'incident capturé localement par l'Agent mobile Java au Togo.
    Prêt pour transmission via Retrofit (Android).
    """
    device_id: str  # ID unique anonymisé ou haché du smartphone de l'agent
    sender_phone: Optional[str] = None  # Numéro de l'arnaqueur (ex: +228 90 XX XX XX)
    evidence_text: Optional[str] = None  # Texte du message de phishing reçu par l'agent
    location: str = "Lomé"  # Région d'origine (Maritime, Plateaux, Centrale...)
    meta_data: Optional[Dict[str, Any]] = None

class ThreatSignatureCreate(BaseModel):
    pattern: str
    type: str  # "URL", "PHONE", "EMAIL", "IP"
    severity: str = "Medium"
    location: str = "Lomé"
    details: Optional[str] = None

# -- Déclaration de base de données de secours en mémoire (vide par défaut pour tests en direct) --
TEMP_DB_SIGNATURES = []
TEMP_DB_REPORTS = []

# Mocks optionnels pour recharge de démonstration
DEMO_SIGNATURES = [
    {"id": 1, "pattern": "+22899120485", "type": "PHONE", "severity": "Critical", "location": "Lomé", "details": "Usurpation Tmoney signalée au Port Autonome."},
    {"id": 2, "pattern": "togotelecom-tmoney.com", "type": "URL", "severity": "Critical", "location": "Lomé", "details": "Site clone imitant le portail officiel de connexion."},
    {"id": 3, "pattern": "+22890675432", "type": "PHONE", "severity": "Medium", "location": "Kpalimé", "details": "SMS frauduleux de loterie Flooz fictive."},
]

DEMO_REPORTS = [
    {"id": 1, "device_id": "DEV-ANONYMOUS-881", "sender_phone": "+22899120485", "evidence_text": "Gagnez 500.000F via ce lien togotelecom-tmoney.com", "location": "Lomé", "reported_at": "2026-05-23T10:00:00"},
    {"id": 2, "device_id": "DEV-ANONYMOUS-442", "sender_phone": "+22899120485", "evidence_text": "Confirmation de votre gain Flooz. Connectez-vous immédiat.", "location": "Lomé", "reported_at": "2026-05-23T10:45:00"},
]

# ----------------- ENDPOINTS DE L'API CENTRALE -----------------

@app.get("/")
def read_root():
    return {
        "status": "ONLINE",
        "system": "KEFYL SOC Central Gateway",
        "region_scope": "Togo (Lomé, Maritime, Plateaux, Centrale, Kara, Savanes)",
        "endpoints_doc": "/docs"
    }


@app.get("/api/v1/sync")
def sync_agent_database(since: Optional[str] = None, agent_version: Optional[str] = "1.0.0"):
    """
    =================== ENDPOINT MAJEUR DE SYNCHRONISATION (JAVA AGENT TARGET) ===================
    
    Cet endpoint est sollicité périodiquement par la classe SyncWorker d'Android pour récupérer
    les signatures bivalentes les plus récentes compilées d'IoC (pare-feu local de l'agent).
    
    Exemple de configuration Android Retrofit :
    @GET("/api/v1/sync")
    Call<SyncResponse> getSyncData(@Query("since") String sinceDate, @Query("agent_version") String version);
    """
    return {
        "success": True,
        "sync_timestamp": datetime.utcnow().isoformat(),
        "default_sync_interval_days": 14,
        "signatures_count": len(TEMP_DB_SIGNATURES),
        "data": TEMP_DB_SIGNATURES,
        "recommend_engine_status": "ENABLED"
    }


@app.post("/api/v1/report")
def submit_attack_report(report: ReportSubmission):
    """
    =================== ENDPOINT DE SÉCURITÉ JUDICIAIRE CENTRAL (JAVA AGENT TARGET) ===================
    
    Permet à n'importe quel terminal d'agent Kéfyl de remonter en temps réel une attaque constatée.
    Cette donnée sera ensuite alimentée dans l'algorithme forensique pour corrélation.
    
    Exemple de code Java Volley/Retrofit dans l'application mobile de l'agent :
    
    // Retrofit Interface :
    @POST("/api/v1/report")
    Call<ResponseBody> submitReport(@Body ReportSubmission payload);
    """
    new_report = {
        "id": len(TEMP_DB_REPORTS) + 1,
        "device_id": report.device_id,
        "sender_phone": report.sender_phone,
        "evidence_text": report.evidence_text,
        "location": report.location,
        "reported_at": datetime.utcnow().isoformat()
    }
    TEMP_DB_REPORTS.append(new_report)
    return {
        "success": True,
        "message": "Rapport cyber d'incident enregistré avec succès par le central Kéfyl.",
        "report_id": new_report["id"]
    }


@app.post("/api/v1/reset")
def clear_central_database():
    """
    Vide intégralement les listes de signatures et de rapports en mémoire.
    """
    TEMP_DB_SIGNATURES.clear()
    TEMP_DB_REPORTS.clear()
    return {
        "success": True,
        "message": "Base de données centrale FastAPI réinitialisée à Zéro."
    }


@app.post("/api/v1/load-mocks")
def load_central_mocks():
    """
    Recharge les données de démonstration togolaises par défaut.
    """
    TEMP_DB_SIGNATURES.clear()
    TEMP_DB_REPORTS.clear()
    for sig in DEMO_SIGNATURES:
        TEMP_DB_SIGNATURES.append(sig)
    for rep in DEMO_REPORTS:
        TEMP_DB_REPORTS.append(rep)
    return {
        "success": True,
        "signatures_count": len(TEMP_DB_SIGNATURES),
        "reports_count": len(TEMP_DB_REPORTS),
        "message": "Données de démonstration chargées avec succès sur FastAPI."
    }


@app.get("/api/v1/threats", response_model=List[Dict[str, Any]])
def get_threats():
    """
    Liste l'intégralité des indicateurs de signatures actuels.
    """
    return TEMP_DB_SIGNATURES


@app.post("/api/v1/threats")
def create_threat(threat: ThreatSignatureCreate):
    """
    Ajout direct d'une nouvelle signature de menace.
    """
    new_ioc = {
        "id": len(TEMP_DB_SIGNATURES) + 1,
        "pattern": threat.pattern,
        "type": threat.type,
        "severity": threat.severity,
        "location": threat.location,
        "details": threat.details or "Ajouté via le panneau d'administration centralisé."
    }
    # Vérification anti-doublon simple
    if any(item["pattern"] == threat.pattern for item in TEMP_DB_SIGNATURES):
        raise HTTPException(status_code=400, detail="Cette signature existe déjà dans le registre central.")
        
    TEMP_DB_SIGNATURES.append(new_ioc)
    return {"success": True, "data": new_ioc}


@app.get("/api/v1/scrapers/cert")
def run_cert_scraper():
    """
    Exécute le scraper cert.tg pour récupérer les dernières alertes.
    """
    articles = scrape_cert_tg()
    return {"success": True, "source": "CERT.TG", "data": articles}


@app.get("/api/v1/scrapers/ancy")
def run_ancy_scraper():
    """
    Exécute le scraper ancy.gouv.tg pour récupérer les dernières actualités de sûreté.
    """
    articles = scrape_ancy_tg()
    return {"success": True, "source": "ANCY.GOUV.TG", "data": articles}


@app.get("/api/v1/correlate")
def get_forensic_correlations():
    """
    Renvoie le regroupement issu de la corrélation judiciaire (Même numéro, etc.)
    """
    correlations = run_forensic_correlation(TEMP_DB_REPORTS)
    return {
        "success": True,
        "analysed_reports_count": len(TEMP_DB_REPORTS),
        "active_campaigns_grouped": correlations
    }

if __name__ == "__main__":
    import uvicorn
    # Liaison obligatoire sur port 8000 pour tests locaux FastAPI
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
