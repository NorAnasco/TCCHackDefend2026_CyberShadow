package com.kefyl.shield.worker;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.kefyl.shield.api.KefylApiService;
import com.kefyl.shield.api.RetrofitClient;
import com.kefyl.shield.api.SyncResponse;
import com.kefyl.shield.data.AppDatabase;
import com.kefyl.shield.data.Signature;
import com.kefyl.shield.data.SignatureDao;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import retrofit2.Response;

public class SyncWorker extends Worker {

    private static final String TAG = "KefylSyncWorker";
    private final SignatureDao signatureDao;

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
        AppDatabase db = AppDatabase.getDatabase(context);
        this.signatureDao = db.signatureDao();
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.i(TAG, "Démarrage de la synchronisation en arrière-plan avec KEFYL SOC.");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences("kefyl_prefs", Context.MODE_PRIVATE);
        String savedToken = prefs.getString("agent_secure_token", "");
        
        if (savedToken.isEmpty()) {
            Log.i(TAG, "Aucun jeton d'agent trouvé. Tentative d'enrôlement dynamique auprès du SOC KÉFYL...");
            String deviceId = android.provider.Settings.Secure.getString(
                    context.getContentResolver(), 
                    android.provider.Settings.Secure.ANDROID_ID
            );
            if (deviceId == null || deviceId.isEmpty()) {
                deviceId = "TG-MOBILE-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            }
            
            boolean isAnonymous = prefs.getBoolean("agent_anonymous", true);
            String regName = prefs.getString("agent_registered_name", "");
            String regPhone = prefs.getString("agent_registered_phone", "");
            String regCity = prefs.getString("agent_registered_city", "Lomé");

            String agentDisplayName;
            if (isAnonymous) {
                agentDisplayName = "TG-Secure-" + deviceId.substring(Math.max(0, Math.min(6, deviceId.length()))).toUpperCase();
            } else if (!regName.isEmpty() && !regPhone.isEmpty()) {
                agentDisplayName = regName + " (" + regPhone + ")";
            } else {
                agentDisplayName = "TG-Secure-" + deviceId.substring(Math.max(0, Math.min(6, deviceId.length()))).toUpperCase();
            }

            KefylApiService registerService = RetrofitClient.getApiService(context);
            com.kefyl.shield.api.RegisterRequest req = new com.kefyl.shield.api.RegisterRequest(
                    deviceId,
                    agentDisplayName,
                    regCity
            );
            
            try {
                Response<com.kefyl.shield.api.RegisterResponse> regResponse = registerService.registerAgent(req).execute();
                if (regResponse.isSuccessful() && regResponse.body() != null && regResponse.body().isSuccess()) {
                    String newToken = regResponse.body().getToken();
                    prefs.edit().putString("agent_secure_token", newToken).apply();
                    Log.i(TAG, "Enrôlement réussi ! Jeton reçu : " + newToken);
                } else {
                    Log.e(TAG, "Échec d'enrôlement SOC (réponse HTTP: " + regResponse.code() + "). Utilisation du token de secours.");
                }
            } catch (IOException e) {
                Log.e(TAG, "Impossible de s'enrôler dynamiquement (Problème réseau) : " + e.getMessage());
            }
        }

        KefylApiService apiService = RetrofitClient.getApiService(context);
        
        try {
            // Appel de synchronisation API
            Response<SyncResponse> response = apiService.syncDatabase("all", "1.0.0").execute();
            
            if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                SyncResponse syncData = response.body();
                List<SyncResponse.SignaturePayload> payloadList = syncData.getData();

                if (payloadList != null && !payloadList.isEmpty()) {
                    List<Signature> signaturesToInsert = new ArrayList<>();
                    
                    for (SyncResponse.SignaturePayload payload : payloadList) {
                        Signature sig = new Signature(
                                payload.getPattern(),
                                payload.getType(),
                                payload.getSeverity(),
                                payload.getLocation(),
                                payload.getDetails()
                        );
                        signaturesToInsert.add(sig);

                        // Si une signature est "Critical" / "Critique", on trace l'actualité de l'alerte
                        if ("Critical".equalsIgnoreCase(payload.getSeverity())) {
                            Log.w(TAG, "🚨 SIGNATURE CRITIQUE REÇUE IMMÉDIATEMENT: " + payload.getPattern());
                        }
                    }

                    // Écriture transactionnelle dans SQLite (Room)
                    signatureDao.clearAll(); // On rafraîchit la base locale
                    signatureDao.insertSignatures(signaturesToInsert);
                    
                    Log.i(TAG, "Enregistrement réussi de " + signaturesToInsert.size() + " signatures binaires d'IaC.");
                }

                // Enregistrement de la date de dernière mise à jour dans SharedPreferences
                saveLastSyncTime();

                // Lancer une intention de mise à jour UI vers MainActivity
                Intent updateUiIntent = new Intent("com.kefyl.shield.UPDATE_STATS");
                getApplicationContext().sendBroadcast(updateUiIntent);

                return Result.success();
            } else {
                Log.e(TAG, "Échec de réponse API : " + response.code());
                return Result.retry();
            }

        } catch (IOException e) {
            Log.e(TAG, "Erreur réseau lors de la synchronisation : " + e.getMessage());
            return Result.retry();
        }
    }

    private void saveLastSyncTime() {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("kefyl_prefs", Context.MODE_PRIVATE);
        String currentDate = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(new Date());
        prefs.edit().putString("last_update_timestamp", currentDate).apply();
    }
}
