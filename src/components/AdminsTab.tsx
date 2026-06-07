import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Lock, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  KeyRound,
  FileKey
} from "lucide-react";

interface AdminAccount {
  username: string;
  role: string;
  createdAt: string;
}

interface Props {
  currentUsername: string;
  onRefreshData?: () => void;
}

export default function AdminsTab({ currentUsername, onRefreshData }: Props) {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states for password change
  const [selectedUserToChange, setSelectedUserToChange] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);

  // Form states for creation
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("Administrateur");
  const [createLoading, setCreateLoading] = useState(false);

  // Fetch admin list
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admins");
      const obj = await res.json();
      if (obj.success) {
        setAdmins(obj.admins);
        // Default select to current username or first user for password change
        if (!selectedUserToChange && obj.admins.length > 0) {
          const hasCurrent = obj.admins.some((a: AdminAccount) => a.username.toUpperCase() === currentUsername.toUpperCase());
          setSelectedUserToChange(hasCurrent ? currentUsername : obj.admins[0].username);
        }
      }
    } catch (e) {
      console.error("Failed to load administrators profiles list", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !createPassword.trim()) {
      setMessage({ type: "error", text: "Tous les champs sont requis pour la création." });
      return;
    }

    setCreateLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername,
          password: createPassword,
          role: createRole
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: `Le compte administrateur '${createUsername}' a été configuré avec succès.` });
        setCreateUsername("");
        setCreatePassword("");
        fetchAdmins();
        if (onRefreshData) onRefreshData();
      } else {
        setMessage({ type: "error", text: data.error || "Échec de création de l'administrateur." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erreur réseau lors de la création de compte." });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToChange || !newPassword.trim()) {
      setMessage({ type: "error", text: "Veuillez entrer le nouveau mot de passe." });
      return;
    }

    setChangeLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admins/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUserToChange,
          password: newPassword
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: `Le mot de passe de l'administrateur '${selectedUserToChange}' a été mis à jour.` });
        setNewPassword("");
        fetchAdmins();
      } else {
        setMessage({ type: "error", text: data.error || "Échec de modification du mot de passe." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erreur réseau de mise à jour du mot de passe." });
    } finally {
      setChangeLoading(false);
    }
  };

  const handleDeleteAdmin = async (targetUser: string) => {
    if (targetUser.toUpperCase() === currentUsername.toUpperCase()) {
      setMessage({ type: "error", text: "Pour des raisons de sécurité, vous ne pouvez pas supprimer votre propre compte actif." });
      return;
    }

    if (!window.confirm(`Voulez-vous supprimer définitivement le compte de l'administrateur: ${targetUser} ?`)) {
      return;
    }

    setMessage(null);
    try {
      const response = await fetch(`/api/admins/${encodeURIComponent(targetUser)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: `Le compte de l'administrateur '${targetUser}' a été révoqué.` });
        fetchAdmins();
        if (onRefreshData) onRefreshData();
      } else {
        setMessage({ type: "error", text: data.error || "Échec de suppression du compte." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erreur réseau." });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Head */}
      <div className="bg-[#121A2F] border border-white/5 rounded-xl px-5 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-[#3B82F6]" />
          <div>
            <span className="text-xs font-mono font-bold text-[#E5E7EB] uppercase tracking-widest block">
              GESTION DES ACCÈS ET PROFILS ADMINISTRATEURS
            </span>
            <span className="text-[10px] text-[#94A3B8] font-mono block mt-0.5">
              Contrôlez les privilèges, modifiez les clés d&apos;accès et gérez l&apos;équipe opérationnelle du SOC SP.
            </span>
          </div>
        </div>
        <div className="text-xs font-mono font-bold text-slate-400 bg-[#0B1020]/45 border border-white/5 px-3 py-1.5 rounded-lg">
          Actif: <span className="text-white font-black">{currentUsername}</span>
        </div>
      </div>

      {message && (
        <div className={`p-4 border rounded-xl flex items-start gap-3 text-xs font-mono ${message.type === "success" ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-300" : "bg-red-500/10 border-red-500/15 text-red-300"}`}>
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <div>
            <span className="font-bold uppercase block">{message.type === "success" ? "OPÉRATION VALIDÉE" : "ALERTE SÉCURITÉ"}</span>
            <p className="mt-1 leading-relaxed text-[11px]">{message.text}</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Admins List (7 Cols) */}
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 lg:col-span-7 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-white tracking-wider flex items-center gap-2 font-mono uppercase">
                <Users className="w-4 h-4 text-[#3B82F6]" />
                ADMINISTRATEURS ENREGISTRÉS ({admins.length})
              </h3>
              <span className="text-[9px] font-mono text-slate-500">CONTRÔLE CENTRAL</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500/10 border-t-[#3B82F6] rounded-full animate-spin"></div>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-12 text-[#94A3B8] font-mono text-xs">
                Aucun administrateur trouvé. Une réinitialisation critique est requise.
              </div>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div 
                    key={admin.username} 
                    className={`p-4 border rounded-xl flex items-center justify-between transition ${admin.username.toUpperCase() === currentUsername.toUpperCase() ? "bg-[#3B82F6]/10 border-[#3B82F6]/30" : "bg-[#0B1020]/25 border-white/5 hover:border-slate-700"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${admin.username.toUpperCase() === currentUsername.toUpperCase() ? "bg-[#3B82F6] text-white" : "bg-[#1A2542] text-slate-300 border border-white/5"}`}>
                        {admin.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white">{admin.username}</span>
                          {admin.username.toUpperCase() === currentUsername.toUpperCase() && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#3B82F6]/20 text-blue-300 border border-[#3B82F6]/30 uppercase font-bold">
                              Session Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-[#94A3B8] mt-1">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                            {admin.role}
                          </span>
                          <span className="flex items-center gap-1 text-[9px]">
                            <Clock className="w-3 h-3" />
                            Créé le le {new Date(admin.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {admin.username.toUpperCase() !== currentUsername.toUpperCase() ? (
                      <button
                        onClick={() => handleDeleteAdmin(admin.username)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition cursor-pointer"
                        title="Révoquer cet accès d'administration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-600 block px-1.5">Système</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono border-t border-white/5 pt-3 mt-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Piste d&apos;audit : chaque modification de compte admin est enregistrée sur le serveur local.</span>
          </div>
        </div>

        {/* Right Side: Operations Forms (5 Cols) */}
        <div className="space-y-6 lg:col-span-5">
          
          {/* Modify password form */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 relative overflow-hidden shadow-md">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-white/5">
              <Lock className="w-3.5 h-3.5 text-[#3B82F6]" />
              MODIFIER UN MOT DE PASSE
            </h4>

            <form onSubmit={handleChangePassword} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Cible d&apos;administration :</label>
                <select
                  value={selectedUserToChange}
                  onChange={(e) => setSelectedUserToChange(e.target.value)}
                  className="w-full bg-[#0B1020]/45 border border-white/5 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-[#3B82F6] transition"
                >
                  <option value="" disabled>Sélectionner un compte</option>
                  {admins.map(a => (
                    <option key={a.username} value={a.username} className="bg-[#121A2F]">
                      {a.username} ({a.username.toUpperCase() === currentUsername.toUpperCase() ? "Vous" : a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Nouveau mot de passe :</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 5 caractères"
                  className="w-full bg-[#0B1020]/45 border border-white/5 rounded-lg py-2 px-3 text-[#E5E7EB] placeholder-slate-700 focus:outline-none focus:border-[#3B82F6] transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={changeLoading}
                className="w-full py-2 bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white font-bold rounded-lg transition shadow-md font-sans text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {changeLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <FileKey className="w-4 h-4" />
                    APPLIQUER LA CLÉ ACCÈS
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Creation form */}
          <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 relative overflow-hidden shadow-md">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 pb-2 border-b border-white/5">
              <UserPlus className="w-3.5 h-3.5 text-[#3B82F6]" />
              CRÉER UN ACCÈS CABINET ADMIN
            </h4>

            <form onSubmit={handleCreateAdmin} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Identifiant d&apos;accès :</label>
                <input
                  type="text"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="Ex: TCHAMBA, YAO"
                  className="w-full bg-[#0B1020]/45 border border-white/5 rounded-lg py-2 px-3 text-[#E5E7EB] placeholder-slate-700 focus:outline-none focus:border-[#3B82F6] transition uppercase"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Mot de passe par défaut :</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minimum 5 caractères"
                  className="w-full bg-[#0B1020]/45 border border-white/5 rounded-lg py-2 px-3 text-[#E5E7EB] placeholder-slate-700 focus:outline-none focus:border-[#3B82F6] transition"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Rôle affecté :</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  className="w-full bg-[#0B1020]/45 border border-white/5 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-[#3B82F6] transition"
                >
                  <option value="Administrateur" className="bg-[#121A2F]">Administrateur Cyber-Menaces</option>
                  <option value="Super-Administrateur" className="bg-[#121A2F]">Chef de Cabinet SOC</option>
                  <option value="Analyse Forensique" className="bg-[#121A2F]">Auditeur Judiciaire</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-2 bg-[#10B981] hover:bg-[#10B981]/80 text-[#121A2F] font-black rounded-lg transition font-sans text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {createLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    ACTIVATION LIEN OPÉRATEUR
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
