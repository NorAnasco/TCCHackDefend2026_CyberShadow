# Mobile Agent - Kéfyl Android Project Assets

Ce dossier contiendra le code de votre application Android d'agent Kéfyl.

## Configuration requise pour la communication avec KEFYL SOC (FastAPI)

Pour assurer une liaison d'intégrité fluide, l'application Java utilisera soit **Retrofit** soit **Volley** en ciblant les points d'accès configurés dans `/server_central/config_shared.json`.

---

## 🛠️ Exemple d'implémentation Java (Retrofit 2)

### 1. Modèle de données Java (`SignatureModel.java`) :
```java
public class SignatureModel {
    private int id;
    private String pattern;
    private String type;
    private String severity;
    private String location;
    private String details;

    // Getters and Setters
    public String getPattern() { return pattern; }
    public String getType() { return type; }
    public String getSeverity() { return severity; }
}
```

### 2. Modèle de réponse globale (`SyncResponse.java`) :
```java
import java.util.List;

public class SyncResponse {
    private boolean success;
    private String sync_timestamp;
    private int default_sync_interval_days;
    private List<SignatureModel> data;

    public List<SignatureModel> getData() { return data; }
    public int getSyncInterval() { return default_sync_interval_days; }
}
```

### 3. Interface d'API client (`KefylApiService.java`) :
```java
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Query;

public interface KefylApiService {
    
    // Téléchargement sécurisé des signatures binaire locales
    @GET("api/v1/sync")
    Call<SyncResponse> downloadSignatures(
        @Query("agent_version") String version
    );

    // Remonter une intrusion constatée à Lomé
    @POST("api/v1/report")
    Call<Void> submitAttackReport(
        @Body ReportSubmissionModel report
    );
}
```

---

## ⚡ Script Auto-Update Assets

Vous trouverez ci-dessous la commande pour automatiser le déplacement des signatures vers la racine des `assets/` de votre projet Java lors des phases de tests :

```bash
# Exemple de script de déplacement
cp ../server_central/config_shared.json app/src/main/assets/config_shared.json
```
