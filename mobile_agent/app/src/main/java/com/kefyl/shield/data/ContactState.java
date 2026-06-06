package com.kefyl.shield.data;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "contact_states")
public class ContactState {

    @PrimaryKey
    @NonNull
    private String phoneNumber; // Le numéro de téléphone suspect/inconnu (ex: +228...)

    @NonNull
    private String status; // "LISTENING", "SUSPECTED", "VALIDATED"

    private long lastSeenTimestamp;

    private int messageCount;

    public ContactState(@NonNull String phoneNumber, @NonNull String status, long lastSeenTimestamp) {
        this.phoneNumber = phoneNumber;
        this.status = status;
        this.lastSeenTimestamp = lastSeenTimestamp;
        this.messageCount = 1;
    }

    @NonNull
    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(@NonNull String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    @NonNull
    public String getStatus() {
        return status;
    }

    public void setStatus(@NonNull String status) {
        this.status = status;
    }

    public long getLastSeenTimestamp() {
        return lastSeenTimestamp;
    }

    public void setLastSeenTimestamp(long lastSeenTimestamp) {
        this.lastSeenTimestamp = lastSeenTimestamp;
    }

    public int getMessageCount() {
        return messageCount;
    }

    public void setMessageCount(int messageCount) {
        this.messageCount = messageCount;
    }
}
