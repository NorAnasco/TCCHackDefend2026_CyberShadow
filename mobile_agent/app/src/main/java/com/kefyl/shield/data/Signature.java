package com.kefyl.shield.data;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "signatures")
public class Signature {
    
    @PrimaryKey(autoGenerate = true)
    private int id;

    @NonNull
    private String pattern; // ex: "+22899120485" (numéro) ou "togo-tmoney.com" (domaine)
    
    @NonNull
    private String type; // PHONE, URL, EMAIL, TEXT
    
    @NonNull
    private String severity; // Low, Medium, Critical

    private String location; // Ville/région (ex: Lomé)
    private String details;

    public Signature(@NonNull String pattern, @NonNull String type, @NonNull String severity, String location, String details) {
        this.pattern = pattern;
        this.type = type;
        this.severity = severity;
        this.location = location;
        this.details = details;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    @NonNull
    public String getPattern() {
        return pattern;
    }

    public void setPattern(@NonNull String pattern) {
        this.pattern = pattern;
    }

    @NonNull
    public String getType() {
        return type;
    }

    public void setType(@NonNull String type) {
        this.type = type;
    }

    @NonNull
    public String getSeverity() {
        return severity;
    }

    public void setSeverity(@NonNull String severity) {
        this.severity = severity;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
