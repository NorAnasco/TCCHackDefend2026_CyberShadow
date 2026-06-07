from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Campaign(Base):
    """
    Modèle pour les Campagnes d'Attaques Identifiées.
    Sert à regrouper les indicateurs de menace corrélés.
    """
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    target = Column(String(150), nullable=True)  # ex: "Flooz", "CEET", "TMoney"
    status = Column(String(50), default="Active")  # "Active", "Mitigated"
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)

    signatures = relationship("ThreatSignature", back_populates="campaign")


class ThreatSignature(Base):
    """
    Modèle des Signatures de Menace (IoC : Indicators of Compromise).
    Fichiers téléchargés par l'agent Java pour le filtrage local.
    """
    __tablename__ = "threat_signatures"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(String(255), unique=True, nullable=False, index=True) # ex: "+22899..." ou "togo-tmoney.com"
    type = Column(String(50), nullable=False)  # "URL", "PHONE", "EMAIL", "IP"
    severity = Column(String(50), default="Medium")  # "Low", "Medium", "Critical"
    detected_at = Column(DateTime, default=datetime.utcnow)
    location = Column(String(100), default="Lomé") # Région/Ville du Togo
    details = Column(Text, nullable=True)
    
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    campaign = relationship("Campaign", back_populates="signatures")


class AttackReport(Base):
    """
    Rapports d'Attaque anonymisés remontés par les terminaux mobiles des agents au Togo.
    Sert à la corrélation forensique de terrain.
    """
    __tablename__ = "attack_reports"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=False, index=True)  # ID anonyme haché du terminal
    sender_phone = Column(String(50), nullable=True)  # ex: Le numéro d'arnaqueur reçu sur WhatsApp/SMS
    evidence_text = Column(Text, nullable=True)  # Contenu ou lien suspect reçu par l'agent
    location = Column(String(100), default="Lomé")  # Ville de capture (Kara, Atakpamé, Kpalimé...)
    reported_at = Column(DateTime, default=datetime.utcnow)
    meta_data = Column(JSON, nullable=True)  # Données complémentaires d'environnement


class SyncConfigSetting(Base):
    """
    Configuration globale de synchronisation poussée aux terminaux mobiles.
    """
    __tablename__ = "sync_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(100), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
