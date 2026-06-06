package com.kefyl.shield.api;

import com.google.gson.annotations.SerializedName;

public class RegisterRequest {

    @SerializedName("device_id")
    private String deviceId;

    @SerializedName("name")
    private String name;

    @SerializedName("city")
    private String city;

    public RegisterRequest(String deviceId, String name, String city) {
        this.deviceId = deviceId;
        this.name = name;
        this.city = city;
    }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
}
