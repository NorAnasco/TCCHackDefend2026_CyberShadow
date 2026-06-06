package com.kefyl.shield.api;

import com.google.gson.annotations.SerializedName;

public class RegisterResponse {

    @SerializedName("success")
    private boolean success;

    @SerializedName("message")
    private String message;

    @SerializedName("agent_id")
    private String agentId;

    @SerializedName("token")
    private String token;

    @SerializedName("sync_days")
    private int syncDays;

    @SerializedName("gateway")
    private String gateway;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getAgentId() { return agentId; }
    public String getToken() { return token; }
    public int getSyncDays() { return syncDays; }
    public String getGateway() { return gateway; }
}
