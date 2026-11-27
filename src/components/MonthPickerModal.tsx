import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { setMonth, setYear, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../types';
import { safeFormat } from '../utils';
import { useScrollLock } from '../hooks/useScrollLock';

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: Date;
  onSelectMonth: (date: Date) => void;
}

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  isOpen,
  onClose,
  currentMonth,
  onSelectMonth
}) => {
  const [viewYear, setViewYear] = useState(currentMonth.getFullYear());

  useScrollLock(isOpen);

  const months = Array.from({ length: 12 }, (_, i) => i);

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = startOfMonth(setYear(setMonth(new Date(), monthIndex), viewYear));
    onSelectMonth(newDate);
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
            className="relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/15 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 overscroll-contain"
          >
            <div className="flex flex-col space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-azul-blue/10 dark:bg-[#020617] text-azul-blue dark:text-[#FFD700] rounded-2xl border border-transparent dark:border-white/10">
                    <Calendar size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-[#FFD700] uppercase tracking-tight">Seleccionar Mes</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 dark:text-white/50 hover:text-slate-600 dark:hover:text-white transition-colors bg-slate-50 dark:bg-[#020617] rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Year Selector */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-[#020617] p-2 rounded-2xl border border-transparent dark:border-white/10">
                <button
                  onClick={() => setViewYear(prev => prev - 1)}
                  className="p-2 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm rounded-xl transition-all text-slate-600 dark:text-white/70 cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{viewYear}</span>
                <button
                  onClick={() => setViewYear(prev => prev + 1)}
                  className="p-2 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm rounded-xl transition-all text-slate-600 dark:text-white/70 cursor-pointer"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Months Grid */}
              <div className="grid grid-cols-3 gap-3">
                {months.map((monthIndex) => {
                  const isSelected = 
                    currentMonth.getMonth() === monthIndex && 
                    currentMonth.getFullYear() === viewYear;
                  
                  return (
                    <button
                      key={monthIndex}
                      onClick={() => handleMonthSelect(monthIndex)}
                      className={cn(
                        "py-4 rounded-2xl font-bold text-sm uppercase transition-all active:scale-95 cursor-pointer",
                        isSelected
                          ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] shadow-lg shadow-azul-blue/20 font-black"
                          : "bg-white dark:bg-[#020617] border border-slate-100 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-azul-blue/30 dark:hover:border-[#FFD700]/40 hover:bg-azul-blue/5 dark:hover:bg-white/5"
                      )}
                    >
                      {safeFormat(setMonth(new Date(), monthIndex), 'MMMM', { locale: es })}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
