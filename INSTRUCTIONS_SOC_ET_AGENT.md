# GUIDE D'INSTALLATION ET DE DÉPLOIEMENT : SP_TG SENTINEL
*Système Intégré de Cyber-Sécurité Mobile (SOC National & Agent Intercepteur Heuristique)*

Ce document est le guide technique officiel pour installer, configurer, tester en temps réel et déployer la solution **SP_TG Sentinel & SOC PHISHING TG**. Il contient toutes les commandes pour héberger le tableau de bord localement, connecter vos terminaux physiques et préparer le déploiement en production.

---

## 🏗️ 1. ARCHITECTURE DU PROJET

Chaque élément a été structuré de manière modulaire de façon à être directement exploitable par l'équipe de développement :
* 📂 **`src/` et `/serveur_dashboard_react` :** Interface Web de notre Poste Central de Supervision (SOC) et son serveur Node.js / Express intermédiaire.
* 📂 **`/serveur_central_python` :** Moteur API haute performance développé sous **FastAPI (Python)** servant de relais central pour simuler le SOC à Lomé.
* 📂 **`/agent_mobile_android` :** L'application Android native écrite en **Java**. Elle embarque une base de données persistante **Room SQLite**, un analyseur heuristique sémantique anti-phishing, et un intercepteur de notifications SMS/WhatsApp.

---

## 🖥️ 2. LANCEMENT DU SOC & DASHBOARD (MÉTHODE SIMPLE ET UNIFIÉE)

C'est la méthode de démonstration en direct recommandée. Le serveur Node.js gère à la fois l'interface de contrôle Web et l'API de réception des rapports de télémétrie de l'Agent Mobile.

### Commandes à exécuter :
```bash
# 1. Allez dans le répertoire racine du projet
cd sp-tg-sentinel

# 2. Installez les dépendances du Dashboard Web
npm install

# 3. Lancez le serveur Node.js en mode développement
npm run dev
```

