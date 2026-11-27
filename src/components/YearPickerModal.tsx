import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

interface YearPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

export const YearPickerModal: React.FC<YearPickerModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  onSelectYear
}) => {
  const currentActualYear = new Date().getFullYear();
  // Start decade base from the selected year
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(selectedYear / 12) * 12);

  useScrollLock(isOpen);

  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i);

  const handleYearSelect = (year: number) => {
    onSelectYear(year);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          data-modal-active="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm touch-none"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 overscroll-contain border border-slate-100 dark:border-slate-800"
          >
            <div className="flex flex-col space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-azul-blue/10 text-azul-blue dark:bg-azul-blue/20 dark:text-sky-400 rounded-2xl">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Seleccionar Año
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">
                      Cómputo anual y estadísticas
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Decade Navigator */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <button
                  onClick={() => setDecadeStart(prev => prev - 12)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs rounded-xl transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
                  aria-label="Periodo anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {decadeStart} - {decadeStart + 11}
                </span>
                <button
                  onClick={() => setDecadeStart(prev => prev + 12)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs rounded-xl transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
                  aria-label="Periodo siguiente"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Years Grid */}
              <div className="grid grid-cols-3 gap-3">
                {years.map((year) => {
                  const isSelected = selectedYear === year;
                  const isCurrent = currentActualYear === year;

                  return (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={cn(
                        "py-3 px-2 rounded-2xl font-black text-sm uppercase transition-all duration-200 relative cursor-pointer",
                        isSelected
                          ? "bg-azul-blue text-white shadow-lg shadow-azul-blue/30 scale-105"
                          : isCurrent
                          ? "bg-azul-yellow/15 text-slate-900 dark:text-azul-yellow border-2 border-azul-yellow/60 hover:bg-azul-yellow/25"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-102"
                      )}
                    >
                      <span>{year}</span>
                      {isCurrent && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-black text-azul-blue dark:text-azul-yellow uppercase tracking-widest">
                          Actual
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Reset to Actual Year Button */}
              {selectedYear !== currentActualYear && (
                <button
                  onClick={() => handleYearSelect(currentActualYear)}
                  className="w-full py-2.5 px-4 bg-azul-blue/10 hover:bg-azul-blue/15 text-azul-blue dark:bg-azul-blue/20 dark:text-sky-300 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-98 cursor-pointer text-center"
                >
                  Ir al año actual ({currentActualYear})
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
