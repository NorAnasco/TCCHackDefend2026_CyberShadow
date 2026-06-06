# SP SENTINEL : PROJET MAJEUR DE CYBERSÉCURITÉ NATIONAL (TOGO)
> **Guide de Présentation pour le Hackathon et l'Équipe**  
> *Rédigé à l'intention de l'équipe SP Sentinel.*

Ce document présente de bout en bout l'architecture, l'analyse stratégique, le fonctionnement technique poussé et la feuille de route du projet **SP Sentinel** (nom de code de la cellule de cyberdéfense nationale). Conçu de façon modulaire et professionnelle par notre équipe, ce guide permet de maîtriser l'ensemble de la solution.

---

## 1. VISION STRATÉGIQUE ET POSITIONNEMENT CYBER (LE PITCH)

### La Problématique identifiée au Togo
Au Togo, l'ingénierie sociale (SMS frauduleux, usurpations d'identité, faux gains Moov Flooz ou Togocom Tmoney, fausses alertes d'administrations publiques via WhatsApp) fait des ravages quotidiens. Contrairement aux pays occidentaux disposant de parcs applicatifs denses, le Togo nécessite des **solutions de défense locales, grand public et actives en temps réel**, sans friction technologique.

### Nos Deux Cibles Principales

1. **La Population Générale (Grand Public)** :
   * **Le Constat** : Aucune protection n'existe au niveau individuel sur les smartphones. Les menaces arrivent principalement par WhatsApp et SMS.
   * **Notre Solution** : Un pare-feu mobile sous forme d'**Agent Android (Java)** léger, capable de bloquer et d'alerter l'utilisateur instantanément, même s'il n'a pas accès à internet (moteur offline).

2. **Les PME Régionales (Secteurs Financier, Comptabilité, Microfinance)** :
   * **Le Constat** : Les PME sont confrontées à du phishing ciblé. Leurs données sont confidentielles et ne doivent **sous aucun prétexte quitter le réseau local de l'entreprise**.
   * **Notre Solution (Déploiement Hybride)** : Un serveur de sécurité central installé **en local (LAN)** sur le réseau de la PME, qui filtre les flux locaux, tandis qu'une base de signatures de réputation globale (Threat Feed) est synchronisée avec le SOC central SP Sentinel Cloud.

---

## 2. CARTOGRAPHIE COMPLÈTE DU RÉPERTOIRE ACTUEL

Voici comment est organisé notre code aujourd'hui. Chaque élément a été structuré de manière modulaire à la racine du projet :

| Dossier/Fichier | Rôle Global | Technologies Utilisées | Apport de l'élément dans le projet |
| :--- | :--- | :--- | :--- |
| **`/agent_mobile_android/`** | **L'Agent Client Mobile** | Java (Android Natif) | S'installe sur le téléphone du citoyen togolais. Intercepte les notifications de messages suspects en tâche de fond et bloque les menaces localement. |
| `├── app/src/main/` | Code Android, Assets, Vues | Java / XML Android | Contient l'intelligence locale du client. |
| `├── .../shield/MainActivity.java` | Écran de gestion utilisateur | Java (Android UI) | Affiche le statut d'activité, le compteur de menaces bloquées et permet de configurer l'adresse IP du serveur de synchronisation. |
| `├── .../shield/service/` | Service d'interception SMS/WhatsApp | Java Class | Service d'arrière-plan analysant toutes les notifications de messages entrants en temps réel. |
| `├── .../shield/engine/` | Moteur d'Analyse Heuristique | Java Class | Implémente l'analyse heuristique sémantique des leviers d'ingénierie sociale (Usurpation, Gains, Urgence). |
| `├── .../shield/data/` | Stockage local Android | SQLite via Room Database | Persiste localement les signatures de blocage téléchargées du serveur. Fonctionne sans connexion. |
| **`/serveur_central_python/`** | **Serveur Central d'Analyse** | Python 3 / FastAPI | Point d'ancrage central hautement performant pour la remontée d'alertes des terminaux et le traitement analytique de veille nationale. |
| `├── main.py` | Point d'entrée de l'API | FastAPI (Python) | Expose les routes REST de synchronisation des IoC et de réception des rapports anonymisés. |
| `├── scrapers.py` | Collecteur de données de veille | BeautifulSoup / Requests | Scrape en continu les sites du **CERT.TG** et de l'**ANCY (ancy.gouv.tg)** pour extraire les failles et arnaques de source officielle togolaise. |
| `├── correlation.py` | Moteur Forensique Judiciaire | Algorithmes de tri Python | Regroupe les rapports anonymisés par similarité (même numéro de fraudeur, même URL suspecte) pour générer des indicateurs d'attaque exploitables. |
| **`/serveur_dashboard_react/`** | **Services d'Administration** | Node.js / Express / TypeScript | Gère l'orchestration du dashboard et simule le comportement du SOC central de Lomé. |
| **`/src/`** | **Dashboard d'Administration du SOC** | React / Vite / TypeScript | Interface utilisateur web destinée aux analystes cyber pour piloter virtuellement le parc d'agents mobiles avec géolocalisation. |

---

## 3. L'ARCHITECTURE GLOBALE DE DÉTECTION ET D'ANALYSE

C'est le point clé de notre innovation technologique.

