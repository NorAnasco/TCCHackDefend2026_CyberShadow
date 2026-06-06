package com.kefyl.shield.api;

import com.google.gson.annotations.SerializedName;
import java.util.Map;

public class ReportSubmission {

    @SerializedName("device_id")
    private String deviceId;

    @SerializedName("sender_phone")
    private String senderPhone;

    @SerializedName("evidence_text")
    private String evidenceText;

    @SerializedName("location")
    private String location;

    @SerializedName("meta_data")
    private Map<String, Object> metaData;

    public ReportSubmission(String deviceId, String senderPhone, String evidenceText, String location, Map<String, Object> metaData) {
        this.deviceId = deviceId;
        this.senderPhone = senderPhone;
        this.evidenceText = evidenceText;
        this.location = location;
        this.metaData = metaData;
    }

    // Getters and Setters
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getSenderPhone() { return senderPhone; }
    public void setSenderPhone(String senderPhone) { this.senderPhone = senderPhone; }

    public String getEvidenceText() { return evidenceText; }
    public void setEvidenceText(String evidenceText) { this.evidenceText = evidenceText; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public Map<String, Object> getMetaData() { return metaData; }
    public void setMetaData(Map<String, Object> metaData) { this.metaData = metaData; }
}
