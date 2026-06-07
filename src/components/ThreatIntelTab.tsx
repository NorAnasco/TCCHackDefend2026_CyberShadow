import React, { useState } from "react";
import { 
  Rss, 
  Cpu, 
  CheckCircle, 
  Sparkles, 
  Terminal, 
  FolderPlus, 
  AlertOctagon, 
  Trash2
} from "lucide-react";
import { ScrapedArticle } from "../types";

interface Props {
  scrapedArticles: ScrapedArticle[];
  fetchingFeed: boolean;
  onRefreshFeeds: () => void;
  onAIAnalyzeArticle: (articleId: string) => Promise<any>;
  onAddIoCToDatabase: (type: string, value: string, severity: string, details: string) => void;
  onDeleteArticle?: (id: string) => void;
  totalDeletedCount?: number;
  onResetDeleted?: () => void;
}

export default function ThreatIntelTab({ 
  scrapedArticles, 
  fetchingFeed, 
  onRefreshFeeds, 
  onAIAnalyzeArticle,
  onAddIoCToDatabase,
  onDeleteArticle,
  totalDeletedCount = 0,
  onResetDeleted
}: Props) {
  
  // Loading state for scraping article actions
  const [processingArticles, setProcessingArticles] = useState<Record<string, boolean>>({});

  const processArticle = async (id: string) => {
    setProcessingArticles(prev => ({ ...prev, [id]: true }));
    try {
      await onAIAnalyzeArticle(id);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingArticles(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-6 leading-relaxed">
      
      {/* Scraping module (cert.tg, ancy.gouv.tg) */}
      <div className="space-y-6 animate-fade-in text-xs font-mono">
        <div className="bg-[#121A2F] border border-white/5 rounded-xl p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Rss className="w-4.5 h-4.5 text-[#3B82F6]" />
                EXFILTRATION AUTOMATIQUE DE RENSEIGNEMENTS (CERT.TG &amp; ANCY)
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-1 font-sans">
                Automatisation d&apos;écoute et de scraping des flux ANCY et CERT.TG au Togo pour conversion directe en signatures de blocage.
              </p>
            </div>

            <button 
              onClick={onRefreshFeeds}
              disabled={fetchingFeed}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#3B82F6]/90 active:bg-indigo-700 disabled:bg-[#121A2F] disabled:text-slate-500 text-white rounded-lg text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-2 shrink-0 transition cursor-pointer shadow-sm"
            >
              {fetchingFeed ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Exfiltration...
                </>
              ) : (
                <>
                  <Rss className="w-3.5 h-3.5" />
                  FORCER L&apos;EXFILTRATION CERT-TG
                </>
              )}
            </button>
          </div>

          {totalDeletedCount > 0 && onResetDeleted && (
            <div className="mt-5 px-4 py-3 bg-red-500/10 border border-[#EF4444]/20 rounded-xl flex items-center justify-between text-xs text-slate-300">
              <span className="font-mono flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-[#EF4444]" />
                <span><strong>{totalDeletedCount}</strong> annonce{totalDeletedCount > 1 ? "s" : ""} exfiltrée{totalDeletedCount > 1 ? "s" : ""} masquée{totalDeletedCount > 1 ? "s" : ""} de l&apos;espace de travail actif.</span>
              </span>
              <button
                onClick={onResetDeleted}
                className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white rounded text-[10px] font-bold uppercase tracking-wider font-mono transition cursor-pointer"
              >
                Tout réafficher
              </button>
            </div>
          )}

          {/* List of articles */}
          <div className="mt-6 grid grid-cols-1 gap-6">
            {scrapedArticles.map((article) => (
              <div key={article.id} className="bg-[#0B1020]/45 border border-white/5 rounded-xl overflow-hidden shadow-sm grid grid-cols-1 xl:grid-cols-12 hover:border-white/10 transition">
                
                {/* Left Column: Article basic */}
                <div className="p-5 xl:col-span-7 flex flex-col justify-between border-b xl:border-b-0 xl:border-r border-white/5">
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold border ${article.source === "CERT.TG" ? "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25" : "bg-teal-500/10 text-teal-400 border border-teal-500/20"}`}>
                          {article.source}
                        </span>
                        <span className="text-[10px] font-mono text-slate-550 uppercase">
                          {new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                      
                      {onDeleteArticle && (
                        <button
                          onClick={() => {
                            if (confirm("Voulez-vous supprimer cette annonce de la liste ?")) {
                              onDeleteArticle(article.id);
                            }
                          }}
                          className="text-slate-500 hover:text-rose-500 transition-colors uppercase font-mono font-bold text-[9px] flex items-center gap-1.5 px-2 py-1 bg-red-500/5 hover:bg-red-500/10 rounded-md border border-white/5 cursor-pointer hover:border-rose-500/30"
                          title="Supprimer l'annonce"
                        >
                          <Trash2 className="w-3 h-3" />
                          Supprimer
                        </button>
                      )}
                    </div>
                    
                    <h4 className="text-xs font-bold text-white tracking-wider mb-2 font-mono uppercase">{article.title}</h4>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">{article.snippet}</p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
                    <span className="text-slate-550 truncate max-w-xs">{article.sourceUrl}</span>
                    
                    {/* Processing status or trigger button */}
                    {article.processed ? (
                      <span className="text-[#10B981] font-mono font-bold flex items-center gap-1.5 shrink-0 bg-[#10B981]/15 px-2 py-1 rounded border border-[#10B981]/25 uppercase text-[9px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Classifié par l&apos;IA du SOC
                      </span>
                    ) : (
                      <button 
                        onClick={() => processArticle(article.id)}
                        disabled={processingArticles[article.id]}
                        className="px-3 py-1.5 bg-[#3B82F6]/10 hover:bg-[#3B82F6] text-[#3B82F6] hover:text-white border border-[#3B82F6]/25 font-mono text-[10px] font-bold uppercase rounded transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {processingArticles[article.id] ? (
                          <>
                            <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></span>
                            Traitement...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-[#06B6D4]" />
                            Analyser par l&apos;IA
                          </>
                        )}
                      </button>
                    )}

                  </div>
                </div>

                {/* Right Column: AI Extraction and action push to Database */}
                <div className="p-5 xl:col-span-5 bg-[#0B1020]/25 flex flex-col justify-between">
                  {article.processed && article.analysis ? (
                    <div className="space-y-4 h-full flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
                          INTELLIGENCE COGNITIVE DE MENACE (IoC)
                        </p>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-[#0B1020]/70 p-2 rounded border border-white/5">
                            <span className="text-[9px] text-slate-500 font-mono block uppercase">Catégorie</span>
                            <span className="text-white font-mono font-bold text-[11px] block mt-0.5">{article.analysis.category}</span>
                          </div>
                          <div className="bg-[#0B1020]/70 p-2 rounded border border-white/5 border-dashed">
                            <span className="text-[9px] text-slate-500 font-mono block uppercase">Pertinence Togo</span>
                            <span className="text-[#94A3B8] font-sans text-[10px] line-clamp-2 block leading-snug">{article.analysis.togoRelevance}</span>
                          </div>
                        </div>

                        {/* Actionable signature indicators */}
                        <div className="mt-3">
                          <span className="text-[9px] text-slate-500 font-mono font-bold uppercase block mb-2">Signatures identifiées par l&apos;IA :</span>
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {article.analysis.detectedMaliciousIndicators.map((ioc, idx) => (
                              <div key={idx} className="bg-[#0B1020] border border-white/5 rounded p-2 flex items-center justify-between text-xs">
                                <div className="font-mono flex items-center gap-2 truncate">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${ioc.type === "domain" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : ioc.type === "phone" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-[#121A2F] text-slate-400 border border-white/5"}`}>
                                    {ioc.type}
                                  </span>
                                  <span className="text-white truncate font-bold">{ioc.valeur}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`px-1 rounded text-[8px] uppercase font-bold ${ioc.severity === "Critical" ? "bg-[#EF4444]/15 text-[#EF4444]" : "bg-amber-500/10 text-amber-500"}`}>
                                    {ioc.severity}
                                  </span>
                                  <button 
                                    onClick={() => onAddIoCToDatabase(ioc.type, ioc.valeur, ioc.severity, `Extrait de ${article.source}: ${ioc.description}`)}
                                    className="px-1.5 py-0.5 bg-[#10B981] hover:bg-[#10B981]/90 text-white font-mono text-[8px] font-bold uppercase rounded flex items-center gap-1 transition cursor-pointer"
                                    title="Ajouter immédiatement à la base active"
                                  >
                                    <FolderPlus className="w-2.5 h-2.5" />
                                    PUSH
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <span className="text-[9px] font-mono text-[#10B981] uppercase font-bold block mt-3">Prêt pour la synchronisation immédiate avec l&apos;application mobile</span>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <Terminal className="w-7 h-7 text-slate-700 mb-2 animate-pulse" />
                      <span className="text-xs text-slate-500 font-mono uppercase">Attente de l&apos;analyse IA</span>
                      <p className="text-[10px] text-slate-600 font-mono mt-1 uppercase">Appuyez sur &quot;Analyser par l&apos;IA&quot; pour extraire les indicateurs de menace</p>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
