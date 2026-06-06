# SP Sentinel - Plateforme de Protection Contre les Arnaques SMS au Togo

SP Sentinel est un systeme de securite cree pour proteger les habitants du Togo contre les arnaques recues par SMS ou messageries (comme les faux gains Moov Flooz, Togocom TMoney, ou les fausses factures d'electricite CEET). 

Le projet a ete concu par : ANANIVI, RADJI, KPETO et EHEY.

Notre application fonctionne sur les telephones Android, car ce systeme permet de lire et de bloquer les messages dangereuses pour proteger l'utilisateur.

---

## Comment est organise le projet ?

Le projet contient trois dossiers principaux :
1. agent_mobile_android : L'application pour le telephone Android. Elle analyse les messages recus en arriere-plan.
2. serveur_central_python : Le serveur qui peut aller chercher des alertes officielles et faire des analyses complexes.
3. serveur_dashboard_react : Le site internet destine aux administrateurs pour surveiller la situation et ajouter des alertes.

---

## Les 3 fonctionnalités de l'application mobile (sur le telephone)

L'application sur le telephone surveille les messages reçus et a 3 facons de proteger l'utilisateur :

1. L'analyse par base de donnees locale
Le telephone possede un fichier contenant une liste de numeros de fraudeurs et de liens de phishing deja connus. Quand un message arrive, le telephone verifie s'il est lie a cette liste. Si oui, le telephone bloque le message et affiche une alerte rouge tres severe. Tout cela se fait sans besoin d'avoir internet sur le telephone.

2. L'analyse intelligente sans internet (Heuristique comportementale)
Si le message vient d'un inconnu et n'est pas encore dans la base de donnees, l'application analyse les mots pour comprendre le comportement du message. Elle recherche des techniques de manipulation courantes au Togo :
- L'appat du gain (par exemple : Vous avez coche un bonus de 200.000F).
- L'alarme ou l'urgence (par exemple : Votre facture CEET est impayee, coupure dans 12h).
- La fausse identite (par exemple : Se faire passer pour la gendarmerie ou l'operateur Moov/Togocom).
Si l'application detecte un comportement suspect, elle bloque le message avec une alerte moyenne et l'envoie au serveur central pour que les autres utilisateurs soient proteges plus tard. Cette analyse se fait directement sur le telephone sans utiliser internet et sans user la batterie.

3. La liste de confiance pour eviter les fausses alertes (Liste Verte)
Parfois, des membres de la famille ou des groupes de discussion peuvent envoyer des messages qui ressemblent a des arnaques mais qui ne le sont pas.
- L'utilisateur peut mettre un groupe ou un ami en Liste Verte pour desactiver cette analyse psychologique.
- Cependant, pour garantir la securite, si quelqu'un de ce groupe envoie un lien de phishing deja identifie et enregistre comme tres dangereux, le telephone deploiera quand meme le blocage.

---

## Les 4 fonctionnalités de la console d'administration (le serveur)

La console permet aux operateurs du SOC de gerer la securite de tout le monde :

1. La surveillance et le telephone virtuel
L'ecran d'accueil affiche une carte du Togo (Lome, Sokode, Kara, Atakpame, Kpalime, Cinkasse, Aneho) avec le nombre d'attaques interceptees.
- Pour tester le systeme sans installer l'application sur un vrai appareil, un Telephone Virtuel interactif est integre a l'ecran.
- Il se trouve sur la partie droite de la page d'accueil (onglet de supervision "DASHBOARD"), positionne sur le volet droit de l'ecran, juste en dessous de la carte nationale et des graphiques. On peut y taper des messages d'arnaques fictifs pour observer l'interception en direct.

2. La collecte automatique d'informations officielles (Threat Intelligence)
La console se connecte d'elle-meme aux sites de cybersecurite nationaux comme le CERT.TG ou l'ANCY (ancy.gouv.tg) pour copier leurs communiques d'alertes officiels. Une intelligence artificielle (Gemini) lit ces articles, extrait les numeros d'arnaqueurs ou les URL de phishing, et propose de les integrer directement dans l'application mobile en un clic sans besoin de tout recopier a la main.

3. La base d'ajustement des signatures de securite
Les experts peuvent ajouter de nouvelles signatures dans la base de donnees grace a un simple formulaire. Ils peuvent aussi fournir un texte suspect, laisser l'IA l'analyser pour extraire automatiquement les elements dangereux, puis appuyer sur un bouton pour mettre a jour l'ensemble des telephones. L'administrateur peut exporter la base de donnees active sous format JSON ou importer un autre lot de signatures pour effectuer une fusion securisee avec controle d'integrite.

4. Les enquetes criminelles et la securite administrative
Le serveur regroupe les rapports de telemetrie envoyes par tous les telephones pour decouvrir si une meme personne est train d'attaquer une grande partie de la population ou une region specifique.
- Pour proteger le poste de commandement contre les personnes malveillantes, les mots de passe des administrateurs (ANANIVI, RADJI, KPETO, EHEY) ne sont jamais ecrits en texte simple. Ils sont modifies de maniere irreversible sous forme d'empreinte securisee (hachage SHA-256).
- De plus, si un intrus essaie de deviner un mot de passe et commet 5 erreurs de suite, son compte est bloque pendant 15 minutes.

---

## Comment installer et tester le projet ?

Voici les trois solutions de test simples pour vos collaborateurs :

### Solution A : Tester directement sur la page internet principale (Le plus rapide)
1. Demarrez le site web en ouvrant le terminal et en saisissant les  commandes :"npm install"  "npm run dev" 
2. Allez sur votre navigateur web a l'adresse : http://localhost:3000
3. Regardez la partie de droite de l'onglet principal : vous y trouverez un Telephone Virtuel.
4. Tapez par exemple : "Moov offre un credit gratuit composez le numero secret et votre code PIN" et validez.
5. Vous verrez le telephone virtuel bloquer le message, l'alerte apparaitre et la telemetrie etre envoyee immediatement aux experts sur l'ecran de contrôle.

### Solution B : Compiler et developper sur votre ordinateur
1. Telechargez et installez l'application Android Studio sur votre ordinateur.
2. Ouvrez Android Studio et selectionnez le dossier "/agent_mobile_android".
3. Laissez Android Studio telecharger les dossiers de developpement necessaires.
4. Ouvrez le fichier de configuration de l'application sur Android Studio pour y inserer l'adresse reseau locale de votre ordinateur (par exemple : http://192.168.1.50:3000/).
5. Connectez un telephone de test Android a votre ordinateur avec un cable de telechargement ou utilisez le telephone virtuel inclus dans Android Studio.
6. Cliquez sur le bouton "Run" d'Android Studio pour installer l'application sur le telephone.
7. Activez l'option d'interception des messages et de lecture des notifications pressee par le systeme Android.

### Solution C : Tester en situation reelle avec un vrai telephone (Le plus de valeur)
Pour permettre a vos collaborateurs d'essayer directement sur un vrai smartphone, notre plateforme serveur centrale est installee en ligne a cette adresse permanente : https://sp-sentinel-hq.onrender.com/

1. Configuration de l'adresse reseau Internet :
Dans le code source Java de l'application sur Android Studio, modifiez l'adresse web de Retrofit pour pointer de maniere permanente vers le serveur en ligne : https://sp-sentinel-hq.onrender.com/

2. Creation du fichier d'installation (.APK) :
- Dans le menu superieur d'Android Studio, cliquez sur : Build > Build Bundle(s) / APK(s) > Build APK(s)
- L'ordinateur va assembler l'application et vous donner un fichier binaire nomme "app-debug.apk" disponible dans le dossier de build de l'application.

3. Installation sur le telephone Android :
- Envoyez ce fichier d'installation (.apk) sur votre telephone portable Android.
- Ouvrez le fichier. Si le telephone indique que l'application ne vient pas du magasin officiel, autorisez l'installation manuelle en cliquant sur "Autoriser pour cette source".
- Lancez l'application nommee SP_TG et allez dans les parametres de votre telephone pour lui donner l'autorisation indispensable : "Acces aux notifications".

4. Faire les tests en direct :
- A l'aide d'un second telephone, envoyez un faux message d'arnaque vers le telephone de test (par exemple par SMS ou sur WhatsApp).
- Le telephone de test va bloquer le message, masquer l'alerte originale et vous afficher un ecran de protection d'urgence.
- En meme temps, connectez-vous avec vos collaborateurs sur le site internet : https://sp-sentinel-hq.onrender.com/. Vous pourrez constater que l'attaque s'affiche instantanement sur la carte de cyberprotection de Lome.
