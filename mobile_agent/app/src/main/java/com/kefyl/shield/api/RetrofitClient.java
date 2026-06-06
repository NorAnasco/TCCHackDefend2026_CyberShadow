package com.kefyl.shield.api;

import android.content.Context;
import android.content.SharedPreferences;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import java.util.concurrent.TimeUnit;

public class RetrofitClient {

    private static final String PREFS_NAME = "kefyl_prefs";
    private static final String KEY_SERVER_IP = "server_ip_address";
    public static final String DEFAULT_BASE_URL = "https://sp-sentinel-hq.onrender.com/"; // Deployed Render Server Default

    private static Retrofit retrofit = null;
    private static String currentBaseUrl = "";

    public static synchronized KefylApiService getApiService(Context context) {
        String baseUrl = getServerBaseUrl(context);
        
        // Si l'URL a changé ou retrofit n'est pas initialisé, instancier un nouveau client
        if (retrofit == null || !currentBaseUrl.equals(baseUrl)) {
            currentBaseUrl = baseUrl;
            
            HttpLoggingInterceptor interceptor = new HttpLoggingInterceptor();
            interceptor.setLevel(HttpLoggingInterceptor.Level.BODY);

            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(interceptor)
                    .addInterceptor(chain -> {
                        okhttp3.Request original = chain.request();
                        SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                        String token = prefs.getString("agent_secure_token", "");
                        
                        if (token.isEmpty()) {
                            String deviceId = android.provider.Settings.Secure.getString(
                                    context.getContentResolver(), 
                                    android.provider.Settings.Secure.ANDROID_ID
                            );
                            if (deviceId == null || deviceId.isEmpty()) {
                                deviceId = "TG-FALLBACK";
                            }
                            token = "kfl-shield-fallback-" + deviceId;
                        }
                        
                        okhttp3.Request request = original.newBuilder()
                                .header("x-agent-token", token)
                                .header("x-agent-code", token)
                                .header("User-Agent", "KefylShield/1.5.0 (Android)")
                                .build();
                        return chain.proceed(request);
                    })
                    .connectTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(baseUrl)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit.create(KefylApiService.class);
    }

    /**
     * Lit l'IP du serveur depuis les SharedPreferences.
     */
    public static String getServerBaseUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedIp = prefs.getString(KEY_SERVER_IP, "https://sp-tg-1.onrender.com");
        
        // Formatte correctement l'URL
        if (!savedIp.startsWith("http://") && !savedIp.startsWith("https://")) {
            savedIp = "http://" + savedIp;
        }
        if (!savedIp.endsWith("/")) {
            savedIp = savedIp + "/";
        }
        return savedIp;
    }

    /**
     * Met à jour l'IP du serveur pour s'adapter à l'adresse de la machine (ex: 192.168.1.15:8000)
     */
    public static void saveServerIp(Context context, String ipAddress) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_SERVER_IP, ipAddress).apply();
    }
}
