import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, RotateCcw, ArrowRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addYears,
  subYears,
  parseISO,
  isValid,
  differenceInDays,
  isToday,
  getDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../types';
import { safeFormat } from '../utils';
import { useScrollLock } from '../hooks/useScrollLock';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onChangeRange: (start: string, end: string) => void;
  initialStep?: 'start' | 'end';
  title?: string;
  subtitle?: string;
  accentColor?: 'blue' | 'rose';
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  onChangeRange,
  initialStep = 'start',
  title = 'Seleccionar Tramo',
  subtitle = 'Marca el inicio y el fin en el calendario',
  accentColor = 'blue'
}) => {
  useScrollLock(isOpen);

  const [tempStart, setTempStart] = useState<string>(startDate || '');
  const [tempEnd, setTempEnd] = useState<string>(endDate || '');
  const [activeStep, setActiveStep] = useState<'start' | 'end'>('start');
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (startDate && isValid(parseISO(startDate))) {
      return startOfMonth(parseISO(startDate));
    }
    return startOfMonth(new Date());
  });

  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate || '');
      setTempEnd(endDate || '');
      if (initialStep === 'end' && startDate) {
        setActiveStep('end');
      } else {
        setActiveStep('start');
      }

      const targetDateStr = (initialStep === 'end' && endDate) ? endDate : (startDate || endDate);
      if (targetDateStr && isValid(parseISO(targetDateStr))) {
        setViewMonth(startOfMonth(parseISO(targetDateStr)));
      } else {
        setViewMonth(startOfMonth(new Date()));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(viewMonth),
      end: endOfMonth(viewMonth)
    });
  }, [viewMonth]);

  // Calculate offset for Monday-based week (0 = Monday, 6 = Sunday)
  const startDayOffset = useMemo(() => {
    const dayOfWeek = getDay(startOfMonth(viewMonth)); // 0 is Sunday, 1 is Monday...
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, [viewMonth]);

  const handleDayClick = (date: Date) => {
    const iso = safeFormat(date, 'yyyy-MM-dd');

    if (activeStep === 'start' || !tempStart) {
      setTempStart(iso);
      setTempEnd('');
      setActiveStep('end');
    } else {
      // activeStep === 'end' and tempStart is set
      if (iso < tempStart) {
        // User picked an earlier date: treat it as the new start date and wait for end date
        setTempStart(iso);
        setTempEnd('');
        setActiveStep('end');
      } else {
        setTempEnd(iso);
        setActiveStep('start');
      }
    }
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    onChangeRange('', '');
    setActiveStep('start');
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClose = () => {
    if (tempStart && tempEnd) {
      onChangeRange(tempStart, tempEnd);
    }
    onClose();
  };

  const handleConfirm = () => {
    if (tempStart && !tempEnd) {
      // If only start date was clicked and user confirms, use it as a 1-day range
      onChangeRange(tempStart, tempStart);
    } else {
      onChangeRange(tempStart, tempEnd);
    }
    onClose();
  };

  const selectedDaysCount = useMemo(() => {
    if (!tempStart || !tempEnd) return 0;
    const s = parseISO(tempStart);
    const e = parseISO(tempEnd);
    if (!isValid(s) || !isValid(e) || e < s) return 0;
    return differenceInDays(e, s) + 1;
  }, [tempStart, tempEnd]);

  const isRose = accentColor === 'rose';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          data-modal-active="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClose}
            className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm touch-none"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.25rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-white/10 p-5 sm:p-6 overscroll-contain z-10"
          >
            <div className="flex flex-col space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2.5 rounded-2xl",
                      isRose
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-azul-blue/10 text-azul-blue"
                    )}
                  >
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                      {title}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-800 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Start / End Selector Pills */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep('start');
                    if (tempStart && isValid(parseISO(tempStart))) {
                      setViewMonth(startOfMonth(parseISO(tempStart)));
                    }
                  }}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl text-left transition-all border",
                    activeStep === 'start'
                      ? isRose
                        ? "bg-white dark:bg-slate-900 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-azul-blue ring-2 ring-azul-blue/20 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    1. Fecha Inicio
                  </span>
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-black mt-0.5 truncate w-full",
                      tempStart
                        ? isRose
                          ? "text-rose-600"
                          : "text-azul-blue"
                        : "text-slate-400 italic"
                    )}
                  >
                    {tempStart && isValid(parseISO(tempStart))
                      ? safeFormat(parseISO(tempStart), 'dd MMM yyyy', { locale: es })
                      : 'Seleccionar...'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (tempStart) {
                      setActiveStep('end');
                      if (tempEnd && isValid(parseISO(tempEnd))) {
                        setViewMonth(startOfMonth(parseISO(tempEnd)));
                      }
                    }
                  }}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl text-left transition-all border",
                    activeStep === 'end'
                      ? isRose
                        ? "bg-white dark:bg-slate-900 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-azul-blue ring-2 ring-azul-blue/20 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    2. Fecha Fin
                  </span>
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-black mt-0.5 truncate w-full",
                      tempEnd
                        ? isRose
                          ? "text-rose-600"
                          : "text-azul-blue"
                        : "text-slate-400 italic"
                    )}
                  >
                    {tempEnd && isValid(parseISO(tempEnd))
                      ? safeFormat(parseISO(tempEnd), 'dd MMM yyyy', { locale: es })
                      : 'Seleccionar...'}
                  </span>
                </button>
              </div>

              {/* Month & Year Navigation */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 rounded-2xl border border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMonth(prev => subYears(prev, 1))}
                    className="px-2 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-[10px] font-black text-slate-400 hover:text-slate-700 dark:hover:text-white active:scale-95"
                    title="Año anterior"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMonth(prev => subMonths(prev, 1))}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                    title="Mes anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {safeFormat(viewMonth, 'MMMM yyyy', { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMonth(prev => addMonths(prev, 1))}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                    title="Mes siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMonth(prev => addYears(prev, 1))}
                    className="px-2 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-[10px] font-black text-slate-400 hover:text-slate-700 dark:hover:text-white active:scale-95"
                    title="Año siguiente"
                  >
                    »
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="select-none">
                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-1"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
                  {Array.from({ length: startDayOffset }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-10" />
                  ))}

                  {daysInMonth.map((day) => {
                    const iso = safeFormat(day, 'yyyy-MM-dd');
                    const isStart = iso === tempStart;
                    const isEnd = iso === tempEnd;
                    const isSelected = isStart || isEnd;
                    const isInRange = !!(tempStart && tempEnd && iso > tempStart && iso < tempEnd);
                    const isTodayDate = isToday(day);

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative h-10 flex flex-col items-center justify-center text-xs font-black transition-all active:scale-95",
                          isSelected
                            ? isRose
                              ? "bg-rose-600 text-white rounded-xl shadow-md shadow-rose-600/25 z-10"
                              : "bg-azul-blue text-white rounded-xl shadow-md shadow-azul-blue/25 z-10"
                            : isInRange
                              ? isRose
                                ? "bg-rose-500/15 text-rose-600 rounded-lg"
                                : "bg-azul-blue/15 text-azul-blue rounded-lg"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl",
                          isTodayDate && !isSelected && "ring-1 ring-inset ring-slate-300 dark:ring-slate-600"
                        )}
                      >
                        <span>{safeFormat(day, 'd')}</span>
                        {(isStart || isEnd) && (
                          <span className="text-[7px] font-black uppercase tracking-tighter leading-none opacity-90">
                            {isStart && isEnd ? '1d' : isStart ? 'Ini' : 'Fin'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info & Actions Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {selectedDaysCount > 0
                      ? `${selectedDaysCount} ${selectedDaysCount === 1 ? 'día seleccionado' : 'días seleccionados'}`
                      : tempStart
                        ? 'Ahora selecciona la fecha de fin'
                        : 'Selecciona la fecha de inicio'}
                  </span>
                  {(tempStart || tempEnd) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      <RotateCcw size={11} />
                      <span>Reiniciar</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!tempStart}
                    className={cn(
                      "flex-[1.5] py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:pointer-events-none",
                      isRose
                        ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                        : "bg-azul-blue hover:bg-azul-blue/90 shadow-azul-blue/20"
                    )}
                  >
                    <Check size={15} strokeWidth={3} />
                    <span>Confirmar Tramo</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