* **Accès au Dashboard :** Ouvrez votre navigateur internet sur [http://localhost:3000](http://localhost:3000)
* **Adresse API pour l'Agent Mobile (Simulateur) :** `http://localhost:3000/`

---

## 🐍 3. LANCEMENT DU SOC CENTRAL (VERSION ALTERNATIVE PYTHON FASTAPI)

Si vous souhaitez simuler le SOC Central spécifiquement via l'API FastAPI Python (port `8000`) :

### Commandes sur Windows (cmd) :
```cmd
cd sp-tg-sentinel\serveur_central_python
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Commandes sur macOS / Linux :
```bash
cd sp-tg-sentinel/serveur_central_python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

* **Accès aux APIs de Lomé :** [http://localhost:8000/docs](http://localhost:8000/docs) (Documentation Swagger interactive).
* **Adresse API pour l'Agent Mobile :** `http://<VOTRE_IP_LOCALE>:8000/`

---

## 📱 4. CONFIGURATION SUR UN TÉLÉPHONE MOBILE PHYSIQUE (TESTS)

Pour que l'agent installé sur votre téléphone communique avec votre serveur local, ils doivent être **sur le même réseau Wi-Fi**.

### Étape 4.1 : Récupérer votre adresse IP de machine locale
* **Sur Windows :** Ouvrez l'invite de commande et tapez :
  ```cmd
  ipconfig
  ```
  *(Repérez votre adresse IPv4 Wi-Fi, ex: `192.168.1.15`).*
* **Sur macOS / Linux :** Ouvrez le terminal et tapez :
  ```bash
  ifconfig | grep "inet "
  ```

### Étape 4.2 : Importer le projet dans Android Studio
1. Ouvrez **Android Studio**.
2. Cliquez sur **File -> New -> Import Project...** et sélectionnez le dossier racine `/agent_mobile_android` (contenant le fichier `build.gradle`).
3. Laissez Android Studio télécharger le SDK et synchroniser le projet Gradle.

### Étape 4.3 : Lancer l'application sur le téléphone de test
1. Activez le **Débogage USB** sur votre smartphone Android (dans les options de développeur).
2. Connectez le smartphone en USB à votre PC.
3. Dans Android Studio, sélectionnez votre téléphone dans la barre d'outils et cliquez sur le bouton vert **Run app** (ou `Shift + F10`).
4. **Configuration IP sur l'application :**
   - Une fois l'application lancée sur votre téléphone, saisissez l'IP de votre machine dans le champ "Configuration réseau du SOC" (ex: `192.168.1.15:3000` si vous utilisez le serveur Express, ou `192.168.1.15:8000` si vous utilisez FastAPI).
   - Cliquez sur **SAUVEGARDER L'IP SERVEUR**.
   - Cliquez sur **FORCER LA SYNCHRONISATION**. La base locale SQLite (Room) va se mettre à jour instantanément !

---

## 🧪 5. PROTOCOLE DE TEST EN DIRECT (VÉRIFIER LE COMPORTEMENT À ZÉRO)

Pour prouver que la détection en direct et les rapports fonctionnent parfaitement de bout en bout :

### Étape 5.1 : Vider les bases de données (Démarrage à Zéro)
1. Ouvrez le dashboard sur votre ordinateur ([http://localhost:3000](http://localhost:3000)).
2. Cliquez sur le bouton de réinitialisation pour démarrer dans un état propre (sans alertes historiques).

### Étape 5.2 : Déclencher les autorisations sur le smartphone
1. Sur l'Agent Mobile, cliquez sur le bouton **"ACCORDER L'ACCÈS AUX NOTIFICATIONS"**.
2. Dans la liste Android qui s'ouvre, activez l'interrupteur pour **"SP_TG Cyber Interceptor"**.
3. Revenez sur l'application : l'en-tête passe au vert **"🟢 PROTECTION ACTIVE"**.

### Étape 5.3 : Simuler une attaque de Niveau Critique (Rouge - Signature)
Nous allons ajouter une signature d'IoC (un numéro d'arnaqueur connu) pour voir l'interception automatique de signature :
1. Sur l'onglet **Threat Intel** du Dashboard Web, ajoutez une adresse ou un numéro de type `PHONE` avec la valeur `+22899120485` (ou tout numéro de votre choix).
2. Sur votre téléphone intelligent, ouvrez l'Agent et cliquez sur **FORCER LA SYNCHRONISATION** pour récupérer cette signature dans la base Room locale.
3. Pour simuler la réception d'un SMS ou message WhatsApp de ce numéro :
   - Envoyez un SMS contenant une accroche suspecte vers votre téléphone de test à partir d'un autre téléphone.
   - **Verdict :** Le téléphone intercepte la notification, affiche une alerte haute priorité, incrémente le compteur d'intrusions locales, et transmet la preuve criminelle au Dashboard du SOC qui se met à jour en direct !

---

## 🚀 6. DÉPLOIEMENT EN PRODUCTION (HÉBERGEMENT CLOUD)

Pour déployer la solution de manière permanente afin que tous les smartphones du Togo puissent s'y connecter :

### Héberger le serveur et le Dashboard sur un service Cloud standard (PaaS)
1. Créez un dépôt Git avec votre code source et publiez-le sur votre hébergeur privé ou GitHub.
2. Liez votre dépôt à un service Cloud et configurez les propriétés d'environnement :
   - **Build Command :** `npm run build`
   - **Start Command :** `npm run start`
   - Déclarez les clés de sécurité nécessaires via les configurations d'environnement cryptées du PaaS (ex: `GEMINI_API_KEY`).
3. Pour l'Agent Mobile Android, configurez l'URL cible de production dans `/agent_mobile_android/app/src/main/java/com/kefyl/shield/api/RetrofitClient.java` puis compilez l'APK final.
