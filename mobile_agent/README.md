# Kéfyl Mobile Agent - Android Cybersecurity Shield 🛡️📱

> **Unité de Protection Defensive Mobile de l'Écosystème "Kéfyl"**  
> Un pare-feu individuel togolais fonctionnant de manière passive, hors ligne et hautement réactive pour protéger l'ensemble du territoire contre le phishing sémantique et l'ingénierie sociale.

---

## 📖 Sommaire
1. [🎯 Vision & Philosophie d'Ingénierie](#-vision--philosophie-dingénierie)
2. [🤖 Choix Technologiques & Justifications de Bas Niveau](#-choix-technologiques--justifications-de-bas-niveau)
   * [Pourquoi Java Natif pour l'Agent Mobile ?](#pourquoi-java-natif-pour-lagent-mobile-)
   * [Pourquoi FastAPI (Python) pour le Cœur Cyber d'Ingestion ?](#pourquoi-fastapi-python-pour-le-cœur-cyber-dingestion-)
   * [Pourquoi Node.js/TypeScript pour la Passerelle & le Dashboard ?](#pourquoi-nodejs-typescript-pour-la-passerelle--le-dashboard-)
3. [🏗️ Architecture Globale du Pare-feu Mobile](#%EF%B8%8F-architecture-globale-du-pare-feu-mobile)
4. [🌟 Fonctionnalités Majeures de Kéfyl](#-fonctionnalités-majeures-de-kéfyl)
5. [⚙️ Configuration & Adressage Direct](#%EF%B8%8F-configuration--adressage-direct)
6. [🛠️ Guide de Compilation & Sideloading (APK)](#%EF%B8%8F-guide-de-compilation--sideloading-apk)
7. [⚠️ Sécurité Android 13/14+ : Contournement des Restrictions](#%EF%B8%8F-sécurité-android-1314--contournement-des-restrictions)
8. [🧪 Scénarios de Simulation & Cahier de Recette](#-scénarios-de-simulation--cahier-de-recette)
9. [🩺 Diagnostics Avancés & Télémétrie](#-diagnostics-avancés--télémétrie)

---

## 🎯 Vision & Philosophie d'Ingénierie

La détection et l'analyse de cette application reposent entièrement sur la **capture dynamique des notifications système**. En raison du strict respect de la vie privée des utilisateurs, l'application n'extrait aucune donnée de manière directe au sein des applications concernées (SMS, WhatsApp, WhatsApp Business). 

En interceptant uniquement les notifications générées par ces clients de messagerie, l'agent accède à la sémantique textuelle sans violer le chiffrement de bout en bout des applications hôtes. C'est pour cette raison que nous utilisons **Java** : il nous fallait un langage de bas niveau pour avoir une analyse performante à la volée, le contrôle total de l'interception et l'accès aux autorisations système nécessaires sous Android. C'est précisément pourquoi cette première version de l'application mobile a été conçue spécifiquement pour la plateforme Android.

---

## 🤖 Choix Technologiques & Justifications de Bas Niveau

Le déploiement cybersécuritaire de Kéfyl obéit à des contraintes matérielles strictes (terminaux mobiles d'entrée de gamme, mauvaise connectivité, autonomie précieuse, serveurs de supervision réactifs).

### Pourquoi Java Natif pour l'Agent Mobile ?
Le choix du **Java Natif** (sans surcouches multiplateformes de haut niveau type React Native, Flutter ou Cordorva/Capacitor) a été guidé par des impératifs d'ingénierie système système d'exploitation Android :

1. Directement lié aux API système critiques (`NotificationListenerService` et `WindowManager` pour l'overlay). L'intégration de ces services via des ponts de communication hybrides (JS/Dart Bridge) engendre des délais d'attente inacceptables et des fuites mémoire.
2. **Échapper aux restrictions agressives de la batterie (Doze Mode)** : Android détruit automatiquement les processus d'arrière-plan trop gourmands ou instables. Écrit nativement en Java, l'agent Kéfyl s'enregistre auprès du scheduler Android comme un service léger de bas niveau d'accessibilité utilisateur, garantissant une persistance d'écoute h24 sans interruption.
3. **Zéro-Latence Heuristique** : L'analyse sémantique locale par Expressions Régulières et calculs de distances s'exécute en millisecondes directement sur le CPU du smartphone, prévenant la fraude avant même que l'utilisateur n'ait le temps d'ouvrir sa messagerie.
4. **Optimisation Room DB** : L'utilisation native du moteur SQLite encapsulé à travers Room offre une vitesse d'écriture et d'accès instantanée aux indicateurs de compromission (IoC).

### Pourquoi FastAPI (Python) pour le Cœur Cyber d'Ingestion ?
Le back-end de Thread Intelligence (`/serveur_central_python/`) emploie **FastAPI (Python)** pour les raisons suivantes :

1. **Intégration Directe des API d'IA & de Machine Learning** : Python est la lingua franca pour manipuler les LLM (interfaçage fluide avec l'écosystème Google Gemini, les modèles HuggingFace locaux, ou l'extraction NLP complexe).
2. **Performances Asynchrones Ultra-Rapides (Starlette & Pydantic)** : FastAPI surclasse les back-ends Python traditionnels (Django, Flask) grâce au support de l'analyse asynchrone non-bloquante, optimisant les demandes de scraping en parallèle sur les annuaires des fraudes d'ANCY et du CERT.TG.
3. **Sécurisation Clinique par Validation Typée** : La sérialisation automatique via Pydantic garantit que les rapports forensiques de phishing remontés des terminaux mobiles sont sains de toute injection sémantique ou d'attaque par déni de service.

### Pourquoi Node.js/TypeScript pour la Passerelle & le Dashboard ?
La console administrative de supervision du SOC (`/server.ts` et `/serveur_dashboard_react/`) utilise la pile **Node.js, Express et TypeScript** :

1. **Une Seule Pile de Types (`Types.ts`)** : TypeScript unifie l'architecture logique du tableau de bord d'administration (React) et de la passerelle serveur. Une modification de modèle sémantique se répercute instantanément sur l'ensemble de l'écosystème, éliminant tout écart de protocole réseau lors du développement.
2. **Gestion Temps-Réel Asynchrone Élevée** : La réactivité de la télémétrie géographique togolais (mise à jour directe de la carte de Lomé face aux remontées forensiques) demande un système d'E/S ultra-performat d'Express pour gérer des milliers d'agents mobiles simultanément sans goulot d'étranglement.

---

## 🏗️ Architecture Globale du Pare-feu Mobile

La structure de l'agent mobile reflète une séparation nette des responsabilités pour pérenniser l'autonomie réseau et machine :

```
             ┌────────────────────────────────────────────────────────┐
             │         Système d'exploitation Android (OS)            │
             │   (Émission d'une Notification SMS, WhatsApp, etc.)    │
             └───────────────────────────┬────────────────────────────┘
                                         │ Capté instantanément
                                         ▼
             ┌────────────────────────────────────────────────────────┐
             │       KefylNotificationService.java (Service)        │
             │        - Écoute active de bas niveau de l'OS.          │
             │        - Extraction sémantique (Auteur & Contenu)      │
             └───────────────────────────┬────────────────────────────┘
                                         │ Exécution asynchrone locale
                                         ▼
                             ┌───────────────────────┐
                             │   PhishingAnalyzer    │
                             │ (Analyse Heuristique) │
                             └───────────┬───────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼ (Match IoC)                               ▼ (Alerte Visuelle & Log)
       ┌───────────────────────┐                   ┌───────────────────────┐
       │   Room DB (SQLite)    │                   │   Dispositif d'UI     │
       │  (Vérification locale │                   │  - Overlay Alert      │
       │   de la Blacklist)    │                   │  - Boîte de Dialogue  │
       └───────────────────────┘                   └───────────┬───────────┘
                                                               │
                                                               ▼
                                                   ┌───────────────────────┐
                                                   │   Retrofit client     │
                                                   │ (KefylApiService)  │
                                                   └───────────┬───────────┘
                                                               │
                                                               ▼ (Rapport Forensique)
                                                   ┌───────────────────────┐
                                                   │  Kéfyl Gateway  │
                                                   │    (Lomé SOC / API)   │
                                                   └───────────────────────┘
```

---

## 🌟 Fonctionnalités Majeures de Kéfyl

*   **Interception Multicanal Passive** : Écoute les diffusions de notifications WhatsApp, WhatsApp Business, Telegram, Signal, Viber et les applications SMS de base.
*   **NLP Sémantique Localisé** : Détection comportementale autonome analysant l'appât du gain (ex: fausses promesses Moov Flooz/TMoney), l'usurpation d'autorité d'éditeurs comme la Gendarmerie ou l'État togolais, et l'intimidation d'urgence temporelle.
*   **Enrôlement Dynamique Décentralisé** : Prise en charge d'un enrôlement initial de l'agent mobile recueillant uniquement le nom d'opération choisi, le téléphone associé et la ville (Lomé, Kara, etc.) pour mapper la géonomenclature de la cyber-fraude au Togo.
*   **Bypass d'Analyse (Trusted Contacts)** : Si le message suspect provient d'un contact validé dans le répertoire utilisateur, l'agent Kéfyl ne bloque pas abusivement, mais présente une modality d'accompagnement sécurisée (ex : *"Attention, il s'agit d'un proche, mais son compte est peut-être usurpé."*).
*   **Overlay Persistant au Déverrouillage** : Si une alerte critique survient alors que l'écran du périphérique est éteint, les caractéristiques d'attaque sont sauvées au sein du SharedPreferences d'Android. Au déverrouillage de l'appareil (action `USER_PRESENT`), le modal d'interruption s'impose en overlay plein écran pour stopper le geste accidentel de l'utilisateur.

---

## ⚙️ Configuration & Adressage Direct

Pour faciliter les phases de développement, d'exercice académique ou d'évaluation par un jury, l'agent mobile intègre deux boutons de pré-configuration automatique :

*   **🌐 Bouton "PROD LIGNE"** : Redirige instantanément Retrofit vers la console cloud :
    `https://sp-sentinel-hq.onrender.com/`
*   **💻 Bouton "TEST LOCAL"** : Dirige l'agent vers `http://10.0.2.2:3000`. L'adresse loopback IP `10.0.2.2` est une passerelle de routage automatique fournie par l'émulateur Android (AVD) de Google pour s'intégrer directement sur le port local d'administration de votre ordinateur hôte.

Une saisie manuelle libre est également disponible pour configurer l'adresse IP d'un serveur tiers (ex. : Wi-Fi partagé).

---

## 🛠️ Guide de Compilation & Sideloading (APK)

### Configuration Préparatoire
1.  Téléchargez et installez **Android Studio (Version Jellyfish, Koala ou supérieure)**.
2.  Assurez-vous qu'un environnement **Java Development Kit (JDK) version 17** est déclaré propre à votre terminal.
3.  Activez le **débogage USB** sur votre smartphone personnel si vous testez sur périphérique physique.

### Compilation par Invite de Commande (Recommandée)
Ouvrez votre console de vœu et déplacez-vous à l'emplacement exact de l'agent mobile `/mobile_agent` :

```bash
# S'assurer d'avoir les privilèges d'exécution sur Unix
chmod +x gradlew

# Nettoyer d'anciens caches Gradle résiduels
./gradlew clean

# Compiler le projet en mode Debug complet
./gradlew assembleDebug
```

Une fois la compilation validée avec succès par l'exécuteur de builds, l'APK d'installation final de debug est généré dans :  
📦 `mobile_agent/app/build/outputs/apk/debug/app-debug.apk`

---

## ⚠️ Sécurité Android 13/14+ : Contournement des Restrictions

Les versions contemporaines du système d'exploitation Android limitent drastiquement les permissions de capture (Sideloading d'APK de test). **Il est primordial de suivre ce protocole strict sous peine d'avoir une application inefficace.**

### Étape 1 : Activer le menu Développeur sur le Terminal
1. Allez dans les **Paramètres (Settings)** d'Android.
2. Allez de bas en haut vers **À propos du téléphone / About Phone** > **Informations logiciel / Software Information**.
3. Pressez de manière répétée **7 fois** la ligne **Numéro de version / Build Number**.
4. Un bandeau interactif indique : *"Vous êtes désormais développeur"*.

### Étape 2 : Contourner les Paramètres Restreints d'Android 13/14 (Restricted Settings Bypass)
Lorsque l'APK de test Kéfyl est installé en-dehors du circuit Google Play Store, Android verrouille par défaut le bouton d'accessibilité d'écoute des notifications.
1. Procédez à l'installation du fichier `app-debug.apk` compilé.
2. Sur le launcher de votre écran, procédez à un **appui long constant** sur l'icône de l'application **Kéfyl Shield**.
3. Choisissez l'icône circulaire d'information **ⓘ (App Info)**.
4. Dans le coin élevé droit de l'écran d'options d'application qui vient de s'afficher, pressez le menu vertical à trois points `⁝`.
5. Sélectionnez et validez l'action : **"Autoriser les paramètres restreints" (Allow Restricted Settings)**.
6. Entrez le code d'activation PIN de votre smartphone pour valider.

### Étape 3 : Donner la Permission de Lecture des Notifications System
1. Lancez l'application mobile **Kéfyl Shield**.
2. Une bannière colorée indique l'état d'interruption : *"Pare-feu désactivé"*.
3. Cliquez sur le bouton d'activation **ACTIVER LE SERVICE**.
4. L'OS vous redirige vers le volet d'accessibilité de lecture des notifications.
5. Cochez l'interrupteur à côté de l'application déclarée sous le nom de **SP_TG Détecteur de Fraude**.
6. Acceptez le message d'alerte générale Android.

### Étape 4 : Autoriser le Superposition d'Écran (System Overlay Window)
Pour permettre au modal interruptif rouge de se dessiner en premier-plan :
1. De retour au tableau de bord, cliquez sur le module d'activation de superposition ou réglez l'overlay système.
2. Cochez l'autorisation pour l'application cible.

---

## 🧪 Scénarios de Simulation & Cahier de Recette

### Simulation 1 : Tentative de Phishing Bancaire Ultra-Sévère 🔴 (Niveau CRITICAL)
*   **Action** : Envoyez un SMS ou un message WhatsApp vers votre périphérique de test reproduisant l'expression suivante :
    > "ALERTE SÉCURITÉ TOGOCOM : Activité frauduleuse suspecte détectée sur votre compte T-Money. Validez votre identité maintenant sous peine de restriction définitive sous 2 heures sur `http://togo-tmoney.com`."
*   **Comportement attendu** : 
    1.  Interception avant l'écriture en base de messagerie.
    2.  Vibration haptique forte de type "Sirène".
    3.  Lancement de l'overlay rouge critique.
    4.  Affichage du domaine d'arnaque isolé (`togo-tmoney.com`) et de la proposition d'action (Signalement au SOC central).

### Simulation 2 : Arnaque aux Sentiments & Transfert Précipité 🟡 (Niveau VIGILANCE)
*   **Action** : Envoyez le texte d'imposture sémantique suivant :
    > "Salut fiston, c'est papa. Je suis arrêté par la gendarmerie sur la route d'Atakpamé. Envoie-moi d'urgence 35.000 FCFA par Flooz sur ce numéro s'il te plaît pour régler le problème."
*   **Comportement attendu** :
    1.  Déclenchement du moteur sémantique NLP local (concordance du vocabulaire de transfert de fonds urgents + émetteur inconnu).
    2.  Activation de l'interface visuelle orange de Vigilance.
    3.  Mise à disposition pour l'usager d'enregistrer d'un clic ce contact en "Liste Verte" (si l'émetteur s'avère réellement être son parent) ou d'envoyer l'adresse et le numéro pour enrichissement de la base globale du SOC.

---

## 🩺 Diagnostics Avancés & Télémétrie

Pour analyser au télescope le comportement interne des threads Java de l'application Kéfyl en temps-réel, branchez l'appareil de test Android à l'ordinateur de développement en USB, ouvrez la console et observez le canal de débogage Adb :

```bash
# Surveiller uniquement les activités réseau, de synchronisation passive et d'analyse NLP
adb logcat -s KefylSyncWorker:I KefylNotification:D PhishingAnalyzer:I
```

### Mécanisme de Résilience SharedPreferences
Si l'application est désactivée par force de l'état système ou si le SoC physique dort (mise en veille de l'écran), l'état menaçant est sauvegardé sous forme d'empreinte binaire légère et persisté dans `kefyl_prefs.xml` :
*   `has_pending_threat`: booléen d'indication de menace non traitée visuellement.
*   `pending_threat_sender`: chaîne de caractères de l'expéditeur frauduleux.
*   `pending_threat_text`: contenu littéral du phishing.

Dès que l'OS rétablit la focalisation visuelle via le canal de Broadcast d'activation de présence d'utilisateur `Intent.ACTION_USER_PRESENT`, l'activité centrale MainActivity examine et libère l'alerte graphique suspendue sans aucune latence opérationnelle.
