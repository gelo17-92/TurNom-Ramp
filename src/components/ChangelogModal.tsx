import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Calendar, Tag, CheckCircle2, ChevronDown, ChevronsUpDown, Layers } from 'lucide-react';
import { UPDATES_HISTORY, APP_VERSION } from '../data/updatesHistory';
import { useScrollLock } from '../hooks/useScrollLock';
import { cn } from '../types';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  useScrollLock(isOpen);

  // Each version is collapsible and by default collected/collapsed as requested by user
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => ({
      ...prev,
      [version]: !prev[version]
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    UPDATES_HISTORY.forEach(u => {
      allExpanded[u.version] = true;
    });
    setExpandedVersions(allExpanded);
  };

  const collapseAll = () => {
    setExpandedVersions({});
  };

  const isAllExpanded = UPDATES_HISTORY.length > 0 && UPDATES_HISTORY.every(u => !!expandedVersions[u.version]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col text-left overflow-hidden max-h-[88vh]"
          >
            {/* Decorative top gradient bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-azul-blue via-sky-400 to-azul-yellow" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer select-none"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 mb-3 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-azul-blue/10 dark:bg-azul-blue/20 text-azul-blue dark:text-sky-300 flex items-center justify-center shrink-0 shadow-xs border border-azul-blue/20">
                <Sparkles size={22} className="text-azul-blue dark:text-sky-300" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                    Historial de Actualizaciones
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Versión instalada
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-azul-blue text-white shadow-2xs">
                    v{APP_VERSION}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Toggle Controls */}
            <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers size={12} className="text-azul-blue dark:text-sky-400" />
                <span>{UPDATES_HISTORY.length} versiones • Actualizaciones en vivo</span>
              </span>
              <button
                type="button"
                onClick={isAllExpanded ? collapseAll : expandAll}
                className="text-[10px] font-bold text-azul-blue dark:text-sky-300 hover:underline cursor-pointer flex items-center gap-1 select-none"
              >
                <ChevronsUpDown size={12} />
                <span>{isAllExpanded ? 'Recoger todas' : 'Desplegar todas'}</span>
              </button>
            </div>

            {/* Scrollable Updates List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar my-1">
              {UPDATES_HISTORY.map((update) => {
                const isExpanded = !!expandedVersions[update.version];

                return (
                  <div
                    key={update.version}
                    className={cn(
                      "rounded-2xl border transition-all overflow-hidden",
                      update.isCurrent
                        ? "bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/90 dark:border-sky-800/40 shadow-xs ring-1 ring-sky-300/30"
                        : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800/60"
                    )}
                  >
                    {/* Collapsible Trigger Header */}
                    <button
                      type="button"
                      onClick={() => toggleVersion(update.version)}
                      className="w-full p-3.5 flex flex-col gap-1.5 text-left transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/60 cursor-pointer select-none"
                    >
                      {/* Top Meta Line: Badges, Date & Chevron */}
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs",
                            update.isCurrent
                              ? "bg-azul-blue text-white"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          )}>
                            <Tag size={10} />
                            v{update.version}
                          </span>
                          {update.isCurrent && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                              Actual
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                            <Calendar size={12} className="shrink-0 text-slate-400" />
                            <span>{update.date}</span>
                          </div>
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs",
                            isExpanded ? "rotate-180 text-azul-blue dark:text-sky-400" : "text-slate-400"
                          )}>
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-snug pr-2">
                        {update.title}
                      </h4>
                    </button>

                    {/* Collapsible Body (Hidden by default, smooth animated reveal) */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`content-${update.version}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/50 space-y-1.5">
                            {/* Changes List */}
                            {update.changes && update.changes.length > 0 && (
                              <ul className="space-y-1.5 pt-0.5">
                                {update.changes.map((change, idx) => {
                                  const parts = change.split(':');
                                  if (parts.length === 2) {
                                    const category = parts[0].trim();
                                    const section = parts[1].trim();
                                    let badgeColor = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
                                    if (category.toLowerCase().includes('nueva')) {
                                      badgeColor = "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/50";
                                    } else if (category.toLowerCase().includes('diseño')) {
                                      badgeColor = "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/50";
                                    } else if (category.toLowerCase().includes('mejora')) {
                                      badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50";
                                    } else if (category.toLowerCase().includes('error') || category.toLowerCase().includes('corregid')) {
                                      badgeColor = "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50";
                                    }

                                    return (
                                      <li key={idx} className="flex items-center gap-2 text-[11px] leading-snug py-0.5">
                                        <CheckCircle2 size={13} className="text-azul-blue dark:text-sky-400 shrink-0" />
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border", badgeColor)}>
                                            {category}
                                          </span>
                                          <span className="font-bold text-slate-800 dark:text-slate-100 text-[11px]">
                                            {section}
                                          </span>
                                        </div>
                                      </li>
                                    );
                                  }

                                  return (
                                    <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                                      <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{change}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Bottom button */}
            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-azul-blue hover:bg-azul-blue/90 text-white font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

