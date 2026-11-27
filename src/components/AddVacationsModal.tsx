import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Pencil, 
  Umbrella, 
  Check, 
  RotateCcw
} from 'lucide-react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isToday, 
  isSameMonth, 
  parseISO, 
  isValid, 
  differenceInCalendarDays,
  getDate
} from 'date-fns';
import { es } from 'date-fns/locale';
import { DayShift, Settings, MixedRotationConfig, cn } from '../types';
import { safeFormat, getRotationShift, loadSavedMixedRotation, formatMixedRotationShortLabel } from '../utils';
import { MonthPickerModal } from './MonthPickerModal';
import { CustomRotationModal } from './CustomRotationModal';
import { useScrollLock } from '../hooks/useScrollLock';

interface AddVacationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  shifts: DayShift[];
  updateSettings: (s: Settings) => void;
  updateShifts: (shifts: DayShift[]) => void;
  updateShift?: (shift: DayShift) => void;
}

export const AddVacationsModal: React.FC<AddVacationsModalProps> = ({
  isOpen,
  onClose,
  settings,
  shifts,
  updateSettings,
  updateShifts,
  updateShift
}) => {
  useScrollLock(isOpen);

  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCustomRotationModalOpen, setIsCustomRotationModalOpen] = useState(false);
  const [customModalInitialMode, setCustomModalInitialMode] = useState<'simple' | 'mixed'>('simple');

  // Mode: 'range' (tramos) or 'single' (día suelto)
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('single');

  // Range state for 'range' mode
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  // Cycle & Rotation state, initialized from localStorage / settings so it persists across tabs
  const [cycleType, setCycleType] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('rotationCycleType');
      if (saved) return saved;
    } catch (e) {}
    return settings.calendarRotation?.type || '6x3';
  });

  const [selectedRotation, setSelectedRotation] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('selectedRotation');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 4) return parsed;
      }
    } catch (e) {}
    return 1;
  });

  // Custom rotation params
  const customWorkDays = settings?.customRotation?.workDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).workDays || 5;
    } catch (e) {}
    return 5;
  })();

  const customFreeDays = settings?.customRotation?.freeDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).freeDays || 2;
    } catch (e) {}
    return 2;
  })();

  const customFirstFreeDay = settings?.customRotation?.firstFreeDay || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).firstFreeDay || 1;
    } catch (e) {}
    return 1;
  })();

  const customAnchorDate = settings?.customRotation?.anchorDate || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).anchorDate;
    } catch (e) {}
    return undefined;
  })();

  const [mixedConfig, setMixedConfig] = useState<MixedRotationConfig>(() => loadSavedMixedRotation(settings, currentMonth));

  const hasSavedMixed = Boolean(
    settings?.mixedRotation ||
    settings?.calendarRotation?.mixedConfig ||
    (() => {
      try {
        return Boolean(localStorage.getItem('mixedRotationConfig'));
      } catch {
        return false;
      }
    })()
  );

  // Synchronize when opening or when storage changes across tabs
  useEffect(() => {
    if (isOpen) {
      setMixedConfig(loadSavedMixedRotation(settings, currentMonth));
      try {
        const savedCycle = localStorage.getItem('rotationCycleType');
        if (savedCycle) setCycleType(savedCycle);
        const savedRot = localStorage.getItem('selectedRotation');
        if (savedRot) {
          const parsed = parseInt(savedRot, 10);
          if (parsed >= 1 && parsed <= 4) setSelectedRotation(parsed);
        }
      } catch (e) {}
    }
  }, [isOpen, settings]);

  // Persist cycle and rotation changes so they match Herramientas, Turnos, and all other tabs
  const handleSelectCycle = (newCycle: string) => {
    setCycleType(newCycle);
    try {
      localStorage.setItem('rotationCycleType', newCycle);
    } catch (e) {}
    if (newCycle === '6x3' && selectedRotation === 4) {
      setSelectedRotation(1);
      try {
        localStorage.setItem('selectedRotation', '1');
      } catch (e) {}
    }
  };

  const handleSelectRotation = (newRot: number) => {
    setSelectedRotation(newRot);
    try {
      localStorage.setItem('selectedRotation', String(newRot));
    } catch (e) {}
  };

  // Available rotations for current cycle
  const availableRotations = useMemo(() => {
    if (cycleType === '6x3') return [1, 2, 3];
    if (cycleType === '4x4') return [1, 2, 3, 4];
    if (cycleType === 'mixed') return [1, 2, 3];
    const totalCycle = customWorkDays + customFreeDays;
    const maxRot = Math.max(2, Math.min(4, Math.floor(totalCycle / Math.max(1, customFreeDays)) || 2));
    return Array.from({ length: maxRot }, (_, i) => i + 1);
  }, [cycleType, customWorkDays, customFreeDays]);

  // Ensure selectedRotation stays within available bounds
  useEffect(() => {
    if (!availableRotations.includes(selectedRotation)) {
      handleSelectRotation(1);
    }
  }, [availableRotations, selectedRotation]);

  // Days in current month
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  // Vacation lookup set
  const vacationsSet = useMemo(() => new Set(settings.vacations || []), [settings.vacations]);

  // Handle toggling single day vacation
  const toggleVacationDay = (dateStr: string) => {
    const isCurrentlyVacation = vacationsSet.has(dateStr);

    if (isCurrentlyVacation) {
      // Remove
      const updated = (settings.vacations || []).filter(v => v !== dateStr);
      updateSettings({ ...settings, vacations: updated });

      const existingShift = shifts.find(s => s.date === dateStr);
      if (existingShift && existingShift.type === 'Vacaciones') {
        if (updateShift) {
          updateShift({ ...existingShift, type: 'Laboral' });
        } else {
          updateShifts(shifts.map(s => s.date === dateStr ? { ...s, type: 'Laboral' } : s));
        }
      }
    } else {
      // Add
      const updated = [...(settings.vacations || []), dateStr].sort();
      updateSettings({ ...settings, vacations: updated });

      const existingShift = shifts.find(s => s.date === dateStr);
      const newShift: DayShift = existingShift
        ? {
            ...existingShift,
            type: 'Vacaciones',
            shifts: (existingShift.shifts && existingShift.shifts.length > 0) ? existingShift.shifts : [{ start: '', end: '' }],
            extraShifts: existingShift.extraShifts || []
          }
        : {
            date: dateStr,
            type: 'Vacaciones',
            shifts: [{ start: '', end: '' }],
            perentorias: { day: 0, night: 0 },
            complementarias: { day: 0, night: 0 },
            extraShifts: []
          };

      if (updateShift) {
        updateShift(newShift);
      } else {
        const others = shifts.filter(s => s.date !== dateStr);
        updateShifts([...others, newShift]);
      }
    }
  };

  // Range selection logic
  const handleDayClick = (dayDate: Date) => {
    const dateStr = safeFormat(dayDate, 'yyyy-MM-dd');

    if (selectionMode === 'single') {
      toggleVacationDay(dateStr);
    } else {
      // Range mode
      if (!rangeStart || (rangeStart && rangeEnd)) {
        // Start picking new range
        setRangeStart(dateStr);
        setRangeEnd(null);
      } else {
        // We have start, now picking end
        if (dateStr < rangeStart) {
          // If clicked before start, make it the new start
          setRangeStart(dateStr);
          setRangeEnd(null);
        } else {
          setRangeEnd(dateStr);
        }
      }
    }
  };

  // Add range as vacations
  const handleApplyRange = () => {
    if (!rangeStart || !rangeEnd) return;

    const startObj = parseISO(rangeStart);
    const endObj = parseISO(rangeEnd);
    if (!isValid(startObj) || !isValid(endObj)) return;

    const intervalDays = eachDayOfInterval({ start: startObj, end: endObj });
    const newDates = intervalDays.map(d => safeFormat(d, 'yyyy-MM-dd'));

    const merged = Array.from(new Set([...(settings.vacations || []), ...newDates])).sort();
    updateSettings({ ...settings, vacations: merged });

    // Sync with shifts
    const updatedShifts = newDates.map(date => {
      const existing = shifts.find(s => s.date === date);
      if (existing) {
        return {
          ...existing,
          type: 'Vacaciones' as const,
          shifts: (existing.shifts && existing.shifts.length > 0) ? existing.shifts : [{ start: '', end: '' }],
          extraShifts: existing.extraShifts || []
        };
      }
      return {
        date,
        type: 'Vacaciones' as const,
        shifts: [{ start: '', end: '' }],
        perentorias: { day: 0, night: 0 },
        complementarias: { day: 0, night: 0 },
        extraShifts: []
      };
    });

    const datesMap = new Set(newDates);
    const untouched = shifts.filter(s => !datesMap.has(s.date));
    updateShifts([...untouched, ...updatedShifts]);

    // Reset range after applying
    setRangeStart(null);
    setRangeEnd(null);
  };

  const handleResetRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  // Computed range days count if both are selected
  const rangeDaysCount = useMemo(() => {
    if (!rangeStart || !rangeEnd) return 0;
    try {
      const s = parseISO(rangeStart);
      const e = parseISO(rangeEnd);
      if (isValid(s) && isValid(e)) {
        return differenceInCalendarDays(e, s) + 1;
      }
    } catch (err) {}
    return 0;
  }, [rangeStart, rangeEnd]);

  // Vacation count in current month
  const monthVacationsCount = useMemo(() => {
    return monthDays.filter(d => vacationsSet.has(safeFormat(d, 'yyyy-MM-dd'))).length;
  }, [monthDays, vacationsSet]);

  const viewYear = currentMonth.getFullYear();
  const yearVacationsCount = useMemo(() => {
    return (settings.vacations || []).filter(v => {
      const d = parseISO(v);
      return isValid(d) && d.getFullYear() === viewYear;
    }).length;
  }, [settings.vacations, viewYear]);

  // Handle saving custom rotation
  const handleSaveCustomRotation = (w: number, f: number, freeDay: number, anchorDate: string) => {
    const newCycle = `${w}x${f}`;
    handleSelectCycle(newCycle);
    const newConfig = { workDays: w, freeDays: f, firstFreeDay: freeDay, anchorDate };
    if (updateSettings && settings) {
      updateSettings({
        ...settings,
        customRotation: newConfig,
        calendarRotation: {
          enabled: settings.calendarRotation?.enabled ?? false,
          effectiveFromMonth: settings.calendarRotation?.effectiveFromMonth || safeFormat(currentMonth, 'yyyy-MM'),
          ...settings.calendarRotation,
          type: newCycle,
          workDays: w,
          freeDays: f,
          anchorDate,
          firstFreeDay: freeDay,
        }
      });
    }
    try {
      localStorage.setItem('customRotationConfig', JSON.stringify(newConfig));
      localStorage.setItem('rotationCycleType', newCycle);
    } catch (e) {}
  };

  const handleSaveMixedRotation = (newMixed: MixedRotationConfig) => {
    setMixedConfig(newMixed);
    handleSelectCycle('mixed');
    if (updateSettings && settings) {
      updateSettings({
        ...settings,
        mixedRotation: newMixed,
        calendarRotation: {
          enabled: settings.calendarRotation?.enabled ?? false,
          effectiveFromMonth: settings.calendarRotation?.effectiveFromMonth || safeFormat(currentMonth, 'yyyy-MM'),
          ...settings.calendarRotation,
          type: 'mixed',
          anchorDate: newMixed.firstAnchorDate,
          firstFreeDay: newMixed.firstFreeDay || 1,
          mixedConfig: newMixed,
        }
      });
    }
    try {
      localStorage.setItem('mixedRotationConfig', JSON.stringify(newMixed));
      localStorage.setItem('rotationCycleType', 'mixed');
    } catch (e) {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/15 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] text-slate-800 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header con estilo modo oscuro coordinado con #vacaciones-section */}
            <div className="p-4 sm:p-6 pb-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-azul-yellow/20 via-transparent to-azul-blue/5 dark:from-[#FFD700]/15 dark:via-transparent dark:to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-azul-blue dark:bg-[#020617] text-white dark:text-[#FFD700] border border-transparent dark:border-white/10 flex items-center justify-center shadow-md shrink-0">
                  <Umbrella size={22} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-[#FFD700] uppercase tracking-tight leading-tight">
                    Añadir Vacaciones
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-white/60">
                    Planifica tus descansos con el cuadrante de rotación en tiempo real
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-2xl text-slate-400 dark:text-white/50 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 active:scale-95"
                title="Cerrar"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 custom-scrollbar">

              {/* 1. SELECCIÓN DE CICLO Y ROTACIÓN */}
              <div className="bg-slate-50 dark:bg-[#020617]/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-white/90">
                      Ciclo y Rotación
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-white/40">
                      (Sincronizado entre todas las pestañas)
                    </span>
                  </div>
                </div>

                {/* Ciclos: 6x3, 4x4, Personalizado + Botón Lápiz */}
                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex bg-slate-200/60 dark:bg-[#0f172a] border border-slate-300/50 dark:border-white/10 rounded-full p-1 flex-1 select-none gap-0.5">
                    {(['6x3', '4x4'] as const).map((cycle) => {
                      const isSel = cycleType === cycle;
                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => handleSelectCycle(cycle)}
                          className={cn(
                            "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isSel 
                              ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] shadow-md font-black"
                              : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          {cycle.toUpperCase()}
                        </button>
                      );
                    })}

                    {/* Ciclo personalizado */}
                    {(() => {
                      const customLabel = `${customWorkDays}X${customFreeDays}`;
                      const isSel = cycleType === 'custom' || cycleType === `${customWorkDays}x${customFreeDays}`;
                      return (
                        <button
                          type="button"
                          onClick={() => handleSelectCycle(`${customWorkDays}x${customFreeDays}`)}
                          className={cn(
                            "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isSel 
                              ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] shadow-md font-black"
                              : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          {customLabel}
                        </button>
                      );
                    })()}

                    {/* Ciclo mixto */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasSavedMixed) {
                          setCustomModalInitialMode('mixed');
                          setIsCustomRotationModalOpen(true);
                        } else {
                          handleSelectCycle('mixed');
                        }
                      }}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                        cycleType === 'mixed'
                          ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md font-black"
                          : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title="Rotación mixta (ej. 5x2 y después 6x3)"
                    >
                      MIXTA
                    </button>
                  </div>

                  {/* Botón Lápiz para definir ciclo simple o mixto */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModalInitialMode(cycleType === 'mixed' ? 'mixed' : 'simple');
                      setIsCustomRotationModalOpen(true);
                    }}
                    className="p-2 sm:p-2.5 rounded-full bg-slate-200/70 dark:bg-[#0f172a] border border-slate-300/60 dark:border-white/10 text-slate-700 dark:text-[#FFD700] hover:bg-slate-300/70 dark:hover:bg-white/10 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Definir ciclo de rotación personalizado o mixto"
                    aria-label="Definir ciclo personalizado o mixto"
                  >
                    <Pencil size={14} className="stroke-[2.5]" />
                  </button>
                </div>

                {cycleType === 'mixed' && (
                  <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-700/60 rounded-xl px-3 py-1.5 text-[10px]">
                    <span className="font-bold text-indigo-800 dark:text-indigo-200">
                      Mixta: <strong>{formatMixedRotationShortLabel(mixedConfig)}</strong>
                      {mixedConfig.mode === 'by_date' && mixedConfig.switchDate
                        ? ` · Cambio el ${safeFormat(parseISO(mixedConfig.switchDate), 'dd/MM/yyyy')}`
                        : ' · Ciclo alterno'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomModalInitialMode('mixed');
                        setIsCustomRotationModalOpen(true);
                      }}
                      className="font-black uppercase text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer shrink-0"
                    >
                      Editar
                    </button>
                  </div>
                )}

                {/* Rotaciones: 1, 2, 3, 4 */}
                <div className="flex bg-slate-200/60 dark:bg-[#0f172a] border border-slate-300/50 dark:border-white/10 rounded-full p-1 w-full select-none gap-0.5">
                  {availableRotations.map((rot) => {
                    const isSel = selectedRotation === rot;
                    return (
                      <button
                        key={rot}
                        type="button"
                        onClick={() => handleSelectRotation(rot)}
                        className={cn(
                          "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                          isSel 
                            ? "bg-slate-800 dark:bg-white/20 text-white dark:text-[#FFD700] border dark:border-white/20 shadow-sm font-black"
                            : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        ROTACIÓN {rot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. SELECTOR DE MODO (TRAMO / DÍA SUELTO) */}
              <div className="flex p-1 bg-slate-100 dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-white/10 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode('single');
                    handleResetRange();
                  }}
                  className={cn(
                    "flex-1 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    selectionMode === 'single'
                      ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] shadow-md font-black"
                      : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
                  )}
                >
                  <span>👆 Día Suelto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('range')}
                  className={cn(
                    "flex-1 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    selectionMode === 'range'
                      ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] shadow-md font-black"
                      : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
                  )}
                >
                  <span>📅 Tramo / Rango</span>
                </button>
              </div>

              {/* Helper banner for Range Mode */}
              {selectionMode === 'range' && (
                <div className="bg-azul-blue/10 dark:bg-[#020617] border border-azul-blue/30 dark:border-[#FFD700]/30 rounded-2xl p-3 sm:p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-azul-blue dark:text-white font-bold">
                    <span>
                      {!rangeStart && "1. Pulsa en el día de inicio de tus vacaciones"}
                      {rangeStart && !rangeEnd && `Inicio: ${safeFormat(parseISO(rangeStart), 'dd/MM/yyyy')} · Ahora pulsa el día de fin`}
                      {rangeStart && rangeEnd && `Tramo: ${safeFormat(parseISO(rangeStart), 'dd/MM/yyyy')} al ${safeFormat(parseISO(rangeEnd), 'dd/MM/yyyy')} (${rangeDaysCount} ${rangeDaysCount === 1 ? 'día' : 'días'})`}
                    </span>
                    {rangeStart && (
                      <button
                        type="button"
                        onClick={handleResetRange}
                        className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        Reiniciar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 3. CALENDARIO MES A MES (IGUAL QUE 'CALENDARIO DE ROTACIONES') */}
              <div className="space-y-3">
                {/* Barra de navegación de Mes */}
                <div className="flex justify-center items-center gap-2 select-none">
                  <div className="flex items-center bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-white/10 rounded-full p-1 w-full max-w-[280px] sm:max-w-[320px] justify-between shadow-xs">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                      className="p-2 sm:p-2.5 text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-full transition-all duration-200 cursor-pointer active:scale-95"
                      title="Mes anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsMonthPickerOpen(true)}
                      className="px-2 sm:px-4 py-1.5 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 flex items-center justify-center flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="font-black text-[#0f172a] dark:text-white uppercase tracking-tight leading-none text-xs sm:text-sm truncate w-full text-center">
                        {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                      className="p-2 sm:p-2.5 text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-full transition-all duration-200 cursor-pointer active:scale-95"
                      title="Mes siguiente"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {!isSameMonth(currentMonth, new Date()) && (
                      <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        type="button"
                        onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                        className="pointer-events-auto flex flex-col items-center justify-center bg-white dark:bg-[#020617] text-azul-blue dark:text-[#FFD700] shadow-md rounded-full border border-azul-blue dark:border-[#FFD700]/40 transition-all hover:bg-azul-blue/5 dark:hover:bg-white/10 active:scale-95 shrink-0 select-none font-black leading-none w-10 h-10 cursor-pointer"
                        title="Volver al mes actual"
                      >
                        <span className="leading-none text-[14px]">📅</span>
                        <span className="text-[6.5px] font-black tracking-tighter leading-none mt-0.5">HOY</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Cabecera Días de la Semana */}
                <div className="grid grid-cols-7 text-center pb-1 text-slate-400 dark:text-white/50 text-[11px] font-extrabold uppercase tracking-wider select-none">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                {/* Cuadrícula de Días */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 select-none">
                  {/* Celdas vacías iniciales */}
                  {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Días del mes */}
                  {monthDays.map(day => {
                    const dateStr = safeFormat(day, 'yyyy-MM-dd');
                    const dayNum = getDate(day);
                    const isTodayDay = isToday(day);

                    // Rotation shift (M / T / L)
                    const rotShift = getRotationShift(day, selectedRotation, cycleType, {
                      workDays: customWorkDays,
                      freeDays: customFreeDays,
                      anchorDate: customAnchorDate,
                      firstFreeDay: customFirstFreeDay,
                      mixedConfig,
                    });

                    // Is this day marked as vacation?
                    const isVacation = vacationsSet.has(dateStr);

                    // Range selection highlights
                    const isRangeStart = rangeStart === dateStr;
                    const isRangeEnd = rangeEnd === dateStr;
                    const isInRange = rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "aspect-square rounded-xl sm:rounded-2xl p-1 sm:p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer relative overflow-hidden border active:scale-95",
                          // Vacation styling (highest priority)
                          isVacation
                            ? "bg-amber-400 dark:bg-[#FFD700] text-slate-900 dark:text-[#0f172a] border-amber-500 dark:border-[#FFD700] shadow-md shadow-amber-400/25 ring-2 ring-amber-400/60 font-black"
                            : isInRange
                              ? "bg-azul-blue/20 dark:bg-[#FFD700]/20 text-azul-blue dark:text-[#FFD700] border-azul-blue/50 dark:border-[#FFD700]/50"
                              : isRangeStart || isRangeEnd
                                ? "bg-azul-blue dark:bg-[#FFD700] text-white dark:text-[#0f172a] border-azul-blue dark:border-[#FFD700] ring-2 ring-azul-blue/60 font-black shadow-md"
                                : rotShift === 'L'
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-300 hover:border-emerald-500 shadow-xs font-bold"
                                  : "bg-white dark:bg-[#020617]/70 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300 dark:hover:border-white/25"
                        )}
                        title={
                          isVacation 
                            ? `Día ${dayNum}: Vacaciones asignadas (Libranza habitual: ${rotShift === 'L' ? 'Sí' : 'No'})`
                            : rotShift === 'L'
                              ? `Día ${dayNum}: Día Libre (Libranza)`
                              : `Día ${dayNum}: Día Laboral`
                        }
                      >
                        {/* Indicador de HOY */}
                        {isTodayDay && (
                          <div className={cn(
                            "absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
                            isVacation ? "bg-slate-900 dark:bg-[#0f172a]" : "bg-azul-blue dark:bg-[#FFD700]"
                          )} />
                        )}

                        {/* Número del día */}
                        <span className={cn(
                          "text-xs sm:text-sm font-black leading-none",
                          isVacation 
                            ? "text-slate-900 dark:text-[#0f172a]" 
                            : isRangeStart || isRangeEnd 
                              ? "text-white dark:text-[#0f172a]" 
                              : rotShift === 'L' 
                                ? "text-emerald-700 dark:text-emerald-300 font-black" 
                                : "text-slate-700 dark:text-white/80"
                        )}>
                          {dayNum}
                        </span>

                        {/* Distintivo: Solo para Vacaciones y Días Libres (L) */}
                        <div className="w-full flex items-center justify-center min-h-[16px]">
                          {isVacation ? (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase px-1 py-0.2 rounded-md bg-slate-900 dark:bg-[#0f172a] text-amber-300 dark:text-[#FFD700] tracking-tighter leading-tight">
                              VAC
                            </span>
                          ) : rotShift === 'L' ? (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md leading-tight bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              L
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-[#020617] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-white/70">
                <span className="bg-amber-100 dark:bg-[#FFD700]/15 text-amber-800 dark:text-[#FFD700] border border-amber-300/50 dark:border-[#FFD700]/30 px-2.5 py-1 rounded-full text-[10px] font-black">
                  {monthVacationsCount} {monthVacationsCount === 1 ? 'día en este mes' : 'días en este mes'}
                </span>
                <span className="text-slate-400 dark:text-white/30">·</span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-white/70">
                  Total {viewYear}: <strong className="text-slate-800 dark:text-[#FFD700] font-black">{yearVacationsCount} días</strong>
                </span>
              </div>

              {/* Botón Confirmar y Añadir Tramo (sin botón Listo) */}
              {selectionMode === 'range' && rangeStart && rangeEnd && (
                <button
                  type="button"
                  onClick={handleApplyRange}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ml-auto"
                >
                  <Check size={16} className="stroke-[3]" />
                  <span>Confirmar y Añadir Tramo ({rangeDaysCount} {rangeDaysCount === 1 ? 'día' : 'días'})</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* Month Picker Modal */}
          <MonthPickerModal
            isOpen={isMonthPickerOpen}
            onClose={() => setIsMonthPickerOpen(false)}
            currentMonth={currentMonth}
            onSelectMonth={(newMonth) => {
              setCurrentMonth(newMonth);
              setIsMonthPickerOpen(false);
            }}
          />

          {/* Custom Rotation Modal (Lápiz) */}
          <CustomRotationModal
            isOpen={isCustomRotationModalOpen}
            onClose={() => setIsCustomRotationModalOpen(false)}
            initialWorkDays={customWorkDays}
            initialFreeDays={customFreeDays}
            initialFirstFreeDay={customFirstFreeDay}
            initialMode={customModalInitialMode}
            initialMixedConfig={mixedConfig}
            currentMonth={currentMonth}
            onSave={handleSaveCustomRotation}
            onSaveMixed={handleSaveMixedRotation}
          />
        </div>
      )}
    </AnimatePresence>
  );
};
