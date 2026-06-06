package com.kefyl.shield.data;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;

@Dao
public interface SignatureDao {

    @Query("SELECT * FROM signatures")
    List<Signature> getAllSignatures();

    @Query("SELECT * FROM signatures WHERE type = :type")
    List<Signature> getSignaturesByType(String type);

    @Query("SELECT * FROM signatures WHERE pattern = :pattern LIMIT 1")
    Signature findSignature(String pattern);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertSignatures(List<Signature> signatures);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertSignature(Signature signature);

    @Query("DELETE FROM signatures")
    void clearAll();

    @Query("SELECT COUNT(*) FROM signatures")
    int getCount();
}
