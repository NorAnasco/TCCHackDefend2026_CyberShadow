package com.kefyl.shield.api;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Query;

public interface KefylApiService {

    /**
     * Point d'accès de synchronisation des bases de signatures de blocage.
     * Appelé en arrière-plan par SyncWorker.
     */
    @GET("api/v1/sync")
    Call<SyncResponse> syncDatabase(
        @Query("since") String sinceDate,
        @Query("agent_version") String agentVersion
    );

    /**
     * Point d'accès d'enrôlement et d'obtention de jeton sécurisé.
     */
    @POST("api/v1/agent/register")
    Call<RegisterResponse> registerAgent(
        @Body RegisterRequest request
    );

    /**
     * Point d'accès de signalement d'attaques / indicateurs de compromission.
     * Utilisé pour la consolidation forensique à Lomé.
     */
    @POST("api/v1/report")
    Call<ResponseBody> submitReport(
        @Body ReportSubmission report
    );
}
