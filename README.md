# SP Sentinel - Plateforme de Protection Contre les Arnaques SMS au Togo

## 📝 Description du Projet
SP Sentinel est un écosystème de cybersécurité souverain conçu pour protéger les citoyens et les PME du Togo contre l'ingénierie sociale et les fraudes financières par messagerie (Moov Flooz, Togocom TMoney, CEET). La solution combine un agent mobile Android natif doté d'un moteur d'analyse heuristique sémantique 100% hors-ligne et une console d'administration centrale (SOC) qui cartographie les attaques à l'échelle nationale et automatise la Threat Intelligence par IA.

---

## 🎯 Problématique choisie & Track Hackathon
* **Track correspondant :** Cybersécurité, Protection des Populations et Souveraineté Numérique.
* **La Problématique :** Au Togo, l’ingénierie sociale par SMS et WhatsApp (usurpations d’identité de la gendarmerie, faux gains Flooz/TMoney, fausses factures CEET d'urgence) cause des préjudices financiers majeurs. Les solutions existantes dépendent du Cloud, ce qui sature les forfaits internet et compromet la vie privée. SP Sentinel résout ce problème grâce à un filtrage hybride local/centralisé, protégeant l'utilisateur de manière proactive, gratuite et sans connexion Internet requise sur le terminal mobile.

---

## 🛠️ Prérequis Système
Pour exécuter l'ensemble de la solution localement, assurez-vous de disposer des éléments suivants :
* **Système d'exploitation :** Windows 10/11, macOS, ou Linux.
* **Environnement Web & Dashboard :** Node.js (version 18.x ou supérieure) et npm.
* **Environnement Serveur API :** Python (version 3.10 ou supérieure) et gestionnaire d'environnement virtuel `venv`.
* **Environnement Mobile Android :** Android Studio (version Ladybug ou ultérieure) avec le SDK Android installé.
* **Terminal de Test :** Un smartphone Android physique (v9.0+) connecté en débogage USB ou un émulateur Android configuré dans Android Studio.

---

## ⚙️ Procédure d'Installation Pas à Pas

### 1. Cloner le projet et préparer l'interface Web (Dashboard)
```bash
# Cloner le dépôt GitHub
git clone https://github.com/NorAnasco/TCCHackDefend2026_CyberShadow
cd TCCHackDefend2026_CyberShadow/

# Installer les dépendances du tableau de bord d'administration
npm install
```

### 2. Configurer le Serveur Central d'Analyse (Python FastAPI)
Sur Windows (cmd) :
```bash
cd serveur_central_python
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
```
Sur macOS/Linux : 
```bash
cd serveur_central_python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Récupérer le fichier d'installation Mobile (.APK)
* Nulle obligation de compiler le code ! Transférez le fichier d'installation binaire app-debug.apk (disponible dans les dossiers de build ou fourni avec les livrables) sur votre téléphone Android de test.
* Ouvrez le fichier sur le téléphone. Si le système indique que l'application provient d'une source inconnue, validez en cliquant sur "Autoriser pour cette source".
* ### ⚠️ IMPORTANT : Résoudre le bouton d'autorisation grisé/gelé (Android 13, 14 & 15)
Sur les versions récentes d'Android, Google bloque par défaut l'accès aux autorisations sensibles (comme l'accès aux notifications indispensable pour intercepter les SMS d'arnaque) pour les applications installées hors du Play Store via APK.

Si le bouton d'activation de l'accès aux notifications est grisé, suivez cette procédure rapide pour le débloquer :

* Ouvrez les Paramètres (Settings) de votre téléphone Android.
* Allez dans Applications (Apps) et sélectionnez l'application SP_TG (ou Shield) dans la liste.
* Sur la page d'informations de l'application (App Info), appuyez sur les trois petits points (menu) situés tout en haut à droite.
* Cliquez sur l'option "Autoriser les paramètres restreints" (Allow restricted settings).
* Confirmez l'opération avec votre code de déverrouillage d'écran (schéma, PIN ou empreinte).
* Revenez en arrière dans l'application ou dans les paramètres d'autorisation de notifications : le bouton n'est plus grisé ! Vous pouvez désormais cocher et accorder l'accès normalement.
---------

## 🚀 Lancement de l'Application
Vous pouvez tester l'application selon deux approches (en ligne ou en local) :

**Option A : Démonstration immédiate via la plateforme Web en ligne (Recommandé)**
Pour un test instantané sans installation lourde, notre plateforme serveur centrale et le dashboard de supervision sont déployés de manière permanente à cette adresse :
🔗 https://sp-sentinel-hq.onrender.com/
----------
**Option B : Lancement des composants en local**

* **Étape 1 : Démarrer le Dashboard d'administration (Port 3000)**
```bash
npm run dev
```
* Accès à la console d'administration : http://localhost:3000
---
* **Étape 2 : Démarrer le Serveur API Python (Port 8000)**
```bash
python main.py
```
* Accès à la documentation Swagger interactive des APIs : http://localhost:8000/docs

---

##  🔐 Identifiants de Test (Compte Démo)
La console d'administration est hautement sécurisée (mots de passe hachés de manière irréversible en SHA-256 et blocage automatique après 5 tentatives infructueuses).

Pour l'évaluation de notre Proof of Concept (PoC) par le jury, utilisez les accès d'administration pré-configurés suivants :

## Comptes de démonstration

| Identifiant Administrateur (Username) | Mot de passe de Démo (Password) | Niveau de Privilèges |
|----------------------------------------|---------------------------------|--|
| ANANIVI | admin12345                      | Administrateur Principal (Full Access) |


--------

## 🧪 Protocole Rapide de Validation (Pour le Jury)

* **1. Test d'interception virtuel (Zéro installation mobile) :** Allez sur l’onglet "DASHBOARD" du site web local ou en ligne. Dans le volet droit de l'écran, utilisez **le Téléphone Virtuel interactif**. Saisissez un faux SMS d'arnaque (ex: "Félicitations Moov, vous avez gagné un bonus de 200.000F, tapez votre code PIN...") et validez. Vous verrez le message immédiatement bloqué et l'alerte remonter sur la carte du Togo.


* **2. Threat Intelligence IA :** Accédez à l'onglet dédié pour voir comment l’IA Gemini extrait automatiquement les signatures d'escroquerie à partir des alertes scrapées en direct sur le site officiel de l'ANCY et du CERT.TG.

---------
## 👥 Membres de l'Équipe
* **ANANIVI Komlanvi** — Etudiant Licence 2 
* **RADJI Kefyl** — Etudiant Licence 2
* **KPETO Kokouvi Joël** — Etudiant Licence 2
* **EHE Soler Godwin** — Etudiant Licence 2
---------

Guide de Présentation pour le Hackathon #TCCHackDefend 2026 rédigé par l'équipe CyberShadow.
