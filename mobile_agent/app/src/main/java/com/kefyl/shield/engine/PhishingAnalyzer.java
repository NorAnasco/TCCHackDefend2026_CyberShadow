package com.kefyl.shield.engine;

import android.content.Context;
import com.kefyl.shield.data.AppDatabase;
import com.kefyl.shield.data.Signature;
import com.kefyl.shield.data.SignatureDao;
import com.kefyl.shield.data.ContactStateDao;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PhishingAnalyzer {

    private final SignatureDao signatureDao;
    private final ContactStateDao contactStateDao;

    public PhishingAnalyzer(Context context) {
        AppDatabase db = AppDatabase.getDatabase(context);
        this.signatureDao = db.signatureDao();
        this.contactStateDao = db.contactStateDao();
    }

    /**
     * Analyse le texte extrait de la notification (WhatsApp/SMS)
     * et le compare à tous les patterns malveillants répertoriés en base de données.
     * 
     * @param text Message entier capturé de la notification
     * @return La signature correspondante si compromission détectée, ou null
     */
    public Signature analyzeMessage(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }

        // Récupérer toutes les signatures actives de la base locale
        List<Signature> activeSignatures = signatureDao.getAllSignatures();

        for (Signature signature : activeSignatures) {
            String patternStr = signature.getPattern().toLowerCase().trim();
            String lowerText = text.toLowerCase();

            // 1. Analyse si c'est un lien / domaine suspect
            if ("URL".equalsIgnoreCase(signature.getType())) {
                if (lowerText.contains(patternStr)) {
                    return signature; // Correspondance trouvée!
                }
            }
            
            // 2. Analyse si c'est un numéro d'arnaqueur connu
            else if ("PHONE".equalsIgnoreCase(signature.getType())) {
                // Nettoie l'espace pour maximiser le matching
                String cleanText = lowerText.replaceAll("\\s+", "");
                String cleanPattern = patternStr.replaceAll("\\s+", "");
                if (cleanText.contains(cleanPattern)) {
                    return signature;
                }
            }
            
            // 3. Simple recherche textuelle
            else {
                if (lowerText.contains(patternStr)) {
                    return signature;
                }
            }
        }
        return null;
    }

    /**
     * Analyse psychologique d'ingénierie sociale (Heuristique/NLP de base).
     * Décèle les leviers d'urgence temporelle, appât du gain et d'usurpation.
     *
     * @param text Le contenu du message
     * @return La liste des leviers détectés
     */
    public List<String> detectSocialEngineeringLevers(String text) {
        List<String> levers = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return levers;
        }

        String lowerText = text.toLowerCase();

        // 1. Levier de l'Urgence d'action
        String[] urgencyKeywords = {
            "immédiatement", "avant minuit", "suspendu", "bloqué", "re-vérifier", "désactivé",
            "vite", "sous 24h", "sous 48h", "urgence", "action requise", "bloquer", "clôturer", "perdre"
        };
        for (String word : urgencyKeywords) {
            if (lowerText.contains(word)) {
                levers.add("Urgence temporelle ou menace d'actions restrictives");
                break;
            }
        }

        // 2. Levier de l'Appât du gain ou Récompense
        String[] gainKeywords = {
            "gagné", "bonus", "tirage", "loterie", "cadeau", "félicitations", "million", "somme de",
            "gros lot", "remporter", "transfert reçu", "crédité", "crédit de", "participer", "réclamer",
            "flooz gratuit", "tmoney gratuit", "gagner", "récompense", "récompenses", "sélectionné", "sélectionnée"
        };
        for (String word : gainKeywords) {
            if (lowerText.contains(word)) {
                levers.add("Promesse de gain financier ou de récompense");
                break;
            }
        }

        // 3. Levier de l'Usurpation de posture autoritaire / Corporate
        String[] authorityKeywords = {
            "service client", "direction générale", "police", "gendarmerie", "banque", "orabank", "btci", "utb",
            "moov", "togocom", "support technique", "procureur", "chef de service", "administrateur", "conseiller",
            "flooz", "tmoney", "services fiscaux", "direction", "totalenergies", "total energies"
        };
        for (String word : authorityKeywords) {
            if (lowerText.contains(word)) {
                levers.add("Usurpation d'une autorité institutionnelle ou commerciale");
                break;
            }
        }

        return levers;
    }
}
