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

    @Override
    public void onCreate() {
        super.onCreate();
        executorService = Executors.newSingleThreadExecutor();
        phishingAnalyzer = new PhishingAnalyzer(this);
        contactStateDao = AppDatabase.getDatabase(this).contactStateDao();
        createNotificationChannel();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // Cible spécifique : WhatsApp, SMS et packages de test/simulation
        boolean isTargetApp = "com.whatsapp".equals(packageName) 
                || packageName.contains("sms") 
                || packageName.contains("mms") 
                || packageName.contains("messaging")
                || packageName.contains("test")
                || packageName.contains("mock")
                || packageName.contains("agent")
                || packageName.contains("shell")
                || packageName.contains("kefyl")
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
            if (trustedSources.contains(title) || trustedSources.contains(contactPhone)) {
                Log.i(TAG, "🛡️ Source de confiance détectée (" + title + " / " + contactPhone + "). On ignore l'analyse de sécurité.");
                return;
            }

            // Si c'est un expéditeur inconnu (ou pas dans le carnet), on initialise son suivi dans Room
            if (!isKnown) {
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

            // 2. Étape du Verdict - Niveau Critique (Rouge) : Signature directe en BDD de signatures
            Signature matchedSignature = phishingAnalyzer.analyzeMessage(text);
            
            if (matchedSignature != null) {
                Log.w(TAG, "⚠️ PHISHING CRITIQUE (ROUGE) DÉTECTÉ via signatures d'IoC !");
                triggerHighPriorityAlertNotification(title, text, matchedSignature);
                incrementBlockedThreatsCount();
                submitForensicReport(title, text, matchedSignature, "CRITICAL_SIGNATURE_MATCH");
                return;
            }

            // 3. Étape du Verdict - Niveau Suspect (Jaune/Orange) : Heuristique Psychologique sur Contacts Inconnus
            if (!isKnown) {
                ContactState state = contactStateDao.getContactState(contactPhone);
                if (state != null && "LISTENING".equals(state.getStatus())) {
                    
                    // Exécuter le NLP heuristique de l'analyse psychologique nationale
                    List<String> detectedLevers = phishingAnalyzer.detectSocialEngineeringLevers(text);
                    
                    if (!detectedLevers.isEmpty()) {
                        Log.w(TAG, "⚠️ ALERTE DE VIGILANCE (JAUNE/ORANGE) : Contact inconnu utilisant des techniques de manipulation.");
                        
                        // Promotion de l'interlocuteur à "SUSPECTED" en local
                        state.setStatus("SUSPECTED");
                        contactStateDao.updateContactState(state);

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
                        submitForensicReport(title, text, mockHeuristicSig, "HEURISTIC_SOCIAL_ENG");
                    }
                }
            }
        });
    }

    private boolean isContactInPhonebook(Context context, String titleOrPhone) {
        if (titleOrPhone == null || titleOrPhone.trim().isEmpty()) return false;
        
        // Si le titre contient des chiffres (ex: "+22899010203"), filtre de numéro de téléphone
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
                    return exists;
                }
            } else {
                // Alphanumérique pur (ex: "Koffi", "TotalEnergies", "Moov")
                // On interroge l'annuaire des contacts par DISPLAY_NAME pour s'assurer que c'est un contact réel
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
                    return exists;
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Permission READ_CONTACTS manquante. Analyse de sécurité active par défaut.");
        }
        
        // Par défaut, si l'expéditeur n'est pas explicitement trouvé dans l'annuaire (ou permission manquante),
        // nous le traitons comme inconnu pour appliquer l'analyse de vulnérabilité heuristique fine (NLP/Social Eng).
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

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
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
                .setContentIntent(pendingIntent);

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        launchInAppAlert(sender, messageText, "CRITICAL", "Signature identifiée : " + signature.getPattern(), signature.getDetails());
    }

    /**
     * Alerte de Niveau Suspect / Vigilance (Jaune) : Manipulation via contact inconnu
     */
    private void triggerVigilanceAlertNotification(String sender, String messageText, List<String> detectedLevers) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
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
                .setColor(0xFFFBBF24) // Couleur jaune/orange ambrée
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        launchInAppAlert(sender, messageText, "VIGILANCE", "Manipulation psychologique suspectée", String.join(", ", detectedLevers));
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
        metaData.put("signature_matched_id", signature.getId());
        metaData.put("signature_type", signature.getType());
        metaData.put("detection_reason", reasonType);
        metaData.put("gmt_time", System.currentTimeMillis());

        ReportSubmission report = new ReportSubmission(
                deviceId,
                senderPhone,
                messageText,
                signature.getLocation() != null ? signature.getLocation() : "Lomé",
                metaData
        );

        KefylApiService apiService = RetrofitClient.getApiService(this);
        try {
            Response<ResponseBody> response = apiService.submitReport(report).execute();
            if (response.isSuccessful()) {
                Log.i(TAG, "Rapport d'analyse forensique avancé [" + reasonType + "] transmis avec succès au SOC Kéfyl.");
            } else {
                Log.e(TAG, "Échec de l'envoi du rapport forensique avancé : " + response.code());
            }
        } catch (IOException e) {
            Log.e(TAG, "Erreur réseau lors de la transmission du rapport forensique : " + e.getMessage());
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
        if (executorService != null) {
            executorService.shutdown();
        }
    }
}
