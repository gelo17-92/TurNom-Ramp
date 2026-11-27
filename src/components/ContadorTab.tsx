import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Trash2,
  Lock
} from 'lucide-react';
import { parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, DayShift, Settings, YearlyPluses, PlusesData, SharedQuadrantInfo } from '../types';
import { LocalInput } from './LocalInput';
import { DateRangePickerModal } from './DateRangePickerModal';
import { ConfirmModal } from './ConfirmModal';
import { getStatsForShifts, safeFormat, getCounterConfigForYear } from '../utils';
import { TutorialModal, TutorialStep } from './TutorialModal';

interface ContadorTabProps {
  shifts: DayShift[];
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  pluses: YearlyPluses;
  activeSharedOwner?: SharedQuadrantInfo | null;
}

export const ContadorTab = ({
  shifts,
  settings,
  updateSettings,
  pluses,
  activeSharedOwner
}: ContadorTabProps) => {
  const isLocked = !!activeSharedOwner?.isLocked;
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [periodPickerStep, setPeriodPickerStep] = useState<'start' | 'end' | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Horas Contratadas (Progreso)",
      badge: "Metas",
      icon: <Clock size={22} />,
      color: "text-azul-blue",
      bg: "bg-azul-blue/10",
      description: "Muestra un balance acumulado en tiempo real de las horas realizadas frente a la meta contratada en el periodo seleccionado. El porcentaje indica tu nivel de cumplimiento de jornada."
    },
    {
      title: "Periodo de Cómputo",
      badge: "Fechas",
      icon: <Calendar size={22} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      description: "Establece el rango de fechas en el que se computan las jornadas. Por defecto se calcula desde el 1 de diciembre del año anterior al 30 de noviembre del año corriente, adaptado a las condiciones de personal subrogado."
    },
    {
      title: "Metas de Pluses (Variables)",
      badge: "Pluses",
      icon: <Target size={22} />,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      description: "Puedes definir objetivos numéricos para pluses (por ejemplo, número de Nocturnas o Madrugues). El contador medirá cuántas veces has devengado ese plus frente al objetivo anual fijado."
    },
    {
      title: "Automatización con Turnos",
      badge: "Sincronización",
      icon: <CheckCircle2 size={22} />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "No necesitas añadir datos aquí manualmente. Las horas realizadas y las ocurrencias de pluses se leen directamente de los turnos que registres en la pestaña 'Turnos y Nómina'."
    }
  ];
  
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
  };

  const { period: activePeriod, targets: activeTargets } = useMemo(
    () => getCounterConfigForYear(settings, selectedYear),
    [settings, selectedYear]
  );

  const startDate = parseISO(activePeriod.start);
  const endDate = parseISO(activePeriod.end);

  // Filter shifts within the period
  const periodShifts = shifts.filter(s => {
    if (!isValid(startDate) || !isValid(endDate)) return false;
    const d = parseISO(s.date);
    if (!isValid(d)) return false;
    return isWithinInterval(d, { start: startOfDay(startDate), end: endOfDay(endDate) });
  });

  // Get current year pluses for reference (names)
  const currentPluses: PlusesData = pluses[selectedYear] || pluses[new Date().getFullYear()] || Object.values(pluses)[0] || {};

  // Calculate stats for the period
  const stats = getStatsForShifts(
    periodShifts, 
    settings.holidays, 
    settings.vacations, 
    settings.contractType, 
    false, 
    shifts, 
    activePeriod, 
    activeTargets['Nocturnas'] || 0,
    currentPluses['Nocturnas'],
    activeTargets['Madrugue'] || 0,
    currentPluses['Madrugue'],
    undefined,
    settings.isSubrogado,
    activeTargets,
    currentPluses
  );

  // Map stats key to plus name
  const statsMap: Record<string, string> = {
    'Jornada Fraccionada < 4h': 'splitLess4',
    'Jornada Fraccionada >= 4h': 'split4to7',
    'Jornada Fraccionada >= 7h': 'splitPlus7',
    'Manutención': 'manutencion',
    'Madrugue': 'madrugues',
    'Festivo': 'festivos',
    'Domingo': 'sundays',
    'Nocturnas': 'nightHours',
  };

  // All enabled pluses that are trackable in stats
  const variablePluses = Object.entries(currentPluses)
    .filter(([name, p]) => p.enabled && name in statsMap)
    .map(([name]) => name);

  const handleTargetChange = (name: string, value: string) => {
    if (isLocked) return;
    const isHourBased = ['Domingo', 'Festivo', 'Nocturnas'].includes(name);
    let num: number;
    if (isHourBased) {
      const parsed = parseFloat(value);
      num = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    } else {
      num = parseInt(value) || 0;
    }

    const currentSysYear = new Date().getFullYear();

    // 1. Get or initialize yearly targets safely without pulling future years' values
    const updatedYearly: { [year: number]: { [plusName: string]: number } } = {};
    if (settings.yearlyCounterTargets) {
      Object.entries(settings.yearlyCounterTargets).forEach(([yrKey, yrVal]) => {
        updatedYearly[Number(yrKey)] = { ...(yrVal || {}) };
      });
    }

    // Migrate legacy counterTargets once to currentSysYear if yearlyCounterTargets was empty
    if (Object.keys(updatedYearly).length === 0 && settings.counterTargets && Object.keys(settings.counterTargets).length > 0) {
      updatedYearly[currentSysYear] = { ...settings.counterTargets };
    }

    if (!updatedYearly[selectedYear]) {
      updatedYearly[selectedYear] = { ...activeTargets };
    }
    updatedYearly[selectedYear] = {
      ...updatedYearly[selectedYear],
      [name]: num
    };

    // 2. Mark this specific plus target as explicitly customized for selectedYear
    const updatedCustomized: { [year: number]: { [plusName: string]: boolean } } = {};
    if (settings.customizedCounterTargets) {
      Object.entries(settings.customizedCounterTargets).forEach(([yrKey, yrFlags]) => {
        updatedCustomized[Number(yrKey)] = { ...(yrFlags || {}) };
      });
    }
    if (!updatedCustomized[selectedYear]) {
      updatedCustomized[selectedYear] = {};
    }
    updatedCustomized[selectedYear][name] = true;

    // 3. Replicate forward only (never backwards), stopping at the first future year that was already customized for this plus
    const maxStoredYear = Math.max(
      selectedYear + 10,
      ...Object.keys(updatedYearly).map(Number).filter((y) => !isNaN(y)),
      ...Object.keys(updatedCustomized).map(Number).filter((y) => !isNaN(y))
    );
    for (let fYear = selectedYear + 1; fYear <= maxStoredYear; fYear++) {
      const isAlreadyCustomized = !!updatedCustomized[fYear]?.[name];
      if (isAlreadyCustomized) break;
      if (!updatedYearly[fYear]) {
        const inheritedBase = getCounterConfigForYear(
          { ...settings, yearlyCounterTargets: updatedYearly },
          fYear
        ).targets;
        updatedYearly[fYear] = { ...inheritedBase };
      }
      updatedYearly[fYear] = {
        ...updatedYearly[fYear],
        [name]: num
      };
    }

    // 4. Update settings
    updateSettings({
      ...settings,
      yearlyCounterTargets: updatedYearly,
      customizedCounterTargets: updatedCustomized,
      counterTargets: updatedYearly[currentSysYear] ? { ...updatedYearly[currentSysYear] } : settings.counterTargets
    });
  };

  const handleClearYearTargets = () => {
    if (isLocked) return;
    const updatedYearly: { [year: number]: { [plusName: string]: number } } = {
      ...(settings.yearlyCounterTargets || {})
    };
    updatedYearly[selectedYear] = {};

    const updatedCustomized: { [year: number]: { [plusName: string]: boolean } } = {
      ...(settings.customizedCounterTargets || {})
    };
    delete updatedCustomized[selectedYear];

    const currentSysYear = new Date().getFullYear();
    const isCurrent = selectedYear === currentSysYear;

    updateSettings({
      ...settings,
      yearlyCounterTargets: updatedYearly,
      customizedCounterTargets: updatedCustomized,
      counterTargets: isCurrent ? {} : settings.counterTargets
    });
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className="px-1 min-[360px]:px-1.5 sm:px-3 md:px-6 space-y-6 sm:space-y-8 pb-32 max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pt-4 sm:pt-6">
      {isLocked && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center gap-3 text-amber-800 dark:text-amber-200 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100">
              Edición Bloqueada por el Titular
            </h4>
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {activeSharedOwner?.ownerName || 'El titular'} ha bloqueado los permisos de edición para este cuadrante compartido. Los datos del contador están en modo solo lectura.
            </p>
          </div>
        </div>
      )}
      {/* Header Section (Sin título, selector de año centrado) */}
      <div className="flex flex-col items-center justify-center gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-6 text-center">

        <div className="flex items-center bg-slate-900 shadow-lg shadow-slate-900/20 rounded-2xl p-1 border border-white/10">
          <button 
            onClick={() => handleYearChange(selectedYear - 1)} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="px-6 flex items-center gap-3">
            <Calendar size={18} className="text-azul-yellow" />
            <span className="font-black text-white text-base tracking-tight">{selectedYear}</span>
          </div>
          <button 
            onClick={() => handleYearChange(selectedYear + 1)} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <DateRangePickerModal
        isOpen={periodPickerStep !== null}
        onClose={() => setPeriodPickerStep(null)}
        startDate={activePeriod.start}
        endDate={activePeriod.end}
        initialStep={periodPickerStep || 'start'}
        title="Periodo de Cómputo"
        subtitle="Marca el inicio y el fin del periodo"
        accentColor="blue"
        onChangeRange={(start, end) => {
          if (start && end) {
            const currentSysYear = new Date().getFullYear();
            updateSettings({
              ...settings,
              yearlyCounterPeriods: {
                ...(settings.yearlyCounterPeriods || {}),
                [selectedYear]: { start, end }
              },
              ...(selectedYear === currentSysYear ? { counterPeriod: { start, end } } : {})
            });
          }
        }}
      />

      {/* Period Selector */}
      <section className="bg-slate-900 p-5 sm:p-6 rounded-[2rem] text-white relative overflow-hidden shadow-xl shadow-slate-900/10 space-y-4">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-xl text-azul-yellow">
              <Calendar size={18} />
            </div>
            <h3 className="font-black uppercase text-xs tracking-widest text-white/50">Periodo de Cómputo</h3>
          </div>
          {!isLocked && (
            <button 
              onClick={() => setIsEditingPeriod(!isEditingPeriod)}
              className="text-[10px] font-black uppercase tracking-widest text-azul-yellow hover:text-white transition-colors"
            >
              {isEditingPeriod ? 'Cerrar' : 'Editar Periodo'}
            </button>
          )}
        </div>

        {isEditingPeriod ? (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Desde</label>
              <button
                type="button"
                onClick={() => setPeriodPickerStep('start')}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-azul-yellow/50 flex items-center justify-between cursor-pointer text-left"
              >
                <span>
                  {activePeriod.start && isValid(parseISO(activePeriod.start))
                    ? safeFormat(parseISO(activePeriod.start), 'dd/MM/yyyy')
                    : 'dd/mm/aaaa'}
                </span>
                <Calendar size={16} className="text-azul-yellow shrink-0" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Hasta</label>
              <button
                type="button"
                onClick={() => setPeriodPickerStep(activePeriod.start ? 'end' : 'start')}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-azul-yellow/50 flex items-center justify-between cursor-pointer text-left"
              >
                <span>
                  {activePeriod.end && isValid(parseISO(activePeriod.end))
                    ? safeFormat(parseISO(activePeriod.end), 'dd/MM/yyyy')
                    : 'dd/mm/aaaa'}
                </span>
                <Calendar size={16} className="text-azul-yellow shrink-0" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 py-2 relative z-10">
            <div className="text-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Inicio</p>
              <p className="text-sm font-black text-white">{isValid(startDate) ? safeFormat(startDate, 'dd MMM yyyy', { locale: es }) : '---'}</p>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Fin</p>
              <p className="text-sm font-black text-white">{isValid(endDate) ? safeFormat(endDate, 'dd MMM yyyy', { locale: es }) : '---'}</p>
            </div>
          </div>
        )}
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-azul-blue/20 rounded-full blur-3xl translate-y-12"></div>
      </section>

      {/* Variables List */}
      <div className="space-y-4">
        {variablePluses.map(name => {
          const statsKey = statsMap[name];
          const subKey = statsKey ? `${statsKey}Sub` : null;
          let current = statsKey ? (stats as any)[statsKey] || 0 : 0;
          if (subKey && (stats as any)[subKey]) {
            current += (stats as any)[subKey];
          }
          const target = activeTargets[name] || 0;
          const remaining = Math.max(0, target - current);
          const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

          const isHourBased = ['Domingo', 'Festivo', 'Nocturnas'].includes(name);
          const displayCurrent = isHourBased 
            ? `${Number(current.toFixed(2))} h` 
            : `${current}`;
          const displayRemaining = isHourBased 
            ? `${Number(remaining.toFixed(2))} h` 
            : `${remaining}`;

          return (
            <div key={`${selectedYear}-${name}`} className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-50 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-2">
                <div className="space-y-1 w-full">
                  <h4 className="text-sm font-black text-slate-700 uppercase leading-tight">{name}</h4>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Realizadas: {displayCurrent}</span>
                    <span className="hidden sm:inline text-slate-200">•</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      remaining > 0 ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {remaining > 0 ? `Faltan: ${displayRemaining}` : 'Objetivo cumplido'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Objetivo</label>
                  <div className="relative w-24 sm:w-24">
                    <LocalInput 
                      type="number"
                      value={target === 0 ? '' : target}
                      disabled={isLocked}
                      onChange={(val) => {
                        if (isLocked) return;
                        handleTargetChange(name, val);
                      }}
                      className={cn(
                        "w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 py-2 text-sm font-black text-slate-700 text-right",
                        isHourBased ? "pr-7" : "pr-3",
                        isLocked && "cursor-not-allowed opacity-60 pointer-events-none"
                      )}
                    />
                    <Target size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    {isHourBased && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">h</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000 ease-out",
                      progress >= 100 ? "bg-emerald-500" : "bg-azul-blue"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{progress.toFixed(0)}% Completado</span>
                  {progress >= 100 && (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle2 size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Límite SUB alcanzado</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden">
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-white/10 rounded-2xl text-azul-yellow">
            <Clock size={24} />
          </div>
          <div className="space-y-2">
            <h4 className="font-black uppercase text-sm tracking-widest">Funcionamiento del Contador</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Las variables listadas aplicarán el precio <span className="text-white font-bold">SUB</span> en la nómina hasta alcanzar la cantidad indicada como objetivo. 
              Una vez superado el objetivo o finalizado el periodo, se aplicará el precio <span className="text-white font-bold">CON</span> estándar.
            </p>
            <div className="flex items-start gap-2 pt-2 border-t border-white/10">
              <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/40 font-medium italic leading-snug">
                Nota: Se muestran todos los pluses que tienes habilitados. Si configuras un precio <span className="text-white/60 font-bold">SUB</span> en el apartado de <span className="text-white/60 font-bold">Tablas</span>, se aplicará dicho precio preferente hasta alcanzar el objetivo.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-azul-blue/20 rounded-full blur-3xl"></div>
      </div>

      {/* Action Buttons: Guía del Contador + Borrar Objetivos del Año */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 pb-2">
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md border cursor-pointer",
            showTutorial 
              ? "bg-azul-blue text-white border-azul-blue" 
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
          )}
        >
          <HelpCircle size={15} className={showTutorial ? "animate-bounce" : ""} />
          <span>Guía del Contador</span>
        </button>

        {!isLocked && (
          <button 
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="flex items-center gap-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white px-5 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-md border border-rose-200 cursor-pointer"
          >
            <Trash2 size={14} />
            <span className="uppercase tracking-widest">Borrar</span>
          </button>
        )}
      </div>

      {/* Tutorial Modal Overlay */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        title="Contador de Variables"
        subtitle="Guía de uso"
        steps={tutorialSteps}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleClearYearTargets}
        title={`¿Borrar objetivos de ${selectedYear}?`}
        message={`Esta acción restablecerá a cero todas las casillas objetivo del año ${selectedYear}. Los objetivos de otros años no se verán afectados.`}
        confirmLabel="Borrar Objetivos"
        variant="danger"
      />
    </div>
  );
};
