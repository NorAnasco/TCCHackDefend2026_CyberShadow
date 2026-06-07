package com.kefyl.shield.api;

import com.google.gson.annotations.SerializedName;

public class RegisterRequest {

    @SerializedName("device_id")
    private String deviceId;

    @SerializedName("name")
    private String name;

    @SerializedName("city")
    private String city;

    @SerializedName("phone")
    private String phone;

    public RegisterRequest(String deviceId, String name, String city, String phone) {
        this.deviceId = deviceId;
        this.name = name;
        this.city = city;
        this.phone = phone;
    }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
