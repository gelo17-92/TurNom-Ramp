import React, { useState, useEffect, useMemo } from 'react';
import { X, Pencil, Check, Plus, Minus, Sparkles, ArrowRight, Repeat, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDate, setDate, differenceInCalendarDays, addDays, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, MixedRotationConfig } from '../types';
import { safeFormat, getMixedRotationDayShift } from '../utils';

interface CustomRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWorkDays?: number;
  initialFreeDays?: number;
  initialFirstFreeDay?: number;
  initialMode?: 'simple' | 'mixed';
  initialMixedConfig?: MixedRotationConfig;
  currentMonth?: Date;
  onSave: (workDays: number, freeDays: number, firstFreeDay: number, anchorDate: string) => void;
  onSaveMixed?: (mixedConfig: MixedRotationConfig) => void;
}

export const CustomRotationModal: React.FC<CustomRotationModalProps> = ({
  isOpen,
  onClose,
  initialWorkDays = 5,
  initialFreeDays = 2,
  initialFirstFreeDay = 1,
  initialMode = 'simple',
  initialMixedConfig,
  currentMonth,
  onSave,
  onSaveMixed,
}) => {
  const monthDate = useMemo(() => currentMonth || new Date(), [currentMonth]);
  const daysInMonthCount = getDate(endOfMonth(monthDate));
  const monthName = safeFormat(monthDate, 'MMMM', { locale: es });

  const [tabMode, setTabMode] = useState<'simple' | 'mixed'>(initialMode);

  // Simple cycle state
  const [workDays, setWorkDays] = useState<number>(initialWorkDays || 5);
  const [freeDays, setFreeDays] = useState<number>(initialFreeDays || 2);
  const [firstFreeDay, setFirstFreeDay] = useState<number>(initialFirstFreeDay || 1);

  // Mixed cycle state
  const [mixedMode, setMixedMode] = useState<'by_date' | 'alternating'>(initialMixedConfig?.mode || 'by_date');
  const [firstWorkDays, setFirstWorkDays] = useState<number>(initialMixedConfig?.firstWorkDays || 5);
  const [firstFreeDays, setFirstFreeDays] = useState<number>(initialMixedConfig?.firstFreeDays || 2);
  const [secondWorkDays, setSecondWorkDays] = useState<number>(initialMixedConfig?.secondWorkDays || 6);
  const [secondFreeDays, setSecondFreeDays] = useState<number>(initialMixedConfig?.secondFreeDays || 3);
  const [mixedFirstFreeDay, setMixedFirstFreeDay] = useState<number>(initialMixedConfig?.firstFreeDay || 1);
  const [mixedFirstAnchorDate, setMixedFirstAnchorDate] = useState<string>(() => {
    if (initialMixedConfig?.firstAnchorDate) return initialMixedConfig.firstAnchorDate;
    return safeFormat(startOfMonth(monthDate), 'yyyy-MM-dd');
  });
  const [switchDate, setSwitchDate] = useState<string>(() => {
    if (initialMixedConfig?.switchDate) return initialMixedConfig.switchDate;
    return safeFormat(addDays(startOfMonth(monthDate), 14), 'yyyy-MM-dd');
  });
  const [secondStartsWith, setSecondStartsWith] = useState<'work' | 'free'>(initialMixedConfig?.secondStartsWith || 'work');
  const [secondAnchorDate, setSecondAnchorDate] = useState<string>(initialMixedConfig?.secondAnchorDate || '');

  useEffect(() => {
    if (isOpen) {
      setTabMode(initialMode);
      setWorkDays(initialWorkDays > 0 ? initialWorkDays : 5);
      setFreeDays(initialFreeDays > 0 ? initialFreeDays : 2);
      setFirstFreeDay(initialFirstFreeDay >= 1 && initialFirstFreeDay <= daysInMonthCount ? initialFirstFreeDay : 1);

      const defaultAnchor = safeFormat(setDate(startOfMonth(monthDate), Math.min(Math.max(1, initialFirstFreeDay || 1), daysInMonthCount)), 'yyyy-MM-dd');
      const defaultSwitch = safeFormat(addDays(startOfMonth(monthDate), Math.min(14, daysInMonthCount - 1)), 'yyyy-MM-dd');

      if (initialMixedConfig) {
        setMixedMode(initialMixedConfig.mode || 'by_date');
        setFirstWorkDays(initialMixedConfig.firstWorkDays || 5);
        setFirstFreeDays(initialMixedConfig.firstFreeDays || 2);
        setSecondWorkDays(initialMixedConfig.secondWorkDays || 6);
        setSecondFreeDays(initialMixedConfig.secondFreeDays || 3);
        const anchorStr = initialMixedConfig.firstAnchorDate || defaultAnchor;
        setMixedFirstAnchorDate(anchorStr);
        const parsedA = parseISO(anchorStr);
        setMixedFirstFreeDay(isValid(parsedA) ? getDate(parsedA) : (initialMixedConfig.firstFreeDay || 1));
        setSwitchDate(initialMixedConfig.switchDate || defaultSwitch);
        setSecondStartsWith(initialMixedConfig.secondStartsWith || 'work');
        setSecondAnchorDate(initialMixedConfig.secondAnchorDate || '');
      } else {
        setMixedMode('by_date');
        setFirstWorkDays(5);
        setFirstFreeDays(2);
        setSecondWorkDays(6);
        setSecondFreeDays(3);
        setMixedFirstAnchorDate(defaultAnchor);
        setMixedFirstFreeDay(Math.min(Math.max(1, initialFirstFreeDay || 1), daysInMonthCount));
        setSwitchDate(defaultSwitch);
        setSecondStartsWith('work');
        setSecondAnchorDate('');
      }
    }
  }, [isOpen, initialMode, initialWorkDays, initialFreeDays, initialFirstFreeDay, initialMixedConfig, daysInMonthCount, monthDate]);

  const draftMixedConfig: MixedRotationConfig = useMemo(() => ({
    mode: mixedMode,
    firstWorkDays: Math.max(1, Math.min(30, firstWorkDays)),
    firstFreeDays: Math.max(1, Math.min(30, firstFreeDays)),
    firstAnchorDate: mixedFirstAnchorDate,
    firstFreeDay: mixedFirstFreeDay,
    secondWorkDays: Math.max(1, Math.min(30, secondWorkDays)),
    secondFreeDays: Math.max(1, Math.min(30, secondFreeDays)),
    switchDate: mixedMode === 'by_date' ? switchDate : undefined,
    secondStartsWith: mixedMode === 'by_date' ? secondStartsWith : undefined,
    secondAnchorDate: mixedMode === 'by_date' && secondAnchorDate ? secondAnchorDate : undefined,
  }), [mixedMode, firstWorkDays, firstFreeDays, mixedFirstAnchorDate, mixedFirstFreeDay, secondWorkDays, secondFreeDays, switchDate, secondStartsWith, secondAnchorDate]);

  // Computed free days in the month according to the selected firstFreeDay and cycle (simple mode)
  const computedFreeDaysInMonth = useMemo(() => {
    const cycleLen = workDays + freeDays;
    const safeAnchorDay = Math.min(Math.max(1, firstFreeDay), daysInMonthCount);
    const anchorDateObj = setDate(startOfMonth(monthDate), safeAnchorDay);

    const daysOfMonth = eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });

    const freeDaysList: number[] = [];
    daysOfMonth.forEach((d) => {
      const diff = differenceInCalendarDays(d, anchorDateObj);
      const cycleIdx = ((diff % cycleLen) + cycleLen) % cycleLen;
      if (cycleIdx < freeDays) {
        freeDaysList.push(getDate(d));
      }
    });

    return freeDaysList;
  }, [workDays, freeDays, firstFreeDay, monthDate, daysInMonthCount]);

  // Computed shifts in the month for mixed mode
  const computedMixedDaysInMonth = useMemo(() => {
    const daysOfMonth = eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });

    return daysOfMonth.map((d) => {
      const dateStr = safeFormat(d, 'yyyy-MM-dd');
      const shift = getMixedRotationDayShift(d, draftMixedConfig, 1);
      const isPhase2 = draftMixedConfig.mode === 'by_date' && Boolean(draftMixedConfig.switchDate) && dateStr >= (draftMixedConfig.switchDate || '');
      const isSwitchDay = draftMixedConfig.mode === 'by_date' && dateStr === draftMixedConfig.switchDate;
      return {
        dayNum: getDate(d),
        dateStr,
        shift,
        isPhase2,
        isSwitchDay,
      };
    });
  }, [monthDate, draftMixedConfig]);

  const mixedFreeCountInMonth = useMemo(
    () => computedMixedDaysInMonth.filter((d) => d.shift === 'L').length,
    [computedMixedDaysInMonth]
  );

  if (!isOpen) return null;

  const totalCycleDays = workDays + freeDays;
  const morningDays = Math.ceil(workDays / 2);
  const afternoonDays = Math.floor(workDays / 2);

  const handleSave = () => {
    if (tabMode === 'mixed' && onSaveMixed) {
      onSaveMixed(draftMixedConfig);
      onClose();
      return;
    }

    const validWork = Math.max(1, Math.min(30, workDays));
    const validFree = Math.max(1, Math.min(30, freeDays));
    const validFirstDay = Math.min(Math.max(1, firstFreeDay), daysInMonthCount);
    const anchorDateObj = setDate(startOfMonth(monthDate), validFirstDay);
    const anchorDateStr = safeFormat(anchorDateObj, 'yyyy-MM-dd');

    onSave(validWork, validFree, validFirstDay, anchorDateStr);
    onClose();
  };

  const SIMPLE_PRESETS: { label: string; work: number; free: number }[] = [
    { label: '5x2', work: 5, free: 2 },
    { label: '6x2', work: 6, free: 2 },
    { label: '4x2', work: 4, free: 2 },
    { label: '7x3', work: 7, free: 3 },
    { label: '3x3', work: 3, free: 3 },
    { label: '5x3', work: 5, free: 3 },
  ];

  const MIXED_PRESETS: { label: string; w1: number; f1: number; w2: number; f2: number }[] = [
    { label: '5x2 → 6x3', w1: 5, f1: 2, w2: 6, f2: 3 },
    { label: '6x3 → 4x4', w1: 6, f1: 3, w2: 4, f2: 4 },
    { label: '4x4 → 6x3', w1: 4, f1: 4, w2: 6, f2: 3 },
    { label: '5x2 → 4x4', w1: 5, f1: 2, w2: 4, f2: 4 },
  ];

  const handleMixedDayClick = (dayNum: number, dateStr: string) => {
    if (mixedMode === 'by_date' && switchDate && dateStr >= switchDate) {
      setSecondAnchorDate(dateStr);
    } else {
      setMixedFirstFreeDay(dayNum);
      setMixedFirstAnchorDate(dateStr);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.25rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="h-1.5 bg-gradient-to-r from-azul-blue via-emerald-500 to-azul-yellow shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-azul-blue text-white shadow-md shadow-azul-blue/25 shrink-0">
              <Pencil size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Definir Ciclo de Rotación
              </h2>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-400">
                Configura un ciclo simple o combina dos rotaciones (mixta)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer active:scale-95"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Mode Switcher: Simple vs Mixta */}
          {onSaveMixed && (
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-1 gap-1 select-none">
              <button
                type="button"
                onClick={() => setTabMode('simple')}
                className={cn(
                  "py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                  tabMode === 'simple'
                    ? "bg-[#0f172a] dark:bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                Ciclo Simple
              </button>
              <button
                type="button"
                onClick={() => setTabMode('mixed')}
                className={cn(
                  "py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
                  tabMode === 'mixed'
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Repeat size={13} />
                <span>Rotación Mixta</span>
              </button>
            </div>
          )}

          {tabMode === 'simple' ? (
            <>
              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Plantillas rápidas habituales:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {SIMPLE_PRESETS.map((p) => {
                    const isActive = workDays === p.work && freeDays === p.free;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setWorkDays(p.work);
                          setFreeDays(p.free);
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border text-center active:scale-95",
                          isActive
                            ? "bg-azul-blue text-white border-azul-blue shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Steppers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Días de Trabajo */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Días de Trabajo
                    </span>
                    <span className="text-[10px] font-bold text-azul-blue dark:text-sky-400">
                      Turnos (M/T)
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setWorkDays((prev) => Math.max(1, prev - 1))}
                      disabled={workDays <= 1}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                      aria-label="Restar día de trabajo"
                    >
                      <Minus size={14} />
                    </button>

                    <div className="flex-1 text-center">
                      <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {workDays}
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-400 block -mt-1">
                        {workDays === 1 ? 'día' : 'días'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWorkDays((prev) => Math.min(30, prev + 1))}
                      disabled={workDays >= 30}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                      aria-label="Sumar día de trabajo"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Días Libres */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-tight">
                      Días Libres
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Libranzas (L)
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setFreeDays((prev) => Math.max(1, prev - 1))}
                      disabled={freeDays <= 1}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-center hover:bg-emerald-100/50 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                      aria-label="Restar día libre"
                    >
                      <Minus size={14} />
                    </button>

                    <div className="flex-1 text-center">
                      <span className="text-xl font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                        {freeDays}
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-600/70 dark:text-emerald-400/70 block -mt-1">
                        {freeDays === 1 ? 'día' : 'días'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFreeDays((prev) => Math.min(30, prev + 1))}
                      disabled={freeDays >= 30}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-center hover:bg-emerald-100/50 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                      aria-label="Sumar día libre"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* SECCIÓN CLAVE: SELECCIONAR EL PRIMER DÍA LIBRE */}
              <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Selecciona el primer bloque de libranza de{' '}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {monthName}
                      </span>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {computedFreeDaysInMonth.length} libranzas en el mes
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                    Pulsa en el día donde comienza tu primera libranza:
                  </span>
                  <div className="grid grid-cols-7 gap-1 text-center select-none pt-1">
                    {Array.from({ length: daysInMonthCount }, (_, i) => i + 1).map((dayNum) => {
                      const isAnchor = firstFreeDay === dayNum;
                      const isFree = computedFreeDaysInMonth.includes(dayNum);
                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => setFirstFreeDay(dayNum)}
                          className={cn(
                            "py-1.5 sm:py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer relative",
                            isAnchor
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500 scale-105 z-10"
                              : isFree
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100"
                                : "bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-750"
                          )}
                          title={
                            isAnchor
                              ? `Día ${dayNum}: Inicio de la primera libranza`
                              : isFree
                                ? `Día ${dayNum}: Libranza calculada del ciclo`
                                : `Día ${dayNum}: Día de trabajo`
                          }
                        >
                          {isAnchor && (
                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-300" />
                          )}
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  Los días en verde representan tus libranzas calculadas. Al guardar, el ciclo se <strong>prolongará automáticamente a todos los meses siguientes</strong> a partir de esta fecha de referencia.
                </p>
              </div>

              {/* Dynamic Cycle Preview Sequence */}
              <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-azul-yellow" />
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      Secuencia del ciclo {workDays}x{freeDays}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-azul-blue/10 text-azul-blue dark:bg-sky-950/50 dark:text-sky-300 border border-azul-blue/20">
                    {totalCycleDays} días por vuelta
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 select-none">
                  {Array.from({ length: freeDays }).map((_, i) => (
                    <div
                      key={`l-${i}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500 text-white flex flex-col items-center justify-center shadow-xs"
                      title={`Día ${i + 1}: Libranza (L)`}
                    >
                      <span className="text-[9.5px] font-black leading-none">L</span>
                      <span className="text-[7px] font-bold opacity-90 leading-none">{i + 1}</span>
                    </div>
                  ))}
                  {Array.from({ length: morningDays }).map((_, i) => (
                    <div
                      key={`m-${i}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center shadow-2xs"
                      title={`Día ${freeDays + i + 1}: Turno de Mañana (M)`}
                    >
                      <span className="text-[9.5px] font-black leading-none">M</span>
                      <span className="text-[7px] font-bold opacity-70 leading-none">{freeDays + i + 1}</span>
                    </div>
                  ))}
                  {Array.from({ length: afternoonDays }).map((_, i) => (
                    <div
                      key={`t-${i}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 flex flex-col items-center justify-center shadow-2xs"
                      title={`Día ${freeDays + morningDays + i + 1}: Turno de Tarde (T)`}
                    >
                      <span className="text-[9.5px] font-black leading-none">T</span>
                      <span className="text-[7px] font-bold opacity-70 leading-none">{freeDays + morningDays + i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ======================== ROTACIÓN MIXTA ======================== */
            <>
              {/* Tipo de combinación mixta */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Cómo combinar las dos rotaciones:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMixedMode('by_date')}
                    className={cn(
                      "p-2.5 rounded-2xl border text-left transition-all cursor-pointer",
                      mixedMode === 'by_date'
                        ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/50"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300">
                      <Calendar size={13} />
                      <span>Por fecha (Tramos)</span>
                    </div>
                    <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Empieza en {firstWorkDays}x{firstFreeDays} y cambia a {secondWorkDays}x{secondFreeDays} desde una fecha.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMixedMode('alternating')}
                    className={cn(
                      "p-2.5 rounded-2xl border text-left transition-all cursor-pointer",
                      mixedMode === 'alternating'
                        ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/50"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300">
                      <Repeat size={13} />
                      <span>Alterno (En bucle)</span>
                    </div>
                    <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Alterna {firstWorkDays}x{firstFreeDays} y {secondWorkDays}x{secondFreeDays} de forma continua.
                    </p>
                  </button>
                </div>
              </div>

              {/* Plantillas Mixtas Rápidas */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Combinaciones rápidas:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {MIXED_PRESETS.map((p) => {
                    const isActive =
                      firstWorkDays === p.w1 &&
                      firstFreeDays === p.f1 &&
                      secondWorkDays === p.w2 &&
                      secondFreeDays === p.f2;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setFirstWorkDays(p.w1);
                          setFirstFreeDays(p.f1);
                          setSecondWorkDays(p.w2);
                          setSecondFreeDays(p.f2);
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border text-center active:scale-95",
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {mixedMode === 'alternating' ? p.label.replace(' → ', ' + ') : p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fase 1 y Fase 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fase 1 */}
                <div className="bg-sky-50/70 dark:bg-sky-950/25 p-3.5 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-sky-900 dark:text-sky-200">
                      1ª Rotación
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-600 text-white">
                      {firstWorkDays}x{firstFreeDays}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2 border border-sky-100 dark:border-sky-900/50">
                      <span className="text-[9px] font-black uppercase text-slate-500 block text-center">Trabajo</span>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => setFirstWorkDays((v) => Math.max(1, v - 1))}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">{firstWorkDays}</span>
                        <button
                          type="button"
                          onClick={() => setFirstWorkDays((v) => Math.min(30, v + 1))}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2 border border-emerald-100 dark:border-emerald-900/50">
                      <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 block text-center">Libres</span>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => setFirstFreeDays((v) => Math.max(1, v - 1))}
                          className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{firstFreeDays}</span>
                        <button
                          type="button"
                          onClick={() => setFirstFreeDays((v) => Math.min(30, v + 1))}
                          className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fase 2 */}
                <div className="bg-indigo-50/70 dark:bg-indigo-950/25 p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-200">
                      2ª Rotación
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                      {secondWorkDays}x{secondFreeDays}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2 border border-indigo-100 dark:border-indigo-900/50">
                      <span className="text-[9px] font-black uppercase text-slate-500 block text-center">Trabajo</span>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => setSecondWorkDays((v) => Math.max(1, v - 1))}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">{secondWorkDays}</span>
                        <button
                          type="button"
                          onClick={() => setSecondWorkDays((v) => Math.min(30, v + 1))}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2 border border-emerald-100 dark:border-emerald-900/50">
                      <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 block text-center">Libres</span>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => setSecondFreeDays((v) => Math.max(1, v - 1))}
                          className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{secondFreeDays}</span>
                        <button
                          type="button"
                          onClick={() => setSecondFreeDays((v) => Math.min(30, v + 1))}
                          className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fecha de cambio (solo en modo Por fecha) */}
              {mixedMode === 'by_date' && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/50 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 block mb-1">
                        Fecha inicio 2ª rotación ({secondWorkDays}x{secondFreeDays}):
                      </label>
                      <input
                        type="date"
                        value={switchDate}
                        onChange={(e) => {
                          setSwitchDate(e.target.value);
                          setSecondAnchorDate('');
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 text-xs font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 block mb-1">
                        Ese día empieza:
                      </span>
                      <div className="grid grid-cols-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-0.5 gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSecondStartsWith('work');
                            setSecondAnchorDate('');
                          }}
                          className={cn(
                            "py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer",
                            secondStartsWith === 'work' && !secondAnchorDate
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          Trabajando
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSecondStartsWith('free');
                            setSecondAnchorDate('');
                          }}
                          className={cn(
                            "py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer",
                            secondStartsWith === 'free' && !secondAnchorDate
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          Librando
                        </button>
                      </div>
                    </div>
                  </div>
                  {secondAnchorDate && (
                    <div className="flex items-center justify-between text-[10px] bg-white/80 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-indigo-200/70 dark:border-indigo-800/50">
                      <span className="font-bold text-indigo-800 dark:text-indigo-300">
                        1er día libre de la 2ª rotación fijado: <strong>{safeFormat(parseISO(secondAnchorDate), 'dd/MM/yyyy')}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSecondAnchorDate('')}
                        className="text-[9.5px] font-black uppercase text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Automático
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Vista previa mensual interactiva */}
              <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    Vista previa de{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{monthName}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {mixedFreeCountInMonth} libranzas en el mes
                  </span>
                </div>

                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                  {mixedMode === 'by_date'
                    ? 'Pulsa un día para fijar el 1er día libre del tramo correspondiente:'
                    : 'Pulsa en el día donde comienza la 1ª libranza del ciclo alterno:'}
                </span>

                <div className="grid grid-cols-7 gap-1 text-center select-none pt-0.5">
                  {computedMixedDaysInMonth.map(({ dayNum, dateStr, shift, isPhase2, isSwitchDay }) => {
                    const isAnchor1 = dateStr === mixedFirstAnchorDate;
                    const isAnchor2 = mixedMode === 'by_date' && secondAnchorDate === dateStr;
                    const isFree = shift === 'L';
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleMixedDayClick(dayNum, dateStr)}
                        className={cn(
                          "py-1.5 sm:py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer relative",
                          isAnchor1 || isAnchor2
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500 scale-105 z-10"
                            : isFree
                              ? isPhase2
                                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-indigo-400/70 dark:border-indigo-500/70"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60"
                              : isPhase2
                                ? "bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/70"
                                : "bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750"
                        )}
                        title={
                          isSwitchDay
                            ? `Día ${dayNum}: Inicio 2ª rotación (${secondWorkDays}x${secondFreeDays}) · ${shift === 'L' ? 'Libre' : shift === 'M' ? 'Mañana' : 'Tarde'}`
                            : `Día ${dayNum}: ${isPhase2 ? `2ª Rotación (${secondWorkDays}x${secondFreeDays})` : `1ª Rotación (${firstWorkDays}x${firstFreeDays})`} · ${shift === 'L' ? 'Libre' : shift === 'M' ? 'Mañana' : 'Tarde'}`
                        }
                      >
                        {(isAnchor1 || isAnchor2) && (
                          <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-300" />
                        )}
                        {isSwitchDay && (
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-300" />
                        )}
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {mixedMode === 'by_date' && (
                  <div className="flex flex-wrap items-center gap-3 text-[9.5px] font-bold text-slate-500 dark:text-slate-400 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 border border-slate-300 inline-block" />
                      1ª: {firstWorkDays}x{firstFreeDays}
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 dark:bg-indigo-900 border border-indigo-400 inline-block" />
                      2ª: {secondWorkDays}x{secondFreeDays}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                      Libranza
                    </span>
                  </div>
                )}
              </div>

              {/* Resumen visual de secuencia mixta */}
              <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1">
                      <span>{firstWorkDays}x{firstFreeDays}</span>
                      <ArrowRight size={12} className="text-indigo-500" />
                      <span>{secondWorkDays}x{secondFreeDays}</span>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {mixedMode === 'alternating'
                      ? `${firstWorkDays + firstFreeDays + secondWorkDays + secondFreeDays} días por ciclo alterno`
                      : `Cambio el ${switchDate ? safeFormat(parseISO(switchDate), 'dd/MM/yyyy') : '-'}`}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer",
              tabMode === 'mixed'
                ? "bg-indigo-600 shadow-indigo-600/25 hover:bg-indigo-700"
                : "bg-azul-blue shadow-azul-blue/25 hover:bg-azul-blue/90"
            )}
          >
            <Check size={14} strokeWidth={3} />
            <span>Guardar y Aplicar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
