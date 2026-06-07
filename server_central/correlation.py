from typing import List, Dict, Any
from collections import defaultdict

def run_forensic_correlation(reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Algorithme de Corrélation Judiciaire.
    Analyse l'ensemble des rapports d'attaques anonymisés envoyés par les agents mobiles
    et regroupe automatiquement les vecteurs identiques (ex: même numéro d'arnaqueur,
    même URL de phishing, ou même ciblage géographique à Lomé).
    
    Aide les parquets du Togo à ouvrir des enquêtes groupées sur des réseaux d'attaques organisés.
    """
    correlated_incidents = defaultdict(list)
    
    for report in reports:
        phone = report.get("sender_phone")
        evidence = report.get("evidence_text", "")
        
        # 1. Corrélation par Numéro de Téléphone d'arnaqueur (Clef prioritaire)
        if phone:
            correlated_incidents[f"PHONE:{phone}"].append(report)
            
        # 2. Corrélation par lien/URL similaire extrait du texte
        import re
        urls = re.findall(r"(?:https?://)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", evidence)
        for url in urls:
            if "cert.tg" not in url and "ancy" not in url:
                correlated_incidents[f"URL:{url}"].append(report)
                
    # Mise en forme structurée du résultat
    campaigns = []
    for key, grouped_reports in correlated_incidents.items():
        if len(grouped_reports) > 1:  # On ne retient que s'il y a plus d'une correspondance
            vector_type, value = key.split(":", 1)
            locations_set = {r.get("location", "Lomé") for r in grouped_reports}
            
            campaigns.append({
                "campaign_identifier": value,
                "vector_type": vector_type,
                "reports_count": len(grouped_reports),
                "affected_cities": list(locations_set),
                "dates_captured": [r.get("reported_at") for r in grouped_reports],
                "confidence_score": "Critical" if len(grouped_reports) > 5 else "Medium",
                "summary": f"Campagne frauduleuse active détectée via {vector_type} ({value}) touchant les régions: {', '.join(locations_set)}"
            })
            
    # Tri par récurrence (le plus de rapports d'attaques en premier)
    campaigns.sort(key=lambda x: x["reports_count"], reverse=True)
    return campaigns
