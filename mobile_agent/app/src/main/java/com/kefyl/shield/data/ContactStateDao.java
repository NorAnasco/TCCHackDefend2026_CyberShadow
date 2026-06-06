package com.kefyl.shield.data;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import java.util.List;

@Dao
public interface ContactStateDao {

    @Query("SELECT * FROM contact_states WHERE phoneNumber = :phoneNumber LIMIT 1")
    ContactState getContactState(String phoneNumber);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertContactState(ContactState contactState);

    @Update
    void updateContactState(ContactState contactState);

    @Query("DELETE FROM contact_states WHERE phoneNumber = :phoneNumber")
    void deleteContactState(String phoneNumber);

    @Query("SELECT * FROM contact_states")
    List<ContactState> getAllTrackedContacts();

    @Query("DELETE FROM contact_states")
    void clearAll();
}
