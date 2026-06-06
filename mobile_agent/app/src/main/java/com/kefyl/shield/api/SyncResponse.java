package com.kefyl.shield.api;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class SyncResponse {

    @SerializedName("success")
    private boolean success;

    @SerializedName("sync_timestamp")
    private String syncTimestamp;

    @SerializedName("default_sync_interval_days")
    private int defaultSyncIntervalDays;

    @SerializedName("data")
    private List<SignaturePayload> data;

    public boolean isSuccess() { return success; }
    public String getSyncTimestamp() { return syncTimestamp; }
    public int getDefaultSyncIntervalDays() { return defaultSyncIntervalDays; }
    public List<SignaturePayload> getData() { return data; }

    public static class SignaturePayload {
        private int id;
        private String pattern;
        private String type;
        private String severity;
        private String location;
        private String details;

        public int getId() { return id; }
        public String getPattern() { return pattern; }
        public String getType() { return type; }
        public String getSeverity() { return severity; }
        public String getLocation() { return location; }
        public String getDetails() { return details; }
    }
}
