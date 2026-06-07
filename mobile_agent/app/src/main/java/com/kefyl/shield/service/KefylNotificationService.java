package com.kefyl.shield.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.app.KeyguardManager;
import android.os.PowerManager;

import com.kefyl.shield.MainActivity;
import com.kefyl.shield.api.KefylApiService;
import com.kefyl.shield.api.ReportSubmission;
import com.kefyl.shield.api.RetrofitClient;
import com.kefyl.shield.data.AppDatabase;
import com.kefyl.shield.data.ContactState;
import com.kefyl.shield.data.ContactStateDao;
import com.kefyl.shield.data.Signature;
import com.kefyl.shield.engine.PhishingAnalyzer;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.ResponseBody;
import retrofit2.Response;

public class KefylNotificationService extends NotificationListenerService {

    private static final String TAG = "KefylNotification";
    private static final String CHANNEL_ID = "kefyl_phishing_alert";
    private ExecutorService executorService;
    private PhishingAnalyzer phishingAnalyzer;
    private ContactStateDao contactStateDao;

    private final BroadcastReceiver userUnlockReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) {
                Log.d(TAG, "🔓 Écran déverrouillé ! Vérification automatique d'alerte en attente...");
                checkAndLaunchPendingThreatAlert();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        executorService = Executors.newSingleThreadExecutor();
        phishingAnalyzer = new PhishingAnalyzer(this);
        contactStateDao = AppDatabase.getDatabase(this).contactStateDao();
        createNotificationChannel();

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_USER_PRESENT);
        registerReceiver(userUnlockReceiver, filter);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // Cible spécifique : WhatsApp (perso / Business), SMS et packages de test/simulation/communication
        boolean isTargetApp = packageName.contains("whatsapp") 
                || packageName.contains("sms") 
                || packageName.contains("mms") 
                || packageName.contains("messaging")
                || packageName.contains("messenger")
                || packageName.contains("telegram")
                || packageName.contains("signal")
                || packageName.contains("viber")
                || packageName.contains("test")
                || packageName.contains("mock")
                || packageName.contains("agent")
                || packageName.contains("shell")
                || packageName.contains("sentinel")
                || packageName.contains("talk")
                || packageName.contains("push");
                
        if (!isTargetApp) return;

        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleCharSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
        final String title = titleCharSeq != null ? titleCharSeq.toString().trim() : "";

        CharSequence textCharSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textCharSeq == null) {
            textCharSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        }
        if (textCharSeq == null) {
            textCharSeq = extras.getCharSequence(Notification.EXTRA_INFO_TEXT);
        }
        if (textCharSeq == null) {
            textCharSeq = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        }
        final String text = textCharSeq != null ? textCharSeq.toString().trim() : "";

        if (text.isEmpty() || title.isEmpty()) return;

        // Exécuter l'analyse en arrière-plan sans perturber l'expérience utilisateur ou ralentir l'OS
        executorService.execute(() -> {
            Log.d(TAG, "Interception de notification de " + title + " : " + text);
            
            // Détection si c'est un message de groupe (WhatsApp / SMS groupé)
            boolean isGroup = false;
            String groupName = "";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                isGroup = extras.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false);
            }
            CharSequence convTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE);
            if (convTitle != null && !convTitle.toString().isEmpty()) {
                isGroup = true;
                groupName = convTitle.toString().trim();
            }

            // 1. Étape d'identification du contact (Annuaire vs Inconnu)
            boolean isKnown = isContactInPhonebook(this, title);
            
            // Récupérer et normaliser l'identifiant de contact
            String contactPhone = getCleanedPhoneNumber(title);
            if (contactPhone.isEmpty()) {
                contactPhone = title.replaceAll("[^a-zA-Z0-9_-]", "");
                if (contactPhone.isEmpty()) {
                    contactPhone = "UNKNOWN_SENDER";
                }
            }

            // --- FILTRAGE SOURCE DE CONFIANCE (TRUSTED SOURCES / GROUPS) ---
            SharedPreferences prefs = getSharedPreferences("kefyl_prefs", MODE_PRIVATE);
            java.util.Set<String> trustedSources = prefs.getStringSet("trusted_sources", new java.util.HashSet<>());
            
            // Si c'est un groupe répertorié sur Liste Verte (trusted_sources)
            if (isGroup && !groupName.isEmpty() && trustedSources.contains(groupName)) {
                // Sur groupe de confiance, seule une signature d'IoC de Lomé central peut shunter le bypass
                Signature matchedSignature = phishingAnalyzer.analyzeMessage(text, contactPhone);
                if (matchedSignature != null) {
                    Log.w(TAG, "⚠️ Signature critique détectée dans un groupe de confiance de la Liste Verte ! Shuntage actif.");
                    triggerHighPriorityAlertNotification(title, text, matchedSignature);
                    incrementBlockedThreatsCount();
                    submitForensicReport(title, text, matchedSignature, "CRITICAL_SIGNATURE_MATCH");
                } else {
                    Log.i(TAG, "🛡️ Groupe sur Liste Verte détecté (" + groupName + "). L'analyse heuristique NLP locale a été évitée.");
                }
                return;
            }

            // Si c'est un contact individuel explicitement en source de confiance
            if (trustedSources.contains(title) || trustedSources.contains(contactPhone)) {
                Log.i(TAG, "🛡️ Source de confiance détectée (" + title + " / " + contactPhone + "). On ignore l'analyse de sécurité.");
                return;
            }

            // Si c'est un expéditeur inconnu (et hors contexte groupe), on initialise son suivi de vigilance SQLite
            if (!isKnown && !isGroup) {
                ContactState existingState = contactStateDao.getContactState(contactPhone);
                if (existingState == null) {
                    ContactState newState = new ContactState(contactPhone, "LISTENING", System.currentTimeMillis());
                    contactStateDao.insertContactState(newState);
                    Log.i(TAG, "👤 Nouveau contact inconnu détecté. Statut : LISTENING initié dans SQLite pour " + contactPhone);
                } else {
                    existingState.setLastSeenTimestamp(System.currentTimeMillis());
                    existingState.setMessageCount(existingState.getMessageCount() + 1);
                    contactStateDao.updateContactState(existingState);
                    Log.d(TAG, "👤 Contact inconnu connu du central (" + contactPhone + "). Incrémentation de vigilance (" + existingState.getMessageCount() + " messages).");
                }
            }

            // 2. Étape du Verdict - Niveau Critique (Rouge) : Signature directe en BDD de signatures (Signatures SOC)
            // S'applique à tout le monde (Zéro-trust au niveau signature pour parer l'usurpation / le piratage d'un contact)
            Signature matchedSignature = phishingAnalyzer.analyzeMessage(text, contactPhone);
            
            if (matchedSignature != null) {
                Log.w(TAG, "⚠️ PHISHING CRITIQUE (ROUGE) DÉTECTÉ via signatures d'IoC !");
                triggerHighPriorityAlertNotification(title, text, matchedSignature);
                incrementBlockedThreatsCount();
                submitForensicReport(title, text, matchedSignature, "CRITICAL_SIGNATURE_MATCH");
                return;
            }

            // 3. Étape du Verdict - Niveau Suspect (Jaune/Orange) : Heuristique Psychologique fine
            if (isGroup) {
                // Pour un groupe non-liste-verte, on exécute l'heuristique toujours (Zéro-Trust sur les groupes ouverts)
                List<String> detectedLevers = phishingAnalyzer.detectSocialEngineeringLevers(text);
                if (!detectedLevers.isEmpty()) {
                    Log.w(TAG, "⚠️ ALERTE DE VIGILANCE GROUPE (JAUNE/ORANGE) : Message d'ingénierie sociale suspecté.");
                    triggerVigilanceAlertNotification(title + " @" + groupName, text, detectedLevers);
                    
                    Signature mockHeuristicSig = new Signature(
                            contactPhone, 
                            "PHONE", 
                            "Suspicion Heuristique Groupe: " + groupName, 
                            "Lomé", 
                            "Manipulation détectée: " + String.join(", ", detectedLevers)
                    );
                    incrementBlockedThreatsCount();
                    submitForensicReport(title, text, mockHeuristicSig, "HEURISTIC_SOCIAL_ENG");
                }
            } else {
                // Pour un message privé, on applique le diagnostic s'il s'agit d'un expéditeur inconnu (Zéro-Trust pour inconnus)
                if (!isKnown) {
                    ContactState state = contactStateDao.getContactState(contactPhone);
                    // Analyser si le contact est inconnu, qu'il existe ou non en base de données, 
                    // et qu'il soit dans l'état LISTENING ou SUSPECTED
                    boolean shouldAnalyze = (state == null) || "LISTENING".equals(state.getStatus()) || "SUSPECTED".equals(state.getStatus());
                    
                    if (shouldAnalyze) {
                        List<String> detectedLevers = phishingAnalyzer.detectSocialEngineeringLevers(text);
                        if (!detectedLevers.isEmpty()) {
                            Log.w(TAG, "⚠️ ALERTE DE VIGILANCE (JAUNE/ORANGE) : Contact inconnu utilisant des techniques de manipulation.");
                            
                            if (state == null) {
                                state = new ContactState(contactPhone, "SUSPECTED", System.currentTimeMillis());
                                state.setMessageCount(1);
                                contactStateDao.insertContactState(state);
                            } else {
                                state.setStatus("SUSPECTED");
                                state.setLastSeenTimestamp(System.currentTimeMillis());
                                state.setMessageCount(state.getMessageCount() + 1);
                                contactStateDao.updateContactState(state);
                            }

                            // Déclencher une alerte système Heuristique de Niveau Orange/Jaune
                            triggerVigilanceAlertNotification(title, text, detectedLevers);
                            
                            // Alimenter le SOC forensique Central de cette tentative ingénieuse
                            Signature mockHeuristicSig = new Signature(
                                    contactPhone, 
                                    "PHONE", 
                                    "Suspicion Heuristique", 
                                    "Lomé", 
                                    "Manipulation détectée: " + String.join(", ", detectedLevers)
                            );
                            incrementBlockedThreatsCount();
                            submitForensicReport(title, text, mockHeuristicSig, "HEURISTIC_SOCIAL_ENG");
                        }
                    }
                } else {
                    Log.d(TAG, "ℹ️ Garde-corps : Heuristique NLP ignorée pour le contact enregistré \"" + title + "\" afin d'éviter tout faux positif.");
                }
            }
        });
    }

    private boolean isContactInPhonebook(Context context, String titleOrPhone) {
        if (titleOrPhone == null || titleOrPhone.trim().isEmpty()) return false;
        
        // 1. Détection intelligente du Format de Titre
        // Si le titre ne comporte aucun chiffre, ou s'il commence par des lettres et n'a pas la forme d'un numéro brut,
        // c'est vraisemblablement un contact enregistré qu'Android a déjà résolu en texte amiable (ex: "Maman", "Koffi Ami", etc.).
        // Un expéditeur inconnu s'affiche sous forme de numéro brut (ex: "+228 99 12 04 85" ou "99120485").
        String cleanText = titleOrPhone.trim();
        boolean isSmsGateway = cleanText.matches("^[A-Z0-9_\\-]{3,12}$") 
                || cleanText.equalsIgnoreCase("MOOV") 
                || cleanText.equalsIgnoreCase("TOGOCOM") 
                || cleanText.equalsIgnoreCase("CEET") 
                || cleanText.equalsIgnoreCase("Flooz") 
                || cleanText.equalsIgnoreCase("Tmoney")
                || cleanText.toLowerCase().contains("moov")
                || cleanText.toLowerCase().contains("togocom");
        
        // Liste d'exceptions claires qui ne doivent JAMAIS être considérées comme des contacts enregistrés à la légère
        String lowerTitle = cleanText.toLowerCase();
        boolean isExplicitUnknown = lowerTitle.contains("inconnu") 
                || lowerTitle.contains("unknown") 
                || lowerTitle.contains("masqué") 
                || lowerTitle.contains("prive") 
                || lowerTitle.contains("restricted")
                || lowerTitle.contains("whatsapp")
                || lowerTitle.contains("telegram")
                || lowerTitle.contains("signal")
                || lowerTitle.contains("@") // Contient un séparateur de groupe ou email
                || lowerTitle.matches("^[\\+0-9\\s\\-()]+$"); // que des chiffres et symboles de téléphone

        if (!isSmsGateway && !isExplicitUnknown) {
            // Détection intelligente du Format de Titre
            // Si le titre ne comporte aucun chiffre, et n'est pas un nom de groupe ou d'expéditeur suspect,
            // c'est vraisemblablement un contact enregistré de l'utilisateur (ex: "Maman", "Mon Ami Folly").
            boolean hasBigDigits = cleanText.replaceAll("[^0-9]", "").length() >= 6;
            if (!hasBigDigits && cleanText.matches(".*[a-zA-Z-à-ÿ]{2,}.*")) {
                Log.d(TAG, "👍 Détection intelligente : \"" + titleOrPhone + "\" détecté comme un contact enregistré (déjà résolu par l'OS). Bypass heuristique.");
                return true;
            }
        }

        // 2. Vérification auprès des contacts locaux répertoriés dans SharedPreferences (Carnet local de confiance)
        SharedPreferences prefs = context.getSharedPreferences("kefyl_prefs", Context.MODE_PRIVATE);
        java.util.Set<String> localContacts = prefs.getStringSet("registered_contacts", new java.util.HashSet<>());
        if (localContacts.contains(titleOrPhone) || localContacts.contains(getCleanedPhoneNumber(titleOrPhone))) {
            Log.d(TAG, "👍 Contact enregistré trouvé dans le carnet local Kéfyl.");
            return true;
        }
        
        // 3. Fallback sur les contacts d'Android (nécessite la permission READ_CONTACTS)
        String numericOnly = titleOrPhone.replaceAll("[^0-9]", "");
        boolean hasDigits = numericOnly.length() >= 6;

        try {
            if (hasDigits) {
                android.net.Uri lookupUri = android.net.Uri.withAppendedPath(
                        ContactsContract.PhoneLookup.CONTENT_FILTER_URI, 
                        android.net.Uri.encode(titleOrPhone)
                );
                String[] mPhoneNumberProjection = { ContactsContract.PhoneLookup.DISPLAY_NAME };
                android.database.Cursor cursor = context.getContentResolver().query(
                        lookupUri, 
                        mPhoneNumberProjection, 
                        null, 
                        null, 
                        null
                );
                if (cursor != null) {
                    boolean exists = cursor.getCount() > 0;
                    cursor.close();
                    if (exists) return true;
                }
            } else {
                android.net.Uri uri = ContactsContract.Contacts.CONTENT_URI;
                String selection = ContactsContract.Contacts.DISPLAY_NAME + " = ?";
                String[] selectionArgs = { titleOrPhone };
                android.database.Cursor cursor = context.getContentResolver().query(
                        uri, 
                        null, 
                        selection, 
                        selectionArgs, 
                        null
                );
                if (cursor != null) {
                    boolean exists = cursor.getCount() > 0;
                    cursor.close();
                    if (exists) return true;
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Permission READ_CONTACTS manquante. Analyse par signature de Lomé central active par défaut.");
        }
        
        return false;
    }

    private String getCleanedPhoneNumber(String title) {
        if (title == null) return "";
        String clean = title.replaceAll("[^0-9+]", "");
        if (clean.length() >= 8) {
            return clean;
        }
        return "";
    }

    /**
     * Alerte de Niveau Critique (Rouge) : Signature exacte identifiée
     */
    private void triggerHighPriorityAlertNotification(String sender, String messageText, Signature signature) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String details = signature.getDetails() != null ? signature.getDetails() : "Signature identifiée";
        String extraLevers = "Signature de blocage : " + signature.getPattern();

        // 1. Toujours construire la notification système de haute priorité
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("show_threat_dialog", true);
        intent.putExtra("sender", sender);
        intent.putExtra("message_text", messageText);
        intent.putExtra("threat_type", "CRITICAL");
        intent.putExtra("details", details);
        intent.putExtra("extra_levers", extraLevers);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String alertMessage = "⚠️ Ce message cherche à vous voler votre argent (Flooz ou Tmoney) ! Ne cliquez sur aucun lien !";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle("🚨 DANGER : ARNAQUE FLOOZ/TMONEY BLOQUÉE")
                .setContentText(alertMessage)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(alertMessage))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setColor(0xFFEF4444) // Couleur rouge
                .setAutoCancel(true)
                .setFullScreenIntent(pendingIntent, true) // Force immediate display on wake or unlock
                .setContentIntent(pendingIntent);

        // Envoyer la notification système dans tous les cas pour parer aux restrictions de lancement en arrière-plan d'Android
        notificationManager.notify(1001, builder.build());

        if (isDeviceLocked()) {
            // Le téléphone est éteint de veille ou verrouillé : l'alerte est suspendue pour ne pas saturer l'appareil en veille.
            SharedPreferences prefs = getSharedPreferences("kefyl_prefs", MODE_PRIVATE);
            prefs.edit()
                .putBoolean("has_pending_threat", true)
                .putString("pending_threat_sender", sender)
                .putString("pending_threat_text", messageText)
                .putString("pending_threat_type", "CRITICAL")
                .putString("pending_threat_details", details)
                .putString("pending_threat_extra_levers", extraLevers)
                .apply();

            Log.i(TAG, "🔒 Appareil verrouillé/éteint. Alerte de cyber-fraude critique mise en cache pour pop-up instantané dès le déverrouillage pour protéger l'utilisateur.");
        } else {
            // Le smartphone étant actif : on tente d'ouvrir directement la fenêtre d'alerte en plein écran
            launchInAppAlert(sender, messageText, "CRITICAL", details, extraLevers);
        }
    }

    /**
     * Alerte de Niveau Suspect / Vigilance (Jaune) : Manipulation via contact inconnu
     */
    private void triggerVigilanceAlertNotification(String sender, String messageText, List<String> detectedLevers) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String details = "Analyse en direct : Tentative de manipulation sémantique suspectée.";
        StringBuilder extraLeversString = new StringBuilder();
        for (String lever : detectedLevers) {
            if (extraLeversString.length() > 0) extraLeversString.append(", ");
            extraLeversString.append(lever);
        }
        String extraLevers = extraLeversString.toString();

        // 1. Toujours construire la notification de vigilance
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("show_threat_dialog", true);
        intent.putExtra("sender", sender);
        intent.putExtra("message_text", messageText);
        intent.putExtra("threat_type", "VIGILANCE");
        intent.putExtra("details", details);
        intent.putExtra("extra_levers", extraLevers);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        StringBuilder explanation = new StringBuilder("Ce message suspect de ")
                .append(sender)
                .append(" présente des pièges d'arnaques ;\n");
        for (String lever : detectedLevers) {
            String simpleLever = lever;
            if ("Urgency".equals(lever)) {
                simpleLever = "Fausse urgence (Pression)";
            } else if ("Scarcity".equals(lever)) {
                simpleLever = "Faux gains / Cadeau gratuit";
            } else if ("Authority".equals(lever)) {
                simpleLever = "Fausse identité / CEET / Moov / Togocom";
            } else if ("Fear".equals(lever)) {
                simpleLever = "Tentative d'intimidation";
            }
            explanation.append("- ").append(simpleLever).append("\n");
        }
        explanation.append("Soyez prudents : ne donnez jamais vos codes Flooz ou Tmoney !");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle("⚠️ ATTENTION : MESSAGE SUSPECT / DOUTEUX")
                .setContentText("Ce message ressemble à une technique d'arnaque.")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(explanation.toString()))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setColor(0xFFFBBF24) // Couleur jaune/orange ambrée
                .setAutoCancel(true)
                .setFullScreenIntent(pendingIntent, true) // Force immediate display on wake or unlock
                .setContentIntent(pendingIntent);

        // Envoyer la notification de vigilance dans tous les cas pour parer aux restrictions de lancement en arrière-plan d'Android
        notificationManager.notify(1002, builder.build());

        if (isDeviceLocked()) {
            SharedPreferences prefs = getSharedPreferences("kefyl_prefs", MODE_PRIVATE);
            prefs.edit()
                .putBoolean("has_pending_threat", true)
                .putString("pending_threat_sender", sender)
                .putString("pending_threat_text", messageText)
                .putString("pending_threat_type", "VIGILANCE")
                .putString("pending_threat_details", details)
                .putString("pending_threat_extra_levers", extraLevers)
                .apply();

            Log.i(TAG, "🔒 Appareil verrouillé/éteint. Alerte de vigilance sémantique mise en cache pour pop-up instantané dès le déverrouillage.");
        } else {
            // Le smartphone étant actif : on tente de lancer la fenêtre d'alerte en plein écran
            launchInAppAlert(sender, messageText, "VIGILANCE", details, extraLevers);
        }
    }

    private void incrementBlockedThreatsCount() {
        SharedPreferences prefs = getSharedPreferences("kefyl_prefs", Context.MODE_PRIVATE);
        int currentCount = prefs.getInt("blocked_threats_count", 0);
        prefs.edit().putInt("blocked_threats_count", currentCount + 1).apply();
        
        Intent updateUiIntent = new Intent("com.kefyl.shield.UPDATE_STATS");
        sendBroadcast(updateUiIntent);
    }

    private void submitForensicReport(String senderPhone, String messageText, Signature signature, String reasonType) {
        String deviceId = getAnonymousDeviceId();
        
        Map<String, Object> metaData = new HashMap<>();
        metaData.put("intercepted_app", "Notification Interceptor - Memory & NLP Engine");
        if (signature != null) {
            metaData.put("signature_matched_id", signature.getId());
            metaData.put("signature_type", signature.getType());
        }
        metaData.put("detection_reason", reasonType);
        metaData.put("gmt_time", System.currentTimeMillis());

        String location = (signature != null && signature.getLocation() != null) ? signature.getLocation() : "Lomé";

        ReportSubmission report = new ReportSubmission(
                deviceId,
                senderPhone,
                messageText,
                location,
                metaData
        );

        KefylApiService apiService = RetrofitClient.getApiService(this);
        try {
            Response<ResponseBody> response = apiService.submitReport(report).execute();
            if (response.isSuccessful()) {
                Log.i(TAG, "Rapport d'analyse forensique avancé [" + reasonType + "] transmis avec succès au SOC Kéfyl.");
            } else {
                Log.e(TAG, "Échec de l'envoi du rapport forensique avancé : " + response.code() + ". Sauvegarde locale.");
                RetrofitClient.saveOfflineReport(this, report);
            }
        } catch (IOException e) {
            Log.e(TAG, "Erreur réseau lors de la transmission du rapport forensique : " + e.getMessage() + ". Sauvegarde locale.");
            RetrofitClient.saveOfflineReport(this, report);
        }
    }

    private String getAnonymousDeviceId() {
        SharedPreferences prefs = getSharedPreferences("kefyl_prefs", Context.MODE_PRIVATE);
        String deviceId = prefs.getString("anonymous_device_id", "");
        if (deviceId.isEmpty()) {
            deviceId = "AGENT-TG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            prefs.edit().putString("anonymous_device_id", deviceId).apply();
        }
        return deviceId;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Alertes de Phishing Kéfyl",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications critiques émises par le pare-feu mobile Kéfyl.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void launchInAppAlert(String sender, String text, String type, String details, String extraLevers) {
        // 1. Envoyer un Broadcast avec tous les détails de la menace
        Intent broadcastIntent = new Intent("com.kefyl.shield.NEW_THREAT");
        broadcastIntent.putExtra("sender", sender);
        broadcastIntent.putExtra("message_text", text);
        broadcastIntent.putExtra("threat_type", type);
        broadcastIntent.putExtra("details", details);
        broadcastIntent.putExtra("extra_levers", extraLevers);
        sendBroadcast(broadcastIntent);

        // 2. Tenter de lancer MainActivity pour afficher la fenêtre d'alerte instantanément
        try {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            mainIntent.putExtra("show_threat_dialog", true);
            mainIntent.putExtra("sender", sender);
            mainIntent.putExtra("message_text", text);
            mainIntent.putExtra("threat_type", type);
            mainIntent.putExtra("details", details);
            mainIntent.putExtra("extra_levers", extraLevers);
            startActivity(mainIntent);
        } catch (Exception e) {
            Log.e(TAG, "Impossible de démarrer l'activité d'alerte de cyber-fraude depuis l'arrière-plan.", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(userUnlockReceiver);
        } catch (Exception ignored) {}
        if (executorService != null) {
            executorService.shutdown();
        }
    }

    private boolean isDeviceLocked() {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean isScreenOn = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            isScreenOn = pm.isInteractive();
        } else {
            isScreenOn = pm.isScreenOn();
        }
        boolean isKeyguardLocked = (km != null && km.isKeyguardLocked());
        return !isScreenOn || isKeyguardLocked;
    }

    private void checkAndLaunchPendingThreatAlert() {
        SharedPreferences prefs = getSharedPreferences("kefyl_prefs", MODE_PRIVATE);
        boolean hasPending = prefs.getBoolean("has_pending_threat", false);
        if (hasPending) {
            String sender = prefs.getString("pending_threat_sender", "");
            String text = prefs.getString("pending_threat_text", "");
            String type = prefs.getString("pending_threat_type", "");
            String details = prefs.getString("pending_threat_details", "");
            String extraLevers = prefs.getString("pending_threat_extra_levers", "");

            Log.i(TAG, "🚀 Démarrage de l'alerte plein écran automatique au déverrouillage pour l'émetteur : " + sender);

            // Consommer le cache
            prefs.edit()
                .putBoolean("has_pending_threat", false)
                .remove("pending_threat_sender")
                .remove("pending_threat_text")
                .remove("pending_threat_type")
                .remove("pending_threat_details")
                .remove("pending_threat_extra_levers")
                .apply();

            // Supprimer les notifications d'escroqueries associées
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(1001);
                notificationManager.cancel(1002);
            }

            // Ouvrir l'alerte instantanément pour interdire la lecture des messages
            try {
                Intent mainIntent = new Intent(this, MainActivity.class);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                mainIntent.putExtra("show_threat_dialog", true);
                mainIntent.putExtra("sender", sender);
                mainIntent.putExtra("message_text", text);
                mainIntent.putExtra("threat_type", type);
                mainIntent.putExtra("details", details);
                mainIntent.putExtra("extra_levers", extraLevers);
                startActivity(mainIntent);
            } catch (Exception e) {
                Log.e(TAG, "Erreur lors du déclenchement de l'alerte au déverrouillage", e);
            }
        }
    }
}