```
                           +----------------------------------------+
                           |       CENTRAL SERVER (Python/FastAPI)   |
                           |   - Scrape sources : CERT.TG & ANCY    |
                           |   - Centralized Threat Intelligence     |
                           +-------------------+--------------------+
                                                ^
                                                | [API REST via Sync (Retrofit)]
                                                | - Téléchargement des signatures de blocage
                                                v
 +----------------------------------------------+----------------------------------+
 |                  MOBILE AGENT (Android - Java) - LOCAL FIREWALL                 |
 |                                                                                 |
 |  +---------------------------+     Match?     +------------------------------+  |
 |  | Intercept Sms & WhatsApp  | -------------> | Local Database (Room SQL)    |  |
 |  +---------------------------+                +--------------+---------------+  |
 |                                                              | Non-Match        |
 |                                                              v                  |
 |                                               +------------------------------+  |
 |                                               | Local Heuristic Psych Engine |  |
 |                                               | (Sovereignty & Offline Mode) |  |
 |                                               +------------------------------+  |
 |                                               | Match? Alerte l'utilisateur  |  |
 |                                               +------------------------------+  |
 +---------------------------------------------------------------------------------+
```

### Comment l'IA et l'Heuristique Interviennent-elles ?

1. **L'IA Heuristique d'Ingénierie Sociale (Sur l'Agent Mobile - Hors-connexion)** :
   Plutôt que d'envoyer chaque message sur un serveur d'IA distant dans le Cloud (ce qui grillerait le forfait internet des togolais et poserait de graves problèmes de vie privée), **l'Agent mobile intègre une IA heuristique locale et hors connexion** (`PhishingAnalyzer.java`).
   Elle cherche dans les messages la présence de trois leviers psychologiques fondamentaux utilisés par les pirates (basée sur une configuration sémantique adaptée au langage local) :
   * **L'Appât du gain ou de récompense** (Ex : *"Gagnez"*, *"Flooz gratuit"*, *"Tmoney crédit"*).
   * **L'Urgence pressante ou menace** (Ex : *"Immédiatement"*, *"Suspendu sous 24h"*, *"Action requise"*).
   * **L'Usurpation d'Autorité** (Ex : *"Gendarmerie"*, *"Service client Moov"*, *"Direction togotelecom"*, *"Conseiller UTB"*).

2. **L'IA de Classification (Côté Serveur - Centralisé)** :
   Lorsqu'un article ou une alerte est scrapée automatiquement depuis **CERT.TG** par notre script Python (`scrapers.py`), un modèle d'IA générative (comme **Gemini API**) traite la plainte ou l'article pour en **extraire de manière structurée des indicateurs techniques exploitables (IoC)** (numéros de téléphone des escrocs, sites web malveillants clones de tmoney). Ces indicateurs sont convertis en signatures de blocage JSON légères, prêtes à être déployées sur tous les terminaux mobiles lors de la prochaine synchronisation.

---

## 4. PROTOCOLES DE COMMUNICATION ET TÉLÉMÉTRIE

Un point fort du projet est la clarté de sa documentation réseau :

### Canal A : La Synchronisation Périodique (Server -> Mobile)
L'Agent Mobile veut récupérer la liste noire des numéros et des sites suspects tenus à jour par le central de Lomé.
* **Technologie Mobile** : On utilise la libraire **Retrofit** (en Java) couplée à un gestionnaire de tâches d'arrière-plan Android appelé **WorkManager**.
* **Processus** : L'agent envoie une requête `GET http://serveur-central:3000/api/v1/sync`. Le serveur répond en envoyant un flux de données structuré en JSON contenant la base de signatures :
```json
{
  "success": true,
  "sync_timestamp": "2026-05-26T19:00:00Z",
  "signatures_count": 2,
  "data": [
    {
      "id": 1,
      "pattern": "+22899120485",
      "type": "PHONE",
      "severity": "Critical",
      "details": "Numéro suspect signalant de fausses transactions Moov Flooz"
    },
    {
      "id": 2,
      "pattern": "togotelecom-tmoney.com",
      "type": "URL",
      "severity": "Critical",
      "details": "Site clone imitant le portail officiel de connexion."
    }
  ]
}
```
L'agent mobile parse ce JSON et l'injecte dans son SQLite local.

### Canal B : La Télémétrie Judiciaire de Sécurité (Mobile -> Server)
Dès qu'un utilisateur reçoit un SMS suspect et que l'Agent Mobile le détecte et le bloque, le système remonte le méfait de manière totalement **anonymisée** (respect strict de la vie privée).
* **Processus** : L'agent envoie une requête `POST http://serveur-central:3000/api/v1/report` contenant le corps de l'attaque :
```json
{
  "device_id": "SP-TG-SIMUL-PHONE",
  "sender_phone": "+22899120485",
  "evidence_text": "Alerte, recevez 500.000F de compensation Flooz en allant sur togotelecom-tmoney.com !",
  "location": "Lomé",
  "meta_data": {
    "detection_reason": "CRITICAL_SIGNATURE_MATCH",
    "gmt_time": 177991204481
  }
}
```
Le serveur reçoit cette alerte suspecte, la stocke dans son cache de veille, et le module forensique regroupe ces rapports par ressemblance pour identifier les campagnes actives.

---

## 5. RECONCEPTION ARCHITECTURALE PROPOSÉE (PYTHON SERVER + JAVA MOBILE)

Ce couplage est optimal pour nos compétences et l'efficacité industrielle recherchée :
1. **Zéro friction de compétences** : Maîtrise éprouvée du Python pour le traitement de données/sécurité, et du Java pour le bas-niveau Android.
2. **Puissance analytique de Python** : Idéal pour l'extraction de signatures (BeautifulSoup) et l'IA centralisée.
3. **Robustesse système de Java** : L'interception Android par le service `NotificationListenerService` et la persistance locale cryptée SQLite/Room s'effectuent sans aucune latence mémoire sur le téléphone.

Félicitations à l'équipe pour la mise en place de cette architecture cyber de haut niveau !
